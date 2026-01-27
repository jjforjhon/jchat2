import { useState, useEffect, useCallback } from 'react';
import Peer, { DataConnection } from 'peerjs';

export interface Message {
  id: string;
  text: string;
  sender: 'me' | 'them';
  timestamp: number;
  type: 'text' | 'image' | 'video' | 'NUKE_COMMAND';
}

// ✅ FIXED: Now strictly accepts 2 arguments (myId, encryptionKey)
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

    return () => { newPeer.destroy(); };
  }, [myId]);

  // 2. Handle Connection
  const handleConnection = useCallback((connection: DataConnection) => {
    setConn(connection);
    setIsConnected(true);

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
    });
  }, [encryptionKey]);

  // 3. Connect to someone
  const connectToPeer = (targetId: string) => {
    if (!peer || targetId === myId) return;
    const connection = peer.connect(targetId, { reliable: true });
    connection.on('open', () => handleConnection(connection));
  };

  // 4. Send Message
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