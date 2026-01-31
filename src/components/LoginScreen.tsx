import { useState } from 'react';

interface LoginProps {
  onLogin: (user: { id: string; name: string }) => void;
}

export const LoginScreen = ({ onLogin }: LoginProps) => {
  const [id, setId] = useState('');
  
  // Generate a random ID if they don't want to type one
  const handleAutoId = () => {
    const randomId = Math.random().toString(36).substring(2, 8).toUpperCase();
    onLogin({ id: randomId, name: 'User-' + randomId });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!id.trim()) return;
    onLogin({ id: id.trim(), name: 'User-' + id.trim() });
  };

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-black text-white font-mono p-6">
      <div className="w-full max-w-sm border border-[#333] p-8 rounded-[32px] bg-[#0A0A0A]">
        <h1 className="text-2xl font-bold mb-8 text-center tracking-tighter">J-CHAT // ACCESS</h1>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-[#666] mb-2">
              Identity Protocol
            </label>
            <input 
              type="text" 
              value={id}
              onChange={(e) => setId(e.target.value)}
              placeholder="ENTER CUSTOM ID..."
              className="w-full bg-black border border-[#333] p-4 rounded-xl text-white text-sm focus:border-white outline-none transition-colors uppercase placeholder-[#444]"
            />
          </div>

          <button 
            type="submit" 
            className="w-full bg-white text-black font-bold py-4 rounded-full uppercase tracking-widest hover:bg-[#ccc] active:scale-95 transition-all"
          >
            Connect
          </button>
        </form>

        <div className="mt-6 flex items-center justify-between">
          <div className="h-[1px] bg-[#222] flex-1"></div>
          <span className="text-[10px] text-[#444] px-4 uppercase">OR</span>
          <div className="h-[1px] bg-[#222] flex-1"></div>
        </div>

        <button 
          onClick={handleAutoId}
          className="w-full mt-6 bg-[#1A1A1A] text-white border border-[#333] py-4 rounded-full text-xs uppercase tracking-widest hover:bg-[#222] active:scale-95 transition-all"
        >
          Generate Random ID
        </button>
      </div>
    </div>
  );
};