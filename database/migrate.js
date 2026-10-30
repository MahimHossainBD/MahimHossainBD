// database/migrate.js
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function runMigration() {
    console.log('[Database] Checking schema & tables...');
    try {
        const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
        await pool.query(sql);
        console.log('[Database] Tables and constraints synchronized.');

        // ডিফল্ট অ্যাডমিন অ্যাকাউন্ট যাচাই ও তৈরি (MrMahimFire / Mahim@123)
        const check = await pool.query('SELECT * FROM admins WHERE username = $1', ['MrMahimFire']);
        if (check.rows.length === 0) {
            const hash = await bcrypt.hash('Mahim@123', 10);
            await pool.query(
                'INSERT INTO admins (username, password_hash, email) VALUES ($1, $2, $3)',
                ['MrMahimFire', hash, 'MahimHossainBD@gmail.com']
            );
            console.log('[Database] Default admin user created: MrMahimFire');
        } else {
            console.log('[Database] Admin user exists.');
        }

        process.exit(0);
    } catch (err) {
        console.error('[Database Migration Error]:', err.message);
        process.exit(1);
    }
}

runMigration();
