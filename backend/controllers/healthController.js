/**
 * ESTIF HOME ULTIMATE - HEALTH CONTROLLER
 * System health monitoring and status endpoints
 * Version: 2.0.0
 * Author: Estifanos Yohannis
 */

const os = require('os');
const mongoose = require('mongoose');
const redis = require('../../config/redis');

// Get system health
exports.getHealth = async (req, res) => {
    try {
        const health = {
            status: 'healthy',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            services: {
                database: await checkDatabaseHealth(),
                redis: await checkRedisHealth(),
                mqtt: await checkMQTTHealth(),
                websocket: checkWebSocketHealth()
            },
            system: {
                memory: {
                    total: os.totalmem(),
                    free: os.freemem(),
                    used: os.totalmem() - os.freemem(),
                    usagePercent: ((os.totalmem() - os.freemem()) / os.totalmem() * 100).toFixed(2)
                },
                cpu: {
                    loadAverage: os.loadavg(),
                    cores: os.cpus().length
                },
                platform: os.platform(),
                hostname: os.hostname(),
                uptime: os.uptime()
            },
            version: require('../../package.json').version
        };

        // Determine overall status
        const hasIssue = Object.values(health.services).some(s => !s.healthy);
        if (hasIssue) {
            health.status = 'degraded';
        }

        res.json({
            success: true,
            data: health
        });
    } catch (error) {
        console.error('Get health error:', error);
        res.status(500).json({
            success: false,
            message: 'Health check failed',
            error: error.message
        });
    }
};

// Get detailed system status
exports.getStatus = async (req, res) => {
    try {
        const status = {
            status: 'operational',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            services: {
                database: await getDatabaseStatus(),
                redis: await getRedisStatus(),
                mqtt: getMQTTStatus(),
                websocket: getWebSocketStatus()
            },
            performance: {
                responseTime: req.responseTime || 0,
                activeRequests: process._getActiveRequests().length,
                activeHandles: process._getActiveHandles().length,
                memoryUsage: process.memoryUsage(),
                cpuUsage: process.cpuUsage()
            },
            environment: {
                nodeVersion: process.version,
                platform: process.platform,
                env: process.env.NODE_ENV || 'development',
                pid: process.pid
            }
        };

        res.json({
            success: true,
            data: status
        });
    } catch (error) {
        console.error('Get status error:', error);
        res.status(500).json({
            success: false,
            message: 'Status check failed',
            error: error.message
        });
    }
};

// Get metrics
exports.getMetrics = async (req, res) => {
    try {
        const metrics = {
            timestamp: new Date().toISOString(),
            system: {
                cpu: {
                    usage: process.cpuUsage(),
                    loadAverage: os.loadavg(),
                    cores: os.cpus().length
                },
                memory: {
                    total: os.totalmem(),
                    free: os.freemem(),
                    used: os.totalmem() - os.freemem(),
                    usagePercent: ((os.totalmem() - os.freemem()) / os.totalmem() * 100).toFixed(2),
                    rss: process.memoryUsage().rss,
                    heapTotal: process.memoryUsage().heapTotal,
                    heapUsed: process.memoryUsage().heapUsed,
                    external: process.memoryUsage().external
                },
                uptime: {
                    system: os.uptime(),
                    process: process.uptime()
                }
            },
            database: await getDatabaseMetrics(),
            redis: await getRedisMetrics()
        };

        res.json({
            success: true,
            data: metrics
        });
    } catch (error) {
        console.error('Get metrics error:', error);
        res.status(500).json({
            success: false,
            message: 'Metrics retrieval failed',
            error: error.message
        });
    }
};

// Get readiness probe
exports.getReadiness = async (req, res) => {
    try {
        const databaseReady = mongoose.connection.readyState === 1;
        const redisReady = redis && redis.status === 'ready';

        if (databaseReady && redisReady) {
            res.json({
                success: true,
                status: 'ready',
                timestamp: new Date().toISOString()
            });
        } else {
            res.status(503).json({
                success: false,
                status: 'not ready',
                timestamp: new Date().toISOString(),
                details: {
                    database: databaseReady ? 'ready' : 'not ready',
                    redis: redisReady ? 'ready' : 'not ready'
                }
            });
        }
    } catch (error) {
        console.error('Get readiness error:', error);
        res.status(503).json({
            success: false,
            message: 'Readiness check failed',
            error: error.message
        });
    }
};

// Get liveness probe
exports.getLiveness = (req, res) => {
    res.json({
        success: true,
        status: 'alive',
        timestamp: new Date().toISOString()
    });
};

// Helper functions
async function checkDatabaseHealth() {
    try {
        if (mongoose.connection.readyState !== 1) {
            return { healthy: false, message: 'Database not connected' };
        }
        
        await mongoose.connection.db.admin().ping();
        return { healthy: true, message: 'Database is healthy' };
    } catch (error) {
        return { healthy: false, message: error.message };
    }
}

async function checkRedisHealth() {
    try {
        if (!redis || redis.status !== 'ready') {
            return { healthy: false, message: 'Redis not connected' };
        }
        
        await redis.ping();
        return { healthy: true, message: 'Redis is healthy' };
    } catch (error) {
        return { healthy: false, message: error.message };
    }
}

