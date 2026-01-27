import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Image as ImageIcon, Video, Send, AlertTriangle, Copy } from 'lucide-react';
import { usePeer } from './hooks/usePeer';
import { vault } from './utils/storage';
import { LoginScreen } from './components/LoginScreen';
import { ChatBubble } from './components/ChatBubble';

const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.readAsDataURL(blob);
  });
};

function App() {
  const [credentials, setCredentials] = useState<{id: string, pass: string} | null>(null);
  const [targetId, setTargetId] = useState('');
  const [inputMsg, setInputMsg] = useState('');
  const [showSettings, setShowSettings] = useState(false);

  const { isConnected, connectToPeer, sendMessage, messages, setMessages } = usePeer(
    credentials?.id || '', 
    credentials?.pass || ''
  );
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadHistory = async () => {
      if (isConnected && credentials && targetId) {
        const history = await vault.load(`chat_${targetId}`, credentials.pass);
        if (history) setMessages(history);
      }
    };
    loadHistory();
  }, [isConnected, targetId]);

  useEffect(() => {
    const saveHistory = async () => {
      if (isConnected && credentials && messages.length > 0) {
        await vault.save(`chat_${targetId}`, messages, credentials.pass);
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }
    };
    saveHistory();
  }, [messages]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'video') => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert("File too large for P2P (Max 5MB)");
        return;
      }
      const base64 = await blobToBase64(file);
      sendMessage(base64, type);
    }
  };

  const handleNuke = () => {
    if (confirm("⚠️ MUTUAL NUKE PROTOCOL ⚠️\n\nThis will wipe YOUR phone AND send a kill code to your partner's device.\n\nAre you sure?")) {
      sendMessage('', 'NUKE_COMMAND');
    }
  };

  if (!credentials) {
    return <LoginScreen onLogin={(id, pass) => setCredentials({ id, pass })} />;
  }

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-black text-white p-6 flex flex-col font-mono">
        <header className="border-b border-nothing-darkgray pb-4 flex justify-between items-end">
          <div>
            <h1 className="font-dot text-4xl">J-CHAT</h1>
            <p className="text-nothing-gray text-[10px]">ID: {credentials.id}</p>
          </div>
          <button onClick={() => navigator.clipboard.writeText(credentials.id)}>
            <Copy size={20} className="text-nothing-gray hover:text-white" />
          </button>
        </header>

        <main className="flex-1 flex flex-col justify-center gap-6">
          <div className="space-y-2">
            <label className="text-nothing-gray text-xs uppercase">Target ID</label>
            <input 
              type="text" 
              value={targetId}
              onChange={(e) => setTargetId(e.target.value.toUpperCase())}
              placeholder="ENTER 6-CHAR CODE"
              className="w-full bg-[#111] border border-nothing-darkgray rounded-nothing p-4 text-xl font-dot text-white focus:border-white outline-none"
            />
          </div>
          <button 
            onClick={() => connectToPeer(targetId)}
            className="h-14 bg-white text-black font-bold uppercase tracking-widest rounded-nothing hover:scale-[1.02] transition-transform"
          >
            Initialize Link
          </button>
        </main>
      </div>
    );
  }

  return (
    <div className="h-[100dvh] bg-black text-white flex flex-col overflow-hidden font-mono">
      <header className="h-16 border-b border-nothing-darkgray flex items-center justify-between px-4 shrink-0 bg-black z-10">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 bg-white rounded-full animate-pulse shadow-[0_0_10px_white]" />
          <div>
            <h2 className="font-dot text-xl leading-none">SECURE</h2>
            <span className="text-[10px] text-nothing-gray">{targetId}</span>
          </div>
        </div>
        <button onClick={() => setShowSettings(!showSettings)} className="text-nothing-gray hover:text-nothing-red">
          <AlertTriangle size={20} />
        </button>
      </header>

      <AnimatePresence>
        {showSettings && (
          <motion.div 
            initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }}
            className="bg-[#111] border-b border-nothing-red overflow-hidden"
          >
            <button 
              onClick={handleNuke}
              className="w-full p-6 text-nothing-red font-bold uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-nothing-red hover:text-white transition-colors"
            >
              <AlertTriangle size={18} /> DELETE CHAT FOR EVERYONE
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="flex-1 overflow-y-auto p-4 scrollbar-hide">
        {messages.map((msg) => <ChatBubble key={msg.id} msg={msg} />)}
        <div ref={messagesEndRef} />
      </main>

      <footer className="p-4 border-t border-nothing-darkgray bg-black shrink-0">
        <div className="flex items-center gap-3">
          <label className="cursor-pointer text-nothing-gray hover:text-white transition-colors">
            <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileUpload(e, 'image')} />
            <ImageIcon size={20} />
          </label>
          
          <label className="cursor-pointer text-nothing-gray hover:text-white transition-colors">
            <input type="file" accept="video/*" className="hidden" onChange={(e) => handleFileUpload(e, 'video')} />
            <Video size={20} />
          </label>

          <input
            type="text"
            value={inputMsg}
            onChange={(e) => setInputMsg(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendMessage(inputMsg, 'text') || setInputMsg('')}
            placeholder="Message..."
            className="flex-1 bg-transparent border-b border-nothing-darkgray py-2 text-white focus:border-white outline-none placeholder:text-nothing-darkgray"
          />

          {inputMsg.trim() && (
            <button 
              onClick={() => { sendMessage(inputMsg, 'text'); setInputMsg(''); }}
              className="p-2 bg-white text-black rounded-full"
            >
              <Send size={16} />
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}

export default App;
