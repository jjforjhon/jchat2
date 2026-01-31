import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Message } from '../hooks/usePeer';

const REACTIONS = ["😊","😂","❤️","😍","😘","💕","👌","😒","🥲","🙂","😑","😶‍🌫️","🫡"];

interface ChatProps {
  messages: Message[];
  onSendMessage: (text: string, type: any) => void;
  onClear: () => void;
  onUnlink: () => void;
  targetId: string;
  remoteProfile: { name: string, avatar: string } | null;
}

const MinimalAudioPlayer = ({ src, isSender }: { src: string, isSender: boolean }) => {
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const togglePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!audioRef.current) return;
    playing ? audioRef.current.pause() : audioRef.current.play();
    setPlaying(!playing);
  };
  return (
    <div className="flex items-center gap-3 min-w-[120px]">
      <audio ref={audioRef} src={src} onEnded={() => setPlaying(false)} className="hidden" />
      <button onClick={togglePlay} className={`w-8 h-8 rounded-full flex items-center justify-center border transition-all ${isSender ? 'border-black text-black' : 'border-white text-white'}`}>{playing ? '■' : '▶'}</button>
      <div className="flex gap-1 items-center h-4">{[...Array(5)].map((_, i) => <div key={i} className={`w-1 bg-current ${playing ? 'animate-pulse' : ''}`} style={{ height: `${Math.random() * 10 + 4}px` }} />)}</div>
    </div>
  );
};

