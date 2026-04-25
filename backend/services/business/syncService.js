/**
 * ESTIF HOME ULTIMATE - SYNC SERVICE
 * Data synchronization between devices and cloud
 * Version: 2.0.0
 */

const Device = require('../../models/Device');
const DeviceState = require('../../models/DeviceState');
const { publishMQTT } = require('../communication/mqttService');
const { logger } = require('../../utils/logger');

class SyncService {
    async syncDeviceState(deviceId, state, source = 'cloud') {
        const device = await Device.findById(deviceId);
        if (!device) throw new Error('Device not found');
        
        const oldState = device.state;
        device.state = state;
        device.lastStateChange = new Date();
        await device.save();
        
        await DeviceState.findOneAndUpdate(
            { deviceId },
            { state, lastSync: new Date(), source },
            { upsert: true }
        );
        
        if (source === 'cloud') {
            await publishMQTT(`devices/${deviceId}/sync`, { state, timestamp: Date.now() });
        }
        
        logger.info(`Device ${deviceId} synced: ${oldState} -> ${state} (${source})`);
        return device;
    }

    async syncDeviceAutoMode(deviceId, autoMode, source = 'cloud') {
        const device = await Device.findById(deviceId);
        if (!device) throw new Error('Device not found');
        
        device.autoMode = autoMode;
        await device.save();
        
        await DeviceState.findOneAndUpdate(
            { deviceId },
            { autoMode, lastSync: new Date(), source },
            { upsert: true }
        );
        
        if (source === 'cloud') {
            await publishMQTT(`devices/${deviceId}/sync/auto`, { autoMode, timestamp: Date.now() });
        }
        
        return device;
    }

    async syncAllDevices(userId) {
        const devices = await Device.find({ ownerId: userId });
        const results = [];
        
        for (const device of devices) {
            const state = await DeviceState.findOne({ deviceId: device._id });
            if (state && state.lastSync > device.updatedAt) {
                device.state = state.state;
                device.autoMode = state.autoMode;
                await device.save();
                results.push({ deviceId: device._id, synced: true });
            }
        }
        
        return results;
    }

    async getPendingSync(userId) {
        const devices = await Device.find({ ownerId: userId });
        const pending = [];
        
        for (const device of devices) {
            const state = await DeviceState.findOne({ deviceId: device._id });
            if (!state || state.lastSync < device.updatedAt) {
                pending.push(device);
            }
        }
        
        return pending;
    }

    async resolveConflict(deviceId, cloudState, localState) {
        const device = await Device.findById(deviceId);
        if (!device) throw new Error('Device not found');
        
        // Last write wins
        if (cloudState.timestamp > localState.timestamp) {
            device.state = cloudState.state;
            device.autoMode = cloudState.autoMode;
        } else {
            device.state = localState.state;
            device.autoMode = localState.autoMode;
        }
        
        await device.save();
        
        await DeviceState.findOneAndUpdate(
            { deviceId },
            { state: device.state, autoMode: device.autoMode, lastSync: new Date(), resolved: true },
            { upsert: true }
        );
        
        return device;
    }
}

module.exports = new SyncService();