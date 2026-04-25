/**
 * ESTIF HOME ULTIMATE - IFTTT SERVICE
 * IFTTT webhook integration
 * Version: 2.0.0
 */

const Device = require('../../models/Device');
const Webhook = require('../../models/Webhook');
const { logger } = require('../../utils/logger');
const crypto = require('crypto');

class IFTTTService {
    async handleWebhook(userId, trigger, data) {
        const webhook = await Webhook.findOne({ userId, type: 'ifttt', trigger });
        if (!webhook) throw new Error('Webhook not configured');
        
        const signature = crypto.createHmac('sha256', webhook.secret)
            .update(JSON.stringify(data))
            .digest('hex');
        
        const response = await fetch(webhook.url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-IFTTT-Signature': signature },
            body: JSON.stringify(data)
        });
        
        return response.ok;
    }

    async triggerDeviceAction(userId, deviceName, action) {
        const device = await Device.findOne({ name: deviceName, ownerId: userId });
        if (!device) throw new Error('Device not found');
        
        switch (action) {
            case 'turn_on':
                device.state = true;
                break;
            case 'turn_off':
                device.state = false;
                break;
            case 'toggle':
                device.state = !device.state;
                break;
        }
        await device.save();
        return { success: true, device: device.name, state: device.state };
    }

    async getDeviceStatus(userId, deviceName) {
        const device = await Device.findOne({ name: deviceName, ownerId: userId });
        return { state: device?.state || false };
    }

    generateWebhookUrl(userId, trigger) {
        const token = crypto.randomBytes(32).toString('hex');
        return `${process.env.API_URL}/api/webhooks/ifttt/${userId}/${trigger}?token=${token}`;
    }
}

module.exports = new IFTTTService();