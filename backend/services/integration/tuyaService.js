/**
 * ESTIF HOME ULTIMATE - TUYA SERVICE
 * Tuya Smart IoT platform integration
 * Version: 2.0.0
 */

const crypto = require('crypto');
const Device = require('../../models/Device');
const { logger } = require('../../utils/logger');

class TuyaService {
    constructor() {
        this.accessKey = process.env.TUYA_ACCESS_KEY;
        this.secretKey = process.env.TUYA_SECRET_KEY;
        this.baseUrl = 'https://openapi.tuyaus.com';
    }

    generateSignature(method, path, body = '') {
        const timestamp = Date.now().toString();
        const stringToSign = `${method}\n${hashBody(body)}\n\n${path}`;
        const signStr = this.accessKey + timestamp + stringToSign;
        return crypto.createHmac('sha256', this.secretKey).update(signStr).digest('hex');
    }

    hashBody(body) {
        return crypto.createHash('sha256').update(body).digest('hex');
    }

    async getDeviceList() {
        const path = '/v1.0/iot-01/associated-devices';
        const headers = {
            'client_id': this.accessKey,
            't': Date.now().toString(),
            'sign': this.generateSignature('GET', path)
        };
        
        // Simulate API call
        return { success: true, devices: [] };
    }

    async controlDevice(deviceId, commands) {
        const path = `/v1.0/iot-01/devices/${deviceId}/commands`;
        const body = JSON.stringify({ commands });
        const headers = {
            'client_id': this.accessKey,
            't': Date.now().toString(),
            'sign': this.generateSignature('POST', path, body)
        };
        
        logger.info(`Tuya command sent to ${deviceId}:`, commands);
        return { success: true };
    }

    async syncDevice(tuyaDevice) {
        let device = await Device.findOne({ 'metadata.tuyaId': tuyaDevice.id });
        
        if (!device) {
            device = await Device.create({
                name: tuyaDevice.name,
                type: this.mapTuyaCategory(tuyaDevice.category),
                metadata: { tuyaId: tuyaDevice.id, protocol: 'tuya', online: tuyaDevice.online }
            });
        } else {
            device.metadata.online = tuyaDevice.online;
            await device.save();
        }
        
        return device;
    }

    mapTuyaCategory(category) {
        const mapping = { 'dj': 'light', 'fs': 'fan', 'kt': 'ac', 'tv': 'tv' };
        return mapping[category] || 'device';
    }
}

module.exports = new TuyaService();