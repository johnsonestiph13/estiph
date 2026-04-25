/**
 * ESTIF HOME ULTIMATE - MATTER SERVICE
 * Matter protocol (formerly Project CHIP) integration
 * Version: 2.0.0
 */

const Device = require('../../models/Device');
const { logger } = require('../../utils/logger');

class MatterService {
    async commissionDevice(payload) {
        const { deviceId, vendorId, productId } = payload;
        
        const device = await Device.create({
            name: `Matter Device ${deviceId.slice(-6)}`,
            type: 'matter',
            metadata: {
                matterDeviceId: deviceId,
                vendorId,
                productId,
                commissionedAt: Date.now(),
                protocol: 'matter'
            }
        });
        
        logger.info(`Matter device commissioned: ${deviceId}`);
        return device;
    }

    async getDeviceList() {
        return await Device.find({ 'metadata.protocol': 'matter' });
    }

    async sendCommand(deviceId, cluster, command, params) {
        const device = await Device.findOne({ 'metadata.matterDeviceId': deviceId });
        if (!device) throw new Error('Device not found');
        
        if (cluster === 'onoff' && command === 'on') {
            device.state = true;
        } else if (cluster === 'onoff' && command === 'off') {
            device.state = false;
        }
        await device.save();
        
        return { success: true };
    }

    async getDeviceStatus(deviceId) {
        const device = await Device.findOne({ 'metadata.matterDeviceId': deviceId });
        return { online: device?.online || false, state: device?.state || false };
    }
}

module.exports = new MatterService();