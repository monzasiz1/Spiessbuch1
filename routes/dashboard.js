const express = require('express');
const router = express.Router();
const db = require('../db'); // zentrale PostgreSQL-Verbindung
const { ensureAuthenticated, ensureAdmin } = require('../middleware/auth');

// Dashboard – Mitglieder
router.get('/', ensureAuthenticated, (req, res) => {
  db.query('SELECT * FROM strafen WHERE user_id = $1', [req.session.user.id], (err, result) => {
    if (err) return res.send('Fehler beim Laden der Strafen.');
    const rows = result.rows;
    const punkte = rows.reduce((sum, s) => sum + s.punkte, 0);
    res.render('dashboard', {
      user: req.session.user,
      strafen: rows,
      punkte
    });
  });
});

// Admin-Seite
router.get('/admin', ensureAuthenticated, ensureAdmin, (req, res) => {
  db.query('SELECT strafen.*, users.username FROM strafen JOIN users ON users.id = strafen.user_id', (err, result1) => {
    if (err) return res.send('Fehler beim Laden der Strafen.');
    db.query('SELECT * FROM users WHERE role = $1', ['mitglied'], (err2, result2) => {
      if (err2) return res.send('Fehler beim Laden der Mitglieder.');
      res.render('admin', {
        user: req.session.user,
        strafen: result1.rows,
        mitglieder: result2.rows
      });
    });
  });
});

// Admin: Strafe hinzufügen
router.post('/admin/add', ensureAuthenticated, ensureAdmin, (req, res) => {
  const { user_id, datum, veranstaltung, grund, punkte } = req.body;
  db.query(
    'INSERT INTO strafen (user_id, datum, veranstaltung, grund, punkte) VALUES ($1, $2, $3, $4, $5)',
    [user_id, datum, veranstaltung, grund, punkte],
    (err) => {
      if (err) return res.send('Fehler beim Eintragen der Strafe.');
      res.redirect('/dashboard/admin');
    }
  );
});

module.exports = router;
