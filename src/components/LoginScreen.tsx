import { useState, useRef } from 'react';
import { api } from '../api/server'; // We need to import the API

interface LoginProps {
  onLogin: (user: { id: string; name: string; avatar: string; privateKey: string }) => void;
}

export const LoginScreen = ({ onLogin }: LoginProps) => {
  const [id, setId] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false); // Add loading state
  const [error, setError] = useState(''); // Add error state
  const [avatar, setAvatar] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const img = new Image();
        img.src = ev.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          const maxWidth = 150; 
          const scale = maxWidth / img.width;
          canvas.width = maxWidth;
          canvas.height = img.height * scale;
          ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
          setAvatar(canvas.toDataURL('image/jpeg', 0.7));
        };
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent | null) => {
    if (e) e.preventDefault();
    setError('');
    
    const finalId = id.trim().toUpperCase();
    const finalName = name.trim() || 'User-' + finalId;
    
    if (!finalId) {
      setError('ID is required');
      return;
    }

    setLoading(true);

    try {
      // 1. Generate Crypto Keys
      const keys = await window.crypto.subtle.generateKey(
        {
          name: "RSA-OAEP",
          modulusLength: 2048,
          publicExponent: new Uint8Array([1, 0, 1]),
          hash: "SHA-256",
        },
        true,
        ["encrypt", "decrypt"]
      );

      // 2. Export Public Key to send to Server
      const pubKeyBuffer = await window.crypto.subtle.exportKey("spki", keys.publicKey);
      const pubKeyBase64 = btoa(String.fromCharCode(...new Uint8Array(pubKeyBuffer)));

      // 3. Export Private Key to save Locally (NEVER SEND THIS)
      const privKeyBuffer = await window.crypto.subtle.exportKey("pkcs8", keys.privateKey);
      const privKeyBase64 = btoa(String.fromCharCode(...new Uint8Array(privKeyBuffer)));

      // 4. Register on Render Server
      console.log('Registering with server...');
      await api.register(finalId, pubKeyBase64, avatar);

      // 5. Success! Log in locally
      onLogin({ 
        id: finalId, 
        name: finalName, 
        avatar: avatar || '',
        privateKey: privKeyBase64 
      });

    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Registration failed. Check internet.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-black text-white font-mono p-6">
      <div className="w-full max-w-sm border border-[#333] p-8 rounded-[32px] bg-[#0A0A0A]">
        <h1 className="text-2xl font-bold mb-8 text-center tracking-tighter">J-CHAT // PROFILE</h1>
        
        <div className="flex justify-center mb-6">
          <div 
            onClick={() => fileInputRef.current?.click()}
            className="w-24 h-24 rounded-full border border-[#333] bg-[#111] flex items-center justify-center overflow-hidden cursor-pointer hover:border-white transition-all relative"
          >
            {avatar ? (
              <img src={avatar} alt="avatar" className="w-full h-full object-cover" />
            ) : (
              <span className="text-2xl text-[#666]">+</span>
            )}
            <div className="absolute bottom-0 w-full bg-black/50 text-[8px] text-center py-1">PHOTO</div>
          </div>
          <input type="file" ref={fileInputRef} onChange={handleAvatarUpload} className="hidden" accept="image/*" />
        </div>

        <div className="space-y-4">
          <input 
            type="text" 
            value={id}
            onChange={(e) => setId(e.target.value)}
            placeholder="CHOOSE UNIQUE ID"
            className="w-full bg-black border border-[#333] p-4 rounded-xl text-white text-sm focus:border-white outline-none uppercase placeholder-[#444]"
          />
          <input 
            type="text" 
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="DISPLAY NAME"
            className="w-full bg-black border border-[#333] p-4 rounded-xl text-white text-sm focus:border-white outline-none placeholder-[#444]"
          />
          
          {error && <p className="text-red-500 text-xs text-center">{error}</p>}

          <button 
            onClick={(e) => handleSubmit(e)} 
            disabled={loading}
            className="w-full bg-white text-black font-bold py-4 rounded-full uppercase tracking-widest hover:bg-[#ccc] active:scale-95 transition-all mt-4 disabled:opacity-50"
          >
            {loading ? 'Registering...' : 'Create Account'}
          </button>
        </div>
      </div>
    </div>
  );
};
