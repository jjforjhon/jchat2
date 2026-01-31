import { useState, useEffect, useRef, useCallback } from 'react';
import Peer, { DataConnection } from 'peerjs';
import axios from 'axios';
import { App } from '@capacitor/app';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { encryptMessage, decryptMessage } from '../utils/crypto';

// ⚠️ YOUR LAPTOP IP (Ensure this is correct)
const SERVER_URL = 'http://192.168.1.35:3000'; 

export interface Message {
  id: string;
  text: string;
  sender: 'me' | 'them';
  timestamp: number;
  type: 'text' | 'image' | 'video' | 'audio' | 'reaction';
  status: 'pending' | 'delivered';
}

export const usePeer = (myId: string, targetId: string) => {
  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const peerRef = useRef<Peer | null>(null);
  const connRef = useRef<DataConnection | null>(null);
  const pollTimer = useRef<any>(null);

  // 1. ROBUST SYNC (Fetch from Server)
  const fetchQueue = useCallback(async () => {
    if (!myId) return;
    try {
      const res = await axios.get(`${SERVER_URL}/queue/sync/${myId}`);
      const queued = res.data;
      
      if (queued.length > 0) {
        console.log(`📥 Received ${queued.length} msgs from Relay`);
        Haptics.impact({ style: ImpactStyle.Medium });
        
        setMessages(prev => {
          const ids = new Set(prev.map(m => m.id));
          const newMsgs = queued
            .filter((m: any) => !ids.has(m.id))
            .map((m: any) => ({ ...m, text: decryptMessage(m.text), sender: 'them' }));
          return [...prev, ...newMsgs];
        });

        // Delete from server immediately after fetching
        await axios.post(`${SERVER_URL}/queue/ack`, { 
          userId: myId, 
          messageIds: queued.map((m:any)=>m.id) 
        });
      }
    } catch (e) { 
      // Silent fail (server might be unreachable)
    }
  }, [myId]);

  // 2. SAFETY POLLING (Aggressive Mode: 1.5s)
  useEffect(() => {
    // Check server every 1.5 seconds (1500ms)
    clearInterval(pollTimer.current);
    pollTimer.current = setInterval(fetchQueue, 1500); // ✅ UPDATED to 1.5s
    return () => clearInterval(pollTimer.current);
  }, [fetchQueue]);

  // 3. P2P SETUP
  const initPeer = useCallback(() => {
    if (!myId) return;
    if (peerRef.current) peerRef.current.destroy();

    const peer = new Peer(myId, { host: '0.peerjs.com', port: 443, secure: true });
    peerRef.current = peer;

    peer.on('open', () => {
      console.log("✅ My P2P ID:", myId);
      if (targetId) {
        const conn = peer.connect(targetId, { reliable: true });
        handleConn(conn);
      }
      fetchQueue();
    });

    peer.on('connection', handleConn);
    
    peer.on('error', (err) => {
      console.warn("Peer Error:", err);
      setIsConnected(false);
      setTimeout(initPeer, 5000); 
    });
  }, [myId, targetId]);

  const handleConn = (conn: DataConnection) => {
    connRef.current = conn;
    conn.on('open', () => {
        console.log("⚡ P2P Connected!");
        setIsConnected(true);
        conn.send({ type: 'PING' });
    });
    conn.on('data', (data: any) => {
        if (data.type === 'PING') return; 
        
        if (data.id) {
            console.log("⚡ Received P2P Message");
            Haptics.impact({ style: ImpactStyle.Light });
            setMessages(p => {
               if (p.some(m => m.id === data.id)) return p;
               return [...p, { ...data, text: decryptMessage(data.text), sender: 'them' }];
            });
        }
    });
    conn.on('close', () => { 
        console.log("❌ P2P Closed"); 
        setIsConnected(false); 
    });
    conn.on('error', () => setIsConnected(false));
  };

  useEffect(() => {
    App.addListener('appStateChange', ({ isActive }) => { if (isActive) { initPeer(); fetchQueue(); } });
    initPeer();
  }, [initPeer]);

  // 4. SMART SEND
  const sendMessage = async (txt: string, type: any = 'text') => {
    const msg = { id: crypto.randomUUID(), text: txt, sender: 'me' as const, timestamp: Date.now(), type, status: 'pending' as const };
    setMessages(p => [...p, msg]);

    const payload = { ...msg, text: encryptMessage(txt) }; 

    // ATTEMPT 1: P2P
    if (isConnected && connRef.current?.open) {
      try { 
        connRef.current.send(payload); 
        return; 
      } catch (e) {
        console.warn("P2P Failed, switching to Relay...");
        setIsConnected(false); 
      }
    }

    // ATTEMPT 2: RELAY SERVER
    try { 
      await axios.post(`${SERVER_URL}/queue/send`, { toUserId: targetId, message: payload }); 
    } catch (e) { 
      console.error("❌ Message Failed"); 
    }
  };

  const clearHistory = () => setMessages([]);
  const unlinkConnection = () => { connRef.current?.close(); setIsConnected(false); };

  return { isConnected, sendMessage, messages, clearHistory, unlinkConnection };
};