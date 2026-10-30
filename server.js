// ============================================================
// MahimHossainBD — Enterprise Full-Stack Unified Server
// Handles: Routing, REST APIs, Firebase Auth, DB & File Storage
// ============================================================

const express = require('express');
const path = require('path');
const fs = require('fs');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 10000;
const JWT_SECRET = process.env.JWT_SECRET || 'MHB_SERVER_FALLBACK_SECRET_KEY_2026';

// ------------------------------------------------------------
// ১. ডাটাবেজ কানেকশন পুল (PostgreSQL)
// ------------------------------------------------------------
const db = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

db.on('connect', () => {
    console.log('[PostgreSQL] Database pool active and connected.');
});

db.on('error', (err) => {
    console.warn('[PostgreSQL Warning] Database connection error:', err.message);
});

// ------------------------------------------------------------
// ২. ক্লাউডিনারি ফাইল স্টোরেজ কনফিগারেশন (ফ্রি ক্লাউড)
// ------------------------------------------------------------
if (process.env.CLOUDINARY_CLOUD_NAME) {
    cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET
    });
    console.log('[Storage] Cloudinary persistent storage configured.');
} else {
    console.log('[Storage] Cloudinary not set. Using local /uploads directory.');
}

// Multer Storage (মেমোরি বাফার - সর্বোচ্চ 100MB পর্যন্ত APK ও ছবি)
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 100 * 1024 * 1024 }
});

// ------------------------------------------------------------
// ৩. সিকিউরিটি ও মিডলওয়্যার
// ------------------------------------------------------------
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cookieParser());

// রেট লিমিটার (অতিরিক্ত আক্রমণ ও স্প্যাম রোধে)
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 450,
    message: { success: false, message: 'Too many requests. Please try again later.' }
});
app.use('/api/', apiLimiter);

// স্ট্যাটিক ফ্রন্টএন্ড এবং লোকাল আপলোডস ফোল্ডার
app.use(express.static(path.join(__dirname, 'public')));
const localUploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(localUploadsDir)) {
    fs.mkdirSync(localUploadsDir, { recursive: true });
}
app.use('/uploads', express.static(localUploadsDir));

// ------------------------------------------------------------
// ৪. হেল্পার ফাংশন ও অথেনটিকেশন গার্ড
// ------------------------------------------------------------
async function sendEmailOtp(toEmail, otpCode) {
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
        console.warn(`[OTP Simulation] Simulated code for ${toEmail}: ${otpCode}`);
        return { success: true, simulated: true };
    }
    const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true',
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    });
    return await transporter.sendMail({
        from: `"MahimHossainBD Security" <${process.env.SMTP_USER}>`,
        to: toEmail,
        subject: `Security OTP: ${otpCode}`,
        html: `
            <div style="font-family:Arial,sans-serif; background:#05070b; color:#fff; padding:20px; border-radius:10px; border:1px solid #1677ff;">
                <h2 style="color:#1677ff;">MahimHossainBD Admin Verification</h2>
                <p>Your one-time login OTP is:</p>
                <h1 style="color:#22c55e; letter-spacing:5px;">${otpCode}</h1>
                <p style="color:#8d9aaa; font-size:12px;">This code will expire in 10 minutes.</p>
            </div>
        `
    });
}

// অ্যাডমিন অথেনটিকেশন চেক মিডলওয়্যার
function requireAdmin(req, res, next) {
    const token = req.cookies.mhb_session || (req.headers.authorization && req.headers.authorization.split(' ')[1]);
    if (!token) {
        return res.status(401).json({ success: false, message: 'Unauthorized. Please login.' });
    }
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.admin = decoded;
        next();
    } catch (e) {
        return res.status(401).json({ success: false, message: 'Session expired or invalid.' });
    }
}

// ------------------------------------------------------------
// ৫. সিঙ্গেল ডোমেইন পেজ রাউটিং (URL Structure)
// ------------------------------------------------------------

