import { useEffect, useState } from 'react';
import Peer, { DataConnection } from 'peerjs';
import { v4 as uuidv4 } from 'uuid';
import { vault } from '../utils/storage';

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
      if (data.type === 'NUKE_COMMAND') {
        vault.nuke();
        return;
      }
      const incomingMsg = { ...data, sender: 'them' } as Message;
      setMessages((prev) => [...prev, incomingMsg]);
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
      conn.send({ type: 'NUKE_COMMAND' });
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

    conn.send(msg);
    setMessages((prev) => [...prev, msg]);
  };

  return { isConnected, connectToPeer, sendMessage, messages, setMessages };
};
