const cron = require('node-cron');
const Session = require('../models/Session');
const { logger } = require('../utils/logger');

// Run every hour at minute 30
const sessionCleanup = cron.schedule('30 * * * *', async () => {
    logger.info('Starting session cleanup job...');
    const startTime = Date.now();
    
    try {
        const now = new Date();
        
        const expiredSessions = await Session.deleteMany({
            expiresAt: { $lt: now }
        });
        
        const inactiveSessions = await Session.deleteMany({
            lastUsed: { $lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
            isActive: true
        });
        
        const orphanedSessions = await Session.aggregate([
            {
                $lookup: {
                    from: 'users',
                    localField: 'userId',
                    foreignField: '_id',
                    as: 'user'
                }
            },
            { $match: { user: { $size: 0 } } }
        ]);
        
        if (orphanedSessions.length > 0) {
            await Session.deleteMany({ _id: { $in: orphanedSessions.map(s => s._id) } });
        }
        
        const duration = Date.now() - startTime;
        logger.info(`Session cleanup completed in ${duration}ms - Expired:${expiredSessions.deletedCount}, Inactive:${inactiveSessions.deletedCount}, Orphaned:${orphanedSessions.length}`);
        
    } catch (error) {
        logger.error(`Session cleanup failed: ${error.message}`);
    }
}, { scheduled: true, timezone: 'Africa/Addis_Ababa' });

const startSessionCleanup = () => {
    sessionCleanup.start();
    logger.info('Session cleanup cron job started');
};

const stopSessionCleanup = () => {
    sessionCleanup.stop();
    logger.info('Session cleanup cron job stopped');
};

module.exports = { sessionCleanup, startSessionCleanup, stopSessionCleanup };