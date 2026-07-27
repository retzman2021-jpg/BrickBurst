const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'brickburst.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) console.error('❌ DB connect error:', err);
  else console.log('✅ Database connected');
});

// Create users table automatically
db.run(`CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  points INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)`);

module.exports = db;