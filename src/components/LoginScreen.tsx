import { useState } from 'react';
import { motion } from 'framer-motion';

interface LoginProps {
  onLogin: (data: any, pass: string) => void;
}

export const LoginScreen = ({ onLogin }: LoginProps) => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [formData, setFormData] = useState({ email: '', password: '', name: '' });
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
   const API_URL = 'https://jchat2new.vercel.app/api/auth';

    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, action: isSignUp ? 'signup' : 'login' })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Authentication failed');

      onLogin(data, formData.password);
      
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6 font-mono">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md space-y-8">
        <div className="text-center space-y-2">
          <h1 className="font-dot text-6xl tracking-tighter">VAULT</h1>
          <p className="text-nothing-gray text-xs uppercase tracking-widest">{isSignUp ? 'Create Identity' : 'Authenticate'}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {isSignUp && (
            <div className="space-y-1">
              <label className="text-[10px] text-nothing-gray uppercase">Display Name</label>
              <input type="text" required value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} className="w-full bg-transparent border-b border-nothing-darkgray py-2 text-xl font-bold focus:border-white focus:outline-none rounded-none" />
            </div>
          )}
          <div className="space-y-1">
            <label className="text-[10px] text-nothing-gray uppercase">Email</label>
            <input type="email" required value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} className="w-full bg-transparent border-b border-nothing-darkgray py-2 text-xl font-bold focus:border-white focus:outline-none rounded-none" />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] text-nothing-gray uppercase">Password</label>
            <input type="password" required value={formData.password} onChange={(e) => setFormData({...formData, password: e.target.value})} className="w-full bg-transparent border-b border-nothing-darkgray py-2 text-xl font-bold focus:border-white focus:outline-none rounded-none" />
          </div>
          {error && <p className="text-nothing-red text-sm text-center">{error}</p>}
          <button type="submit" className="w-full h-14 bg-white text-black font-bold uppercase tracking-widest rounded-nothing hover:bg-nothing-gray transition-colors mt-8">{isSignUp ? 'Generate Profile' : 'Access Vault'}</button>
        </form>

        <div className="text-center">
          <button onClick={() => setIsSignUp(!isSignUp)} className="text-nothing-gray text-xs hover:text-white underline">{isSignUp ? 'Already have an ID? Login' : 'Need a secure ID? Sign Up'}</button>
        </div>
      </motion.div>
    </div>
  );
};