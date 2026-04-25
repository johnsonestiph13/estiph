/**
 * ESTIF HOME ULTIMATE - DEVICE ANALYTICS MODULE
 * Analytics and statistics for device usage, energy consumption, and performance metrics
 * Version: 2.0.0
 * Author: Estifanos Yohannis
 */

// ============================================
// DEVICE ANALYTICS CONFIGURATION
// ============================================

const DeviceAnalyticsConfig = {
    // Collection settings
    collectionInterval: 60000, // 1 minute
    dataRetentionDays: 30,
    batchSize: 100,
    
    // Analytics settings
    enablePredictions: true,
    enableAnomalyDetection: true,
    enableRecommendations: true,
    
    // Thresholds
    energyThresholdHigh: 1000, // Watts
    energyThresholdCritical: 2000, // Watts
    runtimeThresholdHigh: 12, // Hours
    temperatureThresholdHigh: 35, // Celsius
    
    // Storage
    storageKey: 'estif_device_analytics',
    maxHistoryPoints: 10000,
    
    // Debug
    debug: false
};

// ============================================
// DEVICE ANALYTICS MANAGER
// ============================================

class DeviceAnalytics {
    constructor() {
        this.data = {
            devices: new Map(),
            history: [],
            aggregates: {},
            predictions: {},
            anomalies: [],
            recommendations: []
        };
        
        this.collectionInterval = null;
        this.listeners = [];
        
        this.init();
    }

    init() {
        this.loadData();
        this.startCollection();
        DeviceAnalyticsConfig.debug && console.log('[DeviceAnalytics] Initialized');
    }

    // ============================================
    // DATA COLLECTION
    // ============================================

    startCollection() {
        this.collectionInterval = setInterval(() => {
            this.collectDeviceData();
        }, DeviceAnalyticsConfig.collectionInterval);
    }

    stopCollection() {
        if (this.collectionInterval) {
            clearInterval(this.collectionInterval);
            this.collectionInterval = null;
        }
    }

    async collectDeviceData() {
        const devices = this.getDevices();
        
        for (const device of devices) {
            const metrics = await this.collectDeviceMetrics(device);
            this.recordMetrics(device.id, metrics);
        }
        
        this.updateAggregates();
        this.detectAnomalies();
        this.generatePredictions();
        this.generateRecommendations();
        this.saveData();
        
        this.notifyListeners('data_collected', {
            timestamp: Date.now(),
            deviceCount: devices.length
        });
    }

    async collectDeviceMetrics(device) {
        return {
            timestamp: Date.now(),
            state: device.state,
            power: device.state ? device.power : 0,
            energyConsumed: device.state ? device.power * (DeviceAnalyticsConfig.collectionInterval / 3600000) : 0,
            runtime: device.state ? (Date.now() - (device.lastStateChange || Date.now())) / 3600000 : 0,
            temperature: device.temperature || null,
            autoMode: device.autoMode,
            signalStrength: device.signalStrength || null,
            errors: device.errors || 0
        };
    }

    recordMetrics(deviceId, metrics) {
        if (!this.data.devices.has(deviceId)) {
            this.data.devices.set(deviceId, {
                id: deviceId,
                history: [],
                stats: {
                    totalRuntime: 0,
                    totalEnergy: 0,
                    avgPower: 0,
                    uptime: 0,
                    errorCount: 0,
                    stateChanges: 0
                }
            });
        }
        
        const deviceData = this.data.devices.get(deviceId);
        deviceData.history.push(metrics);
        
        // Trim history
        if (deviceData.history.length > DeviceAnalyticsConfig.maxHistoryPoints) {
            deviceData.history.shift();
        }
        
        // Update stats
        deviceData.stats.totalRuntime += metrics.runtime;
        deviceData.stats.totalEnergy += metrics.energyConsumed;
        deviceData.stats.avgPower = deviceData.history.reduce((sum, m) => sum + m.power, 0) / deviceData.history.length;
        deviceData.stats.uptime = deviceData.history.filter(m => m.state).length / deviceData.history.length;
        deviceData.stats.errorCount += metrics.errors;
        
        if (metrics.state) {
            deviceData.stats.stateChanges++;
        }
        
        // Add to global history
        this.data.history.push({
            deviceId,
            ...metrics
        });
        
        // Trim global history
        if (this.data.history.length > DeviceAnalyticsConfig.maxHistoryPoints) {
            this.data.history.shift();
        }
    }

