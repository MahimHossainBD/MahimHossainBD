const admin = require('firebase-admin');
require('dotenv').config();

let firebaseApp = null;
let isInitialized = false;

try {
    if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
        firebaseApp = admin.initializeApp({
            credential: admin.credential.cert({
                projectId: process.env.FIREBASE_PROJECT_ID,
                clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
            })
        });
        isInitialized = true;
        console.log('[Firebase Admin] Successfully initialized with service credentials.');
    } else {
        console.warn('[Firebase Admin] Environment keys missing. Operating in fallback JWT authentication mode.');
    }
} catch (error) {
    console.error('[Firebase Admin Init Error]:', error.message);
}

module.exports = {
    admin,
    isInitialized: () => isInitialized,
    verifyIdToken: async (token) => {
        if (!isInitialized) throw new Error('Firebase credentials are not configured on server.');
        return await admin.auth().verifyIdToken(token);
    }
};
