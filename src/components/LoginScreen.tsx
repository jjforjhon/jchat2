import { useState, useRef } from 'react';

interface LoginProps {
  onLogin: (user: { id: string; name: string; avatar: string }) => void;
}

export const LoginScreen = ({ onLogin }: LoginProps) => {
  const [id, setId] = useState('');
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAutoId = () => {
    const randomId = Math.random().toString(36).substring(2, 8).toUpperCase();
    handleSubmit(null, randomId);
  };

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        // Simple compression by creating an image and resizing if needed
        const img = new Image();
        img.src = ev.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          const maxWidth = 150; // Thumbnail size
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

  const handleSubmit = (e: React.FormEvent | null, autoId?: string) => {
    if (e) e.preventDefault();
    const finalId = autoId || id.trim();
    const finalName = name.trim() || 'User-' + finalId;
    if (!finalId) return;
    
    onLogin({ 
      id: finalId, 
      name: finalName, 
      avatar: avatar || '' // Empty string if no avatar
    });
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
            placeholder="UNIQUE ID (REQUIRED)"
            className="w-full bg-black border border-[#333] p-4 rounded-xl text-white text-sm focus:border-white outline-none uppercase placeholder-[#444]"
          />
          <input 
            type="text" 
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="DISPLAY NAME (OPTIONAL)"
            className="w-full bg-black border border-[#333] p-4 rounded-xl text-white text-sm focus:border-white outline-none placeholder-[#444]"
          />
          
          <button 
            onClick={(e) => handleSubmit(e)} 
            className="w-full bg-white text-black font-bold py-4 rounded-full uppercase tracking-widest hover:bg-[#ccc] active:scale-95 transition-all mt-4"
          >
            Create Permanent Profile
          </button>
          
          <button 
            onClick={handleAutoId}
            className="w-full bg-[#1A1A1A] text-white border border-[#333] py-4 rounded-full text-xs uppercase tracking-widest hover:bg-[#222] active:scale-95 transition-all"
          >
            Random ID
          </button>
        </div>
      </div>
    </div>
  );
};