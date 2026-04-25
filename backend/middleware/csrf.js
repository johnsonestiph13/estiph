const Tokens = require('csrf');
const tokens = new Tokens();

const csrfSecret = process.env.CSRF_SECRET || 'default-csrf-secret';

const generateCSRFToken = (req, res) => {
    const secret = tokens.secretSync();
    const token = tokens.create(secret);
    
    req.session = req.session || {};
    req.session.csrfSecret = secret;
    
    res.cookie('XSRF-TOKEN', token, {
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict'
    });
    
    return token;
};

const csrfProtection = (req, res, next) => {
    if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
        return next();
    }
    
    const token = req.headers['x-csrf-token'] || req.body._csrf || req.query._csrf;
    const secret = req.session?.csrfSecret;
    
    if (!token || !secret) {
        return res.status(403).json({
            success: false,
            message: 'CSRF token missing'
        });
    }
    
    if (!tokens.verify(secret, token)) {
        return res.status(403).json({
            success: false,
            message: 'Invalid CSRF token'
        });
    }
    
    next();
};

const csrfErrorHandler = (err, req, res, next) => {
    if (err.code === 'EBADCSRFTOKEN') {
        return res.status(403).json({
            success: false,
            message: 'CSRF token validation failed'
        });
    }
    next(err);
};

module.exports = {
    generateCSRFToken,
    csrfProtection,
    csrfErrorHandler
};