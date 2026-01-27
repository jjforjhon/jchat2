import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

const JWT_SECRET = process.env.JWT_SECRET;

export default async function handler(req, res) {
  // Allow the frontend to talk to this backend (CORS)
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { action, email, password, name, token } = req.body;

  try {
    // --- SIGN UP ---
    if (action === 'signup') {
      const { data: existing } = await supabase.from('profiles').select('id').eq('email', email).single();
      if (existing) return res.status(400).json({ error: 'Email already registered' });

      // Securely hash the password before saving
      const hashedPassword = await bcrypt.hash(password, 10);
      const id = crypto.randomUUID();

      const { error } = await supabase.from('profiles').insert({
        id, email, password_hash: hashedPassword, name
      });

      if (error) throw error;

      const jwtToken = jwt.sign({ id }, JWT_SECRET, { expiresIn: '30d' });
      return res.status(200).json({ id, name, email, token: jwtToken });
    }

    // --- LOGIN ---
    if (action === 'login') {
      const { data: user, error } = await supabase.from('profiles').select('*').eq('email', email).single();
      if (error || !user) return res.status(404).json({ error: 'User not found' });

      const isValid = await bcrypt.compare(password, user.password_hash);
      if (!isValid) return res.status(401).json({ error: 'Invalid password' });

      const jwtToken = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '30d' });
      return res.status(200).json({ id: user.id, name: user.name, email: user.email, token: jwtToken });
    }

    // --- DELETE ---
    if (action === 'delete') {
      const decoded = jwt.verify(token, JWT_SECRET);
      await supabase.from('profiles').delete().eq('id', decoded.id);
      return res.status(200).json({ success: true });
    }

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}