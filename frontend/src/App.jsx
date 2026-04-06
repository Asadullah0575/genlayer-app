import { useState, useRef, useEffect, useCallback } from 'react';
import { io } from 'socket.io-client';

const BACKEND_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:4000';

const PUBLIC_ROOMS = [
  { id: 'general',  name: 'general',  desc: 'Open discussion',     color: '#3b82f6' },
  { id: 'research', name: 'research', desc: 'AI-assisted research', color: '#8b5cf6' },
  { id: 'design',   name: 'design',   desc: 'UI/UX collaboration',  color: '#ec4899' },
  { id: 'backend',  name: 'backend',  desc: 'API & infrastructure', color: '#10b981' },
  { id: 'deploy',   name: 'deploy',   desc: 'DevOps & CI/CD',       color: '#f59e0b' },
];

const COLORS = ['#3b82f6','#8b5cf6','#ec4899','#10b981','#f59e0b','#ef4444','#06b6d4'];
function stringToColor(str = '') {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return COLORS[Math.abs(hash) % COLORS.length];
}
function shortAddress(addr) { return addr ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : ''; }

let socketInstance = null;
function getSocket(token) {
  if (!socketInstance) socketInstance = io(BACKEND_URL, { autoConnect: false, auth: { token } });
  return socketInstance;
}

function Avatar({ name, size = 32 }) {
  const color = stringToColor(name);
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: color + '22', border: `1.5px solid ${color}55`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.35, fontWeight: 600, color, flexShrink: 0, fontFamily: "'Space Mono',monospace" }}>
      {name?.slice(0, 2).toUpperCase()}
    </div>
  );
}

