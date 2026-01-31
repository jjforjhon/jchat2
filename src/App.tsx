import { useState, useEffect } from 'react';
import { LoginScreen } from './components/LoginScreen';
import { ChatScreen } from './components/ChatScreen';
import { usePeer } from './hooks/usePeer';

function App() {
  const [profile, setProfile] = useState<any>(null);

  const { 
    isConnected, 
    connectToPeer, 
    sendMessage, 
    messages, 
    remotePeerId, 
    clearHistory, 
    unlinkConnection 
  } = usePeer(profile?.id || '');

  useEffect(() => {
    const saved = localStorage.getItem('chat_profile');
    if (saved) setProfile(JSON.parse(saved));
  }, []);

  const handleLogin = (user: any) => {
    setProfile(user);
    localStorage.setItem('chat_profile', JSON.stringify(user));
  };

  const handleAppNuke = async () => {
    if (!confirm('DESTROY IDENTITY AND RESET APP?')) return;
    localStorage.clear();
    setProfile(null);
    window.location.reload();
  };

  if (!profile) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  // Show search if we are not connected AND we are not already trying to auto-dial a peer
  const showSearchScreen = !isConnected && !remotePeerId;

  return (
    <div className="h-screen w-screen bg-black overflow-hidden">
      
      {showSearchScreen && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center p-8 text-white font-mono">
          <div className="w-full max-w-sm border border-[#262626] p-8 rounded-[32px] bg-[#0A0A0A]">
            <h2 className="text-sm font-bold tracking-[0.3em] text-red-600 mb-8 text-center uppercase">System Offline</h2>
            
            <p className="text-[10px] text-[#666] uppercase tracking-widest mb-2">My Identity</p>
            <div className="bg-[#121212] p-4 rounded-xl text-[10px] text-[#888] break-all border border-[#333] mb-8 font-mono select-all">
              {profile.id}
            </div>
            
            <div className="space-y-4">
              <p className="text-[10px] text-[#666] uppercase tracking-widest">Target Identity</p>
              <input 
                id="target-id-input"
                type="text" 
                placeholder="PASTE ID..." 
                className="w-full bg-black border border-[#333] p-4 rounded-xl text-white text-xs focus:border-red-600 outline-none transition-colors"
              />
              <button 
                onClick={() => {
                  const input = document.getElementById('target-id-input') as HTMLInputElement;
                  connectToPeer(input.value);
                }}
                className="w-full bg-white text-black font-bold py-4 rounded-full uppercase tracking-widest hover:bg-[#ccc] active:scale-95 transition-all mt-4"
              >
                Initialize
              </button>
            </div>

            <button onClick={handleAppNuke} className="mt-8 w-full text-center text-[#333] text-[10px] uppercase tracking-widest hover:text-red-600">
              [ Destroy Session ]
            </button>
          </div>
        </div>
      )}

      <ChatScreen 
        messages={messages} 
        onSendMessage={(text, type) => sendMessage(text, profile.name, type)}
        onClear={clearHistory}
        onUnlink={unlinkConnection}
        targetId={remotePeerId}
      />
    </div>
  );
}

export default App;