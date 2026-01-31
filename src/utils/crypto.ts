import AES from 'crypto-js/aes';
import encUtf8 from 'crypto-js/enc-utf8';

const SECRET_KEY = "CHANGE_THIS_TO_YOUR_OWN_SECRET"; 

export const encryptMessage = (text: string) => AES.encrypt(text, SECRET_KEY).toString();
export const decryptMessage = (cipher: string) => {
  try { return AES.decrypt(cipher, SECRET_KEY).toString(encUtf8); } 
  catch { return "⚠️ [LOCKED]"; }
};