// src/api/server.ts

// ✅ FIX: Connected to your Render Backend
const BASE_URL = 'https://jchat-server.onrender.com'; 

export const api = {
  /**
   * 1. REGISTER
   */
  register: async (id: string, password: string, avatar?: string) => {
    try {
      const res = await fetch(`${BASE_URL}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, password, avatar }),
      });
      
      // If server returns an error (like "User ID exists"), read the text
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Server Error: ${res.status}`);
      }
      return res.json();
    } catch (e: any) {
      throw new Error(e.message || "Connection Failed: Check Render URL");
    }
  },

  /**
   * 2. LOGIN
   */
  login: async (id: string, password: string) => {
    try {
      const res = await fetch(`${BASE_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, password }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Login failed');
      }
      return res.json();
    } catch (e: any) {
      throw new Error(e.message || "Connection Failed: Check Render URL");
    }
  },

  /**
   * 3. UPDATE PROFILE
   */
  updateProfile: async (id: string, pass: string, avatar: string, name: string) => {
    await fetch(`${BASE_URL}/update-profile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, password: pass, avatar, name }),
    });
  },

  /**
   * 4. GET USER (Avatar)
   */
  getUser: async (id: string) => {
    try {
      const res = await fetch(`${BASE_URL}/user/${id}`);
      return await res.json();
    } catch {
      return null;
    }
  },

  /**
   * 5. SEND MESSAGE
   */
  send: async (msg: any) => {
    await fetch(`${BASE_URL}/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(msg),
    });
  },

  /**
   * 6. SYNC (LONG POLLING)
   */
  sync: async (userId: string, since: number) => {
    try {
      const res = await fetch(`${BASE_URL}/sync/${userId}?since=${since}`);
      if (!res.ok) return [];
      return await res.json();
    } catch (e) {
      return [];
    }
  },

  /**
   * 7. REACT
   */
  react: async (msgId: string, emoji: string) => {
    await fetch(`${BASE_URL}/react`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messageId: msgId, emoji }),
    });
  },

  /**
   * 8. DELETE ACCOUNT
   */
  deleteAccount: async (id: string, pass: string) => {
    const res = await fetch(`${BASE_URL}/delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, password: pass }),
    });
    if (!res.ok) throw new Error('Delete failed');
  }
};
