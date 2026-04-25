const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');
const Redis = require('ioredis');

const redisClient = new Redis(process.env.REDIS_URL);

const createRateLimiter = (options = {}) => {
    return rateLimit({
        store: new RedisStore({
            sendCommand: (...args) => redisClient.call(...args),
            prefix: 'rl:'
        }),
        windowMs: options.windowMs || 15 * 60 * 1000,
        max: options.max || 100,
        message: {
            success: false,
            message: 'Too many requests, please try again later.'
        },
        standardHeaders: true,
        legacyHeaders: false,
        keyGenerator: (req) => {
            return req.user?._id || req.ip;
        },
        skip: (req) => {
            if (req.path === '/api/health' || req.path === '/api/status') return true;
            if (req.user?.role === 'super_admin') return true;
            return false;
        },
        ...options
    });
};

const strictLimiter = createRateLimiter({
    windowMs: 60 * 1000,
    max: 10,
    message: { success: false, message: 'Too many requests, please slow down' }
});

const authLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: { success: false, message: 'Too many authentication attempts, please try again later' }
});

const apiLimiter = createRateLimiter({
    windowMs: 60 * 1000,
    max: 60
});

const webhookLimiter = createRateLimiter({
    windowMs: 60 * 1000,
    max: 30
});

const uploadLimiter = createRateLimiter({
    windowMs: 60 * 1000,
    max: 10
});

module.exports = {
    createRateLimiter,
    strictLimiter,
    authLimiter,
    apiLimiter,
    webhookLimiter,
    uploadLimiter
};