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

// Type guard to validate the structure of a received message
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

  // FIX: Use a Ref to track the live encryption key.
  const keyRef = useRef(encryptionKey);

  // Update the ref whenever the key changes (e.g. after login)
  useEffect(() => {
    keyRef.current = encryptionKey;
  }, [encryptionKey]);

  useEffect(() => {
    if (!myId) return;
    const newPeer = new Peer(myId);

    newPeer.on('open', () => setPeer(newPeer));
    
    // Pass the connection to our handler
    newPeer.on('connection', (connection) => handleConnection(connection));
    
    return () => newPeer.destroy();
  }, [myId]);

  const handleConnection = (connection: DataConnection) => {
    setConn(connection);
    setIsConnected(true);

    connection.on('data', (data: any) => {
      // Check if data is valid
      if (!data || !data.payload) {
        return;
      }

      try {
        // FIX: Decrypt using keyRef.current (the latest password)
        const bytes = CryptoJS.AES.decrypt(data.payload, keyRef.current);
        const decryptedText = bytes.toString(CryptoJS.enc.Utf8);

        // If decryption fails, stop here
        if (!decryptedText) {
          console.error("Decryption failed: Incorrect key or corrupted data.");
          return;
        }

        const decryptedData = JSON.parse(decryptedText);

        // Check for NUKE command first
        if (decryptedData.type === 'NUKE_COMMAND') {
          vault.nuke();
          return;
        }

        // Validate structure BEFORE adding to state
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

    // Use keyRef.current to ensure we encrypt with the active key
    const currentKey = keyRef.current;

    // The NUKE command is also encrypted
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

    // Encrypt the message before sending
    const encryptedPayload = CryptoJS.AES.encrypt(JSON.stringify(msg), currentKey).toString();
    conn.send({ payload: encryptedPayload });
    setMessages((prev) => [...prev, msg]);
  };

  return { isConnected, connectToPeer, sendMessage, messages, setMessages };
};