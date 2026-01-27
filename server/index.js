const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const sqlite3 = require('sqlite3').verbose();
const { v4: uuidv4 } = require('uuid');

const app = express();
app.use(cors());
app.use(express.json());

// Persistent Database (Stores only Identity)
const db = new sqlite3.Database('./users.db');

// Initialize Schema
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE,
      password TEXT,
      name TEXT,
      avatar TEXT
    )
  `);
});

const SECRET_KEY = "CHANGE_THIS_TO_SOMETHING_SECRET";

// --- ROUTES ---

// 1. SIGN UP
app.post('/api/signup', (req, res) => {
  const { email, password, name, avatar } = req.body;
  const hashedPassword = bcrypt.hashSync(password, 8);
  const id = uuidv4().substring(0, 8).toUpperCase(); // 8-char Unique ID

  const stmt = db.prepare("INSERT INTO users (id, email, password, name, avatar) VALUES (?, ?, ?, ?, ?)");
  stmt.run(id, email, hashedPassword, name, avatar, function(err) {
    if (err) return res.status(400).json({ error: "Email already exists" });
    
    const token = jwt.sign({ id }, SECRET_KEY);
    res.json({ id, name, email, avatar, token });
  });
});

// 2. LOGIN
app.post('/api/login', (req, res) => {
  const { email, password } = req.body;

  db.get("SELECT * FROM users WHERE email = ?", [email], (err, user) => {
    if (!user) return res.status(404).json({ error: "User not found" });

    const passwordIsValid = bcrypt.compareSync(password, user.password);
    if (!passwordIsValid) return res.status(401).json({ error: "Invalid password" });

    const token = jwt.sign({ id: user.id }, SECRET_KEY);
    res.json({ id: user.id, name: user.name, email: user.email, avatar: user.avatar, token });
  });
});

// 3. DELETE PROFILE
app.post('/api/delete', (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(401).send("No token");

  try {
    const decoded = jwt.verify(token, SECRET_KEY);
    db.run("DELETE FROM users WHERE id = ?", [decoded.id], function(err) {
      if (err) return res.status(500).send("DB Error");
      res.json({ success: true });
    });
  } catch (e) {
    res.status(401).send("Invalid Token");
  }
});

app.listen(3001, () => {
  console.log("Identity Server running on port 3001");
});