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

const HEARTBEAT_INTERVAL = 5000;   // send ping every 5s
const HEARTBEAT_TIMEOUT  = 15000;  // if no pong in 15s -> broken

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

      // send ping
      try {
        conn.send({ type: '__PING__' });
      } catch {
        markBroken();
        return;
      }

      // check timeout
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

  // CONNECTION HANDLING
  const handleConnection = useCallback((connection: DataConnection) => {
    // Close any previous connection
    try {
      connRef.current?.close();
    } catch {}

    connRef.current = connection;

    connection.on('open', () => {
      setIsConnected(true);
      setIsConnectionBroken(false);
      setRemotePeerId(connection.peer);
      localStorage.setItem('last_target_id', connection.peer);

      // handshake profile
      connection.send({ type: 'PROFILE_SYNC', name: myProfile.name, avatar: myProfile.avatar });

      // start heartbeat
      startHeartbeat();

      // flush pending
      setMessages(prev => {
        const pending = prev.filter(m => m.sender === 'me' && m.status === 'pending');
        pending.forEach(msg => {
          try {
            connection.send({ ...msg, status: 'sent', senderAvatar: myProfile.avatar });
          } catch {}
        });
        return prev.map(m => (m.status === 'pending' ? { ...m, status: 'sent' } : m));
      });
    });

    connection.on('data', async (data: any) => {
      // heartbeat handling
      if (data?.type === '__PING__') {
        try {
          connection.send({ type: '__PONG__' });
        } catch {}
        return;
      }
      if (data?.type === '__PONG__') {
        lastPongRef.current = Date.now();
        return;
      }

      if (data?.type === 'PROFILE_SYNC') {
        setRemoteProfile({ name: data.name, avatar: data.avatar });
        return;
      }

      if (data.sender !== 'me') {
        Haptics.impact({ style: ImpactStyle.Light });
        await LocalNotifications.schedule({
          notifications: [
            {
              title: `J-CHAT`,
              body: 'New Message',
              id: Date.now(),
              schedule: { at: new Date(Date.now() + 100) },
            },
          ],
        });
      }

      setMessages(prev => {
        if (prev.find(m => m.id === data.id)) return prev;
        return [...prev, { ...data, sender: 'them' }];
      });
    });

    connection.on('close', () => {
      markBroken();
    });

    connection.on('error', () => {
      markBroken();
    });
  }, [myProfile]);

  // INITIALIZATION
  const initializePeer = useCallback(() => {
    if (!myProfile.id) return;
    if (peerRef.current && !peerRef.current.destroyed) return;

    const newPeer = new Peer(myProfile.id, {
      host: '0.peerjs.com',
      port: 443,
      secure: true,
      config: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] },
    });

    newPeer.on('open', () => {
      peerRef.current = newPeer;
    });

    newPeer.on('connection', handleConnection);
    newPeer.on('error', err => console.log('Peer Error', err));
  }, [myProfile.id, handleConnection]);

  // APP STATE LISTENER (FIXED PROMISE CLEANUP)
  useEffect(() => {
    initializePeer();

    let handle: any;

    (async () => {
      handle = await App.addListener('appStateChange', ({ isActive }) => {
        if (isActive) {
          const lastTarget = localStorage.getItem('last_target_id');
          if (lastTarget) {
            // Force heartbeat check
            if (!connRef.current || !connRef.current.open) {
              markBroken();
            }
          }
        }
      });
    })();

    return () => {
      if (handle) {
        handle.remove();
      }
    };
  }, [initializePeer]);

  // MANUAL RECONNECT
  const retryConnection = () => {
    const lastTarget = localStorage.getItem('last_target_id');
    if (!lastTarget) return;

    try {
      connRef.current?.close();
    } catch {}

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

  const sendMessage = (content: string, type: any = 'text') => {
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

    if (connRef.current?.open) {
      try {
        connRef.current.send({ ...msg, status: 'sent' });
        setMessages(prev => prev.map(m => (m.id === msg.id ? { ...m, status: 'sent' } : m)));
      } catch {
        markBroken();
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
    try {
      connRef.current?.close();
    } catch {}
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
