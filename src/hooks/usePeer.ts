import { useState, useEffect, useRef, useCallback } from 'react';
import Peer, { DataConnection } from 'peerjs';

export type MessageType = 'text' | 'image' | 'video' | 'NUKE_COMMAND';

export interface Message {
  id: string;
  text: string;
  sender: 'me' | 'them';
  timestamp: number;
  type: MessageType;
}

/* Runtime validator (CRITICAL for security) */
function isValidMessage(data: any): data is Message {
  return (
    typeof data === 'object' &&
    typeof data.id === 'string' &&
    typeof data.text === 'string' &&
    (data.sender === 'me' || data.sender === 'them') &&
    typeof data.timestamp === 'number' &&
    ['text', 'image', 'video', 'NUKE_COMMAND'].includes(data.type)
  );
}

export const usePeer = (myId: string) => {
  const peerRef = useRef<Peer | null>(null);
  const connRef = useRef<DataConnection | null>(null);

  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);

  /* Strict Mode safe Peer init */
  useEffect(() => {
    if (!myId || peerRef.current) return;

    const peer = new Peer(myId, { debug: 1 });
    peerRef.current = peer;

    peer.on('connection', handleConnection);

    peer.on('error', (err) => {
      console.error('Peer error:', err);
      if (err.type === 'unavailable-id') {
        alert('ID already in use. Reloading.');
        window.location.reload();
      }
    });

    return () => {
      peer.destroy();
      peerRef.current = null;
    };
  }, [myId]);

  const handleConnection = useCallback((connection: DataConnection) => {
    connRef.current = connection;
    setIsConnected(true);

    connection.on('data', (raw) => {
      if (!isValidMessage(raw)) {
        console.warn('Rejected invalid payload');
        return;
      }

      if (raw.type === 'NUKE_COMMAND') {
        localStorage.clear();
        indexedDB.databases?.().then(dbs =>
          dbs.forEach(db => indexedDB.deleteDatabase(db.name!))
        );
        window.location.reload();
        return;
      }

      setMessages((prev) => [...prev, { ...raw, sender: 'them' }]);
    });

    connection.on('close', () => {
      setIsConnected(false);
      connRef.current = null;
    });
  }, []);

  const connectToPeer = (targetId: string) => {
    if (!peerRef.current) {
      alert('Peer not ready');
      return;
    }
    if (targetId === myId) {
      alert('Cannot connect to yourself');
      return;
    }

    const connection = peerRef.current.connect(targetId, { reliable: true });

    connection.on('open', () => handleConnection(connection));
    connection.on('error', () => alert('Connection failed'));
  };

  const sendMessage = (text: string, type: MessageType = 'text') => {
    if (!connRef.current || !isConnected) return;

    const msg: Message = {
      id: crypto.randomUUID(),
      text,
      sender: 'me',
      timestamp: Date.now(),
      type
    };

    connRef.current.send(msg);
    setMessages((prev) => [...prev, msg]);
  };

  return { isConnected, connectToPeer, sendMessage, messages, setMessages };
};
