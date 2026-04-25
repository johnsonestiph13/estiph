/**
 * ESTIF HOME ULTIMATE - ENERGY SERVICE
 * Energy monitoring and analytics
 * Version: 2.0.0
 */

const EnergyLog = require('../../models/EnergyLog');
const Device = require('../../models/Device');
const { logger } = require('../../utils/logger');

class EnergyService {
    async logEnergy(userId, deviceId, power, runtime) {
        const energyConsumed = (power * runtime) / (1000 * 60 * 60);
        const cost = energyConsumed * 0.12;
        
        return await EnergyLog.create({
            userId, deviceId, energyConsumed, power, runtime, cost, timestamp: new Date()
        });
    }

    async getEnergyUsage(userId, startDate, endDate, interval = 'day') {
        const match = { userId, timestamp: { $gte: startDate, $lte: endDate } };
        
        let groupBy;
        switch (interval) {
            case 'hour': groupBy = { $hour: '$timestamp' }; break;
            case 'day': groupBy = { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } }; break;
            case 'month': groupBy = { $dateToString: { format: '%Y-%m', date: '$timestamp' } }; break;
            default: groupBy = { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } };
        }
        
        const data = await EnergyLog.aggregate([
            { $match },
            { $group: { _id: groupBy, totalEnergy: { $sum: '$energyConsumed' }, totalCost: { $sum: '$cost' } } },
            { $sort: { _id: 1 } }
        ]);
        
        const totalEnergy = data.reduce((sum, d) => sum + d.totalEnergy, 0);
        const totalCost = data.reduce((sum, d) => sum + d.totalCost, 0);
        
        return { data, totalEnergy, totalCost };
    }

    async getDeviceEnergyUsage(userId, deviceId, startDate, endDate) {
        return await EnergyLog.find({ userId, deviceId, timestamp: { $gte: startDate, $lte: endDate } });
    }

    async getEnergySavings(userId, currentPeriod, previousPeriod) {
        const currentUsage = await this.getEnergyUsage(userId, currentPeriod.start, currentPeriod.end);
        const previousUsage = await this.getEnergyUsage(userId, previousPeriod.start, previousPeriod.end);
        
        const saved = previousUsage.totalEnergy - currentUsage.totalEnergy;
        const percentage = previousUsage.totalEnergy > 0 ? (saved / previousUsage.totalEnergy) * 100 : 0;
        
        return { saved: Math.max(0, saved), percentage: Math.max(0, percentage) };
    }

    async getPeakHours(userId, days = 7) {
        const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
        const endDate = new Date();
        
        const hourlyUsage = await EnergyLog.aggregate([
            { $match: { userId, timestamp: { $gte: startDate, $lte: endDate } } },
            { $group: { _id: { hour: { $hour: '$timestamp' } }, totalEnergy: { $sum: '$energyConsumed' } } },
            { $sort: { totalEnergy: -1 } }
        ]);
        
        return hourlyUsage;
    }

    async getDeviceRanking(userId) {
        const devices = await Device.find({ ownerId: userId });
        const rankings = [];
        
        for (const device of devices) {
            const logs = await EnergyLog.find({ userId, deviceId: device._id });
            const totalEnergy = logs.reduce((sum, l) => sum + l.energyConsumed, 0);
            rankings.push({ deviceId: device._id, deviceName: device.name, totalEnergy, type: device.type });
        }
        
        return rankings.sort((a, b) => b.totalEnergy - a.totalEnergy);
    }

    async getDailySummary(userId) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const logs = await EnergyLog.find({ userId, timestamp: { $gte: today } });
        const totalEnergy = logs.reduce((sum, l) => sum + l.energyConsumed, 0);
        
        return { date: today, totalEnergy, totalCost: totalEnergy * 0.12, logs: logs.length };
    }
}

module.exports = new EnergyService();