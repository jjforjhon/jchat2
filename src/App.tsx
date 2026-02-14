// ... (Imports stay the same)

export default function App() {
  // ... (State variables stay the same) ...
  
  // ✅ NEW REF: To track if component is mounted (prevents memory leaks)
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    // ... (Load Session code stays same) ...
    return () => { isMounted.current = false; };
  }, []);

  // ... (Auto-Save and Avatar Fetch stay same) ...

  // 4. INTELLIGENT SYNC LOOP (Updated for Long Polling)
  useEffect(() => {
    if (!user) return;

    let lastTimestamp = 0;
    const allMsgs = Object.values(conversations).flat();
    if (allMsgs.length > 0) {
      lastTimestamp = Math.max(...allMsgs.map(m => m.timestamp));
    }

    // ✅ RECURSIVE FUNCTION instead of setInterval
    const pollMessages = async () => {
      if (!isMounted.current) return;

      try {
        const safeTime = lastTimestamp > 0 ? lastTimestamp - 100 : 0; // Tighter buffer for instant sync
        
        // This call will now HANG for 25s if no messages
        const history = await api.sync(user.id, safeTime); 
        
        if (history && history.length > 0) {
            // Check if we actually got *real* messages or just a "wake up" signal
            // (The server might send {newMessages:true} or an array)
            // But our updated server code sends Arrays.
            
            // IF we got a "wake up" signal (object), we might need to fetch again, 
            // but the server code above sends the array directly if found, 
            // OR {newMessages:true} via notifyUser.
            
            // Correction: The notifyUser sends {newMessages:true}. 
            // The client needs to handle that or the server should query before sending.
            
            // Let's assume strict array return for simplicity in this step.
            // If the server notification sent {newMessages: true}, this 'history' variable 
            // will be that object. Let's make it robust:
            
            const messages = Array.isArray(history) ? history : [];
            
            // If we received a "wake up" object, we should loop immediately to fetch actual data
            // But strictly, we can just loop.
            
            if (messages.length > 0) {
                setConversations(prevConvos => {
                  const nextConvos = { ...prevConvos };
                  messages.forEach((msg: any) => {
                    const partner = msg.fromUser === user.id ? msg.toUser : msg.fromUser;
                    if (blockedUsers.includes(partner)) return;
                    if (!nextConvos[partner]) nextConvos[partner] = [];
                    
                    const exists = nextConvos[partner].some((m: Message) => m.id === msg.id);
                    if (!exists) {
                      nextConvos[partner].push({
                        id: msg.id,
                        text: msg.payload, 
                        sender: msg.fromUser === user.id ? 'me' : 'them',
                        timestamp: msg.timestamp,
                        type: msg.type,
                        reactions: msg.reactions,
                        status: 'delivered'
                      });
                      if (msg.timestamp > lastTimestamp) lastTimestamp = msg.timestamp;
                    }
                  });
                  return nextConvos;
                });
            }
        }
      } catch (e) {
        // If error (timeout/offline), wait 3s before retrying to save battery
        await new Promise(resolve => setTimeout(resolve, 3000));
      }

      // Loop immediately!
      if (isMounted.current && user) pollMessages();
    };

    pollMessages(); // Start the loop

  }, [user, blockedUsers]); // Restart if user changes

  // ... (Rest of component stays exact same) ...
}
