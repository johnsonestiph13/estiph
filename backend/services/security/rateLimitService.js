/**
 * ESTIF HOME ULTIMATE - RATE LIMIT SERVICE
 * Rate limiting for API endpoints and authentication
 * Version: 2.0.0
 */

const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');
const { getRedis } = require('../../config/redis');

class RateLimitService {
    constructor() {
        this.stores = new Map();
        this.limiters = new Map();
    }

    createLimiter(options = {}) {
        const store = new RedisStore({
            sendCommand: (...args) => getRedis().call(...args),
            prefix: `rl:${options.prefix || 'default'}:`
        });

        const limiter = rateLimit({
            store,
            windowMs: options.windowMs || 15 * 60 * 1000,
            max: options.max || 100,
            message: options.message || { success: false, message: 'Too many requests, please try again later.' },
            standardHeaders: true,
            legacyHeaders: false,
            keyGenerator: options.keyGenerator || ((req) => req.user?._id || req.ip),
            skip: options.skip || (() => false),
            skipSuccessfulRequests: options.skipSuccessfulRequests || false,
            skipFailedRequests: options.skipFailedRequests || false
        });

        this.limiters.set(options.name || 'default', limiter);
        return limiter;
    }

    getLimiter(name) {
        return this.limiters.get(name);
    }

    async getRemainingRequests(key, limiterName = 'default') {
        const limiter = this.limiters.get(limiterName);
        if (!limiter) return null;
        
        const redis = getRedis();
        const count = await redis.get(`rl:${limiterName}:${key}`);
        const max = limiter.max;
        
        return {
            remaining: Math.max(0, max - (parseInt(count) || 0)),
            max,
            resetTime: null
        };
    }

    async increment(key, limiterName = 'default', windowMs = 60000) {
        const redis = getRedis();
        const current = await redis.incr(`rl:${limiterName}:${key}`);
        
        if (current === 1) {
            await redis.expire(`rl:${limiterName}:${key}`, Math.ceil(windowMs / 1000));
        }
        
        return current;
    }

    async reset(key, limiterName = 'default') {
        const redis = getRedis();
        await redis.del(`rl:${limiterName}:${key}`);
    }

    async getStats(limiterName = 'default') {
        const redis = getRedis();
        const keys = await redis.keys(`rl:${limiterName}:*`);
        const stats = [];
        
        for (const key of keys) {
            const count = await redis.get(key);
            stats.push({
                key: key.replace(`rl:${limiterName}:`, ''),
                count: parseInt(count)
            });
        }
        
        return stats;
    }
}

module.exports = new RateLimitService();