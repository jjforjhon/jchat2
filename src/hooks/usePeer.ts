import { useState, useEffect, useCallback } from 'react';
import Peer, { DataConnection } from 'peerjs';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

const playMechanicalSound = () => {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square'; 
    osc.frequency.setValueAtTime(550, ctx.currentTime); 
    osc.frequency.exponentialRampToValueAtTime(1100, ctx.currentTime + 0.08); 
    gain.gain.setValueAtTime(0.05, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.1);
  } catch (e) {}
};

export interface Message {
  id: string;
  text: string;
  sender: 'me' | 'them';
  senderName?: string;
  timestamp: number;
  // ✅ ADDED 'audio' type
  type: 'text' | 'image' | 'video' | 'audio' | 'reaction' | 'NUKE_COMMAND';
  reactions?: string[];
}

export const usePeer = (myId: string) => {
  const [peer, setPeer] = useState<Peer | null>(null);
  const [conn, setConn] = useState<DataConnection | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  
  const [messages, setMessages] = useState<Message[]>(() => {
    const saved = localStorage.getItem('jchat_history');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [remotePeerId, setRemotePeerId] = useState<string>(() => {
    return localStorage.getItem('last_target_id') || '';
  });

  useEffect(() => {
    localStorage.setItem('jchat_history', JSON.stringify(messages));
  }, [messages]);

  useEffect(() => {
    const setupNotifications = async () => {
      await LocalNotifications.requestPermissions();
      await LocalNotifications.createChannel({
        id: 'jchat_alerts',
        name: 'J-Chat Alerts',
        description: 'Notifications for new messages',
        importance: 5, visibility: 1, vibration: true, sound: 'default' 
      });
    };
    setupNotifications();
  }, []);

  useEffect(() => {
    if (!myId) return;
    const newPeer = new Peer(myId, {
      host: '0.peerjs.com', port: 443, secure: true,
      config: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] },
      debug: 0
    });

    newPeer.on('open', () => {
      setPeer(newPeer);
      const savedTarget = localStorage.getItem('last_target_id');
      if (savedTarget) connectToPeer(savedTarget, newPeer);
    });

    newPeer.on('connection', (connection) => handleConnection(connection));
    newPeer.on('error', (err: any) => console.error(err));
    return () => { newPeer.destroy(); };
  }, [myId]);

  const handleConnection = useCallback((connection: DataConnection) => {
    setConn(connection);
    setIsConnected(true);
    setRemotePeerId(connection.peer);
    localStorage.setItem('last_target_id', connection.peer);

    connection.on('data', async (data: any) => {
      try {
        if (data.type === 'NUKE_COMMAND') {
          alert("PEER UNLINKED.");
          setIsConnected(false);
          setConn(null);
          return;
        }

        if (data.sender !== 'me') {
          playMechanicalSound();
          Haptics.impact({ style: ImpactStyle.Light });
          
          let notificationBody = "New Encrypted Message";
          if (data.type === 'image') notificationBody = "📷 Photo";
          if (data.type === 'video') notificationBody = "📹 Video";
          if (data.type === 'audio') notificationBody = "🎙️ Voice Message"; // ✅ Audio Alert
          if (data.type === 'reaction') notificationBody = `Reaction: ${data.text.split(': ')[1]}`;

          await LocalNotifications.schedule({
            notifications: [{
              title: `J-CHAT: ${data.senderName || 'UNK'}`,
              body: notificationBody,
              id: new Date().getTime(),
              channelId: 'jchat_alerts',
              schedule: { at: new Date(Date.now() + 100) },
              smallIcon: 'ic_stat_icon_config_sample',
            }]
          });
        }
        setMessages((prev) => [...prev, { ...data, sender: 'them' }]);
      } catch (err) {}
    });

    connection.on('close', () => {
      setIsConnected(false);
      setConn(null);
    });
  }, []);

  const connectToPeer = (targetId: string, activePeer = peer) => {
    if (!activePeer) return alert("NOT READY");
    if (!targetId) return;
    const connection = activePeer.connect(targetId, { reliable: true });
    connection.on('open', () => handleConnection(connection));
    setRemotePeerId(targetId);
    localStorage.setItem('last_target_id', targetId);
  };

  const sendMessage = (content: string, userName: string, type: 'text' | 'image' | 'video' | 'audio' | 'reaction' | 'NUKE_COMMAND' = 'text') => {
    if (conn && isConnected) {
      const msg: Message = {
        id: crypto.randomUUID(), text: content, sender: 'me', senderName: userName,
        timestamp: Date.now(), type, reactions: []
      };
      conn.send(msg); 
      setMessages((prev) => [...prev, msg]);
    }
  };

  const clearHistory = () => {
    if(confirm("CLEAR LOCAL HISTORY?")) {
      setMessages([]);
      localStorage.removeItem('jchat_history');
    }
  };

  const unlinkConnection = () => {
    if(confirm("PERMANENTLY UNLINK?")) {
      if(conn) conn.close();
      localStorage.removeItem('last_target_id');
      setRemotePeerId('');
      setIsConnected(false);
      setConn(null);
    }
  };

  return { isConnected, connectToPeer, sendMessage, messages, remotePeerId, clearHistory, unlinkConnection };
};