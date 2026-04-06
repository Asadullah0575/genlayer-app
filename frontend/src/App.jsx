import { useState, useRef, useEffect, useCallback } from 'react';
import { io } from 'socket.io-client';

const BACKEND_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:4000';
const APP_NAME = 'GenLayer Chat-Box';

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

// ─── Push Notifications ───────────────────────────────────────────────────────
async function setupPushNotifications(token) {
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    const reg = await navigator.serviceWorker.register('/sw.js');
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return;
    const res = await fetch(`${BACKEND_URL}/push/vapid-public-key`);
    const { key } = await res.json();
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: key,
    });
    await fetch(`${BACKEND_URL}/push/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(sub),
    });
  } catch (err) { console.log('Push setup failed:', err.message); }
}

// ─── Avatar ───────────────────────────────────────────────────────────────────
function Avatar({ name, size = 32 }) {
  const color = stringToColor(name);
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: color + '22', border: `1.5px solid ${color}55`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.35, fontWeight: 600, color, flexShrink: 0, fontFamily: "'Space Mono',monospace" }}>
      {name?.slice(0, 2).toUpperCase()}
    </div>
  );
}

// ─── File Preview ─────────────────────────────────────────────────────────────
function FilePreview({ url, name, type }) {
  if (!url) return null;
  const isImage = type?.startsWith('image/');
  return isImage ? (
    <a href={url} target="_blank" rel="noreferrer">
      <img src={url} alt={name} style={{ maxWidth: '100%', maxHeight: 240, borderRadius: 8, marginTop: 6, display: 'block', border: '1px solid #1e2d45' }} />
    </a>
  ) : (
    <a href={url} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginTop: 6, padding: '8px 12px', background: '#111827', border: '1px solid #1e2d45', borderRadius: 8, color: '#60a5fa', fontSize: 13, textDecoration: 'none' }}>
      📎 {name}
    </a>
  );
}

// ─── Message ──────────────────────────────────────────────────────────────────
function Message({ msg, currentAddress, onDelete }) {
  const [showDelete, setShowDelete] = useState(false);
  const isAI = msg.type === 'ai';
  const isOwn = msg.address === currentAddress;
  const isDeleted = msg.deleted;
  const ts = new Date(msg.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div onMouseEnter={() => setShowDelete(true)} onMouseLeave={() => setShowDelete(false)}
      style={{ display: 'flex', gap: 10, padding: '6px 0', animation: 'fadeIn 0.2s ease', position: 'relative' }}>
      {isAI ? (
        <div style={{ width: 32, height: 32, borderRadius: 8, flexShrink: 0, background: '#1e3a5f', border: '1.5px solid #3b82f633', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>⬡</div>
      ) : <Avatar name={msg.username} size={32} />}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 3 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: isAI ? '#3b82f6' : stringToColor(msg.username), fontFamily: isAI ? "'Space Mono',monospace" : 'inherit' }}>{isAI ? 'GenLayer AI' : msg.username}</span>
          {msg.address && !isAI && <span style={{ fontSize: 10, color: '#2d3748', fontFamily: "'Space Mono',monospace" }}>{shortAddress(msg.address)}</span>}
          <span style={{ fontSize: 11, color: '#4a5568', fontFamily: "'Space Mono',monospace" }}>{ts}</span>
        </div>
        {isDeleted ? (
          <div style={{ fontSize: 13, color: '#4a5568', fontStyle: 'italic' }}>This message was deleted</div>
        ) : (
          <>
            {msg.text && <div style={{ fontSize: 14, color: '#cbd5e1', lineHeight: 1.6, background: isAI ? 'rgba(59,130,246,0.06)' : 'transparent', border: isAI ? '1px solid rgba(59,130,246,0.12)' : 'none', borderRadius: isAI ? 10 : 0, padding: isAI ? '10px 14px' : 0, whiteSpace: 'pre-wrap' }}>{msg.text}</div>}
            {msg.fileUrl && <FilePreview url={msg.fileUrl} name={msg.fileName} type={msg.fileType} />}
          </>
        )}
      </div>
      {isOwn && !isDeleted && showDelete && (
        <button onClick={() => onDelete(msg._id)} style={{ position: 'absolute', right: 0, top: 6, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 6, padding: '3px 8px', fontSize: 11, color: '#ef4444', cursor: 'pointer' }}>🗑</button>
      )}
    </div>
  );
}

// ─── Modals ───────────────────────────────────────────────────────────────────
function CreateRoomModal({ onClose, onCreated, token }) {
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const handleCreate = async () => {
    if (!name.trim()) return;
    setLoading(true); setError('');
    try {
      const res = await fetch(`${BACKEND_URL}/rooms/create`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ name: name.trim(), description: desc.trim() }) });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      onCreated(data.room);
    } catch (err) { setError(err.message); }
    setLoading(false);
  };
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 }}>
      <div style={{ background: '#0d1420', border: '1px solid #1a2d4a', borderRadius: 16, padding: '28px 32px', width: '100%', maxWidth: 360 }}>
        <h2 style={{ fontFamily: "'Space Mono',monospace", fontSize: 13, color: '#e2e8f0', marginBottom: 20, letterSpacing: '0.05em' }}>CREATE PRIVATE ROOM</h2>
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

function InviteLinkModal({ room, onClose }) {
  const link = `${window.location.origin}/join/${room.inviteCode}`;
  const [copied, setCopied] = useState(false);
  const copy = () => { navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 }}>
      <div style={{ background: '#0d1420', border: '1px solid #1a2d4a', borderRadius: 16, padding: '28px 32px', width: '100%', maxWidth: 400 }}>
        <h2 style={{ fontFamily: "'Space Mono',monospace", fontSize: 13, color: '#e2e8f0', marginBottom: 6 }}>INVITE LINK</h2>
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

function PendingRequestsModal({ room, token, onClose, onUpdate }) {
  const [loading, setLoading] = useState({});
  const respond = async (address, action) => {
    setLoading(prev => ({ ...prev, [address]: true }));
    try { await fetch(`${BACKEND_URL}/rooms/${room.id}/respond`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ requesterAddress: address, action }) }); onUpdate(); }
    catch (err) { console.error(err); }
    setLoading(prev => ({ ...prev, [address]: false }));
  };
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 }}>
      <div style={{ background: '#0d1420', border: '1px solid #1a2d4a', borderRadius: 16, padding: '28px 32px', width: '100%', maxWidth: 400, maxHeight: '80vh', overflowY: 'auto' }}>
        <h2 style={{ fontFamily: "'Space Mono',monospace", fontSize: 13, color: '#e2e8f0', marginBottom: 20 }}>JOIN REQUESTS — #{room.name}</h2>
        {!room.pendingRequests?.length ? <p style={{ fontSize: 13, color: '#4a5568', textAlign: 'center', padding: '20px 0' }}>No pending requests</p> :
          room.pendingRequests?.map(r => (
            <div key={r.address} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid #1a2d4a' }}>
              <Avatar name={r.username} size={36} />
              <div style={{ flex: 1 }}><div style={{ fontSize: 13, color: '#e2e8f0', fontWeight: 500 }}>{r.username}</div><div style={{ fontSize: 11, color: '#4a5568', fontFamily: "'Space Mono',monospace" }}>{shortAddress(r.address)}</div></div>
              <button onClick={() => respond(r.address, 'approve')} disabled={loading[r.address]} style={{ padding: '6px 12px', borderRadius: 6, background: '#10b981', border: 'none', color: '#fff', fontSize: 12, cursor: 'pointer' }}>✓</button>
              <button onClick={() => respond(r.address, 'reject')} disabled={loading[r.address]} style={{ padding: '6px 12px', borderRadius: 6, background: 'transparent', border: '1px solid #ef4444', color: '#ef4444', fontSize: 12, cursor: 'pointer' }}>✗</button>
            </div>
          ))}
        <button onClick={onClose} style={{ width: '100%', marginTop: 16, padding: '10px', borderRadius: 8, background: 'transparent', border: '1px solid #1e2d45', color: '#64748b', fontSize: 13, cursor: 'pointer' }}>Close</button>
      </div>
    </div>
  );
}

// ─── Join Room Page ───────────────────────────────────────────────────────────
function JoinRoomPage({ inviteCode, auth, onJoined }) {
  const [roomInfo, setRoomInfo] = useState(null);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');
  useEffect(() => {
    fetch(`${BACKEND_URL}/rooms/invite/${inviteCode}`).then(r => r.json()).then(data => { if (data.error) { setError(data.error); setStatus('error'); } else { setRoomInfo(data); setStatus('ready'); } }).catch(() => { setError('Failed to load room'); setStatus('error'); });
  }, [inviteCode]);
  const requestJoin = async () => {
    setStatus('loading');
    try {
      const res = await fetch(`${BACKEND_URL}/rooms/request/${inviteCode}`, { method: 'POST', headers: { Authorization: `Bearer ${auth.token}` } });
      const data = await res.json();
      if (data.status === 'already_member') onJoined(`private:${roomInfo.id}`);
      else setStatus('pending');
    } catch { setError('Failed to send request'); setStatus('error'); }
  };
  return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#080c14', padding: 16 }}>
      <div style={{ background: '#0d1420', border: '1px solid #1a2d4a', borderRadius: 16, padding: '40px 32px', width: '100%', maxWidth: 380, textAlign: 'center', fontFamily: "'DM Sans',sans-serif" }}>
        <div style={{ fontSize: 36, marginBottom: 16 }}>🔒</div>
        {status === 'loading' && <p style={{ color: '#4a5568' }}>Loading room…</p>}
        {status === 'error' && <p style={{ color: '#ef4444' }}>{error}</p>}
        {status === 'pending' && <><h2 style={{ color: '#e2e8f0', fontSize: 16, marginBottom: 8 }}>Request Sent!</h2><p style={{ color: '#4a5568', fontSize: 13 }}>Waiting for approval. You'll be notified when approved.</p></>}
        {status === 'ready' && roomInfo && (<>
          <h2 style={{ color: '#e2e8f0', fontSize: 18, marginBottom: 6 }}>#{roomInfo.name}</h2>
          {roomInfo.description && <p style={{ color: '#4a5568', fontSize: 13, marginBottom: 4 }}>{roomInfo.description}</p>}
          <p style={{ color: '#2d3748', fontSize: 12, marginBottom: 24 }}>By {roomInfo.creatorUsername} · {roomInfo.memberCount} members</p>
          <button onClick={requestJoin} style={{ width: '100%', padding: '12px', borderRadius: 8, background: '#3b82f6', border: 'none', color: '#fff', fontSize: 14, cursor: 'pointer', fontFamily: "'Space Mono',monospace" }}>REQUEST TO JOIN →</button>
        </>)}
      </div>
    </div>
  );
}

// ─── Wallet Login ─────────────────────────────────────────────────────────────
function WalletLogin({ onAuth }) {
  const [step, setStep] = useState('connect');
  const [wallets, setWallets] = useState([]);
  const [selectedProvider, setSelectedProvider] = useState(null);
  const [address, setAddress] = useState('');
  const [username, setUsername] = useState('');
  const [nonce, setNonce] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const detected = new Map();
    const handleAnnounce = (event) => {
      const { info, provider } = event.detail;
      if (!detected.has(info.uuid)) { detected.set(info.uuid, { info, provider }); setWallets([...detected.values()]); }
    };
    window.addEventListener('eip6963:announceProvider', handleAnnounce);
    window.dispatchEvent(new Event('eip6963:requestProvider'));
    const fallback = setTimeout(() => {
      if (detected.size === 0 && window.ethereum) {
        const w = { info: { uuid: 'legacy', name: window.ethereum.isMetaMask ? 'MetaMask' : 'Browser Wallet', icon: null }, provider: window.ethereum };
        detected.set('legacy', w); setWallets([...detected.values()]);
      }
    }, 500);
    return () => { window.removeEventListener('eip6963:announceProvider', handleAnnounce); clearTimeout(fallback); };
  }, []);

  const connectWallet = async (wallet) => {
    setError(''); setLoading(true); setSelectedProvider(wallet.provider);
    try {
      const accounts = await wallet.provider.request({ method: 'eth_requestAccounts' });
      const addr = accounts[0]; setAddress(addr);
      const res = await fetch(`${BACKEND_URL}/auth/nonce/${addr}`);
      const data = await res.json();
      setNonce(data.nonce);
      if (data.isNew) { setStep('username'); }
      else { setUsername(data.username); setStep('signing'); await signAndVerify(wallet.provider, addr, data.nonce, data.username); }
    } catch (err) { setError(err.message || 'Failed to connect'); setStep('connect'); }
    setLoading(false);
  };

  const signAndVerify = async (provider, addr, nonceVal, user) => {
    setLoading(true); setStep('signing');
    try {
      const message = `Welcome to ${APP_NAME}!\n\nSign this message to verify your wallet.\n\nNonce: ${nonceVal}`;
      const signature = await provider.request({ method: 'personal_sign', params: [message, addr] });
      const res = await fetch(`${BACKEND_URL}/auth/verify`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ address: addr, signature, nonce: nonceVal, username: user }) });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      localStorage.setItem('gl_token', data.token); localStorage.setItem('gl_username', data.username); localStorage.setItem('gl_address', data.address);
      onAuth({ token: data.token, username: data.username, address: data.address });
    } catch (err) { setError(err.message || 'Signing failed'); setStep('connect'); }
    setLoading(false);
  };

  return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#080c14', padding: 16 }}>
      <div style={{ background: '#0d1420', border: '1px solid #1a2d4a', borderRadius: 16, padding: '36px 32px', width: '100%', maxWidth: 400, fontFamily: "'DM Sans',sans-serif" }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>⬡</div>
          <h1 style={{ fontFamily: "'Space Mono',monospace", fontSize: 16, color: '#e2e8f0', marginBottom: 4 }}>{APP_NAME.toUpperCase()}</h1>
          <p style={{ fontSize: 13, color: '#4a5568' }}>Web3 AI collaboration</p>
        </div>
        {error && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#fca5a5' }}>{error}</div>}
        {step === 'connect' && (
          <>
            <p style={{ fontSize: 13, color: '#4a5568', marginBottom: 14, textAlign: 'center' }}>{wallets.length === 0 ? 'Scanning for wallets…' : `${wallets.length} wallet${wallets.length > 1 ? 's' : ''} detected`}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20, maxHeight: 280, overflowY: 'auto' }}>
              {wallets.length === 0 && <div style={{ textAlign: 'center', padding: '24px 0', color: '#2d3748', fontSize: 13 }}>No wallets found. <a href="https://metamask.io" target="_blank" rel="noreferrer" style={{ color: '#3b82f6' }}>Install MetaMask</a></div>}
              {wallets.map(wallet => (
                <button key={wallet.info.uuid} onClick={() => connectWallet(wallet)} disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderRadius: 10, background: '#111827', border: '1px solid #1e2d45', color: '#e2e8f0', cursor: loading ? 'default' : 'pointer', width: '100%', textAlign: 'left' }}>
                  {wallet.info.icon ? <img src={wallet.info.icon} alt={wallet.info.name} style={{ width: 36, height: 36, borderRadius: 8, flexShrink: 0 }} /> : <div style={{ width: 36, height: 36, borderRadius: 8, background: '#1e2d45', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>{wallet.info.name[0]}</div>}
                  <div><div style={{ fontSize: 14, fontWeight: 500 }}>{wallet.info.name}</div><div style={{ fontSize: 11, color: '#4a5568' }}>Click to connect</div></div>
                  <div style={{ marginLeft: 'auto', color: '#4a5568' }}>→</div>
                </button>
              ))}
            </div>
            <p style={{ fontSize: 11, color: '#2d3748', textAlign: 'center' }}>Wallet used to verify identity — no password needed</p>
          </>
        )}
        {step === 'username' && (
          <>
            <div style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 12, color: '#6ee7b7', fontFamily: "'Space Mono',monospace", textAlign: 'center' }}>{shortAddress(address)}</div>
            <p style={{ fontSize: 13, color: '#64748b', marginBottom: 16, textAlign: 'center' }}>New wallet — choose a username</p>
            <input type="text" placeholder="Enter username…" value={username} onChange={e => setUsername(e.target.value)} onKeyDown={e => e.key === 'Enter' && username.trim() && signAndVerify(selectedProvider, address, nonce, username.trim())} style={{ width: '100%', padding: '10px 14px', borderRadius: 8, background: '#111827', border: '1px solid #1e2d45', color: '#e2e8f0', fontSize: 14, outline: 'none', marginBottom: 12 }} autoFocus />
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setStep('connect')} style={{ flex: 1, padding: '10px', borderRadius: 8, background: 'transparent', border: '1px solid #1e2d45', color: '#64748b', fontSize: 13, cursor: 'pointer' }}>← Back</button>
              <button onClick={() => signAndVerify(selectedProvider, address, nonce, username.trim())} disabled={!username.trim() || loading} style={{ flex: 2, padding: '11px', borderRadius: 8, background: username.trim() && !loading ? '#3b82f6' : '#1e2d45', border: 'none', color: '#fff', fontSize: 13, cursor: username.trim() ? 'pointer' : 'default', fontFamily: "'Space Mono',monospace" }}>{loading ? 'SIGNING…' : 'CONTINUE →'}</button>
            </div>
          </>
        )}
        {step === 'signing' && <div style={{ textAlign: 'center', padding: '20px 0', color: '#64748b', fontSize: 13 }}><div style={{ fontSize: 32, marginBottom: 12 }}>✍️</div><p>Check your wallet and sign to continue…</p></div>}
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
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [uploading, setUploading] = useState(false);
  const messagesEndRef = useRef(null);
  const typingTimeout = useRef(null);
  const socketRef = useRef(null);
  const activeRoomRef = useRef(activeRoom);
  const fileInputRef = useRef(null);

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

  // Push notification setup
  useEffect(() => { if (auth) setupPushNotifications(auth.token); }, [auth]);

  // Room search
  useEffect(() => {
    if (!searchQuery.trim() || !auth) { setSearchResults([]); return; }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/rooms/search?q=${encodeURIComponent(searchQuery)}`, { headers: { Authorization: `Bearer ${auth.token}` } });
        const data = await res.json();
        setSearchResults(Array.isArray(data) ? data : []);
      } catch {}
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, auth]);

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
    s.on('message_deleted', ({ messageId, room }) => {
      setMessages(prev => ({ ...prev, [room]: (prev[room] || []).map(m => m._id === messageId ? { ...m, deleted: true, text: 'This message was deleted', fileUrl: null } : m) }));
    });
    s.on('room_users', ({ room, users }) => setRoomUsers(prev => ({ ...prev, [room]: users })));
    s.on('user_typing', ({ username, isTyping }) => {
      setTypingUsers(prev => { const cur = new Set(prev[activeRoomRef.current] || []); isTyping ? cur.add(username) : cur.delete(username); return { ...prev, [activeRoomRef.current]: [...cur] }; });
    });
    s.on('ai_typing', ({ room, typing }) => setAiTyping(prev => ({ ...prev, [room]: typing })));
    s.on('user_joined', ({ username, room }) => { if (username !== auth.username) setMessages(prev => ({ ...prev, [room]: [...(prev[room] || []), { _id: Date.now(), type: 'system', text: `${username} joined`, ts: new Date() }] })); });
    s.on('user_left', ({ username, room }) => setMessages(prev => ({ ...prev, [room]: [...(prev[room] || []), { _id: Date.now() + 1, type: 'system', text: `${username} left`, ts: new Date() }] })));
    s.on('join_request', ({ roomId, roomName, requester }) => { setNotifications(prev => [...prev, { id: Date.now(), type: 'request', roomId, roomName, requester }]); fetchMyRooms(); });
    s.on('join_approved', ({ roomId, roomName }) => { setNotifications(prev => [...prev, { id: Date.now(), type: 'approved', roomName }]); fetchMyRooms(); setTimeout(() => switchRoom(`private:${roomId}`), 500); });
    s.on('join_rejected', ({ roomName }) => setNotifications(prev => [...prev, { id: Date.now(), type: 'rejected', roomName }]));
    s.on('room_deleted', () => { fetchMyRooms(); if (activeRoomRef.current.startsWith('private:')) setActiveRoom('general'); });
    return () => { s.disconnect(); socketInstance = null; };
  }, [auth]);

  const switchRoom = (room) => {
    if (room === activeRoom) return;
    setActiveRoom(room);
    socketRef.current?.emit('join_room', { room });
    setSidebarOpen(false); // auto-close sidebar on mobile
  };

  const sendMessage = () => {
    const text = input.trim();
    if (!text || !connected) return;
    socketRef.current.emit('send_message', { room: activeRoom, text });
    socketRef.current.emit('typing', { room: activeRoom, isTyping: false });
    setInput('');
  };

  const handleFileUpload = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`${BACKEND_URL}/upload`, { method: 'POST', headers: { Authorization: `Bearer ${auth.token}` }, body: formData });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      socketRef.current.emit('send_message', { room: activeRoom, text: '', fileUrl: data.url, fileName: data.name, fileType: data.type });
    } catch (err) { alert('Upload failed: ' + err.message); }
    setUploading(false);
  };

  const handleDeleteMessage = async (messageId) => {
    try {
      await fetch(`${BACKEND_URL}/messages/${messageId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${auth.token}` } });
    } catch {}
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
    if (!confirm('Delete this room?')) return;
    await fetch(`${BACKEND_URL}/rooms/${roomId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${auth.token}` } });
    fetchMyRooms();
    if (activeRoom === `private:${roomId}`) setActiveRoom('general');
  };

  if (!auth) return <WalletLogin onAuth={setAuth} />;
  if (inviteCode) return <JoinRoomPage inviteCode={inviteCode} auth={auth} onJoined={(room) => { window.history.pushState({}, '', '/'); switchRoom(room); }} />;

  const activeRoomInfo = PUBLIC_ROOMS.find(r => r.id === activeRoom) || privateRooms.find(r => `private:${r.id}` === activeRoom);
  const roomMsgs = messages[activeRoom] || [];
  const typingNow = (typingUsers[activeRoom] || []).filter(u => u !== auth.username);
  const onlineUsers = roomUsers[activeRoom] || [];
  const isPrivateActive = activeRoom.startsWith('private:');
  const activePrivateRoom = isPrivateActive ? privateRooms.find(r => `private:${r.id}` === activeRoom) : null;

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#080c14', color: '#e2e8f0', fontFamily: "'DM Sans',sans-serif", position: 'relative' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=DM+Sans:wght@300;400;500&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{width:4px}
        ::-webkit-scrollbar-thumb{background:#1e2d45;border-radius:4px}
        @keyframes fadeIn{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:none}}
        @keyframes pulse{0%,80%,100%{transform:scale(0.6);opacity:0.4}40%{transform:scale(1);opacity:1}}
        @media(max-width:640px){
          .sidebar{position:fixed!important;left:0;top:0;height:100vh;z-index:50;transform:translateX(-100%);transition:transform 0.25s ease}
          .sidebar.open{transform:translateX(0)}
          .sidebar-overlay{display:block!important}
        }
      `}</style>

      {/* Mobile overlay */}
      {sidebarOpen && (
  <div onClick={() => setSidebarOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 40 }}/>
)}
      {/* Notifications */}
      <div style={{ position: 'fixed', top: 16, right: 16, zIndex: 200, display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 300 }}>
        {notifications.slice(-3).map(n => (
          <div key={n.id} style={{ background: '#0d1420', border: `1px solid ${n.type === 'approved' ? '#10b981' : n.type === 'rejected' ? '#ef4444' : '#3b82f6'}33`, borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#e2e8f0', animation: 'fadeIn 0.2s ease' }}>
            {n.type === 'request' && <span>🔔 <b>{n.requester.username}</b> wants to join <b>#{n.roomName}</b></span>}
            {n.type === 'approved' && <span>✅ Approved to join <b>#{n.roomName}</b></span>}
            {n.type === 'rejected' && <span>❌ Request to <b>#{n.roomName}</b> rejected</span>}
            <button onClick={() => setNotifications(prev => prev.filter(x => x.id !== n.id))} style={{ float: 'right', background: 'none', border: 'none', color: '#4a5568', cursor: 'pointer', fontSize: 14 }}>×</button>
          </div>
        ))}
      </div>

      {/* Sidebar */}
      <div style={{ width: 230, background: '#0d1420', borderRight: '1px solid #1a2d4a', display: 'flex', flexDirection: 'column', flexShrink: 0, position: window.innerWidth <= 640 ? 'fixed' : 'relative', left: 0, top: 0, height: '100vh', zIndex: 50, transform: window.innerWidth <= 640 && !sidebarOpen ? 'translateX(-100%)' : 'translateX(0)', transition: 'transform 0.25s ease' }} style={{ width: 230, background: '#0d1420', borderRight: '1px solid #1a2d4a', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid #1a2d4a' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 28, height: 28, background: '#3b82f6', borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>⬡</div>
            <span style={{ fontFamily: "'Space Mono',monospace", fontWeight: 700, fontSize: 12, letterSpacing: '0.02em' }}>GENLAYER CHAT-BOX</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: connected ? '#10b981' : '#ef4444' }}/>
            <span style={{ fontSize: 10, color: '#4a5568', fontFamily: "'Space Mono',monospace" }}>{connected ? 'connected' : 'reconnecting…'}</span>
          </div>
        </div>

        {/* Search */}
        <div style={{ padding: '10px 12px', borderBottom: '1px solid #1a2d4a', position: 'relative' }}>
          <input type="text" placeholder="🔍 Search rooms…" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} style={{ width: '100%', padding: '7px 10px', borderRadius: 8, background: '#111827', border: '1px solid #1e2d45', color: '#e2e8f0', fontSize: 12, outline: 'none' }} />
          {searchResults.length > 0 && (
            <div style={{ position: 'absolute', top: '100%', left: 12, right: 12, background: '#0d1420', border: '1px solid #1a2d4a', borderRadius: 8, zIndex: 10, overflow: 'hidden' }}>
              {searchResults.map(r => (
                <button key={r.id} onClick={() => { switchRoom(`private:${r.id}`); setSearchQuery(''); setSearchResults([]); }} style={{ width: '100%', padding: '8px 12px', background: 'transparent', border: 'none', color: '#e2e8f0', fontSize: 12, cursor: 'pointer', textAlign: 'left', borderBottom: '1px solid #1a2d4a' }}>
                  🔒 {r.name} <span style={{ color: '#4a5568' }}>· {r.memberCount} members</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '10px 8px' }}>
          <div style={{ fontSize: 10, color: '#4a5568', fontFamily: "'Space Mono',monospace", padding: '0 8px 6px', letterSpacing: '0.1em' }}>PUBLIC</div>
          {PUBLIC_ROOMS.map(r => (
            <button key={r.id} onClick={() => switchRoom(r.id)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 8, border: 'none', cursor: 'pointer', background: activeRoom === r.id ? 'rgba(59,130,246,0.12)' : 'transparent', color: activeRoom === r.id ? '#60a5fa' : '#64748b', marginBottom: 1, textAlign: 'left' }}>
              <span style={{ fontSize: 9, color: activeRoom === r.id ? r.color : '#334155' }}>⬡</span>
              <span style={{ fontSize: 13, fontWeight: activeRoom === r.id ? 500 : 400, flex: 1 }}>{r.name}</span>
              {unread[r.id] > 0 && <span style={{ fontSize: 10, background: r.color, color: '#fff', borderRadius: 10, padding: '1px 6px' }}>{unread[r.id]}</span>}
            </button>
          ))}

          <div style={{ fontSize: 10, color: '#4a5568', fontFamily: "'Space Mono',monospace", padding: '14px 8px 6px', letterSpacing: '0.1em', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>PRIVATE</span>
            <button onClick={() => setShowCreateModal(true)} style={{ background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer', fontSize: 18, lineHeight: 1 }} title="Create room">+</button>
          </div>
          {privateRooms.length === 0 && <div style={{ fontSize: 12, color: '#2d3748', padding: '4px 10px' }}>No private rooms</div>}
          {privateRooms.map(r => {
            const roomKey = `private:${r.id}`;
            const isActive = activeRoom === roomKey;
            return (
              <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 2, marginBottom: 1 }}>
                <button onClick={() => switchRoom(roomKey)} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 8, border: 'none', cursor: 'pointer', background: isActive ? 'rgba(139,92,246,0.12)' : 'transparent', color: isActive ? '#a78bfa' : '#64748b', textAlign: 'left', minWidth: 0 }}>
                  <span style={{ fontSize: 11, flexShrink: 0 }}>🔒</span>
                  <span style={{ fontSize: 13, fontWeight: isActive ? 500 : 400, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</span>
                  {r.pendingCount > 0 && <span style={{ fontSize: 10, background: '#f59e0b', color: '#fff', borderRadius: 10, padding: '1px 5px', flexShrink: 0 }}>{r.pendingCount}</span>}
                  {unread[roomKey] > 0 && <span style={{ fontSize: 10, background: '#8b5cf6', color: '#fff', borderRadius: 10, padding: '1px 5px', flexShrink: 0 }}>{unread[roomKey]}</span>}
                </button>
                {r.isCreator && (
                  <div style={{ display: 'flex' }}>
                    <button onClick={() => setShowInviteModal(r)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#4a5568', fontSize: 11, padding: '4px 3px' }} title="Invite link">🔗</button>
                    {r.pendingCount > 0 && <button onClick={() => setShowRequestsModal(r)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#f59e0b', fontSize: 11, padding: '4px 3px' }} title="Requests">👥</button>}
                    <button onClick={() => deleteRoom(r.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#4a5568', fontSize: 11, padding: '4px 3px' }} title="Delete">🗑</button>
                  </div>
                )}
              </div>
            );
          })}

          {onlineUsers.length > 0 && (
            <>
              <div style={{ fontSize: 10, color: '#4a5568', fontFamily: "'Space Mono',monospace", padding: '14px 8px 6px', letterSpacing: '0.1em' }}>ONLINE</div>
              {onlineUsers.map(u => (
                <div key={u.address || u.username} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 10px' }}>
                  <div style={{ position: 'relative' }}>
                    <Avatar name={u.username} size={20} />
                    <div style={{ position: 'absolute', bottom: -1, right: -1, width: 5, height: 5, borderRadius: '50%', background: '#10b981', border: '1px solid #0d1420' }}/>
                  </div>
                  <span style={{ fontSize: 12, color: u.username === auth.username ? '#e2e8f0' : '#64748b' }}>{u.username}{u.username === auth.username ? ' (you)' : ''}</span>
                </div>
              ))}
            </>
          )}
        </div>

        <div style={{ padding: '10px 12px', borderTop: '1px solid #1a2d4a', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Avatar name={auth.username} size={26} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{auth.username}</div>
            <div style={{ fontSize: 10, color: '#2d3748', fontFamily: "'Space Mono',monospace" }}>{shortAddress(auth.address)}</div>
          </div>
          <button onClick={logout} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#4a5568', fontSize: 14, padding: 4 }} title="Logout">⏻</button>
        </div>
      </div>

      {/* Main */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 16px', height: 52, borderBottom: '1px solid #1a2d4a', background: '#0a0f1a', flexShrink: 0 }}>
          <button onClick={() => setSidebarOpen(v => !v)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#4a5568', fontSize: 18, padding: '4px', flexShrink: 0 }}>☰</button>
          <span style={{ fontSize: 13 }}>{isPrivateActive ? '🔒' : '⬡'}</span>
          <span style={{ fontFamily: "'Space Mono',monospace", fontSize: 13, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>#{activeRoomInfo?.name || 'unknown'}</span>
          <span style={{ fontSize: 12, color: '#4a5568', display: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} className="room-desc">{activeRoomInfo?.desc || activeRoomInfo?.description}</span>
          <div style={{ flex: 1 }}/>
          {isPrivateActive && activePrivateRoom?.isCreator && (
            <>
              <button onClick={() => setShowInviteModal(activePrivateRoom)} style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 20, padding: '4px 10px', fontSize: 11, color: '#60a5fa', cursor: 'pointer', fontFamily: "'Space Mono',monospace", whiteSpace: 'nowrap' }}>🔗 INVITE</button>
              {activePrivateRoom?.pendingCount > 0 && <button onClick={() => setShowRequestsModal(activePrivateRoom)} style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 20, padding: '4px 10px', fontSize: 11, color: '#fbbf24', cursor: 'pointer', whiteSpace: 'nowrap' }}>👥 {activePrivateRoom.pendingCount}</button>}
            </>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 20, padding: '3px 10px 3px 7px', flexShrink: 0 }}>
            <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#10b981' }}/>
            <span style={{ fontSize: 10, color: '#60a5fa', fontFamily: "'Space Mono',monospace" }}>AI</span>
          </div>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
          {roomMsgs.length === 0 && (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: '#2d3748' }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>{isPrivateActive ? '🔒' : '⬡'}</div>
              <div style={{ fontFamily: "'Space Mono',monospace", fontSize: 13 }}>#{activeRoomInfo?.name} — start collaborating</div>
              <div style={{ fontSize: 12, marginTop: 6 }}>Use <code style={{ color: '#3b82f6' }}>@ai</code> to ask GenLayer AI</div>
            </div>
          )}
          {roomMsgs.map(m => m.type === 'system' ? (
            <div key={m._id} style={{ textAlign: 'center', fontSize: 11, color: '#2d3748', padding: '3px 0', fontFamily: "'Space Mono',monospace" }}>{m.text}</div>
          ) : <Message key={m._id} msg={m} currentAddress={auth.address} onDelete={handleDeleteMessage} />)}
          {typingNow.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', fontSize: 12, color: '#4a5568' }}>
              <div style={{ display: 'flex', gap: 3 }}>{[0,1,2].map(i => <div key={i} style={{ width: 5, height: 5, borderRadius: '50%', background: '#3b82f6', animation: `pulse 1.2s ease-in-out ${i*0.2}s infinite`, opacity: 0.7 }}/>)}</div>
              <span>{typingNow.join(', ')} typing…</span>
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

        {/* Input */}
        <div style={{ padding: '10px 16px 14px', background: '#0a0f1a', borderTop: '1px solid #1a2d4a', flexShrink: 0 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', background: '#111827', border: '1px solid #1e2d45', borderRadius: 12, padding: '8px 12px' }}>
            <button onClick={() => fileInputRef.current?.click()} disabled={uploading} title="Attach file" style={{ background: 'none', border: 'none', cursor: uploading ? 'default' : 'pointer', color: uploading ? '#2d3748' : '#4a5568', fontSize: 18, padding: '2px', flexShrink: 0, lineHeight: 1 }}>
              {uploading ? '⏳' : '📎'}
            </button>
            <input ref={fileInputRef} type="file" accept="image/*,.pdf,.txt,.zip" style={{ display: 'none' }} onChange={e => { handleFileUpload(e.target.files[0]); e.target.value = ''; }} />
            <textarea value={input} onChange={handleTyping} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }}} placeholder={`Message #${activeRoomInfo?.name}… (@ai for AI)`} rows={1} style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: '#e2e8f0', fontSize: 14, resize: 'none', fontFamily: "'DM Sans',sans-serif", lineHeight: 1.5, maxHeight: 120, overflowY: 'auto', minHeight: 22 }} onInput={e => { e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'; }} />
            <button onClick={sendMessage} disabled={!input.trim() || !connected} style={{ background: input.trim() && connected ? '#3b82f6' : '#1e2d45', border: 'none', borderRadius: 8, cursor: input.trim() && connected ? 'pointer' : 'default', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 14, flexShrink: 0 }}>↑</button>
          </div>
          <div style={{ marginTop: 6, fontSize: 10, color: '#1e2d45', textAlign: 'center', fontFamily: "'Space Mono',monospace" }}>
            Enter to send · 📎 attach files · @ai for AI
          </div>
        </div>
      </div>

      {showCreateModal && <CreateRoomModal token={auth.token} onClose={() => setShowCreateModal(false)} onCreated={room => { setShowCreateModal(false); fetchMyRooms(); setTimeout(() => switchRoom(`private:${room._id}`), 300); }} />}
      {showInviteModal && <InviteLinkModal room={showInviteModal} onClose={() => setShowInviteModal(null)} />}
      {showRequestsModal && <PendingRequestsModal room={showRequestsModal} token={auth.token} onClose={() => setShowRequestsModal(null)} onUpdate={() => { fetchMyRooms(); setShowRequestsModal(null); }} />}
    </div>
  );
}