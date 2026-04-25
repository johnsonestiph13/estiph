const ipRangeCheck = require('ip-range-check');

const whitelistedIPs = process.env.WHITELISTED_IPS 
    ? process.env.WHITELISTED_IPS.split(',') 
    : [];
const whitelistedRanges = process.env.WHITELISTED_RANGES 
    ? process.env.WHITELISTED_RANGES.split(',') 
    : [];

const isIPWhitelisted = (ip) => {
    if (whitelistedIPs.includes(ip)) return true;
    
    for (const range of whitelistedRanges) {
        if (ipRangeCheck(ip, range)) return true;
    }
    
    return false;
};

const ipWhitelistMiddleware = (options = {}) => {
    const { adminOnly = false, paths = [] } = options;
    
    return (req, res, next) => {
        const clientIp = req.ip || req.connection.remoteAddress || req.socket.remoteAddress;
        const normalizedIp = clientIp.replace('::ffff:', '');
        
        const shouldCheck = adminOnly 
            ? req.user?.role === 'admin' || req.user?.role === 'super_admin'
            : paths.some(path => req.path.startsWith(path)) || !adminOnly;
        
        if (shouldCheck && whitelistedIPs.length > 0 && !isIPWhitelisted(normalizedIp)) {
            console.warn(`[Security] Blocked access from non-whitelisted IP: ${normalizedIp}`);
            return res.status(403).json({
                success: false,
                message: 'Access denied from this IP address'
            });
        }
        
        next();
    };
};

const internalOnlyMiddleware = ipWhitelistMiddleware({
    paths: ['/api/internal', '/api/admin', '/metrics', '/health/detailed']
});

const adminOnlyIPMiddleware = ipWhitelistMiddleware({ adminOnly: true });

const getClientIP = (req) => {
    return req.headers['x-forwarded-for']?.split(',')[0] 
        || req.headers['x-real-ip'] 
        || req.ip 
        || req.connection.remoteAddress;
};

module.exports = {
    ipWhitelistMiddleware,
    internalOnlyMiddleware,
    adminOnlyIPMiddleware,
    getClientIP,
    isIPWhitelisted
};