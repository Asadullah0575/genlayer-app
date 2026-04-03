const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const Anthropic = require('@anthropic-ai/sdk');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
  },
});

app.use(cors());
app.use(express.json());

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// In-memory store (replace with DB later)
const rooms = {
  general:  { name: 'general',  desc: 'Open discussion',         messages: [] },
  research: { name: 'research', desc: 'AI-assisted research',    messages: [] },
  design:   { name: 'design',   desc: 'UI/UX collaboration',     messages: [] },
  backend:  { name: 'backend',  desc: 'API & infrastructure',    messages: [] },
  deploy:   { name: 'deploy',   desc: 'DevOps & CI/CD',          messages: [] },
};

// Track connected users: socketId -> { username, room }
const connectedUsers = {};

// ─── REST: health check ───────────────────────────────────────────────────────
app.get('/health', (_, res) => res.json({ status: 'ok', rooms: Object.keys(rooms) }));

// ─── Socket.IO ────────────────────────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log(`[+] Socket connected: ${socket.id}`);

  // JOIN ROOM
  socket.on('join_room', ({ username, room }) => {
    if (!rooms[room]) return socket.emit('error', { message: 'Room not found' });

    // Leave previous room if any
    const prev = connectedUsers[socket.id];
    if (prev?.room) {
      socket.leave(prev.room);
      io.to(prev.room).emit('user_left', { username: prev.username, room: prev.room });
    }

    connectedUsers[socket.id] = { username, room };
    socket.join(room);

    // Send message history
    socket.emit('room_history', { room, messages: rooms[room].messages.slice(-50) });

    // Notify room
    io.to(room).emit('user_joined', { username, room });

    // Send updated user list
    broadcastUserList(room);
    console.log(`[→] ${username} joined #${room}`);
  });

  // SEND MESSAGE
  socket.on('send_message', async ({ room, text, username }) => {
    if (!rooms[room] || !text?.trim()) return;

    const msg = {
      id: Date.now(),
      username,
      text: text.trim(),
      ts: new Date().toISOString(),
      type: 'user',
    };

    rooms[room].messages.push(msg);
    io.to(room).emit('new_message', { room, message: msg });

    // Trigger AI if message starts with @ai or @genlayer
    const aiTrigger = /^@(ai|genlayer)\s+/i.test(text.trim());
    const alwaysAI = process.env.AI_ALWAYS === 'true';

    if (aiTrigger || alwaysAI) {
      // Show typing indicator
      io.to(room).emit('ai_typing', { room, typing: true });

      try {
        const history = rooms[room].messages
          .slice(-8)
          .filter(m => m.id !== msg.id)
          .map(m => ({
            role: m.type === 'ai' ? 'assistant' : 'user',
            content: `${m.type !== 'ai' ? m.username + ': ' : ''}${m.text}`,
          }));

        const cleanText = text.replace(/^@(ai|genlayer)\s+/i, '');

        const response = await anthropic.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          system: `You are GenLayer AI, an intelligent assistant in the collaborative room "#${room}" (${rooms[room].desc}). Help the team build a GenLayer-powered application. Be concise and technical. Keep responses under 150 words.`,
          messages: [
            ...history,
            { role: 'user', content: `${username}: ${cleanText}` },
          ],
        });

        const aiText = response.content.map(b => b.text || '').join('');
        const aiMsg = {
          id: Date.now() + 1,
          username: 'GenLayer AI',
          text: aiText,
          ts: new Date().toISOString(),
          type: 'ai',
        };

        rooms[room].messages.push(aiMsg);
        io.to(room).emit('new_message', { room, message: aiMsg });
      } catch (err) {
        console.error('[AI Error]', err.message);
        io.to(room).emit('new_message', {
          room,
          message: {
            id: Date.now() + 2,
            username: 'GenLayer AI',
            text: 'AI service temporarily unavailable.',
            ts: new Date().toISOString(),
            type: 'ai',
          },
        });
      } finally {
        io.to(room).emit('ai_typing', { room, typing: false });
      }
    }
  });

  // TYPING INDICATOR
  socket.on('typing', ({ room, username, isTyping }) => {
    socket.to(room).emit('user_typing', { username, isTyping });
  });

  // DISCONNECT
  socket.on('disconnect', () => {
    const user = connectedUsers[socket.id];
    if (user) {
      io.to(user.room).emit('user_left', { username: user.username, room: user.room });
      broadcastUserList(user.room);
      delete connectedUsers[socket.id];
    }
    console.log(`[-] Socket disconnected: ${socket.id}`);
  });
});

function broadcastUserList(room) {
  const users = Object.values(connectedUsers)
    .filter(u => u.room === room)
    .map(u => u.username);
  io.to(room).emit('room_users', { room, users });
}

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log(`✅ GenLayer server running on port ${PORT}`));
