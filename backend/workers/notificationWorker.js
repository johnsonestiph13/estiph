const bull = require('bull');
const webpush = require('web-push');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { logger } = require('../utils/logger');

webpush.setVapidDetails(
    'mailto:' + process.env.VAPID_EMAIL,
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
);

const notificationQueue = new bull('notifications', process.env.REDIS_URL);

notificationQueue.process(async (job) => {
    const { userId, title, body, type, data } = job.data;
    
    try {
        const user = await User.findById(userId);
        if (!user || !user.pushSubscription) return;
        
        const notification = await Notification.create({
            userId, title, body, type, data, createdAt: new Date()
        });
        
        if (user.pushEnabled && user.pushSubscription) {
            await webpush.sendNotification(
                user.pushSubscription,
                JSON.stringify({ title, body, data: { notificationId: notification._id, ...data } })
            );
        }
        
        logger.info(`Notification sent to user ${userId}: ${title}`);
        return notification;
    } catch (error) {
        logger.error(`Notification failed to user ${userId}: ${error.message}`);
        throw error;
    }
});

const addNotificationJob = async (userId, title, body, type = 'info', data = {}, delay = 0) => {
    return notificationQueue.add({ userId, title, body, type, data }, { delay, attempts: 3 });
};

module.exports = { notificationQueue, addNotificationJob };