// Replace content of src/api/server.ts

const BASE_URL = 'http://localhost:3000'; // Or your production IP

export const api = {
  /**
   * 1. REGISTER
   */
  register: async (id: string, password: string, avatar?: string) => {
    const res = await fetch(`${BASE_URL}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, password, avatar }),
    });
    if (!res.ok) throw new Error('Registration failed');
    return res.json();
  },

  /**
   * 2. LOGIN
   */
  login: async (id: string, password: string) => {
    const res = await fetch(`${BASE_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, password }),
    });
    if (!res.ok) throw new Error('Login failed');
    return res.json();
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
   * (Now triggers immediate wake-up for recipient)
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
   * This request may hang for up to 25 seconds.
   */
  sync: async (userId: string, since: number) => {
    try {
      // We do NOT set a signal timeout here, letting the browser wait as long as needed.
      // The server will cut it off at 25s.
      const res = await fetch(`${BASE_URL}/sync/${userId}?since=${since}`);
      if (!res.ok) return [];
      return await res.json();
    } catch (e) {
      // If network fails or timeout, return empty so the loop retries
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
      body: JSON.stringify({ messageId, emoji }),
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
    if (!res.ok) throw new
