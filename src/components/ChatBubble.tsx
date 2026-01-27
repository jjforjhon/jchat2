import { motion } from 'framer-motion';
import { Message } from '../hooks/usePeer';

interface ChatBubbleProps {
  msg: Message;
}

export const ChatBubble = ({ msg }: ChatBubbleProps) => {
  const isMe = msg.sender === 'me';

  // ✅ FIX 3: Changed 'msg.content' to 'msg.text' to match the new system
  return (
    <div className={`flex w-full mb-4 ${isMe ? 'justify-end' : 'justify-start'}`}>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={`max-w-[75%] p-3 rounded-lg border ${
          isMe 
            ? 'bg-white text-black border-white' 
            : 'bg-black text-white border-nothing-darkgray'
        }`}
      >
        {/* IMAGES */}
        {msg.type === 'image' && (
          <img src={msg.text} alt="attachment" className="rounded-md max-w-full mb-2" />
        )}

        {/* VIDEOS */}
        {msg.type === 'video' && (
          <video controls src={msg.text} className="rounded-md max-w-full mb-2" />
        )}

        {/* TEXT */}
        {msg.type === 'text' && (
          <p className="text-sm font-mono break-words">{msg.text}</p>
        )}
        
        <span className="text-[10px] opacity-50 block mt-1 text-right">
          {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </motion.div>
    </div>
  );
};