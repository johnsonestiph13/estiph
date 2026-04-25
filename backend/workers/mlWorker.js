const bull = require('bull');
const EnergyLog = require('../models/EnergyLog');
const Device = require('../models/Device');
const { logger } = require('../utils/logger');

const mlQueue = new bull('ml', process.env.REDIS_URL);

mlQueue.process(async (job) => {
    const { userId, predictionDays = 7 } = job.data;
    
    try {
        const energyLogs = await EnergyLog.find({ userId, timestamp: { $gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) } });
        const devices = await Device.find({ ownerId: userId });
        
        const dailyUsage = {};
        for (const log of energyLogs) {
            const day = log.timestamp.toISOString().split('T')[0];
            dailyUsage[day] = (dailyUsage[day] || 0) + log.energyConsumed;
        }
        
        const values = Object.values(dailyUsage);
        const n = values.length;
        const indices = Array.from({ length: n }, (_, i) => i);
        
        const sumX = indices.reduce((a, b) => a + b, 0);
        const sumY = values.reduce((a, b) => a + b, 0);
        const sumXY = indices.reduce((sum, x, i) => sum + x * values[i], 0);
        const sumX2 = indices.reduce((sum, x) => sum + x * x, 0);
        
        const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
        const intercept = (sumY - slope * sumX) / n;
        
        const predictions = [];
        for (let i = 1; i <= predictionDays; i++) {
            const predicted = Math.max(0, slope * (n + i - 1) + intercept);
            predictions.push({ day: i, predictedEnergy: predicted.toFixed(2), predictedCost: (predicted * 0.12).toFixed(2) });
        }
        
        const devicePredictions = [];
        for (const device of devices) {
            const deviceLogs = energyLogs.filter(log => log.deviceId.toString() === device._id.toString());
            const deviceAvg = deviceLogs.reduce((sum, log) => sum + log.energyConsumed, 0) / (deviceLogs.length || 1);
            devicePredictions.push({ deviceId: device._id, deviceName: device.name, predictedEnergy: (deviceAvg * predictionDays).toFixed(2) });
        }
        
        devicePredictions.sort((a, b) => parseFloat(b.predictedEnergy) - parseFloat(a.predictedEnergy));
        
        logger.info(`ML predictions generated for user ${userId}`);
        return { predictions, topConsumers: devicePredictions.slice(0, 5) };
    } catch (error) {
        logger.error(`ML prediction failed for user ${userId}: ${error.message}`);
        throw error;
    }
});

const addMLJob = async (userId, predictionDays = 7, delay = 0) => {
    return mlQueue.add({ userId, predictionDays }, { delay, attempts: 2 });
};

module.exports = { mlQueue, addMLJob };