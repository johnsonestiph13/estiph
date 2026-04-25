/**
 * ESTIF HOME ULTIMATE - PUSH SERVICE
 * Push notification service for mobile and web clients
 * Version: 2.0.0
 */

const webpush = require('web-push');
const User = require('../../models/User');
const Notification = require('../../models/Notification');
const { logger } = require('../../utils/logger');

class PushService {
    constructor() {
        this.isInitialized = false;
        this.vapidDetails = null;
    }

    initialize() {
        if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
            logger.warn('VAPID keys not configured, push service disabled');
            return false;
        }

        webpush.setVapidDetails(
            'mailto:' + (process.env.VAPID_EMAIL || 'noreply@estif-home.com'),
            process.env.VAPID_PUBLIC_KEY,
            process.env.VAPID_PRIVATE_KEY
        );

        this.isInitialized = true;
        this.vapidDetails = {
            publicKey: process.env.VAPID_PUBLIC_KEY,
            privateKey: process.env.VAPID_PRIVATE_KEY
        };

        logger.info('Push notification service initialized');
        return true;
    }

    async sendPushNotification(userId, title, body, data = {}) {
        if (!this.isInitialized) {
            logger.warn('Push service not initialized');
            return false;
        }

        try {
            const user = await User.findById(userId);
            if (!user?.pushSubscription || !user.pushEnabled) {
                return false;
            }

            const payload = JSON.stringify({
                title,
                body,
                data: {
                    ...data,
                    timestamp: Date.now(),
                    userId: user._id
                },
                icon: '/assets/icons/icon-192.png',
                badge: '/assets/icons/icon-72.png',
                vibrate: [200, 100, 200],
                actions: [
                    { action: 'view', title: 'View' },
                    { action: 'dismiss', title: 'Dismiss' }
                ]
            });

            await webpush.sendNotification(user.pushSubscription, payload);
            
            await Notification.create({
                userId,
                title,
                body,
                type: data.type || 'info',
                data,
                createdAt: Date.now()
            });

            logger.info(`Push notification sent to user ${userId}: ${title}`);
            return true;
        } catch (error) {
            if (error.statusCode === 410) {
                await User.findByIdAndUpdate(userId, { pushSubscription: null, pushEnabled: false });
                logger.info(`Removed invalid subscription for user ${userId}`);
            }
            logger.error(`Push notification failed: ${error.message}`);
            return false;
        }
    }

    async sendDeviceNotification(userId, deviceName, action, state) {
        const title = `Device ${action === 'on' ? 'Turned On' : 'Turned Off'}`;
        const body = `${deviceName} has been turned ${state ? 'ON' : 'OFF'}.`;
        
        return this.sendPushNotification(userId, title, body, {
            type: 'device',
            deviceName,
            action,
            state
        });
    }

    async sendAutomationNotification(userId, automationName, triggered = true) {
        const title = triggered ? 'Automation Triggered' : 'Automation Completed';
        const body = `${automationName} has been ${triggered ? 'triggered' : 'completed'}.`;
        
        return this.sendPushNotification(userId, title, body, {
            type: 'automation',
            automationName,
            triggered
        });
    }

    async sendAlertNotification(userId, alertType, message, data = {}) {
        const title = `Alert: ${alertType}`;
        
        return this.sendPushNotification(userId, title, message, {
            type: 'alert',
            alertType,
            ...data
        });
    }

    async sendEnergyAlert(userId, consumption, threshold) {
        const title = 'High Energy Usage Detected';
        const body = `Energy consumption has reached ${consumption.toFixed(1)} kWh, exceeding your threshold of ${threshold} kWh.`;
        
        return this.sendPushNotification(userId, title, body, {
            type: 'energy',
            consumption,
            threshold
        });
    }

    async sendSecurityAlert(userId, eventType, details) {
        const title = 'Security Alert';
        const body = `Security event detected: ${eventType}. ${details}`;
        
        return this.sendPushNotification(userId, title, body, {
            type: 'security',
            eventType,
            details
        });
    }

    async sendBackupNotification(userId, status, backupName) {
        const title = status === 'success' ? 'Backup Completed' : 'Backup Failed';
        const body = `${backupName} backup ${status === 'success' ? 'completed successfully' : 'failed'}.`;
        
        return this.sendPushNotification(userId, title, body, {
            type: 'backup',
            status,
            backupName
        });
    }

    async sendReportNotification(userId, reportType, period) {
        const title = `${reportType} Report Ready`;
        const body = `Your ${period} ${reportType.toLowerCase()} report is now available.`;
        
        return this.sendPushNotification(userId, title, body, {
            type: 'report',
            reportType,
            period
        });
    }

    async sendBulkNotifications(userIds, title, body, data = {}) {
        const results = [];
        for (const userId of userIds) {
            const result = await this.sendPushNotification(userId, title, body, data);
            results.push({ userId, success: result });
        }
        return results;
    }

    subscribeUser(userId, subscription) {
        return User.findByIdAndUpdate(userId, {
            pushSubscription: subscription,
            pushEnabled: true
        });
    }

    unsubscribeUser(userId) {
        return User.findByIdAndUpdate(userId, {
            pushSubscription: null,
            pushEnabled: false
        });
    }

    getVapidKeys() {
        return this.vapidDetails;
    }

    isEnabled() {
        return this.isInitialized;
    }

    getStatus() {
        return {
            initialized: this.isInitialized,
            vapidConfigured: !!process.env.VAPID_PUBLIC_KEY
        };
    }
}

module.exports = new PushService();