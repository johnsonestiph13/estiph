const cron = require('node-cron');
const User = require('../models/User');
const Backup = require('../models/Backup');
const { addBackupJob } = require('../workers/backupWorker');
const { logger } = require('../utils/logger');

// Run every Sunday at 3:00 AM
const weeklyBackup = cron.schedule('0 3 * * 0', async () => {
    logger.info('Starting weekly backup job...');
    const startTime = Date.now();
    
    try {
        const users = await User.find({ isActive: true }).select('_id');
        let backupCount = 0;
        
        for (const user of users) {
            const backup = await Backup.create({
                userId: user._id,
                name: `weekly_backup_${new Date().toISOString().split('T')[0]}`,
                type: 'full',
                status: 'pending',
                createdAt: new Date()
            });
            
            await addBackupJob(user._id, backup._id);
            backupCount++;
        }
        
        const duration = Date.now() - startTime;
        logger.info(`Weekly backup completed in ${duration}ms - Backups created: ${backupCount}`);
        
    } catch (error) {
        logger.error(`Weekly backup failed: ${error.message}`);
    }
}, { scheduled: true, timezone: 'Africa/Addis_Ababa' });

const startWeeklyBackup = () => {
    weeklyBackup.start();
    logger.info('Weekly backup cron job started');
};

const stopWeeklyBackup = () => {
    weeklyBackup.stop();
    logger.info('Weekly backup cron job stopped');
};

module.exports = { weeklyBackup, startWeeklyBackup, stopWeeklyBackup };