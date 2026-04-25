/**
 * ESTIF HOME ULTIMATE - PREDICTION SERVICE
 * Machine learning predictions for device usage and energy consumption
 * Version: 2.0.0
 */

class PredictionService {
    constructor() {
        this.models = new Map();
    }

    predictEnergyUsage(historicalData, days = 7) {
        if (!historicalData || historicalData.length < 7) {
            return this.generateFallbackPrediction(days);
        }
        
        const values = historicalData.map(d => d.energy);
        const n = values.length;
        const indices = Array.from({ length: n }, (_, i) => i);
        
        const sumX = indices.reduce((a, b) => a + b, 0);
        const sumY = values.reduce((a, b) => a + b, 0);
        const sumXY = indices.reduce((sum, x, i) => sum + x * values[i], 0);
        const sumX2 = indices.reduce((sum, x) => sum + x * x, 0);
        
        const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
        const intercept = (sumY - slope * sumX) / n;
        
        const predictions = [];
        for (let i = 1; i <= days; i++) {
            const predicted = Math.max(0, slope * (n + i - 1) + intercept);
            predictions.push({
                day: i,
                predictedEnergy: predicted.toFixed(2),
                lowerBound: Math.max(0, predicted * 0.8).toFixed(2),
                upperBound: (predicted * 1.2).toFixed(2),
                confidence: this.calculateConfidence(values)
            });
        }
        
        return predictions;
    }

    predictDeviceUsage(deviceHistory) {
        if (!deviceHistory || deviceHistory.length < 5) {
            return { predictedState: false, confidence: 0.5 };
        }
        
        const recentStates = deviceHistory.slice(-10).map(h => h.state ? 1 : 0);
        const avgState = recentStates.reduce((a, b) => a + b, 0) / recentStates.length;
        
        const patterns = this.detectPatterns(deviceHistory);
        
        return {
            predictedState: avgState > 0.5,
            probability: avgState,
            confidence: Math.min(avgState, 1 - avgState) * 2,
            patterns,
            nextChangeEstimate: this.estimateNextChange(deviceHistory)
        };
    }

    predictPeakHours(activityData, days = 7) {
        const hourlyActivity = Array(24).fill(0);
        let totalActivities = 0;
        
        for (const activity of activityData) {
            const hour = new Date(activity.timestamp).getHours();
            hourlyActivity[hour]++;
            totalActivities++;
        }
        
        const hourlyProbabilities = hourlyActivity.map(count => count / totalActivities);
        
        const peakHours = hourlyProbabilities
            .map((prob, hour) => ({ hour, probability: prob }))
            .sort((a, b) => b.probability - a.probability)
            .slice(0, 3);
        
        const predictions = [];
        for (let i = 0; i < days; i++) {
            const date = new Date();
            date.setDate(date.getDate() + i);
            const dayOfWeek = date.getDay();
            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
            
            predictions.push({
                date: date.toISOString().split('T')[0],
                predictedPeakHour: peakHours[0]?.hour || 12,
                expectedActivityCount: Math.round(totalActivities / activityData.length * (isWeekend ? 0.8 : 1.2)),
                confidence: 0.7
            });
        }
        
        return { peakHours, dailyPredictions: predictions };
    }

    detectPatterns(history) {
        const patterns = [];
        
        if (history.length < 14) return patterns;
        
        const weekdayAvg = {};
        const weekendAvg = {};
        let weekdayCount = 0;
        let weekendCount = 0;
        
        for (let i = 0; i < history.length; i++) {
            const date = new Date(history[i].timestamp);
            const isWeekend = date.getDay() === 0 || date.getDay() === 6;
            const value = history[i].value || (history[i].state ? 1 : 0);
            
            if (isWeekend) {
                weekendAvg[date.getDay()] = (weekendAvg[date.getDay()] || 0) + value;
                weekendCount++;
            } else {
                weekdayAvg[date.getDay()] = (weekdayAvg[date.getDay()] || 0) + value;
                weekdayCount++;
            }
        }
        
        const weekdayPattern = Object.values(weekdayAvg).reduce((a, b) => a + b, 0) / weekdayCount;
        const weekendPattern = Object.values(weekendAvg).reduce((a, b) => a + b, 0) / weekendCount;
        
        if (Math.abs(weekdayPattern - weekendPattern) > 0.3) {
            patterns.push({
                type: 'weekly_pattern',
                description: `Usage differs significantly between weekdays and weekends`,
                weekdayAvg: weekdayPattern,
                weekendAvg: weekendPattern
            });
        }
        
        return patterns;
    }

    estimateNextChange(history) {
        if (history.length < 5) return null;
        
        const changes = [];
        let lastState = null;
        let lastChangeTime = null;
        
        for (const record of history) {
            const currentState = record.state;
            if (lastState !== null && currentState !== lastState) {
                if (lastChangeTime !== null) {
                    changes.push(record.timestamp - lastChangeTime);
                }
                lastChangeTime = record.timestamp;
            }
            lastState = currentState;
        }
        
        if (changes.length === 0) return null;
        
        const avgDuration = changes.reduce((a, b) => a + b, 0) / changes.length;
        const lastState_record = history[history.length - 1];
        
        return {
            averageDuration: avgDuration,
            estimatedNextChange: new Date(lastState_record.timestamp + avgDuration),
            confidence: Math.min(changes.length / 10, 1)
        };
    }

    calculateConfidence(values) {
        if (values.length < 10) return 0.5;
        
        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
        const stdDev = Math.sqrt(variance);
        const cv = stdDev / mean;
        
        return Math.max(0, Math.min(1, 1 - cv));
    }

    generateFallbackPrediction(days) {
        const predictions = [];
        for (let i = 1; i <= days; i++) {
            predictions.push({
                day: i,
                predictedEnergy: (Math.random() * 50 + 20).toFixed(2),
                lowerBound: (Math.random() * 30 + 10).toFixed(2),
                upperBound: (Math.random() * 70 + 40).toFixed(2),
                confidence: 0.3 + Math.random() * 0.3
            });
        }
        return predictions;
    }

    forecastAnomalies(energyData, threshold = 2) {
        if (energyData.length < 10) return [];
        
        const values = energyData.map(d => d.energy);
        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
        const stdDev = Math.sqrt(variance);
        
        const anomalies = [];
        for (let i = 0; i < values.length; i++) {
            const zScore = Math.abs((values[i] - mean) / stdDev);
            if (zScore > threshold) {
                anomalies.push({
                    index: i,
                    value: values[i],
                    zScore,
                    timestamp: energyData[i].timestamp,
                    expectedRange: [mean - stdDev * threshold, mean + stdDev * threshold]
                });
            }
        }
        
        return anomalies;
    }
}

module.exports = new PredictionService();