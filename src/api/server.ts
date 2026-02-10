const API_URL = "https://jchat-server.onrender.com";

export const api = {
  register: async (id: string, password: string, avatar: string) => {
    const res = await fetch(`${API_URL}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, password, publicKey: 'mock-key', avatar })
    });
    if (!res.ok) throw new Error(await res.text());
    return await res.json();
  },

  login: async (id: string, password: string) => {
    const res = await fetch(`${API_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, password })
    });
    if (!res.ok) throw new Error("Login failed");
    return await res.json();
  },

  send: async (msg: any) => {
    return fetch(`${API_URL}/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(msg)
    });
  },

  sync: async (userId: string, lastTimestamp?: number) => {
    const url = lastTimestamp 
      ? `${API_URL}/sync/${userId}?since=${lastTimestamp}` 
      : `${API_URL}/sync/${userId}`;
    const res = await fetch(url);
    return res.ok ? await res.json() : [];
  },

  react: async (messageId: string, emoji: string) => {
    return fetch(`${API_URL}/react`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messageId, emoji })
    });
  },

  deleteAccount: async (id: string, password: string) => {
    return fetch(`${API_URL}/delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, password })
    });
  }
};
