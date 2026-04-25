const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');
const { getRedis } = require('./redis');

const createRateLimiter = (options = {}) => {
    const store = new RedisStore({
        sendCommand: (...args) => getRedis().call(...args),
        prefix: 'rl:'
    });
    
    return rateLimit({
        store,
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
            if (req.path === '/api/health') return true;
            if (req.user?.role === 'super_admin') return true;
            return false;
        },
        ...options
    });
};

const authLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: { success: false, message: 'Too many login attempts, please try again later' }
});

const apiLimiter = createRateLimiter({
    windowMs: 60 * 1000,
    max: 60
});

const strictLimiter = createRateLimiter({
    windowMs: 60 * 1000,
    max: 10
});

const uploadLimiter = createRateLimiter({
    windowMs: 60 * 1000,
    max: 10
});

const webhookLimiter = createRateLimiter({
    windowMs: 60 * 1000,
    max: 30
});

module.exports = {
    createRateLimiter,
    authLimiter,
    apiLimiter,
    strictLimiter,
    uploadLimiter,
    webhookLimiter
};