/**
 * ESTIF HOME ULTIMATE - BLUETOOTH SERVICE
 * Bluetooth device discovery and control
 * Version: 2.0.0
 */

const BluetoothDevice = require('../../models/BluetoothDevice');
const { logger } = require('../../utils/logger');

class BluetoothService {
    async pairDevice(userId, deviceId, name, address) {
        const existing = await BluetoothDevice.findOne({ address, userId });
        if (existing) throw new Error('Device already paired');
        
        return await BluetoothDevice.create({
            userId, deviceId, name, address,
            isPaired: true, lastSeen: Date.now()
        });
    }

    async unpairDevice(deviceId, userId) {
        return await BluetoothDevice.findOneAndDelete({ _id: deviceId, userId });
    }

    async getUserDevices(userId) {
        return await BluetoothDevice.find({ userId, isPaired: true });
    }

    async updateConnection(deviceId, isConnected) {
        return await BluetoothDevice.findByIdAndUpdate(deviceId, {
            isConnected, lastConnected: isConnected ? Date.now() : undefined
        });
    }

    async sendCommand(deviceId, command, params) {
        logger.info(`Bluetooth command to ${deviceId}: ${command}`, params);
        return { success: true };
    }
}

module.exports = new BluetoothService();