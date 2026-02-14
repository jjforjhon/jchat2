import { useState } from 'react';
import { api } from '../api/server';

interface LoginProps {
  onLogin: (user: any) => void;
}

export const LoginScreen = ({ onLogin }: LoginProps) => {
  const [mode, setMode] = useState<'LOGIN' | 'REGISTER'>('REGISTER');
  const [id, setId] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!id || !password) return;
    setLoading(true);
    setError('');

    try {
      if (mode === 'REGISTER') {
        await api.register(id, password, ''); 
        onLogin({ id, password }); 
      } else {
        const res = await api.login(id, password);
        onLogin({ ...res.user, password }); 
      }
    } catch (err: any) {
      console.error("LOGIN DEBUG:", err);
      // ✅ FIX: Show the REAL error message
      // If it's a network error (server down/wrong IP), it says "Failed to fetch"
      // If it's a server error, it shows the text sent by server
      setError(err.message || "CONNECTION FAILED");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen bg-black text-white font-mono flex flex-col items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-1 border-b border-dashed border-[#333]"></div>
      <div className="absolute bottom-0 right-0 w-full h-1 border-t border-dashed border-[#333]"></div>

      <div className="w-full max-w-md space-y-10 animate-fade-in z-10">
        <div className="text-center">
          <h1 className="text-6xl mb-2 font-dot tracking-wider text-white">J-CHAT</h1>
          <div className="flex justify-center items-center gap-3">
            <span className="h-px w-8 bg-[#333]"></span>
            <span className="text-[10px] tracking-[0.4em] text-gray-500 uppercase">System v2.1</span>
            <span className="h-px w-8 bg-[#333]"></span>
          </div>
        </div>

        <div className="flex bg-[#111] p-1 rounded-full border border-[#222]">
          {['REGISTER', 'LOGIN'].map((m) => (
            <button
              key={m}
              onClick={() => { setMode(m as any); setError(''); }}
              className={`flex-1 py-3 text-[10px] tracking-[0.2em] rounded-full transition-all duration-300 ${
                mode === m 
                  ? 'bg-white text-black font-bold shadow-lg' 
                  : 'text-gray-500 hover:text-white'
              }`}
            >
              {m}
            </button>
          ))}
        </div>

        <div className="space-y-6">
          <div className="group">
            <label className="text-[10px] text-gray-500 ml-4 mb-2 block tracking-widest group-focus-within:text-white transition-colors">IDENTITY</label>
            <input
              value={id}
              onChange={(e) => setId(e.target.value.toUpperCase())}
              className="w-full bg-black border border-[#333] p-5 rounded-2xl text-white outline-none focus:border-white focus:bg-[#111] transition-all text-sm tracking-widest placeholder-gray-800"
              placeholder="USER ID"
            />
          </div>
          
          <div className="group">
            <label className="text-[10px] text-gray-500 ml-4 mb-2 block tracking-widest group-focus-within:text-white transition-colors">KEYPHRASE</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              className="w-full bg-black border border-[#333] p-5 rounded-2xl text-white outline-none focus:border-white focus:bg-[#111] transition-all text-sm tracking-widest placeholder-gray-800"
              placeholder="••••••••"
            />
          </div>
        </div>

        {error && (
          <div className="flex items-center justify-center gap-2 text-red-500 text-xs tracking-widest border border-red-900/30 p-3 bg-red-900/10 rounded-lg">
            <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
            {error}
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={loading || !id || !password}
          className="w-full bg-white text-black font-bold py-5 rounded-full tracking-[0.2em] hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:scale-100 shadow-[0_0_20px_rgba(255,255,255,0.1)]"
        >
          {loading ? 'INITIALIZING...' : mode === 'REGISTER' ? 'CREATE IDENTITY' : 'ESTABLISH LINK'}
        </button>

        <div className="text-center">
            <p className="text-[9px] text-gray-700 tracking-widest">ENCRYPTED // PERSISTENT // SECURE</p>
        </div>
      </div>
    </div>
  );
};
