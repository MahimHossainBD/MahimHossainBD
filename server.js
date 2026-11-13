// ============================================================
// MahimHossainBD — Enterprise Full-Stack Unified Server
// Handles: Routing, REST APIs, Firebase Auth + Realtime Database, File Storage
// ============================================================

const express = require('express');
const path = require('path');
const fs = require('fs');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const admin = require('firebase-admin');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
require('dotenv').config();

const app = express();
app.set('trust proxy', 1); // Render proxy-এর পেছনে সঠিক IP ও secure cookie-র জন্য
const PORT = process.env.PORT || 10000;
const JWT_SECRET = process.env.JWT_SECRET || 'MHB_SERVER_FALLBACK_SECRET_KEY_2026';

// ------------------------------------------------------------
// ১. ডাটাবেজ কানেকশন পুল (PostgreSQL)
// ------------------------------------------------------------
let rtdb = null;
(function initFirebase() {
    const { FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY } = process.env;
    if (!FIREBASE_PROJECT_ID || !FIREBASE_CLIENT_EMAIL || !FIREBASE_PRIVATE_KEY) {
        console.error('[Firebase] FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY সেট করা নেই — ডাটা কাজ করবে না।');
        return;
    }
    try {
        admin.initializeApp({
            credential: admin.credential.cert({
                projectId: FIREBASE_PROJECT_ID,
                clientEmail: FIREBASE_CLIENT_EMAIL,
                // Render-এ \n হিসেবে পেস্ট করলেও চলবে, আসল নতুন লাইন হলেও চলবে
                privateKey: FIREBASE_PRIVATE_KEY.replace(/^"|"$/g, '').replace(/\\n/g, '\n')
            }),
            databaseURL: process.env.FIREBASE_DATABASE_URL || `https://${FIREBASE_PROJECT_ID}-default-rtdb.firebaseio.com`
        });
        rtdb = admin.database();
        console.log('[Firebase] Realtime Database connected via service account.');
    } catch (e) {
        console.error('[Firebase Init Error]:', e.message);
    }
})();

function getDb() {
    if (!rtdb) throw new Error('Firebase সেটআপ হয়নি। Environment-এ FIREBASE_* ভেরিয়েবল দিন।');
    return rtdb;
}
const listOf = snap => Object.entries(snap.val() || {}).map(([id, o]) => ({ id, ...o }));
const clean = obj => Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));
const validId = id => /^[-\w]+$/.test(String(id));


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

// ফ্রন্টএন্ড সাইট আলাদা ডোমেইনে থাকলে শুধু পাবলিক ডাটা (GET) পড়ার অনুমতি; অ্যাডমিন/লেখার API এতে খোলে না
const FRONTEND_ORIGINS = (process.env.FRONTEND_URL || 'https://mahimhossainbd.onrender.com')
    .split(',').map(o => o.trim().replace(/\/$/, '')).filter(Boolean);
app.use('/api', (req, res, next) => {
    const origin = req.headers.origin;
    if (origin && FRONTEND_ORIGINS.includes(origin) && (req.method === 'GET' || req.method === 'OPTIONS')) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Vary', 'Origin');
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
        if (req.method === 'OPTIONS') return res.sendStatus(204);
    }
    next();
});

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

// "/admin" — একমাত্র প্রবেশপথ: লগইন থাকলে প্যানেল, না থাকলে Firebase লগইন ফর্ম
app.get('/admin', (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const token = req.cookies.mhb_session;
    try {
        if (token) {
            jwt.verify(token, JWT_SECRET);
            return res.sendFile(path.join(__dirname, 'private', 'admin.html'));
        }
    } catch (e) {
        res.clearCookie('mhb_session');
    }
    res.sendFile(path.join(__dirname, 'private', 'login.html'));
});


// ------------------------------------------------------------
// ৭. ব্যাকএন্ড REST API
// ------------------------------------------------------------

// হেলথ চেক API (Render healthCheckPath: /api/health)
app.get(['/api', '/api/health'], (req, res) => {
    res.json({
        success: true,
        status: 'ONLINE',
        database: rtdb ? 'FIREBASE_CONFIGURED' : 'FIREBASE_NOT_CONFIGURED',
        serverTime: new Date().toISOString()
    });
});

// ==================== AUTH APIs (শুধু Firebase) ====================

// ব্রুট-ফোর্স ঠেকাতে লিমিটার (১৫ মিনিটে ১০ বার)
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { success: false, message: 'Too many attempts. Try again after 15 minutes.' }
});

