-- PostgreSQL Database Initialization Schema for MahimHossainBD

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Admins Table
CREATE TABLE IF NOT EXISTS admins (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    role VARCHAR(50) DEFAULT 'SUPER_ADMIN',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Admin Sessions Table
CREATE TABLE IF NOT EXISTS admin_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    admin_id INTEGER REFERENCES admins(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Profile Table (Single record architecture)
CREATE TABLE IF NOT EXISTS profiles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL DEFAULT 'MahimHossainBD',
    tagline VARCHAR(255) DEFAULT 'Developer and create app',
    about_bn TEXT DEFAULT 'আমি হলো একজন Developer এবং তোমাদের App, ওয়েবসাইট বানানো শিখায়',
    about_en TEXT DEFAULT 'I am a Developer teaching you how to create applications and modern websites.',
    email VARCHAR(255) DEFAULT 'MahimHossainBD@gmail.com',
    logo_url TEXT DEFAULT 'https://i.postimg.cc/X7kpKwx7/Picsart-26-09-07-22-20-41-182.jpg',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Social Links Table
CREATE TABLE IF NOT EXISTS social_links (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    username_handle VARCHAR(150),
    url TEXT NOT NULL,
    icon VARCHAR(50) DEFAULT 'link',
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. Applications Table
CREATE TABLE IF NOT EXISTS applications (
    id SERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    category VARCHAR(50) DEFAULT 'App',
    version VARCHAR(50) DEFAULT '1.0.0',
    file_size VARCHAR(50),
    description_bn TEXT NOT NULL,
    description_en TEXT,
    image_url TEXT NOT NULL,
    file_url TEXT NOT NULL,
    file_type VARCHAR(20) DEFAULT 'APK',
    playstore_url TEXT,
    video_url TEXT,
    featured BOOLEAN DEFAULT FALSE,
    sort_order INTEGER DEFAULT 0,
    is_visible BOOLEAN DEFAULT TRUE,
    downloads_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. Application Screenshots Table
CREATE TABLE IF NOT EXISTS application_screenshots (
    id SERIAL PRIMARY KEY,
    application_id INTEGER REFERENCES applications(id) ON DELETE CASCADE,
    screenshot_url TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 7. Websites Table
CREATE TABLE IF NOT EXISTS websites (
    id SERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    url TEXT NOT NULL,
    description_bn TEXT,
    description_en TEXT,
    thumbnail_url TEXT,
    sort_order INTEGER DEFAULT 0,
    is_visible BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 8. Website Settings Table
CREATE TABLE IF NOT EXISTS website_settings (
    setting_key VARCHAR(100) PRIMARY KEY,
    setting_value TEXT NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 9. Legal Policies Table
CREATE TABLE IF NOT EXISTS policies (
    id SERIAL PRIMARY KEY,
    slug VARCHAR(100) UNIQUE NOT NULL,
    title_bn VARCHAR(255) NOT NULL,
    title_en VARCHAR(255) NOT NULL,
    content_bn TEXT NOT NULL,
    content_en TEXT NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 10. File Uploads Metadata Registry
CREATE TABLE IF NOT EXISTS uploads (
    id SERIAL PRIMARY KEY,
    filename VARCHAR(255) NOT NULL,
    file_url TEXT NOT NULL,
    public_id VARCHAR(255),
    mimetype VARCHAR(100) NOT NULL,
    size_bytes BIGINT NOT NULL,
    storage_provider VARCHAR(50) DEFAULT 'CLOUDINARY',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 11. Email & OTP Verification Table
CREATE TABLE IF NOT EXISTS otp_verifications (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    otp_code VARCHAR(10) NOT NULL,
    action_type VARCHAR(50) DEFAULT 'ADMIN_LOGIN',
    attempts INTEGER DEFAULT 0,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    is_consumed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 12. Security Audit & Activity Logs
CREATE TABLE IF NOT EXISTS activity_logs (
    id SERIAL PRIMARY KEY,
    admin_id INTEGER REFERENCES admins(id) ON DELETE SET NULL,
    action_title VARCHAR(150) NOT NULL,
    ip_address VARCHAR(45),
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indices for Fast Lookups
CREATE INDEX IF NOT EXISTS idx_apps_visible ON applications(is_visible, sort_order ASC);
CREATE INDEX IF NOT EXISTS idx_webs_visible ON websites(is_visible, sort_order ASC);
CREATE INDEX IF NOT EXISTS idx_links_active ON social_links(is_active, sort_order ASC);
CREATE INDEX IF NOT EXISTS idx_otp_lookup ON otp_verifications(email, otp_code, is_consumed);

-- Seed Initial Profile and Policies if Empty
INSERT INTO profiles (id, name, tagline, about_bn, about_en, email, logo_url)
VALUES (
    1,
    'MahimHossainBD',
    'Developer and create app',
    'আমি হলো একজন Developer এবং তোমাদের App, ওয়েবসাইট বানানো শিখায়',
    'I am a Developer teaching you how to create applications and modern websites.',
    'MahimHossainBD@gmail.com',
    'https://i.postimg.cc/X7kpKwx7/Picsart-26-09-07-22-20-41-182.jpg'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO social_links (name, username_handle, url, icon, sort_order, is_active)
VALUES 
    ('YouTube', 'Channel link নেই', '', 'youtube', 1, TRUE),
    ('TikTok', '@mahimhossainbd', 'https://tiktok.com/@mahimhossainbd', 'tiktok', 2, TRUE),
    ('Telegram', '@MahimHossainBD', 'https://t.me/MahimHossainBD', 'telegram', 3, TRUE)
ON CONFLICT DO NOTHING;

INSERT INTO website_settings (setting_key, setting_value)
VALUES 
    ('site_title', 'MahimHossainBD - Official Portfolio & Store'),
    ('contact_email', 'MahimHossainBD@gmail.com'),
    ('maintenance_mode', 'false'),
    ('otp_enabled', 'false')
ON CONFLICT (setting_key) DO NOTHING;
