/**
 * ESTIF HOME ULTIMATE - BACKEND ENTRY POINT
 * Main application entry with cluster support, process management, and initialization
 * Version: 2.0.0
 * Author: Estifanos Yohannis
 */

// ============================================
// DEPENDENCIES
// ============================================

const cluster = require('cluster');
const os = require('os');
const process = require('process');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const Redis = require('ioredis');

// Load environment variables
dotenv.config();

// Import app
const app = require('./app');
const { initWebSocket } = require('./services/communication/websocketService');
const { initMQTT } = require('./services/communication/mqttService');
const { initDatabase } = require('./config/database');
const { initRedis } = require('./config/redis');

// ============================================
// CLUSTER CONFIGURATION
// ============================================

const CLUSTER_MODE = process.env.CLUSTER_MODE === 'true';
const NUM_CPUS = os.cpus().length;
const WORKER_COUNT = process.env.WORKER_COUNT || NUM_CPUS;

// ============================================
// MASTER PROCESS (Cluster mode)
// ============================================

if (CLUSTER_MODE && cluster.isMaster) {
    console.log(`
╔═══════════════════════════════════════════════════════════════════╗
║                                                                   ║
║   🏠 ESTIF HOME ULTIMATE - MASTER PROCESS                         ║
║                                                                   ║
║   📡 Master PID: ${process.pid}                                      ║
║   🖥️  CPUs: ${NUM_CPUS}                                              ║
║   👷 Workers: ${WORKER_COUNT}                                        ║
║                                                                   ║
╚═══════════════════════════════════════════════════════════════════╝
    `);

    // Fork workers
    for (let i = 0; i < WORKER_COUNT; i++) {
        cluster.fork();
    }

    // Handle worker exit
    cluster.on('exit', (worker, code, signal) => {
        console.log(`⚠️ Worker ${worker.process.pid} died (code: ${code}, signal: ${signal})`);
        
        // Restart worker
        console.log(`🔄 Restarting worker...`);
        cluster.fork();
    });

    // Handle worker online
    cluster.on('online', (worker) => {
        console.log(`✅ Worker ${worker.process.pid} is online`);
    });

    // Graceful shutdown of master
    process.on('SIGTERM', () => {
        console.log('SIGTERM received, shutting down workers...');
        
        const workers = Object.values(cluster.workers);
        
        Promise.all(workers.map(worker => {
            return new Promise((resolve) => {
                worker.on('exit', resolve);
                worker.send('shutdown');
                setTimeout(() => worker.kill(), 5000);
            });
        })).then(() => {
            console.log('All workers shut down');
            process.exit(0);
        });
    });

} else {
    // ============================================
    // WORKER PROCESS
    // ============================================
    
    startWorker();
}

// ============================================
// WORKER INITIALIZATION
// ============================================