async function checkMQTTHealth() {
    try {
        // Check MQTT connection status
        const mqttClient = global.mqttClient;
        if (!mqttClient || !mqttClient.connected) {
            return { healthy: false, message: 'MQTT not connected' };
        }
        return { healthy: true, message: 'MQTT is healthy' };
    } catch (error) {
        return { healthy: false, message: error.message };
    }
}

function checkWebSocketHealth() {
    try {
        const io = global.io;
        if (!io) {
            return { healthy: false, message: 'WebSocket not initialized' };
        }
        return { healthy: true, message: 'WebSocket is healthy' };
    } catch (error) {
        return { healthy: false, message: error.message };
    }
}

async function getDatabaseStatus() {
    try {
        const stats = await mongoose.connection.db.stats();
        return {
            healthy: true,
            connected: mongoose.connection.readyState === 1,
            stats: {
                collections: stats.collections,
                objects: stats.objects,
                dataSize: stats.dataSize,
                storageSize: stats.storageSize,
                indexes: stats.indexes,
                indexSize: stats.indexSize
            }
        };
    } catch (error) {
        return {
            healthy: false,
            connected: false,
            error: error.message
        };
    }
}

async function getRedisStatus() {
    try {
        const info = await redis.info();
        const memory = await redis.info('memory');
        
        return {
            healthy: true,
            connected: redis.status === 'ready',
            info: {
                version: info.match(/redis_version:(\d+\.\d+\.\d+)/)?.[1] || 'unknown',
                uptime: info.match(/uptime_in_seconds:(\d+)/)?.[1] || '0',
                connectedClients: info.match(/connected_clients:(\d+)/)?.[1] || '0',
                usedMemory: memory.match(/used_memory_human:(\d+\.\d+[KMGT]?)/)?.[1] || '0',
                totalConnections: info.match(/total_connections_received:(\d+)/)?.[1] || '0',
                totalCommands: info.match(/total_commands_processed:(\d+)/)?.[1] || '0'
            }
        };
    } catch (error) {
        return {
            healthy: false,
            connected: false,
            error: error.message
        };
    }
}

function getMQTTStatus() {
    const mqttClient = global.mqttClient;
    return {
        healthy: mqttClient && mqttClient.connected,
        connected: mqttClient && mqttClient.connected,
        details: mqttClient ? {
            connected: mqttClient.connected,
            reconnecting: mqttClient.reconnecting
        } : { connected: false }
    };
}

function getWebSocketStatus() {
    const io = global.io;
    return {
        healthy: !!io,
        connected: !!io,
        details: io ? {
            connections: io.engine?.clientsCount || 0,
            rooms: Object.keys(io.sockets?.adapter?.rooms || {}).length || 0
        } : { connected: false }
    };
}

async function getDatabaseMetrics() {
    try {
        const stats = await mongoose.connection.db.stats();
        return {
            collections: stats.collections,
            objects: stats.objects,
            dataSize: stats.dataSize,
            storageSize: stats.storageSize,
            indexes: stats.indexes,
            indexSize: stats.indexSize,
            averageObjectSize: stats.avgObjSize
        };
    } catch (error) {
        return { error: error.message };
    }
}

async function getRedisMetrics() {
    try {
        const info = await redis.info();
        return {
            version: info.match(/redis_version:(\d+\.\d+\.\d+)/)?.[1] || 'unknown',
            uptime: parseInt(info.match(/uptime_in_seconds:(\d+)/)?.[1] || '0'),
            connectedClients: parseInt(info.match(/connected_clients:(\d+)/)?.[1] || '0'),
            blockedClients: parseInt(info.match(/blocked_clients:(\d+)/)?.[1] || '0'),
            usedMemory: info.match(/used_memory_human:(\d+\.\d+[KMGT]?)/)?.[1] || '0',
            usedMemoryRss: info.match(/used_memory_rss_human:(\d+\.\d+[KMGT]?)/)?.[1] || '0',
            hitRate: calculateHitRate(info),
            totalConnections: parseInt(info.match(/total_connections_received:(\d+)/)?.[1] || '0'),
            totalCommands: parseInt(info.match(/total_commands_processed:(\d+)/)?.[1] || '0'),
            instantaneousOps: parseInt(info.match(/instantaneous_ops_per_sec:(\d+)/)?.[1] || '0'),
            keyspace: await getRedisKeyspace()
        };
    } catch (error) {
        return { error: error.message };
    }
}

function calculateHitRate(info) {
    const hits = parseInt(info.match(/keyspace_hits:(\d+)/)?.[1] || '0');
    const misses = parseInt(info.match(/keyspace_misses:(\d+)/)?.[1] || '0');
    const total = hits + misses;
    return total > 0 ? ((hits / total) * 100).toFixed(2) : '0';
}

async function getRedisKeyspace() {
    try {
        const keyspace = {};
        const info = await redis.info('keyspace');
        const dbMatches = info.match(/db\d+:keys=\d+,expires=\d+,avg_ttl=\d+/g) || [];
        
        for (const match of dbMatches) {
            const dbNum = match.match(/db(\d+)/)?.[1];
            const keys = match.match(/keys=(\d+)/)?.[1];
            const expires = match.match(/expires=(\d+)/)?.[1];
            const avgTtl = match.match(/avg_ttl=(\d+)/)?.[1];
            
            if (dbNum) {
                keyspace[`db${dbNum}`] = { keys, expires, avgTtl };
            }
        }
        
        return keyspace;
    } catch (error) {
        return {};
    }
}