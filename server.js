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

// Start server only after DB is ready
initDB().then(() => {
  app.listen(PORT, () => console.log(`✅ Running on port ${PORT}`));
});

// === REGISTER (fixed duplicate check) ===
app.post('/api/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({error: "Fill all fields"});
    if (password.length < 6) return res.status(400).json({error: "Password min 6 chars"});

    // First check if username EXISTS already
    const existing = db.exec(`SELECT username FROM users WHERE username = ?`, [username]);
    if (existing.length > 0) {
      return res.status(400).json({error: "Username already taken"});
    }

    // Create new user
    const hash = await bcrypt.hash(password, 10);
    db.run(`INSERT INTO users (username, password) VALUES (?,?)`, [username, hash]);
    saveDB(); // Critical: save immediately after insert

    const token = jwt.sign({username}, JWT_SECRET, {expiresIn: '7d'});
    res.json({token, user: {username, points: 0}});
  } catch (e) {
    console.error("Register error:", e);
    res.status(500).json({error: "Server error"});
  }
});

// === LOGIN (fixed query parsing) ===
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({error: "Fill all fields"});

    // sql.js returns an array of result sets
    const result = db.exec(`SELECT * FROM users WHERE username = ?`, [username]);
    if (!result.length || !result[0].values.length) {
      return res.status(401).json({error: "User not found"});
    }

    // Get user data correctly
    const user = result[0].values[0];
    const ok = await bcrypt.compare(password, user[2]);
    if (!ok) return res.status(401).json({error: "Wrong password"});

    const token = jwt.sign({username}, JWT_SECRET, {expiresIn: '7d'});
    res.json({token, user: {username: user[1], points: user[3]}});
  } catch (e) {
    console.error("Login error:", e);
    res.status(500).json({error: "Server error"});
  }
});