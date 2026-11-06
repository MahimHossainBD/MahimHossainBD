/* ============================================================
   MahimHossainBD - Production Client Script
   Bilingual engine, real API synchronization, local fallback, 
   dual-mode media uploaders.
   ============================================================ */

const I18N = {
    en: {
        "nav.profile": "Profile",
        "nav.store": "App Store",
        "nav.web": "Website Store",
        "profile.linksTitle": "Online <span>Links</span>",
        "profile.contact": "Contact",
        "store.title": "📦 App <span>Store</span>",
        "web.title": "🌐 Website <span>Store</span>",
        "btn.download": "⬇️ Download",
        "btn.tutorial": "🎬 Tutorial",
        "btn.share": "🔗 Share",
        "btn.visit": "Visit"
    },
    bn: {
        "nav.profile": "প্রোফাইল",
        "nav.store": "অ্যাপ স্টোর",
        "nav.web": "ওয়েবসাইট",
        "profile.linksTitle": "Online <span>Link</span>",
        "profile.contact": "Contact",
        "store.title": "📦 অ্যাপ <span>স্টোর</span>",
        "web.title": "🌐 ওয়েবসাইট <span>স্টোর</span>",
        "btn.download": "⬇️ ডাউনলোড",
        "btn.tutorial": "🎬 টিউটোরিয়াল",
        "btn.share": "🔗 শেয়ার",
        "btn.visit": "Visit"
    }
};

const ICONS = {
    youtube: '<svg viewBox="0 0 24 24"><path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.8zM9.6 15.9V8.1l6.5 3.9-6.5 3.9z"/></svg>',
    tiktok: '<svg viewBox="0 0 24 24"><path d="M19.6 7.2c-1.7-.1-3.1-1-4-2.4-.4-.6-.6-1.3-.7-2.1H11v13.1c0 1.5-1.2 2.7-2.7 2.7S5.6 17.3 5.6 15.8s1.2-2.7 2.7-2.7c.3 0 .6.1.9.2V9.2c-.3 0-.6-.1-.9-.1-3.7 0-6.7 3-6.7 6.7s3 6.7 6.7 6.7 6.7-3 6.7-6.7V9.4c1.3 1 2.9 1.6 4.6 1.6V7.2z"/></svg>',
    telegram: '<svg viewBox="0 0 24 24"><path d="M21.8 3.2 18.5 20c-.3 1.2-1 1.5-2 .9l-5.5-4-2.7 2.6c-.3.3-.5.5-1 .5l.4-5.6 10.2-9.2c.4-.4-.1-.6-.6-.2L4.7 12.8l-5.4-1.7c-1.2-.4-1.2-1.2.3-1.8L20.7 1.1c1-.4 1.9.2 1.1 2.1z"/></svg>',
    link: '<svg viewBox="0 0 24 24"><path d="M3.9 12a3.1 3.1 0 0 1 3.1-3.1h4V6.9H7A5.1 5.1 0 0 0 7 17h4v-2H7A3.1 3.1 0 0 1 3.9 12zM8 13h8v-2H8v2zm9-6.1h-4v2h4a3.1 3.1 0 1 1 0 6.2h-4v2h4a5.1 5.1 0 0 0 0-10.2z"/></svg>'
};

let currentLang = localStorage.getItem('mhb_lang') || 'bn';
let globalProfile = {};
let globalApps = [];
let globalWebsites = [];
let globalLinks = [];

// DOM References
const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const pfLogo = document.getElementById('pfLogo');
const pfName = document.getElementById('pfName');
const pfTagline = document.getElementById('pfTagline');
const pfAbout = document.getElementById('pfAbout');
const pfEmail = document.getElementById('pfEmail');
const linksGrid = document.getElementById('linksGrid');
const appsGrid = document.getElementById('appsGrid');
const webGrid = document.getElementById('webGrid');
const toastEl = document.getElementById('toast');

function showToast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    setTimeout(() => toastEl.classList.remove('show'), 2400);
}

