import { useState, useRef, useEffect } from 'react';

export interface Message {
  id: string;
  text: string;
  sender: 'me' | 'them';
  timestamp: number;
  type: 'text' | 'image' | 'video';
  reactions?: string[];
  status?: 'sent' | 'delivered' | 'read';
}

interface ChatProps {
  messages: Message[];
  onSendMessage: (text: string, type: 'text' | 'image' | 'video') => void;
  onReact: (msgId: string, emoji: string) => void;
  onBlock: () => void;
  onDeleteChat: () => void;
  partnerId: string;
}

export const ChatScreen = ({ messages, onSendMessage, onReact, onBlock, onDeleteChat, partnerId }: ChatProps) => {
  const [inputText, setInputText] = useState('');
  const [showMenu, setShowMenu] = useState(false);
  const [activeReactionId, setActiveReactionId] = useState<string | null>(null);
  const [lightboxMedia, setLightboxMedia] = useState<{url: string, type: 'image' | 'video'} | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => { scrollToBottom(); }, [messages]);

  // ✅ FIX: Clear input after sending
  const handleSendText = () => {
    if (!inputText.trim()) return;
    onSendMessage(inputText, 'text');
    setInputText(''); 
    setTimeout(scrollToBottom, 100); 
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const type = file.type.startsWith('video') ? 'video' : 'image';
      onSendMessage(reader.result as string, type);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="flex flex-col h-full bg-black text-white font-mono relative">
      
      {lightboxMedia && (
        <div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4" onClick={() => setLightboxMedia(null)}>
          <button className="absolute top-8 right-8 text-white text-4xl font-light hover:text-gray-400">×</button>
          {lightboxMedia.type === 'image' ? (
            <img src={lightboxMedia.url} className="max-h-screen max-w-full object-contain border border-[#333]" />
          ) : (
            <video src={lightboxMedia.url} controls autoPlay className="max-h-screen max-w-full border border-[#333]" />
          )}
        </div>
      )}

      <div className="absolute top-4 right-4 z-20">
        <button onClick={() => setShowMenu(!showMenu)} className="text-2xl px-2 text-gray-400 hover:text-white transition-colors">⋮</button>
        {showMenu && (
          <div className="absolute right-0 mt-2 w-48 bg-black border border-white shadow-xl z-30">
            <button onClick={onBlock} className="w-full text-left p-4 text-xs tracking-widest hover:bg-white hover:text-black border-b border-[#333] transition-colors uppercase">
              BLOCK {partnerId}
            </button>
            <button onClick={onDeleteChat} className="w-full text-left p-4 text-xs tracking-widest text-red-500 hover:bg-red-900/20 transition-colors">DELETE CHAT</button>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6 pt-16" onClick={() => setActiveReactionId(null)}>
        {messages.map((msg) => (
          <div key={msg.id} className={`flex flex-col max-w-[85%] ${msg.sender === 'me' ? 'self-end items-end' : 'self-start items-start'}`}>
            
            <div 
              onClick={(e) => { e.stopPropagation(); setActiveReactionId(msg.id); }}
              className={`relative px-4 py-3 text-sm break-words border cursor-pointer transition-all ${
                msg.sender === 'me' 
                  ? 'bg-white text-black border-white rounded-t-xl rounded-bl-xl' 
                  : 'bg-[#111] text-gray-200 border-[#333] rounded-t-xl rounded-br-xl'
              }`}
            >
              {msg.type === 'text' && msg.text}
              
              {msg.type === 'image' && (
                <img 
                  src={msg.text} 
                  onLoad={scrollToBottom}
                  className="max-w-full rounded-lg hover:opacity-80 transition-opacity" 
                  onClick={(e) => { e.stopPropagation(); setLightboxMedia({url: msg.text, type: 'image'}); }}
                />
              )}
              {msg.type === 'video' && (
                <video 
                  src={msg.text} 
                  className="max-w-full rounded-lg border border-gray-800" 
                  onClick={(e) => { e.stopPropagation(); setLightboxMedia({url: msg.text, type: 'video'}); }}
                />
              )}
              
              {activeReactionId === msg.id && (
                <div className="absolute -top-12 left-0 bg-black border border-white p-2 flex gap-2 shadow-2xl z-10">
                  {['👍','❤️','💀','🔥'].map(emoji => (
                    <button key={emoji} onClick={() => onReact(msg.id, emoji)} className="hover:scale-125 transition-transform text-lg">{emoji}</button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 mt-1">
               {msg.reactions && msg.reactions.length > 0 && (
                 <div className="flex gap-1 text-[10px] bg-[#222] border border-[#333] px-2 py-0.5 rounded-full">
                   {msg.reactions.map((r, i) => <span key={i}>{r}</span>)}
                 </div>
               )}
               <span className="text-[9px] text-gray-500 tracking-wider">
                 {new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                 {msg.sender === 'me' && msg.status && ` • ${msg.status.toUpperCase()}`}
               </span>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 bg-black border-t border-[#333] flex items-center gap-3">
        <input type="file" ref={fileInputRef} hidden onChange={handleFileUpload} accept="image/*,video/*" />
        
        <button 
          onClick={() => fileInputRef.current?.click()} 
          className="w-10 h-10 rounded-full border border-[#333] text-gray-400 text-xl flex items-center justify-center hover:bg-white hover:text-black transition-colors"
        >
          +
        </button>
        
        <input
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSendText()}
          placeholder={`MESSAGE ${partnerId}...`} 
          className="flex-1 bg-[#111] border border-[#333] rounded-full px-5 py-3 text-white outline-none focus:border-white focus:bg-black transition-colors placeholder-gray-600 text-sm tracking-wider"
        />
        
        <button 
          onClick={handleSendText} 
          disabled={!inputText.trim()}
          className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center font-bold hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:scale-100"
        >
          ↑
        </button>
      </div>
    </div>
  );
};