// ১. "/" — মূল ওয়েবসাইট পেজ
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ২. "/login" — অ্যাডমিন লগইন পেজ
app.get('/login', (req, res) => {
    const token = req.cookies.mhb_session;
    if (token) {
        try {
            jwt.verify(token, JWT_SECRET);
            return res.redirect('/admin'); // অলরেডি লগইন থাকলে অ্যাডমিনে নিয়ে যাবে
        } catch (e) {}
    }
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// ৩. "/admin" — সুরক্ষিত অ্যাডমিন প্যানেল
app.get('/admin', (req, res) => {
    const token = req.cookies.mhb_session;
    if (!token) {
        return res.redirect('/login');
    }
    try {
        jwt.verify(token, JWT_SECRET);
        res.sendFile(path.join(__dirname, 'public', 'admin.html'));
    } catch (e) {
        res.redirect('/login');
    }
});

// ------------------------------------------------------------
// ৬. এমার্জেন্সি / অটো অ্যাডমিন সেটআপ রুট
// ------------------------------------------------------------
app.get('/setup-admin', async (req, res) => {
    try {
        await db.query(`
            CREATE TABLE IF NOT EXISTS admins (
                id SERIAL PRIMARY KEY,
                username VARCHAR(100) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                email VARCHAR(255) UNIQUE NOT NULL
            );
        `);

        const hash = await bcrypt.hash('Mahim@123', 10);
        await db.query(`
            INSERT INTO admins (username, password_hash, email) 
            VALUES ('MrMahimFire', $1, 'MahimHossainBD@gmail.com')
            ON CONFLICT (username) DO UPDATE SET password_hash = $1;
        `, [hash]);

        res.send(`
            <div style="font-family:sans-serif; text-align:center; padding-top:60px;">
                <h1 style="color:#22c55e;">✅ অ্যাডমিন সফলভাবে ডাটাবেজে তৈরি ও কনফার্ম হয়েছে!</h1>
                <p style="font-size:18px; color:#555;">ইউজারনেম: <b>MrMahimFire</b> | পাসওয়ার্ড: <b>Mahim@123</b></p>
                <br>
                <a href="/login" style="background:#1677ff; color:#fff; padding:12px 25px; border-radius:8px; text-decoration:none; font-weight:bold; font-size:16px;">এখন লগইন করুন →</a>
            </div>
        `);
    } catch (err) {
        res.send(`<h1 style="color:red; text-align:center; padding-top:60px;">❌ ডাটাবেজ এরর: ${err.message}</h1>`);
    }
});

// ------------------------------------------------------------
// ৭. ব্যাকএন্ড REST API
// ------------------------------------------------------------

// হেলথ চেক API
app.get('/api', async (req, res) => {
    let dbStatus = 'DISCONNECTED';
    try {
        await db.query('SELECT 1');
        dbStatus = 'CONNECTED';
    } catch (e) {}
    res.json({
        success: true,
        status: 'ONLINE',
        database: dbStatus,
        serverTime: new Date().toISOString()
    });
});

// ==================== AUTH APIs ====================

// ক) ফায়ারবেজ ফ্রি লগইন সেশন API
app.post('/api/auth/firebase-login', (req, res) => {
    const { email } = req.body;
    if (!email) {
        return res.status(400).json({ success: false, message: 'Email required' });
    }

    // ৭ দিনের সিকিউর অ্যাডমিন কুকি ইস্যু করা
    const token = jwt.sign({ email, role: 'admin' }, JWT_SECRET, { expiresIn: '7d' });
    res.cookie('mhb_session', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.json({ success: true, message: 'Firebase Admin Session Created Successfully' });
});

// খ) স্ট্যান্ডার্ড ইউজারনেম ও পাসওয়ার্ড লগইন API (OTP সাপোর্টসহ)
app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const userRes = await db.query('SELECT * FROM admins WHERE username = $1', [username]);
        if (userRes.rows.length === 0) {
            return res.status(401).json({ success: false, message: 'ভুল ইউজারনেম বা পাসওয়ার্ড!' });
        }
        const admin = userRes.rows[0];
        const match = await bcrypt.compare(password, admin.password_hash);
        if (!match) {
            return res.status(401).json({ success: false, message: 'ভুল ইউজারনেম বা পাসওয়ার্ড!' });
        }

        // OTP সেটিংস যাচাই
        let isOtpOn = false;
        try {
            const otpSetting = await db.query('SELECT value FROM settings WHERE key = $1', ['otp_enabled']);
            isOtpOn = otpSetting.rows.length > 0 && otpSetting.rows[0].value === 'true';
        } catch (e) {}

        if (isOtpOn) {
            const code = Math.floor(100000 + Math.random() * 900000).toString();
            const codeHash = await bcrypt.hash(code, 8);
            const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

            await db.query('DELETE FROM otp_codes WHERE email = $1', [admin.email]);
            await db.query('INSERT INTO otp_codes (email, code_hash, expires_at) VALUES ($1, $2, $3)', [admin.email, codeHash, expiresAt]);
            await sendEmailOtp(admin.email, code);

            return res.json({
                success: true,
                requireOtp: true,
                email: admin.email,
                message: 'Security OTP dispatched to registered admin email.'
            });
        }

        // সরাসরি টোকেন ইস্যু
        const token = jwt.sign({ id: admin.id, username: admin.username, role: 'admin' }, JWT_SECRET, { expiresIn: '7d' });
        res.cookie('mhb_session', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000
        });

        res.json({ success: true, requireOtp: false, token });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

// গ) OTP ভেরিফাই
app.post('/api/auth/verify-otp', async (req, res) => {
    const { email, otp } = req.body;
    try {
        const record = await db.query(
            'SELECT * FROM otp_codes WHERE email = $1 AND is_used = FALSE AND expires_at > CURRENT_TIMESTAMP ORDER BY id DESC LIMIT 1',
            [email]
        );
        if (record.rows.length === 0) {
            return res.status(400).json({ success: false, message: 'Invalid or expired OTP.' });
        }
        const isValid = await bcrypt.compare(otp, record.rows[0].code_hash);
        if (!isValid) {
            return res.status(400).json({ success: false, message: 'ভুল OTP কোড!' });
        }

        await db.query('UPDATE otp_codes SET is_used = TRUE WHERE id = $1', [record.rows[0].id]);
        const admin = (await db.query('SELECT id, username FROM admins WHERE email = $1', [email])).rows[0];

        const token = jwt.sign({ id: admin.id, username: admin.username, role: 'admin' }, JWT_SECRET, { expiresIn: '7d' });
        res.cookie('mhb_session', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000
        });

        res.json({ success: true, token });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

// ঘ) লগআউট
app.post('/api/auth/logout', (req, res) => {
    res.clearCookie('mhb_session');
    res.json({ success: true, message: 'Logged out successfully.' });
});

// ঙ) সেশন ভ্যালিডেশন
app.get('/api/auth/me', requireAdmin, (req, res) => {
    res.json({ success: true, admin: req.admin });
});

// ==================== PROFILE APIs ====================
app.get('/api/profile', async (req, res) => {
    try {
        let profile = {
            name: 'MahimHossainBD',
            tagline: 'Developer and create app',
            about_bn: 'আমি হলো একজন Developer এবং তোমাদের App, ওয়েবসাইট বানানো শিখায়',
            about_en: 'I am a Developer teaching you how to build modern apps and websites.',
            email: 'MahimHossainBD@gmail.com',
            logo_url: 'https://i.postimg.cc/X7kpKwx7/Picsart-26-09-07-22-20-41-182.jpg'
        };
        let links = [
            { name: 'YouTube', username_handle: 'Channel link নেই', url: '', icon: 'youtube' },
            { name: 'TikTok', username_handle: '@mahimhossainbd', url: 'https://tiktok.com/@mahimhossainbd', icon: 'tiktok' },
            { name: 'Telegram', username_handle: '@MahimHossainBD', url: 'https://t.me/MahimHossainBD', icon: 'telegram' }
        ];

        try {
            const pRes = await db.query('SELECT * FROM profiles WHERE id = 1');
            if (pRes.rows.length > 0) profile = pRes.rows[0];
            const lRes = await db.query('SELECT * FROM social_links WHERE is_active = TRUE ORDER BY sort_order ASC, id ASC');
            if (lRes.rows.length > 0) links = lRes.rows;
        } catch (dbErr) {}

        res.json({ success: true, profile, links });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

app.put('/api/profile', requireAdmin, async (req, res) => {
    const { name, tagline, about_bn, about_en, email, logo_url, links } = req.body;
    try {
        await db.query(
            `UPDATE profiles SET 
                name = COALESCE($1, name), tagline = COALESCE($2, tagline), 
                about_bn = COALESCE($3, about_bn), about_en = COALESCE($4, about_en), 
                email = COALESCE($5, email), logo_url = COALESCE($6, logo_url), 
                updated_at = CURRENT_TIMESTAMP WHERE id = 1`,
            [name, tagline, about_bn, about_en, email, logo_url]
        );

        if (links && Array.isArray(links)) {
            await db.query('DELETE FROM social_links');
            for (let i = 0; i < links.length; i++) {
                const l = links[i];
                await db.query(
                    'INSERT INTO social_links (name, username_handle, url, icon, sort_order) VALUES ($1, $2, $3, $4, $5)',
                    [l.name, l.user || l.username_handle, l.url, l.icon || 'link', i + 1]
                );
            }
        }
        res.json({ success: true, message: 'Profile updated successfully.' });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

// ==================== APPS APIs ====================
app.get('/api/apps', async (req, res) => {
    try {
        let apps = [];
        try {
            const result = await db.query('SELECT * FROM applications WHERE is_visible = TRUE ORDER BY featured DESC, sort_order ASC, id DESC');
            apps = result.rows;
        } catch (dbErr) {}
        res.json({ success: true, data: apps });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

app.post('/api/apps', requireAdmin, async (req, res) => {
    const { name, category, version, file_size, description_bn, description_en, image_url, file_url, playstore_url, video_url, featured } = req.body;
    try {
        await db.query(
            `INSERT INTO applications (name, category, version, file_size, description_bn, description_en, image_url, file_url, playstore_url, video_url, featured)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
            [name, category, version, file_size, description_bn, description_en || description_bn, image_url, file_url, playstore_url, video_url, featured || false]
        );
        res.json({ success: true, message: 'App created successfully.' });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

app.delete('/api/apps/:id', requireAdmin, async (req, res) => {
    try {
        await db.query('DELETE FROM applications WHERE id = $1', [req.params.id]);
        res.json({ success: true, message: 'App removed.' });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

app.patch('/api/apps/:id/pin', requireAdmin, async (req, res) => {
    try {
        await db.query('UPDATE applications SET featured = NOT featured WHERE id = $1', [req.params.id]);
        res.json({ success: true, message: 'Featured status updated.' });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

// ==================== WEBSITES APIs ====================
app.get('/api/websites', async (req, res) => {
    try {
        let websites = [];
        try {
            const result = await db.query('SELECT * FROM websites WHERE is_visible = TRUE ORDER BY sort_order ASC, id DESC');
            websites = result.rows;
        } catch (dbErr) {}
        res.json({ success: true, data: websites });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

app.post('/api/websites', requireAdmin, async (req, res) => {
    const { name, url, description_bn, description_en, thumbnail_url } = req.body;
    try {
        await db.query(
            'INSERT INTO websites (name, url, description_bn, description_en, thumbnail_url) VALUES ($1, $2, $3, $4, $5)',
            [name, url, description_bn, description_en || description_bn, thumbnail_url]
        );
        res.json({ success: true, message: 'Website entry saved.' });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

app.delete('/api/websites/:id', requireAdmin, async (req, res) => {
    try {
        await db.query('DELETE FROM websites WHERE id = $1', [req.params.id]);
        res.json({ success: true, message: 'Website removed.' });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

// ==================== SETTINGS & POLICIES APIs ====================
app.get('/api/settings', async (req, res) => {
    try {
        let settingsMap = { site_title: 'MahimHossainBD', otp_enabled: 'false' };
        let policies = [];
        try {
            const rows = (await db.query('SELECT key, value FROM settings')).rows;
            rows.forEach(r => { settingsMap[r.key] = r.value; });
            policies = (await db.query('SELECT * FROM policies')).rows;
        } catch (dbErr) {}
        res.json({ success: true, settings: settingsMap, policies });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

app.put('/api/settings', requireAdmin, async (req, res) => {
    const { settings, policies } = req.body;
    try {
        if (settings) {
            for (const [key, val] of Object.entries(settings)) {
                await db.query('INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2', [key, String(val)]);
            }
        }
        if (policies && Array.isArray(policies)) {
            for (const p of policies) {
                await db.query(
                    `INSERT INTO policies (slug, title_bn, title_en, content_bn, content_en) 
                     VALUES ($1, $2, $3, $4, $5) 
                     ON CONFLICT (slug) DO UPDATE SET title_bn = $2, title_en = $3, content_bn = $4, content_en = $5`,
                    [p.slug, p.title_bn, p.title_en, p.content_bn, p.content_en]
                );
            }
        }
        res.json({ success: true, message: 'Settings & policies saved permanently.' });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

// ==================== DUAL FILE & APK UPLOAD API ====================
app.post('/api/upload', requireAdmin, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No file received.' });
        }

        // ক্লাউডিনারি ক্রেডেনশিয়াল থাকলে ক্লাউডে আপলোড হবে (১০০% ফ্রি)
        if (process.env.CLOUDINARY_CLOUD_NAME) {
            const streamUpload = (buffer) => {
                return new Promise((resolve, reject) => {
                    const stream = cloudinary.uploader.upload_stream(
                        { resource_type: 'auto', folder: 'mahimhossainbd' },
                        (err, result) => {
                            if (result) resolve(result);
                            else reject(err);
                        }
                    );
                    stream.end(buffer);
                });
            };
            const result = await streamUpload(req.file.buffer);
            return res.json({ success: true, url: result.secure_url });
        } else {
            // ক্লাউডিনারি না থাকলে লোকাল সার্ভারে সেভ হবে
            const fname = `${Date.now()}-${req.file.originalname.replace(/[^a-zA-Z0-9.]/g, '_')}`;
            fs.writeFileSync(path.join(localUploadsDir, fname), req.file.buffer);
            return res.json({ success: true, url: `/uploads/${fname}` });
        }
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

// ------------------------------------------------------------
// ৮. সার্ভার স্টার্ট
// ------------------------------------------------------------
app.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(`[MahimHossainBD Production Server Live]`);
    console.log(`Port: ${PORT}`);
    console.log(`Mode: ${process.env.NODE_ENV || 'production'}`);
    console.log(`Live URL: http://localhost:${PORT}`);
    console.log(`====================================================`);
});