// অনুমোদিত অ্যাডমিন ইমেইল (ADMIN_EMAIL, কমা দিয়ে একাধিক দেওয়া যায়)
function allowedAdmins() {
    return String(process.env.ADMIN_EMAIL || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
}

app.post('/api/auth/firebase-login', authLimiter, async (req, res) => {
    const { idToken } = req.body;
    if (!idToken) {
        return res.status(400).json({ success: false, message: 'Firebase token required.' });
    }
    try {
        // Google-এর মাধ্যমে টোকেন যাচাই
        const apiKey = process.env.FIREBASE_API_KEY || 'AIzaSyBNWiaiL6IB2BR-dzHKBzL01MPF1urs7RY';
        const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idToken })
        });
        const data = await r.json();
        const fbUser = data.users && data.users[0];
        if (!r.ok || !fbUser || !fbUser.email) {
            return res.status(401).json({ success: false, message: 'Invalid Firebase token.' });
        }

        const allowed = allowedAdmins();
        if (allowed.length === 0) {
            return res.status(500).json({ success: false, message: 'Server-এ ADMIN_EMAIL সেট করা নেই।' });
        }
        if (!allowed.includes(fbUser.email.toLowerCase())) {
            return res.status(403).json({ success: false, message: 'এই ইমেইলে অ্যাডমিন অনুমতি নেই।' });
        }

        const token = jwt.sign({ email: fbUser.email.toLowerCase(), role: 'admin' }, JWT_SECRET, { expiresIn: '7d' });
        res.cookie('mhb_session', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000
        });
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ success: false, message: 'Firebase যাচাই করা যায়নি: ' + e.message });
    }
});

app.post('/api/auth/logout', (req, res) => {
    res.clearCookie('mhb_session');
    res.json({ success: true, message: 'Logged out successfully.' });
});

app.get('/api/auth/me', requireAdmin, (req, res) => {
    res.json({ success: true, admin: req.admin });
});

// ==================== PROFILE APIs ====================
const DEFAULT_PROFILE = {
    name: 'MahimHossainBD',
    tagline: 'Developer and create app',
    about_bn: 'আমি হলো একজন Developer এবং তোমাদের App, ওয়েবসাইট বানানো শিখায়',
    about_en: 'I am a Developer teaching you how to build modern apps and websites.',
    email: 'MahimHossainBD@gmail.com',
    logo_url: 'https://i.postimg.cc/X7kpKwx7/Picsart-26-09-07-22-20-41-182.jpg'
};
const DEFAULT_LINKS = [
    { name: 'YouTube', username_handle: 'Channel link নেই', url: '', icon: 'youtube' },
    { name: 'TikTok', username_handle: '@mahimhossainbd', url: 'https://tiktok.com/@mahimhossainbd', icon: 'tiktok' },
    { name: 'Telegram', username_handle: '@MahimHossainBD', url: 'https://t.me/MahimHossainBD', icon: 'telegram' }
];
const DEFAULT_POLICIES = [
    { slug: 'privacy', title_bn: 'গোপনীয়তা নীতি', title_en: 'Privacy Policy', content_bn: 'আমরা ব্যবহারকারীর তথ্যের সর্বোচ্চ গোপনীয়তা রক্ষা করি।', content_en: 'We strictly protect user data and privacy.' },
    { slug: 'terms', title_bn: 'শর্তাবলী ও নিয়মাবলী', title_en: 'Terms & Conditions', content_bn: 'আমাদের সকল অ্যাপ ও ফাইল ব্যক্তিগত ব্যবহারের জন্য উন্মুক্ত।', content_en: 'All files and apps are for personal legitimate use.' }
];

app.get('/api/profile', async (req, res) => {
    let profile = { ...DEFAULT_PROFILE };
    let links = DEFAULT_LINKS;
    try {
        const [p, l] = await Promise.all([getDb().ref('profile').once('value'), getDb().ref('links').once('value')]);
        if (p.exists()) profile = { ...DEFAULT_PROFILE, ...p.val() };
        if (l.exists()) links = Object.values(l.val());
    } catch (e) {
        console.warn('[Profile]', e.message);
    }
    res.json({ success: true, profile, links });
});

