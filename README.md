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

## ⬡ GenLayer Intelligent Contract Integration

This project implements a fully working **GenLayer Intelligent Contract** that acts as an **On-Chain Bounty Adjudicator**. Users can post tasks with specific completion rules (such as writing a valid sorting function), workers can submit text deliverables, and validators reach an LLM consensus on-chain to evaluate the solution and award completion status.

### 1. Prerequisite: Install GenLayer CLI
Ensure you have Python 3.12+ and Node.js 18+ installed on your system.
```bash
npm install -g genlayer
```

### 2. Initialize and Start the Localnet Simulator
```bash
genlayer init
genlayer up
```
This starts the local GenLayer node and simulator. You can configure your MetaMask wallet to connect to it:
*   **Network Name**: GenLayer Localnet
*   **RPC URL**: `http://localhost:4000/api`
*   **Chain ID**: `61999`
*   **Currency Symbol**: `GEN`

### 3. Run Contract Unit Tests
The smart contract includes unit tests that mock the LLM validator consensus locally using `genlayer-test`.
```bash
pip install genlayer-test
pytest tests/ -v
```

### 4. Deploy the Contract
Deploy the Intelligent Contract to your running localnet simulator:
```bash
genlayer deploy contracts/bounty_board.py
```
This will print your contract's address (e.g. `0x...`). Copy this address, open the frontend, click on the **Bounty Board** tab, paste it into the **Contract Address** field, and click **Refresh**.

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
