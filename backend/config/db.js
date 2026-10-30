const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

pool.on('connect', () => {
    console.log('[PostgreSQL] Connected to active database pool.');
});

pool.on('error', (err) => {
    console.error('[PostgreSQL Error] Unexpected client error:', err.message);
});

module.exports = {
    query: (text, params) => pool.query(text, params),
    pool
};
