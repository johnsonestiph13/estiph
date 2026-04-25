/**
 * ESTIF HOME ULTIMATE - ANALYTICS CONTROLLER
 * Data analytics and insights for device usage patterns
 * Version: 2.0.0
 * Author: Estifanos Yohannis
 */

const Device = require('../models/Device');
const ActivityLog = require('../models/ActivityLog');
const EnergyLog = require('../models/EnergyLog');

// Get dashboard analytics
exports.getDashboardAnalytics = async (req, res) => {
    try {
        const devices = await Device.find({ ownerId: req.user._id });
        
        // Device statistics
        const totalDevices = devices.length;
        const activeDevices = devices.filter(d => d.state).length;
        const autoModeDevices = devices.filter(d => d.autoMode).length;
        const onlineDevices = devices.filter(d => d.online !== false).length;
        
        // Energy statistics (last 30 days)
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const energyLogs = await EnergyLog.find({
            userId: req.user._id,
            timestamp: { $gte: thirtyDaysAgo }
        });
        
        const totalEnergy = energyLogs.reduce((sum, log) => sum + log.energyConsumed, 0);
        const totalCost = totalEnergy * 0.12;
        
        // Activity statistics (last 7 days)
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const activities = await ActivityLog.find({
            userId: req.user._id,
            createdAt: { $gte: sevenDaysAgo }
        });
        
        const activityCount = activities.length;
        const uniqueDays = new Set(activities.map(a => a.createdAt.toISOString().split('T')[0])).size;
        
        // Device type distribution
        const deviceTypes = {};
        for (const device of devices) {
            deviceTypes[device.type] = (deviceTypes[device.type] || 0) + 1;
        }
        
        // Recent activity
        const recentActivities = await ActivityLog.find({ userId: req.user._id })
            .sort({ createdAt: -1 })
            .limit(10);
        
        res.json({
            success: true,
            data: {
                devices: {
                    total: totalDevices,
                    active: activeDevices,
                    autoMode: autoModeDevices,
                    online: onlineDevices
                },
                energy: {
                    totalEnergy: totalEnergy.toFixed(2),
                    totalCost: totalCost.toFixed(2),
                    averageDaily: (totalEnergy / 30).toFixed(2)
                },
                activity: {
                    total: activityCount,
                    averagePerDay: (activityCount / uniqueDays).toFixed(1)
                },
                deviceTypes,
                recentActivities
            }
        });
    } catch (error) {
        console.error('Get dashboard analytics error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Get device analytics
exports.getDeviceAnalytics = async (req, res) => {
    try {
        const { deviceId } = req.query;
        
        const filter = { ownerId: req.user._id };
        if (deviceId) filter._id = deviceId;
        
        const devices = await Device.find(filter);
        const deviceAnalytics = [];
        
        for (const device of devices) {
            // Get energy logs for this device
            const energyLogs = await EnergyLog.find({
                userId: req.user._id,
                deviceId: device._id,
                timestamp: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
            });
            
            const totalEnergy = energyLogs.reduce((sum, log) => sum + log.energyConsumed, 0);
            const totalRuntime = energyLogs.reduce((sum, log) => sum + log.runtime, 0);
            
            // Get activity logs for this device
            const activityLogs = await ActivityLog.find({
                userId: req.user._id,
                entityType: 'device',
                entityId: device._id,
                createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
            });
            
            const activityCount = activityLogs.length;
            const onEvents = activityLogs.filter(a => a.action === 'device_on').length;
            const offEvents = activityLogs.filter(a => a.action === 'device_off').length;
            
            deviceAnalytics.push({
                deviceId: device._id,
                deviceName: device.name,
                deviceType: device.type,
                power: device.power,
                autoMode: device.autoMode,
                stats: {
                    totalEnergy: totalEnergy.toFixed(2),
                    totalRuntime: (totalRuntime / 3600000).toFixed(2),
                    estimatedCost: (totalEnergy * 0.12).toFixed(2),
                    activityCount,
                    onEvents,
                    offEvents,
                    usageFrequency: activityCount / 30
                }
            });
        }
        
        res.json({
            success: true,
            data: deviceAnalytics
        });
    } catch (error) {
        console.error('Get device analytics error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Get usage analytics
exports.getUsageAnalytics = async (req, res) => {
    try {
        const { startDate, endDate, interval = 'day' } = req.query;
        
        const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const end = endDate ? new Date(endDate) : new Date();
        
        let usageData = [];
        
        if (interval === 'hour') {
            for (let d = new Date(start); d <= end; d.setHours(d.getHours() + 1)) {
                const hourStart = new Date(d);
                const hourEnd = new Date(d);
                hourEnd.setHours(hourEnd.getHours() + 1);
                
                const activities = await ActivityLog.find({
                    userId: req.user._id,
                    createdAt: { $gte: hourStart, $lt: hourEnd },
                    action: { $in: ['device_on', 'device_off'] }
                });
                
                usageData.push({
                    timestamp: hourStart,
                    count: activities.length
                });
            }
        } else if (interval === 'day') {
            for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                const dayStart = new Date(d);
                const dayEnd = new Date(d);
                dayEnd.setDate(dayEnd.getDate() + 1);
                
                const activities = await ActivityLog.find({
                    userId: req.user._id,
                    createdAt: { $gte: dayStart, $lt: dayEnd },
                    action: { $in: ['device_on', 'device_off'] }
                });
                
                usageData.push({
                    timestamp: dayStart,
                    count: activities.length
                });
            }
        }
        
        // Calculate trends
        const values = usageData.map(d => d.count);
        const trend = calculateTrend(values);
        
        res.json({
            success: true,
            data: {
                usage: usageData,
                summary: {
                    totalEvents: values.reduce((a, b) => a + b, 0),
                    averagePerDay: (values.reduce((a, b) => a + b, 0) / usageData.length).toFixed(1),
                    trend: trend > 0 ? 'increasing' : trend < 0 ? 'decreasing' : 'stable',
                    peakDay: usageData.reduce((max, d) => d.count > max.count ? d : max, usageData[0])
                }
            }
        });
    } catch (error) {
        console.error('Get usage analytics error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Get peak hours
exports.getPeakHours = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        
        const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const end = endDate ? new Date(endDate) : new Date();
        
        const activities = await ActivityLog.find({
            userId: req.user._id,
            createdAt: { $gte: start, $lte: end },
            action: { $in: ['device_on', 'device_off'] }
        });
        
        // Group by hour
        const hourlyActivity = Array(24).fill(0);
        for (const activity of activities) {
            const hour = activity.createdAt.getHours();
            hourlyActivity[hour]++;
        }
        
        // Find peak hours
        const peakHours = hourlyActivity
            .map((count, hour) => ({ hour, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);
        
        // Calculate percentages
        const total = hourlyActivity.reduce((a, b) => a + b, 0);
        const hourlyPercentages = hourlyActivity.map(count => ({
            hour: `${count.toString().padStart(2, '0')}:00`,
            percentage: total > 0 ? ((count / total) * 100).toFixed(1) : 0
        }));
        
        res.json({
            success: true,
            data: {
                hourlyDistribution: hourlyPercentages,
                peakHours,
                summary: {
                    mostActiveHour: peakHours[0]?.hour || null,
                    leastActiveHour: hourlyActivity.reduce((min, count, hour) => 
                        count < min.count ? { hour, count } : min, { hour: 0, count: Infinity }).hour || null,
                    averagePerHour: (total / 24).toFixed(1)
                }
            }
        });
    } catch (error) {
        console.error('Get peak hours error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Get trends
exports.getTrends = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        
        const start = startDate ? new Date(startDate) : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
        const end = endDate ? new Date(endDate) : new Date();
        
        // Get weekly aggregates
        const weeklyData = [];
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 7)) {
            const weekStart = new Date(d);
            const weekEnd = new Date(d);
            weekEnd.setDate(weekEnd.getDate() + 7);
            
            const energyLogs = await EnergyLog.find({
                userId: req.user._id,
                timestamp: { $gte: weekStart, $lt: weekEnd }
            });
            
            const activities = await ActivityLog.find({
                userId: req.user._id,
                createdAt: { $gte: weekStart, $lt: weekEnd },
                action: { $in: ['device_on', 'device_off'] }
            });
            
            weeklyData.push({
                week: weekStart,
                energy: energyLogs.reduce((sum, log) => sum + log.energyConsumed, 0),
                activityCount: activities.length
            });
        }
        
        // Calculate trends
        const energyValues = weeklyData.map(w => w.energy);
        const activityValues = weeklyData.map(w => w.activityCount);
        
        const energyTrend = calculateTrend(energyValues);
        const activityTrend = calculateTrend(activityValues);
        
        // Calculate moving averages (3-week)
        const movingAverage = [];
        for (let i = 2; i < energyValues.length; i++) {
            const avg = (energyValues[i-2] + energyValues[i-1] + energyValues[i]) / 3;
            movingAverage.push(avg);
        }
        
        res.json({
            success: true,
            data: {
                weekly: weeklyData,
                trends: {
                    energy: {
                        direction: energyTrend > 0 ? 'up' : energyTrend < 0 ? 'down' : 'stable',
                        percentage: Math.abs(energyTrend * 100).toFixed(1)
                    },
                    activity: {
                        direction: activityTrend > 0 ? 'up' : activityTrend < 0 ? 'down' : 'stable',
                        percentage: Math.abs(activityTrend * 100).toFixed(1)
                    }
                },
                movingAverage: movingAverage.map((avg, i) => ({
                    week: weeklyData[i + 2].week,
                    average: avg.toFixed(2)
                })),
                forecast: generateForecast(energyValues, 4)
            }
        });
    } catch (error) {
        console.error('Get trends error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Get predictions
exports.getPredictions = async (req, res) => {
    try {
        // Get historical data for predictions
        const historical = await EnergyLog.find({
            userId: req.user._id,
            timestamp: { $gte: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000) }
        });
        
        // Group by day
        const dailyUsage = {};
        for (const log of historical) {
            const day = log.timestamp.toISOString().split('T')[0];
            dailyUsage[day] = (dailyUsage[day] || 0) + log.energyConsumed;
        }
        
        const dailyValues = Object.values(dailyUsage);
        
        // Time series prediction using linear regression
        const n = dailyValues.length;
        const indices = Array.from({ length: n }, (_, i) => i);
        
        const sumX = indices.reduce((a, b) => a + b, 0);
        const sumY = dailyValues.reduce((a, b) => a + b, 0);
        const sumXY = indices.reduce((sum, x, i) => sum + x * dailyValues[i], 0);
        const sumX2 = indices.reduce((sum, x) => sum + x * x, 0);
        
        const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
        const intercept = (sumY - slope * sumX) / n;
        
        // Predict next 7 days
        const predictions = [];
        for (let i = 1; i <= 7; i++) {
            const predicted = slope * (n + i - 1) + intercept;
            predictions.push({
                day: i,
                predictedEnergy: Math.max(0, predicted).toFixed(2),
                predictedCost: (Math.max(0, predicted) * 0.12).toFixed(2),
                confidence: calculateConfidence(dailyValues, predicted)
            });
        }
        
        // Predict peak hours for tomorrow
        const lastWeek = await ActivityLog.find({
            userId: req.user._id,
            createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
            action: { $in: ['device_on', 'device_off'] }
        });
        
        const hourlyPattern = Array(24).fill(0);
        for (const activity of lastWeek) {
            const hour = activity.createdAt.getHours();
            hourlyPattern[hour]++;
        }
        
        const predictedPeakHour = hourlyPattern.indexOf(Math.max(...hourlyPattern));
        
        res.json({
            success: true,
            data: {
                energyPredictions: predictions,
                peakHourPrediction: {
                    hour: predictedPeakHour,
                    formatted: `${predictedPeakHour.toString().padStart(2, '0')}:00`,
                    expectedActivity: Math.round(hourlyPattern[predictedPeakHour] / 7)
                },
                confidence: {
                    overall: calculateOverallConfidence(dailyValues),
                    factors: [
                        'Historical data availability',
                        'Pattern consistency',
                        'Seasonal variations'
                    ]
                }
            }
        });
    } catch (error) {
        console.error('Get predictions error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Get insights
exports.getInsights = async (req, res) => {
    try {
        const devices = await Device.find({ ownerId: req.user._id });
        const energyLogs = await EnergyLog.find({
            userId: req.user._id,
            timestamp: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
        });
        
        const totalEnergy = energyLogs.reduce((sum, log) => sum + log.energyConsumed, 0);
        const topDevice = await getTopEnergyDevice(req.user._id);
        
        const insights = [];
        
        // Insight 1: High usage devices
        if (topDevice && topDevice.energy > totalEnergy * 0.3) {
            insights.push({
                type: 'warning',
                title: 'High Energy Consumer',
                message: `${topDevice.name} accounts for ${((topDevice.energy / totalEnergy) * 100).toFixed(1)}% of your energy consumption.`,
                action: 'Consider enabling auto mode or scheduling for this device.'
            });
        }
        
        // Insight 2: Auto mode benefit
        const autoModeDevices = devices.filter(d => d.autoMode);
        const manualDevices = devices.filter(d => !d.autoMode);
        
        if (autoModeDevices.length > 0 && manualDevices.length > 0) {
            insights.push({
                type: 'info',
                title: 'Auto Mode Benefits',
                message: `You have ${autoModeDevices.length} devices in auto mode. This helps optimize energy usage.`,
                action: 'Consider enabling auto mode for more devices.'
            });
        }
        
        // Insight 3: Offline devices
        const offlineDevices = devices.filter(d => d.online === false);
        if (offlineDevices.length > 0) {
            insights.push({
                type: 'warning',
                title: 'Offline Devices',
                message: `${offlineDevices.length} device(s) are currently offline.`,
                action: 'Check your network connection and device status.'
            });
        }
        
        // Insight 4: Peak usage time
        const lastWeek = await ActivityLog.find({
            userId: req.user._id,
            createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
            action: { $in: ['device_on', 'device_off'] }
        });
        
        const hourlyActivity = Array(24).fill(0);
        for (const activity of lastWeek) {
            hourlyActivity[activity.createdAt.getHours()]++;
        }
        
        const peakHour = hourlyActivity.indexOf(Math.max(...hourlyActivity));
        if (peakHour >= 0) {
            insights.push({
                type: 'info',
                title: 'Peak Usage Time',
                message: `Your devices are most active around ${peakHour}:00.`,
                action: 'Consider scheduling non-essential devices outside peak hours.'
            });
        }
        
        // Insight 5: Energy saving potential
        const potentialSavings = totalEnergy * 0.15;
        if (potentialSavings > 10) {
            insights.push({
                type: 'success',
                title: 'Energy Saving Opportunity',
                message: `You could save approximately ${potentialSavings.toFixed(2)} kWh per month by optimizing device usage.`,
                action: 'Review device schedules and auto mode settings.'
            });
        }
        
        res.json({
            success: true,
            data: insights
        });
    } catch (error) {
        console.error('Get insights error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Export analytics
exports.exportAnalytics = async (req, res) => {
    try {
        const { format = 'json', startDate, endDate } = req.query;
        
        const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const end = endDate ? new Date(endDate) : new Date();
        
        // Collect all analytics data
        const devices = await Device.find({ ownerId: req.user._id });
        const energyLogs = await EnergyLog.find({
            userId: req.user._id,
            timestamp: { $gte: start, $lte: end }
        });
        const activities = await ActivityLog.find({
            userId: req.user._id,
            createdAt: { $gte: start, $lte: end }
        });
        
        const exportData = {
            exportedAt: new Date(),
            period: { start, end },
            devices: devices.map(d => ({
                id: d._id,
                name: d.name,
                type: d.type,
                room: d.room,
                power: d.power,
                autoMode: d.autoMode,
                state: d.state
            })),
            energy: {
                total: energyLogs.reduce((sum, log) => sum + log.energyConsumed, 0).toFixed(2),
                logs: energyLogs.map(log => ({
                    timestamp: log.timestamp,
                    deviceId: log.deviceId,
                    energy: log.energyConsumed,
                    runtime: log.runtime
                }))
            },
            activity: {
                total: activities.length,
                logs: activities.map(a => ({
                    timestamp: a.createdAt,
                    action: a.action,
                    entityType: a.entityType,
                    details: a.details
                }))
            }
        };
        
        if (format === 'json') {
            res.json({
                success: true,
                data: exportData
            });
        } else if (format === 'csv') {
            // Generate CSV
            const csvRows = [
                ['Analytics Export', new Date().toISOString()],
                [],
                ['Devices'],
                ['ID', 'Name', 'Type', 'Room', 'Power (W)', 'Auto Mode', 'State']
            ];
            
            for (const device of exportData.devices) {
                csvRows.push([device.id, device.name, device.type, device.room, device.power, device.autoMode, device.state]);
            }
            
            csvRows.push([], ['Energy Logs']);
            csvRows.push(['Timestamp', 'Device ID', 'Energy (kWh)', 'Runtime (ms)']);
            
            for (const log of exportData.energy.logs) {
                csvRows.push([log.timestamp, log.deviceId, log.energy, log.runtime]);
            }
            
            csvRows.push([], ['Activity Logs']);
            csvRows.push(['Timestamp', 'Action', 'Entity Type', 'Details']);
            
            for (const log of exportData.activity.logs) {
                csvRows.push([log.timestamp, log.action, log.entityType, JSON.stringify(log.details)]);
            }
            
            const csv = csvRows.map(row => row.join(',')).join('\n');
            
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', 'attachment; filename=analytics_export.csv');
            res.send(csv);
        } else {
            res.status(400).json({
                success: false,
                message: 'Unsupported format'
            });
        }
    } catch (error) {
        console.error('Export analytics error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Get custom analytics
exports.getCustomAnalytics = async (req, res) => {
    try {
        const { metric, groupBy, startDate, endDate } = req.query;
        
        const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const end = endDate ? new Date(endDate) : new Date();
        
        let data = [];
        
        if (metric === 'device_usage') {
            // Group by device
            const devices = await Device.find({ ownerId: req.user._id });
            
            for (const device of devices) {
                const logs = await EnergyLog.find({
                    userId: req.user._id,
                    deviceId: device._id,
                    timestamp: { $gte: start, $lte: end }
                });
                
                const totalEnergy = logs.reduce((sum, log) => sum + log.energyConsumed, 0);
                const totalRuntime = logs.reduce((sum, log) => sum + log.runtime, 0);
                
                data.push({
                    group: device.name,
                    value: totalEnergy,
                    secondaryValue: totalRuntime,
                    unit: 'kWh'
                });
            }
        } else if (metric === 'hourly_activity') {
            // Group by hour
            const activities = await ActivityLog.find({
                userId: req.user._id,
                createdAt: { $gte: start, $lte: end },
                action: { $in: ['device_on', 'device_off'] }
            });
            
            const hourlyData = Array(24).fill(0);
            for (const activity of activities) {
                const hour = activity.createdAt.getHours();
                hourlyData[hour]++;
            }
            
            data = hourlyData.map((count, hour) => ({
                group: `${hour}:00`,
                value: count,
                unit: 'events'
            }));
        } else if (metric === 'daily_energy') {
            // Group by day
            const dayMap = new Map();
            
            for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                const dayStart = new Date(d);
                const dayEnd = new Date(d);
                dayEnd.setDate(dayEnd.getDate() + 1);
                
                const logs = await EnergyLog.find({
                    userId: req.user._id,
                    timestamp: { $gte: dayStart, $lt: dayEnd }
                });
                
                const totalEnergy = logs.reduce((sum, log) => sum + log.energyConsumed, 0);
                dayMap.set(dayStart.toISOString().split('T')[0], totalEnergy);
            }
            
            data = Array.from(dayMap.entries()).map(([day, energy]) => ({
                group: day,
                value: energy,
                unit: 'kWh'
            }));
        } else if (metric === 'device_type_distribution') {
            // Group by device type
            const devices = await Device.find({ ownerId: req.user._id });
            const typeMap = new Map();
            
            for (const device of devices) {
                typeMap.set(device.type, (typeMap.get(device.type) || 0) + 1);
            }
            
            data = Array.from(typeMap.entries()).map(([type, count]) => ({
                group: type,
                value: count,
                unit: 'devices'
            }));
        }
        
        res.json({
            success: true,
            data
        });
    } catch (error) {
        console.error('Get custom analytics error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Helper functions
function calculateTrend(values) {
    if (values.length < 2) return 0;
    
    const n = values.length;
    const x = Array.from({ length: n }, (_, i) => i);
    const y = values;
    
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const avgY = sumY / n;
    
    return slope / avgY;
}

function generateForecast(values, periods) {
    const n = values.length;
    const indices = Array.from({ length: n }, (_, i) => i);
    
    const sumX = indices.reduce((a, b) => a + b, 0);
    const sumY = values.reduce((a, b) => a + b, 0);
    const sumXY = indices.reduce((sum, x, i) => sum + x * values[i], 0);
    const sumX2 = indices.reduce((sum, x) => sum + x * x, 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    
    const forecast = [];
    for (let i = 1; i <= periods; i++) {
        forecast.push({
            period: i,
            value: Math.max(0, slope * (n + i - 1) + intercept)
        });
    }
    
    return forecast;
}

async function getTopEnergyDevice(userId) {
    const energyLogs = await EnergyLog.aggregate([
        { $match: { userId } },
        {
            $group: {
                _id: '$deviceId',
                totalEnergy: { $sum: '$energyConsumed' }
            }
        },
        { $sort: { totalEnergy: -1 } },
        { $limit: 1 }
    ]);
    
    if (energyLogs.length === 0) return null;
    
    const device = await Device.findById(energyLogs[0]._id);
    if (!device) return null;
    
    return {
        id: device._id,
        name: device.name,
        energy: energyLogs[0].totalEnergy
    };
}

function calculateConfidence(values, predicted) {
    if (values.length < 10) return 0.5;
    
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);
    
    const error = Math.abs(predicted - mean);
    const confidence = Math.max(0, Math.min(1, 1 - (error / (stdDev * 2))));
    
    return confidence;
}

function calculateOverallConfidence(values) {
    if (values.length < 30) return 0.6;
    if (values.length < 60) return 0.7;
    if (values.length < 90) return 0.8;
    return 0.9;
}