const express = require('express');
const cors = require('cors');
const Database = require('better-sqlite3');

const app = express();
app.use(cors());
app.use(express.json());

// DATABASE
const db = new Database('dead_drop.sqlite');
db.exec(`
  CREATE TABLE IF NOT EXISTS queue (
    id TEXT PRIMARY KEY,
    to_user TEXT NOT NULL,
    payload TEXT NOT NULL,
    timestamp INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_to_user ON queue(to_user);
  CREATE INDEX IF NOT EXISTS idx_time ON queue(timestamp);
`);

// TTL CLEANUP (1 hour)
setInterval(() => {
  const cutoff = Date.now() - 60 * 60 * 1000;
  db.prepare('DELETE FROM queue WHERE timestamp < ?').run(cutoff);
}, 10 * 60 * 1000);

// SEND
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

// SYNC
app.get('/queue/sync/:userId', (req, res) => {
  const rows = db
    .prepare('SELECT payload FROM queue WHERE to_user = ? ORDER BY timestamp ASC')
    .all(req.params.userId);

  const out = [];
  for (const r of rows) {
    try {
      out.push(JSON.parse(r.payload));
    } catch {}
  }
  res.json(out);
});

// ACK
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

app.listen(3000, () => console.log("🚀 Server running on Port 3000"));
