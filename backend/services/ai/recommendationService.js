/**
 * ESTIF HOME ULTIMATE - RECOMMENDATION SERVICE
 * Generate personalized recommendations for energy savings and device optimization
 * Version: 2.0.0
 */

class RecommendationService {
    constructor() {
        this.recommendations = [];
    }

    async generateEnergyRecommendations(userId, energyData, devices) {
        const recommendations = [];
        
        const totalEnergy = energyData.reduce((sum, d) => sum + d.energy, 0);
        const deviceEnergy = this.aggregateDeviceEnergy(energyData);
        
        const highUsageDevices = Object.entries(deviceEnergy)
            .map(([deviceId, energy]) => ({ deviceId, energy, percentage: energy / totalEnergy }))
            .filter(d => d.percentage > 0.2)
            .sort((a, b) => b.percentage - a.percentage);
        
        for (const highDevice of highUsageDevices) {
            const device = devices.find(d => d._id.toString() === highDevice.deviceId);
            if (device) {
                recommendations.push({
                    type: 'high_consumption',
                    priority: 'high',
                    title: `Reduce ${device.name} Usage`,
                    description: `${device.name} accounts for ${(highDevice.percentage * 100).toFixed(1)}% of your energy consumption`,
                    action: `Consider enabling auto mode or scheduling for ${device.name}`,
                    potentialSavings: (highDevice.energy * 0.2).toFixed(2),
                    deviceId: device._id
                });
            }
        }
        
        const devicesWithoutAuto = devices.filter(d => !d.autoMode);
        if (devicesWithoutAuto.length > 0) {
            recommendations.push({
                type: 'auto_mode',
                priority: 'medium',
                title: 'Enable Auto Mode',
                description: `${devicesWithoutAuto.length} devices are in manual mode`,
                action: 'Enable auto mode for better energy efficiency',
                potentialSavings: (totalEnergy * 0.15).toFixed(2),
                devices: devicesWithoutAuto.map(d => d.name)
            });
        }
        
        const offPeakHours = this.identifyOffPeakHours(energyData);
        if (offPeakHours.length > 0) {
            recommendations.push({
                type: 'peak_hours',
                priority: 'low',
                title: 'Shift Usage to Off-Peak Hours',
                description: `Consider running high-energy devices during off-peak hours (${offPeakHours.join(', ')})`,
                action: 'Schedule devices to run during these hours',
                potentialSavings: (totalEnergy * 0.1).toFixed(2)
            });
        }
        
        return recommendations;
    }

    generateDeviceRecommendations(device, history) {
        const recommendations = [];
        
        if (history.length < 7) return recommendations;
        
        const runtimePattern = this.analyzeDeviceRuntime(history);
        
        if (runtimePattern.idleTime > 12 && device.state) {
            recommendations.push({
                type: 'idle_device',
                priority: 'high',
                title: `${device.name} Running Idle`,
                description: `Device has been running for ${runtimePattern.idleTime.toFixed(1)} hours`,
                action: 'Turn off when not in use',
                estimatedSavings: (device.power * runtimePattern.idleTime / 1000).toFixed(2)
            });
        }
        
        if (!device.autoMode && device.type === 'light' && runtimePattern.dailyUsage > 8) {
            recommendations.push({
                type: 'auto_light',
                priority: 'medium',
                title: 'Enable Auto Mode for Lighting',
                description: 'Auto mode can optimize lighting based on occupancy',
                action: 'Enable auto mode or create schedules',
                estimatedSavings: (device.power * runtimePattern.dailyUsage * 0.3 / 1000).toFixed(2)
            });
        }
        
        return recommendations;
    }

    generateMaintenanceRecommendations(devices) {
        const recommendations = [];
        
        for (const device of devices) {
            const daysSinceLastSeen = (Date.now() - device.lastSeen) / (1000 * 60 * 60 * 24);
            
            if (daysSinceLastSeen > 7 && device.online === false) {
                recommendations.push({
                    type: 'offline_device',
                    priority: 'high',
                    title: `${device.name} is Offline`,
                    description: 'Device has been offline for ${Math.floor(daysSinceLastSeen)} days',
                    action: 'Check network connection and device power',
                    deviceId: device._id
                });
            }
            
            if (device.firmwareVersion && this.isFirmwareOutdated(device.firmwareVersion)) {
                recommendations.push({
                    type: 'firmware_update',
                    priority: 'medium',
                    title: `Update Available for ${device.name}`,
                    description: 'New firmware version available',
                    action: 'Update to latest version for improved performance',
                    deviceId: device._id
                });
            }
        }
        
        return recommendations;
    }

    aggregateDeviceEnergy(energyData) {
        const deviceEnergy = {};
        for (const data of energyData) {
            if (!deviceEnergy[data.deviceId]) deviceEnergy[data.deviceId] = 0;
            deviceEnergy[data.deviceId] += data.energy;
        }
        return deviceEnergy;
    }

    identifyOffPeakHours(energyData) {
        const hourlyUsage = Array(24).fill(0);
        let totalUsage = 0;
        
        for (const data of energyData) {
            const hour = new Date(data.timestamp).getHours();
            hourlyUsage[hour] += data.energy;
            totalUsage += data.energy;
        }
        
        const averageUsage = totalUsage / 24;
        const offPeakHours = [];
        
        for (let i = 0; i < 24; i++) {
            if (hourlyUsage[i] < averageUsage * 0.5) {
                offPeakHours.push(`${i}:00`);
            }
        }
        
        return offPeakHours.slice(0, 4);
    }

    analyzeDeviceRuntime(history) {
        let totalRuntime = 0;
        let idleTime = 0;
        let lastOnTime = null;
        
        for (let i = 0; i < history.length; i++) {
            const record = history[i];
            
            if (record.state && lastOnTime === null) {
                lastOnTime = record.timestamp;
            } else if (!record.state && lastOnTime !== null) {
                totalRuntime += record.timestamp - lastOnTime;
                lastOnTime = null;
            }
        }
        
        if (lastOnTime !== null) {
            idleTime = (Date.now() - lastOnTime) / (1000 * 60 * 60);
        }
        
        const daysInHistory = (history[history.length - 1]?.timestamp - history[0]?.timestamp) / (1000 * 60 * 60 * 24);
        const dailyUsage = totalRuntime / daysInHistory / (1000 * 60 * 60);
        
        return { totalRuntime, idleTime, dailyUsage };
    }

    isFirmwareOutdated(currentVersion) {
        const current = currentVersion.split('.').map(Number);
        const latest = [2, 0, 0];
        
        for (let i = 0; i < 3; i++) {
            if ((current[i] || 0) < latest[i]) return true;
            if ((current[i] || 0) > latest[i]) return false;
        }
        return false;
    }

    rankRecommendations(recommendations) {
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        
        return recommendations
            .sort((a, b) => {
                const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
                if (priorityDiff !== 0) return priorityDiff;
                return (b.potentialSavings || 0) - (a.potentialSavings || 0);
            })
            .slice(0, 10);
    }
}

module.exports = new RecommendationService();