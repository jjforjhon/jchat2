import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Message } from '../hooks/usePeer';

interface ChatProps {
  messages: Message[];
  onSendMessage: (text: string, type: 'text' | 'image') => void;
  isConnected: boolean;
  targetId: string;
  onClear: () => void;   // ✅ ADDED BACK
  onUnlink: () => void;  // ✅ ADDED BACK
}

export const ChatScreen = ({ messages, onSendMessage, isConnected, targetId, onClear, onUnlink }: ChatProps) => {
  const [input, setInput] = useState('');
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), [messages]);

  return (
    <div className="flex flex-col h-screen bg-black text-white font-mono selection:bg-red-600">
      {/* HEADER */}
      <div className="pt-10 pb-4 px-6 bg-black border-b border-zinc-900 z-10 flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold tracking-tighter uppercase">J-CHAT</h1>
          <div className="flex items-center gap-2 mt-1">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-red-600' : 'bg-zinc-800 animate-pulse'}`} />
            <span className="text-[10px] text-zinc-500 uppercase tracking-widest">
              {isConnected ? `SECURE :: ${targetId}` : 'RELAY MODE'}
            </span>
          </div>
        </div>
        {/* ACTION BUTTONS */}
        <div className="flex gap-2">
           <button onClick={onClear} className="text-[10px] bg-zinc-900 px-3 py-1 rounded border border-zinc-800">CLEAR</button>
           <button onClick={onUnlink} className="text-[10px] bg-red-900/30 text-red-500 px-3 py-1 rounded border border-red-900/50">UNLINK</button>
        </div>
      </div>

      {/* CHAT AREA */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        <AnimatePresence>
          {messages.map((msg) => (
            <motion.div key={msg.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`flex flex-col ${msg.sender === 'me' ? 'items-end' : 'items-start'}`}>
              <div className={`max-w-[80vw] p-4 rounded-2xl border relative ${msg.sender === 'me' ? 'bg-white text-black border-white rounded-tr-none' : 'bg-zinc-900 text-white border-zinc-800 rounded-tl-none'}`}>
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</p>
              </div>
              <div className="flex items-center gap-2 mt-1 px-1">
                <span className="text-[9px] text-zinc-600 font-bold tracking-wider">{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                {msg.sender === 'me' && <span className="text-[9px] font-bold text-red-600">{msg.status === 'pending' ? '...' : '●'}</span>}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        <div ref={endRef} />
      </div>

      {/* INPUT */}
      <div className="p-4 bg-black border-t border-zinc-900">
        <form onSubmit={(e) => { e.preventDefault(); if(input.trim()) { onSendMessage(input, 'text'); setInput(''); } }} className="flex gap-3">
          <input value={input} onChange={e => setInput(e.target.value)} placeholder="Type encrypted message..." className="flex-1 bg-zinc-900 border border-zinc-800 rounded-full px-5 py-3 text-sm text-white focus:border-white outline-none" />
          <button type="submit" className="w-12 h-12 bg-red-600 rounded-full flex items-center justify-center font-bold"> → </button>
        </form>
      </div>
    </div>
  );
};