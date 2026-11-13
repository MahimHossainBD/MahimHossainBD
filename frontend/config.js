/**
 * MahimHossainBD - Unified Frontend & Firebase Configuration
 */

// ১. আপনার দেওয়া Firebase কনফিগারেশন
const firebaseConfig = {
  apiKey: "AIzaSyBNWiaiL6IB2BR-dzHKBzL01MPF1urs7RY",
  authDomain: "mahimhossain-bd.firebaseapp.com",
  databaseURL: "https://mahimhossain-bd-default-rtdb.firebaseio.com",
  projectId: "mahimhossain-bd",
  storageBucket: "mahimhossain-bd.firebasestorage.app",
  messagingSenderId: "445369690414",
  appId: "1:445369690414:web:f4e0cb9c8e8295c7cab2bf"
};

// ২. সেন্ট্রাল ব্যাকএন্ড API কানেকশন
const CONFIG = {
    firebaseConfig: firebaseConfig,

    // 👇 আপনার সার্ভারের লিংক (শেষে / দেবেন না)
    SERVER_URL: 'https://mahimhossainbdserver.onrender.com',

    API_BASE_URL: (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
        ? 'http://localhost:10000/api'
        : 'https://mahimhossainbdserver.onrender.com/api',

    REQUEST_TIMEOUT_MS: 45000, // Render ফ্রি সার্ভার ঘুম থেকে উঠতে সময় নেয়

    async request(endpoint, options = {}) {
        const url = `${this.API_BASE_URL}${endpoint}`;
        const token = localStorage.getItem('mhb_token');

        const headers = {
            ...(options.body ? { 'Content-Type': 'application/json' } : {}),
            ...(options.headers || {})
        };

        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.REQUEST_TIMEOUT_MS);

        try {
            const response = await fetch(url, {
                ...options,
                headers,
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            const result = await response.json();
            if (!response.ok) {
                throw new Error(result.message || `HTTP Error ${response.status}`);
            }
            return result;
        } catch (error) {
            clearTimeout(timeoutId);
            if (error.name === 'AbortError') {
                throw new Error('Connection timed out. Server taking too long.');
            }
            throw error;
        }
    },

    async checkHealth() {
        try {
            return await this.request('/health', { method: 'GET' });
        } catch (e) {
            return { success: false, status: 'OFFLINE', error: e.message };
        }
    }
};

window.CONFIG = CONFIG;
