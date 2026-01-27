import { useEffect, useState, useRef } from 'react';
import Peer, { DataConnection } from 'peerjs';
import { v4 as uuidv4 } from 'uuid';
import { vault } from '../utils/storage';
import CryptoJS from 'crypto-js';

export type MessageType = 'text' | 'image' | 'video' | 'audio' | 'NUKE_COMMAND';

export interface Message {
  id: string;
  sender: 'me' | 'them';
  type: MessageType;
  content: string;
  timestamp: number;
}

function isMessageObject(obj: any): obj is Omit<Message, 'sender'> {
  return (
    obj &&
    typeof obj.id === 'string' &&
    typeof obj.type === 'string' &&
    typeof obj.content === 'string' &&
    typeof obj.timestamp === 'number'
  );
}

// 64KB is efficient, but we must pace it.
const CHUNK_SIZE = 64 * 1024; 

export const usePeer = (myId: string, encryptionKey: string) => {
  const [peer, setPeer] = useState<Peer | null>(null);
  const [conn, setConn] = useState<DataConnection | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);

  const keyRef = useRef(encryptionKey);
  const fileBuffer = useRef<Map<string, { total: number, count: number, parts: string[] }>>(new Map());

  useEffect(() => {
    keyRef.current = encryptionKey;
  }, [encryptionKey]);

  useEffect(() => {
    if (!myId) return;
    const newPeer = new Peer(myId, { debug: 0 });

    newPeer.on('open', () => setPeer(newPeer));
    newPeer.on('connection', (connection) => handleConnection(connection));
    
    newPeer.on('error', (err: any) => {
      console.error("Peer Error:", err);
      if (err.type === 'unavailable-id') {
        alert("ID ALREADY IN USE. Close other tabs.");
      }
    });
    
    return () => newPeer.destroy();
  }, [myId]);

  const handleConnection = (connection: DataConnection) => {
    setConn(connection);
    setIsConnected(true);

    connection.on('data', (data: any) => {
      if (data && data.type === 'CHUNK') {
        handleIncomingChunk(data);
        return;
      }
      if (data && data.payload) {
        processEncryptedPayload(data.payload);
      }
    });

    connection.on('close', () => setIsConnected(false));
    connection.on('error', () => setIsConnected(false));
  };

  const handleIncomingChunk = (data: any) => {
    const { id, current, total, chunk } = data;
    
    if (!fileBuffer.current.has(id)) {
      fileBuffer.current.set(id, { total, count: 0, parts: new Array(total) });
    }

    const entry = fileBuffer.current.get(id)!;
    entry.parts[current] = chunk;
    entry.count++;

    if (entry.count === entry.total) {
      const fullEncryptedPayload = entry.parts.join('');
      fileBuffer.current.delete(id);
      processEncryptedPayload(fullEncryptedPayload);
    }
  };

  const processEncryptedPayload = (encryptedText: string) => {
    try {
      const bytes = CryptoJS.AES.decrypt(encryptedText, keyRef.current);
      const decryptedText = bytes.toString(CryptoJS.enc.Utf8);

      if (!decryptedText) return;

      const decryptedData = JSON.parse(decryptedText);

      if (decryptedData.type === 'NUKE_COMMAND') {
        vault.nuke();
        return;
      }

      if (isMessageObject(decryptedData)) {
        setMessages((prev) => [...prev, { ...decryptedData, sender: 'them' }]);
      }
    } catch (e) {
      console.error("Packet Error");
    }
  };

  const connectToPeer = (peerId: string) => {
    if (!peer) return;
    const connection = peer.connect(peerId, {
      reliable: true,
      serialization: 'json'
    });
    connection.on('open', () => handleConnection(connection));
  };

  const sendMessage = async (content: string, type: MessageType = 'text') => {
    if (!conn || !isConnected) return;

    const currentKey = keyRef.current;

    if (type === 'NUKE_COMMAND') {
      const encryptedPayload = CryptoJS.AES.encrypt(JSON.stringify({ type: 'NUKE_COMMAND' }), currentKey).toString();
      conn.send({ payload: encryptedPayload });
      vault.nuke();
      return;
    }

    const msg: Message = {
      id: uuidv4(),
      sender: 'me',
      type,
      content,
      timestamp: Date.now(),
    };

    const encryptedPayload = CryptoJS.AES.encrypt(JSON.stringify(msg), currentKey).toString();

    // UPDATE: The "Pacing" Fix
    if (encryptedPayload.length < CHUNK_SIZE) {
      conn.send({ payload: encryptedPayload });
    } else {
      const totalChunks = Math.ceil(encryptedPayload.length / CHUNK_SIZE);
      const transferId = uuidv4(); 

      // Send chunks with a tiny delay (10ms) to prevent crashing the connection
      for (let i = 0; i < totalChunks; i++) {
        const chunk = encryptedPayload.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
        conn.send({
          type: 'CHUNK',
          id: transferId,
          current: i,
          total: totalChunks,
          chunk: chunk
        });
        // This is the Magic Line: Wait 10ms between packets
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    }

    setMessages((prev) => [...prev, msg]);
  };

  return { isConnected, connectToPeer, sendMessage, messages, setMessages };
};