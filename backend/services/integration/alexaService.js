/**
 * ESTIF HOME ULTIMATE - ALEXA SERVICE
 * Amazon Alexa smart home skill integration
 * Version: 2.0.0
 */

const Device = require('../../models/Device');
const { logger } = require('../../utils/logger');

class AlexaService {
    async handleDiscovery(userId) {
        const devices = await Device.find({ ownerId: userId });
        
        return {
            event: {
                header: { namespace: 'Alexa.Discovery', name: 'Discover.Response' },
                payload: {
                    endpoints: devices.map(device => ({
                        endpointId: device._id.toString(),
                        manufacturerName: 'Estif Home',
                        friendlyName: device.name,
                        description: `${device.type} device`,
                        displayCategories: this.getCategory(device.type),
                        capabilities: this.getCapabilities(device.type)
                    }))
                }
            }
        };
    }

    async handleControl(userId, endpointId, directive) {
        const device = await Device.findOne({ _id: endpointId, ownerId: userId });
        if (!device) throw new Error('Device not found');
        
        const { name, value } = directive.payload;
        let response;
        
        switch (name) {
            case 'turnOn':
                device.state = true;
                response = 'ON';
                break;
            case 'turnOff':
                device.state = false;
                response = 'OFF';
                break;
            default:
                throw new Error('Unsupported directive');
        }
        
        await device.save();
        
        return {
            context: { properties: [{ namespace: 'Alexa.PowerController', name: 'powerState', value: response }] },
            event: { header: { namespace: 'Alexa', name: 'Response' } }
        };
    }

    getCategory(type) {
        const categories = { light: 'LIGHT', fan: 'FAN', ac: 'THERMOSTAT', tv: 'TV' };
        return [categories[type] || 'OTHER'];
    }

    getCapabilities(type) {
        return [{ interface: 'Alexa.PowerController', type: 'AlexaInterface', version: '3' }];
    }
}

module.exports = new AlexaService();