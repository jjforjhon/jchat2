import { useState, useEffect, useCallback } from 'react';
import { LoginScreen } from './components/LoginScreen';
import { ChatScreen } from './components/ChatScreen'; // Assuming you have this
import { api } from './api/server';

// DEFINITIONS
interface User {
  id: string;
  name: string;
  avatar: string;
  privateKey: string;
}

interface Message {
  id: string;
  text: string;
  senderId: string;
  timestamp: number;
  isOwn: boolean;
}

// THE FIX: We track a Map of conversations, not just a list of messages
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

  // 3. POLLING FOR NEW MESSAGES (The "Postman")
  useEffect(() => {
    if (!user) return;
    
    const interval = setInterval(async () => {
      try {
        const newMessages = await api.sync(user.id);
        if (newMessages.length === 0) return;

        // SORT INCOMING MESSAGES INTO CORRECT "BOXES"
        setConversations(prev => {
          const next = { ...prev };
          
          newMessages.forEach((msg: any) => {
             // If message is from "Alice", put it in "Alice's" box
             const otherPersonId = msg.fromUser; // Ensure your server sends this!
             
             if (!next[otherPersonId]) next[otherPersonId] = [];
             
             // Avoid duplicates
             const exists = next[otherPersonId].some(m => m.id === msg.id);
             if (!exists) {
               next[otherPersonId].push({
                 id: msg.id,
                 text: msg.payload, // Assuming decrypted text
                 senderId: otherPersonId,
                 timestamp: msg.timestamp,
                 isOwn: false
               });
             }
          });
          return next;
        });

        // Tell server "I got them, delete them"
        const idsToDelete = newMessages.map((m: any) => m.id);
        await api.ack(user.id, idsToDelete);

      } catch (err) {
        console.error("Sync error:", err);
      }
    }, 3000); // Check every 3 seconds

    return () => clearInterval(interval);
  }, [user]);

  // 4. SEND MESSAGE FUNCTION
  const handleSendMessage = async (text: string) => {
    if (!user || !activeContactId) return;

    const newMessage: Message = {
      id: crypto.randomUUID(),
      text,
      senderId: user.id,
      timestamp: Date.now(),
      isOwn: true
    };

    // Optimistic Update: Show it immediately in the correct chat box
    setConversations(prev => {
      const next = { ...prev };
      if (!next[activeContactId]) next[activeContactId] = [];
      next[activeContactId].push(newMessage);
      return next;
    });

    // Send to Server
    await api.send(activeContactId, {
      id: newMessage.id,
      payload: text, // You should encrypt this!
      fromUser: user.id,
      timestamp: newMessage.timestamp
    });
  };

  // 5. LOGIN HANDLER
  const handleLogin = (userData: User) => {
    setUser(userData);
    localStorage.setItem('jchat_user', JSON.stringify(userData));
  };

  // 6. LOGOUT (Optional: Clears local data for privacy)
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

  // If no contact selected, show "Contact List" (Simplified)
  if (!activeContactId) {
    return (
      <div className="h-screen bg-black text-white p-6 font-mono">
        <h1 className="text-xl mb-6 border-b border-gray-800 pb-4">MESSAGES</h1>
        
        {/* Simple "Add User" Input for testing */}
        <div className="mb-6">
           <input 
             id="new-chat-id"
             placeholder="ENTER USER ID TO CHAT..."
             className="bg-[#111] p-3 w-full text-white border border-[#333] rounded"
             onKeyDown={(e) => {
                if(e.key === 'Enter') {
                   setActiveContactId(e.currentTarget.value.toUpperCase());
                }
             }}
           />
        </div>

        {/* List of existing conversations */}
        <div className="space-y-2">
          {Object.keys(conversations).map(contactId => (
            <div 
              key={contactId}
              onClick={() => setActiveContactId(contactId)}
              className="p-4 bg-[#111] border border-[#333] rounded hover:bg-[#222] cursor-pointer flex justify-between"
            >
              <span>{contactId}</span>
              <span className="text-gray-500 text-xs">
                {conversations[contactId].length > 0 
                  ? new Date(conversations[contactId][conversations[contactId].length -1].timestamp).toLocaleTimeString() 
                  : ''}
              </span>
            </div>
          ))}
        </div>
        
        <button onClick={handleLogout} className="mt-8 text-red-500 text-sm hover:underline">
          LOGOUT
        </button>
      </div>
    );
  }

  // If contact selected, show their specific messages
  return (
    <div className="h-screen flex flex-col">
       <button 
         onClick={() => setActiveContactId(null)}
         className="bg-[#111] text-white p-4 text-left border-b border-[#333]"
       >
         ← BACK TO LIST
       </button>
       
       <ChatScreen 
         messages={conversations[activeContactId] || []} // THE FIX: Only pass this user's messages
         onSendMessage={handleSendMessage}
         currentUserId={user.id}
         chatPartnerId={activeContactId}
       />
    </div>
  );
}
