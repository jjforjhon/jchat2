import { useState, useEffect, useCallback, useRef } from 'react';
import Peer, { DataConnection } from 'peerjs';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { App } from '@capacitor/app';

// ✅ YOUR RENDER SERVER URL
const API_URL = "https://jchat-server.onrender.com";

export interface Message {
  id: string;
  text: string;
  sender: 'me' | 'them';
  senderName?: string;
  senderAvatar?: string;
  timestamp: number;
  type: 'text' | 'image' | 'video' | 'audio' | 'reaction';
  status: 'sent' | 'pending';
}

interface Profile {
  id: string;
  name: string;
  avatar: string;
}

const HEARTBEAT_INTERVAL = 5000;
const HEARTBEAT_TIMEOUT  = 15000;

export const usePeer = (myProfile: Profile) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnectionBroken, setIsConnectionBroken] = useState(false);
  const [remoteProfile, setRemoteProfile] = useState<{ name: string; avatar: string } | null>(null);

  const peerRef = useRef<Peer | null>(null);
  const connRef = useRef<DataConnection | null>(null);
  const heartbeatTimerRef = useRef<any>(null);
  const lastPongRef = useRef<number>(Date.now());

  // HISTORY
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

  // --- HYBRID RELAY LOGIC ---
  
  // 1. Poll for offline messages from Render Server
  useEffect(() => {
    if (!myProfile.id) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${API_URL}/queue/sync/${myProfile.id}`);
        const data = await res.json();
        
        if (data && data.length > 0) {
          const newMsgs: string[] = [];
          
          setMessages(prev => {
            const updated = [...prev];
            let hasNew = false;
            
            data.forEach((msg: Message) => {
              if (!updated.find(existing => existing.id === msg.id)) {
                updated.push({ ...msg, sender: 'them', status: 'sent' });
                newMsgs.push(msg.id);
                hasNew = true;
                
                // Notify
                Haptics.impact({ style: ImpactStyle.Medium });
                LocalNotifications.schedule({
                  notifications: [{
                    title: `J-CHAT (Relay)`,
                    body: msg.type === 'text' ? msg.text : 'New Media Message',
                    id: Date.now(),
                    schedule: { at: new Date(Date.now() + 100) },
                  }],
                });
              }
            });
            return hasNew ? updated : prev;
          });

          // ACK received messages to delete them from server
          if (newMsgs.length > 0) {
            await fetch(`${API_URL}/queue/ack`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ userId: myProfile.id, messageIds: newMsgs })
            });
          }
        }
      } catch (e) {
        // Silent fail on polling error
      }
    }, 5000); // Check every 5 seconds

    return () => clearInterval(interval);
  }, [myProfile.id]);

  // 2. Send via Server (Fallback)
  const sendViaRelay = async (msg: Message, targetId: string) => {
    try {
      await fetch(`${API_URL}/queue/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toUserId: targetId, message: msg })
      });
      return true;
    } catch (e) {
      console.error("Relay Failed", e);
      return false;
    }
  };

  const stopHeartbeat = () => {
    if (heartbeatTimerRef.current) {
      clearInterval(heartbeatTimerRef.current);
      heartbeatTimerRef.current = null;
    }
  };

  const startHeartbeat = () => {
    stopHeartbeat();
    lastPongRef.current = Date.now();

    heartbeatTimerRef.current = setInterval(() => {
      const conn = connRef.current;
      if (!conn || !conn.open) {
        markBroken();
        return;
      }
      try { conn.send({ type: '__PING__' }); } catch { markBroken(); }
      if (Date.now() - lastPongRef.current > HEARTBEAT_TIMEOUT) {
        markBroken();
      }
    }, HEARTBEAT_INTERVAL);
  };

  const markBroken = () => {
    stopHeartbeat();
    setIsConnected(false);
    setIsConnectionBroken(true);
  };

  const handleConnection = useCallback((connection: DataConnection) => {
    try { connRef.current?.close(); } catch {}
    connRef.current = connection;

    connection.on('open', () => {
      setIsConnected(true);
      setIsConnectionBroken(false);
      setRemotePeerId(connection.peer);
      localStorage.setItem('last_target_id', connection.peer);

      connection.send({ type: 'PROFILE_SYNC', name: myProfile.name, avatar: myProfile.avatar });
      startHeartbeat();

      // Flush pending messages via P2P
      setMessages(prev => {
        const pending = prev.filter(m => m.sender === 'me' && m.status === 'pending');
        pending.forEach(msg => {
          try { connection.send({ ...msg, status: 'sent', senderAvatar: myProfile.avatar }); } catch {}
        });
        return prev.map(m => (m.status === 'pending' ? { ...m, status: 'sent' } : m));
      });
    });

    connection.on('data', async (data: any) => {
      if (data?.type === '__PING__') { try { connection.send({ type: '__PONG__' }); } catch {} return; }
      if (data?.type === '__PONG__') { lastPongRef.current = Date.now(); return; }
      if (data?.type === 'PROFILE_SYNC') { setRemoteProfile({ name: data.name, avatar: data.avatar }); return; }

      if (data.sender !== 'me') {
        Haptics.impact({ style: ImpactStyle.Light });
        await LocalNotifications.schedule({
          notifications: [{ title: `J-CHAT`, body: 'New Message', id: Date.now(), schedule: { at: new Date(Date.now() + 100) } }],
        });
      }

      setMessages(prev => {
        if (prev.find(m => m.id === data.id)) return prev;
        return [...prev, { ...data, sender: 'them' }];
      });
    });

    connection.on('close', markBroken);
    connection.on('error', markBroken);
  }, [myProfile]);

  const initializePeer = useCallback(() => {
    if (!myProfile.id) return;
    if (peerRef.current && !peerRef.current.destroyed) return;

    const newPeer = new Peer(myProfile.id, {
      host: '0.peerjs.com',
      port: 443,
      secure: true,
      config: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] },
    });

    newPeer.on('open', () => { peerRef.current = newPeer; });
    newPeer.on('connection', handleConnection);
    newPeer.on('error', err => console.log('Peer Error', err));
  }, [myProfile.id, handleConnection]);

  useEffect(() => {
    initializePeer();
    let handle: any;
    (async () => {
      handle = await App.addListener('appStateChange', ({ isActive }) => {
        if (isActive) {
          const lastTarget = localStorage.getItem('last_target_id');
          if (lastTarget && (!connRef.current || !connRef.current.open)) markBroken();
        }
      });
    })();
    return () => { if (handle) handle.remove(); };
  }, [initializePeer]);

  const retryConnection = () => {
    const lastTarget = localStorage.getItem('last_target_id');
    if (!lastTarget) return;
    try { connRef.current?.close(); } catch {}
    setIsConnectionBroken(false);
    if (!peerRef.current || peerRef.current.destroyed) {
      peerRef.current = null;
      initializePeer();
      setTimeout(() => {
        if (peerRef.current) {
          const c = peerRef.current.connect(lastTarget, { reliable: true });
          handleConnection(c);
        }
      }, 1000);
    } else {
      const c = peerRef.current.connect(lastTarget, { reliable: true });
      handleConnection(c);
    }
  };

  const sendMessage = async (content: string, type: any = 'text') => {
    const msg: Message = {
      id: crypto.randomUUID(),
      text: content,
      sender: 'me',
      senderName: myProfile.name,
      senderAvatar: myProfile.avatar,
      timestamp: Date.now(),
      type,
      status: 'pending',
    };

    setMessages(prev => [...prev, msg]);

    // Try P2P First
    if (connRef.current?.open) {
      try {
        connRef.current.send({ ...msg, status: 'sent' });
        setMessages(prev => prev.map(m => (m.id === msg.id ? { ...m, status: 'sent' } : m)));
        return;
      } catch {
        markBroken();
      }
    }

    // Fallback to Server Relay (Dead Drop)
    const target = remotePeerId || localStorage.getItem('last_target_id');
    if (target) {
      const sent = await sendViaRelay(msg, target);
      if (sent) {
        setMessages(prev => prev.map(m => (m.id === msg.id ? { ...m, status: 'sent' } : m)));
      }
    }
  };

  const clearHistory = () => {
    if (confirm('Clear?')) {
      setMessages([]);
      localStorage.removeItem('jchat_history');
    }
  };

  const unlinkConnection = () => {
    if (!confirm('Unlink?')) return;
    try { connRef.current?.close(); } catch {}
    stopHeartbeat();
    localStorage.removeItem('last_target_id');
    setRemotePeerId('');
    setIsConnected(false);
    setIsConnectionBroken(false);
  };

  const connectToPeer = (id: string) => {
    const c = peerRef.current?.connect(id, { reliable: true });
    if (c) handleConnection(c);
  };

  return {
    isConnected,
    sendMessage,
    messages,
    remotePeerId,
    clearHistory,
    unlinkConnection,
    connectToPeer,
    remoteProfile,
    isConnectionBroken,
    retryConnection,
  };
};
