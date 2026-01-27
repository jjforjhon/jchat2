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
      // Decrypt incoming data if it's not a NUKE command
      let decryptedData = data;
      if (data.payload) {
        try {
          const bytes = CryptoJS.AES.decrypt(data.payload, encryptionKey);
          decryptedData = JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
        } catch (e) {
          console.error("Failed to decrypt message:", e);
          return; // Don't process a message that can't be decrypted
        }
      }

      if (decryptedData.type === 'NUKE_COMMAND') {
        vault.nuke();
        return;
      }
      setMessages((prev) => [...prev, { ...decryptedData, sender: 'them' }]);
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

    if (type === 'NUKE_COMMAND') {
      // Nuke command is sent in plaintext so the type can be read before decryption
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
