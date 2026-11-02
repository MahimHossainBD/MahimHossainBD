-- database/schema.sql

-- ১. অ্যাডমিন টেবিল
CREATE TABLE IF NOT EXISTS admins (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ২. গ্লোবাল ওয়েবসাইট সেটিংস ও OTP কনফিগারেশন
CREATE TABLE IF NOT EXISTS settings (
    key VARCHAR(100) PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ৩. প্রোফাইল ইনফরমেশন (সিঙ্গেল রেকর্ড)
CREATE TABLE IF NOT EXISTS profiles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL DEFAULT 'MahimHossainBD',
    tagline VARCHAR(255) DEFAULT 'Developer and create app',
    about_bn TEXT DEFAULT 'আমি হলো একজন Developer এবং তোমাদের App, ওয়েবসাইট বানানো শিখায়',
    about_en TEXT DEFAULT 'I am a Developer teaching you how to build modern apps and websites.',
    email VARCHAR(255) DEFAULT 'MahimHossainBD@gmail.com',
    logo_url TEXT DEFAULT 'https://i.postimg.cc/X7kpKwx7/Picsart-26-09-07-22-20-41-182.jpg',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ৪. সোশ্যাল লিংক
CREATE TABLE IF NOT EXISTS social_links (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    username_handle VARCHAR(150),
    url TEXT NOT NULL,
    icon VARCHAR(50) DEFAULT 'link',
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE
);

-- ৫. অ্যাপ স্টোর টেবিল
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
    playstore_url TEXT,
    video_url TEXT,
    featured BOOLEAN DEFAULT FALSE,
    sort_order INTEGER DEFAULT 0,
    is_visible BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ৬. ওয়েবসাইট স্টোর টেবিল
CREATE TABLE IF NOT EXISTS websites (
    id SERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    url TEXT NOT NULL,
    description_bn TEXT,
    description_en TEXT,
    thumbnail_url TEXT,
    sort_order INTEGER DEFAULT 0,
    is_visible BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ৭. পলিসি ও পেজ কনটেন্ট টেবিল
CREATE TABLE IF NOT EXISTS policies (
    id SERIAL PRIMARY KEY,
    slug VARCHAR(100) UNIQUE NOT NULL,
    title_bn VARCHAR(255) NOT NULL,
    title_en VARCHAR(255) NOT NULL,
    content_bn TEXT NOT NULL,
    content_en TEXT NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ৮. সক্রিয় ইমেইল OTP টেবিল
CREATE TABLE IF NOT EXISTS otp_codes (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    code_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    attempts INTEGER DEFAULT 0,
    is_used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- প্রাথমিক ডিফল্ট ডাটা যুক্তকরণ (Idempotent Seeds)
INSERT INTO profiles (id, name, tagline, about_bn, about_en, email, logo_url)
VALUES (
    1,
    'MahimHossainBD',
    'Developer and create app',
    'আমি হলো একজন Developer এবং তোমাদের App, ওয়েবসাইট বানানো শিখায়',
    'I am a Developer teaching you how to build modern apps and websites.',
    'MahimHossainBD@gmail.com',
    'https://i.postimg.cc/X7kpKwx7/Picsart-26-09-07-22-20-41-182.jpg'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO settings (key, value) VALUES
    ('site_title', 'MahimHossainBD — Official App & Web Store'),
    ('otp_enabled', 'false'),
    ('maintenance_mode', 'false'),
    ('contact_email', 'MahimHossainBD@gmail.com')
ON CONFLICT (key) DO NOTHING;

INSERT INTO policies (slug, title_bn, title_en, content_bn, content_en) VALUES
    ('privacy', 'গোপনীয়তা নীতি', 'Privacy Policy', 'আমরা ব্যবহারকারীর তথ্যের সর্বোচ্চ গোপনীয়তা রক্ষা করি।', 'We strictly protect user data and privacy.'),
    ('terms', 'শর্তাবলী ও নিয়মাবলী', 'Terms & Conditions', 'আমাদের সকল অ্যাপ ও ফাইল ব্যক্তিগত ব্যবহারের জন্য উন্মুক্ত।', 'All files and apps are for personal legitimate use.')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO social_links (name, username_handle, url, icon, sort_order)
SELECT * FROM (VALUES
    ('YouTube', 'Channel link নেই', '', 'youtube', 1),
    ('TikTok', '@mahimhossainbd', 'https://tiktok.com/@mahimhossainbd', 'tiktok', 2),
    ('Telegram', '@MahimHossainBD', 'https://t.me/MahimHossainBD', 'telegram', 3)
) AS seed(name, username_handle, url, icon, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM social_links);
