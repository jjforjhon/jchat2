const express = require('express');
const cors = require('cors');
const Database = require('better-sqlite3');
const crypto = require('crypto');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// DATABASE
const db = new Database('jchat_persistent.sqlite');
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    password_hash TEXT,
    salt TEXT,
    public_key TEXT,
    avatar TEXT,
    name TEXT,
    created_at INTEGER
  );
  
  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    from_user TEXT,
    to_user TEXT,
    payload TEXT,
    type TEXT,
    timestamp INTEGER,
    reactions TEXT DEFAULT '[]'
  );
`);

// ✅ MIGRATION 1: Add 'avatar' if missing
const columns = db.prepare("PRAGMA table_info(users)").all();
if (!columns.some(c => c.name === 'avatar')) {
  console.log("Migrating: Adding avatar column...");
  db.prepare("ALTER TABLE users ADD COLUMN avatar TEXT").run();
}

// ✅ MIGRATION 2: Add 'salt' if missing (Critical Security Upgrade)
if (!columns.some(c => c.name === 'salt')) {
  console.log("Migrating: Adding salt column...");
  db.prepare("ALTER TABLE users ADD COLUMN salt TEXT").run();
}

// HELPER: Secure Hash Function (Scrypt)
const hashPassword = (password, salt) => {
  return crypto.scryptSync(password, salt, 64).toString('hex');
};

// 1. REGISTER
app.post('/register', (req, res) => {
  const { id, password, avatar } = req.body;
  if (!id || !password) return res.sendStatus(400);

  // Generate a unique random salt for this user
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = hashPassword(password, salt);

  try {
    db.prepare('INSERT INTO users (id, password_hash, salt, avatar, created_at) VALUES (?, ?, ?, ?, ?)')
      .run(id, hash, salt, avatar || '', Date.now());
    res.json({ success: true });
  } catch (e) {
    res.status(409).json({ error: "User ID exists" });
  }
});

// 2. LOGIN
app.post('/login', (req, res) => {
  const { id, password } = req.body;
  
  // Get user including their specific salt
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!user) return res.status(401).json({ error: "Invalid Credentials" });

  // If user has a salt (new/migrated user), check properly
  if (user.salt) {
    const attemptHash = hashPassword(password, user.salt);
    if (attemptHash !== user.password_hash) return res.status(401).json({ error: "Invalid Credentials" });
  } else {
    // Legacy fallback (for old users before this update)
    const legacyHash = crypto.createHash('sha256').update(password).digest('hex');
    if (legacyHash !== user.password_hash) return res.status(401).json({ error: "Invalid Credentials" });
    
    // Optional: Upgrade this user to salted hash now (Self-Healing)
    const newSalt = crypto.randomBytes(16).toString('hex');
    const newHash = hashPassword(password, newSalt);
    db.prepare('UPDATE users SET password_hash = ?, salt = ? WHERE id = ?').run(newHash, newSalt, id);
  }
  
  res.json({ success: true, user: { id: user.id, avatar: user.avatar, name: user.name } });
});

// 3. UPDATE PROFILE
app.post('/update-profile', (req, res) => {
  const { id, password, avatar, name } = req.body;
  
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!user) return res.sendStatus(401);

  // Verify password using salt
  const attemptHash = user.salt 
    ? hashPassword(password, user.salt) 
    : crypto.createHash('sha256').update(password).digest('hex');

  if (attemptHash !== user.password_hash) return res.status(401).json({ error: "Auth Failed" });

  db.prepare('UPDATE users SET avatar = ?, name = ? WHERE id = ?').run(avatar, name, id);
  res.json({ success: true });
});

// 4. SEND MESSAGE (Unchanged)
app.post('/send', (req, res) => {
  const { id, fromUser, toUser, payload, type } = req.body;
  try {
    db.prepare('INSERT INTO messages (id, from_user, to_user, payload, type, timestamp) VALUES (?, ?, ?, ?, ?, ?)')
      .run(id, fromUser, toUser, payload, type || 'text', Date.now());
    res.json({ success: true });
  } catch (e) { res.sendStatus(500); }
});

// 5. SYNC (Unchanged)
app.get('/sync/:userId', (req, res) => {
  const { userId } = req.params;
  const { since } = req.query; 

  let query = 'SELECT * FROM messages WHERE to_user = ? OR from_user = ? ORDER BY timestamp ASC';
  let params = [userId, userId];

  if (since) {
    query = 'SELECT * FROM messages WHERE (to_user = ? OR from_user = ?) AND timestamp > ? ORDER BY timestamp ASC';
    params.push(since);
  }

  const rows = db.prepare(query).all(...params);
  res.json(rows.map(r => ({
    id: r.id,
    fromUser: r.from_user,
    toUser: r.to_user,
    payload: r.payload, 
    type: r.type,
    timestamp: r.timestamp,
    reactions: JSON.parse(r.reactions || '[]')
  })));
});

// 6. ADD REACTION (Unchanged)
app.post('/react', (req, res) => {
  const { messageId, emoji } = req.body;
  const msg = db.prepare('SELECT reactions FROM messages WHERE id = ?').get(messageId);
  if (!msg) return res.sendStatus(404);

  let reactions = JSON.parse(msg.reactions || '[]');
  reactions.push(emoji);
  
  db.prepare('UPDATE messages SET reactions = ? WHERE id = ?').run(JSON.stringify(reactions), messageId);
  res.json({ success: true });
});

// 7. DELETE ACCOUNT (Fixed with Salt)
app.post('/delete', (req, res) => {
  const { id, password } = req.body;
  
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!user) return res.sendStatus(401);

  const attemptHash = user.salt 
    ? hashPassword(password, user.salt) 
    : crypto.createHash('sha256').update(password).digest('hex');

  if (attemptHash !== user.password_hash) return res.status(401).json({ error: "Invalid credentials" });
  
  db.prepare('DELETE FROM users WHERE id = ?').run(id);
  db.prepare('DELETE FROM messages WHERE from_user = ? OR to_user = ?').run(id, id);
  res.json({ success: true });
});

// 8. GET USER AVATAR (Unchanged)
app.get('/user/:id', (req, res) => {
  try {
    const user = db.prepare('SELECT avatar FROM users WHERE id = ?').get(req.params.id);
    res.json({ avatar: user ? user.avatar : null });
  } catch (e) { res.sendStatus(500); }
});

// --- CLEANUP TASK ---
setInterval(() => {
  const cutoff = Date.now() - (30 * 24 * 60 * 60 * 1000);
  db.prepare('DELETE FROM messages WHERE timestamp < ?').run(cutoff);
}, 60 * 60 * 1000);

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Server running on Port ${PORT}`));
