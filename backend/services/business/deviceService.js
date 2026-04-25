/**
 * ESTIF HOME ULTIMATE - DEVICE SERVICE
 * Device management business logic
 * Version: 2.0.0
 */

const Device = require('../../models/Device');
const DeviceHistory = require('../../models/DeviceHistory');
const ActivityLog = require('../../models/ActivityLog');
const { publishMQTT } = require('../communication/mqttService');
const { logger } = require('../../utils/logger');

class DeviceService {
    async createDevice(userId, data) {
        const device = await Device.create({ ...data, ownerId: userId });
        
        await ActivityLog.create({ userId, action: 'device_created', entityType: 'device', entityId: device._id });
        return device;
    }

    async updateDevice(deviceId, userId, updates) {
        const device = await Device.findOne({ _id: deviceId, ownerId: userId });
        if (!device) throw new Error('Device not found');
        
        Object.assign(device, updates, { updatedAt: new Date() });
        await device.save();
        
        await ActivityLog.create({ userId, action: 'device_updated', entityType: 'device', entityId: device._id });
        return device;
    }

    async deleteDevice(deviceId, userId) {
        const device = await Device.findOne({ _id: deviceId, ownerId: userId });
        if (!device) throw new Error('Device not found');
        
        await device.deleteOne();
        await ActivityLog.create({ userId, action: 'device_deleted', entityType: 'device', entityId: deviceId });
        return true;
    }

    async toggleDevice(deviceId, userId, state) {
        const device = await Device.findOne({ _id: deviceId, ownerId: userId });
        if (!device) throw new Error('Device not found');
        if (device.autoMode) throw new Error('Device in AUTO mode');
        
        const oldState = device.state;
        device.state = state;
        device.lastStateChange = new Date();
        await device.save();
        
        await DeviceHistory.create({ deviceId, userId, action: state ? 'on' : 'off', source: 'manual', previousState: oldState, newState: state });
        await ActivityLog.create({ userId, action: state ? 'device_on' : 'device_off', entityType: 'device', entityId: device._id });
        
        await publishMQTT(`devices/${deviceId}/state`, { state, timestamp: Date.now() });
        
        return device;
    }

    async setAutoMode(deviceId, userId, enabled) {
        const device = await Device.findOne({ _id: deviceId, ownerId: userId });
        if (!device) throw new Error('Device not found');
        
        device.autoMode = enabled;
        await device.save();
        
        await ActivityLog.create({ userId, action: enabled ? 'auto_mode_enabled' : 'auto_mode_disabled', entityType: 'device', entityId: device._id });
        await publishMQTT(`devices/${deviceId}/auto`, { enabled, timestamp: Date.now() });
        
        return device;
    }

    async masterControl(userId, state) {
        const devices = await Device.find({ ownerId: userId, autoMode: false });
        
        for (const device of devices) {
            device.state = state;
            device.lastStateChange = new Date();
            await device.save();
        }
        
        await ActivityLog.create({ userId, action: state ? 'master_on' : 'master_off' });
        return devices.length;
    }

    async getUserDevices(userId, filters = {}) {
        const query = { ownerId: userId };
        if (filters.type) query.type = filters.type;
        if (filters.room) query.room = filters.room;
        if (filters.homeId) query.homeId = filters.homeId;
        if (filters.state !== undefined) query.state = filters.state;
        
        return await Device.find(query);
    }

    async getDeviceHistory(deviceId, userId, limit = 50) {
        return await DeviceHistory.find({ deviceId, userId }).sort({ createdAt: -1 }).limit(limit);
    }

    async getDeviceStats(deviceId, userId) {
        const device = await Device.findOne({ _id: deviceId, ownerId: userId });
        if (!device) throw new Error('Device not found');
        
        const history = await DeviceHistory.find({ deviceId, userId }).sort({ createdAt: -1 }).limit(100);
        const totalOnTime = history.reduce((sum, h) => sum + (h.duration || 0), 0);
        
        return {
            totalOnTime: (totalOnTime / 3600000).toFixed(2),
            totalEvents: history.length,
            lastStateChange: device.lastStateChange,
            currentState: device.state,
            autoMode: device.autoMode
        };
    }
}

module.exports = new DeviceService();