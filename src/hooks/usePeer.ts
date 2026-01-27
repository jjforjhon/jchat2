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

export const usePeer = (myId: string, encryptionKey: string) => {
  const [peer, setPeer] = useState<Peer | null>(null);
  const [conn, setConn] = useState<DataConnection | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);

  const keyRef = useRef(encryptionKey);

  useEffect(() => {
    keyRef.current = encryptionKey;
  }, [encryptionKey]);

  useEffect(() => {
    if (!myId) return;
    const newPeer = new Peer(myId);

    newPeer.on('open', () => setPeer(newPeer));
    
    newPeer.on('connection', (connection) => handleConnection(connection));
    
    // FIX: Added 'any' type to err to prevent Vercel build errors
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
      if (!data || !data.payload) {
        return;
      }

      try {
        const bytes = CryptoJS.AES.decrypt(data.payload, keyRef.current);
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
        console.error("Failed to process incoming message:", e);
      }
    });

    connection.on('close', () => setIsConnected(false));
    connection.on('error', () => setIsConnected(false));
  };

  const connectToPeer = (peerId: string) => {
    if (!peer) return;
    const connection = peer.connect(peerId);
    connection.on('open', () => handleConnection(connection));
  };

  const sendMessage = (content: string, type: MessageType = 'text') => {
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
    conn.send({ payload: encryptedPayload });
    setMessages((prev) => [...prev, msg]);
  };

  return { isConnected, connectToPeer, sendMessage, messages, setMessages };
};