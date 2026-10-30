const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const firebase = require('../config/firebase');
const { sendOtpEmail } = require('../utils/mailer');
require('dotenv').config();

// Admin Login Route
router.post('/login', async (req, res) => {
    const { username, password, firebaseToken } = req.body;

    try {
        let adminUser = null;

        // Firebase Token Exchange
        if (firebaseToken) {
            const decodedFirebase = await firebase.verifyIdToken(firebaseToken);
            const userCheck = await db.query('SELECT * FROM admins WHERE email = $1', [decodedFirebase.email]);
            if (userCheck.rows.length === 0) {
                return res.status(401).json({ success: false, message: 'Firebase identity verified, but unauthorized in admin registry.' });
            }
            adminUser = userCheck.rows[0];
        } else {
            // Direct Username & Password Authentication
            if (!username || !password) {
                return res.status(400).json({ success: false, message: 'Credentials missing.' });
            }
            const userCheck = await db.query('SELECT * FROM admins WHERE username = $1', [username]);
            if (userCheck.rows.length === 0) {
                return res.status(401).json({ success: false, message: 'Invalid administrative username or password.' });
            }
            adminUser = userCheck.rows[0];
            const isMatch = await bcrypt.compare(password, adminUser.password_hash);
            if (!isMatch) {
                return res.status(401).json({ success: false, message: 'Invalid administrative username or password.' });
            }
        }

        // Check if OTP requirement is active
        const otpSetting = await db.query('SELECT setting_value FROM website_settings WHERE setting_key = $1', ['otp_enabled']);
        const isOtpEnabled = otpSetting.rows.length > 0 && otpSetting.rows[0].setting_value === 'true';

        if (isOtpEnabled) {
            const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
            const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
            await db.query('INSERT INTO otp_verifications (email, otp_code, expires_at) VALUES ($1, $2, $3)', [adminUser.email, otpCode, expiresAt]);
            await sendOtpEmail(adminUser.email, otpCode);

            return res.json({
                success: true,
                requireOtp: true,
                email: adminUser.email,
                message: 'Security OTP dispatched to administrator email.'
            });
        }

        // Issue JWT Session Token
        const token = jwt.sign(
            { id: adminUser.id, username: adminUser.username, role: adminUser.role },
            process.env.JWT_SECRET || 'FALLBACK_UNSAFE_DEV_SECRET_KEY',
            { expiresIn: '7d' }
        );

        res.json({
            success: true,
            requireOtp: false,
            token,
            admin: { id: adminUser.id, username: adminUser.username, email: adminUser.email }
        });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

// Verify OTP
router.post('/verify-otp', async (req, res) => {
    const { email, otp } = req.body;
    try {
        const check = await db.query(
            'SELECT * FROM otp_verifications WHERE email = $1 AND otp_code = $2 AND is_consumed = FALSE AND expires_at > CURRENT_TIMESTAMP ORDER BY id DESC LIMIT 1',
            [email, otp]
        );

        if (check.rows.length === 0) {
            return res.status(400).json({ success: false, message: 'Invalid or expired OTP code.' });
        }

        await db.query('UPDATE otp_verifications SET is_consumed = TRUE WHERE id = $1', [check.rows[0].id]);
        const adminUser = (await db.query('SELECT * FROM admins WHERE email = $1', [email])).rows[0];

        const token = jwt.sign(
            { id: adminUser.id, username: adminUser.username, role: adminUser.role },
            process.env.JWT_SECRET || 'FALLBACK_UNSAFE_DEV_SECRET_KEY',
            { expiresIn: '7d' }
        );

        res.json({
            success: true,
            token,
            admin: { id: adminUser.id, username: adminUser.username, email: adminUser.email }
        });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

module.exports = router;