async function startWorker() {
    const startTime = Date.now();
    const workerId = cluster.isWorker ? `Worker ${cluster.worker.id}` : 'Main';
    
    console.log(`\n🚀 Starting ${workerId}...\n`);
    
    try {
        // ============================================
        // DATABASE CONNECTION
        // ============================================
        
        console.log('📡 Connecting to MongoDB...');
        await initDatabase();
        console.log('✅ MongoDB connected');
        
        // ============================================
        // REDIS CONNECTION
        // ============================================
        
        console.log('📡 Connecting to Redis...');
        await initRedis();
        console.log('✅ Redis connected');
        
        // ============================================
        // MQTT CONNECTION
        // ============================================
        
        if (process.env.MQTT_ENABLED === 'true') {
            console.log('📡 Connecting to MQTT broker...');
            await initMQTT();
            console.log('✅ MQTT connected');
        }
        
        // ============================================
        // CREATE HTTP SERVER
        // ============================================
        
        const PORT = process.env.PORT || 3000;
        const server = app.listen(PORT, () => {
            const duration = Date.now() - startTime;
            
            console.log(`
╔═══════════════════════════════════════════════════════════════════╗
║                                                                   ║
║   🏠 ESTIF HOME ULTIMATE - BACKEND SERVER                         ║
║                                                                   ║
║   ${workerId.padEnd(67)}║
║   📡 Port: ${String(PORT).padEnd(59)}║
║   🚀 Started in: ${String(duration + 'ms').padEnd(53)}║
║   🌍 Environment: ${String(process.env.NODE_ENV || 'development').padEnd(50)}║
║                                                                   ║
║   🔗 API: http://localhost:${PORT}/api/v1                         ║
║   🔌 WebSocket: ws://localhost:${PORT}                            ║
║   📊 Health: http://localhost:${PORT}/api/health                  ║
║                                                                   ║
╚═══════════════════════════════════════════════════════════════════╝
            `);
        });
        
        // ============================================
        // WEBSOCKET INITIALIZATION
        // ============================================
        
        console.log('🔌 Initializing WebSocket server...');
        const io = initWebSocket(server);
        console.log('✅ WebSocket server ready');
        
        // ============================================
        // PROCESS EVENT HANDLERS
        // ============================================
        
        // Handle graceful shutdown
        const gracefulShutdown = async () => {
            console.log('\n🛑 Received shutdown signal, closing connections...');
            
            // Close server
            server.close(async () => {
                console.log('📡 HTTP server closed');
                
                // Close database connection
                await mongoose.connection.close();
                console.log('💾 Database connection closed');
                
                // Close Redis connection
                if (global.redisClient) {
                    await global.redisClient.quit();
                    console.log('📡 Redis connection closed');
                }
                
                // Close MQTT connection
                if (global.mqttClient) {
                    await global.mqttClient.end();
                    console.log('📡 MQTT connection closed');
                }
                
                console.log('✅ Graceful shutdown complete');
                process.exit(0);
            });
            
            // Force close after timeout
            setTimeout(() => {
                console.error('⚠️ Force closing connections');
                process.exit(1);
            }, 10000);
        };
        
        process.on('SIGTERM', gracefulShutdown);
        process.on('SIGINT', gracefulShutdown);
        
        // Handle uncaught exceptions
        process.on('uncaughtException', (error) => {
            console.error('❌ Uncaught Exception:', error);
            gracefulShutdown();
        });
        
        // Handle unhandled promise rejections
        process.on('unhandledRejection', (reason, promise) => {
            console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
            gracefulShutdown();
        });
        
        // Handle worker messages (cluster mode)
        if (cluster.isWorker) {
            process.on('message', (msg) => {
                if (msg === 'shutdown') {
                    gracefulShutdown();
                }
            });
        }
        
        // ============================================
        // PERFORMANCE MONITORING
        // ============================================
        
        // Log memory usage periodically
        setInterval(() => {
            const memoryUsage = process.memoryUsage();
            const memoryMB = {
                rss: Math.round(memoryUsage.rss / 1024 / 1024),
                heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
                heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
                external: Math.round(memoryUsage.external / 1024 / 1024)
            };
            
            if (memoryMB.heapUsed > 500) {
                console.warn(`⚠️ High memory usage: ${JSON.stringify(memoryMB)} MB`);
            }
            
            // Emit memory metrics
            if (global.redisClient) {
                global.redisClient.publish('metrics:memory', JSON.stringify({
                    workerId: cluster.isWorker ? cluster.worker.id : 0,
                    ...memoryMB,
                    timestamp: Date.now()
                }));
            }
        }, 60000); // Every minute
        
        // Log active connections
        setInterval(() => {
            const connections = server._connectionsCount || 0;
            if (connections > 1000) {
                console.warn(`⚠️ High connection count: ${connections}`);
            }
        }, 60000);
        
    } catch (error) {
        console.error('❌ Failed to start worker:', error);
        process.exit(1);
    }
}

// ============================================
// HEALTH CHECK ENDPOINT (Separate from app)
// ============================================

// Create a simple health check server on a different port for external monitoring
if (process.env.HEALTH_CHECK_PORT) {
    const healthApp = require('express')();
    const healthPort = process.env.HEALTH_CHECK_PORT;
    
    healthApp.get('/health', (req, res) => {
        res.json({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            pid: process.pid,
            memory: process.memoryUsage(),
            cluster: CLUSTER_MODE ? {
                isMaster: cluster.isMaster,
                workerId: cluster.isWorker ? cluster.worker.id : null,
                workers: cluster.isMaster ? Object.keys(cluster.workers || {}).length : null
            } : null
        });
    });
    
    healthApp.listen(healthPort, () => {
        console.log(`💚 Health check server running on port ${healthPort}`);
    });
}

// ============================================
// EXPORTS
// ============================================

module.exports = { app };