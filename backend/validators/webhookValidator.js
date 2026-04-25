/**
 * Webhook Validator
 * Validates webhook configurations, payloads, and security settings
 */

const { body, param, validationResult } = require('express-validator');

const WEBHOOK_EVENTS = [
    'device.created',
    'device.updated',
    'device.deleted',
    'device.state.changed',
    'device.toggled',
    'home.created',
    'home.updated',
    'home.deleted',
    'member.added',
    'member.removed',
    'automation.triggered',
    'schedule.executed',
    'scene.activated',
    'alert.triggered',
    'user.login',
    'user.logout'
];

const validateWebhookCreation = [
    body('name')
        .trim()
        .notEmpty().withMessage('Webhook name is required')
        .isLength({ min: 2, max: 100 }).withMessage('Name must be between 2 and 100 characters'),
    
    body('url')
        .isURL({
            protocols: ['http', 'https'],
            require_protocol: true,
            require_valid_protocol: true
        }).withMessage('Valid HTTPS/HTTP URL required'),
    
    body('events')
        .isArray({ min: 1 }).withMessage('At least one event is required')
        .custom(value => {
            return value.every(event => WEBHOOK_EVENTS.includes(event));
        }).withMessage(`Invalid event. Must be one of: ${WEBHOOK_EVENTS.join(', ')}`),
    
    body('secret')
        .optional()
        .isLength({ min: 16, max: 128 }).withMessage('Secret must be between 16 and 128 characters'),
    
    body('enabled')
        .optional()
        .isBoolean().withMessage('enabled must be a boolean'),
    
    body('retryCount')
        .optional()
        .isInt({ min: 0, max: 5 }).withMessage('Retry count must be between 0 and 5'),
    
    body('timeout')
        .optional()
        .isInt({ min: 1000, max: 30000 }).withMessage('Timeout must be between 1000 and 30000 ms'),
];

const validateWebhookUpdate = [
    param('id')
        .isMongoId().withMessage('Invalid webhook ID'),
    
    body('name')
        .optional()
        .trim()
        .isLength({ min: 2, max: 100 }).withMessage('Name must be between 2 and 100 characters'),
    
    body('url')
        .optional()
        .isURL().withMessage('Valid URL required'),
    
    body('events')
        .optional()
        .isArray().withMessage('events must be an array')
        .custom(value => {
            return value.every(event => WEBHOOK_EVENTS.includes(event));
        }).withMessage('Invalid event type'),
    
    body('enabled')
        .optional()
        .isBoolean().withMessage('enabled must be a boolean'),
];

const validateWebhookToggle = [
    param('id')
        .isMongoId().withMessage('Invalid webhook ID'),
    
    body('enabled')
        .isBoolean().withMessage('enabled must be a boolean'),
];

// Validate incoming webhook payload
const validateWebhookPayload = [
    body('event')
        .isIn(WEBHOOK_EVENTS).withMessage('Invalid event type'),
    
    body('timestamp')
        .isISO8601().withMessage('Invalid timestamp'),
    
    body('data')
        .isObject().withMessage('Data must be an object'),
    
    body('signature')
        .optional()
        .isString().withMessage('Signature must be a string'),
];

const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            errors: errors.array().map(err => ({
                field: err.param,
                message: err.msg
            }))
        });
    }
    next();
};

module.exports = {
    validateWebhookCreation,
    validateWebhookUpdate,
    validateWebhookToggle,
    validateWebhookPayload,
    validate,
    WEBHOOK_EVENTS,
};