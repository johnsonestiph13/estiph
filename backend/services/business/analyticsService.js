/**
 * ESTIF HOME ULTIMATE - ANALYTICS SERVICE
 * Analytics and reporting business logic
 * Version: 2.0.0
 */

const Device = require('../../models/Device');
const EnergyLog = require('../../models/EnergyLog');
const ActivityLog = require('../../models/ActivityLog');
const { logger } = require('../../utils/logger');

class AnalyticsService {
    async getDashboardStats(userId) {
        const devices = await Device.find({ ownerId: userId });
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        
        const energyLogs = await EnergyLog.find({ userId, timestamp: { $gte: thirtyDaysAgo } });
        const totalEnergy = energyLogs.reduce((sum, l) => sum + l.energyConsumed, 0);
        
        const activities = await ActivityLog.find({ userId, createdAt: { $gte: thirtyDaysAgo } });
        
        return {
            devices: {
                total: devices.length,
                active: devices.filter(d => d.state).length,
                autoMode: devices.filter(d => d.autoMode).length,
                online: devices.filter(d => d.online).length
            },
            energy: {
                total: totalEnergy.toFixed(2),
                cost: (totalEnergy * 0.12).toFixed(2),
                average: (totalEnergy / 30).toFixed(2)
            },
            activity: {
                total: activities.length,
                averagePerDay: (activities.length / 30).toFixed(1)
            }
        };
    }

    async getUsageTrends(userId, days = 30) {
        const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
        
        const trends = await EnergyLog.aggregate([
            { $match: { userId, timestamp: { $gte: startDate } } },
            { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } }, energy: { $sum: '$energyConsumed' } } },
            { $sort: { _id: 1 } }
        ]);
        
        const activities = await ActivityLog.aggregate([
            { $match: { userId, createdAt: { $gte: startDate } } },
            { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
            { $sort: { _id: 1 } }
        ]);
        
        return { energyTrends: trends, activityTrends: activities };
    }

    async getDeviceAnalytics(userId) {
        const devices = await Device.find({ ownerId: userId });
        const analytics = [];
        
        for (const device of devices) {
            const energyLogs = await EnergyLog.find({ userId, deviceId: device._id });
            const activityLogs = await ActivityLog.find({ userId, entityType: 'device', entityId: device._id });
            
            const totalEnergy = energyLogs.reduce((sum, l) => sum + l.energyConsumed, 0);
            const totalRuntime = energyLogs.reduce((sum, l) => sum + l.runtime, 0);
            
            analytics.push({
                deviceId: device._id,
                deviceName: device.name,
                deviceType: device.type,
                totalEnergy: totalEnergy.toFixed(2),
                totalRuntime: (totalRuntime / 3600000).toFixed(2),
                activityCount: activityLogs.length,
                avgEnergyPerDay: (totalEnergy / 30).toFixed(2)
            });
        }
        
        return analytics.sort((a, b) => b.totalEnergy - a.totalEnergy);
    }

    async getHourlyPattern(userId) {
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        
        const hourlyPattern = await EnergyLog.aggregate([
            { $match: { userId, timestamp: { $gte: sevenDaysAgo } } },
            { $group: { _id: { hour: { $hour: '$timestamp' } }, totalEnergy: { $sum: '$energyConsumed' } } },
            { $sort: { '_id.hour': 1 } }
        ]);
        
        const pattern = Array(24).fill(0);
        for (const item of hourlyPattern) {
            pattern[item._id.hour] = item.totalEnergy;
        }
        
        const peakHour = pattern.indexOf(Math.max(...pattern));
        
        return { hourlyPattern: pattern, peakHour };
    }

    async exportAnalytics(userId, format = 'json') {
        const devices = await Device.find({ ownerId: userId });
        const energyLogs = await EnergyLog.find({ userId });
        const activities = await ActivityLog.find({ userId });
        
        const data = {
            exportedAt: new Date().toISOString(),
            devices: devices.map(d => ({ name: d.name, type: d.type, room: d.room, power: d.power, autoMode: d.autoMode })),
            energy: energyLogs.map(l => ({ timestamp: l.timestamp, deviceId: l.deviceId, energy: l.energyConsumed, cost: l.cost })),
            activity: activities.map(a => ({ timestamp: a.createdAt, action: a.action, details: a.details }))
        };
        
        if (format === 'json') return JSON.stringify(data, null, 2);
        
        if (format === 'csv') {
            const rows = [['Type', 'Name', 'Value']];
            rows.push(['Devices', devices.length, '']);
            devices.forEach(d => rows.push(['Device', d.name, `${d.type} - ${d.power}W`]));
            rows.push(['Total Energy', energyLogs.reduce((s, l) => s + l.energyConsumed, 0).toFixed(2), 'kWh']);
            rows.push(['Total Activities', activities.length, '']);
            return rows.map(r => r.join(',')).join('\n');
        }
        
        return null;
    }
}

module.exports = new AnalyticsService();