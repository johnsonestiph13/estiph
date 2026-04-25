const bull = require('bull');
const Device = require('../models/Device');
const EnergyLog = require('../models/EnergyLog');
const { logger } = require('../utils/logger');

const energyQueue = new bull('energy', process.env.REDIS_URL);

energyQueue.process(async (job) => {
    const { userId, deviceId, interval = 60000 } = job.data;
    
    try {
        const devices = deviceId ? await Device.find({ _id: deviceId, ownerId: userId }) : await Device.find({ ownerId: userId });
        
        for (const device of devices) {
            const power = device.state ? device.power : 0;
            const energyConsumed = (power * interval) / (1000 * 60 * 60);
            const runtime = device.state ? interval : 0;
            const cost = energyConsumed * 0.12;
            
            await EnergyLog.create({
                userId, deviceId: device._id, homeId: device.homeId,
                energyConsumed, power, runtime, cost, timestamp: new Date()
            });
        }
        
        logger.info(`Energy data logged for user ${userId}, ${devices.length} devices`);
        return { devicesProcessed: devices.length };
    } catch (error) {
        logger.error(`Energy logging failed for user ${userId}: ${error.message}`);
        throw error;
    }
});

const addEnergyJob = async (userId, deviceId = null, interval = 60000, delay = 0) => {
    return energyQueue.add({ userId, deviceId, interval }, { delay, repeat: { cron: '*/5 * * * *' } });
};

module.exports = { energyQueue, addEnergyJob };