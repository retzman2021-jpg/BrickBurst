const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'brickburst.db');
let db;

async function initDB() {
  const SQL = await initSqlJs();
  if (fs.existsSync(dbPath)) {
    const buf = fs.readFileSync(dbPath);
    db = new SQL.Database(buf);
  } else {
    db = new SQL.Database();
  }

  // Create table only if missing
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    points INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  saveDB();
  console.log("✅ Database ready");
}

function saveDB() {
  try {
    const data = db.export();
    fs.writeFileSync(dbPath, Buffer.from(data));
    console.log("✅ Database saved");
  } catch (e) {
    console.error("❌ Save failed:", e.message);
  }
}

module.exports = { initDB, db, saveDB };