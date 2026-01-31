import { useState, useEffect, useRef, useCallback } from 'react';
import Peer, { DataConnection } from 'peerjs';
import axios from 'axios';
import { App } from '@capacitor/app';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { encryptMessage, decryptMessage } from '../utils/crypto';

const SERVER_URL = 'http://192.168.1.35:3000'; // Change to your server IP

export interface Message {
  id: string;
  text: string;
  sender: 'me' | 'them';
  timestamp: number;
  type: 'text' | 'image' | 'video' | 'audio' | 'reaction';
  status: 'pending' | 'delivered';
}

const genId = () =>
  Math.random().toString(36).slice(2) + Date.now().toString(36);

export const usePeer = (myId: string, targetId: string) => {
  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);

  const peerRef = useRef<Peer | null>(null);
  const connRef = useRef<DataConnection | null>(null);
  const pollTimer = useRef<any>(null);

  // ---------------- RELAY SYNC ----------------
  const fetchQueue = useCallback(async () => {
    if (!myId) return;

    try {
      const res = await axios.get(`${SERVER_URL}/queue/sync/${myId}`);
      const queued = res.data as any[];

      if (queued.length > 0) {
        Haptics.impact({ style: ImpactStyle.Medium });

        setMessages(prev => {
          const ids = new Set(prev.map(m => m.id));
          const newMsgs = queued
            .filter(m => !ids.has(m.id))
            .map(m => ({
              ...m,
              text: decryptMessage(m.text),
              sender: 'them' as const,
              status: 'delivered' as const
            }));
          return [...prev, ...newMsgs];
        });

        await axios.post(`${SERVER_URL}/queue/ack`, {
          userId: myId,
          messageIds: queued.map(m => m.id)
        });
      }
    } catch {
      // Server unreachable, ignore
    }
  }, [myId]);

  useEffect(() => {
    clearInterval(pollTimer.current);
    pollTimer.current = setInterval(fetchQueue, 1500);
    return () => clearInterval(pollTimer.current);
  }, [fetchQueue]);

  // ---------------- P2P INIT ----------------
  const initPeer = useCallback(() => {
    if (!myId || !targetId || myId === targetId) return;

    setIsConnected(false);

    if (peerRef.current) {
      peerRef.current.destroy();
      peerRef.current = null;
    }

    const peer = new Peer(myId, { host: '0.peerjs.com', port: 443, secure: true });
    peerRef.current = peer;

    peer.on('open', () => {
      if (targetId) {
        const conn = peer.connect(targetId, { reliable: true });
        handleConn(conn);
      }
      fetchQueue();
    });

    peer.on('connection', (conn) => {
      handleConn(conn);
    });

    peer.on('error', () => {
      setIsConnected(false);
      setTimeout(initPeer, 5000);
    });
  }, [myId, targetId, fetchQueue]);

  // ---------------- CONNECTION HANDLER ----------------
  const handleConn = (conn: DataConnection) => {
    connRef.current = conn;

    conn.on('open', () => {
      conn.send({ type: 'PING' });
    });

    conn.on('data', (data: any) => {
      if (data?.type === 'PING') {
        conn.send({ type: 'PONG' });
        return;
      }

      if (data?.type === 'PONG') {
        if (!isConnected) setIsConnected(true);
        return;
      }

      if (data && typeof data.id === 'string' && typeof data.text === 'string') {
        Haptics.impact({ style: ImpactStyle.Light });

        setMessages(prev => {
          if (prev.some(m => m.id === data.id)) return prev;
          return [
            ...prev,
            {
              ...data,
              text: decryptMessage(data.text),
              sender: 'them',
              status: 'delivered'
            }
          ];
        });
      }
    });

    conn.on('close', () => setIsConnected(false));
    conn.on('error', () => setIsConnected(false));
  };

  // ---------------- APP LIFECYCLE (FIXED) ----------------
  useEffect(() => {
    let listenerHandle: any = null;

    const setup = async () => {
      listenerHandle = await App.addListener('appStateChange', ({ isActive }) => {
        if (isActive) {
          initPeer();
          fetchQueue();
        }
      });
    };

    setup();
    initPeer();

    return () => {
      if (listenerHandle) {
        listenerHandle.remove();
      }
    };
  }, [initPeer, fetchQueue]);

  // ---------------- SEND MESSAGE ----------------
  const sendMessage = async (txt: string, type: any = 'text') => {
    const msg: Message = {
      id: genId(),
      text: txt,
      sender: 'me',
      timestamp: Date.now(),
      type,
      status: 'pending'
    };

    setMessages(p => [...p, msg]);

    const payload = { ...msg, text: encryptMessage(txt), sender: 'me' };

    if (isConnected && connRef.current?.open) {
      try {
        connRef.current.send(payload);
        setMessages(p =>
          p.map(m => (m.id === msg.id ? { ...m, status: 'delivered' } : m))
        );
        return;
      } catch {
        setIsConnected(false);
      }
    }

    try {
      await axios.post(`${SERVER_URL}/queue/send`, {
        toUserId: targetId,
        message: payload
      });

      setMessages(p =>
        p.map(m => (m.id === msg.id ? { ...m, status: 'delivered' } : m))
      );
    } catch {
      console.error('Send failed');
    }
  };

  const clearHistory = () => setMessages([]);
  const unlinkConnection = () => {
    connRef.current?.close();
    setIsConnected(false);
  };

  return { isConnected, sendMessage, messages, clearHistory, unlinkConnection };
};
