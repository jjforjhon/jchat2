import AES from 'crypto-js/aes';
import Utf8 from 'crypto-js/enc-utf8';

const SECRET_KEY = "CHANGE_THIS_TO_A_REAL_SECRET";

export const encryptMessage = (text: string): string =>
  AES.encrypt(text, SECRET_KEY).toString();

export const decryptMessage = (cipher: string): string => {
  try {
    const out = AES.decrypt(cipher, SECRET_KEY).toString(Utf8);
    return out || "⚠️ [LOCKED]";
  } catch {
    return "⚠️ [LOCKED]";
  }
};
