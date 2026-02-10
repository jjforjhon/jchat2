// src/api/server.ts

// ✅ I have already put your correct link here:
const API_URL = "https://jchat-server.onrender.com"; 

export const api = {
  /**
   * 1. Register User
   * Sends the user's Public Key and Avatar to the server so others can find them.
   */
  register: async (id: string, publicKey: string, avatar: string) => {
    try {
      const res = await fetch(`${API_URL}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, publicKey, avatar })
      });
      
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Server Error: ${text}`);
      }
      return await res.json();
    } catch (err) {
      console.error("API Register Error:", err);
      throw err; 
    }
  },

  /**
   * 2. Send Message (Relay)
   * Uploads an encrypted message blob to the server for a specific user.
   */
  send: async (toUserId: string, message: any) => {
    try {
      const res = await fetch(`${API_URL}/queue/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toUserId, message })
      });
      return res.ok;
    } catch (err) {
      console.error("API Send Error:", err);
      return false;
    }
  },

  /**
   * 3. Sync Messages
   * Downloads all pending messages waiting for this user.
   */
  sync: async (myUserId: string) => {
    try {
      const res = await fetch(`${API_URL}/queue/sync/${myUserId}`);
      if (!res.ok) return [];
      return await res.json();
    } catch (err) {
      // It's okay to fail silently here (user might be offline)
      return [];
    }
  },

  /**
   * 4. Acknowledge Receipt
   * Tells the server "I got these messages, delete them now."
   */
  ack: async (userId: string, messageIds: string[]) => {
    try {
      await fetch(`${API_URL}/queue/ack`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, messageIds })
      });
    } catch (err) {
      console.error("API Ack Error:", err);
    }
  }
};
