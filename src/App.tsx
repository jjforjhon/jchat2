import { useState, useEffect } from 'react';
import { LoginScreen } from './components/LoginScreen';
import { ChatScreen } from './components/ChatScreen';
import { api } from './api/server';

// --- DEFINITIONS ---
interface User {
  id: string;
  name: string;
  avatar: string;
  privateKey: string;
}

interface Message {
  id: string;
  text: string;
  sender: string;
  timestamp: number;
  isOwn: boolean;
  type: 'text';
  status: 'sent' | 'delivered' | 'read';
}

type ConversationMap = Record<string, Message[]>;

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [conversations, setConversations] = useState<ConversationMap>({});
  const [activeContactId, setActiveContactId] = useState<string | null>(null);

  // 1. LOAD DATA
  useEffect(() => {
    const savedUser = localStorage.getItem('jchat_user');
    const savedChats = localStorage.getItem('jchat_conversations');

    if (savedUser) setUser(JSON.parse(savedUser));
    if (savedChats) setConversations(JSON.parse(savedChats));
  }, []);

  // 2. SAVE DATA
  useEffect(() => {
    if (Object.keys(conversations).length > 0) {
      localStorage.setItem('jchat_conversations', JSON.stringify(conversations));
    }
  }, [conversations]);

  // 3. POLLING (SYNC)
  useEffect(() => {
    if (!user) return;

    const interval = setInterval(async () => {
      try {
        const newMessages = await api.sync(user.id);
        if (newMessages.length === 0) return;

        setConversations(prev => {
          const next = { ...prev };

          newMessages.forEach((msg: any) => {
            const otherPersonId = msg.fromUser || "UNKNOWN";
            if (!next[otherPersonId]) next[otherPersonId] = [];

            const exists = next[otherPersonId].some(m => m.id === msg.id);
            if (!exists) {
              next[otherPersonId].push({
                id: msg.id,
                text: msg.payload,
                sender: otherPersonId,
                timestamp: msg.timestamp,
                isOwn: false,
                type: 'text',
                status: 'delivered'
              });
            }
          });
          return next;
        });

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

  // 4. SEND MESSAGE
  const handleSendMessage = async (text: string) => {
    if (!user || !activeContactId) return;

    const newMessage: Message = {
      id: crypto.randomUUID(),
      text,
      sender: user.id,
      timestamp: Date.now(),
      isOwn: true,
      type: 'text',
      status: 'sent'
    };

    setConversations(prev => {
      const next = { ...prev };
      if (!next[activeContactId]) next[activeContactId] = [];
      next[activeContactId].push(newMessage);
      return next;
    });

    await api.send(activeContactId, {
      id: newMessage.id,
      payload: text,
      fromUser: user.id,
      timestamp: newMessage.timestamp
    });
  };

  // 5. LOGIN
  const handleLogin = (userData: User) => {
    setUser(userData);
    localStorage.setItem('jchat_user', JSON.stringify(userData));
  };

  // 6. LOGOUT (Local Wipe)
  const handleLogout = () => {
    setUser(null);
    setConversations({});
    setActiveContactId(null);
    localStorage.removeItem('jchat_user');
    localStorage.removeItem('jchat_conversations');
  };

  // 7. DELETE ACCOUNT (Server Wipe + Local Wipe)
  const handleDeleteAccount = async () => {
    if (!user) return;
    // Native browser confirm dialog
    const confirmDelete = window.confirm("WARNING: This will permanently delete your account and messages from the server. This cannot be undone.");
    
    if (confirmDelete) {
      await api.deleteAccount(user.id); // Call the new API function
      handleLogout(); // Then wipe local data
    }
  };

  // --- RENDER LOGIN ---
  if (!user) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  // --- RENDER CONTACT LIST (With Mobile Layout Fixes) ---
  if (!activeContactId) {
    return (
      // 'fixed inset-0 h-[100dvh]' locks the app to the screen, preventing bounce/scroll issues
      <div className="fixed inset-0 h-[100dvh] w-full bg-black text-white font-mono flex flex-col overflow-hidden">
        
        {/* Header with padding for Status Bar */}
        <div className="pt-12 px-6 pb-4 border-b border-gray-800 shrink-0">
            <h1 className="text-xl tracking-widest">ENCRYPTED // CHANNELS</h1>
            <div className="text-xs text-gray-600 mt-1">ID: {user.id}</div>
        </div>

        {/* Scrollable List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
            <div className="mb-8">
              <label className="text-xs text-gray-500 mb-2 block">START NEW SECURE CHANNEL</label>
              <input
                id="new-chat-id"
                placeholder="ENTER USER ID..."
                className="bg-[#111] p-4 w-full text-white border border-[#333] rounded-lg focus:border-white outline-none uppercase tracking-wider"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    setActiveContactId(e.currentTarget.value.toUpperCase());
                  }
                }}
              />
            </div>

            <div className="space-y-2">
              {Object.keys(conversations).map(contactId => (
                <div
                  key={contactId}
                  onClick={() => setActiveContactId(contactId)}
                  className="p-4 bg-[#111] border border-[#333] rounded-lg hover:bg-[#222] cursor-pointer flex justify-between items-center active:scale-[0.98] transition-transform"
                >
                  <span className="font-bold text-lg">{contactId}</span>
                  <span className="text-gray-600 text-xs">
                    {conversations[contactId].length > 0
                      ? new Date(conversations[contactId][conversations[contactId].length - 1].timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                      : 'NEW'}
                  </span>
                </div>
              ))}
              
              {Object.keys(conversations).length === 0 && (
                <div className="text-center text-gray-700 mt-10 text-sm">NO ACTIVE CHANNELS</div>
              )}
            </div>
        </div>

        {/* Footer with Padding for Home Bar */}
        <div className="p-6 border-t border-[#333] shrink-0 space-y-3 pb-10">
            <button 
                onClick={handleLogout} 
                className="w-full py-4 text-gray-400 text-xs tracking-widest border border-gray-800 bg-[#111] rounded hover:bg-[#222]"
            >
              LOGOUT (SAVE LOCAL)
            </button>
            <button 
                onClick={handleDeleteAccount} 
                className="w-full py-4 text-red-500 text-xs tracking-widest border border-red-900/30 bg-red-900/10 rounded hover:bg-red-900/20"
            >
              DELETE ACCOUNT (SERVER)
            </button>
        </div>
      </div>
    );
  }

  // --- RENDER CHAT SCREEN (With Mobile Layout Fixes) ---
  const currentMessages = conversations[activeContactId] || [];

  const displayMessages = currentMessages.map(m => ({
    id: m.id,
    text: m.text,
    sender: m.isOwn ? 'me' : 'them',
    timestamp: m.timestamp,
    isOwn: m.isOwn,
    type: m.type,
    status: m.status
  }));

  return (
    <div className="fixed inset-0 h-[100dvh] w-full flex flex-col bg-black overflow-hidden">
      
      {/* Chat Header */}
      <div className="bg-black border-b border-[#333] pt-12 pb-4 px-4 flex items-center justify-between shrink-0 z-10">
        <button
          onClick={() => setActiveContactId(null)}
          className="text-white text-sm hover:text-gray-300 font-mono py-2 px-4 border border-[#333] rounded bg-[#111]"
        >
          ← BACK
        </button>
        <span className="text-white font-bold font-mono tracking-wider">{activeContactId}</span>
        <div className="w-8"></div>
      </div>

      {/* Chat Area - Flex 1 takes remaining space */}
      <div className="flex-1 overflow-hidden relative">
        <ChatScreen
            messages={displayMessages as any}
            onSendMessage={handleSendMessage}
            chatPartnerId={activeContactId} // Optional: Pass ID for display in input
        />
      </div>
    </div>
  );
}
