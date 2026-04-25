const bull = require('bull');
const ActivityLog = require('../models/ActivityLog');
const DeviceHistory = require('../models/DeviceHistory');
const EnergyLog = require('../models/EnergyLog');
const Session = require('../models/Session');
const Backup = require('../models/Backup');
const fs = require('fs');
const path = require('path');
const { logger } = require('../utils/logger');

const cleanupQueue = new bull('cleanup', process.env.REDIS_URL);

cleanupQueue.process(async (job) => {
    const { daysToKeep = 90 } = job.data;
    const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);
    
    try {
        const [activityDeleted, historyDeleted, energyDeleted, sessionsDeleted] = await Promise.all([
            ActivityLog.deleteMany({ createdAt: { $lt: cutoffDate } }),
            DeviceHistory.deleteMany({ createdAt: { $lt: cutoffDate } }),
            EnergyLog.deleteMany({ timestamp: { $lt: cutoffDate } }),
            Session.deleteMany({ expiresAt: { $lt: new Date() } })
        ]);
        
        const expiredBackups = await Backup.find({ expiresAt: { $lt: new Date() } });
        for (const backup of expiredBackups) {
            if (backup.filePath) {
                const filePath = path.join(__dirname, '../backups', `${backup._id}.zip`);
                if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
            }
            await backup.deleteOne();
        }
        
        logger.info(`Cleanup completed: Activity:${activityDeleted.deletedCount}, History:${historyDeleted.deletedCount}, Energy:${energyDeleted.deletedCount}, Sessions:${sessionsDeleted.deletedCount}, Backups:${expiredBackups.length}`);
        
        return { activityDeleted, historyDeleted, energyDeleted, sessionsDeleted, backupsDeleted: expiredBackups.length };
    } catch (error) {
        logger.error(`Cleanup failed: ${error.message}`);
        throw error;
    }
});

const addCleanupJob = async (daysToKeep = 90, delay = 0) => {
    return cleanupQueue.add({ daysToKeep }, { delay, repeat: { cron: '0 2 * * *' } });
};

module.exports = { cleanupQueue, addCleanupJob };