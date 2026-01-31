const express = require('express');
const cors = require('cors');
const Database = require('better-sqlite3');
const admin = require('firebase-admin');

const app = express();
app.use(cors());
app.use(express.json());

// 1. DATABASE (Creates 'dead_drop.sqlite' file automatically)
const db = new Database('dead_drop.sqlite');
db.exec(`
  CREATE TABLE IF NOT EXISTS queue (
    id TEXT PRIMARY KEY,
    to_user TEXT,
    payload TEXT,
    timestamp INTEGER
  );
`);

// 2. SEND MESSAGE (Save to DB)
app.post('/queue/send', (req, res) => {
  const { toUserId, message } = req.body;
  try {
    const stmt = db.prepare('INSERT INTO queue (id, to_user, payload, timestamp) VALUES (?, ?, ?, ?)');
    stmt.run(message.id, toUserId, JSON.stringify(message), Date.now());
    console.log(`📥 Stored message for ${toUserId}`);
    res.json({ status: 'queued' });
  } catch (e) { 
    console.error(e); 
    res.sendStatus(500); 
  }
});

// 3. SYNC MESSAGES (Fetch from DB)
app.get('/queue/sync/:userId', (req, res) => {
  const rows = db.prepare('SELECT payload FROM queue WHERE to_user = ?').all(req.params.userId);
  res.json(rows.map(r => JSON.parse(r.payload)));
});

// 4. ACKNOWLEDGE (Delete from DB)
app.post('/queue/ack', (req, res) => {
  const { userId, messageIds } = req.body;
  const del = db.prepare('DELETE FROM queue WHERE id = ? AND to_user = ?');
  const transaction = db.transaction((ids) => {
    for (const id of ids) del.run(id, userId);
  });
  transaction(messageIds);
  console.log(`🗑️ Deleted ${messageIds.length} messages`);
  res.sendStatus(200);
});

// 5. START SERVER
app.listen(3000, () => console.log("🚀 Server running on Port 3000"));