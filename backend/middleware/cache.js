const NodeCache = require('node-cache');
const cache = new NodeCache({ stdTTL: 300, checkperiod: 60 });

const cacheMiddleware = (duration = 300) => {
    return (req, res, next) => {
        if (req.method !== 'GET') {
            return next();
        }
        
        const key = `cache:${req.user?._id || 'anonymous'}:${req.originalUrl}`;
        const cachedData = cache.get(key);
        
        if (cachedData) {
            return res.json(cachedData);
        }
        
        const originalJson = res.json;
        res.json = function(data) {
            cache.set(key, data, duration);
            originalJson.call(this, data);
        };
        
        next();
    };
};

const clearCache = (pattern) => {
    const keys = cache.keys();
    keys.forEach(key => {
        if (key.includes(pattern)) {
            cache.del(key);
        }
    });
};

const clearUserCache = (userId) => {
    const keys = cache.keys();
    keys.forEach(key => {
        if (key.includes(`cache:${userId}`)) {
            cache.del(key);
        }
    });
};

const getCacheStats = () => {
    return {
        keys: cache.keys().length,
        hits: cache.getStats().hits,
        misses: cache.getStats().misses,
        ksize: cache.getStats().ksize,
        vsize: cache.getStats().vsize
    };
};

module.exports = {
    cacheMiddleware,
    clearCache,
    clearUserCache,
    getCacheStats,
    cache
};