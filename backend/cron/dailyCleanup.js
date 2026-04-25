const cron = require('node-cron');
const ActivityLog = require('../models/ActivityLog');
const DeviceHistory = require('../models/DeviceHistory');
const EnergyLog = require('../models/EnergyLog');
const Session = require('../models/Session');
const Notification = require('../models/Notification');
const { logger } = require('../utils/logger');

// Run daily at 2:00 AM
const dailyCleanup = cron.schedule('0 2 * * *', async () => {
    logger.info('Starting daily cleanup job...');
    const startTime = Date.now();
    
    try {
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        
        const [activityDeleted, historyDeleted, energyDeleted, sessionsDeleted, notificationsDeleted] = await Promise.all([
            ActivityLog.deleteMany({ createdAt: { $lt: thirtyDaysAgo } }),
            DeviceHistory.deleteMany({ createdAt: { $lt: thirtyDaysAgo } }),
            EnergyLog.deleteMany({ timestamp: { $lt: thirtyDaysAgo } }),
            Session.deleteMany({ expiresAt: { $lt: new Date() } }),
            Notification.deleteMany({ createdAt: { $lt: thirtyDaysAgo }, read: true })
        ]);
        
        const duration = Date.now() - startTime;
        logger.info(`Daily cleanup completed in ${duration}ms - Activity:${activityDeleted.deletedCount}, History:${historyDeleted.deletedCount}, Energy:${energyDeleted.deletedCount}, Sessions:${sessionsDeleted.deletedCount}, Notifications:${notificationsDeleted.deletedCount}`);
        
    } catch (error) {
        logger.error(`Daily cleanup failed: ${error.message}`);
    }
}, { scheduled: true, timezone: 'Africa/Addis_Ababa' });

const startDailyCleanup = () => {
    dailyCleanup.start();
    logger.info('Daily cleanup cron job started');
};

const stopDailyCleanup = () => {
    dailyCleanup.stop();
    logger.info('Daily cleanup cron job stopped');
};

module.exports = { dailyCleanup, startDailyCleanup, stopDailyCleanup };