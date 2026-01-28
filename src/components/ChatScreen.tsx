import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Message } from '../hooks/usePeer';

const REACTIONS = ["😊","😂","❤️","😍","😘","💕","👌","😒","🥲","🙂","😑","😶‍🌫️","🫡"];

interface ChatProps {
  messages: Message[];
  onSendMessage: (text: string, type: 'text' | 'image' | 'video' | 'audio' | 'reaction') => void;
  onClear: () => void;
  onUnlink: () => void;
  targetId: string;
}

const MinimalAudioPlayer = ({ src, isSender }: { src: string, isSender: boolean }) => {
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  const togglePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!audioRef.current) return;
    if (playing) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setPlaying(!playing);
  };

  return (
    <div className="flex items-center gap-3 min-w-[120px]">
      <audio 
        ref={audioRef} 
        src={src} 
        onEnded={() => setPlaying(false)} 
        className="hidden" 
      />
      <button 
        onClick={togglePlay}
        className={`w-8 h-8 rounded-full flex items-center justify-center border transition-all ${
          isSender ? 'border-black text-black hover:bg-black hover:text-white' : 'border-white text-white hover:bg-white hover:text-black'
        }`}
      >
        {playing ? '■' : '▶'}
      </button>
      <div className="flex gap-1 items-center h-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className={`w-1 bg-current ${playing ? 'animate-pulse' : ''}`} style={{ height: `${Math.random() * 10 + 4}px` }} />
        ))}
      </div>
      <span className="text-[9px] font-mono opacity-70">VOICE</span>
    </div>
  );
};

