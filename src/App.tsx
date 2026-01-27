import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Image as ImageIcon, Video, Send, AlertTriangle, Copy, LogOut } from 'lucide-react';
import { usePeer } from './hooks/usePeer';
import { vault } from './utils/storage';
import { LoginScreen } from './components/LoginScreen';
import { ChatBubble } from './components/ChatBubble';
import { deriveSessionKey } from './utils/crypto';

type User = {
  id: string;
  name: string;
  email: string;
  token: string;
};

const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.readAsDataURL(blob);
  });
};

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [encryptionKey, setEncryptionKey] = useState<string>('');
  const [targetId, setTargetId] = useState('');
  const [inputMsg, setInputMsg] = useState('');
  const [showSettings, setShowSettings] = useState(false);

  // ✅ CORRECTED: Calls usePeer with 2 arguments
  const { isConnected, connectToPeer, sendMessage, messages, setMessages } = usePeer(
    user?.id ?? '', 
    encryptionKey
  );

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const notificationSoundRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const storedUser = localStorage.getItem('jchat_user');
    const storedKey = sessionStorage.getItem('jchat_session_key');
    if (storedUser && storedKey) {
      setUser(JSON.parse(storedUser));
      setEncryptionKey(storedKey);
    }
  }, []);

  const handleLogin = async (userData: User, pass: string) => {
    const secureKey = await deriveSessionKey(pass);
    setUser(userData);
    setEncryptionKey(secureKey);
    localStorage.setItem('jchat_user', JSON.stringify(userData));
    sessionStorage.setItem('jchat_session_key', secureKey);
  };

  const handleLogout = () => {
    localStorage.removeItem('jchat_user');
    sessionStorage.removeItem('jchat_session_key');
    window.location.reload();
  };

  const handleDeleteProfile = async () => {
    if (!window.confirm('PERMANENTLY DELETE SERVER PROFILE?')) return;
    await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', token: user?.token })
    });
    handleLogout();
  };

  useEffect(() => {
    const load = async () => {
      if (isConnected && user && targetId) {
        const h = await vault.load(`chat_${targetId}`, encryptionKey);
        if (h) setMessages(h);
      }
    };
    load();
  }, [isConnected, targetId, user, encryptionKey, setMessages]);

  useEffect(() => {
    const save = async () => {
      if (isConnected && user && messages.length > 0) {
        await vault.save(`chat_${targetId}`, messages, encryptionKey);
      }
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };
    save();
  }, [messages, isConnected, targetId, user, encryptionKey]);

  const prevLen = useRef(messages.length);
  useEffect(() => {
    if (messages.length > prevLen.current) {
      if (messages[messages.length - 1].sender === 'them') {
        notificationSoundRef.current?.play().catch(() => {});
      }
    }
    prevLen.current = messages.length;
  }, [messages]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'video') => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 100 * 1024 * 1024) return alert('Max 100MB');
      const base64 = await blobToBase64(file);
      sendMessage(base64, type);
    }
  };

  const handleSendText = () => {
    if (!inputMsg.trim()) return;
    sendMessage(inputMsg, 'text');
    setInputMsg('');
  };

  const handleNuke = () => {
    if (window.confirm('⚠️ NUKE PROTOCOL: Wipe both devices?')) {
      sendMessage('__NUKE__', 'NUKE_COMMAND');
    }
  };

  if (!user) return <LoginScreen onLogin={handleLogin} />;

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-black text-white p-6 flex flex-col font-mono">
        <header className="border-b border-nothing-darkgray pb-4 flex justify-between">
          <div>
            <h1 className="font-dot text-4xl">J-CHAT</h1>
            <p className="text-nothing-gray text-[10px]">ID: {user.id}</p>
          </div>
          <div className="flex gap-4">
            <button onClick={handleLogout}><LogOut size={20}/></button>
            <button onClick={() => navigator.clipboard.writeText(user.id)}><Copy size={20}/></button>
          </div>
        </header>
        <main className="flex-1 flex flex-col justify-center gap-6">
          <input 
            value={targetId} 
            onChange={(e) => setTargetId(e.target.value.toUpperCase())}
            placeholder="PASTE TARGET ID"
            className="p-4 bg-[#111] border border-nothing-darkgray text-white outline-none focus:border-white"
          />
          <button onClick={() => connectToPeer(targetId)} className="bg-white text-black p-4 font-bold tracking-widest hover:scale-[1.02] transition">
            INITIALIZE LINK
          </button>
        </main>
      </div>
    );
  }

  return (
    <div className="h-[100dvh] bg-black text-white flex flex-col font-mono">
      <audio ref={notificationSoundRef} src="/notification.mp3" />
      <header className="h-16 border-b border-nothing-darkgray flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 bg-white rounded-full animate-pulse shadow-[0_0_10px_white]" />
          <div>
            <h2 className="font-dot text-xl leading-none">SECURE LINK</h2>
            <span className="text-[10px] text-nothing-gray">TARGET: {targetId}</span>
          </div>
        </div>
        <button onClick={() => setShowSettings(!showSettings)} className="text-nothing-gray hover:text-nothing-red">
          <AlertTriangle size={20} />
        </button>
      </header>

      <AnimatePresence>
        {showSettings && (
          <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="bg-[#111] border-b border-nothing-red overflow-hidden">
             <button onClick={handleNuke} className="w-full p-4 text-nothing-red font-bold flex justify-center gap-2 border-b border-nothing-darkgray">
               <AlertTriangle size={18} /> NUKE CHAT
             </button>
             <button onClick={handleDeleteProfile} className="w-full p-4 text-gray-500 font-bold text-xs">
               DELETE SERVER PROFILE
             </button>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="flex-1 overflow-y-auto p-4 scrollbar-hide">
        {messages.map((msg) => <ChatBubble key={msg.id} msg={msg} />)}
        <div ref={messagesEndRef} />
      </main>

      <footer className="p-4 border-t border-nothing-darkgray bg-black">
        <div className="flex items-center gap-3">
          <label className="cursor-pointer text-nothing-gray hover:text-white">
            <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileUpload(e, 'image')} />
            <ImageIcon size={20} />
          </label>
          <label className="cursor-pointer text-nothing-gray hover:text-white">
            <input type="file" accept="video/*" className="hidden" onChange={(e) => handleFileUpload(e, 'video')} />
            <Video size={20} />
          </label>
          <input value={inputMsg} onChange={(e) => setInputMsg(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSendText()} placeholder="Message..." className="flex-1 bg-transparent border-b border-nothing-darkgray py-2 focus:border-white outline-none" />
          {inputMsg.trim() && <button onClick={handleSendText} className="p-2 bg-white text-black rounded-full"><Send size={16} /></button>}
        </div>
      </footer>
    </div>
  );
}

export default App;