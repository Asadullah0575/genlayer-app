require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { ethers } = require('ethers');
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

// ─── MongoDB Connection ───────────────────────────────────────────────────────
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
const Message = mongoose.model('Message', MessageSchema);

// ─── Auth Middleware ──────────────────────────────────────────────────────────
const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// ─── REST: Auth Routes ────────────────────────────────────────────────────────

// Step 1: Get nonce for wallet to sign
app.get('/auth/nonce/:address', async (req, res) => {
  try {
    const address = req.params.address.toLowerCase();
    let user = await User.findOne({ address });

    if (!user) {
      // New user — return nonce but don't save yet
      const nonce = Math.floor(Math.random() * 1000000).toString();
      return res.json({ nonce, isNew: true });
    }

    // Refresh nonce
    user.nonce = Math.floor(Math.random() * 1000000).toString();
    await user.save();
    res.json({ nonce: user.nonce, isNew: false, username: user.username });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Step 2: Verify signature and issue JWT
app.post('/auth/verify', async (req, res) => {
  try {
    const { address, signature, nonce, username } = req.body;
    if (!address || !signature || !nonce) {
      return res.status(400).json({ error: 'Missing fields' });
    }

    // Recover signer from signature
    const message = `Welcome to GenLayer!\n\nSign this message to verify your wallet.\n\nNonce: ${nonce}`;
    const recoveredAddress = ethers.verifyMessage(message, signature);

    if (recoveredAddress.toLowerCase() !== address.toLowerCase()) {
      return res.status(401).json({ error: 'Signature mismatch' });
    }

    let user = await User.findOne({ address: address.toLowerCase() });

    if (!user) {
      if (!username) return res.status(400).json({ error: 'Username required for new users' });
      user = await User.create({ address: address.toLowerCase(), username, nonce });
    }

    // Refresh nonce after use
    user.nonce = Math.floor(Math.random() * 1000000).toString();
    await user.save();

    const token = jwt.sign(
      { address: user.address, username: user.username, id: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({ token, username: user.username, address: user.address });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── REST: Messages ───────────────────────────────────────────────────────────
app.get('/messages/:room', authMiddleware, async (req, res) => {
  try {
    const messages = await Message.find({ room: req.params.room })
      .sort({ ts: 1 })
      .limit(50);
    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── REST: Health ─────────────────────────────────────────────────────────────
app.get('/health', (_, res) => res.json({ status: 'ok' }));

// ─── Socket.IO Auth Middleware ────────────────────────────────────────────────
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) return next(new Error('Authentication required'));
  try {
    socket.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    next(new Error('Invalid token'));
  }
});

// ─── Socket.IO ────────────────────────────────────────────────────────────────
const connectedUsers = {};

const ROOMS = ['general', 'research', 'design', 'backend', 'deploy'];
const ROOM_DESCS = {
  general: 'Open discussion',
  research: 'AI-assisted research',
  design: 'UI/UX collaboration',
  backend: 'API & infrastructure',
  deploy: 'DevOps & CI/CD',
};

io.on('connection', (socket) => {
  const { username, address } = socket.user;
  console.log(`[+] ${username} (${address?.slice(0, 8)}…) connected`);

  socket.on('join_room', async ({ room }) => {
    if (!ROOMS.includes(room)) return;

    const prev = connectedUsers[socket.id];
    if (prev?.room) {
      socket.leave(prev.room);
      io.to(prev.room).emit('user_left', { username, room: prev.room });
      broadcastUserList(prev.room);
    }

    connectedUsers[socket.id] = { username, address, room };
    socket.join(room);

    // Load history from MongoDB
    const messages = await Message.find({ room }).sort({ ts: 1 }).limit(50);
    socket.emit('room_history', { room, messages });

    io.to(room).emit('user_joined', { username, room });
    broadcastUserList(room);
  });

  socket.on('send_message', async ({ room, text }) => {
    if (!ROOMS.includes(room) || !text?.trim()) return;

    const msg = await Message.create({
      room, username, address, text: text.trim(), type: 'user',
    });

    io.to(room).emit('new_message', { room, message: msg });

    const aiTrigger = /^@(ai|genlayer)\s+/i.test(text.trim());
    const alwaysAI = process.env.AI_ALWAYS === 'true';

    if (aiTrigger || alwaysAI) {
      io.to(room).emit('ai_typing', { room, typing: true });

      try {
        const history = await Message.find({ room }).sort({ ts: -1 }).limit(8);
        const cleanText = text.replace(/^@(ai|genlayer)\s+/i, '');

        const response = await anthropic.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          system: `You are GenLayer AI in "#${room}" (${ROOM_DESCS[room]}). Help the team build a GenLayer-powered app. Be concise and technical. Under 150 words.`,
          messages: [
            ...history.reverse().map(m => ({
              role: m.type === 'ai' ? 'assistant' : 'user',
              content: `${m.type !== 'ai' ? m.username + ': ' : ''}${m.text}`,
            })),
            { role: 'user', content: `${username}: ${cleanText}` },
          ],
        });

        const aiText = response.content.map(b => b.text || '').join('');
        const aiMsg = await Message.create({
          room, username: 'GenLayer AI', text: aiText, type: 'ai',
        });

        io.to(room).emit('new_message', { room, message: aiMsg });
      } catch (err) {
        console.error('[AI Error]', err.message);
      } finally {
        io.to(room).emit('ai_typing', { room, typing: false });
      }
    }
  });

  socket.on('typing', ({ room, isTyping }) => {
    socket.to(room).emit('user_typing', { username, isTyping });
  });

  socket.on('disconnect', () => {
    const user = connectedUsers[socket.id];
    if (user) {
      io.to(user.room).emit('user_left', { username, room: user.room });
      broadcastUserList(user.room);
      delete connectedUsers[socket.id];
    }
    console.log(`[-] ${username} disconnected`);
  });
});

function broadcastUserList(room) {
  const users = Object.values(connectedUsers)
    .filter(u => u.room === room)
    .map(u => ({ username: u.username, address: u.address }));
  io.to(room).emit('room_users', { room, users });
}

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log(`✅ GenLayer server running on port ${PORT}`));