    // ============================================
    // AGGREGATES
    // ============================================

    updateAggregates() {
        const now = Date.now();
        const hourAgo = now - 3600000;
        const dayAgo = now - 86400000;
        const weekAgo = now - 604800000;
        const monthAgo = now - 2592000000;
        
        this.data.aggregates = {
            realtime: this.calculateRealtimeAggregates(),
            hourly: this.calculateTimeRangeAggregates(hourAgo, now),
            daily: this.calculateTimeRangeAggregates(dayAgo, now),
            weekly: this.calculateTimeRangeAggregates(weekAgo, now),
            monthly: this.calculateTimeRangeAggregates(monthAgo, now)
        };
    }

    calculateRealtimeAggregates() {
        const devices = Array.from(this.data.devices.values());
        
        return {
            totalDevices: devices.length,
            activeDevices: devices.filter(d => d.history[d.history.length - 1]?.state).length,
            totalPower: devices.reduce((sum, d) => sum + (d.history[d.history.length - 1]?.power || 0), 0),
            totalEnergyToday: devices.reduce((sum, d) => sum + this.getEnergySince(d, Date.now() - 86400000), 0),
            avgDeviceRuntime: devices.reduce((sum, d) => sum + d.stats.uptime, 0) / devices.length,
            topDevices: this.getTopDevices()
        };
    }

    calculateTimeRangeAggregates(startTime, endTime) {
        const relevantHistory = this.data.history.filter(h => 
            h.timestamp >= startTime && h.timestamp <= endTime
        );
        
        const devices = new Map();
        
        for (const entry of relevantHistory) {
            if (!devices.has(entry.deviceId)) {
                devices.set(entry.deviceId, {
                    energy: 0,
                    runtime: 0,
                    stateChanges: 0
                });
            }
            
            const device = devices.get(entry.deviceId);
            device.energy += entry.energyConsumed;
            device.runtime += entry.runtime;
            if (entry.state) device.stateChanges++;
        }
        
        return {
            totalEnergy: Array.from(devices.values()).reduce((sum, d) => sum + d.energy, 0),
            totalRuntime: Array.from(devices.values()).reduce((sum, d) => sum + d.runtime, 0),
            averageEnergyPerDevice: Array.from(devices.values()).reduce((sum, d) => sum + d.energy, 0) / devices.size,
            deviceCount: devices.size,
            activeDevices: Array.from(devices.values()).filter(d => d.runtime > 0).length
        };
    }

    getEnergySince(deviceData, since) {
        return deviceData.history
            .filter(h => h.timestamp >= since)
            .reduce((sum, h) => sum + h.energyConsumed, 0);
    }

    getTopDevices(limit = 5) {
        const devices = Array.from(this.data.devices.values());
        return devices
            .sort((a, b) => b.stats.totalEnergy - a.stats.totalEnergy)
            .slice(0, limit)
            .map(d => ({
                id: d.id,
                totalEnergy: d.stats.totalEnergy,
                totalRuntime: d.stats.totalRuntime,
                uptime: d.stats.uptime
            }));
    }

    // ============================================
    // ANOMALY DETECTION
    // ============================================

    detectAnomalies() {
        const devices = Array.from(this.data.devices.values());
        const anomalies = [];
        
        for (const device of devices) {
            const recentHistory = device.history.slice(-100);
            if (recentHistory.length < 10) continue;
            
            // Detect power spikes
            const avgPower = recentHistory.reduce((sum, h) => sum + h.power, 0) / recentHistory.length;
            const powerThreshold = avgPower * 2;
            
            for (const entry of recentHistory.slice(-10)) {
                if (entry.power > powerThreshold && entry.power > DeviceAnalyticsConfig.energyThresholdHigh) {
                    anomalies.push({
                        type: 'power_spike',
                        deviceId: device.id,
                        timestamp: entry.timestamp,
                        value: entry.power,
                        threshold: powerThreshold,
                        severity: entry.power > DeviceAnalyticsConfig.energyThresholdCritical ? 'critical' : 'warning'
                    });
                }
            }
            
            // Detect excessive runtime
            const recentRuntime = recentHistory.reduce((sum, h) => sum + h.runtime, 0);
            if (recentRuntime > DeviceAnalyticsConfig.runtimeThresholdHigh) {
                anomalies.push({
                    type: 'excessive_runtime',
                    deviceId: device.id,
                    timestamp: Date.now(),
                    value: recentRuntime,
                    threshold: DeviceAnalyticsConfig.runtimeThresholdHigh,
                    severity: 'warning'
                });
            }
            
            // Detect high error rate
            const errorRate = recentHistory.filter(h => h.errors > 0).length / recentHistory.length;
            if (errorRate > 0.1) { // More than 10% error rate
                anomalies.push({
                    type: 'high_error_rate',
                    deviceId: device.id,
                    timestamp: Date.now(),
                    value: errorRate,
                    threshold: 0.1,
                    severity: 'critical'
                });
            }
        }
        
        this.data.anomalies = anomalies.slice(0, 100);
        this.notifyListeners('anomalies_detected', { anomalies });
    }

