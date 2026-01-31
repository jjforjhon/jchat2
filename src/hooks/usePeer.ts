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
  senderAvatar?: string; // New field
  timestamp: number;
  type: 'text' | 'image' | 'video' | 'audio' | 'reaction';
  status: 'sent' | 'pending';
}

export const usePeer = (myProfile: { id: string; name: string; avatar: string }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [remoteProfile, setRemoteProfile] = useState<{name: string, avatar: string} | null>(null);
  
  const peerRef = useRef<Peer | null>(null);
  const connRef = useRef<DataConnection | null>(null);

  // 1. HISTORY (LocalStorage)
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

  // 2. CONNECTION HANDLER
  const handleConnection = useCallback((connection: DataConnection) => {
    if (connRef.current?.open && connRef.current.peer === connection.peer) return;

    console.log(`🔗 Connected: ${connection.peer}`);
    connRef.current = connection;
    setIsConnected(true);
    setRemotePeerId(connection.peer);
    localStorage.setItem('last_target_id', connection.peer);

    connection.on('open', () => {
      setIsConnected(true);
      // 🔥 SEND PROFILE HANDSHAKE IMMEDIATELY
      connection.send({ 
        type: 'PROFILE_SYNC', 
        name: myProfile.name, 
        avatar: myProfile.avatar 
      });
      
      // Flush pending messages
      setMessages(prev => {
        const pending = prev.filter(m => m.sender === 'me' && m.status === 'pending');
        pending.forEach(msg => {
          try { connection.send({ ...msg, status: 'sent', senderAvatar: myProfile.avatar }); } catch(e) {}
        });
        return prev.map(m => m.status === 'pending' ? { ...m, status: 'sent' } : m);
      });
    });

    connection.on('data', async (data: any) => {
      // HANDLE PROFILE SYNC
      if (data.type === 'PROFILE_SYNC') {
        setRemoteProfile({ name: data.name, avatar: data.avatar });
        return;
      }

      if (data.sender !== 'me') {
        Haptics.impact({ style: ImpactStyle.Light });
        
        // Simple notification logic
        let body = "New Message";
        if (data.type === 'image') body = "📷 Photo";
        if (data.type === 'video') body = "📹 Video";
        if (data.type === 'audio') body = "🎙️ Voice Note";
        
        await LocalNotifications.schedule({
          notifications: [{
            title: `J-CHAT`, body: body, id: Date.now(),
            channelId: 'jchat_alerts', schedule: { at: new Date(Date.now() + 100) },
            smallIcon: 'ic_stat_icon_config_sample',
          }]
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

    console.log("⚡ Init Peer:", myProfile.id);
    const newPeer = new Peer(myProfile.id, {
      host: '0.peerjs.com', port: 443, secure: true,
      config: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] }
    });

    newPeer.on('open', () => {
      peerRef.current = newPeer;
      const lastTarget = localStorage.getItem('last_target_id');
      if (lastTarget && !connRef.current?.open) {
        const c = newPeer.connect(lastTarget, { reliable: true });
        handleConnection(c);
      }
    });

    newPeer.on('connection', handleConnection);
    newPeer.on('error', (err) => {
      if (err.type === 'network' || err.type === 'peer-unavailable') setTimeout(initializePeer, 5000);
    });
  }, [myProfile.id, handleConnection]);

  // 4. APP RESUME
  useEffect(() => {
    initializePeer();
    const sub = App.addListener('appStateChange', ({ isActive }) => {
      if (isActive) initializePeer();
    });
    return () => { sub.then(s => s.remove()); };
  }, [initializePeer]);

  const sendMessage = (content: string, type: any = 'text') => {
    const msg: Message = {
      id: crypto.randomUUID(), text: content, sender: 'me', 
      senderName: myProfile.name,
      senderAvatar: myProfile.avatar, // Attach avatar to message
      timestamp: Date.now(), type, status: 'pending'
    };

    setMessages(prev => [...prev, msg]);

    if (connRef.current?.open) {
      try {
        connRef.current.send({ ...msg, status: 'sent' });
        setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, status: 'sent' } : m));
      } catch (e) { console.log("Queueing..."); }
    } else {
       // Auto reconnect attempt
       const lastTarget = localStorage.getItem('last_target_id');
       if(peerRef.current && lastTarget) {
          handleConnection(peerRef.current.connect(lastTarget));
       }
    }
  };

  const clearHistory = () => {
    if(!confirm("Clear History?")) return;
    setMessages([]);
    localStorage.removeItem('jchat_history');
  };

  const unlinkConnection = () => {
    if(!confirm("Unlink?")) return;
    connRef.current?.close();
    localStorage.removeItem('last_target_id');
    setRemotePeerId('');
    setIsConnected(false);
  };

  const connectToPeer = (id: string) => {
    const c = peerRef.current?.connect(id, { reliable: true });
    if(c) handleConnection(c);
  };

  return { isConnected, sendMessage, messages, remotePeerId, clearHistory, unlinkConnection, connectToPeer, remoteProfile };
};