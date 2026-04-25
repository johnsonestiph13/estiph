const bull = require('bull');
const fs = require('fs');
const path = require('path');
const archiver = require('archiver');
const Backup = require('../models/Backup');
const Device = require('../models/Device');
const Home = require('../models/Home');
const Automation = require('../models/Automation');
const { uploadToS3 } = require('../config/storage');
const { logger } = require('../utils/logger');

const backupQueue = new bull('backups', process.env.REDIS_URL);

backupQueue.process(async (job) => {
    const { userId, backupId } = job.data;
    
    try {
        const backup = await Backup.findById(backupId);
        if (!backup) throw new Error('Backup not found');
        
        backup.status = 'processing';
        await backup.save();
        
        const backupData = { devices: [], homes: [], automations: [] };
        
        backupData.devices = await Device.find({ ownerId: userId });
        backupData.homes = await Home.find({ ownerId: userId });
        backupData.automations = await Automation.find({ userId });
        
        const backupDir = path.join(__dirname, '../backups');
        if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
        
        const filePath = path.join(backupDir, `${backupId}.json`);
        fs.writeFileSync(filePath, JSON.stringify(backupData, null, 2));
        
        const zipPath = path.join(backupDir, `${backupId}.zip`);
        const output = fs.createWriteStream(zipPath);
        const archive = archiver('zip', { zlib: { level: 9 } });
        
        archive.pipe(output);
        archive.file(filePath, { name: 'backup.json' });
        await archive.finalize();
        
        const s3Url = await uploadToS3({ path: zipPath, mimetype: 'application/zip' }, `backups/${backupId}.zip`);
        
        backup.status = 'completed';
        backup.size = fs.statSync(zipPath).size;
        backup.filePath = s3Url;
        backup.completedAt = new Date();
        await backup.save();
        
        fs.unlinkSync(filePath);
        fs.unlinkSync(zipPath);
        
        logger.info(`Backup ${backupId} completed for user ${userId}`);
        return backup;
    } catch (error) {
        await Backup.findByIdAndUpdate(backupId, { status: 'failed', error: error.message });
        logger.error(`Backup failed: ${error.message}`);
        throw error;
    }
});

const addBackupJob = async (userId, backupId, delay = 0) => {
    return backupQueue.add({ userId, backupId }, { delay, attempts: 2 });
};

module.exports = { backupQueue, addBackupJob };