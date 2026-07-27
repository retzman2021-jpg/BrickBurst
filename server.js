const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('./database.js');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Secret key (create .env with JWT_SECRET=your_random_key)
const JWT_SECRET = process.env.JWT_SECRET || 'change_this_to_your_own_secret';

// === REGISTER ===
app.post('/api/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({error: 'Fill all fields'});
    if (password.length < 6) return res.status(400).json({error: 'Password min 6 chars'});

    const hash = await bcrypt.hash(password, 10);

    db.run(`INSERT INTO users (username, password) VALUES (?,?)`,
      [username, hash],
      function(err) {
        if (err) {
          if (err.message.includes('UNIQUE')) return res.status(400).json({error: 'Username taken'});
          return res.status(500).json({error: 'Database error'});
        }
        const token = jwt.sign({id: this.lastID, username}, JWT_SECRET, {expiresIn: '7d'});
        res.json({token, user: {id: this.lastID, username, points:0}});
      }
    );
  } catch (e) {
    res.status(500).json({error: 'Server error'});
  }
});

// === LOGIN ===
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({error: 'Fill all fields'});

    db.get(`SELECT * FROM users WHERE username = ?`, [username], async (err, user) => {
      if (err || !user) return res.status(401).json({error: 'User not found'});
      const ok = await bcrypt.compare(password, user.password);
      if (!ok) return res.status(401).json({error: 'Wrong password'});
      const token = jwt.sign({id: user.id, username: user.username}, JWT_SECRET, {expiresIn: '7d'});
      res.json({token, user: {id: user.id, username: user.username, points: user.points}});
    });
  } catch (e) {
    res.status(500).json({error: 'Server error'});
  }
});

app.listen(PORT, () => console.log(`✅ Running on port ${PORT}`));