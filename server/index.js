const express = require('express');
const cors = require('cors');
const Database = require('better-sqlite3');
const crypto = require('crypto'); // For password hashing

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' })); // Increased limit for Images/Videos

// DATABASE
const db = new Database('jchat_persistent.sqlite');
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    password_hash TEXT,
    public_key TEXT,
    avatar TEXT,
    created_at INTEGER
  );
  
  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    from_user TEXT,
    to_user TEXT,
    payload TEXT,
    type TEXT,
    timestamp INTEGER,
    reactions TEXT DEFAULT '[]' -- Store reactions as JSON string
  );
  CREATE INDEX IF NOT EXISTS idx_messages_users ON messages(from_user, to_user);
`);

// 1. REGISTER (Create Account)
app.post('/register', (req, res) => {
  const { id, password, publicKey, avatar } = req.body;
  if (!id || !password) return res.sendStatus(400);

  // Simple hash for security (In production, use bcrypt)
  const hash = crypto.createHash('sha256').update(password).digest('hex');

  try {
    const stmt = db.prepare('INSERT INTO users (id, password_hash, public_key, avatar, created_at) VALUES (?, ?, ?, ?, ?)');
    stmt.run(id, hash, publicKey, avatar || '', Date.now());
    res.json({ success: true });
  } catch (e) {
    if (e.code === 'SQLITE_CONSTRAINT_PRIMARYKEY') {
      res.status(409).json({ error: "User ID already exists" });
    } else {
      res.sendStatus(500);
    }
  }
});

// 2. LOGIN (Restore Account)
app.post('/login', (req, res) => {
  const { id, password } = req.body;
  const hash = crypto.createHash('sha256').update(password).digest('hex');

  const user = db.prepare('SELECT * FROM users WHERE id = ? AND password_hash = ?').get(id, hash);
  
  if (user) {
    res.json({ success: true, user: { id: user.id, name: user.id, avatar: user.avatar } });
  } else {
    res.status(401).json({ error: "Invalid ID or Password" });
  }
});

// 3. SEND MESSAGE (Persist history)
app.post('/send', (req, res) => {
  const { id, fromUser, toUser, payload, type } = req.body;
  try {
    db.prepare('INSERT INTO messages (id, from_user, to_user, payload, type, timestamp) VALUES (?, ?, ?, ?, ?, ?)')
      .run(id, fromUser, toUser, payload, type || 'text', Date.now());
    res.json({ success: true });
  } catch (e) {
    console.error(e);
    res.sendStatus(500);
  }
});

// 4. SYNC (Get History)
app.get('/sync/:userId', (req, res) => {
  const { userId } = req.params;
  const { since } = req.query; // Optional: fetch only new messages

  let query = 'SELECT * FROM messages WHERE to_user = ? OR from_user = ? ORDER BY timestamp ASC';
  if (since) query = 'SELECT * FROM messages WHERE (to_user = ? OR from_user = ?) AND timestamp > ? ORDER BY timestamp ASC';

  const rows = since 
    ? db.prepare(query).all(userId, userId, since)
    : db.prepare(query).all(userId, userId);

  const messages = rows.map(r => ({
    id: r.id,
    fromUser: r.from_user,
    toUser: r.to_user,
    payload: r.payload,
    type: r.type,
    timestamp: r.timestamp,
    reactions: JSON.parse(r.reactions || '[]')
  }));
  
  res.json(messages);
});

// 5. ADD REACTION
app.post('/react', (req, res) => {
  const { messageId, emoji } = req.body;
  const msg = db.prepare('SELECT reactions FROM messages WHERE id = ?').get(messageId);
  if (!msg) return res.sendStatus(404);

  let reactions = JSON.parse(msg.reactions || '[]');
  reactions.push(emoji);
  
  db.prepare('UPDATE messages SET reactions = ? WHERE id = ?').run(JSON.stringify(reactions), messageId);
  res.json({ success: true });
});

// 6. DELETE USER
app.post('/delete', (req, res) => {
  const { id, password } = req.body;
  const hash = crypto.createHash('sha256').update(password).digest('hex');
  
  const info = db.prepare('DELETE FROM users WHERE id = ? AND password_hash = ?').run(id, hash);
  if(info.changes > 0) {
      db.prepare('DELETE FROM messages WHERE from_user = ? OR to_user = ?').run(id, id);
      res.json({ success: true });
  } else {
      res.status(401).json({ error: "Invalid credentials" });
  }
});

app.listen(3000, '0.0.0.0', () => console.log("🚀 Persistent Server running on 3000"));
