# 🧱 Brick Burst
A fun match-and-pop puzzle game where you earn points, convert them to cash, and win rewards!

---

## 🚀 Features
- ✅ User registration & login with secure authentication
- ✅ Match 2+ same-colored blocks to earn points
- ✅ Bigger groups = higher points
- ✅ Floating score animations & satisfying sound effects
- ✅ Background music with adjustable volume
- ✅ Separate controls for music / sound effects
- ✅ Settings save automatically between sessions
- ✅ Watch ads to double rewards
- ✅ Convert points to real cash
- ✅ Responsive design, works on mobile & desktop

---

## 📁 Project Structure
your-project/
├── server.js # Backend API & game logic
├── database.js # SQLite database setup
├── middleware.js # Authentication checks
├── package.json # Dependencies & scripts
├── .env # Environment variables (create this)
└── public/
├── index.html # Main page layout
├── style.css # All styling
├── app.js # Frontend UI & logic
└── game.js # Game engine, animations, audio


---

## ⚙️ Requirements
- Node.js 16+ installed
- npm or yarn package manager

---

## 📥 Installation

### 1. Clone or download the files
Make sure all files are in the same folder structure as above.

### 2. Install dependencies
Open your terminal in the project folder and run:
```bash
npm install express sqlite3 bcryptjs jsonwebtoken cors dotenv