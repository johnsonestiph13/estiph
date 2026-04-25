/**
 * ESTIF HOME ULTIMATE - BACKUP CONTROLLER
 * Data backup and restore functionality
 * Version: 2.0.0
 * Author: Estifanos Yohannis
 */

const Backup = require('../models/Backup');
const Device = require('../models/Device');
const Home = require('../models/Home');
const Automation = require('../models/Automation');
const ActivityLog = require('../models/ActivityLog');
const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

// Get user backups
exports.getUserBackups = async (req, res) => {
    try {
        const { limit = 50, offset = 0 } = req.query;

        const backups = await Backup.find({ userId: req.user._id })
            .sort({ createdAt: -1 })
            .skip(parseInt(offset))
            .limit(parseInt(limit));

        const total = await Backup.countDocuments({ userId: req.user._id });

        res.json({
            success: true,
            data: backups,
            pagination: {
                total,
                limit: parseInt(limit),
                offset: parseInt(offset),
                hasMore: offset + limit < total
            }
        });
    } catch (error) {
        console.error('Get user backups error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Create backup
exports.createBackup = async (req, res) => {
    try {
        const { name, includeDevices = true, includeHomes = true, includeAutomations = true } = req.body;

        const backupData = {
            userId: req.user._id,
            name: name || `Backup_${new Date().toISOString()}`,
            createdAt: new Date(),
            data: {}
        };

        if (includeDevices) {
            backupData.data.devices = await Device.find({ ownerId: req.user._id });
        }

        if (includeHomes) {
            backupData.data.homes = await Home.find({ ownerId: req.user._id });
            // Also include homes where user is member
            const memberHomes = await Home.find({ 'members.userId': req.user._id });
            backupData.data.memberHomes = memberHomes;
        }

        if (includeAutomations) {
            backupData.data.automations = await Automation.find({ userId: req.user._id });
        }

        // Create backup record
        const backup = await Backup.create({
            userId: req.user._id,
            name: backupData.name,
            size: JSON.stringify(backupData.data).length,
            createdAt: backupData.createdAt
        });

        // In production, save to file or cloud storage
        const backupDir = path.join(__dirname, '../../backups');
        if (!fs.existsSync(backupDir)) {
            fs.mkdirSync(backupDir, { recursive: true });
        }

        const backupFile = path.join(backupDir, `${backup._id}.json`);
        fs.writeFileSync(backupFile, JSON.stringify(backupData, null, 2));

        await ActivityLog.create({
            userId: req.user._id,
            action: 'backup_created',
            details: { backupName: backup.name, size: backup.size },
            ip: req.ip,
            userAgent: req.headers['user-agent']
        });

        res.status(201).json({
            success: true,
            data: backup,
            message: 'Backup created successfully'
        });
    } catch (error) {
        console.error('Create backup error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Download backup
exports.downloadBackup = async (req, res) => {
    try {
        const { id } = req.params;

        const backup = await Backup.findOne({ _id: id, userId: req.user._id });
        if (!backup) {
            return res.status(404).json({
                success: false,
                message: 'Backup not found'
            });
        }

        const backupFile = path.join(__dirname, '../../backups', `${backup._id}.json`);
        
        if (!fs.existsSync(backupFile)) {
            return res.status(404).json({
                success: false,
                message: 'Backup file not found'
            });
        }

        res.download(backupFile, `${backup.name}.json`);
    } catch (error) {
        console.error('Download backup error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Restore backup
exports.restoreBackup = async (req, res) => {
    try {
        const { id } = req.params;
        const { overwrite = false } = req.body;

        const backup = await Backup.findOne({ _id: id, userId: req.user._id });
        if (!backup) {
            return res.status(404).json({
                success: false,
                message: 'Backup not found'
            });
        }

        const backupFile = path.join(__dirname, '../../backups', `${backup._id}.json`);
        
        if (!fs.existsSync(backupFile)) {
            return res.status(404).json({
                success: false,
                message: 'Backup file not found'
            });
        }

        const backupData = JSON.parse(fs.readFileSync(backupFile, 'utf8'));

        // Restore data
        if (backupData.data.devices && overwrite) {
            await Device.deleteMany({ ownerId: req.user._id });
            for (const device of backupData.data.devices) {
                delete device._id;
                device.ownerId = req.user._id;
                await Device.create(device);
            }
        }

        if (backupData.data.homes && overwrite) {
            await Home.deleteMany({ ownerId: req.user._id });
            for (const home of backupData.data.homes) {
                delete home._id;
                home.ownerId = req.user._id;
                await Home.create(home);
            }
        }

        if (backupData.data.automations && overwrite) {
            await Automation.deleteMany({ userId: req.user._id });
            for (const automation of backupData.data.automations) {
                delete automation._id;
                automation.userId = req.user._id;
                await Automation.create(automation);
            }
        }

        await ActivityLog.create({
            userId: req.user._id,
            action: 'backup_restored',
            details: { backupName: backup.name },
            ip: req.ip,
            userAgent: req.headers['user-agent']
        });

        res.json({
            success: true,
            message: 'Backup restored successfully'
        });
    } catch (error) {
        console.error('Restore backup error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Delete backup
exports.deleteBackup = async (req, res) => {
    try {
        const { id } = req.params;

        const backup = await Backup.findOneAndDelete({ _id: id, userId: req.user._id });
        if (!backup) {
            return res.status(404).json({
                success: false,
                message: 'Backup not found'
            });
        }

        const backupFile = path.join(__dirname, '../../backups', `${backup._id}.json`);
        if (fs.existsSync(backupFile)) {
            fs.unlinkSync(backupFile);
        }

        await ActivityLog.create({
            userId: req.user._id,
            action: 'backup_deleted',
            details: { backupName: backup.name },
            ip: req.ip,
            userAgent: req.headers['user-agent']
        });

        res.json({
            success: true,
            message: 'Backup deleted successfully'
        });
    } catch (error) {
        console.error('Delete backup error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Schedule backup
exports.scheduleBackup = async (req, res) => {
    try {
        const { frequency, time, enabled = true } = req.body;

        // In production, use a job scheduler like Bull or Agenda
        // For now, just save the schedule

        await User.findByIdAndUpdate(req.user._id, {
            backupSchedule: { frequency, time, enabled, lastRun: null, nextRun: calculateNextRun(frequency, time) }
        });

        await ActivityLog.create({
            userId: req.user._id,
            action: 'backup_schedule_updated',
            details: { frequency, time, enabled },
            ip: req.ip,
            userAgent: req.headers['user-agent']
        });

        res.json({
            success: true,
            message: 'Backup schedule updated'
        });
    } catch (error) {
        console.error('Schedule backup error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Get backup settings
exports.getBackupSettings = async (req, res) => {
    try {
        const user = await User.findById(req.user._id).select('backupSchedule');
        
        res.json({
            success: true,
            data: user.backupSchedule || { enabled: false }
        });
    } catch (error) {
        console.error('Get backup settings error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Update backup settings
exports.updateBackupSettings = async (req, res) => {
    try {
        const { autoBackup, backupFrequency, backupTime, maxBackups } = req.body;

        await User.findByIdAndUpdate(req.user._id, {
            backupSettings: { autoBackup, backupFrequency, backupTime, maxBackups }
        });

        await ActivityLog.create({
            userId: req.user._id,
            action: 'backup_settings_updated',
            details: { autoBackup, backupFrequency, backupTime, maxBackups },
            ip: req.ip,
            userAgent: req.headers['user-agent']
        });

        res.json({
            success: true,
            message: 'Backup settings updated'
        });
    } catch (error) {
        console.error('Update backup settings error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Get all backups (admin)
exports.getAllBackups = async (req, res) => {
    try {
        const { limit = 100, offset = 0 } = req.query;

        const backups = await Backup.find()
            .sort({ createdAt: -1 })
            .skip(parseInt(offset))
            .limit(parseInt(limit))
            .populate('userId', 'name email');

        const total = await Backup.countDocuments();

        res.json({
            success: true,
            data: backups,
            pagination: {
                total,
                limit: parseInt(limit),
                offset: parseInt(offset),
                hasMore: offset + limit < total
            }
        });
    } catch (error) {
        console.error('Get all backups error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Cleanup old backups (admin)
exports.cleanupOldBackups = async (req, res) => {
    try {
        const { daysToKeep = 90 } = req.body;
        const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);

        const oldBackups = await Backup.find({ createdAt: { $lt: cutoffDate } });
        
        for (const backup of oldBackups) {
            const backupFile = path.join(__dirname, '../../backups', `${backup._id}.json`);
            if (fs.existsSync(backupFile)) {
                fs.unlinkSync(backupFile);
            }
        }

        const result = await Backup.deleteMany({ createdAt: { $lt: cutoffDate } });

        await ActivityLog.create({
            userId: req.user._id,
            action: 'cleanup_old_backups',
            details: { deleted: result.deletedCount, daysToKeep },
            ip: req.ip,
            userAgent: req.headers['user-agent']
        });

        res.json({
            success: true,
            message: `Cleaned up ${result.deletedCount} old backups`
        });
    } catch (error) {
        console.error('Cleanup old backups error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Helper function to calculate next scheduled backup time
function calculateNextRun(frequency, time) {
    const now = new Date();
    const [hours, minutes] = time.split(':');
    const nextRun = new Date(now);
    nextRun.setHours(parseInt(hours), parseInt(minutes), 0, 0);

    if (frequency === 'daily') {
        if (nextRun <= now) {
            nextRun.setDate(nextRun.getDate() + 1);
        }
    } else if (frequency === 'weekly') {
        // Assume Sunday for weekly backups
        const daysUntilSunday = (7 - nextRun.getDay()) % 7;
        nextRun.setDate(nextRun.getDate() + daysUntilSunday);
        if (nextRun <= now) {
            nextRun.setDate(nextRun.getDate() + 7);
        }
    } else if (frequency === 'monthly') {
        nextRun.setDate(1);
        if (nextRun <= now) {
            nextRun.setMonth(nextRun.getMonth() + 1);
        }
    }

    return nextRun;
}