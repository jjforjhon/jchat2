// ... inside src/App.tsx

  const handleSendMessage = async (content: string, type: 'text' | 'image' | 'video') => {
    if (!activeContactId) return;

    // ✅ FIX: Encrypt before sending!
    const encryptedPayload = cryptoUtils.encrypt(content, user.password, activeContactId);

    const msg = {
      id: crypto.randomUUID(),
      fromUser: user.id,
      toUser: activeContactId,
      payload: encryptedPayload, // Send Ciphertext, NOT content
      type: type,
      timestamp: Date.now()
    };
    
    // Show plain text locally for you
    setConversations(prev => {
        const next = {...prev};
        if(!next[activeContactId]) next[activeContactId] = [];
        next[activeContactId].push({...msg, payload: encryptedPayload, text: content, sender: 'me', status: 'sent'} as any);
        return next;
    });

    await api.send(msg);
  };
// ...
