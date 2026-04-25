/**
 * ESTIF HOME ULTIMATE - ENERGY CONTROLLER
 * Energy monitoring and consumption analytics
 * Version: 2.0.0
 * Author: Estifanos Yohannis
 */

const Device = require('../models/Device');
const EnergyLog = require('../models/EnergyLog');
const ActivityLog = require('../models/ActivityLog');

// Get energy consumption
exports.getEnergyConsumption = async (req, res) => {
    try {
        const { startDate, endDate, interval = 'day' } = req.query;

        const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const end = endDate ? new Date(endDate) : new Date();

        const devices = await Device.find({ ownerId: req.user._id });
        
        let consumptionData = [];
        
        if (interval === 'hour') {
            // Group by hour
            for (let d = new Date(start); d <= end; d.setHours(d.getHours() + 1)) {
                const hourStart = new Date(d);
                const hourEnd = new Date(d);
                hourEnd.setHours(hourEnd.getHours() + 1);
                
                const logs = await EnergyLog.find({
                    userId: req.user._id,
                    timestamp: { $gte: hourStart, $lt: hourEnd }
                });
                
                const totalEnergy = logs.reduce((sum, log) => sum + log.energyConsumed, 0);
                consumptionData.push({
                    timestamp: hourStart,
                    energy: totalEnergy,
                    cost: totalEnergy * 0.12
                });
            }
        } else if (interval === 'day') {
            // Group by day
            for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                const dayStart = new Date(d);
                const dayEnd = new Date(d);
                dayEnd.setDate(dayEnd.getDate() + 1);
                
                const logs = await EnergyLog.find({
                    userId: req.user._id,
                    timestamp: { $gte: dayStart, $lt: dayEnd }
                });
                
                const totalEnergy = logs.reduce((sum, log) => sum + log.energyConsumed, 0);
                consumptionData.push({
                    timestamp: dayStart,
                    energy: totalEnergy,
                    cost: totalEnergy * 0.12
                });
            }
        } else if (interval === 'week') {
            // Group by week
            for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 7)) {
                const weekStart = new Date(d);
                const weekEnd = new Date(d);
                weekEnd.setDate(weekEnd.getDate() + 7);
                
                const logs = await EnergyLog.find({
                    userId: req.user._id,
                    timestamp: { $gte: weekStart, $lt: weekEnd }
                });
                
                const totalEnergy = logs.reduce((sum, log) => sum + log.energyConsumed, 0);
                consumptionData.push({
                    timestamp: weekStart,
                    energy: totalEnergy,
                    cost: totalEnergy * 0.12
                });
            }
        } else if (interval === 'month') {
            // Group by month
            for (let d = new Date(start); d <= end; d.setMonth(d.getMonth() + 1)) {
                const monthStart = new Date(d);
                const monthEnd = new Date(d);
                monthEnd.setMonth(monthEnd.getMonth() + 1);
                
                const logs = await EnergyLog.find({
                    userId: req.user._id,
                    timestamp: { $gte: monthStart, $lt: monthEnd }
                });
                
                const totalEnergy = logs.reduce((sum, log) => sum + log.energyConsumed, 0);
                consumptionData.push({
                    timestamp: monthStart,
                    energy: totalEnergy,
                    cost: totalEnergy * 0.12
                });
            }
        }

        // Calculate totals
        const totalEnergy = consumptionData.reduce((sum, d) => sum + d.energy, 0);
        const totalCost = consumptionData.reduce((sum, d) => sum + d.cost, 0);
        const averageDaily = totalEnergy / (consumptionData.length || 1);

        res.json({
            success: true,
            data: {
                consumption: consumptionData,
                summary: {
                    totalEnergy: totalEnergy.toFixed(2),
                    totalCost: totalCost.toFixed(2),
                    averageDaily: averageDaily.toFixed(2),
                    period: {
                        start,
                        end,
                        interval
                    }
                }
            }
        });
    } catch (error) {
        console.error('Get energy consumption error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Get energy cost
exports.getEnergyCost = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        const ratePerKwh = 0.12; // Default rate, could be user-configurable

        const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const end = endDate ? new Date(endDate) : new Date();

        const logs = await EnergyLog.find({
            userId: req.user._id,
            timestamp: { $gte: start, $lte: end }
        });

        const totalEnergy = logs.reduce((sum, log) => sum + log.energyConsumed, 0);
        const totalCost = totalEnergy * ratePerKwh;

        // Calculate cost by device
        const costByDevice = {};
        for (const log of logs) {
            if (!costByDevice[log.deviceId]) {
                costByDevice[log.deviceId] = 0;
            }
            costByDevice[log.deviceId] += log.energyConsumed * ratePerKwh;
        }

        // Get device names
        const devices = await Device.find({ ownerId: req.user._id });
        const deviceMap = devices.reduce((map, d) => {
            map[d._id.toString()] = d.name;
            return map;
        }, {});

        const costBreakdown = Object.entries(costByDevice).map(([deviceId, cost]) => ({
            deviceId,
            deviceName: deviceMap[deviceId] || deviceId,
            cost: cost.toFixed(2)
        }));

        res.json({
            success: true,
            data: {
                totalEnergy: totalEnergy.toFixed(2),
                totalCost: totalCost.toFixed(2),
                ratePerKwh,
                costBreakdown,
                period: { start, end }
            }
        });
    } catch (error) {
        console.error('Get energy cost error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Get device energy usage
exports.getDeviceEnergyUsage = async (req, res) => {
    try {
        const devices = await Device.find({ ownerId: req.user._id });
        
        const deviceUsage = [];
        
        for (const device of devices) {
            const logs = await EnergyLog.find({
                userId: req.user._id,
                deviceId: device._id,
                timestamp: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
            });
            
            const totalEnergy = logs.reduce((sum, log) => sum + log.energyConsumed, 0);
            const totalRuntime = logs.reduce((sum, log) => sum + log.runtime, 0);
            
            deviceUsage.push({
                deviceId: device._id,
                deviceName: device.name,
                deviceType: device.type,
                totalEnergy: totalEnergy.toFixed(2),
                totalRuntime: (totalRuntime / 3600000).toFixed(2), // Convert to hours
                estimatedCost: (totalEnergy * 0.12).toFixed(2),
                percentage: 0 // Will calculate after total
            });
        }
        
        // Calculate percentages
        const totalEnergy = deviceUsage.reduce((sum, d) => sum + parseFloat(d.totalEnergy), 0);
        deviceUsage.forEach(d => {
            d.percentage = totalEnergy > 0 ? ((parseFloat(d.totalEnergy) / totalEnergy) * 100).toFixed(1) : 0;
        });
        
        // Sort by energy usage (highest first)
        deviceUsage.sort((a, b) => parseFloat(b.totalEnergy) - parseFloat(a.totalEnergy));
        
        res.json({
            success: true,
            data: deviceUsage,
            totalEnergy: totalEnergy.toFixed(2)
        });
    } catch (error) {
        console.Error('Get device energy usage error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Get energy savings
exports.getEnergySavings = async (req, res) => {
    try {
        // Get current month usage
        const currentMonthStart = new Date();
        currentMonthStart.setDate(1);
        currentMonthStart.setHours(0, 0, 0, 0);
        
        const currentMonthLogs = await EnergyLog.find({
            userId: req.user._id,
            timestamp: { $gte: currentMonthStart }
        });
        
        const currentUsage = currentMonthLogs.reduce((sum, log) => sum + log.energyConsumed, 0);
        
        // Get previous month usage
        const previousMonthStart = new Date(currentMonthStart);
        previousMonthStart.setMonth(previousMonthStart.getMonth() - 1);
        const previousMonthEnd = new Date(currentMonthStart);
        
        const previousMonthLogs = await EnergyLog.find({
            userId: req.user._id,
            timestamp: { $gte: previousMonthStart, $lt: previousMonthEnd }
        });
        
        const previousUsage = previousMonthLogs.reduce((sum, log) => sum + log.energyConsumed, 0);
        
        // Calculate savings
        const energySaved = Math.max(0, previousUsage - currentUsage);
        const costSaved = energySaved * 0.12;
        const percentageSaved = previousUsage > 0 ? (energySaved / previousUsage) * 100 : 0;
        
        // Get tips for further savings
        const devices = await Device.find({ ownerId: req.user._id });
        const highUsageDevices = [];
        
        for (const device of devices) {
            const logs = await EnergyLog.find({
                userId: req.user._id,
                deviceId: device._id,
                timestamp: { $gte: currentMonthStart }
            });
            
            const usage = logs.reduce((sum, log) => sum + log.energyConsumed, 0);
            if (usage > 50) { // More than 50 kWh
                highUsageDevices.push({
                    deviceName: device.name,
                    usage: usage.toFixed(2),
                    suggestion: device.type === 'ac' 
                        ? 'Consider increasing temperature by 2°C' 
                        : device.type === 'heater'
                        ? 'Consider lowering temperature by 2°C'
                        : 'Consider reducing usage or enabling auto mode'
                });
            }
        }
        
        res.json({
            success: true,
            data: {
                currentUsage: currentUsage.toFixed(2),
                previousUsage: previousUsage.toFixed(2),
                energySaved: energySaved.toFixed(2),
                costSaved: costSaved.toFixed(2),
                percentageSaved: percentageSaved.toFixed(1),
                tips: highUsageDevices,
                recommendations: [
                    'Enable auto mode for HVAC devices',
                    'Use schedules for lighting',
                    'Turn off devices when not in use',
                    'Consider energy-efficient alternatives for high-usage devices'
                ]
            }
        });
    } catch (error) {
        console.error('Get energy savings error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Get energy forecast
exports.getEnergyForecast = async (req, res) => {
    try {
        // Get historical data for last 30 days
        const historical = await EnergyLog.find({
            userId: req.user._id,
            timestamp: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
        });
        
        // Group by day
        const dailyUsage = {};
        for (const log of historical) {
            const day = log.timestamp.toISOString().split('T')[0];
            dailyUsage[day] = (dailyUsage[day] || 0) + log.energyConsumed;
        }
        
        const dailyValues = Object.values(dailyUsage);
        
        // Simple linear regression for forecast
        const n = dailyValues.length;
        const indices = Array.from({ length: n }, (_, i) => i);
        
        const sumX = indices.reduce((a, b) => a + b, 0);
        const sumY = dailyValues.reduce((a, b) => a + b, 0);
        const sumXY = indices.reduce((sum, x, i) => sum + x * dailyValues[i], 0);
        const sumX2 = indices.reduce((sum, x) => sum + x * x, 0);
        
        const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
        const intercept = (sumY - slope * sumX) / n;
        
        // Forecast next 7 days
        const forecast = [];
        for (let i = 1; i <= 7; i++) {
            const predicted = slope * (n + i - 1) + intercept;
            forecast.push({
                day: i,
                predictedEnergy: Math.max(0, predicted).toFixed(2),
                predictedCost: (Math.max(0, predicted) * 0.12).toFixed(2)
            });
        }
        
        const totalForecastEnergy = forecast.reduce((sum, f) => sum + parseFloat(f.predictedEnergy), 0);
        const totalForecastCost = totalForecastEnergy * 0.12;
        
        res.json({
            success: true,
            data: {
                historical: dailyValues.map((value, i) => ({ day: i + 1, energy: value.toFixed(2) })),
                forecast,
                summary: {
                    totalForecastEnergy: totalForecastEnergy.toFixed(2),
                    totalForecastCost: totalForecastCost.toFixed(2),
                    averageDaily: (totalForecastEnergy / 7).toFixed(2)
                }
            }
        });
    } catch (error) {
        console.error('Get energy forecast error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Get energy reports
exports.getEnergyReports = async (req, res) => {
    try {
        const reports = await EnergyLog.aggregate([
            { $match: { userId: req.user._id } },
            {
                $group: {
                    _id: {
                        year: { $year: '$timestamp' },
                        month: { $month: '$timestamp' }
                    },
                    totalEnergy: { $sum: '$energyConsumed' },
                    totalCost: { $sum: { $multiply: ['$energyConsumed', 0.12] } },
                    deviceCount: { $addToSet: '$deviceId' }
                }
            },
            { $sort: { '_id.year': -1, '_id.month': -1 } }
        ]);
        
        res.json({
            success: true,
            data: reports.map(r => ({
                year: r._id.year,
                month: r._id.month,
                monthName: new Date(r._id.year, r._id.month - 1, 1).toLocaleString('default', { month: 'long' }),
                totalEnergy: r.totalEnergy.toFixed(2),
                totalCost: r.totalCost.toFixed(2),
                deviceCount: r.deviceCount.length
            }))
        });
    } catch (error) {
        console.error('Get energy reports error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Generate energy report
exports.generateEnergyReport = async (req, res) => {
    try {
        const { period = 'month' } = req.body;
        
        let startDate, endDate;
        const now = new Date();
        
        if (period === 'month') {
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        } else if (period === 'quarter') {
            const quarter = Math.floor(now.getMonth() / 3);
            startDate = new Date(now.getFullYear(), quarter * 3, 1);
            endDate = new Date(now.getFullYear(), quarter * 3 + 3, 0);
        } else if (period === 'year') {
            startDate = new Date(now.getFullYear(), 0, 1);
            endDate = new Date(now.getFullYear(), 11, 31);
        }
        
        const logs = await EnergyLog.find({
            userId: req.user._id,
            timestamp: { $gte: startDate, $lte: endDate }
        });
        
        const totalEnergy = logs.reduce((sum, log) => sum + log.energyConsumed, 0);
        const totalCost = totalEnergy * 0.12;
        
        // Group by device
        const deviceUsage = {};
        for (const log of logs) {
            if (!deviceUsage[log.deviceId]) {
                deviceUsage[log.deviceId] = 0;
            }
            deviceUsage[log.deviceId] += log.energyConsumed;
        }
        
        const devices = await Device.find({ ownerId: req.user._id });
        const deviceMap = devices.reduce((map, d) => {
            map[d._id.toString()] = d.name;
            return map;
        }, {});
        
        const report = {
            reportId: `rpt_${Date.now()}`,
            generatedAt: new Date(),
            period,
            startDate,
            endDate,
            summary: {
                totalEnergy: totalEnergy.toFixed(2),
                totalCost: totalCost.toFixed(2),
                averageDaily: (totalEnergy / ((endDate - startDate) / (1000 * 60 * 60 * 24))).toFixed(2)
            },
            deviceBreakdown: Object.entries(deviceUsage).map(([deviceId, energy]) => ({
                deviceId,
                deviceName: deviceMap[deviceId] || deviceId,
                energy: energy.toFixed(2),
                cost: (energy * 0.12).toFixed(2),
                percentage: ((energy / totalEnergy) * 100).toFixed(1)
            })),
            recommendations: [
                'Enable auto mode for frequently used devices',
                'Use scheduling to turn off devices when not needed',
                'Consider upgrading to energy-efficient devices'
            ]
        };
        
        // Save report
        const savedReport = await EnergyReport.create({
            userId: req.user._id,
            reportId: report.reportId,
            period,
            data: report,
            createdAt: new Date()
        });
        
        res.status(201).json({
            success: true,
            data: report,
            reportId: savedReport._id
        });
    } catch (error) {
        console.error('Generate energy report error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Download energy report
exports.downloadEnergyReport = async (req, res) => {
    try {
        const { id } = req.params;
        
        const report = await EnergyReport.findOne({ _id: id, userId: req.user._id });
        if (!report) {
            return res.status(404).json({
                success: false,
                message: 'Report not found'
            });
        }
        
        // Generate CSV
        const csvRows = [
            ['Report ID', report.reportId],
            ['Generated At', report.createdAt],
            ['Period', report.period],
            ['Start Date', report.data.startDate],
            ['End Date', report.data.endDate],
            [],
            ['Summary'],
            ['Total Energy (kWh)', report.data.summary.totalEnergy],
            ['Total Cost ($)', report.data.summary.totalCost],
            ['Average Daily (kWh)', report.data.summary.averageDaily],
            [],
            ['Device Breakdown'],
            ['Device Name', 'Energy (kWh)', 'Cost ($)', 'Percentage (%)']
        ];
        
        for (const device of report.data.deviceBreakdown) {
            csvRows.push([device.deviceName, device.energy, device.cost, device.percentage]);
        }
        
        csvRows.push([], ['Recommendations']);
        for (const rec of report.data.recommendations) {
            csvRows.push([rec]);
        }
        
        const csv = csvRows.map(row => row.join(',')).join('\n');
        
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=energy_report_${report.reportId}.csv`);
        res.send(csv);
    } catch (error) {
        console.error('Download energy report error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Get energy alerts
exports.getEnergyAlerts = async (req, res) => {
    try {
        const devices = await Device.find({ ownerId: req.user._id });
        const alerts = [];
        
        for (const device of devices) {
            const logs = await EnergyLog.find({
                userId: req.user._id,
                deviceId: device._id,
                timestamp: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
            });
            
            const dailyUsage = logs.reduce((sum, log) => sum + log.energyConsumed, 0);
            
            if (dailyUsage > 100 && device.power > 500) {
                alerts.push({
                    deviceId: device._id,
                    deviceName: device.name,
                    type: 'high_consumption',
                    message: `${device.name} consumed ${dailyUsage.toFixed(2)} kWh in the last 24 hours`,
                    severity: 'warning',
                    timestamp: new Date()
                });
            }
            
            if (device.state && device.autoMode) {
                const runtime = logs.reduce((sum, log) => sum + log.runtime, 0);
                if (runtime > 12 * 60 * 60 * 1000) { // More than 12 hours
                    alerts.push({
                        deviceId: device._id,
                        deviceName: device.name,
                        type: 'excessive_runtime',
                        message: `${device.name} has been running for ${(runtime / 3600000).toFixed(1)} hours today`,
                        severity: 'info',
                        timestamp: new Date()
                    });
                }
            }
        }
        
        res.json({
            success: true,
            data: alerts
        });
    } catch (error) {
        console.error('Get energy alerts error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Acknowledge energy alert
exports.acknowledgeEnergyAlert = async (req, res) => {
    try {
        const { id } = req.params;
        
        await ActivityLog.create({
            userId: req.user._id,
            action: 'energy_alert_acknowledged',
            ip: req.ip,
            userAgent: req.headers['user-agent'],
            details: { alertId: id }
        });
        
        res.json({
            success: true,
            message: 'Alert acknowledged'
        });
    } catch (error) {
        console.error('Acknowledge energy alert error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};