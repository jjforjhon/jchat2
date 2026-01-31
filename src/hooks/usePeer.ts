import { useState, useEffect, useCallback, useRef } from 'react';
import Peer, { DataConnection } from 'peerjs';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { App } from '@capacitor/app';

export interface Message {
  id: string;
  text: string;
  sender: 'me' | 'them';
  senderName?: string;
  senderAvatar?: string; // ✅ Added this to fix ChatScreen error
  timestamp: number;
  type: 'text' | 'image' | 'video' | 'audio' | 'reaction';
  status: 'sent' | 'pending';
}

interface Profile {
  id: string;
  name: string;
  avatar: string;
}

// ✅ Accepts entire Profile object now
export const usePeer = (myProfile: Profile) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnectionBroken, setIsConnectionBroken] = useState(false);
  const [remoteProfile, setRemoteProfile] = useState<{name: string, avatar: string} | null>(null);
  
  const peerRef = useRef<Peer | null>(null);
  const connRef = useRef<DataConnection | null>(null);

  // 1. HISTORY
  const [messages, setMessages] = useState<Message[]>(() => {
    const saved = localStorage.getItem('jchat_history');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [remotePeerId, setRemotePeerId] = useState<string>(() => {
    return localStorage.getItem('last_target_id') || '';
  });

  useEffect(() => {
    localStorage.setItem('jchat_history', JSON.stringify(messages));
  }, [messages]);

  // 2. CONNECTION HANDLING
  const handleConnection = useCallback((connection: DataConnection) => {
    if (connRef.current?.open && connRef.current.peer === connection.peer) return;

    console.log(`🔗 Connected: ${connection.peer}`);
    connRef.current = connection;
    setIsConnected(true);
    setIsConnectionBroken(false);
    setRemotePeerId(connection.peer);
    localStorage.setItem('last_target_id', connection.peer);

    connection.on('open', () => {
      setIsConnected(true);
      // Handshake Profile
      connection.send({ type: 'PROFILE_SYNC', name: myProfile.name, avatar: myProfile.avatar });
      
      // Flush Pending
      setMessages(prev => {
        const pending = prev.filter(m => m.sender === 'me' && m.status === 'pending');
        pending.forEach(msg => {
          try { connection.send({ ...msg, status: 'sent', senderAvatar: myProfile.avatar }); } catch(e) {}
        });
        return prev.map(m => m.status === 'pending' ? { ...m, status: 'sent' } : m);
      });
    });

    connection.on('data', async (data: any) => {
      if (data.type === 'PROFILE_SYNC') {
        setRemoteProfile({ name: data.name, avatar: data.avatar });
        return;
      }
      if (data.sender !== 'me') {
        Haptics.impact({ style: ImpactStyle.Light });
        await LocalNotifications.schedule({
          notifications: [{ title: `J-CHAT`, body: 'New Message', id: Date.now(), schedule: { at: new Date(Date.now() + 100) } }]
        });
      }
      setMessages(prev => {
        if (prev.find(m => m.id === data.id)) return prev;
        return [...prev, { ...data, sender: 'them' }];
      });
    });

    connection.on('close', () => { setIsConnected(false); });
    connection.on('error', () => setIsConnected(false));
  }, [myProfile]);

  // 3. INITIALIZATION
  const initializePeer = useCallback(() => {
    if (!myProfile.id) return;
    if (peerRef.current && !peerRef.current.destroyed) return;

    const newPeer = new Peer(myProfile.id, {
      host: '0.peerjs.com', port: 443, secure: true,
      config: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] }
    });

    newPeer.on('open', () => {
      peerRef.current = newPeer;
    });

    newPeer.on('connection', handleConnection);
    newPeer.on('error', (err) => console.log('Peer Error', err));
  }, [myProfile.id, handleConnection]);

  // 4. BROKEN LINK DETECTOR
  useEffect(() => {
    initializePeer();
    const sub = App.addListener('appStateChange', ({ isActive }) => {
      if (isActive) {
        console.log("📱 App Resumed");
        const lastTarget = localStorage.getItem('last_target_id');
        if (lastTarget) {
          if (!connRef.current || !connRef.current.open) {
            console.log("⚠️ Broken Link Detected!");
            setIsConnectionBroken(true);
          }
        }
      }
    });
    return () => { sub.then(s => s.remove()); };
  }, [initializePeer]);

  // 5. MANUAL RECONNECT
  const retryConnection = () => {
    const lastTarget = localStorage.getItem('last_target_id');
    if (!lastTarget) return;

    if (peerRef.current && !peerRef.current.destroyed) {
      const c = peerRef.current.connect(lastTarget, { reliable: true });
      handleConnection(c);
    } else {
      initializePeer();
      setTimeout(() => {
        if (peerRef.current) {
          const c = peerRef.current.connect(lastTarget, { reliable: true });
          handleConnection(c);
        }
      }, 1000);
    }
  };

  const sendMessage = (content: string, type: any = 'text') => {
    const msg: Message = {
      id: crypto.randomUUID(), text: content, sender: 'me', 
      senderName: myProfile.name, senderAvatar: myProfile.avatar,
      timestamp: Date.now(), type, status: 'pending'
    };
    setMessages(prev => [...prev, msg]);
    if (connRef.current?.open) {
      try {
        connRef.current.send({ ...msg, status: 'sent' });
        setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, status: 'sent' } : m));
      } catch (e) {}
    }
  };

  const clearHistory = () => { if(confirm("Clear?")) { setMessages([]); localStorage.removeItem('jchat_history'); }};
  
  const unlinkConnection = () => {
    if(!confirm("Unlink?")) return;
    connRef.current?.close();
    localStorage.removeItem('last_target_id');
    setRemotePeerId('');
    setIsConnected(false);
    setIsConnectionBroken(false);
  };

  const connectToPeer = (id: string) => {
    const c = peerRef.current?.connect(id, { reliable: true });
    if(c) handleConnection(c);
  };

  return { isConnected, sendMessage, messages, remotePeerId, clearHistory, unlinkConnection, connectToPeer, remoteProfile, isConnectionBroken, retryConnection };
};