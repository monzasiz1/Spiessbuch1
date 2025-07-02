require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');
const bcrypt = require('bcrypt');
const PDFDocument = require('pdfkit');
const db = require('./db');

const app = express();

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(session({
  secret: 'spiess-geheimnis',
  resave: false,
  saveUninitialized: false
}));

// Auth Middleware
const ensureAuthenticated = (req, res, next) => {
  if (req.session.user) return next();
  res.redirect('/login');
};
const ensureAdmin = (req, res, next) => {
  if (req.session.user?.role === 'admin') return next();
  res.redirect('/dashboard');
};

// Initial Admin Check
const createInitialAdmin = async () => {
  const result = await db.query('SELECT COUNT(*) FROM users WHERE role = $1', ['admin']);
  if (result.rows[0].count === '0') {
    const hash = await bcrypt.hash('admin123', 10);
    await db.query('INSERT INTO users (username, password, role) VALUES ($1, $2, $3)', ['admin', hash, 'admin']);
  }
};
createInitialAdmin();

// Routen
app.get('/', (req, res) => res.render('home'));

app.get('/register', ensureAdmin, (req, res) => res.render('register'));
app.post('/register', ensureAdmin, async (req, res) => {
  const { username, password, role } = req.body;
  const hash = await bcrypt.hash(password, 10);
  db.query('INSERT INTO users (username, password, role) VALUES ($1, $2, $3)', [username, hash, role], err => {
    if (err) return res.send('Fehler bei Registrierung.');
    res.redirect('/admin');
  });
});

app.get('/login', (req, res) => res.render('login'));
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const result = await db.query('SELECT * FROM users WHERE username = $1', [username]);
  if (result.rows.length === 0) return res.redirect('/login');

  const user = result.rows[0];
  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return res.redirect('/login');
  req.session.user = { id: user.id, username: user.username, role: user.role };
  res.redirect('/dashboard');
});

app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/login');
});

// Dashboard-Routen
const dashboardRoutes = require('./routes/dashboard');
app.use('/dashboard', dashboardRoutes);

// Adminbereich
app.get('/admin', ensureAuthenticated, ensureAdmin, async (req, res) => {
  const mitglieder = await db.query('SELECT * FROM users WHERE role != $1', ['admin']);
  const strafen = await db.query('SELECT strafen.*, users.username FROM strafen JOIN users ON strafen.user_id = users.id');
  res.render('admin', {
    user: req.session.user,
    mitglieder: mitglieder.rows,
    strafen: strafen.rows
  });
});

app.post('/admin/add', ensureAuthenticated, ensureAdmin, (req, res) => {
  const { user_id, datum, veranstaltung, grund, punkte } = req.body;
  db.query(
    'INSERT INTO strafen (user_id, datum, veranstaltung, grund, punkte) VALUES ($1, $2, $3, $4, $5)',
    [user_id, datum, veranstaltung, grund, punkte],
    () => res.redirect('/admin')
  );
});

app.get('/admin/edit/:id', ensureAuthenticated, ensureAdmin, async (req, res) => {
  const strafeResult = await db.query('SELECT * FROM strafen WHERE id = $1', [req.params.id]);
  const mitgliederResult = await db.query('SELECT * FROM users WHERE role != $1', ['admin']);
  if (strafeResult.rows.length === 0) return res.send('Fehler beim Laden.');
  res.render('edit', { strafe: strafeResult.rows[0], mitglieder: mitgliederResult.rows });
});

app.post('/admin/edit/:id', ensureAuthenticated, ensureAdmin, (req, res) => {
  const { datum, veranstaltung, grund, punkte } = req.body;
  db.query(
    'UPDATE strafen SET datum = $1, veranstaltung = $2, grund = $3, punkte = $4 WHERE id = $5',
    [datum, veranstaltung, grund, punkte, req.params.id],
    err => {
      if (err) return res.send('Fehler beim Speichern.');
      res.redirect('/admin');
    }
  );
});

// Benutzer bearbeiten
app.get('/admin/user/edit/:id', ensureAuthenticated, ensureAdmin, async (req, res) => {
  const result = await db.query('SELECT * FROM users WHERE id = $1', [req.params.id]);
  if (result.rows.length === 0) return res.send('Fehler beim Laden.');
  res.render('user_edit', { userData: result.rows[0] });
});

app.post('/admin/user/edit/:id', ensureAuthenticated, ensureAdmin, async (req, res) => {
  const { username, password, role } = req.body;
  const hash = await bcrypt.hash(password, 10);
  await db.query('UPDATE users SET username = $1, password = $2, role = $3 WHERE id = $4', [username, hash, role, req.params.id]);
  res.redirect('/admin');
});

app.post('/admin/user/delete/:id', ensureAuthenticated, ensureAdmin, async (req, res) => {
  await db.query('DELETE FROM users WHERE id = $1', [req.params.id]);
  res.redirect('/admin');
});

// PDF Export
app.get('/admin/export', ensureAuthenticated, ensureAdmin, async (req, res) => {
  const doc = new PDFDocument();
  res.setHeader('Content-Disposition', 'attachment; filename="spiessstrafen_gesamt.pdf"');
  res.setHeader('Content-Type', 'application/pdf');
  doc.pipe(res);
  const result = await db.query('SELECT strafen.*, users.username FROM strafen JOIN users ON users.id = strafen.user_id');
  const rows = result.rows;
  doc.fontSize(18).text('Spießstrafen Übersicht (alle Mitglieder)', { align: 'center' });
  doc.moveDown();
  rows.forEach(r => {
    const euro = parseFloat(r.punkte).toFixed(2);
    doc.fontSize(12).text(`${r.username} – ${r.veranstaltung || '–'} – ${r.grund} – ${euro} € (${r.datum})`);
  });
  const summe = rows.reduce((acc, r) => acc + parseFloat(r.punkte), 0);
  doc.moveDown().fontSize(14).text(`💰 Gesamtsumme: ${summe.toFixed(2)} €`, { align: 'right' });
  doc.end();
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server läuft auf http://localhost:${PORT}`);
});
