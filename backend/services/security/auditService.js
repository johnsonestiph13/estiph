/**
 * ESTIF HOME ULTIMATE - AUDIT SERVICE
 * Security audit logging and event tracking
 * Version: 2.0.0
 */

const AuditLog = require('../../models/AuditLog');
const { logger } = require('../../utils/logger');

class AuditService {
    constructor() {
        this.auditQueue = [];
        this.isProcessing = false;
        this.batchSize = 50;
    }

    async log(event, data, options = {}) {
        const auditEntry = {
            userId: options.userId,
            action: event,
            resource: options.resource,
            resourceId: options.resourceId,
            oldValue: options.oldValue,
            newValue: options.newValue,
            ip: options.ip,
            userAgent: options.userAgent,
            severity: options.severity || 'low',
            status: options.status || 'success',
            details: data,
            createdAt: new Date()
        };
        
        this.auditQueue.push(auditEntry);
        this.processQueue();
        
        logger.info(`Audit log: ${event} by ${options.userId || 'system'}`);
        return auditEntry;
    }

    async processQueue() {
        if (this.isProcessing || this.auditQueue.length === 0) return;
        
        this.isProcessing = true;
        
        while (this.auditQueue.length > 0) {
            const batch = this.auditQueue.splice(0, this.batchSize);
            try {
                await AuditLog.insertMany(batch);
            } catch (error) {
                logger.error('Failed to save audit logs:', error);
                this.auditQueue.unshift(...batch);
                await this.delay(5000);
            }
        }
        
        this.isProcessing = false;
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async getAuditLogs(filters = {}, limit = 100, offset = 0) {
        const query = {};
        
        if (filters.userId) query.userId = filters.userId;
        if (filters.action) query.action = filters.action;
        if (filters.resource) query.resource = filters.resource;
        if (filters.severity) query.severity = filters.severity;
        if (filters.status) query.status = filters.status;
        if (filters.startDate) query.createdAt = { $gte: new Date(filters.startDate) };
        if (filters.endDate) query.createdAt = { ...query.createdAt, $lte: new Date(filters.endDate) };
        
        const [logs, total] = await Promise.all([
            AuditLog.find(query)
                .sort({ createdAt: -1 })
                .skip(offset)
                .limit(limit)
                .populate('userId', 'name email'),
            AuditLog.countDocuments(query)
        ]);
        
        return { logs, total };
    }

    async logLogin(userId, success, ip, userAgent) {
        return this.log('user_login', { success }, {
            userId,
            resource: 'auth',
            severity: success ? 'low' : 'medium',
            status: success ? 'success' : 'failure',
            ip,
            userAgent
        });
    }

    async logLogout(userId, ip, userAgent) {
        return this.log('user_logout', {}, {
            userId,
            resource: 'auth',
            severity: 'low',
            status: 'success',
            ip,
            userAgent
        });
    }

    async logPasswordChange(userId, ip, userAgent) {
        return this.log('password_change', {}, {
            userId,
            resource: 'user',
            severity: 'high',
            status: 'success',
            ip,
            userAgent
        });
    }

    async logDeviceControl(userId, deviceId, deviceName, action, state, ip, userAgent) {
        return this.log('device_control', { deviceName, action, state }, {
            userId,
            resource: 'device',
            resourceId: deviceId,
            severity: 'medium',
            status: 'success',
            ip,
            userAgent
        });
    }

    async logSettingsChange(userId, setting, oldValue, newValue, ip, userAgent) {
        return this.log('settings_change', { setting, oldValue, newValue }, {
            userId,
            resource: 'settings',
            severity: 'medium',
            status: 'success',
            ip,
            userAgent
        });
    }

    async logSecurityEvent(userId, eventType, details, severity = 'high', ip, userAgent) {
        return this.log('security_event', { eventType, details }, {
            userId,
            resource: 'security',
            severity,
            status: 'warning',
            ip,
            userAgent
        });
    }

    async logAdminAction(adminId, targetUserId, action, details, ip, userAgent) {
        return this.log('admin_action', { targetUserId, action, details }, {
            userId: adminId,
            resource: 'admin',
            severity: 'high',
            status: 'success',
            ip,
            userAgent
        });
    }

    async getSecurityAudit(userId, days = 30) {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        
        const logs = await AuditLog.find({
            userId,
            severity: { $in: ['high', 'critical'] },
            createdAt: { $gte: startDate }
        }).sort({ createdAt: -1 });
        
        const summary = {
            totalEvents: logs.length,
            byType: {},
            bySeverity: {},
            recentEvents: logs.slice(0, 10)
        };
        
        logs.forEach(log => {
            summary.byType[log.action] = (summary.byType[log.action] || 0) + 1;
            summary.bySeverity[log.severity] = (summary.bySeverity[log.severity] || 0) + 1;
        });
        
        return summary;
    }

    async cleanupOldLogs(daysToKeep = 90) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
        
        const result = await AuditLog.deleteMany({ createdAt: { $lt: cutoffDate } });
        logger.info(`Cleaned up ${result.deletedCount} old audit logs`);
        return result.deletedCount;
    }

    async exportAuditLogs(filters, format = 'json') {
        const { logs } = await this.getAuditLogs(filters, 10000, 0);
        
        if (format === 'json') {
            return JSON.stringify(logs, null, 2);
        }
        
        if (format === 'csv') {
            const headers = ['Timestamp', 'User ID', 'Action', 'Resource', 'Resource ID', 'Severity', 'Status', 'IP', 'Details'];
            const rows = logs.map(log => [
                log.createdAt.toISOString(),
                log.userId?._id || log.userId,
                log.action,
                log.resource,
                log.resourceId,
                log.severity,
                log.status,
                log.ip,
                JSON.stringify(log.details)
            ]);
            return [headers, ...rows].map(row => row.join(',')).join('\n');
        }
        
        return null;
    }

    getAuditStats() {
        return {
            queueSize: this.auditQueue.length,
            isProcessing: this.isProcessing,
            batchSize: this.batchSize
        };
    }
}

module.exports = new AuditService();