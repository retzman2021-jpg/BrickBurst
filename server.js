const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { initDB, db, saveDB } = require('./database.js');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'brickburst_secure_2026';

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Start server ONLY after DB is ready
initDB().then(() => {
  console.log("✅ Database initialized");
  app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
}).catch(err => {
  console.error("❌ DB init failed:", err);
});

// === REGISTER — CORRECT sql.js SYNTAX ===
app.post('/api/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({error: "Fill all fields"});
    if (password.length < 6) return res.status(400).json({error: "Password min 6 chars"});

    // Check existing user correctly
    const existing = db.exec(`SELECT username FROM users WHERE username = ?`, [username]);
    if (existing.length > 0 && existing[0].values.length > 0) {
      return res.status(400).json({error: "Username already taken"});
    }

    // Insert — sql.js uses exec(), NOT run()
    const hash = await bcrypt.hash(password, 10);
    db.exec(`INSERT INTO users (username, password) VALUES (?, ?)`, [username, hash]);
    saveDB(); // Save immediately

    const token = jwt.sign({username}, JWT_SECRET, {expiresIn: '7d'});
    res.json({token, user: {username, points: 0}});
  } catch (e) {
    console.error("❌ Register error:", e.message);
    res.status(500).json({error: "Server error: " + e.message});
  }
});

// === LOGIN — CORRECT sql.js SYNTAX ===
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({error: "Fill all fields"});

    const result = db.exec(`SELECT * FROM users WHERE username = ?`, [username]);
    if (!result.length || !result[0].values.length) {
      return res.status(401).json({error: "User not found"});
    }

    const userRow = result[0].values[0];
    const ok = await bcrypt.compare(password, userRow[2]);
    if (!ok) return res.status(401).json({error: "Wrong password"});

    const token = jwt.sign({username}, JWT_SECRET, {expiresIn: '7d'});
    res.json({token, user: {username: userRow[1], points: userRow[3]}});
  } catch (e) {
    console.error("❌ Login error:", e.message);
    res.status(500).json({error: "Server error: " + e.message});
  }
});