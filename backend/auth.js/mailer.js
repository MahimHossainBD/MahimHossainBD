const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
});

async function sendOtpEmail(toEmail, otpCode) {
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
        console.warn(`[OTP Mailer Disabled] Mock Code for ${toEmail}: ${otpCode}`);
        return { success: true, simulated: true };
    }

    const htmlContent = `
        <div style="font-family:Arial,sans-serif; background:#05070b; color:#ffffff; padding:24px; border-radius:12px; border:1px solid #1677ff;">
            <h2 style="color:#1677ff;">MahimHossainBD Security Verification</h2>
            <p>Your one-time authentication code is:</p>
            <div style="font-size:32px; font-weight:bold; letter-spacing:6px; color:#22c55e; margin:20px 0;">${otpCode}</div>
            <p style="color:#8d9aaa; font-size:12px;">This code will expire in 10 minutes. If you did not request this, secure your account immediately.</p>
        </div>
    `;

    return await transporter.sendMail({
        from: `"MahimHossainBD Security" <${process.env.SMTP_USER}>`,
        to: toEmail,
        subject: `Your Security Verification Code: ${otpCode}`,
        html: htmlContent
    });
}

module.exports = { sendOtpEmail };