export const ChatScreen = ({ messages, onSendMessage, onClear, onUnlink, targetId }: ChatProps) => {
  const [input, setInput] = useState('');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [fullScreenMedia, setFullScreenMedia] = useState<string | null>(null);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  useEffect(scrollToBottom, [messages]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    onSendMessage(input, 'text');
    setInput('');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const type = file.type.startsWith('video/') ? 'video' : 'image';
      onSendMessage(reader.result as string, type);
    };
    reader.readAsDataURL(file);
  };

  // ✅ ANDROID-PROOF RECORDING
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      let mimeType = 'audio/webm';
      if (MediaRecorder.isTypeSupported('audio/mp4')) mimeType = 'audio/mp4';
      else if (MediaRecorder.isTypeSupported('audio/aac')) mimeType = 'audio/aac';
      
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      const chunks: BlobPart[] = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: mimeType });
        const reader = new FileReader();
        reader.onload = () => {
          onSendMessage(reader.result as string, 'audio');
        };
        reader.readAsDataURL(blob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err: any) {
      alert(`MIC ERROR: ${err.name}`);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleReaction = (emoji: string) => {
    onSendMessage(`REACTED: ${emoji}`, 'reaction'); 
    setSelectedMessageId(null);
  };

  return (
    <div className="flex flex-col h-screen bg-[#000000] text-white font-mono selection:bg-[#D71920] selection:text-white" onClick={() => setSelectedMessageId(null)}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DotGothic16&display=swap'); .font-dot { font-family: 'DotGothic16', sans-serif; letter-spacing: 0.05em; }`}</style>
      
      {/* HEADER */}
      <div className="pt-10 pb-4 px-4 bg-[#000000] z-10 flex justify-between items-end border-b border-[#262626]">
        <div>
          <h2 className="text-2xl font-bold tracking-tighter uppercase leading-none font-dot">J-CHAT</h2>
          <div className="flex items-center gap-2 mt-2">
            <div className={`w-2 h-2 rounded-full ${targetId ? 'bg-[#D71920]' : 'bg-[#333] animate-pulse'}`} />
            <p className="text-[10px] tracking-[0.2em] text-[#808080] uppercase font-mono">
              {targetId ? `LINKED :: ${targetId.slice(0,6)}` : 'SEARCHING...'}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={onClear} className="bg-[#1A1A1A] text-white border border-[#333] text-[10px] font-bold px-3 py-1 rounded-sm uppercase tracking-widest hover:bg-white hover:text-black transition-all font-mono">CLEAR</button>
          <button onClick={onUnlink} className="bg-[#D71920] text-white text-[10px] font-bold px-3 py-1 rounded-sm uppercase tracking-widest hover:bg-red-700 active:scale-95 transition-all font-mono">UNLINK</button>
        </div>
      </div>

      {/* MESSAGES */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex flex-col ${msg.sender === 'me' ? 'items-end' : 'items-start'}`}>
            <span className="text-[10px] text-[#666] mb-1 uppercase tracking-widest pl-1 font-mono">{msg.sender === 'me' ? 'SELF' : msg.senderName || 'UNK'}</span>
            <div className="relative group">
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, ease: "easeOut" }} onClick={(e) => { e.stopPropagation(); setSelectedMessageId(selectedMessageId === msg.id ? null : msg.id); }}
                className={`relative max-w-[85vw] p-4 cursor-pointer border transition-all duration-200 ${msg.sender === 'me' ? 'bg-white text-black border-white rounded-[24px] rounded-tr-sm' : 'bg-[#1A1A1A] text-white border-[#333] rounded-[24px] rounded-tl-sm'} ${msg.type === 'reaction' ? 'bg-transparent border-none p-0' : ''} ${selectedMessageId === msg.id ? 'border-[#D71920]' : ''}`}>
                
                {msg.type === 'text' && <p className="text-sm leading-relaxed font-dot">{msg.text}</p>}
                {msg.type === 'reaction' && <div className="flex items-center gap-2 opacity-75"><div className="w-1 h-1 bg-[#D71920] rounded-full"></div><p className="text-xs uppercase tracking-widest font-bold font-dot">{msg.text}</p></div>}
                {msg.type === 'audio' && <MinimalAudioPlayer src={msg.text} isSender={msg.sender === 'me'} />}
                {msg.type === 'image' && <img src={msg.text} alt="content" onClick={(e) => { e.stopPropagation(); setFullScreenMedia(msg.text); }} className="w-full max-h-[300px] object-cover rounded-lg border border-[#333]" />}
                {msg.type === 'video' && <video src={msg.text} controls className="w-full max-h-[300px] rounded-lg border border-[#333]" />}
              </motion.div>
              <AnimatePresence>
                {selectedMessageId === msg.id && (
                  <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className={`absolute z-50 bottom-full mb-2 flex gap-1 p-2 bg-[#121212] border border-[#333] rounded-full shadow-[0_4px_20px_rgba(0,0,0,1)] overflow-x-auto max-w-[280px] scrollbar-hide ${msg.sender === 'me' ? 'right-0' : 'left-0'}`} onClick={(e) => e.stopPropagation()}>
                    {REACTIONS.map((emoji) => <button key={emoji} onClick={() => handleReaction(emoji)} className="w-8 h-8 flex items-center justify-center text-lg rounded-full hover:bg-[#262626] active:scale-90 transition-all">{emoji}</button>)}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            
            {/* ✅ STATUS INDICATOR (TIMESTAMP + PENDING ICON) */}
            <div className="flex items-center gap-1 mt-1 justify-end w-full">
                <span className="text-[9px] text-[#444] font-bold tracking-widest font-mono">
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit' })}
                </span>
                {msg.sender === 'me' && (
                     <span className="text-[8px] text-[#D71920]">
                        {msg.status === 'pending' ? '⏳' : ''}
                    </span>
                )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* FULL SCREEN */}
      <AnimatePresence>
        {fullScreenMedia && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black z-[999] flex items-center justify-center" onClick={() => setFullScreenMedia(null)}>
            <img src={fullScreenMedia} className="max-w-full max-h-full" />
            <button className="absolute top-8 right-8 text-[#D71920] text-xl font-bold border border-[#D71920] w-10 h-10 rounded-full flex items-center justify-center">✕</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* INPUT */}
      <div className="p-4 bg-[#000000] border-t border-[#262626]" onClick={(e) => e.stopPropagation()}>
        <AnimatePresence>
          {isMenuOpen && <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden mb-4"><button onClick={() => fileInputRef.current?.click()} className="w-full py-4 border border-dashed border-[#444] rounded-[12px] text-[#888] text-xs uppercase tracking-[0.2em] font-mono hover:bg-[#121212] hover:border-[#fff] transition-all">[ + UPLOAD MEDIA ]</button></motion.div>}
        </AnimatePresence>
        <form onSubmit={handleSend} className="flex gap-3 items-center">
          <button type="button" onClick={() => setIsMenuOpen(!isMenuOpen)} className={`w-10 h-10 rounded-full border border-[#444] flex items-center justify-center text-[#888] hover:text-white hover:border-white transition-all ${isMenuOpen ? 'bg-[#D71920] border-[#D71920] text-white rotate-45' : ''}`}><span className="text-xl font-light mb-1">+</span></button>
          <div className="flex-1 bg-[#121212] rounded-full px-5 py-3 border border-[#333] focus-within:border-[#fff] transition-colors flex items-center justify-between">
            <input type="text" value={input} onChange={(e) => setInput(e.target.value)} placeholder={isRecording ? "RECORDING..." : "TYPE MESSAGE..."} className={`bg-transparent text-sm focus:outline-none tracking-wider font-dot w-full ${isRecording ? 'text-[#D71920] animate-pulse' : 'text-white'}`} disabled={isRecording} />
            {!input.trim() && <button type="button" onMouseDown={startRecording} onMouseUp={stopRecording} onTouchStart={startRecording} onTouchEnd={stopRecording} className={`text-lg transition-all ${isRecording ? 'text-[#D71920] scale-125' : 'text-[#666] hover:text-white'}`}>{isRecording ? '■' : '🎙️'}</button>}
          </div>
          {input.trim() && <button type="submit" className="w-10 h-10 rounded-full bg-[#D71920] flex items-center justify-center active:scale-95 transition-transform"><span className="text-white text-xs font-bold">→</span></button>}
        </form>
        <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="image/*,video/*" className="hidden" />
      </div>
    </div>
  );
};