import { useState, useEffect, useCallback } from 'react';
import Peer, { DataConnection } from 'peerjs';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

// --- NOTHING OS SOUND ENGINE (Oscillator) ---
// Generates a sharp, mechanical "beep" without external files
const playMechanicalSound = () => {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'square'; // Industrial/8-bit sound
    osc.frequency.setValueAtTime(440, ctx.currentTime); // A4
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.05); // Zip up

    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.1);
  } catch (e) {
    console.error("Audio Engine Fail", e);
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

  // 1. Initialize Peer & Request Permissions
  useEffect(() => {
    // Request Notification Permissions on Load
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

    newPeer.on('open', () => setPeer(newPeer));

    newPeer.on('connection', (connection) => {
      handleConnection(connection);
    });

    newPeer.on('error', (err: any) => {
      if (err.type === 'unavailable-id') alert("ID TAKEN.");
      else if (err.type === 'peer-unavailable') alert("TARGET NOT FOUND.");
    });

    return () => { newPeer.destroy(); };
  }, [myId]);

  // 2. Handle Connection & Incoming Data
  const handleConnection = useCallback((connection: DataConnection) => {
    setConn(connection);
    setIsConnected(true);
    setRemotePeerId(connection.peer);
    
    connection.on('data', async (data: any) => {
      try {
        // NUKE COMMAND
        if (data.type === 'NUKE_COMMAND') {
          await Haptics.vibrate({ duration: 1000 }); // Long warn vibration
          localStorage.clear();
          window.location.reload();
          return;
        }

        // --- INCOMING MESSAGE ALERTS ---
        if (data.sender !== 'me') {
          // A. Audio
          playMechanicalSound();
          
          // B. Haptics (Light Tap)
          Haptics.impact({ style: ImpactStyle.Light });

          // C. System Notification (Background/Lock Screen)
          let notificationBody = "New Encrypted Message";
          if (data.type === 'image') notificationBody = "📷 Photo Received";
          if (data.type === 'video') notificationBody = "📹 Video Received";
          if (data.type === 'reaction') notificationBody = `Reaction: ${data.text.split(': ')[1]}`;

          LocalNotifications.schedule({
            notifications: [{
              title: `J-CHAT: ${data.senderName || 'Unknown'}`,
              body: notificationBody,
              id: new Date().getTime(),
              schedule: { at: new Date(Date.now() + 100) }, // Instant
              smallIcon: 'ic_stat_icon_config_sample', // Uses app icon by default
              actionTypeId: "",
              extra: null
            }]
          });
        }

        setMessages((prev) => [...prev, { ...data, sender: 'them' }]);
      } catch (err) { 
        console.error("Receive Error", err);
      }
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