import { useState, useRef, useEffect } from 'react';

// Shared definition matches what App.tsx sends
export interface Message {
  id: string;
  text: string;
  sender: 'me' | 'them';
  timestamp: number;
  isOwn: boolean;
  type?: 'text' | 'image';
  status?: 'sent' | 'delivered' | 'read';
}

interface ChatProps {
  messages: Message[];
  onSendMessage: (text: string) => void;

  // ✅ THE FIX: All these are now OPTIONAL (?)
  // This allows App.tsx to ignore them without causing build errors.
  onClear?: () => void;
  onUnlink?: () => void;
  onUpdateProfile?: () => void;
  onRetryConnection?: () => void;
  isConnected?: boolean;
  peerId?: string;
  isHost?: boolean;
  currentUserId?: string; 
  chatPartnerId?: string; 
}

export const ChatScreen = ({ 
  messages, 
  onSendMessage,
  onClear,
  onUnlink,
  chatPartnerId 
}: ChatProps) => {
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    if (!inputText.trim()) return;
    onSendMessage(inputText);
    setInputText('');
  };

  return (
    <div className="flex flex-col h-full bg-black text-white font-mono relative">
      
      {/* HEADER ACTIONS (Only show if the prop was actually passed) */}
      {(onClear || onUnlink) && (
        <div className="absolute top-0 right-0 p-2 z-10 flex gap-2">
          {onClear && (
            <button onClick={onClear} className="text-[10px] bg-red-900/20 text-red-500 px-2 py-1 rounded border border-red-900/50 hover:bg-red-900/40">
              CLEAR
            </button>
          )}
          {onUnlink && (
            <button onClick={onUnlink} className="text-[10px] bg-gray-800 text-gray-400 px-2 py-1 rounded border border-gray-700 hover:bg-gray-700">
              UNLINK
            </button>
          )}
        </div>
      )}

      {/* MESSAGES AREA */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 pt-10">
        {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-gray-600 space-y-2 opacity-50">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"/>
                <span className="text-xs tracking-widest">SECURE CHANNEL ESTABLISHED</span>
            </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col max-w-[85%] ${
              msg.sender === 'me' ? 'self-end items-end' : 'self-start items-start'
            }`}
          >
            <div
              className={`px-4 py-3 rounded-2xl text-sm break-words border ${
                msg.sender === 'me'
                  ? 'bg-white text-black border-white rounded-br-none'
                  : 'bg-[#111] text-gray-200 border-[#333] rounded-bl-none'
              }`}
            >
              {msg.text}
            </div>
            <span className="text-[10px] text-gray-600 mt-1 uppercase tracking-wider">
              {new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
              {msg.sender === 'me' && msg.status && ` • ${msg.status}`}
            </span>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* INPUT AREA */}
      <div className="p-4 bg-black border-t border-[#333]">
        <div className="flex items-center gap-2 bg-[#111] rounded-full px-4 py-2 border border-[#333] focus-within:border-white transition-colors">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder={`MESSAGE ${chatPartnerId || '...'}`}
            className="flex-1 bg-transparent border-none outline-none text-white placeholder-gray-600 text-sm h-10"
          />
          <button
            onClick={handleSend}
            disabled={!inputText.trim()}
            className="text-black bg-white rounded-full w-8 h-8 flex items-center justify-center font-bold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-200 transition-colors"
          >
            ↑
          </button>
        </div>
      </div>
    </div>
  );
};
