require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');
const bcrypt = require('bcryptjs');
const db = require('./db');
const expressLayouts = require('express-ejs-layouts');

const app = express();

// Middlewares
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(session({ secret: process.env.SESSION_SECRET, resave: false, saveUninitialized: false }));

// EJS + Layout
app.set('view engine', 'ejs');
app.use(expressLayouts);
app.set('layout', 'layout');
app.set('views', path.join(__dirname, 'views'));

// User in allen Views verfügbar
app.use((req, res, next) => { res.locals.user = req.session.user || null; next(); });

// PWA: Service Worker Registrieren
app.get('/register-sw.js', (req, res) => res.sendFile(path.join(__dirname, 'public', 'register-sw.js')));

// Auth Helpers
const ensureAuthenticated = (req, res, next) => req.session.user ? next() : res.redirect('/login');
const ensureAdmin = (req, res, next) => req.session.user?.role === 'admin' ? next() : res.redirect('/dashboard');

// DB initialisieren
async function initDB() {
  await db.query(`CREATE TABLE IF NOT EXISTS users (id SERIAL PRIMARY KEY, username TEXT UNIQUE NOT NULL, password TEXT NOT NULL, role TEXT NOT NULL)`);
  await db.query(`CREATE TABLE IF NOT EXISTS penalties (id SERIAL PRIMARY KEY, user_id INTEGER REFERENCES users(id) ON DELETE CASCADE, amount NUMERIC NOT NULL, event TEXT NOT NULL, reason TEXT NOT NULL, created_at TIMESTAMP DEFAULT NOW())`);
  const count = (await db.query("SELECT COUNT(*) FROM users WHERE role='admin' ")).rows[0].count;
  if (count === '0') {
    const hash = await bcrypt.hash('admin123', 10);
    await db.query("INSERT INTO users (username, password, role) VALUES ($1,$2,'admin')", ['admin', hash]);
    console.log('✅ Admin angelegt: admin / admin123');
  }
}
initDB();

// Routes
app.get('/', (req, res) => res.redirect('/login'));

app.get('/login', (req, res) => res.render('login'));
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const { rows } = await db.query('SELECT * FROM users WHERE username=$1', [username]);
  if (rows.length === 0 || !(await bcrypt.compare(password, rows[0].password))) return res.redirect('/login');
  req.session.user = rows[0];
  res.redirect('/dashboard');
});

app.get('/logout', (req, res) => { req.session.destroy(); res.redirect('/login'); });

app.get('/register', ensureAdmin, (req, res) => res.render('register'));
app.post('/register', ensureAdmin, async (req, res) => {
  const { username, password, role } = req.body;
  const hash = await bcrypt.hash(password, 10);
  await db.query('INSERT INTO users (username, password, role) VALUES ($1,$2,$3)', [username, hash, role]);
  res.redirect('/users');
});

app.get('/dashboard', ensureAuthenticated, (req, res) => res.render('dashboard'));

app.get('/users', ensureAdmin, async (req, res) => {
  const users = (await db.query('SELECT id, username, role FROM users')).rows;
  res.render('users', { users });
});

app.get('/penalties', ensureAuthenticated, async (req, res) => {
  const penalties = (await db.query(`SELECT p.id, u.username, p.amount, p.event, p.reason, p.created_at FROM penalties p JOIN users u ON p.user_id=u.id ORDER BY p.created_at DESC`)).rows;
  res.render('penalties', { penalties });
});

app.get('/penalties/new', ensureAdmin, (req, res) => res.render('penalty_new'));
app.post('/penalties/new', ensureAdmin, async (req, res) => {
  const { user_id, amount, event, reason } = req.body;
  await db.query('INSERT INTO penalties (user_id, amount, event, reason) VALUES ($1,$2,$3,$4)', [user_id, amount, event, reason]);
  res.redirect('/penalties');
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Server läuft auf http://localhost:${PORT}`));
