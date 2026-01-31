import { useState, useEffect, useRef, useCallback } from 'react';
import Peer, { DataConnection } from 'peerjs';
import axios from 'axios';
import { App } from '@capacitor/app';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { encryptMessage, decryptMessage } from '../utils/crypto';

// ⚠️ YOUR SERVER IP (Check ipconfig)
const SERVER_URL = 'http://192.168.0.105:3000'; 

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

  // 1. SYNC FROM SERVER
  const fetchQueue = useCallback(async () => {
    if (!myId) return;
    try {
      const res = await axios.get(`${SERVER_URL}/queue/sync/${myId}`);
      const queued = res.data;
      if (queued.length > 0) {
        Haptics.impact({ style: ImpactStyle.Medium });
        setMessages(prev => {
          const ids = new Set(prev.map(m => m.id));
          const newMsgs = queued
            .filter((m: any) => !ids.has(m.id))
            .map((m: any) => ({ ...m, text: decryptMessage(m.text), sender: 'them' }));
          return [...prev, ...newMsgs];
        });
        await axios.post(`${SERVER_URL}/queue/ack`, { userId: myId, messageIds: queued.map((m:any)=>m.id) });
      }
    } catch (e) { console.log("Server unreachable"); }
  }, [myId]);

  // 2. P2P SETUP
  const initPeer = useCallback(() => {
    if (!myId) return;
    if (peerRef.current) peerRef.current.destroy();

    const peer = new Peer(myId, { host: '0.peerjs.com', port: 443, secure: true });
    peerRef.current = peer;

    peer.on('open', () => {
      if (targetId) {
        const conn = peer.connect(targetId, { reliable: true });
        handleConn(conn);
      }
      fetchQueue();
    });

    peer.on('connection', handleConn);
  }, [myId, targetId]);

  const handleConn = (conn: DataConnection) => {
    connRef.current = conn;
    conn.on('open', () => {
        conn.send({ type: 'PING' });
        setInterval(() => conn.send({ type: 'PING' }), 5000); 
    });
    conn.on('data', (data: any) => {
        if (data.type === 'PING') { conn.send({ type: 'PONG' }); return; }
        if (data.type === 'PONG') { setIsConnected(true); return; }
        if (data.id) {
            Haptics.impact({ style: ImpactStyle.Light });
            setMessages(p => [...p, { ...data, text: decryptMessage(data.text), sender: 'them' }]);
        }
    });
    conn.on('close', () => setIsConnected(false));
    conn.on('error', () => setIsConnected(false));
  };

  useEffect(() => {
    App.addListener('appStateChange', ({ isActive }) => { if (isActive) { initPeer(); fetchQueue(); } });
    initPeer();
  }, [initPeer]);

  // 3. ACTIONS
  const sendMessage = async (txt: string, type: any = 'text') => {
    const msg = { id: crypto.randomUUID(), text: txt, sender: 'me' as const, timestamp: Date.now(), type, status: 'pending' as const };
    setMessages(p => [...p, msg]);

    const payload = { ...msg, text: encryptMessage(txt) }; 

    if (isConnected && connRef.current?.open) {
      try { connRef.current.send(payload); return; } catch (e) {}
    }
    try { await axios.post(`${SERVER_URL}/queue/send`, { toUserId: targetId, message: payload }); } 
    catch (e) { console.error("Send failed"); }
  };

  // ✅ ADDED THESE MISSING FUNCTIONS
  const clearHistory = () => setMessages([]);
  const unlinkConnection = () => { connRef.current?.close(); setIsConnected(false); };

  return { isConnected, sendMessage, messages, clearHistory, unlinkConnection };
};