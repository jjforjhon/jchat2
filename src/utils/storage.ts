import localforage from 'localforage';
import CryptoJS from 'crypto-js';

localforage.config({
  name: 'J-Chat-Vault',
  storeName: 'conversations'
});

export const vault = {
  save: async (key: string, data: any, password: string) => {
    try {
      const jsonString = JSON.stringify(data);
      const encrypted = CryptoJS.AES.encrypt(jsonString, password).toString();
      await localforage.setItem(key, encrypted);
    } catch (e) {
      console.error("Vault Lock Failed:", e);
    }
  },

  load: async (key: string, password: string) => {
    try {
      const encrypted = await localforage.getItem<string>(key);
      if (!encrypted) return null;
      
      const bytes = CryptoJS.AES.decrypt(encrypted, password);
      const decrypted = bytes.toString(CryptoJS.enc.Utf8);
      return JSON.parse(decrypted);
    } catch (e) {
      console.error("Vault Unlock Failed:", e);
      return null;
    }
  },

  nuke: async () => {
    await localforage.clear();
    localStorage.clear();
    window.location.reload();
  }
};

export const generateIdentity = (user: string, pass: string) => {
  const raw = `${user.trim().toLowerCase()}:${pass.trim()}`;
  const hash = CryptoJS.SHA256(raw).toString(CryptoJS.enc.Hex);
  return hash.substring(0, 6).toUpperCase();
};