import { useState, useRef, useEffect } from 'react';

export interface Message {
  id: string;
  text: string;
  sender: 'me' | 'them';
  timestamp: number;
  type: 'text' | 'image' | 'video';
  reactions?: string[];
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
  const [lightboxMedia, setLightboxMedia] = useState<{url: string, type: 'image' | 'video'} | null>(null); // ✅ NEW: Lightbox State
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

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
      
      {/* ✅ NEW: MEDIA LIGHTBOX POPUP */}
      {lightboxMedia && (
        <div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4" onClick={() => setLightboxMedia(null)}>
          <button className="absolute top-4 right-4 text-white text-3xl font-bold">×</button>
          {lightboxMedia.type === 'image' ? (
            <img src={lightboxMedia.url} className="max-h-screen max-w-full object-contain" />
          ) : (
            <video src={lightboxMedia.url} controls autoPlay className="max-h-screen max-w-full" />
          )}
        </div>
      )}

      {/* OPTIONS MENU */}
      <div className="absolute top-2 right-2 z-20">
        <button onClick={() => setShowMenu(!showMenu)} className="text-xl px-3 py-1 text-gray-400">⋮</button>
        {showMenu && (
          <div className="absolute right-0 mt-2 w-48 bg-[#111] border border-[#333] shadow-xl rounded-lg z-30">
            <button onClick={onBlock} className="w-full text-left p-3 text-xs hover:bg-[#222] border-b border-[#333]">BLOCK {partnerId}</button>
            <button onClick={onDeleteChat} className="w-full text-left p-3 text-xs text-red-500 hover:bg-[#222]">DELETE CHAT</button>
          </div>
        )}
      </div>

      {/* MESSAGES */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6 pt-12" onClick={() => setActiveReactionId(null)}>
        {messages.map((msg) => (
          <div key={msg.id} className={`flex flex-col max-w-[85%] ${msg.sender === 'me' ? 'self-end items-end' : 'self-start items-start'}`}>
            
            <div 
              onClick={(e) => { e.stopPropagation(); setActiveReactionId(msg.id); }}
              className={`relative px-4 py-3 rounded-2xl text-sm break-words border cursor-pointer ${
                msg.sender === 'me' ? 'bg-white text-black border-white rounded-br-none' : 'bg-[#111] text-gray-200 border-[#333] rounded-bl-none'
              }`}
            >
              {msg.type === 'text' && msg.text}
              
              {/* ✅ NEW: Click to open Lightbox */}
              {msg.type === 'image' && (
                <img 
                  src={msg.text} 
                  className="max-w-full rounded-lg hover:opacity-90 transition-opacity" 
                  onClick={(e) => { e.stopPropagation(); setLightboxMedia({url: msg.text, type: 'image'}); }}
                />
              )}
              {msg.type === 'video' && (
                <video 
                  src={msg.text} 
                  className="max-w-full rounded-lg" 
                  onClick={(e) => { e.stopPropagation(); setLightboxMedia({url: msg.text, type: 'video'}); }}
                />
              )}
              
              {/* REACTION POPUP */}
              {activeReactionId === msg.id && (
                <div className="absolute -top-10 left-0 bg-[#222] p-1 rounded-full flex gap-1 shadow-lg border border-[#333] z-10">
                  {['👍','❤️','😂','🔥'].map(emoji => (
                    <button key={emoji} onClick={() => onReact(msg.id, emoji)} className="p-1 hover:scale-125 transition-transform">{emoji}</button>
                  ))}
                </div>
              )}
            </div>

            {msg.reactions && msg.reactions.length > 0 && (
               <div className="flex gap-1 mt-1 text-[10px] bg-[#111] border border-[#333] px-1 rounded-full">
                 {msg.reactions.map((r, i) => <span key={i}>{r}</span>)}
               </div>
            )}
            <span className="text-[10px] text-gray-600 mt-1">{new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* INPUT */}
      <div className="p-4 bg-black border-t border-[#333] flex items-center gap-2">
        <input type="file" ref={fileInputRef} hidden onChange={handleFileUpload} accept="image/*,video/*" />
        <button onClick={() => fileInputRef.current?.click()} className="p-2 text-gray-400 text-xl hover:text-white">+</button>
        <input
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onSendMessage(inputText, 'text')}
          placeholder="MESSAGE..."
          className="flex-1 bg-[#111] border border-[#333] rounded-full px-4 py-2 text-white outline-none focus:border-white"
        />
        <button onClick={() => onSendMessage(inputText, 'text')} className="bg-white text-black w-8 h-8 rounded-full flex items-center justify-center font-bold">↑</button>
      </div>
    </div>
  );
};
