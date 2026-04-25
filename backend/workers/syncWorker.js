const bull = require('bull');
const Device = require('../models/Device');
const DeviceState = require('../models/DeviceState');
const { publishMQTT } = require('../config/mqtt');
const { logger } = require('../utils/logger');

const syncQueue = new bull('sync', process.env.REDIS_URL);

syncQueue.process(async (job) => {
    const { deviceId, userId, state, autoMode } = job.data;
    
    try {
        const device = await Device.findOne({ _id: deviceId, ownerId: userId });
        if (!device) throw new Error('Device not found');
        
        await DeviceState.findOneAndUpdate(
            { deviceId },
            { state, autoMode, lastCommandAt: new Date(), $inc: { syncCount: 1 } },
            { upsert: true, new: true }
        );
        
        await publishMQTT(`devices/${deviceId}/state`, { state, autoMode, timestamp: Date.now() });
        
        logger.info(`Device ${deviceId} synced for user ${userId}`);
        return { success: true };
    } catch (error) {
        logger.error(`Sync failed for device ${deviceId}: ${error.message}`);
        throw error;
    }
});

const addSyncJob = async (deviceId, userId, state, autoMode, delay = 0) => {
    return syncQueue.add({ deviceId, userId, state, autoMode }, { delay, attempts: 5, backoff: 2000 });
};

module.exports = { syncQueue, addSyncJob };