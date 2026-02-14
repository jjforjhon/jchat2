import AES from 'crypto-js/aes';
import Utf8 from 'crypto-js/enc-utf8';
import SHA256 from 'crypto-js/sha256';

/**
 * ✅ FIX: Generate a MATCHING key for both users.
 * We sort the IDs so "Alice + Bob" produces the same key as "Bob + Alice".
 */
const deriveStreamKey = (id1: string, id2: string): string => {
  const [first, second] = [id1, id2].sort();
  // In a real production app, this would use Diffie-Hellman key exchange.
  // For this prototype, we use a deterministic hash of the participants.
  return SHA256(`${first}::SECURE_LINK::${second}`).toString();
};

export const cryptoUtils = {
  encrypt: (text: string, myId: string, partnerId: string): string => {
    const key = deriveStreamKey(myId, partnerId);
    return AES.encrypt(text, key).toString();
  },

  decrypt: (cipher: string, myId: string, partnerId: string): string => {
    try {
      const key = deriveStreamKey(myId, partnerId);
      const bytes = AES.decrypt(cipher, key);
      const originalText = bytes.toString(Utf8);
      
      // If decryption produces empty string, it failed
      if (!originalText) return "⚠️ [DECRYPTION_FAILED]";
      return originalText;
    } catch (e) {
      return "⚠️ [ENCRYPTED_DATA]";
    }
  }
};
