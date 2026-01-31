import { useState, useEffect, useRef, useCallback } from 'react';
import Peer, { DataConnection } from 'peerjs';
import axios from 'axios';
import { App } from '@capacitor/app';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { encryptMessage, decryptMessage } from '../utils/crypto';

const SERVER_URL = 'http://192.168.1.35:3000'; // Ensure this matches your laptop IP

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

  // 1. RELAY SYNC (Always active as backup)
  const fetchQueue = useCallback(async () => {
    if (!myId) return;
    try {
      const res = await axios.get(`${SERVER_URL}/queue/sync/${myId}`);
      const queued = res.data;
      
      if (queued.length > 0) {
        console.log(`📥 [RELAY] Fetched ${queued.length} msgs`);
        Haptics.impact({ style: ImpactStyle.Medium });
        
        setMessages(prev => {
          const ids = new Set(prev.map(m => m.id));
          const newMsgs = queued
            .filter((m: any) => !ids.has(m.id))
            .map((m: any) => ({ ...m, text: decryptMessage(m.text), sender: 'them' }));
          return [...prev, ...newMsgs];
        });

        await axios.post(`${SERVER_URL}/queue/ack`, { 
          userId: myId, 
          messageIds: queued.map((m:any)=>m.id) 
        });
      }
    } catch (e) { /* Server unreachable, ignore */ }
  }, [myId]);

  // Polling for Relay
  useEffect(() => {
    clearInterval(pollTimer.current);
    pollTimer.current = setInterval(fetchQueue, 1500);
    return () => clearInterval(pollTimer.current);
  }, [fetchQueue]);

  // 2. STRICT P2P HANDSHAKE
  const initPeer = useCallback(() => {
    if (!myId || myId === targetId) return; // Prevent self-connection
    if (peerRef.current) peerRef.current.destroy();

    const peer = new Peer(myId, { host: '0.peerjs.com', port: 443, secure: true });
    peerRef.current = peer;

    peer.on('open', () => {
      console.log(`✅ ID Active: ${myId}`);
      if (targetId) {
        // Try to connect, but DON'T mark connected yet
        const conn = peer.connect(targetId, { reliable: true });
        handleConn(conn);
      }
      fetchQueue();
    });

    peer.on('connection', (conn) => {
        // Incoming connection? Handle it the same way
        handleConn(conn);
    });
    
    peer.on('error', () => { setIsConnected(false); setTimeout(initPeer, 5000); });
  }, [myId, targetId]);

  const handleConn = (conn: DataConnection) => {
    connRef.current = conn;
    
    conn.on('open', () => {
        console.log("🟡 Socket Open... Waiting for Verification");
        // DO NOT set setIsConnected(true) here!
        // Instead, challenge the other peer.
        conn.send({ type: 'PING' }); 
    });

    conn.on('data', (data: any) => {
        // HANDSHAKE LOGIC
        if (data.type === 'PING') { 
            // They challenged us -> We reply PONG
            conn.send({ type: 'PONG' }); 
            return; 
        }
        if (data.type === 'PONG') { 
            // We challenged them -> They replied -> NOW WE ARE CONNECTED
            console.log("🟢 VERIFIED! Connection Secured.");
            setIsConnected(true); 
            return; 
        }

        // REAL MESSAGE LOGIC
        if (data.id) {
            console.log("⚡ Msg Recv via P2P");
            Haptics.impact({ style: ImpactStyle.Light });
            setMessages(p => {
               if (p.some(m => m.id === data.id)) return p;
               return [...p, { ...data, text: decryptMessage(data.text), sender: 'them' }];
            });
        }
    });

    conn.on('close', () => { setIsConnected(false); });
    conn.on('error', () => { setIsConnected(false); });
  };

  useEffect(() => {
    App.addListener('appStateChange', ({ isActive }) => { if (isActive) { initPeer(); fetchQueue(); } });
    initPeer();
  }, [initPeer]);

  // 3. SEND LOGIC
  const sendMessage = async (txt: string, type: any = 'text') => {
    const msg = { id: crypto.randomUUID(), text: txt, sender: 'me' as const, timestamp: Date.now(), type, status: 'pending' as const };
    setMessages(p => [...p, msg]);

    const payload = { ...msg, text: encryptMessage(txt) }; 

    // P2P Attempt (Only if verified)
    if (isConnected && connRef.current?.open) {
      try { connRef.current.send(payload); return; } 
      catch (e) { setIsConnected(false); }
    }

    // Relay Fallback
    try { await axios.post(`${SERVER_URL}/queue/send`, { toUserId: targetId, message: payload }); } 
    catch (e) { console.error("Send failed"); }
  };

  const clearHistory = () => setMessages([]);
  const unlinkConnection = () => { connRef.current?.close(); setIsConnected(false); };

  return { isConnected, sendMessage, messages, clearHistory, unlinkConnection };
};