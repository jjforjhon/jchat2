import { useState, useEffect, useRef, useCallback } from 'react';
import Peer, { DataConnection } from 'peerjs';

// ✅ FIX 1: Add 'NUKE_COMMAND' to the allowed types
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
  const isInitiator = useRef(false);

  useEffect(() => {
    if (!myId) return;

    const newPeer = new Peer(myId, { debug: 2 });

    newPeer.on('open', (id) => {
      console.log('✅ Connected to Peer Cloud with ID:', id);
      setPeer(newPeer);
    });

    newPeer.on('connection', (connection) => {
      console.log('📞 Incoming connection from:', connection.peer);
      handleConnection(connection);
    });

    newPeer.on('error', (err) => {
      console.error('❌ Peer Error:', err);
      if (err.type === 'unavailable-id') {
        alert("ID conflict. Refreshing...");
        window.location.reload();
      }
    });

    return () => {
      newPeer.destroy();
    };
  }, [myId]);

  const handleConnection = useCallback((connection: DataConnection) => {
    setConn(connection);
    setIsConnected(true);

    connection.on('data', async (data: any) => {
      try {
        if (data.type === 'NUKE_COMMAND') {
          localStorage.clear();
          window.location.reload();
          return;
        }
        
        const decryptedMsg = {
           ...data,
           sender: 'them' as const
        };
        
        setMessages((prev) => [...prev, decryptedMsg]);
      } catch (err) {
        console.error("Decryption failed", err);
      }
    });

    connection.on('close', () => {
      setIsConnected(false);
      setConn(null);
      alert("Connection lost");
    });
  }, [encryptionKey]);

  const connectToPeer = (targetId: string) => {
    if (!peer) {
      alert("Not connected to server yet.");
      return;
    }
    
    if (targetId === myId) {
      alert("You cannot connect to yourself!");
      return;
    }

    isInitiator.current = true;
    const connection = peer.connect(targetId, { reliable: true });
    
    connection.on('open', () => {
      console.log("✅ Connection established!");
      handleConnection(connection);
    });
    
    connection.on('error', (err) => {
        console.error("Connection Error:", err);
        alert("Failed to connect. Check ID.");
    });
  };

  // ✅ FIX 2: Update function signature to accept NUKE_COMMAND
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