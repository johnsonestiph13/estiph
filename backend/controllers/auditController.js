/**
 * ESTIF HOME ULTIMATE - AUDIT CONTROLLER
 * Audit log management and retrieval
 * Version: 2.0.0
 * Author: Estifanos Yohannis
 */

const ActivityLog = require('../models/ActivityLog');
const User = require('../models/User');

// Get audit logs
exports.getAuditLogs = async (req, res) => {
    try {
        const { limit = 50, offset = 0, startDate, endDate, action, entityType } = req.query;

        const filter = { userId: req.user._id };
        
        if (startDate) {
            filter.createdAt = { $gte: new Date(startDate) };
        }
        if (endDate) {
            filter.createdAt = { ...filter.createdAt, $lte: new Date(endDate) };
        }
        if (action) {
            filter.action = action;
        }
        if (entityType) {
            filter.entityType = entityType;
        }

        const logs = await ActivityLog.find(filter)
            .sort({ createdAt: -1 })
            .skip(parseInt(offset))
            .limit(parseInt(limit));

        const total = await ActivityLog.countDocuments(filter);

        res.json({
            success: true,
            data: logs,
            pagination: {
                total,
                limit: parseInt(limit),
                offset: parseInt(offset),
                hasMore: offset + limit < total
            }
        });
    } catch (error) {
        console.error('Get audit logs error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Get user audit logs
exports.getUserAuditLogs = async (req, res) => {
    try {
        const { userId } = req.params;
        const { limit = 50, offset = 0 } = req.query;

        // Check permission (admin or self)
        if (userId !== req.user._id.toString() && req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Access denied'
            });
        }

        const logs = await ActivityLog.find({ userId })
            .sort({ createdAt: -1 })
            .skip(parseInt(offset))
            .limit(parseInt(limit));

        const total = await ActivityLog.countDocuments({ userId });

        res.json({
            success: true,
            data: logs,
            pagination: {
                total,
                limit: parseInt(limit),
                offset: parseInt(offset),
                hasMore: offset + limit < total
            }
        });
    } catch (error) {
        console.error('Get user audit logs error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Get home audit logs
exports.getHomeAuditLogs = async (req, res) => {
    try {
        const { homeId } = req.params;
        const { limit = 50, offset = 0 } = req.query;

        const logs = await ActivityLog.find({ homeId })
            .sort({ createdAt: -1 })
            .skip(parseInt(offset))
            .limit(parseInt(limit))
            .populate('userId', 'name email');

        const total = await ActivityLog.countDocuments({ homeId });

        res.json({
            success: true,
            data: logs,
            pagination: {
                total,
                limit: parseInt(limit),
                offset: parseInt(offset),
                hasMore: offset + limit < total
            }
        });
    } catch (error) {
        console.Error('Get home audit logs error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Get device audit logs
exports.getDeviceAuditLogs = async (req, res) => {
    try {
        const { deviceId } = req.params;
        const { limit = 50, offset = 0 } = req.query;

        const logs = await ActivityLog.find({ entityType: 'device', entityId: deviceId })
            .sort({ createdAt: -1 })
            .skip(parseInt(offset))
            .limit(parseInt(limit));

        const total = await ActivityLog.countDocuments({ entityType: 'device', entityId: deviceId });

        res.json({
            success: true,
            data: logs,
            pagination: {
                total,
                limit: parseInt(limit),
                offset: parseInt(offset),
                hasMore: offset + limit < total
            }
        });
    } catch (error) {
        console.error('Get device audit logs error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Get audit count
exports.getAuditCount = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;

        const filter = { userId: req.user._id };
        
        if (startDate) {
            filter.createdAt = { $gte: new Date(startDate) };
        }
        if (endDate) {
            filter.createdAt = { ...filter.createdAt, $lte: new Date(endDate) };
        }

        const total = await ActivityLog.countDocuments(filter);
        
        // Group by action
        const byAction = await ActivityLog.aggregate([
            { $match: filter },
            { $group: { _id: '$action', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
        ]);

        // Group by date
        const byDate = await ActivityLog.aggregate([
            { $match: filter },
            {
                $group: {
                    _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                    count: { $sum: 1 }
                }
            },
            { $sort: { _id: -1 } },
            { $limit: 30 }
        ]);

        res.json({
            success: true,
            data: {
                total,
                byAction,
                byDate
            }
        });
    } catch (error) {
        console.error('Get audit count error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Export audit logs
exports.exportAuditLogs = async (req, res) => {
    try {
        const { format = 'csv', startDate, endDate } = req.query;

        const filter = { userId: req.user._id };
        
        if (startDate) {
            filter.createdAt = { $gte: new Date(startDate) };
        }
        if (endDate) {
            filter.createdAt = { ...filter.createdAt, $lte: new Date(endDate) };
        }

        const logs = await ActivityLog.find(filter).sort({ createdAt: -1 });

        if (format === 'csv') {
            const csvRows = [
                ['Timestamp', 'User ID', 'Action', 'Entity Type', 'Entity ID', 'IP Address', 'User Agent', 'Details']
            ];

            for (const log of logs) {
                csvRows.push([
                    log.createdAt.toISOString(),
                    log.userId,
                    log.action,
                    log.entityType || '',
                    log.entityId || '',
                    log.ip || '',
                    log.userAgent || '',
                    JSON.stringify(log.details || {})
                ]);
            }

            const csv = csvRows.map(row => row.join(',')).join('\n');

            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', 'attachment; filename=audit_logs.csv');
            res.send(csv);
        } else {
            res.json({
                success: true,
                data: logs
            });
        }
    } catch (error) {
        console.error('Export audit logs error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Get audit categories
exports.getAuditCategories = async (req, res) => {
    try {
        const categories = [
            { name: 'Authentication', actions: ['login_success', 'login_failed', 'logout', 'password_changed'] },
            { name: 'Device Control', actions: ['device_on', 'device_off', 'device_toggled', 'auto_mode_enabled', 'auto_mode_disabled'] },
            { name: 'Home Management', actions: ['home_created', 'home_updated', 'home_deleted', 'member_added', 'member_removed'] },
            { name: 'Automation', actions: ['automation_triggered', 'automation_created', 'automation_updated', 'automation_deleted'] },
            { name: 'Settings', actions: ['settings_updated', 'profile_updated', 'theme_changed', 'language_changed'] },
            { name: 'Backup', actions: ['backup_created', 'backup_restored', 'backup_deleted'] },
            { name: 'Voice', actions: ['voice_command'] }
        ];

        res.json({
            success: true,
            data: categories
        });
    } catch (error) {
        console.error('Get audit categories error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Get audit statistics (admin)
exports.getAuditStats = async (req, res) => {
    try {
        const totalLogs = await ActivityLog.countDocuments();
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayLogs = await ActivityLog.countDocuments({ createdAt: { $gte: today } });

        const thisWeek = new Date();
        thisWeek.setDate(thisWeek.getDate() - thisWeek.getDay());
        thisWeek.setHours(0, 0, 0, 0);
        const weekLogs = await ActivityLog.countDocuments({ createdAt: { $gte: thisWeek } });

        const thisMonth = new Date();
        thisMonth.setDate(1);
        thisMonth.setHours(0, 0, 0, 0);
        const monthLogs = await ActivityLog.countDocuments({ createdAt: { $gte: thisMonth } });

        // Top users by activity
        const topUsers = await ActivityLog.aggregate([
            { $group: { _id: '$userId', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 10 },
            { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } }
        ]);

        // Top actions
        const topActions = await ActivityLog.aggregate([
            { $group: { _id: '$action', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 10 }
        ]);

        res.json({
            success: true,
            data: {
                total: totalLogs,
                today: todayLogs,
                thisWeek: weekLogs,
                thisMonth: monthLogs,
                topUsers: topUsers.map(t => ({ userId: t._id, name: t.user[0]?.name, count: t.count })),
                topActions
            }
        });
    } catch (error) {
        console.error('Get audit stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Get all audit logs (admin)
exports.getAllAuditLogs = async (req, res) => {
    try {
        const { limit = 100, offset = 0, startDate, endDate, userId, action } = req.query;

        const filter = {};
        
        if (startDate) {
            filter.createdAt = { $gte: new Date(startDate) };
        }
        if (endDate) {
            filter.createdAt = { ...filter.createdAt, $lte: new Date(endDate) };
        }
        if (userId) {
            filter.userId = userId;
        }
        if (action) {
            filter.action = action;
        }

        const logs = await ActivityLog.find(filter)
            .sort({ createdAt: -1 })
            .skip(parseInt(offset))
            .limit(parseInt(limit))
            .populate('userId', 'name email');

        const total = await ActivityLog.countDocuments(filter);

        res.json({
            success: true,
            data: logs,
            pagination: {
                total,
                limit: parseInt(limit),
                offset: parseInt(offset),
                hasMore: offset + limit < total
            }
        });
    } catch (error) {
        console.error('Get all audit logs error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Get sensitive audit logs (admin)
exports.getSensitiveAuditLogs = async (req, res) => {
    try {
        const sensitiveActions = [
            'password_changed',
            'two_factor_enabled',
            'two_factor_disabled',
            'admin_user_updated',
            'admin_user_deleted',
            'admin_user_suspended',
            'backup_restored',
            'settings_updated'
        ];

        const logs = await ActivityLog.find({ action: { $in: sensitiveActions } })
            .sort({ createdAt: -1 })
            .limit(100)
            .populate('userId', 'name email');

        res.json({
            success: true,
            data: logs
        });
    } catch (error) {
        console.error('Get sensitive audit logs error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Cleanup old audit logs (admin)
exports.cleanupOldAuditLogs = async (req, res) => {
    try {
        const { daysToKeep = 90 } = req.body;
        const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);

        const result = await ActivityLog.deleteMany({ createdAt: { $lt: cutoffDate } });

        await ActivityLog.create({
            userId: req.user._id,
            action: 'cleanup_old_audit_logs',
            details: { deleted: result.deletedCount, daysToKeep },
            ip: req.ip,
            userAgent: req.headers['user-agent']
        });

        res.json({
            success: true,
            message: `Cleaned up ${result.deletedCount} old audit logs`
        });
    } catch (error) {
        console.error('Cleanup old audit logs error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};