    // ============================================
    // PREDICTIONS
    // ============================================

    generatePredictions() {
        if (!DeviceAnalyticsConfig.enablePredictions) return;
        
        const predictions = {};
        
        for (const [deviceId, deviceData] of this.data.devices.entries()) {
            predictions[deviceId] = this.predictDeviceBehavior(deviceData);
        }
        
        this.data.predictions = predictions;
    }

    predictDeviceBehavior(deviceData) {
        const history = deviceData.history;
        if (history.length < 24) return null;
        
        // Simple time-series prediction based on recent trends
        const recentEnergy = history.slice(-24).map(h => h.energyConsumed);
        const avgEnergy = recentEnergy.reduce((sum, e) => sum + e, 0) / recentEnergy.length;
        const trend = this.calculateTrend(recentEnergy);
        
        // Predict next hour
        const nextHourEnergy = avgEnergy + trend;
        
        // Predict peak usage time
        const hourlyUsage = this.getHourlyUsagePattern(history);
        const peakHour = this.findPeakHour(hourlyUsage);
        
        return {
            nextHourEnergy,
            estimatedDailyEnergy: nextHourEnergy * 24,
            peakHour,
            confidence: this.calculatePredictionConfidence(recentEnergy),
            trend: trend > 0 ? 'increasing' : trend < 0 ? 'decreasing' : 'stable'
        };
    }

    calculateTrend(values) {
        if (values.length < 2) return 0;
        
        const n = values.length;
        const sumX = (n * (n - 1)) / 2;
        const sumY = values.reduce((s, v) => s + v, 0);
        const sumXY = values.reduce((s, v, i) => s + v * i, 0);
        const sumX2 = (n - 1) * n * (2 * n - 1) / 6;
        
        const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
        return slope;
    }

    getHourlyUsagePattern(history) {
        const hourly = new Array(24).fill(0);
        let count = new Array(24).fill(0);
        
        for (const entry of history) {
            const hour = new Date(entry.timestamp).getHours();
            hourly[hour] += entry.energyConsumed;
            count[hour]++;
        }
        
        return hourly.map((h, i) => count[i] > 0 ? h / count[i] : 0);
    }

    findPeakHour(hourlyUsage) {
        let maxUsage = -1;
        let peakHour = 0;
        
        for (let i = 0; i < hourlyUsage.length; i++) {
            if (hourlyUsage[i] > maxUsage) {
                maxUsage = hourlyUsage[i];
                peakHour = i;
            }
        }
        
        return peakHour;
    }

    calculatePredictionConfidence(values) {
        if (values.length < 10) return 0.5;
        
        // Calculate variance as confidence metric
        const mean = values.reduce((s, v) => s + v, 0) / values.length;
        const variance = values.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / values.length;
        const confidence = 1 - Math.min(1, variance / (mean * mean));
        
        return Math.max(0, Math.min(1, confidence));
    }

    // ============================================
    // RECOMMENDATIONS
    // ============================================

    generateRecommendations() {
        if (!DeviceAnalyticsConfig.enableRecommendations) return;
        
        const recommendations = [];
        
        for (const [deviceId, deviceData] of this.data.devices.entries()) {
            const deviceRecs = this.generateDeviceRecommendations(deviceId, deviceData);
            recommendations.push(...deviceRecs);
        }
        
        this.data.recommendations = recommendations;
        this.notifyListeners('recommendations_generated', { recommendations });
    }

