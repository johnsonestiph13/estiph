const bull = require('bull');
const EnergyLog = require('../models/EnergyLog');
const ActivityLog = require('../models/ActivityLog');
const AnalyticsEvent = require('../models/AnalyticsEvent');
const { logger } = require('../utils/logger');

const analyticsQueue = new bull('analytics', process.env.REDIS_URL);

analyticsQueue.process(async (job) => {
    const { userId, period = 'day' } = job.data;
    
    try {
        const endDate = new Date();
        let startDate = new Date();
        
        if (period === 'day') startDate.setDate(startDate.getDate() - 1);
        else if (period === 'week') startDate.setDate(startDate.getDate() - 7);
        else if (period === 'month') startDate.setMonth(startDate.getMonth() - 1);
        else if (period === 'year') startDate.setFullYear(startDate.getFullYear() - 1);
        
        const [energyStats, activityStats] = await Promise.all([
            EnergyLog.aggregate([
                { $match: { userId, timestamp: { $gte: startDate, $lte: endDate } } },
                { $group: { _id: null, totalEnergy: { $sum: '$energyConsumed' }, avgEnergy: { $avg: '$energyConsumed' } } }
            ]),
            ActivityLog.aggregate([
                { $match: { userId, createdAt: { $gte: startDate, $lte: endDate } } },
                { $group: { _id: '$action', count: { $sum: 1 } } }
            ])
        ]);
        
        await AnalyticsEvent.create({
            userId, period, startDate, endDate,
            totalEnergy: energyStats[0]?.totalEnergy || 0,
            avgEnergy: energyStats[0]?.avgEnergy || 0,
            activityBreakdown: activityStats,
            createdAt: new Date()
        });
        
        logger.info(`Analytics processed for user ${userId} (${period})`);
        return { energyStats, activityStats };
    } catch (error) {
        logger.error(`Analytics failed for user ${userId}: ${error.message}`);
        throw error;
    }
});

const addAnalyticsJob = async (userId, period = 'day', delay = 0) => {
    return analyticsQueue.add({ userId, period }, { delay, attempts: 3 });
};

module.exports = { analyticsQueue, addAnalyticsJob };