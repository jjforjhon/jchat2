import { useState, useEffect } from 'react';
import { ChatScreen } from './components/ChatScreen';
import { usePeer } from './hooks/usePeer';

function App() {
  const [profile, setProfile] = useState<{id: string, targetId: string} | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('jchat_user');
    if (saved) {
      setProfile(JSON.parse(saved));
    } else {
      // Simple prompt for setup (You can replace with LoginScreen later if needed)
      const id = prompt("Create YOUR ID (e.g. userA):") || 'userA';
      const target = prompt("Enter TARGET ID (e.g. userB):") || 'userB';
      const p = { id, targetId: target };
      localStorage.setItem('jchat_user', JSON.stringify(p));
      setProfile(p);
    }
  }, []);

  if (!profile) return <div className="bg-black h-screen text-white flex items-center justify-center">LOADING...</div>;

  return <ChatSession profile={profile} />;
}

// Separate component to handle Hook Lifecycle
const ChatSession = ({ profile }: { profile: {id: string, targetId: string} }) => {
  // ✅ FIX: Passing 2 arguments here now
  const { isConnected, sendMessage, messages, clearHistory, unlinkConnection } = usePeer(profile.id, profile.targetId);

  return (
    <ChatScreen 
      messages={messages} 
      // ✅ FIX: Removed 'profile.name', passing only text and type
      onSendMessage={(text, type) => sendMessage(text, type)}
      onClear={clearHistory}
      onUnlink={() => {
        if(confirm("Disconnect?")) {
           unlinkConnection();
           localStorage.removeItem('jchat_user');
           window.location.reload();
        }
      }}
      isConnected={isConnected}
      targetId={profile.targetId}
    />
  );
};

export default App;