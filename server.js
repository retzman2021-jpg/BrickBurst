require('dotenv').config();
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'brickburst_super_secret_2026';

// ==================================================
// MIDDLEWARE
// ==================================================
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

// Ensure uploads folder
if (!fs.existsSync('./uploads')) fs.mkdirSync('./uploads', { recursive: true });

// ==================================================
// IN-MEMORY DATABASE (replace with MongoDB later)
// ==================================================
const users = [];
const kycSubmissions = [];
const transactions = [];
const ADMIN_PIN = process.env.ADMIN_PIN || 'admin123';

// ==================================================
// HELPERS
// ==================================================
function createToken(id) {
  return jwt.sign({ id }, JWT_SECRET, { expiresIn: '7d' });
}
function safeUser(u) {
  const { password, ...rest } = u;
  return rest;
}
function todayKey() {
  return new Date().toISOString().slice(0, 10);
}
function authGuard(req, res, next) {
  const h = req.headers.authorization;
  if (!h || !h.startsWith('Bearer ')) return res.status(401).json({ ok: false, error: 'Unauthorized' });
  const tok = h.split(' ')[1];
  try {
    const dec = jwt.verify(tok, JWT_SECRET);
    const u = users.find(x => x.id === dec.id);
    if (!u) return res.status(401).json({ ok: false, error: 'User not found' });
    req.user = u;
    next();
  } catch {
    return res.status(401).json({ ok: false, error: 'Invalid token' });
  }
}