    generateDeviceRecommendations(deviceId, deviceData) {
        const recommendations = [];
        const recentHistory = deviceData.history.slice(-100);
        
        if (recentHistory.length < 24) return recommendations;
        
        // Energy saving recommendations
        const avgEnergy = recentHistory.reduce((sum, h) => sum + h.energyConsumed, 0) / recentHistory.length;
        const peakEnergy = Math.max(...recentHistory.map(h => h.energyConsumed));
        
        if (avgEnergy > 50) { // Threshold for high energy
            recommendations.push({
                type: 'energy_saving',
                deviceId,
                title: 'Reduce Energy Consumption',
                description: `Device is consuming ${avgEnergy.toFixed(2)} kWh on average. Consider using auto mode or scheduling.`,
                potentialSavings: avgEnergy * 0.2,
                priority: 'high'
            });
        }
        
        // Runtime recommendations
        const avgRuntime = recentHistory.reduce((sum, h) => sum + h.runtime, 0) / recentHistory.length;
        if (avgRuntime > 8) {
            recommendations.push({
                type: 'runtime_optimization',
                deviceId,
                title: 'Reduce Runtime',
                description: `Device is running ${avgRuntime.toFixed(1)} hours/day. Consider turning off when not in use.`,
                potentialSavings: avgRuntime * 0.15,
                priority: 'medium'
            });
        }
        
        // Auto mode recommendation
        const device = this.getDevice(deviceId);
        if (device && !device.autoMode && avgEnergy > 30) {
            recommendations.push({
                type: 'auto_mode',
                deviceId,
                title: 'Enable Auto Mode',
                description: 'Auto mode could help optimize usage and save energy.',
                potentialSavings: avgEnergy * 0.25,
                priority: 'medium'
            });
        }
        
        // Maintenance recommendation
        const errorRate = recentHistory.filter(h => h.errors > 0).length / recentHistory.length;
        if (errorRate > 0.05) {
            recommendations.push({
                type: 'maintenance',
                deviceId,
                title: 'Device Needs Attention',
                description: `Device has ${(errorRate * 100).toFixed(1)}% error rate. Please check device status.`,
                priority: 'high'
            });
        }
        
        return recommendations;
    }

    // ============================================
    // REPORTING
    // ============================================

    generateReport(deviceId = null, period = 'day') {
        const report = {
            generatedAt: Date.now(),
            period,
            deviceId,
            summary: {},
            details: {},
            recommendations: []
        };
        
        if (deviceId) {
            const deviceData = this.data.devices.get(deviceId);
            if (deviceData) {
                report.summary = this.generateDeviceSummary(deviceData, period);
                report.details = this.generateDeviceDetails(deviceData, period);
                report.recommendations = this.data.recommendations.filter(r => r.deviceId === deviceId);
            }
        } else {
            report.summary = this.generateGlobalSummary(period);
            report.details = this.generateGlobalDetails(period);
            report.recommendations = this.data.recommendations;
        }
        
        return report;
    }

    generateDeviceSummary(deviceData, period) {
        const history = this.getHistoryForPeriod(deviceData.history, period);
        const totalEnergy = history.reduce((sum, h) => sum + h.energyConsumed, 0);
        const totalRuntime = history.reduce((sum, h) => sum + h.runtime, 0);
        const avgPower = history.reduce((sum, h) => sum + h.power, 0) / history.length;
        
        return {
            totalEnergy,
            totalRuntime,
            avgPower,
            uptime: totalRuntime / (this.getPeriodHours(period)),
            estimatedCost: totalEnergy * 0.12, // Assuming $0.12 per kWh
            efficiency: avgPower > 0 ? (totalEnergy / avgPower) : 0
        };
    }

    generateGlobalSummary(period) {
        let totalEnergy = 0;
        let totalRuntime = 0;
        let totalDevices = 0;
        
        for (const deviceData of this.data.devices.values()) {
            const history = this.getHistoryForPeriod(deviceData.history, period);
            totalEnergy += history.reduce((sum, h) => sum + h.energyConsumed, 0);
            totalRuntime += history.reduce((sum, h) => sum + h.runtime, 0);
            totalDevices++;
        }
        
        return {
            totalEnergy,
            totalRuntime,
            totalDevices,
            avgEnergyPerDevice: totalEnergy / totalDevices,
            avgRuntimePerDevice: totalRuntime / totalDevices,
            estimatedCost: totalEnergy * 0.12,
            carbonFootprint: totalEnergy * 0.45 // kg CO2 per kWh
        };
    }

