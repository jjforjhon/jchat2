import { useState, useEffect, useRef, useCallback } from 'react';
import Peer, { DataConnection } from 'peerjs';
import { vault } from '../utils/storage';

export interface Message {
  id: string;
  text: string;
  sender: 'me' | 'them';
  timestamp: number;
  type: 'text' | 'image' | 'video';
}

export const usePeer = (myId: string, encryptionKey: string) => {
  const [peer, setPeer] = useState<Peer | null>(null);
  const [conn, setConn] = useState<DataConnection | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const isInitiator = useRef(false);

  // 1. Initialize Peer (Connect to the Public Switchboard)
  useEffect(() => {
    if (!myId) return;

    // We use the Public PeerJS Cloud (Free & Reliable)
    const newPeer = new Peer(myId, {
      debug: 2,
    });

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
      // If ID is taken, it usually means we are already connected or a ghost session exists
      if (err.type === 'unavailable-id') {
        alert("ID conflict. Refreshing...");
        window.location.reload();
      }
    });

    return () => {
      newPeer.destroy();
    };
  }, [myId]);

  // 2. Handle Incoming/Outgoing Connections
  const handleConnection = useCallback((connection: DataConnection) => {
    setConn(connection);
    setIsConnected(true);

    connection.on('data', async (data: any) => {
      // Decrypt incoming message
      try {
        if (data.type === 'NUKE_COMMAND') {
          // Check for kill code (optional logic)
          localStorage.clear();
          window.location.reload();
          return;
        }
        
        // If it's a regular message
        const decryptedMsg = {
           ...data,
           sender: 'them' as const
           // In a real app, you would decrypt 'data.text' here using 'encryptionKey'
           // For now, we assume the tunnel is secure enough or data is pre-decrypted
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

  // 3. Connect to someone else
  const connectToPeer = (targetId: string) => {
    if (!peer) {
      alert("Not connected to server yet. Please wait.");
      return;
    }
    
    if (targetId === myId) {
      alert("You cannot connect to yourself!");
      return;
    }

    console.log(`🔗 Connecting to ${targetId}...`);
    isInitiator.current = true;
    const connection = peer.connect(targetId, { reliable: true });
    
    // Safety timeout
    const timeout = setTimeout(() => {
        if (!connection.open) {
            alert("Connection timed out. Is the other person online?");
            connection.close();
        }
    }, 5000);

    connection.on('open', () => {
      clearTimeout(timeout);
      console.log("✅ Connection established!");
      handleConnection(connection);
    });
    
    connection.on('error', (err) => {
        console.error("Connection Error:", err);
        alert("Failed to connect. Check ID.");
    });
  };

  // 4. Send Message Function
  const sendMessage = (content: string, type: 'text' | 'image' | 'video' = 'text') => {
    if (conn && isConnected) {
      const msg: Message = {
        id: crypto.randomUUID(),
        text: content,
        sender: 'me',
        timestamp: Date.now(),
        type
      };

      // In a real app, Encrypt 'content' here before sending
      conn.send(msg); 
      setMessages((prev) => [...prev, msg]);
    }
  };

  return { isConnected, connectToPeer, sendMessage, messages, setMessages };
};