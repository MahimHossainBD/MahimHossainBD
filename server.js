// server.js
const express = require('express');
const path = require('path');
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
const JWT_SECRET = process.env.JWT_SECRET || 'MHB_SERVER_FALLBACK_SECRET_2026';

// PostgreSQL Pool
const db = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Cloudinary Setup (যদি ক্লাউড ক্রেডেনশিয়াল থাকে)
if (process.env.CLOUDINARY_CLOUD_NAME) {
    cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET
    });
}

// Multer Storage (ইন-মেমোরি বাফার)
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 100 * 1024 * 1024 } // 100MB পর্যন্ত
});

// Security & Parsing
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cookieParser());

// Rate Limiter
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 400,
    message: { success: false, message: 'Too many requests. Please try again later.' }
});
app.use('/api/', apiLimiter);

// স্ট্যাটিক ফ্রন্টএন্ড ফাইল ও আপলোডস
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ==================== হেল্পার ফাংশনস ====================
async function sendEmailOtp(toEmail, otpCode) {
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
        console.warn(`[OTP Mailer] Simulated Code for ${toEmail}: ${otpCode}`);
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
                <h2 style="color:#1677ff;">MahimHossainBD Admin Login</h2>
                <p>Your one-time login OTP is:</p>
                <h1 style="color:#22c55e; letter-spacing:5px;">${otpCode}</h1>
                <p style="color:#8d9aaa; font-size:12px;">This code will expire in 10 minutes.</p>
            </div>
        `
    });
}

// অ্যাডমিন অথেনটিকেশন মিডলওয়্যার (Cookie অথবা Bearer Token)
async function requireAdmin(req, res, next) {
    const token = req.cookies.mhb_session || (req.headers.authorization && req.headers.authorization.split(' ')[1]);
    if (!token) {
        return res.status(401).json({ success: false, message: 'Unauthorized. Please login.' });
    }
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const check = await db.query('SELECT id, username, email FROM admins WHERE id = $1', [decoded.id]);
        if (check.rows.length === 0) return res.status(403).json({ success: false, message: 'Invalid session.' });
        req.admin = check.rows[0];
        next();
    } catch (e) {
        return res.status(401).json({ success: false, message: 'Session expired or invalid.' });
    }
}

// ==================== URL STRUCTURE & PAGE ROUTING ====================
// ১. "/" — Main Website
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ২. "/login" — Admin Login
app.get('/login', (req, res) => {
    const token = req.cookies.mhb_session;
    if (token) {
        try {
            jwt.verify(token, JWT_SECRET);
            return res.redirect('/admin');
        } catch (e) {}
    }
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// ৩. "/admin" — Admin Panel
app.get('/admin', (req, res) => {
    const token = req.cookies.mhb_session;
    if (!token) return res.redirect('/login');
    try {
        jwt.verify(token, JWT_SECRET);
        res.sendFile(path.join(__dirname, 'public', 'admin.html'));
    } catch (e) {
        res.redirect('/login');
    }
});

// ==================== BACKEND REST APIs ====================
// API Root / Health
app.get('/api', async (req, res) => {
    let dbStatus = 'DISCONNECTED';
    try {
        await db.query('SELECT 1');
        dbStatus = 'CONNECTED';
    } catch (e) {}
    res.json({
        success: true,
        message: 'MahimHossainBD Server API Online',
        database: dbStatus,
        domain: req.headers.host
    });
});

// ==================== 1. /api/auth ====================
// লগইন ইনিশিয়েট
app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const userRes = await db.query('SELECT * FROM admins WHERE username = $1', [username]);
        if (userRes.rows.length === 0) {
            return res.status(401).json({ success: false, message: 'Invalid username or password.' });
        }
        const admin = userRes.rows[0];
        const match = await bcrypt.compare(password, admin.password_hash);
        if (!match) {
            return res.status(401).json({ success: false, message: 'Invalid username or password.' });
        }

        // OTP সেটিংস চেক
        const otpSetting = await db.query('SELECT value FROM settings WHERE key = $1', ['otp_enabled']);
        const isOtpOn = otpSetting.rows.length > 0 && otpSetting.rows[0].value === 'true';

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

        // সরাসরি টোকেন ইস্যু (OTP OFF থাকলে)
        const token = jwt.sign({ id: admin.id, username: admin.username }, JWT_SECRET, { expiresIn: '7d' });
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

// OTP ভেরিফাই
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
            return res.status(400).json({ success: false, message: 'Incorrect OTP code.' });
        }

        await db.query('UPDATE otp_codes SET is_used = TRUE WHERE id = $1', [record.rows[0].id]);
        const admin = (await db.query('SELECT id, username FROM admins WHERE email = $1', [email])).rows[0];

        const token = jwt.sign({ id: admin.id, username: admin.username }, JWT_SECRET, { expiresIn: '7d' });
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

// লগআউট
app.post('/api/auth/logout', (req, res) => {
    res.clearCookie('mhb_session');
    res.json({ success: true, message: 'Logged out successfully.' });
});

// সেশন চেক
app.get('/api/auth/me', requireAdmin, (req, res) => {
    res.json({ success: true, admin: req.admin });
});

// ==================== 2. /api/profile ====================
app.get('/api/profile', async (req, res) => {
    try {
        const profile = (await db.query('SELECT * FROM profiles WHERE id = 1')).rows[0];
        const links = (await db.query('SELECT * FROM social_links WHERE is_active = TRUE ORDER BY sort_order ASC')).rows;
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

// ==================== 3. /api/apps ====================
app.get('/api/apps', async (req, res) => {
    try {
        const apps = (await db.query('SELECT * FROM applications WHERE is_visible = TRUE ORDER BY featured DESC, sort_order ASC, id DESC')).rows;
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

// ==================== 4. /api/websites ====================
app.get('/api/websites', async (req, res) => {
    try {
        const websites = (await db.query('SELECT * FROM websites WHERE is_visible = TRUE ORDER BY sort_order ASC, id DESC')).rows;
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

// ==================== 5. /api/settings ====================
app.get('/api/settings', async (req, res) => {
    try {
        const rows = (await db.query('SELECT key, value FROM settings')).rows;
        const settingsMap = {};
        rows.forEach(r => { settingsMap[r.key] = r.value; });
        const policies = (await db.query('SELECT * FROM policies')).rows;
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

// ==================== FILE & IMAGE UPLOAD API ====================
app.post('/api/upload', requireAdmin, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ success: false, message: 'No file received.' });

        if (process.env.CLOUDINARY_CLOUD_NAME) {
            const streamUpload = (buffer) => {
                return new Promise((resolve, reject) => {
                    const stream = cloudinary.uploader.upload_stream({ resource_type: 'auto', folder: 'mahimhossainbd' }, (err, result) => {
                        if (result) resolve(result);
                        else reject(err);
                    });
                    stream.end(buffer);
                });
            };
            const result = await streamUpload(req.file.buffer);
            return res.json({ success: true, url: result.secure_url });
        } else {
            // লোকাল ডিরেক্টরি ব্যাকআপ
            const fs = require('fs');
            const uploadDir = path.join(__dirname, 'uploads');
            if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
            const fname = `${Date.now()}-${req.file.originalname.replace(/[^a-zA-Z0-9.]/g, '_')}`;
            fs.writeFileSync(path.join(uploadDir, fname), req.file.buffer);
            return res.json({ success: true, url: `/uploads/${fname}` });
        }
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

// সার্ভার স্টার্ট
app.listen(PORT, () => {
    console.log(`[MahimHossainBD Production] Unified Server running on port ${PORT}`);
});
