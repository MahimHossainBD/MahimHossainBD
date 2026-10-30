const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const db = require('../backend/config/db');

async function runMigration() {
    console.log('[Migration] Beginning database schema provisioning...');
    try {
        const sql = fs.readFileSync(path.join(__dirname, 'init.sql'), 'utf8');
        await db.query(sql);
        console.log('[Migration] Database tables and indexes verified.');

        // Seed Default Super Admin Account if not present
        const adminCheck = await db.query('SELECT * FROM admins WHERE username = $1', ['MrMahimFire']);
        if (adminCheck.rows.length === 0) {
            const defaultHash = await bcrypt.hash('Mahim@123', 10);
            await db.query(
                'INSERT INTO admins (username, password_hash, email) VALUES ($1, $2, $3)',
                ['MrMahimFire', defaultHash, 'MahimHossainBD@gmail.com']
            );
            console.log('[Migration] Default administrative credentials created.');
        } else {
            console.log('[Migration] Administrative record already provisioned.');
        }

        process.exit(0);
    } catch (err) {
        console.error('[Migration Error]:', err.message);
        process.exit(1);
    }
}

runMigration();
