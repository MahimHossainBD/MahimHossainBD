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

## 🔐 অ্যাডমিন লগইন সেটআপ (আপডেটেড)

- লগইন পেজ: `/login` (ইউজারনেম + পাসওয়ার্ড) অথবা `/firebase-login` (Firebase)
- অ্যাডমিন প্যানেল: `/admin` (ফাইল: `private/admin.html`, লগইন ছাড়া খোলা যায় না)
- সার্ভার চালু হলে ডাটাবেজ টেবিল ও অ্যাডমিন অটো তৈরি হয় (`/setup-admin` রুট সরানো হয়েছে)
- Render → Environment-এ এগুলো সেট করুন:
  - `DATABASE_URL` — PostgreSQL লিংক
  - `ADMIN_USERNAME` — ডিফল্ট `MrMahimFire`
  - `ADMIN_PASSWORD` — আপনার শক্তিশালী পাসওয়ার্ড (প্রতি স্টার্টে এটাই পাসওয়ার্ড হয়; বদলাতে চাইলে এটা বদলান)
  - `JWT_SECRET` — Render অটো তৈরি করে
- `backend/` ও `frontend/` ফোল্ডার বর্তমান সার্ভার ব্যবহার করে না (পুরনো কোড)।