function Message({ msg }) {
  const isAI = msg.type === 'ai';
  const ts = new Date(msg.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return (
    <div style={{ display: 'flex', gap: 10, padding: '6px 0', animation: 'fadeIn 0.2s ease' }}>
      {isAI ? <div style={{ width: 32, height: 32, borderRadius: 8, flexShrink: 0, background: '#1e3a5f', border: '1.5px solid #3b82f633', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>⬡</div> : <Avatar name={msg.username} size={32} />}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 3 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: isAI ? '#3b82f6' : stringToColor(msg.username), fontFamily: isAI ? "'Space Mono',monospace" : 'inherit' }}>{isAI ? 'GenLayer AI' : msg.username}</span>
          {msg.address && !isAI && <span style={{ fontSize: 10, color: '#2d3748', fontFamily: "'Space Mono',monospace" }}>{shortAddress(msg.address)}</span>}
          <span style={{ fontSize: 11, color: '#4a5568', fontFamily: "'Space Mono',monospace" }}>{ts}</span>
        </div>
        <div style={{ fontSize: 14, color: '#cbd5e1', lineHeight: 1.6, background: isAI ? 'rgba(59,130,246,0.06)' : 'transparent', border: isAI ? '1px solid rgba(59,130,246,0.12)' : 'none', borderRadius: isAI ? 10 : 0, padding: isAI ? '10px 14px' : 0, whiteSpace: 'pre-wrap' }}>{msg.text}</div>
      </div>
    </div>
  );
}

// ─── Create Room Modal ────────────────────────────────────────────────────────
function CreateRoomModal({ onClose, onCreated, token }) {
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCreate = async () => {
    if (!name.trim()) return;
    setLoading(true); setError('');
    try {
      const res = await fetch(`${BACKEND_URL}/rooms/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: name.trim(), description: desc.trim() }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      onCreated(data.room);
    } catch (err) { setError(err.message); }
    setLoading(false);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
      <div style={{ background: '#0d1420', border: '1px solid #1a2d4a', borderRadius: 16, padding: '28px 32px', width: 360 }}>
        <h2 style={{ fontFamily: "'Space Mono',monospace", fontSize: 14, color: '#e2e8f0', marginBottom: 20, letterSpacing: '0.05em' }}>CREATE PRIVATE ROOM</h2>
        {error && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '8px 12px', marginBottom: 14, fontSize: 12, color: '#fca5a5' }}>{error}</div>}
        <input type="text" placeholder="Room name…" value={name} onChange={e => setName(e.target.value)} style={{ width: '100%', padding: '10px 14px', borderRadius: 8, background: '#111827', border: '1px solid #1e2d45', color: '#e2e8f0', fontSize: 14, outline: 'none', marginBottom: 10 }} autoFocus />
        <input type="text" placeholder="Description (optional)…" value={desc} onChange={e => setDesc(e.target.value)} style={{ width: '100%', padding: '10px 14px', borderRadius: 8, background: '#111827', border: '1px solid #1e2d45', color: '#e2e8f0', fontSize: 14, outline: 'none', marginBottom: 16 }} />
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '10px', borderRadius: 8, background: 'transparent', border: '1px solid #1e2d45', color: '#64748b', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
          <button onClick={handleCreate} disabled={!name.trim() || loading} style={{ flex: 1, padding: '10px', borderRadius: 8, background: name.trim() ? '#3b82f6' : '#1e2d45', border: 'none', color: '#fff', fontSize: 13, cursor: name.trim() ? 'pointer' : 'default', fontFamily: "'Space Mono',monospace" }}>{loading ? 'CREATING…' : 'CREATE →'}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Invite Link Modal ────────────────────────────────────────────────────────
function InviteLinkModal({ room, onClose }) {
  const link = `${window.location.origin}/join/${room.inviteCode}`;
  const [copied, setCopied] = useState(false);
  const copy = () => { navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
      <div style={{ background: '#0d1420', border: '1px solid #1a2d4a', borderRadius: 16, padding: '28px 32px', width: 400 }}>
        <h2 style={{ fontFamily: "'Space Mono',monospace", fontSize: 14, color: '#e2e8f0', marginBottom: 6, letterSpacing: '0.05em' }}>INVITE LINK</h2>
        <p style={{ fontSize: 12, color: '#4a5568', marginBottom: 16 }}>Share this link — you'll approve each request</p>
        <div style={{ background: '#111827', border: '1px solid #1e2d45', borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 12, color: '#60a5fa', fontFamily: "'Space Mono',monospace", wordBreak: 'break-all' }}>{link}</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '10px', borderRadius: 8, background: 'transparent', border: '1px solid #1e2d45', color: '#64748b', fontSize: 13, cursor: 'pointer' }}>Close</button>
          <button onClick={copy} style={{ flex: 1, padding: '10px', borderRadius: 8, background: copied ? '#10b981' : '#3b82f6', border: 'none', color: '#fff', fontSize: 13, cursor: 'pointer', fontFamily: "'Space Mono',monospace" }}>{copied ? 'COPIED! ✓' : 'COPY LINK'}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Pending Requests Modal ───────────────────────────────────────────────────
function PendingRequestsModal({ room, token, onClose, onUpdate }) {
  const [loading, setLoading] = useState({});

  const respond = async (address, action) => {
    setLoading(prev => ({ ...prev, [address]: true }));
    try {
      await fetch(`${BACKEND_URL}/rooms/${room.id}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ requesterAddress: address, action }),
      });
      onUpdate();
    } catch (err) { console.error(err); }
    setLoading(prev => ({ ...prev, [address]: false }));
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
      <div style={{ background: '#0d1420', border: '1px solid #1a2d4a', borderRadius: 16, padding: '28px 32px', width: 400, maxHeight: '80vh', overflowY: 'auto' }}>
        <h2 style={{ fontFamily: "'Space Mono',monospace", fontSize: 14, color: '#e2e8f0', marginBottom: 20, letterSpacing: '0.05em' }}>JOIN REQUESTS — #{room.name}</h2>
        {room.pendingRequests?.length === 0 ? (
          <p style={{ fontSize: 13, color: '#4a5568', textAlign: 'center', padding: '20px 0' }}>No pending requests</p>
        ) : (
          room.pendingRequests?.map(r => (
            <div key={r.address} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid #1a2d4a' }}>
              <Avatar name={r.username} size={36} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, color: '#e2e8f0', fontWeight: 500 }}>{r.username}</div>
                <div style={{ fontSize: 11, color: '#4a5568', fontFamily: "'Space Mono',monospace" }}>{shortAddress(r.address)}</div>
              </div>
              <button onClick={() => respond(r.address, 'approve')} disabled={loading[r.address]} style={{ padding: '6px 12px', borderRadius: 6, background: '#10b981', border: 'none', color: '#fff', fontSize: 12, cursor: 'pointer' }}>✓ Approve</button>
              <button onClick={() => respond(r.address, 'reject')} disabled={loading[r.address]} style={{ padding: '6px 12px', borderRadius: 6, background: 'transparent', border: '1px solid #ef4444', color: '#ef4444', fontSize: 12, cursor: 'pointer' }}>✗ Reject</button>
            </div>
          ))
        )}
        <button onClick={onClose} style={{ width: '100%', marginTop: 16, padding: '10px', borderRadius: 8, background: 'transparent', border: '1px solid #1e2d45', color: '#64748b', fontSize: 13, cursor: 'pointer' }}>Close</button>
      </div>
    </div>
  );
}

