const express = require('express');
const router = express.Router();
const db = require('../config/db');
const authGuard = require('../middleware/auth');
const { upload, uploadToCloudinary } = require('../config/storage');

router.use(authGuard);

// 1. Dashboard Aggregate Metrics
router.get('/dashboard', async (req, res) => {
    try {
        const appsCount = (await db.query('SELECT COUNT(*) FROM applications')).rows[0].count;
        const websCount = (await db.query('SELECT COUNT(*) FROM websites')).rows[0].count;
        const linksCount = (await db.query('SELECT COUNT(*) FROM social_links')).rows[0].count;
        const uploadsCount = (await db.query('SELECT COUNT(*) FROM uploads')).rows[0].count;

        res.json({
            success: true,
            data: {
                totalApps: parseInt(appsCount),
                totalWebsites: parseInt(websCount),
                totalLinks: parseInt(linksCount),
                totalUploads: parseInt(uploadsCount)
            }
        });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

// 2. Profile Update
router.put('/profile', async (req, res) => {
    const { name, tagline, about_bn, about_en, email, logo_url } = req.body;
    try {
        await db.query(
            `UPDATE profiles SET 
                name = COALESCE($1, name), 
                tagline = COALESCE($2, tagline), 
                about_bn = COALESCE($3, about_bn), 
                about_en = COALESCE($4, about_en), 
                email = COALESCE($5, email), 
                logo_url = COALESCE($6, logo_url),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = 1`,
            [name, tagline, about_bn, about_en, email, logo_url]
        );
        res.json({ success: true, message: 'Profile synchronized successfully.' });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

// 3. Social Links Bulk Sync
router.post('/links/sync', async (req, res) => {
    const { links } = req.body; // Array of link objects
    try {
        await db.query('DELETE FROM social_links');
        for (let i = 0; i < links.length; i++) {
            const l = links[i];
            await db.query(
                'INSERT INTO social_links (name, username_handle, url, icon, sort_order) VALUES ($1, $2, $3, $4, $5)',
                [l.name, l.user || l.username_handle, l.url, l.icon || 'link', i + 1]
            );
        }
        res.json({ success: true, message: 'Social links updated.' });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

// 4. File / Asset Upload Engine (Handles APK, ZIP, Images)
router.post('/upload', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ success: false, message: 'No file provided.' });

        const result = await uploadToCloudinary(req.file.buffer, req.file.originalname);
        await db.query(
            'INSERT INTO uploads (filename, file_url, public_id, mimetype, size_bytes) VALUES ($1, $2, $3, $4, $5)',
            [req.file.originalname, result.url, result.public_id, req.file.mimetype, req.file.size]
        );

        res.json({ success: true, fileUrl: result.url });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

// 5. Create App
router.post('/apps', async (req, res) => {
    const { name, category, version, file_size, description_bn, description_en, image_url, file_url, playstore_url, video_url, featured, screenshots } = req.body;
    try {
        const appRes = await db.query(
            `INSERT INTO applications (name, category, version, file_size, description_bn, description_en, image_url, file_url, playstore_url, video_url, featured)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id`,
            [name, category, version, file_size, description_bn, description_en || description_bn, image_url, file_url, playstore_url, video_url, featured || false]
        );

        const newAppId = appRes.rows[0].id;
        if (screenshots && Array.isArray(screenshots)) {
            for (let i = 0; i < screenshots.length; i++) {
                await db.query('INSERT INTO application_screenshots (application_id, screenshot_url, sort_order) VALUES ($1, $2, $3)', [newAppId, screenshots[i], i]);
            }
        }

        res.json({ success: true, message: 'Application stored permanently.' });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

// 6. Delete App
router.delete('/apps/:id', async (req, res) => {
    try {
        await db.query('DELETE FROM applications WHERE id = $1', [req.params.id]);
        res.json({ success: true, message: 'Application deleted.' });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

// 7. Toggle Pin/Featured App
router.patch('/apps/:id/pin', async (req, res) => {
    try {
        await db.query('UPDATE applications SET featured = NOT featured WHERE id = $1', [req.params.id]);
        res.json({ success: true, message: 'Featured status toggled.' });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

// 8. Create Website Entry
router.post('/websites', async (req, res) => {
    const { name, url, description_bn, description_en, thumbnail_url } = req.body;
    try {
        await db.query(
            'INSERT INTO websites (name, url, description_bn, description_en, thumbnail_url) VALUES ($1, $2, $3, $4, $5)',
            [name, url, description_bn, description_en || description_bn, thumbnail_url]
        );
        res.json({ success: true, message: 'Website link stored successfully.' });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

// 9. Delete Website Entry
router.delete('/websites/:id', async (req, res) => {
    try {
        await db.query('DELETE FROM websites WHERE id = $1', [req.params.id]);
        res.json({ success: true, message: 'Website entry removed.' });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

module.exports = router;