    generateDeviceDetails(deviceData, period) {
        const history = this.getHistoryForPeriod(deviceData.history, period);
        
        return {
            hourlyUsage: this.getHourlyUsagePattern(history),
            dailyUsage: this.getDailyUsagePattern(history),
            dailyPeaks: this.getDailyPeaks(history),
            stateChanges: history.filter(h => h.state).length,
            errorEvents: history.filter(h => h.errors > 0).length
        };
    }

    generateGlobalDetails(period) {
        const devices = Array.from(this.data.devices.values());
        
        return {
            topConsumers: this.getTopDevices(5),
            hourlyAggregate: this.getHourlyAggregate(period),
            dailyAggregate: this.getDailyAggregate(period),
            efficiencyRanking: devices
                .map(d => ({
                    id: d.id,
                    efficiency: d.stats.totalEnergy > 0 ? d.stats.totalRuntime / d.stats.totalEnergy : 0
                }))
                .sort((a, b) => b.efficiency - a.efficiency)
                .slice(0, 5)
        };
    }

    getHistoryForPeriod(history, period) {
        const now = Date.now();
        let startTime;
        
        switch (period) {
            case 'hour':
                startTime = now - 3600000;
                break;
            case 'day':
                startTime = now - 86400000;
                break;
            case 'week':
                startTime = now - 604800000;
                break;
            case 'month':
                startTime = now - 2592000000;
                break;
            default:
                startTime = now - 86400000;
        }
        
        return history.filter(h => h.timestamp >= startTime);
    }

    getPeriodHours(period) {
        switch (period) {
            case 'hour': return 1;
            case 'day': return 24;
            case 'week': return 168;
            case 'month': return 720;
            default: return 24;
        }
    }

    getDailyUsagePattern(history) {
        const daily = new Map();
        
        for (const entry of history) {
            const day = new Date(entry.timestamp).toDateString();
            daily.set(day, (daily.get(day) || 0) + entry.energyConsumed);
        }
        
        return Array.from(daily.entries()).map(([day, energy]) => ({ day, energy }));
    }

    getDailyPeaks(history) {
        const dailyPeaks = new Map();
        
        for (const entry of history) {
            const day = new Date(entry.timestamp).toDateString();
            const currentPeak = dailyPeaks.get(day) || 0;
            dailyPeaks.set(day, Math.max(currentPeak, entry.power));
        }
        
        return Array.from(dailyPeaks.entries()).map(([day, peak]) => ({ day, peak }));
    }

    getHourlyAggregate(period) {
        const hourly = new Array(24).fill(0);
        let count = new Array(24).fill(0);
        
        for (const deviceData of this.data.devices.values()) {
            const history = this.getHistoryForPeriod(deviceData.history, period);
            for (const entry of history) {
                const hour = new Date(entry.timestamp).getHours();
                hourly[hour] += entry.energyConsumed;
                count[hour]++;
            }
        }
        
        return hourly.map((h, i) => count[i] > 0 ? h / count[i] : 0);
    }

    getDailyAggregate(period) {
        const daily = new Map();
        
        for (const deviceData of this.data.devices.values()) {
            const history = this.getHistoryForPeriod(deviceData.history, period);
            for (const entry of history) {
                const day = new Date(entry.timestamp).toDateString();
                daily.set(day, (daily.get(day) || 0) + entry.energyConsumed);
            }
        }
        
        return Array.from(daily.entries()).map(([day, energy]) => ({ day, energy }));
    }

    // ============================================
    // DATA MANAGEMENT
    // ============================================

    loadData() {
        try {
            const saved = localStorage.getItem(DeviceAnalyticsConfig.storageKey);
            if (saved) {
                const data = JSON.parse(saved);
                this.data.devices = new Map(data.devices);
                this.data.history = data.history;
                this.data.aggregates = data.aggregates;
                this.data.anomalies = data.anomalies;
                
                DeviceAnalyticsConfig.debug && console.log('[DeviceAnalytics] Data loaded');
            }
        } catch (error) {
            console.error('[DeviceAnalytics] Failed to load data:', error);
        }
    }