// ─── Join Room Page ───────────────────────────────────────────────────────────
function JoinRoomPage({ inviteCode, auth, onJoined }) {
  const [roomInfo, setRoomInfo] = useState(null);
  const [status, setStatus] = useState('loading'); // loading | ready | pending | error
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`${BACKEND_URL}/rooms/invite/${inviteCode}`)
      .then(r => r.json())
      .then(data => { if (data.error) { setError(data.error); setStatus('error'); } else { setRoomInfo(data); setStatus('ready'); } })
      .catch(() => { setError('Failed to load room'); setStatus('error'); });
  }, [inviteCode]);

  const requestJoin = async () => {
    setStatus('loading');
    try {
      const res = await fetch(`${BACKEND_URL}/rooms/request/${inviteCode}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${auth.token}` },
      });
      const data = await res.json();
      if (data.status === 'already_member') onJoined(`private:${roomInfo.id}`);
      else setStatus('pending');
    } catch { setError('Failed to send request'); setStatus('error'); }
  };

  return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#080c14' }}>
      <div style={{ background: '#0d1420', border: '1px solid #1a2d4a', borderRadius: 16, padding: '40px 48px', width: 380, textAlign: 'center', fontFamily: "'DM Sans',sans-serif" }}>
        <div style={{ fontSize: 36, marginBottom: 16 }}>🔒</div>
        {status === 'loading' && <p style={{ color: '#4a5568' }}>Loading room…</p>}
        {status === 'error' && <p style={{ color: '#ef4444' }}>{error}</p>}
        {status === 'pending' && (
          <>
            <h2 style={{ color: '#e2e8f0', fontSize: 16, marginBottom: 8 }}>Request Sent!</h2>
            <p style={{ color: '#4a5568', fontSize: 13 }}>Waiting for the room creator to approve your request. You'll be notified when approved.</p>
          </>
        )}
        {status === 'ready' && roomInfo && (
          <>
            <h2 style={{ color: '#e2e8f0', fontSize: 18, marginBottom: 6 }}>#{roomInfo.name}</h2>
            {roomInfo.description && <p style={{ color: '#4a5568', fontSize: 13, marginBottom: 4 }}>{roomInfo.description}</p>}
            <p style={{ color: '#2d3748', fontSize: 12, marginBottom: 24 }}>Created by {roomInfo.creatorUsername} · {roomInfo.memberCount} members</p>
            <button onClick={requestJoin} style={{ width: '100%', padding: '12px', borderRadius: 8, background: '#3b82f6', border: 'none', color: '#fff', fontSize: 14, cursor: 'pointer', fontFamily: "'Space Mono',monospace" }}>REQUEST TO JOIN →</button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── WalletLogin with EIP-6963 multi-wallet support ──────────────────────────
// Replace your existing WalletLogin function in App.jsx with this one

function WalletLogin({ onAuth }) {
  const [step, setStep] = useState('connect');
  const [wallets, setWallets] = useState([]);
  const [selectedProvider, setSelectedProvider] = useState(null);
  const [address, setAddress] = useState('');
  const [username, setUsername] = useState('');
  const [nonce, setNonce] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // EIP-6963: Listen for wallet announcements
  useEffect(() => {
    const detected = new Map();

    const handleAnnounce = (event) => {
      const { info, provider } = event.detail;
      if (!detected.has(info.uuid)) {
        detected.set(info.uuid, { info, provider });
        setWallets([...detected.values()]);
      }
    };

    window.addEventListener('eip6963:announceProvider', handleAnnounce);
    // Request all wallets to announce themselves
    window.dispatchEvent(new Event('eip6963:requestProvider'));

    // Fallback: if no EIP-6963 wallets found after 500ms, check window.ethereum
    const fallbackTimer = setTimeout(() => {
      if (detected.size === 0 && window.ethereum) {
        const fallback = {
          info: { uuid: 'legacy', name: window.ethereum.isMetaMask ? 'MetaMask' : 'Browser Wallet', icon: null },
          provider: window.ethereum,
        };
        detected.set('legacy', fallback);
        setWallets([...detected.values()]);
      }
    }, 500);

    return () => {
      window.removeEventListener('eip6963:announceProvider', handleAnnounce);
      clearTimeout(fallbackTimer);
    };
  }, []);

  const connectWallet = async (wallet) => {
    setError('');
    setLoading(true);
    setSelectedProvider(wallet.provider);

    try {
      const accounts = await wallet.provider.request({ method: 'eth_requestAccounts' });
      const addr = accounts[0];
      setAddress(addr);

      const res = await fetch(`${BACKEND_URL}/auth/nonce/${addr}`);
      const data = await res.json();
      setNonce(data.nonce);

      if (data.isNew) {
        setStep('username');
      } else {
        setUsername(data.username);
        setStep('signing');
        await signAndVerify(wallet.provider, addr, data.nonce, data.username);
      }
    } catch (err) {
      setError(err.message || 'Failed to connect wallet');
      setStep('connect');
    }
    setLoading(false);
  };

  const signAndVerify = async (provider, addr, nonceVal, user) => {
    setLoading(true);
    setStep('signing');
    try {
      const message = `Welcome to GenLayer!\n\nSign this message to verify your wallet.\n\nNonce: ${nonceVal}`;
      const signature = await provider.request({
        method: 'personal_sign',
        params: [message, addr],
      });

      const res = await fetch(`${BACKEND_URL}/auth/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: addr, signature, nonce: nonceVal, username: user }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      localStorage.setItem('gl_token', data.token);
      localStorage.setItem('gl_username', data.username);
      localStorage.setItem('gl_address', data.address);
      onAuth({ token: data.token, username: data.username, address: data.address });
    } catch (err) {
      setError(err.message || 'Signing failed');
      setStep('connect');
    }
    setLoading(false);
  };

  const handleUsernameSubmit = () => {
    if (!username.trim() || !selectedProvider) return;
    signAndVerify(selectedProvider, address, nonce, username.trim());
  };

  // Wallet icon — use provided icon or fallback initial
  const WalletIcon = ({ wallet, size = 36 }) => (
    wallet.info.icon ? (
      <img src={wallet.info.icon} alt={wallet.info.name} style={{ width: size, height: size, borderRadius: 8, flexShrink: 0 }} />
    ) : (
      <div style={{ width: size, height: size, borderRadius: 8, background: '#1e2d45', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.4, flexShrink: 0 }}>
        {wallet.info.name[0]}
      </div>
    )
  );

  return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#080c14' }}>
      <div style={{ background: '#0d1420', border: '1px solid #1a2d4a', borderRadius: 16, padding: '36px 40px', width: 400, fontFamily: "'DM Sans',sans-serif" }}>
        
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>⬡</div>
          <h1 style={{ fontFamily: "'Space Mono',monospace", fontSize: 18, color: '#e2e8f0', marginBottom: 4 }}>GENLAYER</h1>
          <p style={{ fontSize: 13, color: '#4a5568' }}>Multi-room AI collaboration</p>
        </div>

        {/* Error */}
        {error && (
          <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#fca5a5' }}>
            {error}
          </div>
        )}

        {/* Step: Connect — show wallet list */}
        {step === 'connect' && (
          <>
            <p style={{ fontSize: 13, color: '#4a5568', marginBottom: 14, textAlign: 'center' }}>
              {wallets.length === 0 ? 'Scanning for wallets…' : `${wallets.length} wallet${wallets.length > 1 ? 's' : ''} detected — choose one`}
            </p>

            {/* Wallet buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
              {wallets.length === 0 && (
                <div style={{ textAlign: 'center', padding: '24px 0', color: '#2d3748' }}>
                  <div style={{ fontSize: 11, fontFamily: "'Space Mono',monospace", marginBottom: 12 }}>NO WALLETS FOUND</div>
                  <a href="https://metamask.io" target="_blank" rel="noreferrer" style={{ fontSize: 13, color: '#3b82f6' }}>Install MetaMask</a>
                  <span style={{ color: '#2d3748', fontSize: 13 }}> or </span>
                  <a href="https://rainbow.me" target="_blank" rel="noreferrer" style={{ fontSize: 13, color: '#8b5cf6' }}>Rainbow</a>
                  <span style={{ color: '#2d3748', fontSize: 13 }}> or </span>
                  <a href="https://www.coinbase.com/wallet" target="_blank" rel="noreferrer" style={{ fontSize: 13, color: '#3b82f6' }}>Coinbase Wallet</a>
                </div>
              )}
              {wallets.map(wallet => (
                <button
                  key={wallet.info.uuid}
                  onClick={() => connectWallet(wallet)}
                  disabled={loading}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '12px 16px', borderRadius: 10,
                    background: '#111827', border: '1px solid #1e2d45',
                    color: '#e2e8f0', cursor: loading ? 'default' : 'pointer',
                    transition: 'border-color 0.15s',
                    width: '100%', textAlign: 'left',
                  }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = '#3b82f6'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = '#1e2d45'}
                >
                  <WalletIcon wallet={wallet} size={36} />
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 500 }}>{wallet.info.name}</div>
                    <div style={{ fontSize: 11, color: '#4a5568', fontFamily: "'Space Mono',monospace" }}>Click to connect</div>
                  </div>
                  <div style={{ marginLeft: 'auto', fontSize: 16, color: '#4a5568' }}>→</div>
                </button>
              ))}
            </div>

            <p style={{ fontSize: 11, color: '#2d3748', textAlign: 'center' }}>
              Your wallet is used to verify identity — no password needed
            </p>
          </>
        )}

        {/* Step: Username (new user) */}
        {step === 'username' && (
          <>
            <div style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 12, color: '#6ee7b7', fontFamily: "'Space Mono',monospace", textAlign: 'center' }}>
              {shortAddress(address)}
            </div>
            <p style={{ fontSize: 13, color: '#64748b', marginBottom: 16, textAlign: 'center' }}>New wallet detected — choose a username</p>
            <input
              type="text"
              placeholder="Enter username…"
              value={username}
              onChange={e => setUsername(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleUsernameSubmit()}
              style={{ width: '100%', padding: '10px 14px', borderRadius: 8, background: '#111827', border: '1px solid #1e2d45', color: '#e2e8f0', fontSize: 14, outline: 'none', marginBottom: 12 }}
              autoFocus
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setStep('connect')} style={{ flex: 1, padding: '10px', borderRadius: 8, background: 'transparent', border: '1px solid #1e2d45', color: '#64748b', fontSize: 13, cursor: 'pointer' }}>← Back</button>
              <button
                onClick={handleUsernameSubmit}
                disabled={!username.trim() || loading}
                style={{ flex: 2, padding: '11px', borderRadius: 8, background: username.trim() && !loading ? '#3b82f6' : '#1e2d45', border: 'none', color: '#fff', fontSize: 13, cursor: username.trim() ? 'pointer' : 'default', fontFamily: "'Space Mono',monospace" }}
              >
                {loading ? 'SIGNING…' : 'CONTINUE →'}
              </button>
            </div>
          </>
        )}

        {/* Step: Signing */}
        {step === 'signing' && (
          <div style={{ textAlign: 'center', padding: '20px 0', color: '#64748b', fontSize: 13 }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>✍️</div>
            <p>Check your wallet and sign the message to continue…</p>
            <p style={{ fontSize: 11, color: '#2d3748', marginTop: 8, fontFamily: "'Space Mono',monospace" }}>This proves you own the wallet — no fees involved</p>
          </div>
        )}
      </div>
    </div>
  );
}


// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [auth, setAuth] = useState(() => {
    const token = localStorage.getItem('gl_token');
    const username = localStorage.getItem('gl_username');
    const address = localStorage.getItem('gl_address');
    return token && username ? { token, username, address } : null;
  });

  // Check for invite link
  const inviteCode = window.location.pathname.startsWith('/join/') ? window.location.pathname.split('/join/')[1] : null;

  const [activeRoom, setActiveRoom] = useState('general');
  const [messages, setMessages] = useState({});
  const [roomUsers, setRoomUsers] = useState({});
  const [typingUsers, setTypingUsers] = useState({});
  const [aiTyping, setAiTyping] = useState({});
  const [input, setInput] = useState('');
  const [connected, setConnected] = useState(false);
  const [unread, setUnread] = useState({});
  const [privateRooms, setPrivateRooms] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(null);
  const [showRequestsModal, setShowRequestsModal] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const messagesEndRef = useRef(null);
  const typingTimeout = useRef(null);
  const socketRef = useRef(null);
  const activeRoomRef = useRef(activeRoom);

  useEffect(() => { activeRoomRef.current = activeRoom; }, [activeRoom]);
  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  useEffect(scrollToBottom, [messages, activeRoom, aiTyping]);
  useEffect(() => { setUnread(prev => ({ ...prev, [activeRoom]: 0 })); }, [activeRoom]);

  const fetchMyRooms = useCallback(async () => {
    if (!auth) return;
    try {
      const res = await fetch(`${BACKEND_URL}/rooms/my`, { headers: { Authorization: `Bearer ${auth.token}` } });
      const data = await res.json();
      if (Array.isArray(data)) setPrivateRooms(data);
    } catch {}
  }, [auth]);

  useEffect(() => { fetchMyRooms(); }, [fetchMyRooms]);

  useEffect(() => {
    if (!auth) return;
    const s = getSocket(auth.token);
    socketRef.current = s;
    s.connect();
    s.on('connect', () => { setConnected(true); s.emit('join_room', { room: 'general' }); });
    s.on('disconnect', () => setConnected(false));
    s.on('room_history', ({ room, messages: msgs }) => setMessages(prev => ({ ...prev, [room]: msgs })));
    s.on('new_message', ({ room, message }) => {
      setMessages(prev => ({ ...prev, [room]: [...(prev[room] || []), message] }));
      setUnread(prev => ({ ...prev, [room]: room === activeRoomRef.current ? 0 : (prev[room] || 0) + 1 }));
    });
    s.on('room_users', ({ room, users }) => setRoomUsers(prev => ({ ...prev, [room]: users })));
    s.on('user_typing', ({ username, isTyping }) => {
      setTypingUsers(prev => { const cur = new Set(prev[activeRoomRef.current] || []); isTyping ? cur.add(username) : cur.delete(username); return { ...prev, [activeRoomRef.current]: [...cur] }; });
    });
    s.on('ai_typing', ({ room, typing }) => setAiTyping(prev => ({ ...prev, [room]: typing })));
    s.on('user_joined', ({ username, room }) => {
      if (username !== auth.username) setMessages(prev => ({ ...prev, [room]: [...(prev[room] || []), { _id: Date.now(), type: 'system', text: `${username} joined`, ts: new Date() }] }));
    });
    s.on('user_left', ({ username, room }) => setMessages(prev => ({ ...prev, [room]: [...(prev[room] || []), { _id: Date.now() + 1, type: 'system', text: `${username} left`, ts: new Date() }] })));
    s.on('join_request', ({ roomId, roomName, requester }) => {
      setNotifications(prev => [...prev, { id: Date.now(), type: 'request', roomId, roomName, requester }]);
      fetchMyRooms();
    });
    s.on('join_approved', ({ roomId, roomName, inviteCode }) => {
      setNotifications(prev => [...prev, { id: Date.now(), type: 'approved', roomName }]);
      fetchMyRooms();
      setTimeout(() => { switchRoom(`private:${roomId}`); }, 500);
    });
    s.on('join_rejected', ({ roomName }) => setNotifications(prev => [...prev, { id: Date.now(), type: 'rejected', roomName }]));
    s.on('room_deleted', ({ roomName }) => { fetchMyRooms(); if (activeRoomRef.current.startsWith('private:')) setActiveRoom('general'); });
    return () => { s.disconnect(); socketInstance = null; };
  }, [auth]);

  const switchRoom = (room) => {
    if (room === activeRoom) return;
    setActiveRoom(room);
    socketRef.current?.emit('join_room', { room });
  };

  const sendMessage = () => {
    const text = input.trim();
    if (!text || !connected) return;
    socketRef.current.emit('send_message', { room: activeRoom, text });
    socketRef.current.emit('typing', { room: activeRoom, isTyping: false });
    setInput('');
  };

  const handleTyping = (e) => {
    setInput(e.target.value);
    socketRef.current?.emit('typing', { room: activeRoom, isTyping: true });
    clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => socketRef.current?.emit('typing', { room: activeRoom, isTyping: false }), 1500);
  };

  const logout = () => {
    localStorage.removeItem('gl_token'); localStorage.removeItem('gl_username'); localStorage.removeItem('gl_address');
    socketInstance?.disconnect(); socketInstance = null; setAuth(null);
  };

  const deleteRoom = async (roomId) => {
    if (!confirm('Delete this room? This cannot be undone.')) return;
    await fetch(`${BACKEND_URL}/rooms/${roomId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${auth.token}` } });
    fetchMyRooms();
    if (activeRoom === `private:${roomId}`) setActiveRoom('general');
  };

  if (!auth) return <WalletLogin onAuth={setAuth} />;
  if (inviteCode && auth) return <JoinRoomPage inviteCode={inviteCode} auth={auth} onJoined={(room) => { window.history.pushState({}, '', '/'); switchRoom(room); }} />;

  const activeRoomInfo = PUBLIC_ROOMS.find(r => r.id === activeRoom) || privateRooms.find(r => `private:${r.id}` === activeRoom);
  const roomMsgs = messages[activeRoom] || [];
  const typingNow = (typingUsers[activeRoom] || []).filter(u => u !== auth.username);
  const onlineUsers = roomUsers[activeRoom] || [];
  const isPrivateActive = activeRoom.startsWith('private:');
  const activePrivateRoom = isPrivateActive ? privateRooms.find(r => `private:${r.id}` === activeRoom) : null;

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#080c14', color: '#e2e8f0', fontFamily: "'DM Sans',sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=DM+Sans:wght@300;400;500&display=swap');*{box-sizing:border-box;margin:0;padding:0}::-webkit-scrollbar{width:4px}::-webkit-scrollbar-thumb{background:#1e2d45;border-radius:4px}@keyframes fadeIn{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:none}}@keyframes pulse{0%,80%,100%{transform:scale(0.6);opacity:0.4}40%{transform:scale(1);opacity:1}}`}</style>

      {/* Notifications */}
      <div style={{ position: 'fixed', top: 16, right: 16, zIndex: 200, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {notifications.slice(-3).map(n => (
          <div key={n.id} style={{ background: '#0d1420', border: `1px solid ${n.type === 'approved' ? '#10b981' : n.type === 'rejected' ? '#ef4444' : '#3b82f6'}33`, borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#e2e8f0', minWidth: 260, animation: 'fadeIn 0.2s ease' }}>
            {n.type === 'request' && <span>🔔 <b>{n.requester.username}</b> wants to join <b>#{n.roomName}</b></span>}
            {n.type === 'approved' && <span>✅ Approved to join <b>#{n.roomName}</b></span>}
            {n.type === 'rejected' && <span>❌ Request to <b>#{n.roomName}</b> was rejected</span>}
            <button onClick={() => setNotifications(prev => prev.filter(x => x.id !== n.id))} style={{ float: 'right', background: 'none', border: 'none', color: '#4a5568', cursor: 'pointer', fontSize: 14 }}>×</button>
          </div>
        ))}
      </div>

      {/* Sidebar */}
      <div style={{ width: 230, background: '#0d1420', borderRight: '1px solid #1a2d4a', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <div style={{ padding: '18px 16px 12px', borderBottom: '1px solid #1a2d4a' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 28, height: 28, background: '#3b82f6', borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>⬡</div>
            <span style={{ fontFamily: "'Space Mono',monospace", fontWeight: 700, fontSize: 13, letterSpacing: '0.02em' }}>GENLAYER</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: connected ? '#10b981' : '#ef4444' }}/>
            <span style={{ fontSize: 11, color: '#4a5568', fontFamily: "'Space Mono',monospace" }}>{connected ? 'connected' : 'reconnecting…'}</span>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 8px' }}>
          {/* Public Rooms */}
          <div style={{ fontSize: 10, color: '#4a5568', fontFamily: "'Space Mono',monospace", padding: '0 8px 8px', letterSpacing: '0.1em' }}>PUBLIC ROOMS</div>
          {PUBLIC_ROOMS.map(r => (
            <button key={r.id} onClick={() => switchRoom(r.id)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 8, border: 'none', cursor: 'pointer', background: activeRoom === r.id ? 'rgba(59,130,246,0.12)' : 'transparent', color: activeRoom === r.id ? '#60a5fa' : '#64748b', marginBottom: 1, textAlign: 'left' }}>
              <span style={{ fontSize: 10, color: activeRoom === r.id ? r.color : '#334155' }}>⬡</span>
              <span style={{ fontSize: 13, fontWeight: activeRoom === r.id ? 500 : 400, flex: 1 }}>{r.name}</span>
              {unread[r.id] > 0 && <span style={{ fontSize: 10, background: r.color, color: '#fff', borderRadius: 10, padding: '1px 6px', fontFamily: "'Space Mono',monospace" }}>{unread[r.id]}</span>}
            </button>
          ))}

          {/* Private Rooms */}
          <div style={{ fontSize: 10, color: '#4a5568', fontFamily: "'Space Mono',monospace", padding: '16px 8px 8px', letterSpacing: '0.1em', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>PRIVATE ROOMS</span>
            <button onClick={() => setShowCreateModal(true)} style={{ background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer', fontSize: 16, lineHeight: 1 }} title="Create private room">+</button>
          </div>
          {privateRooms.length === 0 && <div style={{ fontSize: 12, color: '#2d3748', padding: '4px 10px' }}>No private rooms yet</div>}
          {privateRooms.map(r => {
            const roomKey = `private:${r.id}`;
            const isActive = activeRoom === roomKey;
            return (
              <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 1 }}>
                <button onClick={() => switchRoom(roomKey)} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 8, border: 'none', cursor: 'pointer', background: isActive ? 'rgba(139,92,246,0.12)' : 'transparent', color: isActive ? '#a78bfa' : '#64748b', textAlign: 'left' }}>
                  <span style={{ fontSize: 10 }}>🔒</span>
                  <span style={{ fontSize: 13, fontWeight: isActive ? 500 : 400, flex: 1 }}>{r.name}</span>
                  {r.pendingCount > 0 && <span style={{ fontSize: 10, background: '#f59e0b', color: '#fff', borderRadius: 10, padding: '1px 6px', fontFamily: "'Space Mono',monospace" }}>{r.pendingCount}</span>}
                  {unread[roomKey] > 0 && <span style={{ fontSize: 10, background: '#8b5cf6', color: '#fff', borderRadius: 10, padding: '1px 6px', fontFamily: "'Space Mono',monospace" }}>{unread[roomKey]}</span>}
                </button>
                {r.isCreator && (
                  <div style={{ display: 'flex', gap: 2 }}>
                    <button onClick={() => setShowInviteModal(r)} title="Get invite link" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#4a5568', fontSize: 12, padding: '4px' }}>🔗</button>
                    {r.pendingCount > 0 && <button onClick={() => setShowRequestsModal(r)} title="View requests" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#f59e0b', fontSize: 12, padding: '4px' }}>👥</button>}
                    <button onClick={() => deleteRoom(r.id)} title="Delete room" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#4a5568', fontSize: 12, padding: '4px' }}>🗑</button>
                  </div>
                )}
              </div>
            );
          })}

          {/* Online users */}
          {onlineUsers.length > 0 && (
            <>
              <div style={{ fontSize: 10, color: '#4a5568', fontFamily: "'Space Mono',monospace", padding: '16px 8px 8px', letterSpacing: '0.1em' }}>ONLINE</div>
              {onlineUsers.map(u => (
                <div key={u.address || u.username} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 10px' }}>
                  <div style={{ position: 'relative' }}>
                    <Avatar name={u.username} size={22} />
                    <div style={{ position: 'absolute', bottom: -1, right: -1, width: 6, height: 6, borderRadius: '50%', background: '#10b981', border: '1.5px solid #0d1420' }}/>
                  </div>
                  <span style={{ fontSize: 12, color: u.username === auth.username ? '#e2e8f0' : '#64748b' }}>{u.username}{u.username === auth.username ? ' (you)' : ''}</span>
                </div>
              ))}
            </>
          )}
        </div>

        <div style={{ padding: '10px 12px', borderTop: '1px solid #1a2d4a', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Avatar name={auth.username} size={28} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{auth.username}</div>
            <div style={{ fontSize: 10, color: '#2d3748', fontFamily: "'Space Mono',monospace" }}>{shortAddress(auth.address)}</div>
          </div>
          <button onClick={logout} title="Logout" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#4a5568', fontSize: 14, padding: 4 }}>⏻</button>
        </div>
      </div>

      {/* Main chat */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0 20px', height: 56, borderBottom: '1px solid #1a2d4a', background: '#0a0f1a', flexShrink: 0 }}>
          <span style={{ fontSize: 14 }}>{isPrivateActive ? '🔒' : '⬡'}</span>
          <span style={{ fontFamily: "'Space Mono',monospace", fontSize: 13, fontWeight: 700 }}>#{activeRoomInfo?.name || 'unknown'}</span>
          <span style={{ fontSize: 12, color: '#4a5568' }}>{activeRoomInfo?.desc || activeRoomInfo?.description || ''}</span>
          <div style={{ flex: 1 }}/>
          {isPrivateActive && activePrivateRoom?.isCreator && (
            <>
              <button onClick={() => setShowInviteModal(activePrivateRoom)} style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 20, padding: '4px 12px', fontSize: 11, color: '#60a5fa', cursor: 'pointer', fontFamily: "'Space Mono',monospace" }}>🔗 INVITE</button>
              {activePrivateRoom?.pendingCount > 0 && <button onClick={() => setShowRequestsModal(activePrivateRoom)} style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 20, padding: '4px 12px', fontSize: 11, color: '#fbbf24', cursor: 'pointer', fontFamily: "'Space Mono',monospace" }}>👥 {activePrivateRoom.pendingCount} PENDING</button>}
            </>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 20, padding: '4px 12px 4px 8px' }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981' }}/>
            <span style={{ fontSize: 11, color: '#60a5fa', fontFamily: "'Space Mono',monospace" }}>AI ACTIVE</span>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
          {roomMsgs.length === 0 && (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: '#2d3748' }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>{isPrivateActive ? '🔒' : '⬡'}</div>
              <div style={{ fontFamily: "'Space Mono',monospace", fontSize: 13 }}>#{activeRoomInfo?.name} — start collaborating</div>
              <div style={{ fontSize: 12, marginTop: 6 }}>Use <code style={{ color: '#3b82f6' }}>@ai</code> to ask GenLayer AI</div>
            </div>
          )}
          {roomMsgs.map(m => m.type === 'system' ? (
            <div key={m._id} style={{ textAlign: 'center', fontSize: 11, color: '#2d3748', padding: '4px 0', fontFamily: "'Space Mono',monospace" }}>{m.text}</div>
          ) : <Message key={m._id} msg={m} />)}
          {typingNow.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', fontSize: 12, color: '#4a5568' }}>
              <div style={{ display: 'flex', gap: 3 }}>{[0,1,2].map(i => <div key={i} style={{ width: 5, height: 5, borderRadius: '50%', background: '#3b82f6', animation: `pulse 1.2s ease-in-out ${i*0.2}s infinite`, opacity: 0.7 }}/>)}</div>
              <span>{typingNow.join(', ')} {typingNow.length === 1 ? 'is' : 'are'} typing…</span>
            </div>
          )}
          {aiTyping[activeRoom] && (
            <div style={{ display: 'flex', gap: 10, padding: '6px 0', alignItems: 'flex-start' }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, flexShrink: 0, background: '#1e3a5f', border: '1.5px solid #3b82f633', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>⬡</div>
              <div style={{ paddingTop: 8, display: 'flex', gap: 3 }}>{[0,1,2].map(i => <div key={i} style={{ width: 5, height: 5, borderRadius: '50%', background: '#3b82f6', animation: `pulse 1.2s ease-in-out ${i*0.2}s infinite`, opacity: 0.7 }}/>)}</div>
            </div>
          )}
          <div ref={messagesEndRef}/>
        </div>

        <div style={{ padding: '12px 20px 16px', background: '#0a0f1a', borderTop: '1px solid #1a2d4a', flexShrink: 0 }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', background: '#111827', border: '1px solid #1e2d45', borderRadius: 12, padding: '10px 14px' }}>
            <textarea value={input} onChange={handleTyping} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }}} placeholder={`Message #${activeRoomInfo?.name}…`} rows={1} style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: '#e2e8f0', fontSize: 14, resize: 'none', fontFamily: "'DM Sans',sans-serif", lineHeight: 1.5, maxHeight: 120, overflowY: 'auto', minHeight: 22 }} onInput={e => { e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'; }} />
            <button onClick={sendMessage} disabled={!input.trim() || !connected} style={{ background: input.trim() && connected ? '#3b82f6' : '#1e2d45', border: 'none', borderRadius: 8, cursor: input.trim() && connected ? 'pointer' : 'default', width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 15, flexShrink: 0 }}>↑</button>
          </div>
          <div style={{ marginTop: 8, fontSize: 11, color: '#2d3748', textAlign: 'center', fontFamily: "'Space Mono',monospace" }}>Enter to send · @ai for AI · private rooms are invite-only</div>
        </div>
      </div>

      {showCreateModal && <CreateRoomModal token={auth.token} onClose={() => setShowCreateModal(false)} onCreated={room => { setShowCreateModal(false); fetchMyRooms(); setTimeout(() => switchRoom(`private:${room._id}`), 300); }} />}
      {showInviteModal && <InviteLinkModal room={showInviteModal} onClose={() => setShowInviteModal(null)} />}
      {showRequestsModal && <PendingRequestsModal room={showRequestsModal} token={auth.token} onClose={() => setShowRequestsModal(null)} onUpdate={() => { fetchMyRooms(); setShowRequestsModal(null); }} />}
    </div>
  );
}