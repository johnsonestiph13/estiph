/**
 * ESTIF HOME ULTIMATE - ANOMALY SERVICE
 * Detect anomalies in device behavior and energy consumption
 * Version: 2.0.0
 */

class AnomalyService {
    constructor() {
        this.baselines = new Map();
    }

    async detectEnergyAnomalies(energyData, userId) {
        const anomalies = [];
        
        if (energyData.length < 24) return anomalies;
        
        const baseline = await this.getBaseline(userId, 'energy');
        const values = energyData.map(d => d.energy);
        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        const stdDev = Math.sqrt(values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length);
        
        const hourlyPattern = this.getHourlyPattern(energyData);
        
        for (let i = 0; i < energyData.length; i++) {
            const data = energyData[i];
            const hour = new Date(data.timestamp).getHours();
            const expectedRange = hourlyPattern[hour];
            
            if (expectedRange && (data.energy < expectedRange.lower || data.energy > expectedRange.upper)) {
                anomalies.push({
                    type: 'energy_spike',
                    timestamp: data.timestamp,
                    value: data.energy,
                    expectedRange,
                    severity: this.calculateSeverity(data.energy, expectedRange),
                    deviceId: data.deviceId,
                    message: `Energy consumption ${data.energy > expectedRange.upper ? 'above' : 'below'} normal range`
                });
            }
            
            const zScore = Math.abs((data.energy - mean) / stdDev);
            if (zScore > 2.5) {
                anomalies.push({
                    type: 'statistical_anomaly',
                    timestamp: data.timestamp,
                    value: data.energy,
                    zScore,
                    severity: Math.min(zScore / 5, 1),
                    message: `Statistical anomaly detected (z-score: ${zScore.toFixed(2)})`
                });
            }
        }
        
        return anomalies;
    }

    detectDeviceAnomalies(deviceHistory, device) {
        const anomalies = [];
        
        if (deviceHistory.length < 10) return anomalies;
        
        const stateChanges = this.analyzeStateChanges(deviceHistory);
        const runtimePattern = this.analyzeRuntimePattern(deviceHistory);
        
        if (stateChanges.frequency > 10) {
            anomalies.push({
                type: 'rapid_toggling',
                severity: Math.min(stateChanges.frequency / 20, 1),
                message: `Device toggled ${stateChanges.frequency} times in the last hour`,
                recommendation: 'Check for faulty switch or automation conflict'
            });
        }
        
        if (runtimePattern.average > 12 && device.type === 'light') {
            anomalies.push({
                type: 'excessive_runtime',
                severity: Math.min(runtimePattern.average / 24, 1),
                message: `Device running for ${runtimePattern.average.toFixed(1)} hours/day`,
                recommendation: 'Consider scheduling or auto mode'
            });
        }
        
        if (device.power > 1000 && runtimePattern.average > 8) {
            anomalies.push({
                type: 'high_energy_usage',
                severity: Math.min((device.power * runtimePattern.average) / 10000, 1),
                message: `High energy consumption: ${(device.power * runtimePattern.average / 1000).toFixed(1)} kWh/day`,
                recommendation: 'Review device usage or consider energy-efficient alternative'
            });
        }
        
        return anomalies;
    }

    analyzeStateChanges(history) {
        let changes = 0;
        let lastState = null;
        
        for (const record of history.slice(-60)) {
            if (lastState !== null && record.state !== lastState) {
                changes++;
            }
            lastState = record.state;
        }
        
        return { frequency: changes };
    }

    analyzeRuntimePattern(history) {
        let totalRuntime = 0;
        let lastOnTime = null;
        
        for (const record of history) {
            if (record.state && lastOnTime === null) {
                lastOnTime = record.timestamp;
            } else if (!record.state && lastOnTime !== null) {
                totalRuntime += record.timestamp - lastOnTime;
                lastOnTime = null;
            }
        }
        
        const daysInHistory = (history[history.length - 1]?.timestamp - history[0]?.timestamp) / (1000 * 60 * 60 * 24);
        const averageDailyRuntime = totalRuntime / (daysInHistory * 60 * 60 * 1000);
        
        return { average: averageDailyRuntime, total: totalRuntime };
    }

    getHourlyPattern(energyData) {
        const hourlyData = Array(24).fill().map(() => []);
        
        for (const data of energyData) {
            const hour = new Date(data.timestamp).getHours();
            hourlyData[hour].push(data.energy);
        }
        
        const pattern = {};
        for (let i = 0; i < 24; i++) {
            if (hourlyData[i].length > 0) {
                const values = hourlyData[i];
                const mean = values.reduce((a, b) => a + b, 0) / values.length;
                const stdDev = Math.sqrt(values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length);
                
                pattern[i] = {
                    lower: mean - stdDev * 1.5,
                    upper: mean + stdDev * 1.5,
                    mean,
                    stdDev
                };
            }
        }
        
        return pattern;
    }

    calculateSeverity(value, expectedRange) {
        if (value > expectedRange.upper) {
            const excess = (value - expectedRange.upper) / expectedRange.upper;
            return Math.min(excess, 1);
        }
        if (value < expectedRange.lower) {
            const deficit = (expectedRange.lower - value) / expectedRange.lower;
            return Math.min(deficit, 1);
        }
        return 0;
    }

    async getBaseline(userId, type) {
        if (this.baselines.has(`${userId}:${type}`)) {
            return this.baselines.get(`${userId}:${type}`);
        }
        
        const baseline = {
            mean: 0,
            stdDev: 0,
            min: 0,
            max: 0,
            percentiles: { p25: 0, p50: 0, p75: 0, p95: 0 }
        };
        
        this.baselines.set(`${userId}:${type}`, baseline);
        return baseline;
    }

    updateBaseline(userId, type, data) {
        const baseline = this.baselines.get(`${userId}:${type}`);
        if (baseline) {
            const values = data.map(d => d.value || d.energy);
            baseline.mean = values.reduce((a, b) => a + b, 0) / values.length;
            baseline.stdDev = Math.sqrt(values.reduce((sum, v) => sum + Math.pow(v - baseline.mean, 2), 0) / values.length);
            baseline.min = Math.min(...values);
            baseline.max = Math.max(...values);
            
            const sorted = [...values].sort((a, b) => a - b);
            baseline.percentiles = {
                p25: sorted[Math.floor(sorted.length * 0.25)],
                p50: sorted[Math.floor(sorted.length * 0.5)],
                p75: sorted[Math.floor(sorted.length * 0.75)],
                p95: sorted[Math.floor(sorted.length * 0.95)]
            };
        }
    }
}

module.exports = new AnomalyService();