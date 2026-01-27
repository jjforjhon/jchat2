import { useEffect, useState } from 'react';
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

  useEffect(() => {
    if (!myId) return;
    const newPeer = new Peer(myId);
    newPeer.on('open', () => setPeer(newPeer));
    newPeer.on('connection', (connection) => handleConnection(connection));
    return () => newPeer.destroy();
  }, [myId]);

  const handleConnection = (connection: DataConnection) => {
    setConn(connection);
    setIsConnected(true);

    connection.on('data', (data: any) => {
      // All valid data must be in a 'payload' object.
      if (!data || !data.payload) {
        console.error("Received malformed message, discarding.", data);
        return;
      }

      try {
        const bytes = CryptoJS.AES.decrypt(data.payload, encryptionKey);
        const decryptedText = bytes.toString(CryptoJS.enc.Utf8);

        // If decryption results in an empty string, the key was wrong.
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

        // Validate the object structure before adding it to state
        if (isMessageObject(decryptedData)) {
          setMessages((prev) => [...prev, { ...decryptedData, sender: 'them' }]);
        } else {
          console.error("Decrypted data is not a valid message object:", decryptedData);
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

    // The NUKE command is also encrypted for security
    if (type === 'NUKE_COMMAND') {
      const encryptedPayload = CryptoJS.AES.encrypt(JSON.stringify({ type: 'NUKE_COMMAND' }), encryptionKey).toString();
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

    // Encrypt the message object before sending
    const encryptedPayload = CryptoJS.AES.encrypt(JSON.stringify(msg), encryptionKey).toString();
    conn.send({ payload: encryptedPayload });
    setMessages((prev) => [...prev, msg]);
  };

  return { isConnected, connectToPeer, sendMessage, messages, setMessages };
};
