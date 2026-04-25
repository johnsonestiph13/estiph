const bull = require('bull');
const ExcelJS = require('exceljs');
const Device = require('../models/Device');
const EnergyLog = require('../models/EnergyLog');
const ActivityLog = require('../models/ActivityLog');
const { uploadToS3 } = require('../config/storage');
const { logger } = require('../utils/logger');
const fs = require('fs');
const path = require('path');

const reportQueue = new bull('reports', process.env.REDIS_URL);

reportQueue.process(async (job) => {
    const { userId, reportId, period = 'month' } = job.data;
    
    try {
        const endDate = new Date();
        let startDate = new Date();
        if (period === 'month') startDate.setMonth(startDate.getMonth() - 1);
        else if (period === 'quarter') startDate.setMonth(startDate.getMonth() - 3);
        else if (period === 'year') startDate.setFullYear(startDate.getFullYear() - 1);
        
        const [devices, energyLogs, activities] = await Promise.all([
            Device.find({ ownerId: userId }),
            EnergyLog.find({ userId, timestamp: { $gte: startDate, $lte: endDate } }),
            ActivityLog.find({ userId, createdAt: { $gte: startDate, $lte: endDate } })
        ]);
        
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Energy Report');
        
        sheet.columns = [
            { header: 'Date', key: 'date', width: 15 },
            { header: 'Device', key: 'device', width: 20 },
            { header: 'Energy (kWh)', key: 'energy', width: 15 },
            { header: 'Cost ($)', key: 'cost', width: 15 },
            { header: 'Runtime (hours)', key: 'runtime', width: 15 }
        ];
        
        const totalEnergy = energyLogs.reduce((sum, log) => sum + log.energyConsumed, 0);
        
        sheet.addRow({ date: 'TOTAL', device: 'All Devices', energy: totalEnergy.toFixed(2), cost: (totalEnergy * 0.12).toFixed(2), runtime: '-' });
        sheet.addRow({});
        
        for (const log of energyLogs.slice(0, 100)) {
            const device = devices.find(d => d._id.toString() === log.deviceId.toString());
            sheet.addRow({
                date: log.timestamp.toISOString().split('T')[0],
                device: device?.name || 'Unknown',
                energy: log.energyConsumed.toFixed(2),
                cost: (log.energyConsumed * 0.12).toFixed(2),
                runtime: (log.runtime / 3600000).toFixed(2)
            });
        }
        
        const reportDir = path.join(__dirname, '../reports');
        if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir, { recursive: true });
        
        const filePath = path.join(reportDir, `${reportId}.xlsx`);
        await workbook.xlsx.writeFile(filePath);
        
        const s3Url = await uploadToS3({ path: filePath, mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }, `reports/${reportId}.xlsx`);
        
        fs.unlinkSync(filePath);
        
        logger.info(`Report ${reportId} generated for user ${userId}`);
        return { url: s3Url };
    } catch (error) {
        logger.error(`Report generation failed: ${error.message}`);
        throw error;
    }
});

const addReportJob = async (userId, reportId, period = 'month', delay = 0) => {
    return reportQueue.add({ userId, reportId, period }, { delay, attempts: 2 });
};

module.exports = { reportQueue, addReportJob };