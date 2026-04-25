const cron = require('node-cron');
const mongoose = require('mongoose');
const { getRedis } = require('../config/redis');
const { getMQTTClient } = require('../config/mqtt');
const { logger } = require('../utils/logger');
const os = require('os');

// Run every 5 minutes
const healthCheck = cron.schedule('*/5 * * * *', async () => {
    const startTime = Date.now();
    const healthStatus = {
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        services: {},
        system: {}
    };
    
    try {
        // Database check
        const dbState = mongoose.connection.readyState;
        healthStatus.services.database = {
            status: dbState === 1 ? 'connected' : 'disconnected',
            readyState: dbState
        };
        
        // Redis check
        try {
            const redis = getRedis();
            const redisPing = await redis.ping();
            healthStatus.services.redis = {
                status: redisPing === 'PONG' ? 'connected' : 'error',
                latency: Date.now() - startTime
            };
        } catch (error) {
            healthStatus.services.redis = { status: 'disconnected', error: error.message };
        }
        
        // MQTT check
        const mqttClient = getMQTTClient();
        healthStatus.services.mqtt = {
            status: mqttClient && mqttClient.connected ? 'connected' : 'disconnected',
            connected: mqttClient?.connected || false
        };
        
        // System health
        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        healthStatus.system = {
            memory: {
                total: (totalMem / 1024 / 1024 / 1024).toFixed(2) + ' GB',
                free: (freeMem / 1024 / 1024 / 1024).toFixed(2) + ' GB',
                usedPercent: ((totalMem - freeMem) / totalMem * 100).toFixed(2) + '%'
            },
            cpu: {
                cores: os.cpus().length,
                loadAverage: os.loadavg()
            },
            platform: os.platform(),
            hostname: os.hostname()
        };
        
        const duration = Date.now() - startTime;
        healthStatus.responseTime = duration;
        
        const isHealthy = healthStatus.services.database.status === 'connected' && 
                         healthStatus.services.redis.status === 'connected';
        
        healthStatus.overall = isHealthy ? 'healthy' : 'degraded';
        
        if (!isHealthy) {
            logger.warn(`Health check warning: ${JSON.stringify(healthStatus.services)}`);
        } else {
            logger.debug(`Health check passed in ${duration}ms`);
        }
        
        // Store health status in Redis for API access
        const redis = getRedis();
        await redis.set('system:health', JSON.stringify(healthStatus), 'EX', 300);
        
    } catch (error) {
        logger.error(`Health check failed: ${error.message}`);
    }
}, { scheduled: true, timezone: 'Africa/Addis_Ababa' });

const startHealthCheck = () => {
    healthCheck.start();
    logger.info('Health check cron job started');
};

const stopHealthCheck = () => {
    healthCheck.stop();
    logger.info('Health check cron job stopped');
};

module.exports = { healthCheck, startHealthCheck, stopHealthCheck };