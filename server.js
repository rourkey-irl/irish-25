const express = require('express');
const bcrypt = require('bcrypt');
const session = require('express-session');
const path = require('path');
const db = require('./db');

const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: process.env.SESSION_SECRET || 'irish25-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 24 } // 24 hours
}));

// Middleware — protect routes that need login
function requireAuth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'Not logged in' });
  next();
}

// REGISTER
app.post('/api/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

  try {
    const hash = await bcrypt.hash(password, 10);
    const result = db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)').run(username, hash);
    db.prepare('INSERT INTO scores (user_id) VALUES (?)').run(result.lastInsertRowid);
    req.session.userId = result.lastInsertRowid;
    req.session.username = username;
    res.json({ username });
  } catch (e) {
    res.status(400).json({ error: 'Username already taken' });
  }
});

// LOGIN
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user) return res.status(401).json({ error: 'Invalid username or password' });

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) return res.status(401).json({ error: 'Invalid username or password' });

  req.session.userId = user.id;
  req.session.username = user.username;
  res.json({ username: user.username });
});

// LOGOUT
app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

// GET current user
app.get('/api/me', (req, res) => {
  if (!req.session.userId) return res.json({ user: null });
  res.json({ user: { id: req.session.userId, username: req.session.username } });
});

// LEADERBOARD
app.get('/api/leaderboard', (req, res) => {
  const rows = db.prepare(`
    SELECT u.username, s.wins, s.losses, s.tricks_won
    FROM scores s
    JOIN users u ON u.id = s.user_id
    ORDER BY s.wins DESC
    LIMIT 10
  `).all();
  res.json(rows);
});

// SAVE round result
app.post('/api/result', requireAuth, (req, res) => {
  const { result, tricks } = req.body;
  const userId = req.session.userId;
  if (result === 'win') {
    db.prepare('UPDATE scores SET wins = wins + 1, tricks_won = tricks_won + ? WHERE user_id = ?')
      .run(tricks, userId);
  } else {
    db.prepare('UPDATE scores SET losses = losses + 1, tricks_won = tricks_won + ? WHERE user_id = ?')
      .run(tricks, userId);
  }
  res.json({ success: true });
});


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Irish 25 running at http://localhost:${PORT}`));