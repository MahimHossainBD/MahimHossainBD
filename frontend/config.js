/**
 * MahimHossainBD - Unified Frontend API Configuration
 * Change this URL to connect your frontend with your backend server.
 */
const CONFIG = {
    // Single configurable entry point for all API requests
    API_BASE_URL: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
        ? 'http://localhost:10000/api'
        : `${window.location.origin}/api`,

    REQUEST_TIMEOUT_MS: 12000,

    async request(endpoint, options = {}) {
        const url = `${this.API_BASE_URL}${endpoint}`;
        const token = localStorage.getItem('mhb_token');

        const headers = {
            'Content-Type': 'application/json',
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
                throw new Error('Connection timed out. Server is taking too long to respond.');
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
