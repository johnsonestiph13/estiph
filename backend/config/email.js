const nodemailer = require('nodemailer');

let transporter = null;

const initEmail = () => {
    if (!process.env.SMTP_HOST) {
        console.log('Email not configured, skipping...');
        return null;
    }
    
    transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
        },
        tls: {
            rejectUnauthorized: false
        }
    });
    
    console.log('✅ Email transporter initialized');
    return transporter;
};

const sendEmail = async (options) => {
    if (!transporter) {
        console.warn('Email not configured, skipping send');
        return false;
    }
    
    const mailOptions = {
        from: process.env.SMTP_FROM || 'noreply@estif-home.com',
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html
    };
    
    try {
        const info = await transporter.sendMail(mailOptions);
        console.log(`Email sent: ${info.messageId}`);
        return true;
    } catch (error) {
        console.error('Email send error:', error);
        return false;
    }
};

const sendVerificationEmail = async (email, name, token) => {
    const url = `${process.env.FRONTEND_URL}/verify-email?token=${token}`;
    
    return sendEmail({
        to: email,
        subject: 'Verify Your Email - Estif Home',
        html: `
            <h1>Welcome to Estif Home!</h1>
            <p>Hi ${name},</p>
            <p>Please verify your email address by clicking the link below:</p>
            <a href="${url}">${url}</a>
            <p>This link expires in 24 hours.</p>
            <p>If you didn't create an account, please ignore this email.</p>
        `
    });
};

const sendPasswordResetEmail = async (email, name, token) => {
    const url = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;
    
    return sendEmail({
        to: email,
        subject: 'Password Reset - Estif Home',
        html: `
            <h1>Password Reset Request</h1>
            <p>Hi ${name},</p>
            <p>Click the link below to reset your password:</p>
            <a href="${url}">${url}</a>
            <p>This link expires in 1 hour.</p>
            <p>If you didn't request this, please ignore this email.</p>
        `
    });
};

const sendInviteEmail = async (email, homeName, inviterName, token) => {
    const url = `${process.env.FRONTEND_URL}/join/${token}`;
    
    return sendEmail({
        to: email,
        subject: `You've been invited to join ${homeName}`,
        html: `
            <h1>Home Invitation</h1>
            <p><strong>${inviterName}</strong> has invited you to join <strong>${homeName}</strong>.</p>
            <p>Click the link below to accept the invitation:</p>
            <a href="${url}">${url}</a>
            <p>This invitation expires in 7 days.</p>
        `
    });
};

module.exports = {
    initEmail,
    sendEmail,
    sendVerificationEmail,
    sendPasswordResetEmail,
    sendInviteEmail
};