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

// CONFIG: 32KB is a safe balance for encryption speed vs network speed
const CHUNK_SIZE = 32 * 1024; 

export const usePeer = (myId: string, encryptionKey: string) => {
  const [peer, setPeer] = useState<Peer | null>(null);
  const [conn, setConn] = useState<DataConnection | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);

  const keyRef = useRef(encryptionKey);
  
  // Buffer to hold DECRYPTED file pieces
  const streamBuffer = useRef<Map<string, { 
    type: MessageType, 
    total: number, 
    count: number, 
    parts: string[],
    timestamp: number 
  }>>(new Map());

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
      // 1. FILE HEADER (Start of a new file)
      if (data && data.type === 'FILE_START') {
        handleFileStart(data.payload);
        return;
      }

      // 2. FILE CHUNK (A piece of the file)
      if (data && data.type === 'FILE_CHUNK') {
        handleFileChunk(data);
        return;
      }

      // 3. STANDARD MESSAGE (Text/Nuke)
      if (data && data.payload) {
        processStandardMessage(data.payload);
      }
    });

    connection.on('close', () => setIsConnected(false));
    connection.on('error', () => setIsConnected(false));
  };

  // --- RECEIVER LOGIC ---

  const handleFileStart = (encryptedHeader: string) => {
    try {
      const bytes = CryptoJS.AES.decrypt(encryptedHeader, keyRef.current);
      const header = JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
      
      // Initialize buffer for this file
      streamBuffer.current.set(header.id, {
        type: header.type,
        total: header.totalChunks,
        timestamp: header.timestamp,
        count: 0,
        parts: new Array(header.totalChunks)
      });
    } catch (e) {
      console.error("Failed to start file stream");
    }
  };

  const handleFileChunk = (data: any) => {
    const { id, current, chunk } = data;
    const entry = streamBuffer.current.get(id);

    if (!entry) return; // Unknown file

    try {
      // Decrypt this chunk IMMEDIATELY (prevents memory freeze later)
      const bytes = CryptoJS.AES.decrypt(chunk, keyRef.current);
      const decryptedPart = bytes.toString(CryptoJS.enc.Utf8);
      
      entry.parts[current] = decryptedPart;
      entry.count++;

      // Check if complete
      if (entry.count === entry.total) {
        const fullContent = entry.parts.join('');
        
        const msg: Message = {
          id: id,
          sender: 'them',
          type: entry.type,
          content: fullContent,
          timestamp: entry.timestamp
        };

        setMessages(prev => [...prev, msg]);
        streamBuffer.current.delete(id); // Clean memory
      }
    } catch (e) {
      console.error("Chunk Decrypt Failed");
    }
  };

  const processStandardMessage = (encryptedText: string) => {
    try {
      const bytes = CryptoJS.AES.decrypt(encryptedText, keyRef.current);
      const decryptedText = bytes.toString(CryptoJS.enc.Utf8);
      if (!decryptedText) return;

      const data = JSON.parse(decryptedText);

      if (data.type === 'NUKE_COMMAND') {
        vault.nuke();
        return;
      }
      
      // Text messages
      if (data.id && data.content) {
         setMessages(prev => [...prev, { ...data, sender: 'them' }]);
      }
    } catch (e) {
      console.error("Msg Error");
    }
  };

  const connectToPeer = (peerId: string) => {
    if (!peer) return;
    const connection = peer.connect(peerId, { reliable: true });
    connection.on('open', () => handleConnection(connection));
  };

  // --- SENDER LOGIC (Streaming Encryption) ---

  const sendMessage = async (content: string, type: MessageType = 'text') => {
    if (!conn || !isConnected) return;

    const currentKey = keyRef.current;
    const msgId = uuidv4();
    const timestamp = Date.now();

    // 1. Handle NUKE (Priority)
    if (type === 'NUKE_COMMAND') {
      const encrypted = CryptoJS.AES.encrypt(JSON.stringify({ type: 'NUKE_COMMAND' }), currentKey).toString();
      conn.send({ payload: encrypted });
      vault.nuke();
      return;
    }

    // 2. Handle TEXT (Simple send)
    if (type === 'text') {
      const msg: Message = { id: msgId, sender: 'me', type, content, timestamp };
      const encrypted = CryptoJS.AES.encrypt(JSON.stringify(msg), currentKey).toString();
      conn.send({ payload: encrypted });
      setMessages(prev => [...prev, msg]);
      return;
    }

    // 3. Handle FILES (Stream Encryption)
    // We encrypt piece-by-piece to stop the CPU from freezing
    
    const totalChunks = Math.ceil(content.length / CHUNK_SIZE);

    // A. Send Header (Encrypted Metadata)
    const header = { id: msgId, type, timestamp, totalChunks };
    const encryptedHeader = CryptoJS.AES.encrypt(JSON.stringify(header), currentKey).toString();
    conn.send({ type: 'FILE_START', payload: encryptedHeader });

    // B. Loop, Encrypt, Send, Sleep
    for (let i = 0; i < totalChunks; i++) {
      const rawChunk = content.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
      
      // Encrypt ONLY this small piece
      const encryptedChunk = CryptoJS.AES.encrypt(rawChunk, currentKey).toString();
      
      conn.send({
        type: 'FILE_CHUNK',
        id: msgId,
        current: i,
        chunk: encryptedChunk
      });

      // BREATHE: Wait 5ms to keep CPU and Connection alive
      await new Promise(r => setTimeout(r, 5));
    }

    // Add to my own view
    setMessages(prev => [...prev, { id: msgId, sender: 'me', type, content, timestamp }]);
  };

  return { isConnected, connectToPeer, sendMessage, messages, setMessages };
};