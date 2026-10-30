const jwt = require('jsonwebtoken');
const db = require('../config/db');
require('dotenv').config();

module.exports = async function authGuard(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, message: 'Unauthorized access. Authentication token required.' });
    }

    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'FALLBACK_UNSAFE_DEV_SECRET_KEY');
        const adminCheck = await db.query('SELECT id, username, email FROM admins WHERE id = $1', [decoded.id]);
        
        if (adminCheck.rows.length === 0) {
            return res.status(403).json({ success: false, message: 'User authorization denied.' });
        }

        req.admin = adminCheck.rows[0];
        next();
    } catch (err) {
        return res.status(401).json({ success: false, message: 'Session expired or token invalid.', error: err.message });
    }
};
