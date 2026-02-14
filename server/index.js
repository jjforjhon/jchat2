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

// ... (Keep your database creation and migration code here - NO CHANGE) ...

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

// ... (Keep Migration Logic and HELPER Hash Function) ...

// ✅ NEW: Global "Waiting Room" for long-polling clients
// Format: { userId: [responseObject, responseObject, ...] }
const pollingClients = {};

// Helper to notify waiting clients
const notifyUser = (userId) => {
  if (pollingClients[userId]) {
    // Tell all waiting connections for this user to check the DB now
    pollingClients[userId].forEach(res => res.json({ newMessages: true }));
    pollingClients[userId] = []; // Clear the waiting list
  }
};

// ... (Keep /register, /login, /update-profile routes - NO CHANGE) ...

// 4. SEND MESSAGE (Updated to Trigger Notification)
app.post('/send', (req, res) => {
  const { id, fromUser, toUser, payload, type } = req.body;
  try {
    db.prepare('INSERT INTO messages (id, from_user, to_user, payload, type, timestamp) VALUES (?, ?, ?, ?, ?, ?)')
      .run(id, fromUser, toUser, payload, type || 'text', Date.now());
    
    // ✅ TRIGGER: Wake up the recipient immediately!
    notifyUser(toUser);
    // Also wake up the sender (for sync on their other devices)
    notifyUser(fromUser);

    res.json({ success: true });
  } catch (e) { res.sendStatus(500); }
});

// 5. SYNC (Updated for LONG POLLING)
app.get('/sync/:userId', async (req, res) => {
  const { userId } = req.params;
  const { since } = req.query; 

  // Query Function
  const getMessages = () => {
    let query = 'SELECT * FROM messages WHERE to_user = ? OR from_user = ? ORDER BY timestamp ASC';
    let params = [userId, userId];
    if (since) {
      query = 'SELECT * FROM messages WHERE (to_user = ? OR from_user = ?) AND timestamp > ? ORDER BY timestamp ASC';
      params.push(since);
    }
    return db.prepare(query).all(...params);
  };

  // 1. Check immediately
  const messages = getMessages();
  
  // 2. If we have data, return immediately
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

  // 3. If NO data, WAIT (Long Poll)
  // Store this response object in the waiting list
  if (!pollingClients[userId]) pollingClients[userId] = [];
  pollingClients[userId].push(res);

  // Set a safety timeout (25 seconds) to close connection if no messages arrive
  setTimeout(() => {
    // If this response is still in the waiting list, remove it and send empty list
    if (pollingClients[userId]) {
      const index = pollingClients[userId].indexOf(res);
      if (index > -1) {
        pollingClients[userId].splice(index, 1);
        try { res.json([]); } catch(e) {} // Prevent error if already sent
      }
    }
  }, 25000); // 25s timeout (Keep under browser 30s limit)
});

// ... (Keep /react, /delete, /user/:id and Cleanup Task - NO CHANGE) ...

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Server running on Port ${PORT}`));
