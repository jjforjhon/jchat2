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
        // Auto login after register
        onLogin({ id, password }); 
      } else {
        const res = await api.login(id, password);
        onLogin({ ...res.user, password }); // Save password in local state for reconnects
      }
    } catch (err: any) {
      setError(mode === 'LOGIN' ? "INVALID ID OR PASSWORD" : "ID ALREADY EXISTS");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen bg-black text-white font-mono flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md space-y-8">
        {/* LOGO */}
        <div className="text-center space-y-2">
          <div className="text-5xl font-bold tracking-tighter">J-CHAT</div>
          <div className="text-xs tracking-[0.3em] text-gray-500">ENCRYPTED // PERSISTENT</div>
        </div>

        {/* TABS */}
        <div className="flex border border-[#333] rounded p-1">
          {['REGISTER', 'LOGIN'].map((m) => (
            <button
              key={m}
              onClick={() => setMode(m as any)}
              className={`flex-1 py-3 text-xs tracking-widest transition-all ${
                mode === m ? 'bg-white text-black' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {m}
            </button>
          ))}
        </div>

        {/* FORM */}
        <div className="space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] text-gray-500 ml-1">USER ID</label>
            <input
              value={id}
              onChange={(e) => setId(e.target.value.toUpperCase())}
              className="w-full bg-[#111] border border-[#333] p-4 text-white outline-none focus:border-white transition-colors rounded-lg"
              placeholder="ENTER UNIQUE ID"
            />
          </div>
          
          <div className="space-y-1">
            <label className="text-[10px] text-gray-500 ml-1">PASSWORD</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-[#111] border border-[#333] p-4 text-white outline-none focus:border-white transition-colors rounded-lg"
              placeholder="SECURE PASSWORD"
            />
          </div>
        </div>

        {error && <div className="text-red-500 text-xs text-center border border-red-900/50 p-2 bg-red-900/10">{error}</div>}

        <button
          onClick={handleSubmit}
          disabled={loading || !id || !password}
          className="w-full bg-white text-black font-bold py-4 rounded-lg tracking-widest hover:bg-gray-200 disabled:opacity-50 transition-all"
        >
          {loading ? 'PROCESSING...' : mode === 'REGISTER' ? 'CREATE IDENTITY' : 'RESTORE SESSION'}
        </button>
      </div>
    </div>
  );
};
