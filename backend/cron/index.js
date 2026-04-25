const { startDailyCleanup } = require('./dailyCleanup');
const { startHourlyAnalytics } = require('./hourlyAnalytics');
const { startWeeklyBackup } = require('./weeklyBackup');
const { startMonthlyReport } = require('./monthlyReport');
const { startSessionCleanup } = require('./sessionCleanup');
const { startHealthCheck } = require('./healthCheck');
const { logger } = require('../utils/logger');

const startAllCronJobs = () => {
    logger.info('Starting all cron jobs...');
    
    startDailyCleanup();
    startHourlyAnalytics();
    startWeeklyBackup();
    startMonthlyReport();
    startSessionCleanup();
    startHealthCheck();
    
    logger.info('All cron jobs started successfully');
};

const stopAllCronJobs = () => {
    logger.info('Stopping all cron jobs...');
    
    // Individual stop functions would be called here
    // This is a placeholder for graceful shutdown
    
    logger.info('All cron jobs stopped');
};

module.exports = {
    startAllCronJobs,
    stopAllCronJobs
};