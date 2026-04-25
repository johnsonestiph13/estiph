const bull = require('bull');
const { sendEmail } = require('../config/email');
const { logger } = require('../utils/logger');

const emailQueue = new bull('email', process.env.REDIS_URL);

emailQueue.process(async (job) => {
    const { to, subject, template, data } = job.data;
    
    try {
        const result = await sendEmail({ to, subject, html: generateEmailTemplate(template, data) });
        logger.info(`Email sent to ${to}: ${subject}`);
        return result;
    } catch (error) {
        logger.error(`Email failed to ${to}: ${error.message}`);
        throw error;
    }
});

const generateEmailTemplate = (template, data) => {
    const templates = {
        verification: `
            <h1>Welcome to Estif Home!</h1>
            <p>Hi ${data.name},</p>
            <p>Please verify your email by clicking: <a href="${data.url}">${data.url}</a></p>
            <p>This link expires in 24 hours.</p>
        `,
        passwordReset: `
            <h1>Password Reset Request</h1>
            <p>Hi ${data.name},</p>
            <p>Click here to reset your password: <a href="${data.url}">${data.url}</a></p>
            <p>This link expires in 1 hour.</p>
        `,
        invite: `
            <h1>Home Invitation</h1>
            <p><strong>${data.inviter}</strong> invited you to join <strong>${data.homeName}</strong>.</p>
            <p>Click here to accept: <a href="${data.url}">${data.url}</a></p>
        `,
        alert: `
            <h1>${data.title}</h1>
            <p>${data.message}</p>
            <p>Time: ${new Date().toLocaleString()}</p>
        `
    };
    return templates[template] || templates.verification;
};

const addEmailJob = async (to, subject, template, data, delay = 0) => {
    return emailQueue.add({ to, subject, template, data }, { delay, attempts: 3, backoff: 5000 });
};

module.exports = { emailQueue, addEmailJob };