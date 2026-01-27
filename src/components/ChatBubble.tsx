import { Download } from 'lucide-react';
import { Message } from '../hooks/usePeer';

export const ChatBubble = ({ msg }: { msg: Message }) => {
  const isMe = msg.sender === 'me';

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = msg.content;
    const ext = msg.type === 'video' ? 'webm' : 'png'; 
    link.download = `jchat_${Date.now()}.${ext}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className={`flex ${isMe ? 'justify-end' : 'justify-start'} mb-4`}>
      <div className={`
        max-w-[85%] rounded-2xl overflow-hidden relative group
        ${isMe ? 'bg-white text-black rounded-tr-sm' : 'bg-black border border-nothing-darkgray text-white rounded-tl-sm'}
      `}>
        
        {msg.type === 'text' && (
          <p className="p-3 font-mono text-sm break-words">{msg.content}</p>
        )}

        {msg.type === 'image' && (
          <div className="relative">
            <img src={msg.content} alt="secure-img" className="max-h-64 object-cover" />
            <button 
              onClick={handleDownload}
              className="absolute bottom-2 right-2 p-2 bg-black/50 backdrop-blur-md rounded-full text-white hover:bg-white hover:text-black transition-colors"
            >
              <Download size={16} />
            </button>
          </div>
        )}

        {msg.type === 'video' && (
          <div className="relative">
            <video src={msg.content} controls className="max-h-64 bg-black" />
            <button 
              onClick={handleDownload}
              className="absolute top-2 right-2 p-2 bg-black/50 backdrop-blur-md rounded-full text-white hover:bg-white hover:text-black transition-colors z-10"
            >
              <Download size={16} />
            </button>
          </div>
        )}

        <div className={`text-[9px] px-3 pb-1 text-right ${isMe ? 'text-gray-400' : 'text-nothing-gray'}`}>
          {new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
        </div>
      </div>
    </div>
  );
};
