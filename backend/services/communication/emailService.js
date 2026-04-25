/**
 * ESTIF HOME ULTIMATE - EMAIL SERVICE
 * Email sending service for notifications, verification, and alerts
 * Version: 2.0.0
 */

const nodemailer = require('nodemailer');
const handlebars = require('handlebars');
const fs = require('fs');
const path = require('path');
const { logger } = require('../../utils/logger');

class EmailService {
    constructor() {
        this.transporter = null;
        this.isInitialized = false;
        this.templates = new Map();
    }

    initialize() {
        if (!process.env.SMTP_HOST) {
            logger.warn('SMTP not configured, email service disabled');
            return false;
        }

        this.transporter = nodemailer.createTransport({
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

        this.isInitialized = true;
        this.loadTemplates();
        logger.info('Email service initialized');
        return true;
    }

    loadTemplates() {
        const templateDir = path.join(__dirname, '../../templates/email');
        
        const templates = {
            verification: 'verification.html',
            passwordReset: 'password-reset.html',
            welcome: 'welcome.html',
            invite: 'invite.html',
            alert: 'alert.html',
            report: 'report.html',
            backupComplete: 'backup-complete.html',
            deviceAlert: 'device-alert.html'
        };

        for (const [name, file] of Object.entries(templates)) {
            const filePath = path.join(templateDir, file);
            if (fs.existsSync(filePath)) {
                const template = fs.readFileSync(filePath, 'utf8');
                this.templates.set(name, handlebars.compile(template));
            } else {
                this.templates.set(name, this.getDefaultTemplate(name));
            }
        }
    }

    getDefaultTemplate(type) {
        const templates = {
            verification: `
                <h1>Welcome to Estif Home!</h1>
                <p>Hi {{name}},</p>
                <p>Please verify your email address by clicking the link below:</p>
                <p><a href="{{url}}">{{url}}</a></p>
                <p>This link expires in 24 hours.</p>
                <p>If you didn't create an account, please ignore this email.</p>
            `,
            passwordReset: `
                <h1>Password Reset Request</h1>
                <p>Hi {{name}},</p>
                <p>Click the link below to reset your password:</p>
                <p><a href="{{url}}">{{url}}</a></p>
                <p>This link expires in 1 hour.</p>
                <p>If you didn't request this, please ignore this email.</p>
            `,
            welcome: `
                <h1>Welcome to Estif Home!</h1>
                <p>Hi {{name}},</p>
                <p>Your account has been successfully created.</p>
                <p>Get started with your smart home journey today!</p>
            `
        };
        return templates[type] || templates.welcome;
    }

    async sendEmail(options) {
        if (!this.isInitialized) {
            logger.warn('Email service not initialized');
            return false;
        }

        try {
            const mailOptions = {
                from: process.env.SMTP_FROM || 'noreply@estif-home.com',
                to: options.to,
                subject: options.subject,
                text: options.text,
                html: options.html
            };

            const info = await this.transporter.sendMail(mailOptions);
            logger.info(`Email sent to ${options.to}: ${info.messageId}`);
            return { success: true, messageId: info.messageId };
        } catch (error) {
            logger.error(`Email send failed to ${options.to}:`, error);
            return { success: false, error: error.message };
        }
    }

    async sendVerificationEmail(email, name, token) {
        const url = `${process.env.FRONTEND_URL}/verify?token=${token}`;
        const template = this.templates.get('verification');
        const html = template({ name, url });

        return this.sendEmail({
            to: email,
            subject: 'Verify Your Email - Estif Home',
            html
        });
    }

    async sendPasswordResetEmail(email, name, token) {
        const url = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;
        const template = this.templates.get('passwordReset');
        const html = template({ name, url });

        return this.sendEmail({
            to: email,
            subject: 'Password Reset Request - Estif Home',
            html
        });
    }

    async sendWelcomeEmail(email, name) {
        const template = this.templates.get('welcome');
        const html = template({ name });

        return this.sendEmail({
            to: email,
            subject: 'Welcome to Estif Home!',
            html
        });
    }

    async sendInviteEmail(email, inviterName, homeName, token) {
        const url = `${process.env.FRONTEND_URL}/join/${token}`;
        const html = `
            <h1>Home Invitation</h1>
            <p><strong>${inviterName}</strong> has invited you to join <strong>${homeName}</strong>.</p>
            <p>Click the link below to accept the invitation:</p>
            <p><a href="${url}">${url}</a></p>
            <p>This invitation expires in 7 days.</p>
        `;

        return this.sendEmail({
            to: email,
            subject: `You've been invited to join ${homeName}`,
            html
        });
    }

    async sendAlertEmail(email, name, title, message, data = {}) {
        const html = `
            <h1>${title}</h1>
            <p>Hi ${name},</p>
            <p>${message}</p>
            ${data.deviceName ? `<p><strong>Device:</strong> ${data.deviceName}</p>` : ''}
            ${data.value ? `<p><strong>Value:</strong> ${data.value}</p>` : ''}
            <p>Time: ${new Date().toLocaleString()}</p>
            <p><a href="${process.env.FRONTEND_URL}/dashboard">View Dashboard</a></p>
        `;

        return this.sendEmail({
            to: email,
            subject: `[Alert] ${title} - Estif Home`,
            html
        });
    }

    async sendReportEmail(email, name, reportType, data) {
        const html = `
            <h1>${reportType} Report</h1>
            <p>Hi ${name},</p>
            <p>Your ${reportType.toLowerCase()} report is ready.</p>
            <pre>${JSON.stringify(data, null, 2)}</pre>
            <p><a href="${process.env.FRONTEND_URL}/reports">View Full Report</a></p>
        `;

        return this.sendEmail({
            to: email,
            subject: `${reportType} Report - Estif Home`,
            html
        });
    }

    async sendBulkEmails(recipients, subject, template, data) {
        const results = [];
        for (const recipient of recipients) {
            const result = await this.sendEmail({
                to: recipient.email,
                subject,
                html: this.renderTemplate(template, { ...data, name: recipient.name })
            });
            results.push({ email: recipient.email, ...result });
        }
        return results;
    }

    renderTemplate(templateName, data) {
        const template = this.templates.get(templateName);
        if (template) {
            return template(data);
        }
        return this.getDefaultTemplate(templateName).replace(/{{(\w+)}}/g, (_, key) => data[key] || '');
    }

    isEnabled() {
        return this.isInitialized;
    }

    getStatus() {
        return {
            initialized: this.isInitialized,
            transporter: !!this.transporter,
            templates: Array.from(this.templates.keys())
        };
    }
}

module.exports = new EmailService();