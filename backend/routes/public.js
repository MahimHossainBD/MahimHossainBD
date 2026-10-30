const express = require('express');
const router = express.Router();
const db = require('../config/db');
const firebase = require('../config/firebase');

// Health Check Probe Endpoint
router.get('/health', async (req, res) => {
    let dbStatus = false;
    try {
        await db.query('SELECT 1');
        dbStatus = true;
    } catch (e) {
        dbStatus = false;
    }

    res.json({
        success: true,
        status: 'ONLINE',
        timestamp: new Date().toISOString(),
        database: dbStatus ? 'CONNECTED' : 'DISCONNECTED',
        firebase: firebase.isInitialized() ? 'CONNECTED' : 'STANDBY',
        storage: process.env.CLOUDINARY_CLOUD_NAME ? 'CONNECTED' : 'LOCAL'
    });
});

// Get Profile Data
router.get('/profile', async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM profiles WHERE id = 1');
        res.json({ success: true, data: result.rows[0] });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

// Get Active Social Links
router.get('/links', async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM social_links WHERE is_active = TRUE ORDER BY sort_order ASC, id ASC');
        res.json({ success: true, data: result.rows });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

// Get Apps with Search & Category
router.get('/apps', async (req, res) => {
    try {
        const { search, category } = req.query;
        let query = 'SELECT * FROM applications WHERE is_visible = TRUE';
        const params = [];

        if (category && category !== 'All') {
            params.push(category);
            query += ` AND category = $${params.length}`;
        }
        if (search) {
            params.push(`%${search}%`);
            query += ` AND (name ILIKE $${params.length} OR description_bn ILIKE $${params.length} OR description_en ILIKE $${params.length})`;
        }

        query += ' ORDER BY featured DESC, sort_order ASC, id DESC';
        const apps = await db.query(query, params);

        // Fetch attached screenshots
        const appIds = apps.rows.map(a => a.id);
        let screenshotsMap = {};
        if (appIds.length > 0) {
            const scRes = await db.query('SELECT * FROM application_screenshots WHERE application_id = ANY($1) ORDER BY sort_order ASC', [appIds]);
            scRes.rows.forEach(sc => {
                if (!screenshotsMap[sc.application_id]) screenshotsMap[sc.application_id] = [];
                screenshotsMap[sc.application_id].push(sc.screenshot_url);
            });
        }

        const enrichedApps = apps.rows.map(a => ({
            ...a,
            screenshots: screenshotsMap[a.id] || []
        }));

        res.json({ success: true, data: enrichedApps });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

// Get Websites Store
router.get('/websites', async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM websites WHERE is_visible = TRUE ORDER BY sort_order ASC, id DESC');
        res.json({ success: true, data: result.rows });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

// Get Policies
router.get('/policies/:slug', async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM policies WHERE slug = $1', [req.params.slug]);
        if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Policy not found.' });
        res.json({ success: true, data: result.rows[0] });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

module.exports = router;
