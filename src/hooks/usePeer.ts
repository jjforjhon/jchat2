import { useState, useEffect, useCallback } from 'react';
import Peer, { DataConnection } from 'peerjs';

export interface Message {
  id: string;
  text: string;
  sender: 'me' | 'them';
  timestamp: number;
  type: 'text' | 'image' | 'video' | 'NUKE_COMMAND';
}

export const usePeer = (myId: string, encryptionKey: string) => {
  const [peer, setPeer] = useState<Peer | null>(null);
  const [conn, setConn] = useState<DataConnection | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);

  // 1. Initialize Peer
  useEffect(() => {
    if (!myId) return;

    const newPeer = new Peer(myId, { debug: 2 });

    newPeer.on('open', (id) => {
      console.log('✅ Connected to Peer Cloud:', id);
      setPeer(newPeer);
    });

    newPeer.on('connection', (connection) => {
      handleConnection(connection);
    });

    newPeer.on('error', (err) => {
      console.error("Peer Error:", err);
      if (err.type === 'peer-unavailable') {
        alert("❌ User not found! Check the ID exactly.");
      }
    });

    return () => { newPeer.destroy(); };
  }, [myId]);

  // 2. Handle Connection
  const handleConnection = useCallback((connection: DataConnection) => {
    setConn(connection);
    setIsConnected(true);
    // Alert the user when connected!
    alert("✅ Secure Link Established!");

    connection.on('data', async (data: any) => {
      try {
        if (data.type === 'NUKE_COMMAND') {
          localStorage.clear();
          sessionStorage.clear();
          window.location.reload();
          return;
        }
        setMessages((prev) => [...prev, { ...data, sender: 'them' }]);
      } catch (err) {
        console.error("Receive error", err);
      }
    });

    connection.on('close', () => {
      setIsConnected(false);
      setConn(null);
      alert("⚠️ Connection Lost");
    });
  }, [encryptionKey]);

  // 3. Connect to someone
  const connectToPeer = (targetId: string) => {
    // ERROR CHECK 1: Is the server ready?
    if (!peer) {
      alert("❌ Server not ready. Please refresh the page.");
      return;
    }
    
    // ERROR CHECK 2: Are you calling yourself?
    if (targetId === myId) {
      alert("❌ You cannot connect to yourself! Open a new Incognito window.");
      return;
    }

    // ERROR CHECK 3: Is ID empty?
    if (!targetId) {
        alert("❌ Please paste a Target ID.");
        return;
    }

    console.log("Connecting to:", targetId);
    const connection = peer.connect(targetId, { reliable: true });
    
    connection.on('open', () => handleConnection(connection));
    
    // If connection hangs
    setTimeout(() => {
        if (!connection.open) {
            console.log("Connection timed out or waiting...");
        }
    }, 5000);
  };

  const sendMessage = (content: string, type: 'text' | 'image' | 'video' | 'NUKE_COMMAND' = 'text') => {
    if (conn && isConnected) {
      const msg: Message = {
        id: crypto.randomUUID(),
        text: content,
        sender: 'me',
        timestamp: Date.now(),
        type
      };
      conn.send(msg); 
      setMessages((prev) => [...prev, msg]);
    }
  };

  return { isConnected, connectToPeer, sendMessage, messages, setMessages };
};