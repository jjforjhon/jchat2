import { motion } from 'framer-motion';
import { Message } from '../hooks/usePeer';

interface ChatBubbleProps {
  msg: Message;
}

export const ChatBubble = ({ msg }: ChatBubbleProps) => {
  const isMe = msg.sender === 'me';

  return (
    <div className={`flex w-full mb-4 ${isMe ? 'justify-end' : 'justify-start'}`}>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className={`max-w-[75%] p-3 rounded-lg border ${
          isMe
            ? 'bg-white text-black border-white'
            : 'bg-black text-white border-nothing-darkgray'
        }`}
      >
        {msg.type === 'image' && (
          <img src={msg.text} className="rounded mb-2 max-w-full" />
        )}

        {msg.type === 'video' && (
          <video controls src={msg.text} className="rounded mb-2 max-w-full" />
        )}

        {msg.type === 'text' && (
          <p className="text-sm font-mono break-words">{msg.text}</p>
        )}

        {msg.type === 'NUKE_COMMAND' && (
          <p className="text-xs text-red-500 italic">⚠ System action</p>
        )}

        <span className="text-[10px] opacity-50 block text-right mt-1">
          {new Date(msg.timestamp).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit'
          })}
        </span>
      </motion.div>
    </div>
  );
};
