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

  // LOAD SESSION
  useEffect(() => {
    const savedUser = localStorage.getItem('jchat_user');
    const savedBlocklist = localStorage.getItem('jchat_blocked');
    if (savedUser) setUser(JSON.parse(savedUser));
    if (savedBlocklist) setBlockedUsers(JSON.parse(savedBlocklist));
    
    // Request Notification Permission
    if ("Notification" in window) {
      Notification.requestPermission();
    }
  }, []);

  // SYNC LOOP & NOTIFICATIONS
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
            
            // Trigger Notification directly (No variable needed)
            if (msg.fromUser !== user.id) {
               if (document.hidden && Notification.permission === "granted") {
                 new Notification(`New message from ${partner}`);
               }
            }
          }
        });
        setConversations(newConvos);

      } catch (e) { console.error(e); }
    }, 3000);

    return () => clearInterval(interval);
  }, [user, blockedUsers]);

  // ACTIONS
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
    // Optimistic Update
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

  // PROFILE EDIT MODAL
  if (showProfileEdit) {
    return (
      <div className="fixed inset-0 bg-black z-50 flex flex-col items-center justify-center p-6 text-white font-mono">
        <h2 className="text-2xl mb-8 tracking-widest">EDIT PROFILE</h2>
        
        <div className="relative w-32 h-32 rounded-full border-2 border-dashed border-gray-600 flex items-center justify-center mb-6 overflow-hidden">
          {user.avatar ? (
            <img src={user.avatar} className="w-full h-full object-cover" />
          ) : (
            <span className="text-4xl text-gray-700">+</span>
          )}
          <input type="file" ref={fileInputRef} hidden onChange={handleAvatarUpload} accept="image/*" />
          <div 
            onClick={() => fileInputRef.current?.click()} 
            className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 hover:opacity-100 cursor-pointer transition-opacity"
          >
            CHANGE
          </div>
        </div>

        <div className="text-sm text-gray-500 mb-8">USER ID: {user.id}</div>
        <button onClick={() => setShowProfileEdit(false)} className="border border-white px-8 py-3 rounded hover:bg-white hover:text-black">DONE</button>
      </div>
    );
  }

  // CONTACT LIST
  if (!activeContactId) {
    return (
      <div className="fixed inset-0 h-[100dvh] w-full bg-black text-white font-mono flex flex-col p-6 overflow-hidden">
        {/* HEADER */}
        <div className="flex justify-between items-center border-b border-gray-800 pb-4 mb-4">
          <div>
            <h1 className="text-xl tracking-widest">CHATS</h1>
            <div className="text-xs text-gray-600 mt-1">ID: {user.id}</div>
          </div>
          {/* Profile Avatar Button */}
          <div onClick={() => setShowProfileEdit(true)} className="w-10 h-10 rounded-full bg-[#222] border border-[#333] overflow-hidden cursor-pointer">
             {user.avatar ? <img src={user.avatar} className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center text-gray-500">?</div>}
          </div>
        </div>

        {/* INPUT */}
        <input 
          placeholder="NEW CHAT ID..." 
          className="bg-[#111] p-4 rounded mb-6 text-white border border-[#333] uppercase outline-none focus:border-white"
          onKeyDown={(e) => e.key === 'Enter' && setActiveContactId(e.currentTarget.value.toUpperCase())}
        />

        {/* LIST */}
        <div className="flex-1 overflow-y-auto space-y-2">
          {Object.keys(conversations).map(cId => (
            <div key={cId} onClick={() => setActiveContactId(cId)} className="p-4 bg-[#111] border border-[#333] rounded hover:bg-[#222] cursor-pointer flex justify-between items-center">
              <span className="font-bold">{cId}</span>
              <span className="text-xs text-gray-600">
                  {conversations[cId].length > 0 ? new Date(conversations[cId][conversations[cId].length-1].timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : ''}
              </span>
            </div>
          ))}
        </div>

        {/* LOGOUT BUTTON */}
        <button onClick={handleLogout} className="mt-4 w-full py-4 text-gray-400 text-xs tracking-widest border border-gray-800 bg-[#111] rounded hover:bg-[#222]">
           LOGOUT
        </button>
      </div>
    );
  }

  // CHAT SCREEN
  return (
    <div className="fixed inset-0 h-[100dvh] w-full flex flex-col bg-black">
      <div className="p-4 border-b border-[#333] flex justify-between items-center pt-safe-top">
        <button onClick={() => setActiveContactId(null)} className="text-sm px-3 py-2 border border-[#333] rounded bg-[#111]">← BACK</button>
        <span className="font-bold tracking-widest">{activeContactId}</span>
        <div className="w-10"></div>
      </div>
      <div className="flex-1 overflow-hidden relative">
        <ChatScreen 
          messages={conversations[activeContactId] || []}
          onSendMessage={handleSendMessage}
          onReact={(mId, emoji) => api.react(mId, emoji)}
          onBlock={() => {
              if(confirm('Block user?')) {
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
