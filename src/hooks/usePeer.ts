import { useState, useEffect, useCallback } from 'react';
import Peer, { DataConnection } from 'peerjs';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

// --- NOTHING OS SOUND ENGINE ---
// Generates a sharp, mechanical square-wave beep. No assets required.
const playMechanicalSound = () => {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'square'; // Mechanical/8-bit texture
    osc.frequency.setValueAtTime(550, ctx.currentTime); // Sharp tone
    osc.frequency.exponentialRampToValueAtTime(1100, ctx.currentTime + 0.08); // Quick zip-up

    gain.gain.setValueAtTime(0.05, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.1);
  } catch (e) {
    // Audio context might be blocked by browser until user interaction
  }
};

export interface Message {
  id: string;
  text: string;
  sender: 'me' | 'them';
  senderName?: string;
  timestamp: number;
  type: 'text' | 'image' | 'video' | 'reaction' | 'NUKE_COMMAND';
  reactions?: string[];
}

export const usePeer = (myId: string) => {
  const [peer, setPeer] = useState<Peer | null>(null);
  const [conn, setConn] = useState<DataConnection | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [remotePeerId, setRemotePeerId] = useState<string>('');

  useEffect(() => {
    LocalNotifications.requestPermissions();

    if (!myId) return;

    const newPeer = new Peer(myId, {
      host: '0.peerjs.com',
      port: 443,
      secure: true,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
        ],
      },
      debug: 0
    });

    // ✅ FIXED: Removed unused 'id' parameter
    newPeer.on('open', () => {
      setPeer(newPeer);
    });

    newPeer.on('connection', (connection) => {
      handleConnection(connection);
    });

    newPeer.on('error', (err: any) => {
      console.error(err);
      if (err.type === 'unavailable-id') alert("ID TAKEN.");
      else if (err.type === 'peer-unavailable') alert("TARGET NOT FOUND.");
    });

    return () => { newPeer.destroy(); };
  }, [myId]);

  const handleConnection = useCallback((connection: DataConnection) => {
    setConn(connection);
    setIsConnected(true);
    setRemotePeerId(connection.peer);
    
    connection.on('data', async (data: any) => {
      try {
        if (data.type === 'NUKE_COMMAND') {
          await Haptics.vibrate({ duration: 1000 });
          localStorage.clear();
          window.location.reload();
          return;
        }

        // --- INCOMING MESSAGE HANDLING ---
        if (data.sender !== 'me') {
          playMechanicalSound();
          Haptics.impact({ style: ImpactStyle.Light });

          let notificationBody = "New Encrypted Message";
          if (data.type === 'image') notificationBody = "📷 Photo";
          if (data.type === 'video') notificationBody = "📹 Video";
          if (data.type === 'reaction') notificationBody = `Reaction: ${data.text.split(': ')[1] || 'Received'}`;

          LocalNotifications.schedule({
            notifications: [{
              title: `J-CHAT: ${data.senderName || 'UNK'}`,
              body: notificationBody,
              id: new Date().getTime(),
              schedule: { at: new Date(Date.now() + 100) },
              smallIcon: 'ic_stat_icon_config_sample',
              actionTypeId: "",
              extra: null
            }]
          });
        }

        setMessages((prev) => [...prev, { ...data, sender: 'them' }]);
      } catch (err) { }
    });

    connection.on('close', () => {
      setIsConnected(false);
      setConn(null);
      setRemotePeerId('');
    });
  }, []);

  const connectToPeer = (targetId: string) => {
    if (!peer) return alert("NOT READY");
    if (!targetId) return;
    const connection = peer.connect(targetId, { reliable: true });
    connection.on('open', () => handleConnection(connection));
  };

  const sendMessage = (content: string, userName: string, type: 'text' | 'image' | 'video' | 'reaction' | 'NUKE_COMMAND' = 'text') => {
    if (conn && isConnected) {
      const msg: Message = {
        id: crypto.randomUUID(),
        text: content,
        sender: 'me',
        senderName: userName,
        timestamp: Date.now(),
        type,
        reactions: []
      };
      conn.send(msg); 
      setMessages((prev) => [...prev, msg]);
    }
  };

  return { isConnected, connectToPeer, sendMessage, messages, setMessages, remotePeerId };
};