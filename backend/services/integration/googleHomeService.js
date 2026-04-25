/**
 * ESTIF HOME ULTIMATE - GOOGLE HOME SERVICE
 * Google Home / Google Assistant integration
 * Version: 2.0.0
 */

const Device = require('../../models/Device');
const { logger } = require('../../utils/logger');

class GoogleHomeService {
    async syncDevices(userId) {
        const devices = await Device.find({ ownerId: userId });
        
        return {
            requestId: Date.now().toString(),
            payload: {
                devices: devices.map(device => ({
                    id: device._id.toString(),
                    name: { name: device.name },
                    type: this.getDeviceType(device.type),
                    traits: this.getTraits(device.type),
                    willReportState: true
                }))
            }
        };
    }

    async execute(userId, execution) {
        const results = [];
        
        for (const command of execution.commands) {
            for (const device of command.devices) {
                const dbDevice = await Device.findOne({ _id: device.id, ownerId: userId });
                if (!dbDevice) continue;
                
                for (const exec of command.execution) {
                    switch (exec.command) {
                        case 'action.devices.commands.OnOff':
                            dbDevice.state = exec.params.on;
                            await dbDevice.save();
                            results.push({ ids: [device.id], status: 'SUCCESS', states: { on: dbDevice.state } });
                            break;
                    }
                }
            }
        }
        
        return { requestId: Date.now().toString(), payload: { commands: results } };
    }

    getDeviceType(type) {
        const types = { light: 'action.devices.types.LIGHT', fan: 'action.devices.types.FAN', ac: 'action.devices.types.THERMOSTAT' };
        return types[type] || 'action.devices.types.SWITCH';
    }

    getTraits(type) {
        return ['action.devices.traits.OnOff'];
    }
}

module.exports = new GoogleHomeService();