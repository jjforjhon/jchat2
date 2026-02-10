const express = require('express');
const cors = require('cors');
const Database = require('better-sqlite3');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// DATABASE SETUP
const db = new Database('dead_drop.sqlite');
db.exec(`
  CREATE TABLE IF NOT EXISTS queue (
    id TEXT PRIMARY KEY,
    to_user TEXT NOT NULL,
    payload TEXT NOT NULL,
    timestamp INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_to_user ON queue(to_user);
  
  -- THIS IS THE MISSING PART WE NEEDED:
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    public_key TEXT,
    avatar TEXT,
    last_seen INTEGER
  );
`);

// 1. REGISTER USER (The Fix)
app.post('/register', (req, res) => {
  const { id, publicKey, avatar } = req.body;
  if (!id) return res.sendStatus(400);

  try {
    const stmt = db.prepare(
      'INSERT OR REPLACE INTO users (id, public_key, avatar, last_seen) VALUES (?, ?, ?, ?)'
    );
    stmt.run(id, publicKey, avatar || '', Date.now());
    res.json({ success: true });
  } catch (e) {
    console.error(e);
    res.sendStatus(500);
  }
});

// 2. SEND MESSAGE
app.post('/queue/send', (req, res) => {
  const { toUserId, message } = req.body;
  if (!toUserId || !message || !message.id) return res.sendStatus(400);

  try {
    const stmt = db.prepare(
      'INSERT OR REPLACE INTO queue (id, to_user, payload, timestamp) VALUES (?, ?, ?, ?)'
    );
    stmt.run(message.id, toUserId, JSON.stringify(message), Date.now());
    res.json({ status: 'queued' });
  } catch (e) {
    console.error(e);
    res.sendStatus(500);
  }
});

// 3. SYNC MESSAGES
app.get('/queue/sync/:userId', (req, res) => {
  const rows = db
    .prepare('SELECT payload FROM queue WHERE to_user = ? ORDER BY timestamp ASC')
    .all(req.params.userId);

  const out = [];
  for (const r of rows) {
    try { out.push(JSON.parse(r.payload)); } catch {}
  }
  res.json(out);
});

// 4. ACKNOWLEDGE (DELETE)
app.post('/queue/ack', (req, res) => {
  const { userId, messageIds } = req.body;
  if (!userId || !Array.isArray(messageIds)) return res.sendStatus(400);

  const del = db.prepare('DELETE FROM queue WHERE id = ? AND to_user = ?');
  const tx = db.transaction((ids) => {
    for (const id of ids) del.run(id, userId);
  });
  tx(messageIds);

  res.sendStatus(200);
});

// CLEANUP (Run every hour)
setInterval(() => {
  const cutoff = Date.now() - (3 * 24 * 60 * 60 * 1000);
  db.prepare('DELETE FROM queue WHERE timestamp < ?').run(cutoff);
}, 60 * 60 * 1000);

app.listen(3000, '0.0.0.0', () => console.log("🚀 Server running on Port 3000"));
