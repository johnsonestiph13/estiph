const timeout = require('connect-timeout');

const timeoutMiddleware = (duration = 30000) => {
    return timeout(duration, { 
        respond: true,
        message: 'Request timeout'
    });
};

const timeoutErrorHandler = (err, req, res, next) => {
    if (err.timeout) {
        return res.status(408).json({
            success: false,
            message: 'Request timeout',
            requestId: req.requestId
        });
    }
    next(err);
};

const routeTimeout = {
    light: 5000,
    default: 30000,
    heavy: 60000,
    upload: 120000,
    streaming: 0 // no timeout
};

const getTimeoutForRoute = (req) => {
    if (req.path.includes('/upload')) return routeTimeout.upload;
    if (req.path.includes('/export')) return routeTimeout.heavy;
    if (req.path.includes('/stream')) return routeTimeout.streaming;
    if (req.method === 'POST' && req.path.includes('/devices')) return routeTimeout.light;
    return routeTimeout.default;
};

const dynamicTimeoutMiddleware = (req, res, next) => {
    const timeoutMs = getTimeoutForRoute(req);
    if (timeoutMs === 0) return next();
    
    req.setTimeout(timeoutMs, () => {
        res.status(408).json({
            success: false,
            message: 'Request timeout'
        });
        req.aborted = true;
    });
    
    next();
};

module.exports = {
    timeoutMiddleware,
    timeoutErrorHandler,
    dynamicTimeoutMiddleware,
    routeTimeout
};