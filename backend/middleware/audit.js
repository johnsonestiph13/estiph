const AuditLog = require('../models/AuditLog');

const auditLog = (action, options = {}) => {
    return async (req, res, next) => {
        const startTime = Date.now();
        
        const originalJson = res.json;
        res.json = async function(data) {
            const duration = Date.now() - startTime;
            
            try {
                await AuditLog.create({
                    userId: req.user?._id,
                    action: action,
                    resource: options.resource || req.baseUrl,
                    resourceId: req.params.id || req.body.id,
                    oldValue: options.captureOldValue ? await captureOldValue(req) : null,
                    newValue: options.captureNewValue ? req.body : null,
                    ip: req.ip,
                    userAgent: req.headers['user-agent'],
                    severity: options.severity || 'low',
                    status: data.success !== false ? 'success' : 'failure',
                    details: {
                        method: req.method,
                        url: req.url,
                        duration: `${duration}ms`,
                        statusCode: res.statusCode
                    }
                });
            } catch (error) {
                console.error('Audit log error:', error);
            }
            
            originalJson.call(this, data);
        };
        
        next();
    };
};

const captureOldValue = async (req) => {
    try {
        const modelName = req.baseUrl.split('/').pop();
        const Model = require(`../models/${modelName}`);
        const oldData = await Model.findById(req.params.id);
        return oldData;
    } catch (error) {
        return null;
    }
};

const sensitiveActionLogger = (req, res, next) => {
    const sensitiveActions = ['password', '2fa', 'delete', 'suspend', 'role'];
    const isSensitive = sensitiveActions.some(action => req.url.includes(action));
    
    if (isSensitive) {
        console.warn(`[SECURITY] Sensitive action: ${req.method} ${req.url} by user ${req.user?._id} from ${req.ip}`);
    }
    
    next();
};

module.exports = {
    auditLog,
    sensitiveActionLogger
};