function escapeHtml(str) {
    return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// 1. Health Probe & Status Display
async function probeServer() {
    const health = await window.CONFIG.checkHealth();
    if (health.status === 'ONLINE') {
        statusDot.className = 'status-dot online';
        statusText.textContent = `Backend Live | DB: ${health.database} | Storage: ${health.storage}`;
    } else {
        statusDot.className = 'status-dot offline';
        statusText.textContent = 'Server Offline (Serving cached data)';
    }
}

// 2. Fetch Remote Data
async function loadPublicData() {
    try {
        const [pRes, lRes, aRes, wRes] = await Promise.all([
            window.CONFIG.request('/profile').catch(() => null),
            window.CONFIG.request('/links').catch(() => null),
            window.CONFIG.request('/apps').catch(() => null),
            window.CONFIG.request('/websites').catch(() => null)
        ]);

        if (pRes && pRes.data) globalProfile = pRes.data;
        if (lRes && lRes.data) globalLinks = lRes.data;
        if (aRes && aRes.data) globalApps = aRes.data;
        if (wRes && wRes.data) globalWebsites = wRes.data;

        renderAll();
    } catch (e) {
        console.warn('[Sync Warning] Loading local fallback:', e.message);
        renderAll();
    }
}

// 3. Render Profile & Content
function renderAll() {
    // Profile
    pfLogo.src = globalProfile.logo_url || 'https://i.postimg.cc/X7kpKwx7/Picsart-26-09-07-22-20-41-182.jpg';
    pfName.textContent = globalProfile.name || 'MahimHossainBD';
    pfTagline.textContent = globalProfile.tagline || 'Developer and create app';
    pfAbout.textContent = currentLang === 'bn' ? (globalProfile.about_bn || '') : (globalProfile.about_en || globalProfile.about_bn || '');
    pfEmail.textContent = globalProfile.email || 'MahimHossainBD@gmail.com';
    pfEmail.href = `mailto:${globalProfile.email || 'MahimHossainBD@gmail.com'}`;

    // Links
    linksGrid.innerHTML = '';
    globalLinks.forEach(l => {
        const card = document.createElement('div');
        card.className = 'link-card';
        const hasUrl = l.url && l.url.trim().length > 0;
        card.innerHTML = `
            <div class="icon">${ICONS[l.icon] || ICONS.link}</div>
            <h3>${escapeHtml(l.name)}</h3>
            <p>${escapeHtml(l.username_handle || '')}</p>
            ${hasUrl ? `<a class="visit-btn" href="${escapeHtml(l.url)}" target="_blank">${I18N[currentLang]['btn.visit']}</a>` : `<span class="visit-btn disabled">Unavailable</span>`}
        `;
        linksGrid.appendChild(card);
    });

    // Apps
    appsGrid.innerHTML = '';
    globalApps.forEach(a => {
        const card = document.createElement('div');
        card.className = 'app-card';
        card.innerHTML = `
            ${a.featured ? `<div class="pin-badge">⭐ FEATURED</div>` : ''}
            <img class="app-thumb" src="${a.image_url}" alt="${escapeHtml(a.name)}">
            <div class="app-body">
                <h3>${escapeHtml(a.name)}</h3>
                <div class="meta-row">
                    <span class="tag-pill">${escapeHtml(a.category || 'App')}</span>
                    <span class="tag-pill gray">v${escapeHtml(a.version || '1.0')}</span>
                    ${a.file_size ? `<span class="tag-pill gray">${escapeHtml(a.file_size)}</span>` : ''}
                </div>
                <div class="desc">${escapeHtml(a.description_bn)}</div>
                <div class="app-actions">
                    <a class="btn-sm btn-dl" href="${a.file_url}" target="_blank" download>${I18N[currentLang]['btn.download']}</a>
                    ${a.video_url ? `<button class="btn-sm btn-vid" onclick="openVideo('${escapeHtml(a.name)}', '${escapeHtml(a.video_url)}')">${I18N[currentLang]['btn.tutorial']}</button>` : ''}
                </div>
            </div>
        `;
        appsGrid.appendChild(card);
    });

    // Websites
    webGrid.innerHTML = '';
    globalWebsites.forEach(w => {
        const card = document.createElement('div');
        card.className = 'app-card';
        card.innerHTML = `
            <img class="app-thumb" src="${w.thumbnail_url || globalProfile.logo_url}" alt="${escapeHtml(w.name)}">
            <div class="app-body">
                <h3>${escapeHtml(w.name)}</h3>
                <div class="desc">${escapeHtml(w.description_bn || '')}</div>
                <div class="app-actions">
                    <a class="btn-sm btn-dl" href="${escapeHtml(w.url)}" target="_blank">${I18N[currentLang]['btn.visit']}</a>
                </div>
            </div>
        `;
        webGrid.appendChild(card);
    });
}

// 4. Video Embed Modal
window.openVideo = function(title, url) {
    document.getElementById('videoTitle').textContent = `🎬 ${title}`;
    const container = document.getElementById('videoContent');
    container.innerHTML = '';

    let ytMatch = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/);
    if (ytMatch) {
        container.innerHTML = `<iframe src="https://www.youtube.com/embed/${ytMatch[1]}" allowfullscreen></iframe>`;
    } else {
        container.innerHTML = `<video src="${url}" controls autoplay></video>`;
    }

    document.getElementById('videoModal').classList.add('open');
};

document.getElementById('videoClose').addEventListener('click', () => {
    document.getElementById('videoModal').classList.remove('open');
    document.getElementById('videoContent').innerHTML = '';
});

// 5. Navigation Tab Router
document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        ['view-profile', 'view-store', 'view-web'].forEach(id => document.getElementById(id).style.display = 'none');
        const view = btn.dataset.view;
        if (view === 'profile') document.getElementById('view-profile').style.display = 'block';
        if (view === 'store') document.getElementById('view-store').style.display = 'block';
        if (view === 'web') document.getElementById('view-web').style.display = 'block';
    });
});

// 6. Language Switcher
document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.lang-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentLang = btn.dataset.lang;
        localStorage.setItem('mhb_lang', currentLang);
        renderAll();
    });
});

// Initialization
document.getElementById('year').textContent = new Date().getFullYear();
probeServer();
loadPublicData();
setInterval(probeServer, 30000);