    saveData() {
        try {
            const data = {
                devices: Array.from(this.data.devices.entries()),
                history: this.data.history,
                aggregates: this.data.aggregates,
                predictions: this.data.predictions,
                anomalies: this.data.anomalies,
                recommendations: this.data.recommendations
            };
            localStorage.setItem(DeviceAnalyticsConfig.storageKey, JSON.stringify(data));
            DeviceAnalyticsConfig.debug && console.log('[DeviceAnalytics] Data saved');
        } catch (error) {
            console.error('[DeviceAnalytics] Failed to save data:', error);
        }
    }

    clearData() {
        this.data.devices.clear();
        this.data.history = [];
        this.data.aggregates = {};
        this.data.predictions = {};
        this.data.anomalies = [];
        this.data.recommendations = [];
        this.saveData();
        this.notifyListeners('data_cleared');
    }

    // ============================================
    // EXPORT/IMPORT
    // ============================================

    exportData(format = 'json') {
        const data = {
            version: '2.0',
            exportedAt: Date.now(),
            data: {
                devices: Array.from(this.data.devices.entries()),
                history: this.data.history,
                aggregates: this.data.aggregates,
                predictions: this.data.predictions,
                anomalies: this.data.anomalies,
                recommendations: this.data.recommendations
            }
        };
        
        if (format === 'json') {
            return JSON.stringify(data, null, 2);
        } else if (format === 'csv') {
            return this.convertToCSV(this.data.history);
        }
        
        return null;
    }

    convertToCSV(history) {
        if (history.length === 0) return '';
        
        const headers = ['timestamp', 'deviceId', 'state', 'power', 'energyConsumed', 'runtime'];
        const rows = history.map(entry => [
            entry.timestamp,
            entry.deviceId,
            entry.state,
            entry.power,
            entry.energyConsumed,
            entry.runtime
        ]);
        
        return [headers, ...rows].map(row => row.join(',')).join('\n');
    }

    importData(jsonData) {
        try {
            const data = JSON.parse(jsonData);
            this.data.devices = new Map(data.data.devices);
            this.data.history = data.data.history;
            this.data.aggregates = data.data.aggregates;
            this.data.predictions = data.data.predictions;
            this.data.anomalies = data.data.anomalies;
            this.data.recommendations = data.data.recommendations;
            this.saveData();
            this.notifyListeners('data_imported');
            return true;
        } catch (error) {
            console.error('[DeviceAnalytics] Failed to import data:', error);
            return false;
        }
    }

    // ============================================
    // GETTERS
    // ============================================

    getDevice(deviceId) {
        // This should be replaced with actual device lookup
        return null;
    }

    getDevices() {
        // This should be replaced with actual device list
        return [];
    }

    getDeviceAnalytics(deviceId) {
        return this.data.devices.get(deviceId) || null;
    }

    getAllAnalytics() {
        return {
            devices: Array.from(this.data.devices.values()),
            aggregates: this.data.aggregates,
            predictions: this.data.predictions,
            anomalies: this.data.anomalies,
            recommendations: this.data.recommendations
        };
    }

    getAggregates(timeframe = 'realtime') {
        return this.data.aggregates[timeframe] || this.data.aggregates.realtime;
    }

    getAnomalies(limit = 20) {
        return this.data.anomalies.slice(0, limit);
    }

    getRecommendations(limit = 10) {
        return this.data.recommendations.slice(0, limit);
    }

    // ============================================
    // EVENT SYSTEM
    // ============================================

    addEventListener(event, callback) {
        this.listeners.push({ event, callback });
        return () => {
            const index = this.listeners.findIndex(l => l.event === event && l.callback === callback);
            if (index !== -1) this.listeners.splice(index, 1);
        };
    }

    notifyListeners(event, data) {
        this.listeners.forEach(listener => {
            if (listener.event === event) {
                listener.callback(data);
            }
        });
    }
}

// ============================================
// CREATE SINGLETON INSTANCE
// ============================================

const deviceAnalytics = new DeviceAnalytics();

// ============================================
// EXPORTS
// ============================================

// Expose to window
window.deviceAnalytics = deviceAnalytics;
window.DeviceAnalytics = DeviceAnalytics;
window.DeviceAnalyticsConfig = DeviceAnalyticsConfig;

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        deviceAnalytics,
        DeviceAnalytics,
        DeviceAnalyticsConfig
    };
}

// ES modules export
export {
    deviceAnalytics,
    DeviceAnalytics,
    DeviceAnalyticsConfig
};