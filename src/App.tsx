import { useState, useEffect } from 'react';
import { LoginScreen } from './components/LoginScreen';
import { ChatScreen } from './components/ChatScreen';
import { usePeer } from './hooks/usePeer';

interface Profile {
  id: string;
  name: string;
  avatar: string;
}

function App() {
  const [profile, setProfile] = useState<Profile | null>(null);

  const { 
    isConnected, 
    connectToPeer, 
    sendMessage, 
    messages, 
    remotePeerId, 
    clearHistory, 
    unlinkConnection,
    remoteProfile,
    isConnectionBroken, // NEW
    retryConnection     // NEW
  } = usePeer(profile || { id: '', name: '', avatar: '' });

  useEffect(() => {
    const saved = localStorage.getItem('chat_profile');
    if (saved) setProfile(JSON.parse(saved));
  }, []);

  const handleLogin = (user: Profile) => {
    setProfile(user);
    localStorage.setItem('chat_profile', JSON.stringify(user));
  };

  const handleUpdateProfile = (newProfile: Profile) => {
    setProfile(newProfile);
    localStorage.setItem('chat_profile', JSON.stringify(newProfile));
  };

  if (!profile) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  const showSearchScreen = !isConnected && !remotePeerId;

  return (
    <div className="h-[100dvh] w-screen bg-black overflow-hidden">
      {showSearchScreen && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center p-8 text-white font-mono">
          <div className="w-full max-w-sm border border-[#262626] p-8 rounded-[32px] bg-[#0A0A0A]">
            <h2 className="text-sm font-bold tracking-[0.3em] text-red-600 mb-8 text-center uppercase">System Offline</h2>
            <div className="flex flex-col items-center mb-6">
               <div className="w-16 h-16 rounded-full border border-[#333] mb-2 overflow-hidden">
                  {profile.avatar && <img src={profile.avatar} className="w-full h-full object-cover"/>}
               </div>
               <p className="text-[10px] text-[#666] uppercase tracking-widest">Identity: {profile.id}</p>
            </div>
            <div className="space-y-4">
              <p className="text-[10px] text-[#666] uppercase tracking-widest">Target Identity</p>
              <input id="target-id-input" type="text" placeholder="PASTE ID..." className="w-full bg-black border border-[#333] p-4 rounded-xl text-white text-xs focus:border-red-600 outline-none transition-colors uppercase" />
              <button onClick={() => { const input = document.getElementById('target-id-input') as HTMLInputElement; connectToPeer(input.value); }} className="w-full bg-white text-black font-bold py-4 rounded-full uppercase tracking-widest hover:bg-[#ccc] active:scale-95 transition-all mt-4">Initialize</button>
            </div>
          </div>
        </div>
      )}

      <ChatScreen 
        messages={messages} 
        onSendMessage={(text, type) => sendMessage(text, type)}
        onClear={clearHistory}
        onUnlink={unlinkConnection}
        onUpdateProfile={handleUpdateProfile}
        targetId={remotePeerId}
        remoteProfile={remoteProfile}
        myProfile={profile}
        isConnectionBroken={isConnectionBroken} // NEW
        onRetryConnection={retryConnection}     // NEW
      />
    </div>
  );
}

export default App;