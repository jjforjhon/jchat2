import { useState, useEffect } from 'react'; // Removed useCallback
import { LoginScreen } from './components/LoginScreen';
import { ChatScreen } from './components/ChatScreen';
import { api } from './api/server';

// DEFINITIONS
interface User {
  id: string;
  name: string;
  avatar: string;
  privateKey: string;
}

// FIXED: Updated Message interface to match what ChatScreen expects
interface Message {
  id: string;
  text: string;
  sender: string;      // Changed from 'senderId' to 'sender'
  timestamp: number;
  isOwn: boolean;
  type: 'text';        // Added 'type'
  status: 'sent' | 'delivered' | 'read'; // Added 'status'
}

type ConversationMap = Record<string, Message[]>; 

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [conversations, setConversations] = useState<ConversationMap>({});
  const [activeContactId, setActiveContactId] = useState<string | null>(null);

  // 1. LOAD DATA ON STARTUP
  useEffect(() => {
    const savedUser = localStorage.getItem('jchat_user');
    const savedChats = localStorage.getItem('jchat_conversations');
    
    if (savedUser) setUser(JSON.parse(savedUser));
    if (savedChats) setConversations(JSON.parse(savedChats));
  }, []);

  // 2. SAVE DATA WHEN CHANGED
  useEffect(() => {
    if (Object.keys(conversations).length > 0) {
      localStorage.setItem('jchat_conversations', JSON.stringify(conversations));
    }
  }, [conversations]);

  // 3. POLLING FOR NEW MESSAGES
  useEffect(() => {
    if (!user) return;
    
    const interval = setInterval(async () => {
      try {
        const newMessages = await api.sync(user.id);
        if (newMessages.length === 0) return;

        setConversations(prev => {
          const next = { ...prev };
          
          newMessages.forEach((msg: any) => {
             // In a real app, 'msg.fromUser' should come from server. 
             // If server doesn't send it, we temporarily use a fallback.
             const otherPersonId = msg.fromUser || "UNKNOWN"; 
             
             if (!next[otherPersonId]) next[otherPersonId] = [];
             
             const exists = next[otherPersonId].some(m => m.id === msg.id);
             if (!exists) {
               next[otherPersonId].push({
                 id: msg.id,
                 text: msg.payload, 
                 sender: otherPersonId, // Fixed: matches interface
                 timestamp: msg.timestamp,
                 isOwn: false,
                 type: 'text',          // Fixed: default type
                 status: 'delivered'    // Fixed: default status
               });
             }
          });
          return next;
        });

        // Acknowledge messages
        const idsToDelete = newMessages.map((m: any) => m.id);
        if (idsToDelete.length > 0) {
            await api.ack(user.id, idsToDelete);
        }

      } catch (err) {
        console.error("Sync error:", err);
      }
    }, 3000); 

    return () => clearInterval(interval);
  }, [user]);

  // 4. SEND MESSAGE FUNCTION
  const handleSendMessage = async (text: string) => {
    if (!user || !activeContactId) return;

    const newMessage: Message = {
      id: crypto.randomUUID(),
      text,
      sender: user.id,      // Fixed
      timestamp: Date.now(),
      isOwn: true,
      type: 'text',         // Fixed
      status: 'sent'        // Fixed
    };

    // Optimistic Update
    setConversations(prev => {
      const next = { ...prev };
      if (!next[activeContactId]) next[activeContactId] = [];
      next[activeContactId].push(newMessage);
      return next;
    });

    // Send to Server
    await api.send(activeContactId, {
      id: newMessage.id,
      payload: text, 
      fromUser: user.id,
      timestamp: newMessage.timestamp
    });
  };

  // 5. LOGIN HANDLER
  const handleLogin = (userData: User) => {
    setUser(userData);
    localStorage.setItem('jchat_user', JSON.stringify(userData));
  };

  // 6. LOGOUT
  const handleLogout = () => {
    setUser(null);
    setConversations({});
    setActiveContactId(null);
    localStorage.removeItem('jchat_user');
    localStorage.removeItem('jchat_conversations');
  };

  // RENDER
  if (!user) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  // CONTACT LIST VIEW
  if (!activeContactId) {
    return (
      <div className="h-screen bg-black text-white p-6 font-mono flex flex-col">
        <h1 className="text-xl mb-6 border-b border-gray-800 pb-4 tracking-widest">ENCRYPTED // CHANNELS</h1>
        
        <div className="mb-6">
           <label className="text-xs text-gray-500 mb-2 block">START NEW SECURE CHANNEL</label>
           <input 
             id="new-chat-id"
             placeholder="ENTER USER ID..."
             className="bg-[#111] p-4 w-full text-white border border-[#333] rounded-lg focus:border-white outline-none uppercase tracking-wider"
             onKeyDown={(e) => {
                if(e.key === 'Enter') {
                   setActiveContactId(e.currentTarget.value.toUpperCase());
                }
             }}
           />
        </div>

        <div className="flex-1 overflow-y-auto space-y-2">
          {Object.keys(conversations).map(contactId => (
            <div 
              key={contactId}
              onClick={() => setActiveContactId(contactId)}
              className="p-4 bg-[#111] border border-[#333] rounded-lg hover:bg-[#222] cursor-pointer flex justify-between items-center transition-all active:scale-[0.98]"
            >
              <span className="font-bold text-lg">{contactId}</span>
              <span className="text-gray-600 text-xs">
                {conversations[contactId].length > 0 
                  ? new Date(conversations[contactId][conversations[contactId].length -1].timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) 
                  : 'NEW'}
              </span>
            </div>
          ))}
          {Object.keys(conversations).length === 0 && (
             <div className="text-center text-gray-600 mt-10 text-sm">NO ACTIVE CHANNELS</div>
          )}
        </div>
        
        <button onClick={handleLogout} className="mt-6 py-4 text-red-500 text-xs tracking-widest border border-red-900/30 bg-red-900/10 rounded hover:bg-red-900/20">
          TERMINATE SESSION
        </button>
      </div>
    );
  }

  // CHAT VIEW
  return (
    <div className="h-screen flex flex-col bg-black">
       <div className="bg-black border-b border-[#333] p-4 flex items-center justify-between">
          <button 
           onClick={() => setActiveContactId(null)}
           className="text-white text-sm hover:text-gray-300 font-mono"
          >
           ← BACK
          </button>
          <span className="text-white font-bold font-mono tracking-wider">{activeContactId}</span>
          <div className="w-8"></div> {/* Spacer for centering */}
       </div>
       
       <ChatScreen 
         messages={conversations[activeContactId] || []} 
         onSendMessage={handleSendMessage}
         currentUserId={user.id}
         chatPartnerId={activeContactId}
       />
    </div>
  );
}
