/**
 * ESTIF HOME ULTIMATE - DEVICE CONTROLLER
 * Device management and control logic
 * Version: 2.0.0
 * Author: Estifanos Yohannis
 */

const Device = require('../models/Device');
const Home = require('../models/Home');
const ActivityLog = require('../models/ActivityLog');
const { publishMQTT } = require('../services/communication/mqttService');
const { broadcastWebSocket } = require('../services/communication/websocketService');

// Get user's devices
exports.getUserDevices = async (req, res) => {
    try {
        const { homeId, type, room, search, page = 1, limit = 50 } = req.query;

        const filter = { ownerId: req.user._id };

        if (homeId) filter.homeId = homeId;
        if (type) filter.type = type;
        if (room) filter.room = room;
        if (search) {
            filter.$or = [
                { name: { $regex: search, $options: 'i' } },
                { nameAm: { $regex: search, $options: 'i' } }
            ];
        }

        const skip = (page - 1) * limit;

        const devices = await Device.find(filter)
            .skip(skip)
            .limit(parseInt(limit))
            .sort({ createdAt: -1 });

        const total = await Device.countDocuments(filter);

        res.json({
            success: true,
            data: devices,
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('Get user devices error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Create device
exports.createDevice = async (req, res) => {
    try {
        const { name, nameAm, type, room, roomAm, gpio, power, homeId, metadata } = req.body;

        // Verify home ownership if provided
        if (homeId) {
            const home = await Home.findOne({ _id: homeId, ownerId: req.user._id });
            if (!home) {
                return res.status(404).json({
                    success: false,
                    message: 'Home not found or you are not the owner'
                });
            }
        }

        const device = await Device.create({
            name,
            nameAm,
            type,
            room,
            roomAm,
            gpio,
            power,
            homeId,
            metadata,
            ownerId: req.user._id,
            state: false,
            autoMode: false
        });

        await ActivityLog.create({
            userId: req.user._id,
            action: 'device_created',
            entityType: 'device',
            entityId: device._id,
            ip: req.ip,
            userAgent: req.headers['user-agent'],
            details: { deviceName: device.name, deviceType: device.type }
        });

        res.status(201).json({
            success: true,
            data: device
        });
    } catch (error) {
        console.error('Create device error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Get device by ID
exports.getDevice = async (req, res) => {
    try {
        const { id } = req.params;

        const device = await Device.findOne({ _id: id, ownerId: req.user._id });
        if (!device) {
            return res.status(404).json({
                success: false,
                message: 'Device not found'
            });
        }

        res.json({
            success: true,
            data: device
        });
    } catch (error) {
        console.error('Get device error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Update device
exports.updateDevice = async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        const device = await Device.findOneAndUpdate(
            { _id: id, ownerId: req.user._id },
            { ...updates, updatedAt: Date.now() },
            { new: true, runValidators: true }
        );

        if (!device) {
            return res.status(404).json({
                success: false,
                message: 'Device not found'
            });
        }

        await ActivityLog.create({
            userId: req.user._id,
            action: 'device_updated',
            entityType: 'device',
            entityId: device._id,
            ip: req.ip,
            userAgent: req.headers['user-agent'],
            details: { deviceName: device.name, updates: Object.keys(updates) }
        });

        // Broadcast update via WebSocket
        broadcastWebSocket('device_updated', device);

        res.json({
            success: true,
            data: device
        });
    } catch (error) {
        console.error('Update device error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Delete device
exports.deleteDevice = async (req, res) => {
    try {
        const { id } = req.params;

        const device = await Device.findOneAndDelete({ _id: id, ownerId: req.user._id });
        if (!device) {
            return res.status(404).json({
                success: false,
                message: 'Device not found'
            });
        }

        await ActivityLog.create({
            userId: req.user._id,
            action: 'device_deleted',
            entityType: 'device',
            entityId: device._id,
            ip: req.ip,
            userAgent: req.headers['user-agent'],
            details: { deviceName: device.name }
        });

        // Broadcast deletion via WebSocket
        broadcastWebSocket('device_deleted', { id: device._id });

        res.json({
            success: true,
            message: 'Device deleted successfully'
        });
    } catch (error) {
        console.error('Delete device error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Toggle device
exports.toggleDevice = async (req, res) => {
    try {
        const { id } = req.params;
        const { state } = req.body;

        const device = await Device.findOne({ _id: id, ownerId: req.user._id });
        if (!device) {
            return res.status(404).json({
                success: false,
                message: 'Device not found'
            });
        }

        if (device.autoMode) {
            return res.status(400).json({
                success: false,
                message: 'Device is in AUTO mode. Disable auto mode first.'
            });
        }

        device.state = state;
        device.lastStateChange = Date.now();
        await device.save();

        await ActivityLog.create({
            userId: req.user._id,
            action: state ? 'device_on' : 'device_off',
            entityType: 'device',
            entityId: device._id,
            ip: req.ip,
            userAgent: req.headers['user-agent'],
            details: { deviceName: device.name }
        });

        // Broadcast via WebSocket
        broadcastWebSocket('device_toggled', { deviceId: device._id, state: device.state });

        // Publish to MQTT
        await publishMQTT(`devices/${device._id}/state`, { state: device.state, timestamp: Date.now() });

        res.json({
            success: true,
            data: device
        });
    } catch (error) {
        console.error('Toggle device error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Set auto mode
exports.setAutoMode = async (req, res) => {
    try {
        const { id } = req.params;
        const { enabled } = req.body;

        const device = await Device.findOne({ _id: id, ownerId: req.user._id });
        if (!device) {
            return res.status(404).json({
                success: false,
                message: 'Device not found'
            });
        }

        device.autoMode = enabled;
        await device.save();

        await ActivityLog.create({
            userId: req.user._id,
            action: enabled ? 'auto_mode_enabled' : 'auto_mode_disabled',
            entityType: 'device',
            entityId: device._id,
            ip: req.ip,
            userAgent: req.headers['user-agent'],
            details: { deviceName: device.name }
        });

        broadcastWebSocket('auto_mode_changed', { deviceId: device._id, enabled: device.autoMode });

        res.json({
            success: true,
            data: device
        });
    } catch (error) {
        console.error('Set auto mode error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Master control
exports.masterControl = async (req, res) => {
    try {
        const { command } = req.params;
        const state = command === 'on';

        const devices = await Device.find({ ownerId: req.user._id, autoMode: false });
        
        let updatedCount = 0;
        for (const device of devices) {
            device.state = state;
            device.lastStateChange = Date.now();
            await device.save();
            updatedCount++;
        }

        await ActivityLog.create({
            userId: req.user._id,
            action: state ? 'master_on' : 'master_off',
            ip: req.ip,
            userAgent: req.headers['user-agent'],
            details: { devicesAffected: updatedCount }
        });

        broadcastWebSocket('master_control', { state, devicesAffected: updatedCount });

        res.json({
            success: true,
            message: `All devices turned ${state ? 'ON' : 'OFF'}`,
            data: { devicesAffected: updatedCount }
        });
    } catch (error) {
        console.error('Master control error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Get device groups
exports.getDeviceGroups = async (req, res) => {
    try {
        const groups = await Device.aggregate([
            { $match: { ownerId: req.user._id } },
            { $group: { _id: '$type', count: { $sum: 1 }, devices: { $push: '$$ROOT' } } }
        ]);

        res.json({
            success: true,
            data: groups
        });
    } catch (error) {
        console.error('Get device groups error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Create device group
exports.createDeviceGroup = async (req, res) => {
    try {
        const { name, deviceIds } = req.body;

        // Validate devices belong to user
        const devices = await Device.find({ _id: { $in: deviceIds }, ownerId: req.user._id });
        if (devices.length !== deviceIds.length) {
            return res.status(400).json({
                success: false,
                message: 'One or more devices not found or not owned by you'
            });
        }

        const group = {
            id: Date.now().toString(),
            name,
            deviceIds,
            createdAt: Date.now()
        };

        // Store group in user's metadata (or separate collection)
        await User.findByIdAndUpdate(req.user._id, {
            $push: { deviceGroups: group }
        });

        res.status(201).json({
            success: true,
            data: group
        });
    } catch (error) {
        console.error('Create device group error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Update device group
exports.updateDeviceGroup = async (req, res) => {
    try {
        const { groupId } = req.params;
        const { name, deviceIds } = req.body;

        const user = await User.findById(req.user._id);
        const groupIndex = user.deviceGroups.findIndex(g => g.id === groupId);

        if (groupIndex === -1) {
            return res.status(404).json({
                success: false,
                message: 'Group not found'
            });
        }

        if (name) user.deviceGroups[groupIndex].name = name;
        if (deviceIds) user.deviceGroups[groupIndex].deviceIds = deviceIds;
        user.deviceGroups[groupIndex].updatedAt = Date.now();

        await user.save();

        res.json({
            success: true,
            data: user.deviceGroups[groupIndex]
        });
    } catch (error) {
        console.error('Update device group error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Delete device group
exports.deleteDeviceGroup = async (req, res) => {
    try {
        const { groupId } = req.params;

        await User.findByIdAndUpdate(req.user._id, {
            $pull: { deviceGroups: { id: groupId } }
        });

        res.json({
            success: true,
            message: 'Group deleted successfully'
        });
    } catch (error) {
        console.error('Delete device group error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Add device to group
exports.addDeviceToGroup = async (req, res) => {
    try {
        const { groupId, deviceId } = req.params;

        const user = await User.findById(req.user._id);
        const group = user.deviceGroups.find(g => g.id === groupId);

        if (!group) {
            return res.status(404).json({
                success: false,
                message: 'Group not found'
            });
        }

        if (!group.deviceIds.includes(deviceId)) {
            group.deviceIds.push(deviceId);
            await user.save();
        }

        res.json({
            success: true,
            message: 'Device added to group'
        });
    } catch (error) {
        console.error('Add device to group error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Remove device from group
exports.removeDeviceFromGroup = async (req, res) => {
    try {
        const { groupId, deviceId } = req.params;

        const user = await User.findById(req.user._id);
        const group = user.deviceGroups.find(g => g.id === groupId);

        if (!group) {
            return res.status(404).json({
                success: false,
                message: 'Group not found'
            });
        }

        group.deviceIds = group.deviceIds.filter(id => id !== deviceId);
        await user.save();

        res.json({
            success: true,
            message: 'Device removed from group'
        });
    } catch (error) {
        console.error('Remove device from group error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Get device schedules
exports.getDeviceSchedules = async (req, res) => {
    try {
        const { id } = req.params;

        const schedules = await Schedule.find({ deviceId: id, userId: req.user._id });

        res.json({
            success: true,
            data: schedules
        });
    } catch (error) {
        console.error('Get device schedules error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Add device schedule
exports.addDeviceSchedule = async (req, res) => {
    try {
        const { id } = req.params;
        const { time, days, action, enabled } = req.body;

        const device = await Device.findOne({ _id: id, ownerId: req.user._id });
        if (!device) {
            return res.status(404).json({
                success: false,
                message: 'Device not found'
            });
        }

        const schedule = await Schedule.create({
            deviceId: id,
            userId: req.user._id,
            time,
            days,
            action,
            enabled: enabled !== false
        });

        res.status(201).json({
            success: true,
            data: schedule
        });
    } catch (error) {
        console.error('Add device schedule error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Delete device schedule
exports.deleteDeviceSchedule = async (req, res) => {
    try {
        const { id, scheduleId } = req.params;

        const schedule = await Schedule.findOneAndDelete({
            _id: scheduleId,
            deviceId: id,
            userId: req.user._id
        });

        if (!schedule) {
            return res.status(404).json({
                success: false,
                message: 'Schedule not found'
            });
        }

        res.json({
            success: true,
            message: 'Schedule deleted successfully'
        });
    } catch (error) {
        console.error('Delete device schedule error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Get device analytics
exports.getDeviceAnalytics = async (req, res) => {
    try {
        const { id } = req.params;
        const { period = 'day' } = req.query;

        const device = await Device.findOne({ _id: id, ownerId: req.user._id });
        if (!device) {
            return res.status(404).json({
                success: false,
                message: 'Device not found'
            });
        }

        // Get state change history from ActivityLog
        const startDate = new Date();
        if (period === 'day') startDate.setDate(startDate.getDate() - 1);
        else if (period === 'week') startDate.setDate(startDate.getDate() - 7);
        else if (period === 'month') startDate.setMonth(startDate.getMonth() - 1);
        else if (period === 'year') startDate.setFullYear(startDate.getFullYear() - 1);

        const history = await ActivityLog.find({
            entityType: 'device',
            entityId: device._id,
            action: { $in: ['device_on', 'device_off'] },
            createdAt: { $gte: startDate }
        }).sort({ createdAt: 1 });

        // Calculate statistics
        let totalOnTime = 0;
        let lastOnTime = null;

        for (const event of history) {
            if (event.action === 'device_on') {
                lastOnTime = event.createdAt;
            } else if (event.action === 'device_off' && lastOnTime) {
                totalOnTime += event.createdAt - lastOnTime;
                lastOnTime = null;
            }
        }

        if (lastOnTime) {
            totalOnTime += Date.now() - lastOnTime;
        }

        const stats = {
            totalOnTime: totalOnTime / (1000 * 60 * 60), // hours
            totalEvents: history.length,
            lastStateChange: device.lastStateChange,
            currentState: device.state,
            autoMode: device.autoMode,
            estimatedEnergyConsumption: (totalOnTime / (1000 * 60 * 60)) * device.power / 1000, // kWh
            estimatedCost: ((totalOnTime / (1000 * 60 * 60)) * device.power / 1000) * 0.12 // USD
        };

        res.json({
            success: true,
            data: stats,
            history
        });
    } catch (error) {
        console.error('Get device analytics error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Get device history
exports.getDeviceHistory = async (req, res) => {
    try {
        const { id } = req.params;
        const { limit = 50, offset = 0 } = req.query;

        const history = await ActivityLog.find({
            entityType: 'device',
            entityId: id,
            userId: req.user._id
        })
            .sort({ createdAt: -1 })
            .skip(parseInt(offset))
            .limit(parseInt(limit));

        const total = await ActivityLog.countDocuments({
            entityType: 'device',
            entityId: id,
            userId: req.user._id
        });

        res.json({
            success: true,
            data: history,
            pagination: {
                total,
                limit: parseInt(limit),
                offset: parseInt(offset),
                hasMore: offset + limit < total
            }
        });
    } catch (error) {
        console.error('Get device history error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Calibrate device
exports.calibrateDevice = async (req, res) => {
    try {
        const { id } = req.params;
        const { calibrationData } = req.body;

        const device = await Device.findOne({ _id: id, ownerId: req.user._id });
        if (!device) {
            return res.status(404).json({
                success: false,
                message: 'Device not found'
            });
        }

        device.metadata = { ...device.metadata, calibration: calibrationData, lastCalibrated: Date.now() };
        await device.save();

        await ActivityLog.create({
            userId: req.user._id,
            action: 'device_calibrated',
            entityType: 'device',
            entityId: device._id,
            ip: req.ip,
            userAgent: req.headers['user-agent'],
            details: { deviceName: device.name }
        });

        res.json({
            success: true,
            message: 'Device calibrated successfully',
            data: device
        });
    } catch (error) {
        console.error('Calibrate device error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};