import { useState, useRef, useEffect, useCallback } from 'react';
import { io } from 'socket.io-client';

// ─── Config ──────────────────────────────────────────────────────────────────
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:4000';

const ROOMS = [
  { id: 'general',  name: 'general',  desc: 'Open discussion',      color: '#3b82f6' },
  { id: 'research', name: 'research', desc: 'AI-assisted research',  color: '#8b5cf6' },
  { id: 'design',   name: 'design',   desc: 'UI/UX collaboration',   color: '#ec4899' },
  { id: 'backend',  name: 'backend',  desc: 'API & infrastructure',  color: '#10b981' },
  { id: 'deploy',   name: 'deploy',   desc: 'DevOps & CI/CD',        color: '#f59e0b' },
];

// ─── Socket singleton ─────────────────────────────────────────────────────────
let socket = null;
function getSocket() {
  if (!socket) socket = io(SOCKET_URL, { autoConnect: false });
  return socket;
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function Avatar({ name, color, size = 32 }) {
  const initials = name.slice(0, 2).toUpperCase();
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: color + '22', border: `1.5px solid ${color}55`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.35, fontWeight: 600, color,
      flexShrink: 0, fontFamily: "'Space Mono', monospace",
    }}>{initials}</div>
  );
}

function Message({ msg }) {
  const isAI = msg.type === 'ai';
  const ts = new Date(msg.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return (
    <div style={{ display: 'flex', gap: 10, padding: '6px 0', animation: 'fadeIn 0.2s ease' }}>
      <style>{`@keyframes fadeIn{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:none}}`}</style>
      {isAI ? (
        <div style={{
          width: 32, height: 32, borderRadius: 8, flexShrink: 0,
          background: '#1e3a5f', border: '1.5px solid #3b82f633',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14,
        }}>⬡</div>
      ) : (
        <Avatar name={msg.username} color={stringToColor(msg.username)} size={32} />
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 3 }}>
          <span style={{
            fontSize: 13, fontWeight: 600,
            color: isAI ? '#3b82f6' : stringToColor(msg.username),
            fontFamily: isAI ? "'Space Mono',monospace" : 'inherit',
          }}>
            {isAI ? 'GenLayer AI' : msg.username}
          </span>
          <span style={{ fontSize: 11, color: '#4a5568', fontFamily: "'Space Mono',monospace" }}>{ts}</span>
        </div>
        <div style={{
          fontSize: 14, color: '#cbd5e1', lineHeight: 1.6,
          background: isAI ? 'rgba(59,130,246,0.06)' : 'transparent',
          border: isAI ? '1px solid rgba(59,130,246,0.12)' : 'none',
          borderRadius: isAI ? 10 : 0,
          padding: isAI ? '10px 14px' : 0,
          whiteSpace: 'pre-wrap',
        }}>
          {msg.text}
        </div>
      </div>
    </div>
  );
}

function TypingDots({ names }) {
  if (!names.length) return null;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', fontSize: 12, color: '#4a5568' }}>
      <div style={{ display: 'flex', gap: 3 }}>
        {[0,1,2].map(i => (
          <div key={i} style={{
            width: 5, height: 5, borderRadius: '50%', background: '#3b82f6',
            animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite`, opacity: 0.7,
          }}/>
        ))}
      </div>
      <style>{`@keyframes pulse{0%,80%,100%{transform:scale(0.6);opacity:0.4}40%{transform:scale(1);opacity:1}}`}</style>
      <span>{names.join(', ')} {names.length === 1 ? 'is' : 'are'} typing…</span>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const COLORS = ['#3b82f6','#8b5cf6','#ec4899','#10b981','#f59e0b','#ef4444','#06b6d4'];
function stringToColor(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return COLORS[Math.abs(hash) % COLORS.length];
}

// ─── Login screen ─────────────────────────────────────────────────────────────
function LoginScreen({ onJoin }) {
  const [name, setName] = useState('');
  return (
    <div style={{
      height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#080c14',
    }}>
      <div style={{
        background: '#0d1420', border: '1px solid #1a2d4a', borderRadius: 16,
        padding: '40px 48px', width: 360, textAlign: 'center',
      }}>
        <div style={{ fontSize: 36, marginBottom: 16 }}>⬡</div>
        <h1 style={{ fontFamily: "'Space Mono',monospace", fontSize: 18, color: '#e2e8f0', marginBottom: 8 }}>GENLAYER</h1>
        <p style={{ fontSize: 13, color: '#4a5568', marginBottom: 28 }}>Multi-room AI collaboration</p>
        <input
          type="text"
          placeholder="Enter your name…"
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && name.trim() && onJoin(name.trim())}
          style={{
            width: '100%', padding: '10px 14px', borderRadius: 8,
            background: '#111827', border: '1px solid #1e2d45',
            color: '#e2e8f0', fontSize: 14, outline: 'none', marginBottom: 14,
          }}
          autoFocus
        />
        <button
          onClick={() => name.trim() && onJoin(name.trim())}
          style={{
            width: '100%', padding: '10px', borderRadius: 8,
            background: name.trim() ? '#3b82f6' : '#1e2d45',
            border: 'none', color: '#fff', fontSize: 14, cursor: name.trim() ? 'pointer' : 'default',
            fontFamily: "'Space Mono',monospace", letterSpacing: '0.05em',
          }}
        >JOIN →</button>
      </div>
    </div>
  );
}

// ─── Main App ────────────────────────────────────────────────────────────────
export default function App() {
  const [username, setUsername] = useState(null);
  const [activeRoom, setActiveRoom] = useState('general');
  const [messages, setMessages] = useState({});
  const [roomUsers, setRoomUsers] = useState({});
  const [typingUsers, setTypingUsers] = useState({});   // room -> [usernames]
  const [aiTyping, setAiTyping] = useState({});          // room -> bool
  const [input, setInput] = useState('');
  const [connected, setConnected] = useState(false);
  const [unread, setUnread] = useState({});
  const messagesEndRef = useRef(null);
  const typingTimeout = useRef(null);
  const socketRef = useRef(null);

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  useEffect(scrollToBottom, [messages, activeRoom, aiTyping]);

  // Mark room as read when switching
  useEffect(() => {
    setUnread(prev => ({ ...prev, [activeRoom]: 0 }));
  }, [activeRoom]);

  const handleJoin = useCallback((name) => {
    setUsername(name);
    const s = getSocket();
    socketRef.current = s;
    s.connect();

    s.on('connect', () => {
      setConnected(true);
      s.emit('join_room', { username: name, room: 'general' });
    });

    s.on('disconnect', () => setConnected(false));

    s.on('room_history', ({ room, messages: msgs }) => {
      setMessages(prev => ({ ...prev, [room]: msgs }));
    });

    s.on('new_message', ({ room, message }) => {
      setMessages(prev => ({ ...prev, [room]: [...(prev[room] || []), message] }));
      setUnread(prev => ({
        ...prev,
        [room]: room === activeRoom ? 0 : (prev[room] || 0) + 1,
      }));
    });

    s.on('room_users', ({ room, users }) => {
      setRoomUsers(prev => ({ ...prev, [room]: users }));
    });

    s.on('user_typing', ({ username: u, isTyping }) => {
      setTypingUsers(prev => {
        const cur = new Set(prev[activeRoom] || []);
        isTyping ? cur.add(u) : cur.delete(u);
        return { ...prev, [activeRoom]: [...cur] };
      });
    });

    s.on('ai_typing', ({ room, typing }) => {
      setAiTyping(prev => ({ ...prev, [room]: typing }));
    });

    s.on('user_joined', ({ username: u, room }) => {
      if (u !== name) {
        setMessages(prev => ({
          ...prev,
          [room]: [...(prev[room] || []), {
            id: Date.now(), type: 'system',
            text: `${u} joined #${room}`, ts: new Date().toISOString(),
            username: 'system',
          }],
        }));
      }
    });

    s.on('user_left', ({ username: u, room }) => {
      setMessages(prev => ({
        ...prev,
        [room]: [...(prev[room] || []), {
          id: Date.now(), type: 'system',
          text: `${u} left #${room}`, ts: new Date().toISOString(),
          username: 'system',
        }],
      }));
    });
  }, [activeRoom]);

  const switchRoom = (room) => {
    if (room === activeRoom) return;
    setActiveRoom(room);
    socketRef.current?.emit('join_room', { username, room });
  };

  const sendMessage = () => {
    const text = input.trim();
    if (!text || !connected) return;
    socketRef.current.emit('send_message', { room: activeRoom, text, username });
    socketRef.current.emit('typing', { room: activeRoom, username, isTyping: false });
    setInput('');
  };

  const handleTyping = (e) => {
    setInput(e.target.value);
    socketRef.current?.emit('typing', { room: activeRoom, username, isTyping: true });
    clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => {
      socketRef.current?.emit('typing', { room: activeRoom, username, isTyping: false });
    }, 1500);
  };

  if (!username) return <LoginScreen onJoin={handleJoin} />;

  const room = ROOMS.find(r => r.id === activeRoom);
  const roomMsgs = messages[activeRoom] || [];
  const typingNow = (typingUsers[activeRoom] || []).filter(u => u !== username);
  const isAITyping = aiTyping[activeRoom];
  const onlineUsers = roomUsers[activeRoom] || [];

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#080c14', color: '#e2e8f0', fontFamily: "'DM Sans',sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=DM+Sans:wght@300;400;500&display=swap');*{box-sizing:border-box;margin:0;padding:0}::-webkit-scrollbar{width:4px}::-webkit-scrollbar-thumb{background:#1e2d45;border-radius:4px}`}</style>

      {/* Sidebar */}
      <div style={{ width: 220, background: '#0d1420', borderRight: '1px solid #1a2d4a', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '18px 16px 12px', borderBottom: '1px solid #1a2d4a' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 28, height: 28, background: '#3b82f6', borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>⬡</div>
            <span style={{ fontFamily: "'Space Mono',monospace", fontWeight: 700, fontSize: 13, letterSpacing: '0.02em' }}>GENLAYER</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: connected ? '#10b981' : '#ef4444' }}/>
            <span style={{ fontSize: 11, color: '#4a5568', fontFamily: "'Space Mono',monospace" }}>{connected ? 'connected' : 'reconnecting…'}</span>
          </div>
        </div>

        <div style={{ padding: '12px 8px', flex: 1, overflowY: 'auto' }}>
          <div style={{ fontSize: 10, color: '#4a5568', fontFamily: "'Space Mono',monospace", padding: '0 8px 8px', letterSpacing: '0.1em' }}>ROOMS</div>
          {ROOMS.map(r => (
            <button key={r.id} onClick={() => switchRoom(r.id)} style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 8,
              padding: '7px 10px', borderRadius: 8, border: 'none', cursor: 'pointer',
              background: activeRoom === r.id ? 'rgba(59,130,246,0.12)' : 'transparent',
              color: activeRoom === r.id ? '#60a5fa' : '#64748b',
              marginBottom: 1, textAlign: 'left',
            }}>
              <span style={{ fontSize: 10, color: activeRoom === r.id ? r.color : '#334155' }}>⬡</span>
              <span style={{ fontSize: 13, fontWeight: activeRoom === r.id ? 500 : 400, flex: 1 }}>{r.name}</span>
              {unread[r.id] > 0 && (
                <span style={{ fontSize: 10, background: r.color, color: '#fff', borderRadius: 10, padding: '1px 6px', fontFamily: "'Space Mono',monospace" }}>
                  {unread[r.id]}
                </span>
              )}
            </button>
          ))}

          {onlineUsers.length > 0 && (
            <>
              <div style={{ fontSize: 10, color: '#4a5568', fontFamily: "'Space Mono',monospace", padding: '16px 8px 8px', letterSpacing: '0.1em' }}>
                IN #{activeRoom.toUpperCase()}
              </div>
              {onlineUsers.map(u => (
                <div key={u} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 10px' }}>
                  <div style={{ position: 'relative' }}>
                    <Avatar name={u} color={stringToColor(u)} size={22} />
                    <div style={{ position: 'absolute', bottom: -1, right: -1, width: 6, height: 6, borderRadius: '50%', background: '#10b981', border: '1.5px solid #0d1420' }}/>
                  </div>
                  <span style={{ fontSize: 12, color: u === username ? '#e2e8f0' : '#64748b' }}>{u}{u === username ? ' (you)' : ''}</span>
                </div>
              ))}
            </>
          )}
        </div>

        <div style={{ padding: '10px 12px', borderTop: '1px solid #1a2d4a', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Avatar name={username} color={stringToColor(username)} size={28} />
          <span style={{ fontSize: 12, color: '#64748b', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{username}</span>
        </div>
      </div>

      {/* Main */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0 20px', height: 56, borderBottom: '1px solid #1a2d4a', background: '#0a0f1a', flexShrink: 0 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: room?.color }}/>
          <span style={{ fontFamily: "'Space Mono',monospace", fontSize: 13, fontWeight: 700 }}>#{room?.name}</span>
          <span style={{ fontSize: 12, color: '#4a5568' }}>{room?.desc}</span>
          <div style={{ flex: 1 }}/>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 20, padding: '4px 12px 4px 8px' }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981' }}/>
            <span style={{ fontSize: 11, color: '#60a5fa', fontFamily: "'Space Mono',monospace" }}>AI ACTIVE</span>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
          {roomMsgs.length === 0 && (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: '#2d3748' }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>⬡</div>
              <div style={{ fontFamily: "'Space Mono',monospace", fontSize: 13 }}>#{room?.name} — start collaborating</div>
              <div style={{ fontSize: 12, marginTop: 6 }}>Use <code style={{ color: '#3b82f6' }}>@ai</code> to talk to GenLayer AI</div>
            </div>
          )}
          {roomMsgs.map(m =>
            m.type === 'system' ? (
              <div key={m.id} style={{ textAlign: 'center', fontSize: 11, color: '#2d3748', padding: '4px 0', fontFamily: "'Space Mono',monospace" }}>{m.text}</div>
            ) : (
              <Message key={m.id} msg={m} />
            )
          )}
          {typingNow.length > 0 && <TypingDots names={typingNow} />}
          {isAITyping && (
            <div style={{ display: 'flex', gap: 10, padding: '6px 0', alignItems: 'flex-start' }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, flexShrink: 0, background: '#1e3a5f', border: '1.5px solid #3b82f633', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>⬡</div>
              <div style={{ paddingTop: 6 }}>
                <div style={{ display: 'flex', gap: 3 }}>
                  {[0,1,2].map(i => <div key={i} style={{ width: 5, height: 5, borderRadius: '50%', background: '#3b82f6', animation: `pulse 1.2s ease-in-out ${i*0.2}s infinite`, opacity: 0.7 }}/>)}
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef}/>
        </div>

        <div style={{ padding: '12px 20px 16px', background: '#0a0f1a', borderTop: '1px solid #1a2d4a', flexShrink: 0 }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', background: '#111827', border: '1px solid #1e2d45', borderRadius: 12, padding: '10px 14px' }}>
            <textarea
              value={input}
              onChange={handleTyping}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }}}
              placeholder={`Message #${room?.name} — use @ai to ask GenLayer AI…`}
              rows={1}
              style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: '#e2e8f0', fontSize: 14, resize: 'none', fontFamily: "'DM Sans',sans-serif", lineHeight: 1.5, maxHeight: 120, overflowY: 'auto', minHeight: 22 }}
              onInput={e => { e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'; }}
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || !connected}
              style={{ background: input.trim() && connected ? '#3b82f6' : '#1e2d45', border: 'none', borderRadius: 8, cursor: input.trim() && connected ? 'pointer' : 'default', width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 15, flexShrink: 0 }}
            >↑</button>
          </div>
          <div style={{ marginTop: 8, fontSize: 11, color: '#2d3748', textAlign: 'center', fontFamily: "'Space Mono',monospace" }}>
            Enter to send · Shift+Enter for new line · @ai to ask GenLayer AI
          </div>
        </div>
      </div>
    </div>
  );
}
