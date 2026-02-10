import { useState, useEffect } from 'react';
import { LoginScreen } from './components/LoginScreen';
import { ChatScreen, Message } from './components/ChatScreen';
import { api } from './api/server';

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [conversations, setConversations] = useState<Record<string, Message[]>>({});
  const [activeContactId, setActiveContactId] = useState<string | null>(null);
  const [blockedUsers, setBlockedUsers] = useState<string[]>([]);

  // LOAD SESSION
  useEffect(() => {
    const savedUser = localStorage.getItem('jchat_user');
    const savedBlocklist = localStorage.getItem('jchat_blocked');
    if (savedUser) setUser(JSON.parse(savedUser));
    if (savedBlocklist) setBlockedUsers(JSON.parse(savedBlocklist));
  }, []);

  // SYNC LOOP
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(async () => {
      try {
        const history = await api.sync(user.id); // Fetch all history
        
        const newConvos: any = {};
        history.forEach((msg: any) => {
          const partner = msg.fromUser === user.id ? msg.toUser : msg.fromUser;
          if (blockedUsers.includes(partner)) return; // BLOCKING LOGIC

          if (!newConvos[partner]) newConvos[partner] = [];
          newConvos[partner].push({
            id: msg.id,
            text: msg.payload,
            sender: msg.fromUser === user.id ? 'me' : 'them',
            timestamp: msg.timestamp,
            type: msg.type,
            reactions: msg.reactions
          });
        });
        setConversations(newConvos);
      } catch (e) { console.error(e); }
    }, 2000);
    return () => clearInterval(interval);
  }, [user, blockedUsers]);

  const handleSendMessage = async (content: string, type: 'text' | 'image' | 'video') => {
    if (!content.trim() || !activeContactId) return;
    const msg = {
      id: crypto.randomUUID(),
      fromUser: user.id,
      toUser: activeContactId,
      payload: content,
      type: type,
      timestamp: Date.now()
    };
    await api.send(msg);
    // Optimistic update handled by next sync or manually if preferred
  };

  const handleBlock = () => {
    if(!activeContactId) return;
    if(confirm(`BLOCK ${activeContactId}?`)) {
       const newList = [...blockedUsers, activeContactId];
       setBlockedUsers(newList);
       localStorage.setItem('jchat_blocked', JSON.stringify(newList));
       setActiveContactId(null);
    }
  };

  const handleDeleteAccount = async () => {
    if(confirm("PERMANENTLY DELETE ACCOUNT?")) {
      await api.deleteAccount(user.id, user.password);
      localStorage.clear();
      setUser(null);
    }
  };

  if (!user) return <LoginScreen onLogin={(u) => { setUser(u); localStorage.setItem('jchat_user', JSON.stringify(u)); }} />;

  if (!activeContactId) {
    return (
      <div className="fixed inset-0 bg-black text-white font-mono flex flex-col p-6">
        <h1 className="text-xl tracking-widest border-b border-gray-800 pb-4 mb-4">CHATS // {user.id}</h1>
        <input 
          placeholder="NEW CHAT ID..." 
          className="bg-[#111] p-4 rounded mb-6 text-white border border-[#333] uppercase"
          onKeyDown={(e) => e.key === 'Enter' && setActiveContactId(e.currentTarget.value.toUpperCase())}
        />
        <div className="flex-1 overflow-y-auto space-y-2">
          {Object.keys(conversations).map(cId => (
            <div key={cId} onClick={() => setActiveContactId(cId)} className="p-4 bg-[#111] border border-[#333] rounded hover:bg-[#222]">
              <span className="font-bold">{cId}</span>
            </div>
          ))}
        </div>
        <button onClick={handleDeleteAccount} className="mt-4 text-red-500 text-xs border border-red-900 p-3 rounded">DELETE ACCOUNT</button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex flex-col bg-black">
      <div className="p-4 border-b border-[#333] flex justify-between items-center">
        <button onClick={() => setActiveContactId(null)}>← BACK</button>
        <span className="font-bold">{activeContactId}</span>
        <div className="w-8" />
      </div>
      <div className="flex-1 overflow-hidden relative">
        <ChatScreen 
          messages={conversations[activeContactId] || []}
          onSendMessage={handleSendMessage}
          onReact={(mId, emoji) => api.react(mId, emoji)}
          onBlock={handleBlock}
          onDeleteChat={() => { delete conversations[activeContactId]; setActiveContactId(null); }}
          partnerId={activeContactId}
        />
      </div>
    </div>
  );
}
