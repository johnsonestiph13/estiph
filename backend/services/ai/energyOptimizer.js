/**
 * ESTIF HOME ULTIMATE - ENERGY OPTIMIZER
 * Optimize energy consumption based on usage patterns and pricing
 * Version: 2.0.0
 */

class EnergyOptimizer {
    constructor() {
        this.priceRates = {
            peak: 0.15,
            offPeak: 0.08,
            shoulder: 0.11
        };
        
        this.peakHours = [17, 18, 19, 20]; // 5 PM - 8 PM
        this.offPeakHours = [23, 0, 1, 2, 3, 4, 5]; // 11 PM - 5 AM
    }

    async optimizeSchedule(devices, energyData) {
        const optimization = {
            schedule: [],
            estimatedSavings: 0,
            recommendations: []
        };
        
        for (const device of devices) {
            if (device.power > 100 && !device.autoMode && device.type !== 'security') {
                const optimalTime = this.findOptimalRunTime(device, energyData);
                
                if (optimalTime) {
                    optimization.schedule.push({
                        deviceId: device._id,
                        deviceName: device.name,
                        currentTime: null,
                        recommendedTime: optimalTime,
                        estimatedSavings: (device.power / 1000 * 0.07).toFixed(2),
                        reason: `Run during off-peak hours for lower rates`
                    });
                    
                    optimization.estimatedSavings += parseFloat(optimization.schedule[optimization.schedule.length - 1].estimatedSavings);
                }
            }
        }
        
        return optimization;
    }

    findOptimalRunTime(device, energyData) {
        const deviceHistory = energyData.filter(d => d.deviceId === device._id);
        if (deviceHistory.length < 7) return null;
        
        const typicalRunTimes = this.getTypicalRunTimes(deviceHistory);
        const cheapestHours = this.getCheapestHours();
        
        for (const hour of cheapestHours) {
            if (!typicalRunTimes.includes(hour)) {
                return `${hour}:00`;
            }
        }
        
        return null;
    }

    getTypicalRunTimes(history) {
        const hours = {};
        for (const data of history) {
            const hour = new Date(data.timestamp).getHours();
            hours[hour] = (hours[hour] || 0) + 1;
        }
        
        return Object.entries(hours)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([hour]) => parseInt(hour));
    }

    getCheapestHours() {
        const allHours = [...Array(24).keys()];
        return allHours
            .sort((a, b) => {
                const aRate = this.peakHours.includes(a) ? this.priceRates.peak : 
                              this.offPeakHours.includes(a) ? this.priceRates.offPeak : 
                              this.priceRates.shoulder;
                const bRate = this.peakHours.includes(b) ? this.priceRates.peak : 
                              this.offPeakHours.includes(b) ? this.priceRates.offPeak : 
                              this.priceRates.shoulder;
                return aRate - bRate;
            });
    }

    calculateOptimalTemperature(currentTemp, targetTemp, outdoorTemp) {
        if (outdoorTemp) {
            const diff = Math.abs(currentTemp - targetTemp);
            const outdoorDiff = Math.abs(outdoorTemp - targetTemp);
            
            if (outdoorDiff < diff) {
                return {
                    optimal: false,
                    suggestion: `Consider using natural ventilation (outdoor: ${outdoorTemp}°C)`,
                    savings: (diff - outdoorDiff) * 0.5
                };
            }
        }
        
        return {
            optimal: true,
            suggestion: null,
            savings: 0
        };
    }

    async getRealTimePrice() {
        const hour = new Date().getHours();
        
        if (this.peakHours.includes(hour)) {
            return this.priceRates.peak;
        } else if (this.offPeakHours.includes(hour)) {
            return this.priceRates.offPeak;
        }
        return this.priceRates.shoulder;
    }

    estimateMonthlyBill(energyData) {
        let totalCost = 0;
        let peakUsage = 0;
        let offPeakUsage = 0;
        let shoulderUsage = 0;
        
        for (const data of energyData) {
            const hour = new Date(data.timestamp).getHours();
            let rate;
            
            if (this.peakHours.includes(hour)) {
                rate = this.priceRates.peak;
                peakUsage += data.energy;
            } else if (this.offPeakHours.includes(hour)) {
                rate = this.priceRates.offPeak;
                offPeakUsage += data.energy;
            } else {
                rate = this.priceRates.shoulder;
                shoulderUsage += data.energy;
            }
            
            totalCost += data.energy * rate;
        }
        
        return {
            totalCost: totalCost.toFixed(2),
            breakdown: {
                peak: { usage: peakUsage.toFixed(2), cost: (peakUsage * this.priceRates.peak).toFixed(2) },
                offPeak: { usage: offPeakUsage.toFixed(2), cost: (offPeakUsage * this.priceRates.offPeak).toFixed(2) },
                shoulder: { usage: shoulderUsage.toFixed(2), cost: (shoulderUsage * this.priceRates.shoulder).toFixed(2) }
            },
            averageRate: (totalCost / energyData.reduce((sum, d) => sum + d.energy, 0)).toFixed(3)
        };
    }
}

module.exports = new EnergyOptimizer();