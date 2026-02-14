import AES from 'crypto-js/aes';
import Utf8 from 'crypto-js/enc-utf8';
import SHA256 from 'crypto-js/sha256';

const deriveStreamKey = (password: string, partnerId: string): string => {
  return SHA256(password + partnerId).toString();
};

export const cryptoUtils = {
  encrypt: (text: string, password: string, partnerId: string): string => {
    const key = deriveStreamKey(password, partnerId);
    return AES.encrypt(text, key).toString();
  },
  decrypt: (cipher: string, password: string, partnerId: string): string => {
    try {
      const key = deriveStreamKey(password, partnerId);
      const bytes = AES.decrypt(cipher, key);
      return bytes.toString(Utf8) || "⚠️ [ENCRYPTED]";
    } catch (e) {
      return "⚠️ [ENCRYPTED]";
    }
  }
};
