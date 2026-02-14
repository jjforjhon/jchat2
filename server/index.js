const express = require('express');
const cors = require('cors');
const Database = require('better-sqlite3');
const crypto = require('crypto');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// DATABASE SETUP
const db = new Database('jchat_persistent.sqlite');
db.pragma('journal_mode = WAL');

// 1. TABLE CREATION
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

// 2. MIGRATIONS (Auto-Fix Database)
const columns = db.prepare("PRAGMA table_info(users)").all();

// Add 'avatar' if missing
if (!columns.some(c => c.name === 'avatar')) {
  console.log("Migrating: Adding avatar column...");
  db.prepare("ALTER TABLE users ADD COLUMN avatar TEXT").run();
}

// ✅ MIGRATION: Add 'salt' if missing (Critical for Security)
if (!columns.some(c => c.name === 'salt')) {
  console.log("Migrating: Adding salt column...");
  db.prepare("ALTER TABLE users ADD COLUMN salt TEXT").run();
}

// ✅ HELPER: Secure Hash Function (Scrypt)
const hashPassword = (password, salt) => {
  return crypto.scryptSync(password, salt, 64).toString('hex');
};

// GLOBAL: Waiting Room for Long Polling
const pollingClients = {};

// Helper to notify waiting clients
const notifyUser = (userId) => {
  if (pollingClients[userId]) {
    // Wake up all connections waiting for this user
    pollingClients[userId].forEach(res => res.json({ newMessages: true }));
    pollingClients[userId] = []; 
  }
};

// --- ROUTES ---

// 1. REGISTER (Secure)
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

// 2. LOGIN (Secure + Legacy Support)
app.post('/login', (req, res) => {
  const { id, password } = req.body;
  
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!user) return res.status(401).json({ error: "Invalid Credentials" });

  // Check Password
  if (user.salt) {
    // Modern secure user
    const attemptHash = hashPassword(password, user.salt);
    if (attemptHash !== user.password_hash) return res.status(401).json({ error: "Invalid Credentials" });
  } else {
    // Legacy fallback (SHA256) for users created before update
    const legacyHash = crypto.createHash('sha256').update(password).digest('hex');
    if (legacyHash !== user.password_hash) return res.status(401).json({ error: "Invalid Credentials" });
    
    // Auto-Upgrade legacy user to salted hash (Self-Healing)
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

  // Verify password (handle both new and old users)
  let isValid = false;
  if (user.salt) {
    isValid = hashPassword(password, user.salt) === user.password_hash;
  } else {
    isValid = crypto.createHash('sha256').update(password).digest('hex') === user.password_hash;
  }

  if (!isValid) return res.status(401).json({ error: "Auth Failed" });

  db.prepare('UPDATE users SET avatar = ?, name = ? WHERE id = ?').run(avatar, name, id);
  res.json({ success: true });
});

// 4. SEND MESSAGE (Trigger Sync)
app.post('/send', (req, res) => {
  const { id, fromUser, toUser, payload, type } = req.body;
  try {
    db.prepare('INSERT INTO messages (id, from_user, to_user, payload, type, timestamp) VALUES (?, ?, ?, ?, ?, ?)')
      .run(id, fromUser, toUser, payload, type || 'text', Date.now());
    
    // Wake up recipients immediately
    notifyUser(toUser);
    notifyUser(fromUser);

    res.json({ success: true });
  } catch (e) { res.sendStatus(500); }
});

// 5. SYNC (Long Polling Implementation)
app.get('/sync/:userId', (req, res) => {
  const { userId } = req.params;
  const { since } = req.query; 

  const getMessages = () => {
    let query = 'SELECT * FROM messages WHERE to_user = ? OR from_user = ? ORDER BY timestamp ASC';
    let params = [userId, userId];
    if (since) {
      query = 'SELECT * FROM messages WHERE (to_user = ? OR from_user = ?) AND timestamp > ? ORDER BY timestamp ASC';
      params.push(since);
    }
    return db.prepare(query).all(...params);
  };

  const messages = getMessages();
  
  // A. Return immediately if data exists
  if (messages.length > 0) {
    return res.json(messages.map(r => ({
      id: r.id,
      fromUser: r.from_user,
      toUser: r.to_user,
      payload: r.payload, 
      type: r.type,
      timestamp: r.timestamp,
      reactions: JSON.parse(r.reactions || '[]')
    })));
  }

  // B. Otherwise WAIT (Long Poll)
  if (!pollingClients[userId]) pollingClients[userId] = [];
  pollingClients[userId].push(res);

  // Timeout after 25s (Keep under browser 30s limit)
  setTimeout(() => {
    if (pollingClients[userId]) {
      const index = pollingClients[userId].indexOf(res);
      if (index > -1) {
        pollingClients[userId].splice(index, 1);
        try { res.json([]); } catch(e) {} // Return empty if no new messages
      }
    }
  }, 25000);
});

// 6. ADD REACTION
app.post('/react', (req, res) => {
  const { messageId, emoji } = req.body;
  const msg = db.prepare('SELECT reactions FROM messages WHERE id = ?').get(messageId);
  if (!msg) return res.sendStatus(404);

  let reactions = JSON.parse(msg.reactions || '[]');
  reactions.push(emoji);
  
  db.prepare('UPDATE messages SET reactions = ? WHERE id = ?').run(JSON.stringify(reactions), messageId);
  res.json({ success: true });
});

// 7. DELETE ACCOUNT (Secure)
app.post('/delete', (req, res) => {
  const { id, password } = req.body;
  
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!user) return res.sendStatus(401);

  // Verify password
  let isValid = false;
  if (user.salt) {
    isValid = hashPassword(password, user.salt) === user.password_hash;
  } else {
    isValid = crypto.createHash('sha256').update(password).digest('hex') === user.password_hash;
  }

  if (!isValid) return res.status(401).json({ error: "Invalid credentials" });
  
  db.prepare('DELETE FROM users WHERE id = ?').run(id);
  db.prepare('DELETE FROM messages WHERE from_user = ? OR to_user = ?').run(id, id);
  res.json({ success: true });
});

// 8. GET USER AVATAR
app.get('/user/:id', (req, res) => {
  try {
    const user = db.prepare('SELECT avatar FROM users WHERE id = ?').get(req.params.id);
    res.json({ avatar: user ? user.avatar : null });
  } catch (e) { res.sendStatus(500); }
});

// CLEANUP TASK (Auto-delete old messages)
setInterval(() => {
  const cutoff = Date.now() - (30 * 24 * 60 * 60 * 1000); // 30 Days
  db.prepare('DELETE FROM messages WHERE timestamp < ?').run(cutoff);
}, 60 * 60 * 1000); // Run every hour

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Server running on Port ${PORT}`));
