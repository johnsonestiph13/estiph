/**
 * ESTIF HOME ULTIMATE - HEALTH SERVICE
 * System health checks and status reporting
 * Version: 2.0.0
 */

const mongoose = require('mongoose');
const { getRedis } = require('../../config/redis');
const { getMQTTClient } = require('../communication/mqttService');
const { logger } = require('../../utils/logger');
const os = require('os');

class HealthService {
    async checkHealth() {
        const startTime = Date.now();
        
        const health = {
            status: 'healthy',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            services: {
                database: await this.checkDatabase(),
                redis: await this.checkRedis(),
                mqtt: this.checkMQTT(),
                websocket: this.checkWebSocket()
            },
            system: this.getSystemInfo()
        };
        
        const hasIssue = Object.values(health.services).some(s => s.status !== 'healthy');
        if (hasIssue) health.status = 'degraded';
        
        health.responseTime = Date.now() - startTime;
        
        return health;
    }

    async checkDatabase() {
        try {
            if (mongoose.connection.readyState !== 1) {
                return { status: 'unhealthy', message: 'Database not connected' };
            }
            
            await mongoose.connection.db.admin().ping();
            return { status: 'healthy', message: 'Database connected' };
        } catch (error) {
            return { status: 'unhealthy', message: error.message };
        }
    }

    async checkRedis() {
        try {
            const redis = getRedis();
            await redis.ping();
            return { status: 'healthy', message: 'Redis connected' };
        } catch (error) {
            return { status: 'unhealthy', message: error.message };
        }
    }

    checkMQTT() {
        const mqttClient = getMQTTClient();
        if (!mqttClient || !mqttClient.connected) {
            return { status: 'unhealthy', message: 'MQTT not connected' };
        }
        return { status: 'healthy', message: 'MQTT connected' };
    }

    checkWebSocket() {
        const io = require('../../config/websocket').getIO();
        if (!io) {
            return { status: 'degraded', message: 'WebSocket not initialized' };
        }
        return { status: 'healthy', message: 'WebSocket ready' };
    }

    getSystemInfo() {
        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        
        return {
            platform: os.platform(),
            hostname: os.hostname(),
            cores: os.cpus().length,
            memory: {
                total: (totalMem / 1024 / 1024 / 1024).toFixed(2) + ' GB',
                free: (freeMem / 1024 / 1024 / 1024).toFixed(2) + ' GB',
                usedPercent: ((totalMem - freeMem) / totalMem * 100).toFixed(2) + '%'
            },
            loadAverage: os.loadavg(),
            uptime: os.uptime()
        };
    }

    async getReadiness() {
        const dbReady = mongoose.connection.readyState === 1;
        const redisReady = await this.checkRedis();
        
        const ready = dbReady && redisReady.status === 'healthy';
        
        return {
            ready,
            components: {
                database: dbReady,
                redis: redisReady.status === 'healthy'
            }
        };
    }

    getLiveness() {
        return {
            alive: true,
            uptime: process.uptime(),
            timestamp: new Date().toISOString()
        };
    }
}

module.exports = new HealthService();