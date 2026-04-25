/**
 * ESTIF HOME ULTIMATE - SMS SERVICE
 * SMS messaging service for alerts and verification codes
 * Version: 2.0.0
 */

const twilio = require('twilio');
const { logger } = require('../../utils/logger');

class SMSService {
    constructor() {
        this.client = null;
        this.isInitialized = false;
    }

    initialize() {
        if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
            logger.warn('Twilio not configured, SMS service disabled');
            return false;
        }

        this.client = twilio(
            process.env.TWILIO_ACCOUNT_SID,
            process.env.TWILIO_AUTH_TOKEN
        );

        this.isInitialized = true;
        logger.info('SMS service initialized');
        return true;
    }

    async sendSMS(to, message) {
        if (!this.isInitialized) {
            logger.warn('SMS service not initialized');
            return { success: false, error: 'SMS service not configured' };
        }

        try {
            const result = await this.client.messages.create({
                body: message,
                to: to,
                from: process.env.TWILIO_PHONE_NUMBER
            });

            logger.info(`SMS sent to ${to}: ${result.sid}`);
            return { success: true, sid: result.sid };
        } catch (error) {
            logger.error(`SMS send failed to ${to}:`, error);
            return { success: false, error: error.message };
        }
    }

    async sendVerificationCode(phone, code) {
        return this.sendSMS(phone, `Your Estif Home verification code is: ${code}. Valid for 10 minutes.`);
    }

    async sendAlertSMS(phone, deviceName, alertType, value = null) {
        let message = `[Estif Home Alert] ${deviceName} - ${alertType}. `;
        if (value) message += `Value: ${value}. `;
        message += 'Please check your app for details.';
        
        return this.sendSMS(phone, message);
    }

    async sendSecurityAlert(phone, eventType) {
        const messages = {
            login: 'New login detected on your Estif Home account. If this wasn\'t you, please secure your account.',
            device_added: 'A new device was added to your Estif Home. Check your app for details.',
            settings_changed: 'Your Estif Home settings were changed. If this wasn\'t you, please review.',
            backup_completed: 'Your Estif Home backup completed successfully.',
            backup_failed: 'Your Estif Home backup failed. Please check your backup settings.'
        };

        const message = messages[eventType] || `Security event: ${eventType} - Estif Home`;
        return this.sendSMS(phone, message);
    }

    async sendDailyDigest(phone, energyUsage, activeDevices, alerts) {
        const message = `[Estif Home Daily] Energy: ${energyUsage.toFixed(1)} kWh, Active: ${activeDevices} devices, Alerts: ${alerts}`;
        return this.sendSMS(phone, message);
    }

    async sendBulkSMS(recipients, message) {
        const results = [];
        for (const recipient of recipients) {
            const result = await this.sendSMS(recipient.phone, message);
            results.push({ phone: recipient.phone, ...result });
        }
        return results;
    }

    isEnabled() {
        return this.isInitialized;
    }

    getStatus() {
        return {
            initialized: this.isInitialized,
            phoneNumber: process.env.TWILIO_PHONE_NUMBER || null
        };
    }
}

module.exports = new SMSService();