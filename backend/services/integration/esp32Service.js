/**
 * ESTIF HOME ULTIMATE - ESP32 SERVICE
 * ESP32 device management and communication
 * Version: 2.0.0
 */

const Device = require('../../models/Device');
const { publishMQTT } = require('../communication/mqttService');
const { logger } = require('../../utils/logger');

class ESP32Service {
    async registerESP32(data) {
        const { mac, ip, name, firmwareVersion } = data;
        
        let device = await Device.findOne({ mac });
        if (!device) {
            device = await Device.create({
                name: name || `ESP32_${mac.slice(-6)}`,
                type: 'esp32',
                mac,
                ip,
                firmwareVersion,
                online: true,
                lastSeen: Date.now(),
                metadata: { registeredAt: Date.now() }
            });
            logger.info(`ESP32 registered: ${mac}`);
        } else {
            device.ip = ip;
            device.online = true;
            device.lastSeen = Date.now();
            await device.save();
        }
        return device;
    }

    async updateHeartbeat(mac, sensors, devices) {
        const device = await Device.findOne({ mac });
        if (!device) return null;
        
        device.lastSeen = Date.now();
        device.online = true;
        
        if (sensors) {
            device.metadata = { ...device.metadata, sensors };
        }
        if (devices) {
            for (const [deviceId, state] of Object.entries(devices)) {
                await Device.findByIdAndUpdate(deviceId, { state, lastStateChange: Date.now() });
            }
        }
        await device.save();
        return device;
    }

    async sendCommand(mac, command, params = {}) {
        const topic = `estif/esp32/${mac}/command`;
        const payload = { command, ...params, timestamp: Date.now() };
        return await publishMQTT(topic, payload);
    }

    async getESP32Status(mac) {
        return await Device.findOne({ mac });
    }

    async getAllESP32Devices() {
        return await Device.find({ type: 'esp32' });
    }

    async updateFirmware(mac, firmwareUrl, version) {
        return await this.sendCommand(mac, 'update_firmware', { url: firmwareUrl, version });
    }

    async rebootESP32(mac) {
        return await this.sendCommand(mac, 'reboot');
    }
}

module.exports = new ESP32Service();