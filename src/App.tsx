import { useState, useEffect, useRef } from 'react';
import { LoginScreen } from './components/LoginScreen';
import { ChatScreen, Message } from './components/ChatScreen';
import { api } from './api/server';

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [conversations, setConversations] = useState<Record<string, Message[]>>({});
  const [activeContactId, setActiveContactId] = useState<string | null>(null);
  const [blockedUsers, setBlockedUsers] = useState<string[]>([]);
  const [showProfileEdit, setShowProfileEdit] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const savedUser = localStorage.getItem('jchat_user');
    const savedBlocklist = localStorage.getItem('jchat_blocked');
    if (savedUser) setUser(JSON.parse(savedUser));
    if (savedBlocklist) setBlockedUsers(JSON.parse(savedBlocklist));
    if ("Notification" in window) Notification.requestPermission();
  }, []);

  useEffect(() => {
    if (!user) return;
    let lastKnownTimestamp = Date.now(); 

    const interval = setInterval(async () => {
      try {
        const history = await api.sync(user.id, lastKnownTimestamp - 10000); 
        const newConvos = { ...conversations };

        history.forEach((msg: any) => {
          const partner = msg.fromUser === user.id ? msg.toUser : msg.fromUser;
          if (blockedUsers.includes(partner)) return;

          if (!newConvos[partner]) newConvos[partner] = [];
          const exists = newConvos[partner].some((m: Message) => m.id === msg.id);
          if (!exists) {
            newConvos[partner].push({
              id: msg.id,
              text: msg.payload,
              sender: msg.fromUser === user.id ? 'me' : 'them',
              timestamp: msg.timestamp,
              type: msg.type,
              reactions: msg.reactions
            });
            if (msg.timestamp > lastKnownTimestamp) lastKnownTimestamp = msg.timestamp;
            if (msg.fromUser !== user.id && document.hidden && Notification.permission === "granted") {
                 new Notification(`New message from ${partner}`);
            }
          }
        });
        setConversations(newConvos);
      } catch (e) { console.error(e); }
    }, 3000);
    return () => clearInterval(interval);
  }, [user, blockedUsers]);

  const handleSendMessage = async (content: string, type: 'text' | 'image' | 'video') => {
    if (!activeContactId) return;
    const msg = {
      id: crypto.randomUUID(),
      fromUser: user.id,
      toUser: activeContactId,
      payload: content,
      type: type,
      timestamp: Date.now()
    };
    await api.send(msg);
    setConversations(prev => {
        const next = {...prev};
        if(!next[activeContactId]) next[activeContactId] = [];
        next[activeContactId].push({...msg, sender: 'me'} as any);
        return next;
    });
  };

  const handleProfileUpdate = async (avatar: string) => {
    if(!user) return;
    await api.updateProfile(user.id, user.password, avatar, user.name || user.id);
    const newUser = { ...user, avatar };
    setUser(newUser);
    localStorage.setItem('jchat_user', JSON.stringify(newUser));
    setShowProfileEdit(false);
  };

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => handleProfileUpdate(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('jchat_user');
    setUser(null);
    setConversations({});
    setActiveContactId(null);
  };

  if (!user) return <LoginScreen onLogin={(u) => { setUser(u); localStorage.setItem('jchat_user', JSON.stringify(u)); }} />;

  if (showProfileEdit) {
    return (
      <div className="fixed inset-0 bg-black z-50 flex flex-col items-center justify-center p-6 text-white font-mono animate-fade-in">
        <h2 className="text-3xl mb-12 tracking-[0.2em] font-light border-b border-white pb-2">IDENTITY</h2>
        
        <div className="relative w-40 h-40 rounded-full border border-dashed border-gray-500 flex items-center justify-center mb-8 overflow-hidden group">
          {user.avatar ? (
            <img src={user.avatar} className="w-full h-full object-cover" />
          ) : (
            <span className="text-5xl text-gray-800 group-hover:text-white transition-colors">+</span>
          )}
          <input type="file" ref={fileInputRef} hidden onChange={handleAvatarUpload} accept="image/*" />
          <div 
            onClick={() => fileInputRef.current?.click()} 
            className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity tracking-widest text-xs"
          >
            UPLOAD
          </div>
        </div>

        <div className="text-xs text-gray-500 mb-12 tracking-widest">ID: {user.id}</div>
        <button onClick={() => setShowProfileEdit(false)} className="border border-white px-10 py-3 rounded-full hover:bg-white hover:text-black transition-all tracking-widest text-xs">SAVE & CLOSE</button>
      </div>
    );
  }

  // CONTACT LIST UI POLISH
  if (!activeContactId) {
    return (
      <div className="fixed inset-0 h-[100dvh] w-full bg-black text-white font-mono flex flex-col p-6 overflow-hidden">
        {/* HEADER */}
        <div className="flex justify-between items-center border-b border-[#333] pb-6 mb-6 pt-safe-top">
          <div>
            <h1 className="text-2xl tracking-[0.2em] font-light">CHATS</h1>
            <div className="text-[10px] text-gray-600 mt-2 tracking-wider">LOGGED IN AS: <span className="text-white">{user.id}</span></div>
          </div>
          <div onClick={() => setShowProfileEdit(true)} className="w-12 h-12 rounded-full bg-[#111] border border-[#333] overflow-hidden cursor-pointer hover:border-white transition-colors">
             {user.avatar ? <img src={user.avatar} className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center text-gray-700 text-xs">IMG</div>}
          </div>
        </div>

        {/* INPUT */}
        <input 
          placeholder="SEARCH OR START CHAT..." 
          className="bg-[#111] p-5 rounded-xl mb-8 text-white border border-[#333] uppercase outline-none focus:border-white transition-colors text-xs tracking-widest placeholder-gray-700"
          onKeyDown={(e) => e.key === 'Enter' && setActiveContactId(e.currentTarget.value.toUpperCase())}
        />

        {/* LIST */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-2">
          {Object.keys(conversations).map(cId => (
            <div key={cId} onClick={() => setActiveContactId(cId)} className="group p-5 bg-black border border-[#222] rounded-xl hover:bg-[#111] hover:border-white cursor-pointer flex justify-between items-center transition-all active:scale-[0.98]">
              <div className="flex flex-col">
                 <span className="font-bold tracking-wider group-hover:text-white transition-colors">{cId}</span>
                 <span className="text-[10px] text-gray-600 mt-1">ENCRYPTED CHANNEL</span>
              </div>
              <span className="text-[10px] text-gray-600 font-mono">
                  {conversations[cId].length > 0 ? new Date(conversations[cId][conversations[cId].length-1].timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : 'NEW'}
              </span>
            </div>
          ))}
          {Object.keys(conversations).length === 0 && (
             <div className="text-center text-gray-800 mt-20 text-xs tracking-widest border border-dashed border-gray-900 p-10 rounded-xl">
                NO ACTIVE TRANSMISSIONS
             </div>
          )}
        </div>

        {/* FOOTER */}
        <div className="pt-6 border-t border-[#222] mt-4 pb-safe-bottom">
           <button onClick={handleLogout} className="w-full py-4 text-red-900 text-[10px] tracking-[0.3em] border border-[#222] bg-black rounded-xl hover:bg-red-900/10 hover:text-red-500 hover:border-red-900/50 transition-all">
              TERMINATE SESSION
           </button>
        </div>
      </div>
    );
  }

  // CHAT SCREEN
  return (
    <div className="fixed inset-0 h-[100dvh] w-full flex flex-col bg-black">
      <div className="p-4 border-b border-[#333] flex justify-between items-center pt-safe-top bg-black z-10">
        <button onClick={() => setActiveContactId(null)} className="text-xs tracking-widest px-4 py-2 border border-[#333] rounded-full hover:bg-white hover:text-black transition-colors">← BACK</button>
        <span className="font-bold tracking-[0.2em] text-sm">{activeContactId}</span>
        <div className="w-12"></div> {/* Spacer */}
      </div>
      <div className="flex-1 overflow-hidden relative">
        <ChatScreen 
          messages={conversations[activeContactId] || []}
          onSendMessage={handleSendMessage}
          onReact={(mId, emoji) => api.react(mId, emoji)}
          onBlock={() => {
              if(confirm('BLOCK THIS USER?')) {
                  setBlockedUsers([...blockedUsers, activeContactId]);
                  localStorage.setItem('jchat_blocked', JSON.stringify([...blockedUsers, activeContactId]));
                  setActiveContactId(null);
              }
          }}
          onDeleteChat={() => { delete conversations[activeContactId]; setActiveContactId(null); }}
          partnerId={activeContactId}
        />
      </div>
    </div>
  );
}
