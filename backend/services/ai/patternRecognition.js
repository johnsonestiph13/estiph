/**
 * ESTIF HOME ULTIMATE - PATTERN RECOGNITION
 * Identify usage patterns and behavioral trends
 * Version: 2.0.0
 */

class PatternRecognition {
    constructor() {
        this.patterns = new Map();
    }

    async detectDailyPatterns(deviceHistory) {
        const patterns = {
            morning: { start: 6, end: 11, activities: [] },
            afternoon: { start: 12, end: 16, activities: [] },
            evening: { start: 17, end: 21, activities: [] },
            night: { start: 22, end: 5, activities: [] }
        };
        
        for (const record of deviceHistory) {
            const hour = new Date(record.timestamp).getHours();
            
            if (hour >= 6 && hour <= 11) patterns.morning.activities.push(record);
            else if (hour >= 12 && hour <= 16) patterns.afternoon.activities.push(record);
            else if (hour >= 17 && hour <= 21) patterns.evening.activities.push(record);
            else patterns.night.activities.push(record);
        }
        
        const result = {};
        for (const [period, data] of Object.entries(patterns)) {
            result[period] = {
                activityCount: data.activities.length,
                averageHour: data.activities.length > 0 
                    ? data.activities.reduce((sum, a) => sum + new Date(a.timestamp).getHours(), 0) / data.activities.length 
                    : 0,
                mostActiveDevice: this.getMostActiveDevice(data.activities)
            };
        }
        
        return result;
    }

    detectWeeklyPatterns(deviceHistory) {
        const weeklyPattern = Array(7).fill().map(() => []);
        
        for (const record of deviceHistory) {
            const dayOfWeek = new Date(record.timestamp).getDay();
            weeklyPattern[dayOfWeek].push(record);
        }
        
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const result = {};
        
        for (let i = 0; i < 7; i++) {
            result[days[i]] = {
                activityCount: weeklyPattern[i].length,
                devices: this.getDeviceFrequency(weeklyPattern[i]),
                peakHour: this.getPeakHour(weeklyPattern[i])
            };
        }
        
        return result;
    }

    getMostActiveDevice(activities) {
        const deviceCount = {};
        for (const activity of activities) {
            deviceCount[activity.deviceId] = (deviceCount[activity.deviceId] || 0) + 1;
        }
        
        let maxDevice = null;
        let maxCount = 0;
        for (const [device, count] of Object.entries(deviceCount)) {
            if (count > maxCount) {
                maxCount = count;
                maxDevice = device;
            }
        }
        
        return maxDevice;
    }

    getDeviceFrequency(activities) {
        const frequency = {};
        for (const activity of activities) {
            frequency[activity.deviceId] = (frequency[activity.deviceId] || 0) + 1;
        }
        return frequency;
    }

    getPeakHour(activities) {
        const hourCount = Array(24).fill(0);
        for (const activity of activities) {
            const hour = new Date(activity.timestamp).getHours();
            hourCount[hour]++;
        }
        
        let peakHour = 0;
        let maxCount = 0;
        for (let i = 0; i < 24; i++) {
            if (hourCount[i] > maxCount) {
                maxCount = hourCount[i];
                peakHour = i;
            }
        }
        
        return peakHour;
    }

    async detectCorrelations(device1History, device2History) {
        const correlations = [];
        
        const minLength = Math.min(device1History.length, device2History.length);
        if (minLength < 10) return [];
        
        let concurrentEvents = 0;
        let sequentialEvents = 0;
        
        for (let i = 0; i < minLength - 1; i++) {
            const timeDiff = Math.abs(device1History[i].timestamp - device2History[i].timestamp);
            
            if (timeDiff < 60000) { // Within 1 minute
                concurrentEvents++;
            } else if (timeDiff < 300000 && device1History[i].timestamp < device2History[i].timestamp) { // Within 5 minutes, device1 first
                sequentialEvents++;
            }
        }
        
        const correlationScore = (concurrentEvents + sequentialEvents) / minLength;
        
        if (correlationScore > 0.7) {
            correlations.push({
                type: concurrentEvents > sequentialEvents ? 'concurrent' : 'sequential',
                score: correlationScore,
                device1First: sequentialEvents > concurrentEvents,
                recommendation: `These devices are often used ${concurrentEvents > sequentialEvents ? 'together' : 'in sequence'}`
            });
        }
        
        return correlations;
    }

    predictNextUsage(deviceHistory) {
        if (deviceHistory.length < 5) return null;
        
        const intervals = [];
        for (let i = 1; i < deviceHistory.length; i++) {
            intervals.push(deviceHistory[i].timestamp - deviceHistory[i-1].timestamp);
        }
        
        const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
        const lastTimestamp = deviceHistory[deviceHistory.length - 1].timestamp;
        const predictedNext = lastTimestamp + avgInterval;
        
        const lastHour = new Date(lastTimestamp).getHours();
        const nextHour = new Date(predictedNext).getHours();
        
        return {
            predictedTimestamp: predictedNext,
            predictedTime: new Date(predictedNext).toLocaleString(),
            confidence: Math.min(intervals.length / 20, 1),
            timeOfDay: nextHour,
            isRoutine: Math.abs(avgInterval - 24 * 60 * 60 * 1000) < 60 * 60 * 1000
        };
    }

    identifyRoutine(deviceHistory) {
        if (deviceHistory.length < 14) return null;
        
        const dailyUsage = {};
        for (let i = 0; i < deviceHistory.length; i++) {
            const date = new Date(deviceHistory[i].timestamp).toISOString().split('T')[0];
            dailyUsage[date] = (dailyUsage[date] || 0) + 1;
        }
        
        const usageCounts = Object.values(dailyUsage);
        const avgDaily = usageCounts.reduce((a, b) => a + b, 0) / usageCounts.length;
        const variance = usageCounts.reduce((sum, v) => sum + Math.pow(v - avgDaily, 2), 0) / usageCounts.length;
        const stdDev = Math.sqrt(variance);
        
        const isRoutine = stdDev / avgDaily < 0.3;
        
        return {
            isRoutine,
            consistency: (1 - stdDev / avgDaily),
            averageDailyUsage: avgDaily,
            recommendation: isRoutine ? 'Usage pattern is consistent' : 'Usage varies significantly day to day'
        };
    }
}

module.exports = new PatternRecognition();