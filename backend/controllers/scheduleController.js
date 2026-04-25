/**
 * ESTIF HOME ULTIMATE - SCHEDULE CONTROLLER
 * Device scheduling logic for time-based automation
 * Version: 2.0.0
 * Author: Estifanos Yohannis
 */

const Schedule = require('../models/Schedule');
const Device = require('../models/Device');
const ActivityLog = require('../models/ActivityLog');
const scheduler = require('../services/schedulerService');

// Get user's schedules
exports.getUserSchedules = async (req, res) => {
    try {
        const { deviceId, enabled, page = 1, limit = 50 } = req.query;

        const filter = { userId: req.user._id };
        if (deviceId) filter.deviceId = deviceId;
        if (enabled !== undefined) filter.enabled = enabled === 'true';

        const skip = (page - 1) * limit;

        const schedules = await Schedule.find(filter)
            .populate('deviceId', 'name type')
            .skip(skip)
            .limit(parseInt(limit))
            .sort({ createdAt: -1 });

        const total = await Schedule.countDocuments(filter);

        res.json({
            success: true,
            data: schedules,
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('Get user schedules error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Create schedule
exports.createSchedule = async (req, res) => {
    try {
        const { name, deviceId, time, days, action, enabled } = req.body;

        // Verify device belongs to user
        const device = await Device.findOne({ _id: deviceId, ownerId: req.user._id });
        if (!device) {
            return res.status(404).json({
                success: false,
                message: 'Device not found'
            });
        }

        const schedule = await Schedule.create({
            name,
            userId: req.user._id,
            deviceId,
            time,
            days,
            action,
            enabled: enabled !== false
        });

        // Register schedule with scheduler service
        await scheduler.registerSchedule(schedule);

        await ActivityLog.create({
            userId: req.user._id,
            action: 'schedule_created',
            entityType: 'schedule',
            entityId: schedule._id,
            ip: req.ip,
            userAgent: req.headers['user-agent'],
            details: { scheduleName: schedule.name, deviceName: device.name }
        });

        res.status(201).json({
            success: true,
            data: schedule
        });
    } catch (error) {
        console.error('Create schedule error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Get schedule by ID
exports.getSchedule = async (req, res) => {
    try {
        const { id } = req.params;

        const schedule = await Schedule.findOne({ _id: id, userId: req.user._id })
            .populate('deviceId', 'name type room');

        if (!schedule) {
            return res.status(404).json({
                success: false,
                message: 'Schedule not found'
            });
        }

        res.json({
            success: true,
            data: schedule
        });
    } catch (error) {
        console.error('Get schedule error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Update schedule
exports.updateSchedule = async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        const schedule = await Schedule.findOneAndUpdate(
            { _id: id, userId: req.user._id },
            { ...updates, updatedAt: Date.now() },
            { new: true, runValidators: true }
        );

        if (!schedule) {
            return res.status(404).json({
                success: false,
                message: 'Schedule not found'
            });
        }

        // Re-register schedule with scheduler
        await scheduler.updateSchedule(schedule);

        await ActivityLog.create({
            userId: req.user._id,
            action: 'schedule_updated',
            entityType: 'schedule',
            entityId: schedule._id,
            ip: req.ip,
            userAgent: req.headers['user-agent'],
            details: { scheduleName: schedule.name, updates: Object.keys(updates) }
        });

        res.json({
            success: true,
            data: schedule
        });
    } catch (error) {
        console.error('Update schedule error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Delete schedule
exports.deleteSchedule = async (req, res) => {
    try {
        const { id } = req.params;

        const schedule = await Schedule.findOneAndDelete({ _id: id, userId: req.user._id });
        if (!schedule) {
            return res.status(404).json({
                success: false,
                message: 'Schedule not found'
            });
        }

        // Unregister from scheduler
        await scheduler.unregisterSchedule(schedule._id);

        await ActivityLog.create({
            userId: req.user._id,
            action: 'schedule_deleted',
            entityType: 'schedule',
            entityId: schedule._id,
            ip: req.ip,
            userAgent: req.headers['user-agent'],
            details: { scheduleName: schedule.name }
        });

        res.json({
            success: true,
            message: 'Schedule deleted successfully'
        });
    } catch (error) {
        console.error('Delete schedule error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Toggle schedule
exports.toggleSchedule = async (req, res) => {
    try {
        const { id } = req.params;
        const { enabled } = req.body;

        const schedule = await Schedule.findOneAndUpdate(
            { _id: id, userId: req.user._id },
            { enabled, updatedAt: Date.now() },
            { new: true }
        );

        if (!schedule) {
            return res.status(404).json({
                success: false,
                message: 'Schedule not found'
            });
        }

        if (enabled) {
            await scheduler.registerSchedule(schedule);
        } else {
            await scheduler.unregisterSchedule(schedule._id);
        }

        await ActivityLog.create({
            userId: req.user._id,
            action: enabled ? 'schedule_enabled' : 'schedule_disabled',
            entityType: 'schedule',
            entityId: schedule._id,
            ip: req.ip,
            userAgent: req.headers['user-agent'],
            details: { scheduleName: schedule.name }
        });

        res.json({
            success: true,
            data: schedule
        });
    } catch (error) {
        console.error('Toggle schedule error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Run schedule now
exports.runScheduleNow = async (req, res) => {
    try {
        const { id } = req.params;

        const schedule = await Schedule.findOne({ _id: id, userId: req.user._id })
            .populate('deviceId');

        if (!schedule) {
            return res.status(404).json({
                success: false,
                message: 'Schedule not found'
            });
        }

        // Execute schedule action
        const device = schedule.deviceId;
        
        if (device.autoMode && schedule.action !== 'auto') {
            return res.status(400).json({
                success: false,
                message: 'Device is in AUTO mode. Cannot execute manual schedule action.'
            });
        }

        let result;
        switch (schedule.action) {
            case 'on':
                device.state = true;
                await device.save();
                result = { state: true };
                break;
            case 'off':
                device.state = false;
                await device.save();
                result = { state: false };
                break;
            case 'toggle':
                device.state = !device.state;
                await device.save();
                result = { state: device.state };
                break;
            default:
                result = { error: 'Unknown action' };
        }

        await ActivityLog.create({
            userId: req.user._id,
            action: 'schedule_run_manually',
            entityType: 'schedule',
            entityId: schedule._id,
            ip: req.ip,
            userAgent: req.headers['user-agent'],
            details: { scheduleName: schedule.name, action: schedule.action, result }
        });

        res.json({
            success: true,
            message: 'Schedule executed successfully',
            data: result
        });
    } catch (error) {
        console.error('Run schedule now error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Get device schedules
exports.getDeviceSchedules = async (req, res) => {
    try {
        const { deviceId } = req.params;

        const schedules = await Schedule.find({ deviceId, userId: req.user._id })
            .sort({ time: 1 });

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