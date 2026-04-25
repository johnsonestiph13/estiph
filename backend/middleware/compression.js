const compression = require('compression');

const compressionMiddleware = compression({
    level: 6,
    threshold: 1024,
    filter: (req, res) => {
        if (req.headers['x-no-compression']) return false;
        return compression.filter(req, res);
    },
    chunkSize: 16384,
    memLevel: 8,
    windowBits: 15
});

module.exports = compressionMiddleware;