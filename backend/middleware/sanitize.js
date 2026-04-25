const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');

const sanitizeInput = (req, res, next) => {
    // Sanitize request body, query params, and URL params
    if (req.body) {
        Object.keys(req.body).forEach(key => {
            if (typeof req.body[key] === 'string') {
                req.body[key] = req.body[key].trim();
            }
        });
    }
    next();
};

const mongoSanitizeMiddleware = mongoSanitize({
    replaceWith: '_',
    onSanitize: ({ key, req }) => {
        console.warn(`[Sanitize] Potentially dangerous key removed: ${key}`);
    }
});

const xssMiddleware = xss();

const sanitizeHtml = (str) => {
    if (!str || typeof str !== 'string') return str;
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
};

const sanitizeObject = (obj) => {
    if (!obj || typeof obj !== 'object') return obj;
    
    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
        if (typeof value === 'string') {
            sanitized[key] = sanitizeHtml(value);
        } else if (typeof value === 'object') {
            sanitized[key] = sanitizeObject(value);
        } else {
            sanitized[key] = value;
        }
    }
    return sanitized;
};

module.exports = {
    sanitizeInput,
    mongoSanitizeMiddleware,
    xssMiddleware,
    sanitizeHtml,
    sanitizeObject
};