app.put('/api/profile', requireAdmin, async (req, res) => {
    const { name, tagline, about_bn, about_en, email, logo_url, links } = req.body;
    try {
        const fields = clean({ name, tagline, about_bn, about_en, email, logo_url });
        if (Object.keys(fields).length) await getDb().ref('profile').update(fields);
        if (Array.isArray(links)) {
            const list = links.map(l => clean({
                name: l.name, username_handle: l.user || l.username_handle || '', url: l.url, icon: l.icon || 'link'
            }));
            await getDb().ref('links').set(list.length ? list : null);
        }
        res.json({ success: true, message: 'Profile updated successfully.' });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

// ==================== APPS APIs ====================
app.get('/api/apps', async (req, res) => {
    let apps = [];
    try {
        apps = listOf(await getDb().ref('apps').once('value'))
            .filter(a => a.is_visible !== false)
            .sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0) || (b.created_at || 0) - (a.created_at || 0));
    } catch (e) {
        console.warn('[Apps]', e.message);
    }
    res.json({ success: true, data: apps });
});

app.post('/api/apps', requireAdmin, async (req, res) => {
    const b = req.body;
    if (!b.name || !b.description_bn || !b.image_url || !b.file_url) {
        return res.status(400).json({ success: false, message: 'নাম, বিবরণ, থাম্বনেইল ও ফাইল লিংক আবশ্যক।' });
    }
    try {
        await getDb().ref('apps').push(clean({
            name: b.name, category: b.category || 'App', version: b.version || '1.0.0', file_size: b.file_size || '',
            description_bn: b.description_bn, description_en: b.description_en || b.description_bn,
            image_url: b.image_url, file_url: b.file_url, playstore_url: b.playstore_url || '', video_url: b.video_url || '',
            featured: !!b.featured, is_visible: true, created_at: Date.now()
        }));
        res.json({ success: true, message: 'App created successfully.' });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

app.delete('/api/apps/:id', requireAdmin, async (req, res) => {
    if (!validId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid id.' });
    try {
        await getDb().ref(`apps/${req.params.id}`).remove();
        res.json({ success: true, message: 'App removed.' });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

app.patch('/api/apps/:id/pin', requireAdmin, async (req, res) => {
    if (!validId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid id.' });
    try {
        const ref = getDb().ref(`apps/${req.params.id}/featured`);
        const cur = (await ref.once('value')).val();
        await ref.set(!cur);
        res.json({ success: true, message: 'Featured status updated.' });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

// ==================== WEBSITES APIs ====================
app.get('/api/websites', async (req, res) => {
    let websites = [];
    try {
        websites = listOf(await getDb().ref('websites').once('value'))
            .filter(w => w.is_visible !== false)
            .sort((a, b) => (b.created_at || 0) - (a.created_at || 0));
    } catch (e) {
        console.warn('[Websites]', e.message);
    }
    res.json({ success: true, data: websites });
});

app.post('/api/websites', requireAdmin, async (req, res) => {
    const b = req.body;
    if (!b.name || !b.url) {
        return res.status(400).json({ success: false, message: 'নাম ও URL আবশ্যক।' });
    }
    try {
        await getDb().ref('websites').push(clean({
            name: b.name, url: b.url, description_bn: b.description_bn || '', description_en: b.description_en || b.description_bn || '',
            thumbnail_url: b.thumbnail_url || '', is_visible: true, created_at: Date.now()
        }));
        res.json({ success: true, message: 'Website entry saved.' });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

app.delete('/api/websites/:id', requireAdmin, async (req, res) => {
    if (!validId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid id.' });
    try {
        await getDb().ref(`websites/${req.params.id}`).remove();
        res.json({ success: true, message: 'Website removed.' });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

// ==================== SETTINGS & POLICIES APIs ====================
app.get('/api/settings', async (req, res) => {
    let settings = { site_title: 'MahimHossainBD' };
    let policies = DEFAULT_POLICIES;
    try {
        const [st, po] = await Promise.all([getDb().ref('settings').once('value'), getDb().ref('policies').once('value')]);
        if (st.exists()) settings = { ...settings, ...st.val() };
        if (po.exists()) policies = Object.values(po.val());
    } catch (e) {
        console.warn('[Settings]', e.message);
    }
    res.json({ success: true, settings, policies });
});

app.put('/api/settings', requireAdmin, async (req, res) => {
    const { settings, policies } = req.body;
    try {
        if (settings && typeof settings === 'object') await getDb().ref('settings').update(settings);
        if (Array.isArray(policies)) {
            for (const p of policies) {
                if (!p.slug || !validId(p.slug)) continue;
                await getDb().ref(`policies/${p.slug}`).set(clean({
                    slug: p.slug, title_bn: p.title_bn, title_en: p.title_en, content_bn: p.content_bn, content_en: p.content_en
                }));
            }
        }
        res.json({ success: true, message: 'Settings & policies saved.' });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

// সব ফাইল GitHub-এ (ছবি → রিপো, APK/ভিডিও → Releases); GitHub সেট না থাকলে Cloudinary, তারপর লোকাল
async function uploadToCloudinary(file) {
    return await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            { resource_type: 'auto', folder: 'mahimhossainbd' },
            (err, result) => (result ? resolve(result.secure_url) : reject(err || new Error('Cloudinary upload failed')))
        );
        stream.end(file.buffer);
    });
}

function ghFetch(url, opt = {}) {
    return fetch(url, {
        ...opt,
        headers: {
            Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
            'User-Agent': 'mahimhossainbd-server',
            ...(opt.headers || {})
        }
    });
}

// ছবি → রিপোতে কমিট করে raw লিংক (ছবি সঠিকভাবে দেখায়)
async function uploadImageToGithub(file) {
    const [owner, repo] = String(process.env.GITHUB_REPO).split('/');
    const name = `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const r = await ghFetch(`https://api.github.com/repos/${owner}/${repo}/contents/uploads/${encodeURIComponent(name)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: `upload ${name}`, content: file.buffer.toString('base64') })
    });
    if (!r.ok) throw new Error(`GitHub image error ${r.status}: ${(await r.text()).slice(0, 200)}`);
    const data = await r.json();
    return data.content.download_url;
}

// APK/ভিডিও/অন্য ফাইল → Releases অ্যাসেট (সরাসরি ডাউনলোড লিংক)
async function uploadToGithub(file) {
    const [owner, repo] = String(process.env.GITHUB_REPO).split('/');
    const tag = process.env.GITHUB_RELEASE_TAG || 'apps';
    const gh = ghFetch;

    // রিলিজ আছে কি না দেখা, না থাকলে তৈরি করা
    let r = await gh(`https://api.github.com/repos/${owner}/${repo}/releases/tags/${tag}`);
    if (r.status === 404) {
        r = await gh(`https://api.github.com/repos/${owner}/${repo}/releases`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tag_name: tag, name: 'App Store Files', body: 'APK files for the app store', draft: false, prerelease: false })
        });
    }
    if (!r.ok) throw new Error(`GitHub release error ${r.status}: ${(await r.text()).slice(0, 200)}`);
    const release = await r.json();

    const name = `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const up = await gh(`https://uploads.github.com/repos/${owner}/${repo}/releases/${release.id}/assets?name=${encodeURIComponent(name)}`, {
        method: 'POST',
        headers: { 'Content-Type': file.mimetype || 'application/octet-stream' },
        body: file.buffer
    });
    if (!up.ok) throw new Error(`GitHub upload error ${up.status}: ${(await up.text()).slice(0, 200)}`);
    const asset = await up.json();
    return asset.browser_download_url; // সরাসরি ডাউনলোড লিংক
}

app.post('/api/upload', requireAdmin, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No file received.' });
        }
        const isMedia = /^(image|video)\//.test(req.file.mimetype || '');
        const hasGithub = process.env.GITHUB_TOKEN && process.env.GITHUB_REPO;
        const hasCloud = process.env.CLOUDINARY_CLOUD_NAME;

        let url;
        if (hasGithub) {
            const isImage = /^image\//.test(req.file.mimetype || '');
            url = isImage ? await uploadImageToGithub(req.file) : await uploadToGithub(req.file);
        } else if (hasCloud) {
            url = await uploadToCloudinary(req.file);
        } else {
            // কোনো ক্লাউড সেট না থাকলে লোকাল (Render ফ্রি-তে রিস্টারে মুছে যায়)
            const fname = `${Date.now()}-${req.file.originalname.replace(/[^a-zA-Z0-9.]/g, '_')}`;
            fs.writeFileSync(path.join(localUploadsDir, fname), req.file.buffer);
            url = `/uploads/${fname}`;
        }
        res.json({ success: true, url });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

// ------------------------------------------------------------
app.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(`[MahimHossainBD Production Server Live]`);
    console.log(`Port: ${PORT}`);
    console.log(`Mode: ${process.env.NODE_ENV || 'production'}`);
    console.log(`Live URL: http://localhost:${PORT}`);
    console.log(`====================================================`);
});
