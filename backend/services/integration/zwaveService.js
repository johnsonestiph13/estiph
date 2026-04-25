/**
 * ESTIF HOME ULTIMATE - Z-WAVE SERVICE
 * Z-Wave protocol device integration
 * Version: 2.0.0
 */

const Device = require('../../models/Device');
const { logger } = require('../../utils/logger');

class ZWaveService {
    async includeDevice() {
        return { nodeId: Math.floor(Math.random() * 100) + 1 };
    }

    async excludeDevice(nodeId) {
        return await Device.findOneAndDelete({ 'metadata.nodeId': nodeId });
    }

    async getNodes() {
        return await Device.find({ 'metadata.protocol': 'zwave' });
    }

    async setValue(nodeId, commandClass, value) {
        const device = await Device.findOne({ 'metadata.nodeId': nodeId });
        if (!device) throw new Error('Device not found');
        
        if (commandClass === 37) { // Switch Binary
            device.state = value;
            await device.save();
        }
        
        return { success: true };
    }
}

module.exports = new ZWaveService();