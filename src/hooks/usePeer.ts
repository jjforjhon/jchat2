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

// Helper: Check if data is a valid message object
function isMessageObject(obj: any): obj is Omit<Message, 'sender'> {
  return (
    obj &&
    typeof obj.id === 'string' &&
    typeof obj.type === 'string' &&
    typeof obj.content === 'string' &&
    typeof obj.timestamp === 'number'
  );
}

// CONSTANTS
const CHUNK_SIZE = 16 * 1024; // 16KB (Safe limit for WebRTC)

export const usePeer = (myId: string, encryptionKey: string) => {
  const [peer, setPeer] = useState<Peer | null>(null);
  const [conn, setConn] = useState<DataConnection | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);

  const keyRef = useRef(encryptionKey);
  // Buffer to hold incoming file pieces until they are complete
  const fileBuffer = useRef<Map<string, { total: number, count: number, parts: string[] }>>(new Map());

  useEffect(() => {
    keyRef.current = encryptionKey;
  }, [encryptionKey]);

  useEffect(() => {
    if (!myId) return;
    const newPeer = new Peer(myId);

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
      // 1. Handle CHUNKS (File Pieces)
      if (data && data.type === 'CHUNK') {
        handleIncomingChunk(data);
        return;
      }

      // 2. Handle Standard Messages (Small text)
      if (data && data.payload) {
        processEncryptedPayload(data.payload);
      }
    });

    connection.on('close', () => setIsConnected(false));
    connection.on('error', () => setIsConnected(false));
  };

  // --- LOGIC: Reassemble Chunks ---
  const handleIncomingChunk = (data: any) => {
    const { id, current, total, chunk } = data;
    
    // Initialize buffer for this file ID if new
    if (!fileBuffer.current.has(id)) {
      fileBuffer.current.set(id, { total, count: 0, parts: new Array(total) });
    }

    const entry = fileBuffer.current.get(id)!;
    entry.parts[current] = chunk;
    entry.count++;

    // Check if we have all pieces
    if (entry.count === entry.total) {
      const fullEncryptedPayload = entry.parts.join('');
      fileBuffer.current.delete(id); // Clean memory
      processEncryptedPayload(fullEncryptedPayload);
    }
  };

  // --- LOGIC: Decrypt & Save ---
  const processEncryptedPayload = (encryptedText: string) => {
    try {
      const bytes = CryptoJS.AES.decrypt(encryptedText, keyRef.current);
      const decryptedText = bytes.toString(CryptoJS.enc.Utf8);

      if (!decryptedText) {
        console.error("Decryption failed: Incorrect key or corrupted data.");
        return;
      }

      const decryptedData = JSON.parse(decryptedText);

      if (decryptedData.type === 'NUKE_COMMAND') {
        vault.nuke();
        return;
      }

      if (isMessageObject(decryptedData)) {
        setMessages((prev) => [...prev, { ...decryptedData, sender: 'them' }]);
      }
    } catch (e) {
      console.error("Failed to process message:", e);
    }
  };

  const connectToPeer = (peerId: string) => {
    if (!peer) return;
    const connection = peer.connect(peerId);
    connection.on('open', () => handleConnection(connection));
  };

  // --- LOGIC: Send (With Chunking) ---
  const sendMessage = (content: string, type: MessageType = 'text') => {
    if (!conn || !isConnected) return;

    const currentKey = keyRef.current;

    // Handle Nuke separately (it's tiny)
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

    // 1. Encrypt the whole object
    const encryptedPayload = CryptoJS.AES.encrypt(JSON.stringify(msg), currentKey).toString();

    // 2. Decide: Send directly or Chunk it?
    if (encryptedPayload.length < CHUNK_SIZE) {
      // Small enough? Send directly
      conn.send({ payload: encryptedPayload });
    } else {
      // Too big? CHUNK IT!
      const totalChunks = Math.ceil(encryptedPayload.length / CHUNK_SIZE);
      const transferId = uuidv4(); // Unique ID for this file transfer

      for (let i = 0; i < totalChunks; i++) {
        const chunk = encryptedPayload.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
        conn.send({
          type: 'CHUNK',
          id: transferId,
          current: i,
          total: totalChunks,
          chunk: chunk
        });
      }
    }

    setMessages((prev) => [...prev, msg]);
  };

  return { isConnected, connectToPeer, sendMessage, messages, setMessages };
};