export const ChatScreen = ({ messages, onSendMessage, onClear, onUnlink, targetId, remoteProfile }: ChatProps) => {
  const [input, setInput] = useState('');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [fullScreenMedia, setFullScreenMedia] = useState<{url: string, type: 'image' | 'video'} | null>(null);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), [messages]);

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

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      const chunks: BlobPart[] = [];
      mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onload = () => onSendMessage(reader.result as string, 'audio');
        reader.readAsDataURL(blob);
        stream.getTracks().forEach(t => t.stop());
      };
      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) { alert("Mic Permission Denied"); }
  };

  return (
    <div className="flex flex-col h-screen bg-black text-white font-mono" onClick={() => setSelectedMessageId(null)}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DotGothic16&display=swap'); .font-dot { font-family: 'DotGothic16', sans-serif; letter-spacing: 0.05em; }`}</style>
      
      {/* HEADER */}
      <div className="pt-10 pb-4 px-4 bg-black z-10 flex justify-between items-end border-b border-[#262626]">
        <div className="flex items-center gap-3">
          {/* Remote Avatar Display */}
          <div className="w-10 h-10 rounded-full bg-[#222] border border-[#333] overflow-hidden">
             {remoteProfile?.avatar ? <img src={remoteProfile.avatar} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-xs text-[#555]">?</div>}
          </div>
          <div>
            <h2 className="text-xl font-bold font-dot uppercase">{remoteProfile?.name || "J-CHAT"}</h2>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${targetId ? 'bg-red-600' : 'bg-zinc-800 animate-pulse'}`} />
              <p className="text-[10px] tracking-[0.2em] text-zinc-500 uppercase font-mono">
                {targetId ? `LINKED` : 'SEARCHING...'}
              </p>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={onClear} className="bg-zinc-900 text-white border border-zinc-800 text-[9px] font-bold px-3 py-1 uppercase tracking-widest">CLEAR</button>
          <button onClick={onUnlink} className="bg-red-600 text-white text-[10px] font-bold px-3 py-1 uppercase tracking-widest">UNLINK</button>
        </div>
      </div>

      {/* MESSAGES */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex w-full ${msg.sender === 'me' ? 'justify-end' : 'justify-start'}`}>
            <div className={`flex max-w-[85vw] ${msg.sender === 'me' ? 'flex-row-reverse' : 'flex-row'} items-end gap-2`}>
              
              {/* AVATAR BUBBLE */}
              <div className="w-6 h-6 rounded-full bg-[#222] border border-[#333] overflow-hidden flex-shrink-0">
                 {msg.senderAvatar ? <img src={msg.senderAvatar} className="w-full h-full object-cover" /> : null}
              </div>

              <div className="flex flex-col">
                <span className={`text-[9px] text-[#666] mb-1 uppercase tracking-widest font-mono ${msg.sender === 'me' ? 'text-right' : 'text-left'}`}>
                  {msg.sender === 'me' ? 'YOU' : msg.senderName}
                </span>

                <div className="relative group">
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} onClick={(e) => { e.stopPropagation(); setSelectedMessageId(selectedMessageId === msg.id ? null : msg.id); }}
                    className={`relative p-4 cursor-pointer border transition-all duration-200 
                    ${msg.sender === 'me' ? 'bg-white text-black border-white rounded-[24px] rounded-tr-none' : 'bg-[#1A1A1A] text-white border-[#333] rounded-[24px] rounded-tl-none'} 
                    ${msg.type === 'reaction' ? 'bg-transparent border-none p-0' : ''} 
                    ${selectedMessageId === msg.id ? 'border-red-600' : ''}`}>
                    
                    {msg.type === 'text' && <p className="text-sm leading-relaxed font-dot">{msg.text}</p>}
                    {msg.type === 'reaction' && <div className="flex items-center gap-2 opacity-75"><div className="w-1 h-1 bg-red-600 rounded-full"></div><p className="text-xs uppercase tracking-widest font-bold font-dot">{msg.text}</p></div>}
                    {msg.type === 'audio' && <MinimalAudioPlayer src={msg.text} isSender={msg.sender === 'me'} />}
                    
                    {/* CLICK TO OPEN MEDIA */}
                    {msg.type === 'image' && (
                      <img 
                        src={msg.text} 
                        alt="content" 
                        onClick={(e) => { e.stopPropagation(); setFullScreenMedia({url: msg.text, type: 'image'}); }} 
                        className="w-full max-h-[300px] object-cover rounded-lg border border-[#333]" 
                      />
                    )}
                    
                    {msg.type === 'video' && (
                      <div className="relative" onClick={(e) => { e.stopPropagation(); setFullScreenMedia({url: msg.text, type: 'video'}); }}>
                         <video src={msg.text} className="w-full max-h-[300px] rounded-lg border border-[#333]" />
                         <div className="absolute inset-0 flex items-center justify-center bg-black/20"><span className="text-2xl">▶</span></div>
                      </div>
                    )}
                    
                  </motion.div>

                  <AnimatePresence>
                    {selectedMessageId === msg.id && (
                      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className={`absolute z-50 bottom-full mb-2 flex gap-1 p-2 bg-[#121212] border border-[#333] rounded-full shadow-lg overflow-x-auto max-w-[280px] scrollbar-hide ${msg.sender === 'me' ? 'right-0' : 'left-0'}`}>
                        {REACTIONS.map((emoji) => <button key={emoji} onClick={() => { onSendMessage(`REACTED: ${emoji}`, 'reaction'); setSelectedMessageId(null); }} className="w-8 h-8 flex items-center justify-center text-lg rounded-full hover:bg-[#262626]">{emoji}</button>)}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                
                {/* STATUS */}
                <div className={`flex items-center gap-1 mt-1 w-full ${msg.sender === 'me' ? 'justify-end' : 'justify-start'}`}>
                    <span className="text-[9px] text-[#444] font-bold tracking-widest font-mono">
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {msg.sender === 'me' && (
                        <span className="text-[9px] text-red-600 font-bold ml-1">
                            {msg.status === 'pending' ? '⏳' : '✓'}
                        </span>
                    )}
                </div>
              </div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* FULL SCREEN MEDIA MODAL */}
      <AnimatePresence>
        {fullScreenMedia && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black z-[999] flex items-center justify-center p-4" onClick={() => setFullScreenMedia(null)}>
            {fullScreenMedia.type === 'image' ? (
              <img src={fullScreenMedia.url} className="max-w-full max-h-full rounded-lg" />
            ) : (
              <video src={fullScreenMedia.url} controls autoPlay className="max-w-full max-h-full rounded-lg" />
            )}
            <button className="absolute top-8 right-8 text-red-600 text-xl font-bold border border-red-600 w-10 h-10 rounded-full flex items-center justify-center bg-black">✕</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* INPUT */}
      <div className="p-4 bg-black border-t border-[#262626]" onClick={(e) => e.stopPropagation()}>
        <AnimatePresence>{isMenuOpen && <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden mb-4"><button onClick={() => fileInputRef.current?.click()} className="w-full py-4 border border-dashed border-[#444] rounded-[12px] text-[#888] text-xs uppercase tracking-[0.2em] font-mono">[ + UPLOAD FILE ]</button></motion.div>}</AnimatePresence>
        
        <form onSubmit={handleSend} className="flex gap-3 items-center">
          <button type="button" onClick={() => setIsMenuOpen(!isMenuOpen)} className={`w-10 h-10 rounded-full border border-[#444] flex items-center justify-center text-[#888] hover:text-white ${isMenuOpen ? 'bg-red-600 border-red-600 text-white rotate-45' : ''}`}><span className="text-xl font-light mb-1">+</span></button>
          
          <div className="flex-1 bg-[#121212] rounded-full px-5 py-3 border border-[#333] focus-within:border-white transition-colors flex items-center justify-between">
            <input type="text" value={input} onChange={(e) => setInput(e.target.value)} placeholder={isRecording ? "RECORDING..." : "TYPE MESSAGE..."} className={`bg-transparent text-sm focus:outline-none tracking-wider font-dot w-full ${isRecording ? 'text-red-600 animate-pulse' : 'text-white'}`} disabled={isRecording} />
            
            {!input.trim() && (
               <button type="button" 
                  onMouseDown={startRecording} onMouseUp={() => { mediaRecorderRef.current?.stop(); setIsRecording(false); }}
                  onTouchStart={startRecording} onTouchEnd={() => { mediaRecorderRef.current?.stop(); setIsRecording(false); }}
                  className={`text-lg transition-all ${isRecording ? 'text-red-600 scale-125' : 'text-[#666]'}`}>
                  {isRecording ? '■' : '🎙️'}
               </button>
            )}
          </div>
          
          {input.trim() && <button type="submit" className="w-10 h-10 rounded-full bg-red-600 flex items-center justify-center active:scale-95"><span className="text-white text-xs font-bold">→</span></button>}
        </form>
        <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="image/*,video/*" className="hidden" />
      </div>
    </div>
  );
};