// ==================================================
// ✅ REGISTER — +300 WELCOME BONUS AUTO-ADDED
// ==================================================
app.post('/register', async (req, res) => {
  try {
    const { username, email, phone, birthday, password, confirm } = req.body;
    if (!username || !email || !phone || !birthday || !password || !confirm) {
      return res.status(400).json({ ok: false, error: 'Fill all fields' });
    }
    if (password !== confirm) return res.status(400).json({ ok: false, error: 'Password mismatch' });
    if (password.length < 8) return res.status(400).json({ ok: false, error: 'Min 8 chars' });
    if (users.find(x => x.username.toLowerCase() === username.toLowerCase())) {
      return res.status(400).json({ ok: false, error: 'Username taken' });
    }
    if (users.find(x => x.email.toLowerCase() === email.toLowerCase())) {
      return res.status(400).json({ ok: false, error: 'Email registered' });
    }
    if (users.find(x => x.phone === phone)) {
      return res.status(400).json({ ok: false, error: 'Mobile used' });
    }

    const hash = await bcrypt.hash(password, 12);
    const newUser = {
      id: Date.now().toString(),
      username: username.toLowerCase(),
      email: email.toLowerCase(),
      phone,
      birthday,
      password: hash,
      points: 300, // ✅ WELCOME BONUS STARTS HERE
      cash: 0,
      kycStatus: 'unverified',
      kycLevel: 0,
      lastLoginDate: null,
      dailyClaimed: [],
      isAdmin: false,
      frozen: false,
      freezeReason: '',
      createdAt: new Date().toISOString()
    };
    users.push(newUser);

    // Log welcome bonus
    transactions.push({
      id: Date.now().toString(),
      user: newUser.username,
      type: 'welcome_bonus',
      amount: 300,
      date: new Date().toISOString(),
      status: 'completed'
    });

    const token = createToken(newUser.id);
    res.json({
      ok: true,
      token,
      user: safeUser(newUser),
      welcomeBonus: 300,    // ✅ FRONTEND READS THIS
      bonusAdded: 300       // ✅ FALLBACK
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ==================================================
// ✅ LOGIN — +100 DAILY BONUS AUTO-ADDED
// ==================================================
app.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ ok: false, error: 'Fill fields' });

    const user = users.find(x => x.username.toLowerCase() === username.toLowerCase());
    if (!user) return res.status(404).json({ ok: false, error: 'User not found' });
    if (user.frozen) return res.status(403).json({ ok: false, error: `Frozen: ${user.freezeReason}` });

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ ok: false, error: 'Wrong password' });

    // ✅ DAILY LOGIN BONUS CHECK
    const today = todayKey();
    let dailyBonusGiven = false;
    let bonusAdded = 0;
    if (user.lastLoginDate !== today) {
      user.points += 100;
      user.lastLoginDate = today;
      user.dailyClaimed.push(today);
      dailyBonusGiven = true;
      bonusAdded = 100;

      transactions.push({
        id: Date.now().toString(),
        user: user.username,
        type: 'daily_bonus',
        amount: 100,
        date: new Date().toISOString(),
        status: 'completed'
      });
    }

    const token = createToken(user.id);
    res.json({
      ok: true,
      token,
      user: safeUser(user),
      dailyBonusGiven,  // ✅ FRONTEND READS THIS
      bonusAdded        // ✅ AMOUNT ADDED
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ==================================================
// USER DATA
// ==================================================
app.get('/user', authGuard, (req, res) => {
  const u = req.user;
  res.json({
    ...safeUser(u),
    limits: {
      single: u.kycStatus === 'verified' ? 5000 : 500,
      daily: u.kycStatus === 'verified' ? 20000 : 2000,
      weekly: u.kycStatus === 'verified' ? 100000 : 10000,
      monthly: u.kycStatus === 'verified' ? 500000 : 50000
    },
    dailyUsed: 0
  });
});

// ==================================================
// GAME ENDPOINT
// ==================================================
app.post('/game/end', authGuard, (req, res) => {
  const { points } = req.body;
  if (!points || points < 0) return res.status(400).json({ ok: false });
  req.user.points += points;
  res.json({ ok: true, newPoints: req.user.points });
});

// ==================================================
// ADS
// ==================================================
app.post('/watch-ad', authGuard, (req, res) => {
  req.user.points += 200;
  transactions.push({
    id: Date.now().toString(),
    user: req.user.username,
    type: 'ad_reward',
    amount: 200,
    date: new Date().toISOString(),
    status: 'completed'
  });
  res.json({ ok: true, added: 200, new_points: req.user.points });
});

// ==================================================
// CONVERT
// ==================================================
app.post('/convert', authGuard, (req, res) => {
  const amt = Math.floor(Number(req.body.amount) || 0);
  if (!amt || amt < 100 || amt % 100 !== 0) return res.status(400).json({ ok: false });
  if (req.user.points < amt) return res.status(400).json({ ok: false, error: 'Not enough points' });
  req.user.points -= amt;
  req.user.cash += amt / 100;
  transactions.push({
    id: Date.now().toString(),
    user: req.user.username,
    type: 'convert',
    amount: amt / 100,
    date: new Date().toISOString(),
    status: 'completed'
  });
  res.json({ ok: true });
});

// ==================================================
// WITHDRAW
// ==================================================
app.post('/withdraw-paymongo', authGuard, (req, res) => {
  const { amount, paymentMethod, account, accountName } = req.body;
  const amt = Math.floor(Number(amount) || 0);
  if (!amt || amt < 100) return res.status(400).json({ ok: false, error: 'Min ₱100' });
  if (req.user.cash < amt) return res.status(400).json({ ok: false, error: 'Insufficient balance' });
  if (req.user.kycStatus !== 'verified') return res.status(403).json({ ok: false, error: 'Submit KYC first' });

  req.user.cash -= amt;
  transactions.push({
    id: Date.now().toString(),
    user: req.user.username,
    type: 'withdraw',
    amount: amt,
    method: paymentMethod,
    accountName,
    date: new Date().toISOString(),
    status: 'pending'
  });
  res.json({ ok: true, message: '✅ Withdrawal request sent — review within 24h' });
});

// ==================================================
// KYC
// ==================================================
app.get('/kyc/status', authGuard, (req, res) => {
  res.json({ status: req.user.kycStatus });
});
app.post('/kyc/submit', authGuard, (req, res) => {
  req.user.kycStatus = 'pending';
  kycSubmissions.push({ id: Date.now().toString(), username: req.user.username, ...req.body, submittedAt: new Date().toISOString() });
  res.json({ ok: true, message: '✅ KYC submitted — review within 24h' });
});

// ==================================================
// TRANSACTIONS
// ==================================================
app.get('/user/transactions', authGuard, (req, res) => {
  res.json(transactions.filter(t => t.user === req.user.username).reverse());
});

// ==================================================
// ADMIN
// ==================================================
app.post('/admin/login', (req, res) => {
  if (req.body.pin !== ADMIN_PIN) return res.status(401).json({ ok: false });
  const admin = { id: 'admin', username: 'admin', isAdmin: true };
  users.push(admin);
  res.json({ ok: true, token: createToken('admin'), user: admin });
});
app.get('/admin/stats', authGuard, (req, res) => {
  if (!req.user.isAdmin) return res.status(403).json({ ok: false });
  res.json({
    totalUsers: users.filter(u => !u.isAdmin).length,
    verified: users.filter(u => u.kycStatus === 'verified').length,
    pendingKyc: kycSubmissions.length,
    volume: transactions.reduce((s, t) => s + (Number(t.amount) || 0), 0)
  });
});
app.get('/admin/kyc', authGuard, (req, res) => {
  if (!req.user.isAdmin) return res.status(403).json({ ok: false });
  res.json(kycSubmissions);
});
app.post('/admin/kyc/:user/:action', authGuard, (req, res) => {
  if (!req.user.isAdmin) return res.status(403).json({ ok: false });
  const u = users.find(x => x.username === req.params.user);
  if (!u) return res.status(404).json({ ok: false });
  u.kycStatus = req.params.action === 'approve' ? 'verified' : 'rejected';
  u.kycLevel = req.params.action === 'approve' ? 1 : 0;
  res.json({ ok: true, message: `✅ KYC ${req.params.action}d` });
});
app.get('/admin/users', authGuard, (req, res) => {
  if (!req.user.isAdmin) return res.status(403).json({ ok: false });
  res.json(users.filter(u => !u.isAdmin).map(safeUser));
});
app.post('/admin/user/:user/:action', authGuard, (req, res) => {
  if (!req.user.isAdmin) return res.status(403).json({ ok: false });
  const u = users.find(x => x.username === req.params.user);
  if (!u) return res.status(404).json({ ok: false });
  u.frozen = req.params.action === 'freeze';
  u.freezeReason = req.body.reason || '';
  res.json({ ok: true });
});
app.get('/admin/transactions', authGuard, (req, res) => {
  if (!req.user.isAdmin) return res.status(403).json({ ok: false });
  res.json(transactions.reverse());
});

// ==================================================
// SERVE INDEX.HTML
// ==================================================
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ==================================================
// START
// ==================================================
app.listen(PORT, () => console.log(`🚀 BrickBurst Server running on port ${PORT}`));