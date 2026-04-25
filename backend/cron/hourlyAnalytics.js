const cron = require('node-cron');
const User = require('../models/User');
const EnergyLog = require('../models/EnergyLog');
const ActivityLog = require('../models/ActivityLog');
const AnalyticsEvent = require('../models/AnalyticsEvent');
const { logger } = require('../utils/logger');

// Run every hour at minute 5
const hourlyAnalytics = cron.schedule('5 * * * *', async () => {
    logger.info('Starting hourly analytics job...');
    const startTime = Date.now();
    
    try {
        const endDate = new Date();
        const startDate = new Date(endDate);
        startDate.setHours(startDate.getHours() - 1);
        
        const users = await User.find({ isActive: true }).select('_id');
        
        let totalEnergy = 0;
        let totalActivities = 0;
        let activeUsers = 0;
        
        for (const user of users) {
            const [energyStats, activityCount] = await Promise.all([
                EnergyLog.aggregate([
                    { $match: { userId: user._id, timestamp: { $gte: startDate, $lte: endDate } } },
                    { $group: { _id: null, total: { $sum: '$energyConsumed' } } }
                ]),
                ActivityLog.countDocuments({ userId: user._id, createdAt: { $gte: startDate, $lte: endDate } })
            ]);
            
            const userEnergy = energyStats[0]?.total || 0;
            totalEnergy += userEnergy;
            totalActivities += activityCount;
            if (userEnergy > 0 || activityCount > 0) activeUsers++;
            
            await AnalyticsEvent.create({
                userId: user._id,
                eventType: 'hourly_analytics',
                category: 'system',
                action: 'aggregate',
                value: userEnergy,
                metadata: { activityCount, timestamp: startDate },
                timestamp: new Date()
            });
        }
        
        const duration = Date.now() - startTime;
        logger.info(`Hourly analytics completed in ${duration}ms - Energy:${totalEnergy.toFixed(2)}kWh, Activities:${totalActivities}, Active Users:${activeUsers}`);
        
    } catch (error) {
        logger.error(`Hourly analytics failed: ${error.message}`);
    }
}, { scheduled: true, timezone: 'Africa/Addis_Ababa' });

const startHourlyAnalytics = () => {
    hourlyAnalytics.start();
    logger.info('Hourly analytics cron job started');
};

const stopHourlyAnalytics = () => {
    hourlyAnalytics.stop();
    logger.info('Hourly analytics cron job stopped');
};

module.exports = { hourlyAnalytics, startHourlyAnalytics, stopHourlyAnalytics };