const rateLimit = require('express-rate-limit');

// ১. সাধারণ পাবলিক API রেট লিমিটার (১৫ মিনিটে সর্বোচ্চ ৩০০টি রিকোয়েস্ট)
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // ১৫ মিনিট
    max: 300, // প্রতি IP থেকে সর্বোচ্চ ৩০০ রিকোয়েস্ট
    standardHeaders: true, // আধুনিক RateLimit-* হেডার পাঠাবে
    legacyHeaders: false,
    message: {
        success: false,
        message: 'Too many requests from this IP, please try again after 15 minutes.'
    }
});

// ২. অ্যাডমিন লগইন ও OTP সুরক্ষার জন্য কড়া লিমিটার (ব্রুট-ফোর্স হ্যাকিং ঠেকানোর জন্য)
// ১৫ মিনিটে সর্বোচ্চ ৮ বার চেষ্টা করা যাবে
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // ১৫ মিনিট
    max: 8, // সর্বোচ্চ ৮ বার লগইন চেষ্টা
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        message: 'Too many login attempts. Your IP has been temporarily locked for 15 minutes for security.'
    }
});

// ৩. ফাইল ও APK আপলোডের জন্য লিমিটার (যাতে সার্ভারে অতিরিক্ত চাপ না পড়ে)
const uploadLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // ১ ঘণ্টা
    max: 60, // ১ ঘণ্টায় সর্বোচ্চ ৬০টি ফাইল আপলোড
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        message: 'Hourly upload limit exceeded. Please wait a while before uploading more files.'
    }
});

module.exports = {
    apiLimiter,
    authLimiter,
    uploadLimiter
};
