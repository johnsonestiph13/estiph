const cron = require('node-cron');
const User = require('../models/User');
const Device = require('../models/Device');
const EnergyLog = require('../models/EnergyLog');
const ActivityLog = require('../models/ActivityLog');
const { addReportJob } = require('../workers/reportWorker');
const { addNotificationJob } = require('../workers/notificationWorker');
const { logger } = require('../utils/logger');

// Run on 1st of each month at 4:00 AM
const monthlyReport = cron.schedule('0 4 1 * *', async () => {
    logger.info('Starting monthly report generation...');
    const startTime = Date.now();
    
    try {
        const endDate = new Date();
        const startDate = new Date(endDate);
        startDate.setMonth(startDate.getMonth() - 1);
        
        const users = await User.find({ isActive: true }).select('_id name email');
        let reportCount = 0;
        
        for (const user of users) {
            const [totalEnergy, totalActivities, deviceCount] = await Promise.all([
                EnergyLog.aggregate([
                    { $match: { userId: user._id, timestamp: { $gte: startDate, $lte: endDate } } },
                    { $group: { _id: null, total: { $sum: '$energyConsumed' } } }
                ]),
                ActivityLog.countDocuments({ userId: user._id, createdAt: { $gte: startDate, $lte: endDate } }),
                Device.countDocuments({ ownerId: user._id })
            ]);
            
            const energyUsed = totalEnergy[0]?.total || 0;
            const estimatedCost = energyUsed * 0.12;
            
            const reportData = {
                period: { start: startDate, end: endDate },
                summary: {
                    totalEnergy: energyUsed.toFixed(2),
                    totalCost: estimatedCost.toFixed(2),
                    totalActivities,
                    deviceCount
                },
                recommendations: generateRecommendations(energyUsed, deviceCount)
            };
            
            await addNotificationJob(
                user._id,
                'Monthly Energy Report Available',
                `Your energy consumption for last month was ${energyUsed.toFixed(2)} kWh. Click to view full report.`,
                'info',
                { reportData, type: 'monthly_report' }
            );
            
            reportCount++;
        }
        
        const duration = Date.now() - startTime;
        logger.info(`Monthly report generation completed in ${duration}ms - Reports: ${reportCount}`);
        
    } catch (error) {
        logger.error(`Monthly report generation failed: ${error.message}`);
    }
}, { scheduled: true, timezone: 'Africa/Addis_Ababa' });

const generateRecommendations = (energyUsed, deviceCount) => {
    const recommendations = [];
    
    if (energyUsed > 500) {
        recommendations.push('Consider enabling auto mode for high-energy devices');
    }
    if (deviceCount > 10 && energyUsed > 300) {
        recommendations.push('Some devices may be running unnecessarily. Review usage patterns.');
    }
    if (energyUsed < 100) {
        recommendations.push('Great job on energy conservation! Keep it up!');
    }
    
    recommendations.push('Schedule devices to turn off during non-usage hours for additional savings');
    return recommendations;
};

const startMonthlyReport = () => {
    monthlyReport.start();
    logger.info('Monthly report cron job started');
};

const stopMonthlyReport = () => {
    monthlyReport.stop();
    logger.info('Monthly report cron job stopped');
};

module.exports = { monthlyReport, startMonthlyReport, stopMonthlyReport };