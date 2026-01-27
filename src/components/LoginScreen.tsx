import { useState } from 'react';
import { motion } from 'framer-motion';
import { generateIdentity } from '../utils/storage';

interface LoginProps {
  onLogin: (id: string, pass: string) => void;
}

export const LoginScreen = ({ onLogin }: LoginProps) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) return;
    const id = generateIdentity(username, password);
    onLogin(id, password);
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6 font-mono">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md space-y-8"
      >
        <div className="text-center space-y-2">
          <h1 className="font-dot text-6xl tracking-tighter">VAULT</h1>
          <p className="text-nothing-gray text-xs uppercase tracking-widest">Secure Entry // V2.0</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-1">
            <label className="text-[10px] text-nothing-gray uppercase">Identity</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-transparent border-b border-nothing-darkgray py-2 text-xl font-bold focus:border-white focus:outline-none transition-colors rounded-none"
              placeholder="USERNAME"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] text-nothing-gray uppercase">Key</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-transparent border-b border-nothing-darkgray py-2 text-xl font-bold focus:border-white focus:outline-none transition-colors rounded-none"
              placeholder="PASSWORD"
            />
          </div>

          <button 
            type="submit"
            className="w-full h-14 bg-white text-black font-bold uppercase tracking-widest rounded-nothing hover:bg-nothing-gray transition-colors mt-8"
          >
            Access Vault
          </button>
        </form>
      </motion.div>
    </div>
  );
};
