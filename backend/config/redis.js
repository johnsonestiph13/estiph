const Redis = require('ioredis');

let redisClient = null;

const initRedis = () => {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    
    redisClient = new Redis(redisUrl, {
        maxRetriesPerRequest: 3,
        retryStrategy: (times) => {
            const delay = Math.min(times * 50, 2000);
            return delay;
        },
        reconnectOnError: (err) => {
            console.error('Redis reconnect on error:', err);
            return true;
        }
    });
    
    redisClient.on('connect', () => {
        console.log('✅ Redis connected');
    });
    
    redisClient.on('error', (err) => {
        console.error('❌ Redis error:', err);
    });
    
    redisClient.on('reconnecting', () => {
        console.log('🔄 Redis reconnecting...');
    });
    
    return redisClient;
};

const getRedis = () => {
    if (!redisClient) {
        return initRedis();
    }
    return redisClient;
};

const closeRedis = async () => {
    if (redisClient) {
        await redisClient.quit();
        console.log('Redis connection closed');
    }
};

const cacheGet = async (key) => {
    const data = await getRedis().get(key);
    return data ? JSON.parse(data) : null;
};

const cacheSet = async (key, value, ttl = 3600) => {
    await getRedis().set(key, JSON.stringify(value), 'EX', ttl);
};

const cacheDel = async (key) => {
    await getRedis().del(key);
};

const cacheFlush = async () => {
    await getRedis().flushdb();
};

module.exports = {
    initRedis,
    getRedis,
    closeRedis,
    cacheGet,
    cacheSet,
    cacheDel,
    cacheFlush
};