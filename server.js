require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { ethers } = require('ethers');
const crypto = require('crypto');
const Anthropic = require('@anthropic-ai/sdk');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
  },
});

app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173' }));
app.use(express.json());

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ─── MongoDB ──────────────────────────────────────────────────────────────────
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('❌ MongoDB error:', err));

// ─── Schemas ──────────────────────────────────────────────────────────────────
const UserSchema = new mongoose.Schema({
  address: { type: String, required: true, unique: true, lowercase: true },
  username: { type: String, required: true },
  nonce: { type: String, default: () => Math.floor(Math.random() * 1000000).toString() },
  createdAt: { type: Date, default: Date.now },
});

const PrivateRoomSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String, default: '' },
  inviteCode: { type: String, unique: true },
  creatorAddress: { type: String, required: true, lowercase: true },
  creatorUsername: { type: String, required: true },
  members: [{ address: { type: String, lowercase: true }, username: String, joinedAt: { type: Date, default: Date.now } }],
  pendingRequests: [{ address: { type: String, lowercase: true }, username: String, requestedAt: { type: Date, default: Date.now } }],
  createdAt: { type: Date, default: Date.now },
});

const MessageSchema = new mongoose.Schema({
  room: { type: String, required: true },
  username: { type: String, required: true },
  address: { type: String },
  text: { type: String, required: true },
  type: { type: String, enum: ['user', 'ai', 'system'], default: 'user' },
  ts: { type: Date, default: Date.now },
});
MessageSchema.index({ room: 1, ts: -1 });

const User = mongoose.model('User', UserSchema);
const PrivateRoom = mongoose.model('PrivateRoom', PrivateRoomSchema);
const Message = mongoose.model('Message', MessageSchema);

// ─── Auth Middleware ──────────────────────────────────────────────────────────
const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });
  try { req.user = jwt.verify(token, process.env.JWT_SECRET); next(); }
  catch { res.status(401).json({ error: 'Invalid token' }); }
};

