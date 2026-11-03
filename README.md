# 🚀 MahimHossainBD — Enterprise Full-Stack Web Platform

একটি আধুনিক, নিরাপদ এবং স্কেলেবল ফুল-স্ট্যাক ওয়েবসাইট ও কনটেন্ট ম্যানেজমেন্ট সিস্টেম (CMS)। সাইটটির সব ডেটা রিয়েল ব্যাকএন্ড সার্ভার ও ডাটাবেজের সাথে যুক্ত এবং একটি অ্যাডমিন প্যানেল দিয়ে সম্পূর্ণ ওয়েবসাইট কোনো কোড পরিবর্তন ছাড়াই নিয়ন্ত্রণ করা যায়।

---

## 🌟 প্রধান সুবিধাসমূহ (Key Features)

- **দ্বিভাষিক সমর্থন (Bilingual Engine):** বাংলা ও ইংরেজি উভয় ভাষায় তাৎক্ষণিক সুইচ করার সুবিধা।
- **ডুয়েল মিডিয়া ম্যানেজমেন্ট (Dual Mode Asset Management):**
  - মেথড ১: সরাসরি যেকোনো অনলাইন ইমেজ/ভিডিও URL লিংক পেস্ট করে ব্যবহার।
  - মেথড ২: ফোন বা কম্পিউটার থেকে ছবি ও APK সরাসরি Cloudinary স্টোরেজে আপলোড।
- **অ্যাডমিন কন্ট্রোল সেন্টার:** প্রোফাইল বায়ো, সোশ্যাল লিংক, অ্যাপ স্টোর ও ওয়েবসাইট স্টোর সরাসরি ড্যাশবোর্ড থেকে ম্যানেজ করার সুবিধা।
- **নিরাপদ অথেনটিকেশন:** JWT টোকেন, পাসওয়ার্ড হ্যাশিং (Bcrypt) এবং ইমেইল ৬-ডিজিট OTP ভেরিফিকেশন।
- **স্থায়ী ডাটাবেজ স্টোরেজ:** PostgreSQL-এ ডেটা সংরক্ষিত থাকে, তাই সার্ভার রিস্টার্ট বা রিফ্রেশ করলেও কোনো ডেটা হারাবে না।
- **লাইভ হেলথ ডায়াগনস্টিকস:** ব্যাকএন্ড ও ডাটাবেজ সচল আছে কি না তা সাইটের টপ-বারে লাইভ দেখা যায়।

---

## 🛠️ টেকনোলজি স্ট্যাক (Tech Stack)

- **Frontend:** HTML5, CSS3 (Modern Responsive UI), Vanilla JavaScript (Modular ES6), Centralized `config.js`
- **Backend:** Node.js, Express.js REST APIs
- **Database:** PostgreSQL (with automated schema migration)
- **Security:** Helmet, CORS, Express-Rate-Limit, JWT, Bcrypt
- **Storage:** Cloudinary (Persistent storage for APK, ZIP & Images)
- **Deployment:** Render (Automated deployment from GitHub main branch)

---

## 📂 প্রজেক্ট স্ট্রাকচার (Directory Structure)

```text
MahimHossainBD/
├── backend/
│   ├── config/          # Database, Cloudinary & Firebase Setup
│   ├── middleware/      # JWT Auth & Rate Limiters
│   ├── routes/          # Public, Auth & Admin REST APIs
│   └── utils/           # Nodemailer OTP Sender
├── database/
│   ├── init.sql         # 15 Relational Tables & Schema
│   └── migrate.js       # Auto Database Provisioning
├── frontend/
│   ├── config.js        # Single Configurable API Endpoint
│   ├── index.html       # Responsive UI & Admin Control
│   └── js/app.js        # Dynamic Rendering & API Sync
├── .env.example
├── .gitignore
├── package.json
├── render.yaml
└── server.js

---

## 🔐 অ্যাডমিন ও ডাটাবেজ (Firebase)

- ডাটা থাকে Firebase Realtime Database-এ, শুধু সার্ভার সার্ভিস অ্যাকাউন্ট দিয়ে পড়ে/লেখে
- Database Rules: `{ "rules": { ".read": false, ".write": false } }` (সব বন্ধ; সার্ভারের Admin SDK রুলস বাইপাস করে)
- অ্যাডমিন প্যানেল: ঠিকানার শেষে `/admin`; লগইন না থাকলে Firebase লগইন ফর্ম আসে
- অনুমতি পায় শুধু `ADMIN_EMAIL`-এর ইমেইল
- Render Environment: `ADMIN_EMAIL`, `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`, `FIREBASE_DATABASE_URL`, `GITHUB_TOKEN`, `GITHUB_REPO` (`JWT_SECRET` অটো)
- `backend/` ও `frontend/` ফোল্ডার বর্তমান সার্ভার ব্যবহার করে না (পুরনো কোড)
