/**
 * ESTIF HOME ULTIMATE - NOTIFICATION CONTROLLER
 * Push notification management and delivery
 * Version: 2.0.0
 * Author: Estifanos Yohannis
 */

const Notification = require('../models/Notification');
const User = require('../models/User');
const ActivityLog = require('../models/ActivityLog');
const { sendPushNotification } = require('../services/communication/pushService');

// Get user notifications
exports.getUserNotifications = async (req, res) => {
    try {
        const { limit = 50, offset = 0, unreadOnly = false } = req.query;

        const filter = { userId: req.user._id };
        if (unreadOnly === 'true') {
            filter.read = false;
        }

        const notifications = await Notification.find(filter)
            .sort({ createdAt: -1 })
            .skip(parseInt(offset))
            .limit(parseInt(limit));

        const total = await Notification.countDocuments(filter);
        const unreadCount = await Notification.countDocuments({ userId: req.user._id, read: false });

        res.json({
            success: true,
            data: notifications,
            unreadCount,
            pagination: {
                total,
                limit: parseInt(limit),
                offset: parseInt(offset),
                hasMore: offset + limit < total
            }
        });
    } catch (error) {
        console.error('Get user notifications error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Get unread count
exports.getUnreadCount = async (req, res) => {
    try {
        const count = await Notification.countDocuments({ userId: req.user._id, read: false });

        res.json({
            success: true,
            data: { count }
        });
    } catch (error) {
        console.error('Get unread count error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Mark notification as read
exports.markAsRead = async (req, res) => {
    try {
        const { id } = req.params;

        const notification = await Notification.findOneAndUpdate(
            { _id: id, userId: req.user._id },
            { read: true, readAt: Date.now() },
            { new: true }
        );

        if (!notification) {
            return res.status(404).json({
                success: false,
                message: 'Notification not found'
            });
        }

        res.json({
            success: true,
            data: notification
        });
    } catch (error) {
        console.Error('Mark as read error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Mark all as read
exports.markAllAsRead = async (req, res) => {
    try {
        await Notification.updateMany(
            { userId: req.user._id, read: false },
            { read: true, readAt: Date.now() }
        );

        res.json({
            success: true,
            message: 'All notifications marked as read'
        });
    } catch (error) {
        console.error('Mark all as read error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Delete notification
exports.deleteNotification = async (req, res) => {
    try {
        const { id } = req.params;

        const notification = await Notification.findOneAndDelete({ _id: id, userId: req.user._id });
        if (!notification) {
            return res.status(404).json({
                success: false,
                message: 'Notification not found'
            });
        }

        res.json({
            success: true,
            message: 'Notification deleted'
        });
    } catch (error) {
        console.error('Delete notification error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Delete all notifications
exports.deleteAllNotifications = async (req, res) => {
    try {
        await Notification.deleteMany({ userId: req.user._id });

        res.json({
            success: true,
            message: 'All notifications deleted'
        });
    } catch (error) {
        console.error('Delete all notifications error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Subscribe to push notifications
exports.subscribePush = async (req, res) => {
    try {
        const { subscription } = req.body;

        await User.findByIdAndUpdate(req.user._id, {
            pushSubscription: subscription,
            pushEnabled: true
        });

        await ActivityLog.create({
            userId: req.user._id,
            action: 'push_subscribed',
            ip: req.ip,
            userAgent: req.headers['user-agent']
        });

        res.json({
            success: true,
            message: 'Push notifications enabled'
        });
    } catch (error) {
        console.error('Subscribe push error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Unsubscribe from push notifications
exports.unsubscribePush = async (req, res) => {
    try {
        await User.findByIdAndUpdate(req.user._id, {
            pushSubscription: null,
            pushEnabled: false
        });

        await ActivityLog.create({
            userId: req.user._id,
            action: 'push_unsubscribed',
            ip: req.ip,
            userAgent: req.headers['user-agent']
        });

        res.json({
            success: true,
            message: 'Push notifications disabled'
        });
    } catch (error) {
        console.error('Unsubscribe push error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Send test notification
exports.sendTestNotification = async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        
        const notification = await Notification.create({
            userId: req.user._id,
            title: 'Test Notification',
            body: 'This is a test notification from Estif Home Ultimate',
            type: 'info',
            data: { test: true }
        });

        if (user.pushEnabled && user.pushSubscription) {
            await sendPushNotification(user.pushSubscription, {
                title: 'Test Notification',
                body: 'This is a test notification',
                data: { notificationId: notification._id }
            });
        }

        res.json({
            success: true,
            message: 'Test notification sent'
        });
    } catch (error) {
        console.error('Send test notification error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Broadcast notification (admin only)
exports.broadcastNotification = async (req, res) => {
    try {
        const { title, body, type, targetUsers, targetHomes } = req.body;

        let filter = {};
        if (targetUsers && targetUsers.length > 0) {
            filter._id = { $in: targetUsers };
        }
        if (targetHomes && targetHomes.length > 0) {
            // This would need to be implemented with home membership lookup
        }

        const users = await User.find(filter);
        const notifications = [];

        for (const user of users) {
            const notification = await Notification.create({
                userId: user._id,
                title,
                body,
                type: type || 'info',
                data: { broadcast: true }
            });
            notifications.push(notification);

            if (user.pushEnabled && user.pushSubscription) {
                await sendPushNotification(user.pushSubscription, {
                    title,
                    body,
                    data: { notificationId: notification._id }
                });
            }
        }

        await ActivityLog.create({
            userId: req.user._id,
            action: 'broadcast_notification',
            ip: req.ip,
            userAgent: req.headers['user-agent'],
            details: { title, recipients: users.length }
        });

        res.json({
            success: true,
            message: `Broadcast sent to ${users.length} users`,
            data: { recipients: users.length }
        });
    } catch (error) {
        console.error('Broadcast notification error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Get notification templates (admin only)
exports.getNotificationTemplates = async (req, res) => {
    try {
        const templates = [
            {
                id: 'device_on',
                title: 'Device Turned On',
                body: '{{deviceName}} has been turned on',
                type: 'info'
            },
            {
                id: 'device_off',
                title: 'Device Turned Off',
                body: '{{deviceName}} has been turned off',
                type: 'info'
            },
            {
                id: 'automation_triggered',
                title: 'Automation Triggered',
                body: 'Automation "{{automationName}}" has been triggered',
                type: 'info'
            },
            {
                id: 'energy_alert',
                title: 'High Energy Usage',
                body: 'Energy consumption is {{percentage}}% above normal',
                type: 'warning'
            },
            {
                id: 'device_offline',
                title: 'Device Offline',
                body: '{{deviceName}} is offline',
                type: 'warning'
            },
            {
                id: 'firmware_update',
                title: 'Firmware Update Available',
                body: 'New firmware version {{version}} is available for {{deviceName}}',
                type: 'info'
            }
        ];

        res.json({
            success: true,
            data: templates
        });
    } catch (error) {
        console.error('Get notification templates error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Create notification template (admin only)
exports.createNotificationTemplate = async (req, res) => {
    try {
        const { id, title, body, type } = req.body;

        // In production, save to database
        // For now, just return success

        res.status(201).json({
            success: true,
            data: { id, title, body, type }
        });
    } catch (error) {
        console.error('Create notification template error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};