// ─── Auth Routes ──────────────────────────────────────────────────────────────
app.get('/auth/nonce/:address', async (req, res) => {
  try {
    const address = req.params.address.toLowerCase();
    let user = await User.findOne({ address });
    if (!user) {
      const nonce = Math.floor(Math.random() * 1000000).toString();
      return res.json({ nonce, isNew: true });
    }
    user.nonce = Math.floor(Math.random() * 1000000).toString();
    await user.save();
    res.json({ nonce: user.nonce, isNew: false, username: user.username });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/auth/verify', async (req, res) => {
  try {
    const { address, signature, nonce, username } = req.body;
    if (!address || !signature || !nonce) return res.status(400).json({ error: 'Missing fields' });
    const message = `Welcome to GenLayer!\n\nSign this message to verify your wallet.\n\nNonce: ${nonce}`;
    const recovered = ethers.verifyMessage(message, signature);
    if (recovered.toLowerCase() !== address.toLowerCase()) return res.status(401).json({ error: 'Signature mismatch' });
    let user = await User.findOne({ address: address.toLowerCase() });
    if (!user) {
      if (!username) return res.status(400).json({ error: 'Username required' });
      user = await User.create({ address: address.toLowerCase(), username, nonce });
    }
    user.nonce = Math.floor(Math.random() * 1000000).toString();
    await user.save();
    const token = jwt.sign({ address: user.address, username: user.username, id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, username: user.username, address: user.address });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── Private Room Routes ──────────────────────────────────────────────────────

// Create a private room
app.post('/rooms/create', authMiddleware, async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Room name required' });
    const inviteCode = crypto.randomBytes(8).toString('hex');
    const room = await PrivateRoom.create({
      name: name.trim(),
      description: description?.trim() || '',
      inviteCode,
      creatorAddress: req.user.address,
      creatorUsername: req.user.username,
      members: [{ address: req.user.address, username: req.user.username }],
    });
    res.json({ room });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Get room info by invite code (public — for join page)
app.get('/rooms/invite/:code', async (req, res) => {
  try {
    const room = await PrivateRoom.findOne({ inviteCode: req.params.code });
    if (!room) return res.status(404).json({ error: 'Invalid invite link' });
    res.json({ id: room._id, name: room.name, description: room.description, creatorUsername: room.creatorUsername, memberCount: room.members.length });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Request to join a room
app.post('/rooms/request/:code', authMiddleware, async (req, res) => {
  try {
    const room = await PrivateRoom.findOne({ inviteCode: req.params.code });
    if (!room) return res.status(404).json({ error: 'Invalid invite link' });
    const isMember = room.members.some(m => m.address === req.user.address);
    if (isMember) return res.json({ status: 'already_member', roomId: room._id });
    const isPending = room.pendingRequests.some(r => r.address === req.user.address);
    if (isPending) return res.json({ status: 'pending' });
    room.pendingRequests.push({ address: req.user.address, username: req.user.username });
    await room.save();
    // Notify creator via socket
    io.to(`user:${room.creatorAddress}`).emit('join_request', {
      roomId: room._id, roomName: room.name,
      requester: { address: req.user.address, username: req.user.username },
    });
    res.json({ status: 'pending' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Approve or reject a join request (creator only)
app.post('/rooms/:roomId/respond', authMiddleware, async (req, res) => {
  try {
    const { requesterAddress, action } = req.body; // action: 'approve' | 'reject'
    const room = await PrivateRoom.findById(req.params.roomId);
    if (!room) return res.status(404).json({ error: 'Room not found' });
    if (room.creatorAddress !== req.user.address) return res.status(403).json({ error: 'Only creator can approve' });
    const reqIndex = room.pendingRequests.findIndex(r => r.address === requesterAddress);
    if (reqIndex === -1) return res.status(404).json({ error: 'Request not found' });
    const requester = room.pendingRequests[reqIndex];
    room.pendingRequests.splice(reqIndex, 1);
    if (action === 'approve') {
      room.members.push({ address: requester.address, username: requester.username });
      await room.save();
      io.to(`user:${requester.address}`).emit('join_approved', { roomId: room._id, roomName: room.name, inviteCode: room.inviteCode });
    } else {
      await room.save();
      io.to(`user:${requester.address}`).emit('join_rejected', { roomName: room.name });
    }
    res.json({ status: action === 'approve' ? 'approved' : 'rejected' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Get my rooms (created + member of)
app.get('/rooms/my', authMiddleware, async (req, res) => {
  try {
    const rooms = await PrivateRoom.find({ 'members.address': req.user.address });
    res.json(rooms.map(r => ({
      id: r._id, name: r.name, description: r.description,
      inviteCode: r.inviteCode,
      isCreator: r.creatorAddress === req.user.address,
      memberCount: r.members.length,
      pendingCount: r.creatorAddress === req.user.address ? r.pendingRequests.length : 0,
      pendingRequests: r.creatorAddress === req.user.address ? r.pendingRequests : [],
    })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Delete a room (creator only)
app.delete('/rooms/:roomId', authMiddleware, async (req, res) => {
  try {
    const room = await PrivateRoom.findById(req.params.roomId);
    if (!room) return res.status(404).json({ error: 'Room not found' });
    if (room.creatorAddress !== req.user.address) return res.status(403).json({ error: 'Only creator can delete' });
    await PrivateRoom.deleteOne({ _id: room._id });
    await Message.deleteMany({ room: `private:${room._id}` });
    io.to(`private:${room._id}`).emit('room_deleted', { roomName: room.name });
    res.json({ status: 'deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Get messages
app.get('/messages/:room', authMiddleware, async (req, res) => {
  try {
    const messages = await Message.find({ room: req.params.room }).sort({ ts: 1 }).limit(50);
    res.json(messages);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/health', (_, res) => res.json({ status: 'ok' }));

// ─── Socket.IO Auth ───────────────────────────────────────────────────────────
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) return next(new Error('Authentication required'));
  try { socket.user = jwt.verify(token, process.env.JWT_SECRET); next(); }
  catch { next(new Error('Invalid token')); }
});

const connectedUsers = {};
const PUBLIC_ROOMS = ['general', 'research', 'design', 'backend', 'deploy'];
const ROOM_DESCS = { general: 'Open discussion', research: 'AI-assisted research', design: 'UI/UX collaboration', backend: 'API & infrastructure', deploy: 'DevOps & CI/CD' };

io.on('connection', (socket) => {
  const { username, address } = socket.user;
  // Join personal notification channel
  socket.join(`user:${address}`);

  socket.on('join_room', async ({ room }) => {
    const isPublic = PUBLIC_ROOMS.includes(room);
    const isPrivate = room.startsWith('private:');

    if (!isPublic && !isPrivate) return;

    // Check private room access
    if (isPrivate) {
      const roomId = room.replace('private:', '');
      const privateRoom = await PrivateRoom.findById(roomId);
      if (!privateRoom) return socket.emit('error', { message: 'Room not found' });
      const isMember = privateRoom.members.some(m => m.address === address);
      if (!isMember) return socket.emit('error', { message: 'Access denied' });
    }

    const prev = connectedUsers[socket.id];
    if (prev?.room) {
      socket.leave(prev.room);
      io.to(prev.room).emit('user_left', { username, room: prev.room });
      broadcastUserList(prev.room);
    }

    connectedUsers[socket.id] = { username, address, room };
    socket.join(room);
    const messages = await Message.find({ room }).sort({ ts: 1 }).limit(50);
    socket.emit('room_history', { room, messages });
    io.to(room).emit('user_joined', { username, room });
    broadcastUserList(room);
  });

  socket.on('send_message', async ({ room, text }) => {
    const isPublic = PUBLIC_ROOMS.includes(room);
    const isPrivate = room.startsWith('private:');
    if (!isPublic && !isPrivate) return;
    if (!text?.trim()) return;

    if (isPrivate) {
      const roomId = room.replace('private:', '');
      const privateRoom = await PrivateRoom.findById(roomId);
      if (!privateRoom?.members.some(m => m.address === address)) return;
    }

    const msg = await Message.create({ room, username, address, text: text.trim(), type: 'user' });
    io.to(room).emit('new_message', { room, message: msg });

    const aiTrigger = /^@(ai|genlayer)\s+/i.test(text.trim());
    const alwaysAI = process.env.AI_ALWAYS === 'true';

    if (aiTrigger || alwaysAI) {
      io.to(room).emit('ai_typing', { room, typing: true });
      try {
        const history = await Message.find({ room }).sort({ ts: -1 }).limit(8);
        const cleanText = text.replace(/^@(ai|genlayer)\s+/i, '');
        const roomDesc = ROOM_DESCS[room] || 'Private collaboration room';
        const response = await anthropic.messages.create({
          model: 'claude-sonnet-4-20250514', max_tokens: 1000,
          system: `You are GenLayer AI in "${room}" (${roomDesc}). Help the team build a GenLayer-powered app. Be concise and technical. Under 150 words.`,
          messages: [
            ...history.reverse().map(m => ({ role: m.type === 'ai' ? 'assistant' : 'user', content: `${m.type !== 'ai' ? m.username + ': ' : ''}${m.text}` })),
            { role: 'user', content: `${username}: ${cleanText}` },
          ],
        });
        const aiText = response.content.map(b => b.text || '').join('');
        const aiMsg = await Message.create({ room, username: 'GenLayer AI', text: aiText, type: 'ai' });
        io.to(room).emit('new_message', { room, message: aiMsg });
      } catch (err) { console.error('[AI Error]', err.message); }
      finally { io.to(room).emit('ai_typing', { room, typing: false }); }
    }
  });

  socket.on('typing', ({ room, isTyping }) => socket.to(room).emit('user_typing', { username, isTyping }));

  socket.on('disconnect', () => {
    const user = connectedUsers[socket.id];
    if (user) {
      io.to(user.room).emit('user_left', { username, room: user.room });
      broadcastUserList(user.room);
      delete connectedUsers[socket.id];
    }
  });
});

function broadcastUserList(room) {
  const users = Object.values(connectedUsers).filter(u => u.room === room).map(u => ({ username: u.username, address: u.address }));
  io.to(room).emit('room_users', { room, users });
}

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log(`✅ GenLayer server running on port ${PORT}`));