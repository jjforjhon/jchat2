import AES from 'crypto-js/aes';
import Utf8 from 'crypto-js/enc-utf8';
import SHA256 from 'crypto-js/sha256';

/**
 * ✅ FIX: Generates a unique key for a specific conversation.
 * It combines your local password with the partner's ID.
 */
const deriveStreamKey = (password: string, partnerId: string): string => {
  return SHA256(password + partnerId).toString();
};

export const cryptoUtils = {
  /**
   * Encrypts a message using a key derived from the sender's password 
   * and the recipient's identity.
   */
  encrypt: (text: string, password: string, partnerId: string): string => {
    const key = deriveStreamKey(password, partnerId);
    return AES.encrypt(text, key).toString();
  },

  /**
   * Decrypts a message using the same derivation logic.
   */
  decrypt: (cipher: string, password: string, partnerId: string): string => {
    try {
      const key = deriveStreamKey(password, partnerId);
      const bytes = AES.decrypt(cipher, key);
      const originalText = bytes.toString(Utf8);
      return originalText || "⚠️ [ENCRYPTED]";
    } catch (e) {
      return "⚠️ [ENCRYPTED]";
    }
  }
};
