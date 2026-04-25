const crypto = require('crypto');

const requestIdMiddleware = (req, res, next) => {
    const requestId = req.headers['x-request-id'] 
        || crypto.randomBytes(16).toString('hex');
    
    req.requestId = requestId;
    res.setHeader('X-Request-Id', requestId);
    
    const startTime = process.hrtime();
    
    const originalJson = res.json;
    res.json = function(data) {
        const diff = process.hrtime(startTime);
        const responseTime = (diff[0] * 1e3 + diff[1] / 1e6).toFixed(2);
        res.setHeader('X-Response-Time', `${responseTime}ms`);
        
        if (data && typeof data === 'object') {
            data.requestId = requestId;
        }
        
        originalJson.call(this, data);
    };
    
    next();
};

const requestLoggerMiddleware = (req, res, next) => {
    console.log(`[${req.requestId}] ${req.method} ${req.url} - Started`);
    
    const start = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - start;
        console.log(`[${req.requestId}] ${req.method} ${req.url} - Completed (${res.statusCode}) in ${duration}ms`);
    });
    
    next();
};

module.exports = {
    requestIdMiddleware,
    requestLoggerMiddleware
};