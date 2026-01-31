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
  timestamp: number;
  type: 'text' | 'image' | 'video' | 'audio' | 'reaction';
  status: 'sent' | 'pending';
}

export const usePeer = (myId: string) => {
  // Removed unused 'peer' and 'conn' state variables to fix warnings
  // We use refs for logic to ensure we always have the latest instance
  
  const [isConnected, setIsConnected] = useState(false);
  
  const peerRef = useRef<Peer | null>(null);
  const connRef = useRef<DataConnection | null>(null);

  // 1. HISTORY & QUEUE (LocalStorage)
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

  // 2. FLUSH QUEUE
  const flushQueue = useCallback(() => {
    if (!connRef.current || !connRef.current.open) return;
    
    setMessages(prev => {
      const pending = prev.filter(m => m.sender === 'me' && m.status === 'pending');
      if (pending.length === 0) return prev;

      console.log(`🚀 Flushing ${pending.length} pending messages...`);
      pending.forEach(msg => {
        try { connRef.current?.send({ ...msg, status: 'sent' }); } catch(e) {}
      });

      return prev.map(m => m.status === 'pending' ? { ...m, status: 'sent' } : m);
    });
  }, []);

  // 3. CONNECTION HANDLER
  const handleConnection = useCallback((connection: DataConnection) => {
    if (connRef.current?.open && connRef.current.peer === connection.peer) return;

    console.log(`🔗 Link Established: ${connection.peer}`);
    connRef.current = connection;
    // We don't need setConn state if we rely on refs and isConnected
    setIsConnected(true);
    setRemotePeerId(connection.peer);
    localStorage.setItem('last_target_id', connection.peer);

    connection.on('open', () => {
      setIsConnected(true);
      flushQueue(); 
    });

    connection.on('data', async (data: any) => {
      if (data.sender !== 'me') {
        Haptics.impact({ style: ImpactStyle.Light });
        
        let body = "New Message";
        if (data.type === 'image') body = "📷 Photo";
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

    connection.on('close', () => {
      console.log("❌ Link Closed");
      setIsConnected(false);
    });
    
    connection.on('error', () => setIsConnected(false));
  }, [flushQueue]);

  // 4. SMART INITIALIZATION
  const initializePeer = useCallback(() => {
    if (!myId) return;
    if (peerRef.current && !peerRef.current.destroyed) return;

    console.log("⚡ Identity Online:", myId);
    
    const newPeer = new Peer(myId, {
      host: '0.peerjs.com', port: 443, secure: true,
      config: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] }
    });

    // Fixed warning: Removed unused 'id' parameter
    newPeer.on('open', () => {
      peerRef.current = newPeer;
      
      const lastTarget = localStorage.getItem('last_target_id');
      if (lastTarget && !connRef.current?.open) {
        console.log("🔄 Auto-Dialing:", lastTarget);
        const c = newPeer.connect(lastTarget, { reliable: true });
        handleConnection(c);
      }
    });

    newPeer.on('connection', handleConnection);
    
    newPeer.on('error', (err) => {
      console.error("Peer Error:", err);
      if (err.type === 'network' || err.type === 'peer-unavailable') {
         setTimeout(initializePeer, 5000);
      }
    });
  }, [myId, handleConnection]);

  // 5. APP RESUME
  useEffect(() => {
    initializePeer();
    
    const sub = App.addListener('appStateChange', ({ isActive }) => {
      if (isActive) {
        console.log("📱 App Woke Up");
        if (!peerRef.current || peerRef.current.destroyed) {
           initializePeer();
        } else {
           const lastTarget = localStorage.getItem('last_target_id');
           if (lastTarget && (!connRef.current || !connRef.current.open)) {
              console.log("📞 Line dead. Redialing...");
              const c = peerRef.current.connect(lastTarget, { reliable: true });
              handleConnection(c);
           }
        }
      }
    });
    return () => { sub.then(s => s.remove()); };
  }, [initializePeer, handleConnection]);

  const sendMessage = (content: string, userName: string, type: any = 'text') => {
    const msg: Message = {
      id: crypto.randomUUID(), text: content, sender: 'me', senderName: userName,
      timestamp: Date.now(), type, status: 'pending'
    };

    setMessages(prev => [...prev, msg]);

    if (connRef.current?.open) {
      try {
        connRef.current.send({ ...msg, status: 'sent' });
        setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, status: 'sent' } : m));
      } catch (e) { console.log("Send failed, queuing"); }
    } else {
       const lastTarget = localStorage.getItem('last_target_id');
       if(peerRef.current && lastTarget) {
          const c = peerRef.current.connect(lastTarget);
          handleConnection(c);
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

  return { isConnected, sendMessage, messages, remotePeerId, clearHistory, unlinkConnection, connectToPeer };
};