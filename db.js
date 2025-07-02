require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL, // oder Einzelwerte DB_HOST etc.
  ssl: { rejectUnauthorized: false }
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool
};
