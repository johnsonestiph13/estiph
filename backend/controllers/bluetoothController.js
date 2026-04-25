/**
 * ESTIF HOME ULTIMATE - BLUETOOTH CONTROLLER
 * Bluetooth device management and communication
 * Version: 2.0.0
 * Author: Estifanos Yohannis
 */

const BluetoothDevice = require('../models/BluetoothDevice');
const ActivityLog = require('../models/ActivityLog');

// Get paired Bluetooth devices
exports.getPairedDevices = async (req, res) => {
    try {
        const devices = await BluetoothDevice.find({ userId: req.user._id });

        res.json({
            success: true,
            data: devices
        });
    } catch (error) {
        console.error('Get paired devices error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Start Bluetooth scan
exports.startScan = async (req, res) => {
    try {
        // In production, this would trigger a real Bluetooth scan
        // For now, return mock data
        
        const mockDevices = [
            { id: '00:11:22:33:44:55', name: 'ESP32 Light', rssi: -45 },
            { id: 'AA:BB:CC:DD:EE:FF', name: 'ESP32 Fan', rssi: -52 },
            { id: '11:22:33:44:55:66', name: 'Smart Sensor', rssi: -38 }
        ];

        await ActivityLog.create({
            userId: req.user._id,
            action: 'bluetooth_scan_started',
            ip: req.ip,
            userAgent: req.headers['user-agent']
        });

        res.json({
            success: true,
            data: mockDevices,
            message: 'Scan completed'
        });
    } catch (error) {
        console.error('Start scan error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Pair Bluetooth device
exports.pairDevice = async (req, res) => {
    try {
        const { deviceId, name, address } = req.body;

        // Check if already paired
        const existing = await BluetoothDevice.findOne({ address, userId: req.user._id });
        if (existing) {
            return res.status(400).json({
                success: false,
                message: 'Device already paired'
            });
        }

        const device = await BluetoothDevice.create({
            userId: req.user._id,
            deviceId,
            name,
            address,
            isPaired: true,
            lastSeen: Date.now()
        });

        await ActivityLog.create({
            userId: req.user._id,
            action: 'bluetooth_device_paired',
            details: { deviceName: name, address },
            ip: req.ip,
            userAgent: req.headers['user-agent']
        });

        res.status(201).json({
            success: true,
            data: device,
            message: 'Device paired successfully'
        });
    } catch (error) {
        console.error('Pair device error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Connect to Bluetooth device
exports.connectDevice = async (req, res) => {
    try {
        const { id } = req.params;

        const device = await BluetoothDevice.findOne({ _id: id, userId: req.user._id });
        if (!device) {
            return res.status(404).json({
                success: false,
                message: 'Device not found'
            });
        }

        // In production, establish actual Bluetooth connection
        device.isConnected = true;
        device.lastConnected = Date.now();
        await device.save();

        await ActivityLog.create({
            userId: req.user._id,
            action: 'bluetooth_device_connected',
            details: { deviceName: device.name },
            ip: req.ip,
            userAgent: req.headers['user-agent']
        });

        res.json({
            success: true,
            message: 'Device connected successfully'
        });
    } catch (error) {
        console.error('Connect device error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Disconnect Bluetooth device
exports.disconnectDevice = async (req, res) => {
    try {
        const { id } = req.params;

        const device = await BluetoothDevice.findOne({ _id: id, userId: req.user._id });
        if (!device) {
            return res.status(404).json({
                success: false,
                message: 'Device not found'
            });
        }

        device.isConnected = false;
        await device.save();

        await ActivityLog.create({
            userId: req.user._id,
            action: 'bluetooth_device_disconnected',
            details: { deviceName: device.name },
            ip: req.ip,
            userAgent: req.headers['user-agent']
        });

        res.json({
            success: true,
            message: 'Device disconnected successfully'
        });
    } catch (error) {
        console.error('Disconnect device error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Unpair Bluetooth device
exports.unpairDevice = async (req, res) => {
    try {
        const { id } = req.params;

        const device = await BluetoothDevice.findOneAndDelete({ _id: id, userId: req.user._id });
        if (!device) {
            return res.status(404).json({
                success: false,
                message: 'Device not found'
            });
        }

        await ActivityLog.create({
            userId: req.user._id,
            action: 'bluetooth_device_unpaired',
            details: { deviceName: device.name },
            ip: req.ip,
            userAgent: req.headers['user-agent']
        });

        res.json({
            success: true,
            message: 'Device unpaired successfully'
        });
    } catch (error) {
        console.error('Unpair device error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Get Bluetooth device status
exports.getDeviceStatus = async (req, res) => {
    try {
        const { id } = req.params;

        const device = await BluetoothDevice.findOne({ _id: id, userId: req.user._id });
        if (!device) {
            return res.status(404).json({
                success: false,
                message: 'Device not found'
            });
        }

        // In production, query actual device status
        const status = {
            isConnected: device.isConnected,
            batteryLevel: Math.floor(Math.random() * 100),
            signalStrength: Math.floor(Math.random() * 100),
            firmwareVersion: '1.0.0',
            lastSeen: device.lastSeen
        };

        res.json({
            success: true,
            data: status
        });
    } catch (error) {
        console.error('Get device status error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Send command to Bluetooth device
exports.sendCommand = async (req, res) => {
    try {
        const { id } = req.params;
        const { command, params } = req.body;

        const device = await BluetoothDevice.findOne({ _id: id, userId: req.user._id });
        if (!device) {
            return res.status(404).json({
                success: false,
                message: 'Device not found'
            });
        }

        if (!device.isConnected) {
            return res.status(400).json({
                success: false,
                message: 'Device is not connected'
            });
        }

        // In production, send actual command via Bluetooth
        // For now, simulate response

        await ActivityLog.create({
            userId: req.user._id,
            action: 'bluetooth_command_sent',
            details: { deviceName: device.name, command, params },
            ip: req.ip,
            userAgent: req.headers['user-agent']
        });

        res.json({
            success: true,
            message: 'Command sent successfully',
            data: { response: 'Command executed' }
        });
    } catch (error) {
        console.error('Send command error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Start OTA update
exports.startOTAUpdate = async (req, res) => {
    try {
        const { id } = req.params;
        const { firmwareUrl, version } = req.body;

        const device = await BluetoothDevice.findOne({ _id: id, userId: req.user._id });
        if (!device) {
            return res.status(404).json({
                success: false,
                message: 'Device not found'
            });
        }

        if (!device.isConnected) {
            return res.status(400).json({
                success: false,
                message: 'Device is not connected'
            });
        }

        // In production, initiate OTA update via Bluetooth

        await ActivityLog.create({
            userId: req.user._id,
            action: 'bluetooth_ota_started',
            details: { deviceName: device.name, version },
            ip: req.ip,
            userAgent: req.headers['user-agent']
        });

        res.json({
            success: true,
            message: 'OTA update started',
            data: { updateId: `ota_${Date.now()}` }
        });
    } catch (error) {
        console.error('Start OTA update error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};