/**
 * ESTIF HOME ULTIMATE - HOMEKIT SERVICE
 * Apple HomeKit bridge integration
 * Version: 2.0.0
 */

const Device = require('../../models/Device');
const { logger } = require('../../utils/logger');

class HomeKitService {
    async getAccessories(userId) {
        const devices = await Device.find({ ownerId: userId });
        
        return devices.map(device => ({
            aid: device._id.toString(),
            iid: 1,
            type: this.getAccessoryType(device.type),
            services: this.getServices(device.type, device.state)
        }));
    }

    async setCharacteristic(userId, accessoryId, serviceType, value) {
        const device = await Device.findOne({ _id: accessoryId, ownerId: userId });
        if (!device) throw new Error('Device not found');
        
        if (serviceType === 'On') {
            device.state = value;
            await device.save();
        }
        
        return { characteristics: [{ aid: accessoryId, iid: 1, value: device.state }] };
    }

    getAccessoryType(type) {
        const types = { light: 8, fan: 11, ac: 24, tv: 33 };
        return types[type] || 8;
    }

    getServices(type, state) {
        return [{ type: '00000049-0000-1000-8000-0026BB765291', characteristics: [{ type: '00000025-0000-1000-8000-0026BB765291', value: state }] }];
    }
}

module.exports = new HomeKitService();