/**
 * ESTIF HOME ULTIMATE - NOTIFICATION SERVICE
 * Notification management business logic
 * Version: 2.0.0
 */

const Notification = require('../../models/Notification');
const User = require('../../models/User');
const { sendPushNotification } = require('../communication/pushService');
const { logger } = require('../../utils/logger');

class NotificationService {
    async createNotification(userId, title, body, type = 'info', data = {}) {
        const notification = await Notification.create({
            userId, title, body, type, data, createdAt: new Date()
        });
        
        const user = await User.findById(userId);
        if (user?.pushEnabled) {
            await sendPushNotification(userId, title, body, data);
        }
        
        return notification;
    }

    async getUserNotifications(userId, limit = 50, offset = 0) {
        const [notifications, total] = await Promise.all([
            Notification.find({ userId }).sort({ createdAt: -1 }).skip(offset).limit(limit),
            Notification.countDocuments({ userId })
        ]);
        
        const unreadCount = await Notification.countDocuments({ userId, read: false });
        
        return { notifications, total, unreadCount };
    }

    async markAsRead(notificationId, userId) {
        const notification = await Notification.findOneAndUpdate(
            { _id: notificationId, userId },
            { read: true, readAt: new Date() },
            { new: true }
        );
        if (!notification) throw new Error('Notification not found');
        return notification;
    }

    async markAllAsRead(userId) {
        await Notification.updateMany({ userId, read: false }, { read: true, readAt: new Date() });
        return true;
    }

    async deleteNotification(notificationId, userId) {
        const notification = await Notification.findOneAndDelete({ _id: notificationId, userId });
        if (!notification) throw new Error('Notification not found');
        return true;
    }

    async deleteAllNotifications(userId) {
        await Notification.deleteMany({ userId });
        return true;
    }

    async sendDeviceNotification(userId, deviceName, action, state) {
        const title = `Device ${action === 'on' ? 'Turned On' : 'Turned Off'}`;
        const body = `${deviceName} has been turned ${state ? 'ON' : 'OFF'}.`;
        return await this.createNotification(userId, title, body, 'info', { type: 'device', deviceName, action, state });
    }

    async sendAutomationNotification(userId, automationName, triggered = true) {
        const title = triggered ? 'Automation Triggered' : 'Automation Completed';
        const body = `${automationName} has been ${triggered ? 'triggered' : 'completed'}.`;
        return await this.createNotification(userId, title, body, 'info', { type: 'automation', automationName });
    }

    async sendAlertNotification(userId, alertType, message, data = {}) {
        const title = `Alert: ${alertType}`;
        return await this.createNotification(userId, title, message, 'warning', { type: 'alert', alertType, ...data });
    }

    async sendEnergyAlert(userId, consumption, threshold) {
        const title = 'High Energy Usage Detected';
        const body = `Energy consumption has reached ${consumption.toFixed(1)} kWh, exceeding your threshold of ${threshold} kWh.`;
        return await this.createNotification(userId, title, body, 'warning', { type: 'energy', consumption, threshold });
    }
}

module.exports = new NotificationService();