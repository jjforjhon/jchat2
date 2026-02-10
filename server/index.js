const express = require('express');
const cors = require('cors');
const Database = require('better-sqlite3');
const crypto = require('crypto');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' })); // Large limit for images

// DATABASE
const db = new Database('jchat_persistent.sqlite');
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    password_hash TEXT,
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

// 1. REGISTER
app.post('/register', (req, res) => {
  const { id, password, avatar } = req.body;
  if (!id || !password) return res.sendStatus(400);
  const hash = crypto.createHash('sha256').update(password).digest('hex');

  try {
    db.prepare('INSERT INTO users (id, password_hash, avatar, created_at) VALUES (?, ?, ?, ?)')
      .run(id, hash, avatar || '', Date.now());
    res.json({ success: true });
  } catch (e) {
    res.status(409).json({ error: "User ID exists" });
  }
});

// 2. LOGIN
app.post('/login', (req, res) => {
  const { id, password } = req.body;
  const hash = crypto.createHash('sha256').update(password).digest('hex');
  const user = db.prepare('SELECT * FROM users WHERE id = ? AND password_hash = ?').get(id, hash);
  
  if (user) res.json({ success: true, user: { id: user.id, avatar: user.avatar, name: user.name } });
  else res.status(401).json({ error: "Invalid Credentials" });
});

// 3. UPDATE PROFILE (NEW)
app.post('/update-profile', (req, res) => {
  const { id, password, avatar, name } = req.body;
  const hash = crypto.createHash('sha256').update(password).digest('hex');

  const info = db.prepare('UPDATE users SET avatar = ?, name = ? WHERE id = ? AND password_hash = ?')
    .run(avatar, name, id, hash);

  if (info.changes > 0) res.json({ success: true });
  else res.status(401).json({ error: "Auth Failed" });
});

// 4. SEND MESSAGE
app.post('/send', (req, res) => {
  const { id, fromUser, toUser, payload, type } = req.body;
  try {
    db.prepare('INSERT INTO messages (id, from_user, to_user, payload, type, timestamp) VALUES (?, ?, ?, ?, ?, ?)')
      .run(id, fromUser, toUser, payload, type || 'text', Date.now());
    res.json({ success: true });
  } catch (e) { res.sendStatus(500); }
});

// 5. SYNC
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
    payload: r.payload, // This contains text or Base64 image
    type: r.type,
    timestamp: r.timestamp,
    reactions: JSON.parse(r.reactions || '[]')
  })));
});

// 6. DELETE & REACT (Keep existing logic)
app.post('/delete', (req, res) => { /* Same as before */ });
app.post('/react', (req, res) => { /* Same as before */ });

app.listen(3000, '0.0.0.0', () => console.log("🚀 Server running on 3000"));
