# ⬡ GenLayer — Multi-Room AI Collaboration

Real-time collaborative workspace with Socket.IO and GenLayer AI (powered by Claude).

---

## Architecture

```
Frontend (React + Vite)  ←→  Backend (Node + Socket.IO)  ←→  Anthropic API
     localhost:3000               localhost:4000
```

---

## Quick Start

### 1. Backend

```bash
cd genlayer-backend
npm install
cp .env.example .env
# Edit .env — add your ANTHROPIC_API_KEY
npm run dev
```

### 2. Frontend

```bash
cd genlayer-backend/frontend
npm install
cp .env.example .env
# Edit .env — set VITE_SOCKET_URL=http://localhost:4000
npm run dev
```

Open http://localhost:3000 in two browser tabs to test multi-user.

---

## Socket.IO Events

### Client → Server

| Event          | Payload                              | Description                    |
|----------------|--------------------------------------|--------------------------------|
| `join_room`    | `{ username, room }`                 | Join a collaboration room      |
| `send_message` | `{ room, text, username }`           | Send a message                 |
| `typing`       | `{ room, username, isTyping }`       | Broadcast typing status        |

### Server → Client

| Event          | Payload                              | Description                    |
|----------------|--------------------------------------|--------------------------------|
| `room_history` | `{ room, messages[] }`              | Last 50 messages on join       |
| `new_message`  | `{ room, message }`                 | New message (user or AI)       |
| `room_users`   | `{ room, users[] }`                 | Updated user list              |
| `user_joined`  | `{ username, room }`                | User entered room              |
| `user_left`    | `{ username, room }`                | User disconnected              |
| `user_typing`  | `{ username, isTyping }`            | Peer typing indicator          |
| `ai_typing`    | `{ room, typing }`                  | AI is generating response      |

---

## Triggering the AI

By default, prefix any message with `@ai` or `@genlayer` to get an AI response:

```
@ai what's the best approach for our GenLayer smart contract architecture?
```

To make AI respond to **every** message, set `AI_ALWAYS=true` in your backend `.env`.

---

## Rooms

| Room       | Purpose                     |
|------------|-----------------------------|
| `general`  | Open team discussion        |
| `research` | AI-assisted research        |
| `design`   | UI/UX collaboration         |
| `backend`  | API & infrastructure        |
| `deploy`   | DevOps & CI/CD              |

---

## Deployment

### Backend → Render
1. Push to GitHub
2. Create new **Web Service** on [render.com](https://render.com)
3. Set env vars: `ANTHROPIC_API_KEY`, `FRONTEND_URL`, `PORT`
4. Build command: `npm install` · Start command: `npm start`

### Frontend → Vercel
1. Push frontend folder to GitHub
2. Import on [vercel.com](https://vercel.com)
3. Set env var: `VITE_SOCKET_URL=https://your-backend.onrender.com`
4. Deploy

---

## Next Steps

- [ ] Add user authentication (JWT or wallet-based)
- [ ] Persist messages with Supabase or MongoDB
- [ ] Room creation / private rooms
- [ ] File sharing & code snippets
- [ ] AI memory across sessions
