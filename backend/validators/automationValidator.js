/**
 * Automation Validator
 * Validates automation rules, triggers, and actions
 */

const { body, param, validationResult } = require('express-validator');

const TRIGGER_TYPES = ['time', 'temperature', 'humidity', 'device_state', 'motion', 'schedule', 'webhook'];
const ACTION_TYPES = ['device', 'webhook', 'notification', 'scene', 'delay'];

const validateAutomationCreation = [
    body('name')
        .trim()
        .notEmpty().withMessage('Automation name is required')
        .isLength({ min: 2, max: 100 }).withMessage('Name must be between 2 and 100 characters'),
    
    body('enabled')
        .optional()
        .isBoolean().withMessage('enabled must be a boolean'),
    
    body('trigger')
        .isObject().withMessage('Trigger must be an object'),
    
    body('trigger.type')
        .isIn(TRIGGER_TYPES).withMessage(`Invalid trigger type. Must be: ${TRIGGER_TYPES.join(', ')}`),
    
    body('trigger.conditions')
        .custom((value, { req }) => {
            const type = req.body.trigger.type;
            if (type === 'time') {
                return value.time && value.time.match(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/);
            }
            if (type === 'temperature') {
                return value.threshold && typeof value.threshold === 'number';
            }
            if (type === 'device_state') {
                return value.deviceId && value.state;
            }
            return true;
        }).withMessage('Invalid conditions for trigger type'),
    
    body('action')
        .isObject().withMessage('Action must be an object'),
    
    body('action.type')
        .isIn(ACTION_TYPES).withMessage(`Invalid action type. Must be: ${ACTION_TYPES.join(', ')}`),
    
    body('action.params')
        .custom((value, { req }) => {
            const type = req.body.action.type;
            if (type === 'device') {
                return value.deviceId && value.command;
            }
            if (type === 'webhook') {
                return value.url;
            }
            if (type === 'notification') {
                return value.message;
            }
            return true;
        }).withMessage('Invalid params for action type'),
];

const validateAutomationUpdate = [
    param('id')
        .isMongoId().withMessage('Invalid automation ID'),
    
    body('name')
        .optional()
        .trim()
        .isLength({ min: 2, max: 100 }).withMessage('Name must be between 2 and 100 characters'),
    
    body('enabled')
        .optional()
        .isBoolean().withMessage('enabled must be a boolean'),
];

const validateAutomationToggle = [
    param('id')
        .isMongoId().withMessage('Invalid automation ID'),
    
    body('enabled')
        .isBoolean().withMessage('enabled must be a boolean'),
];

const validateSceneCreation = [
    body('name')
        .trim()
        .notEmpty().withMessage('Scene name is required')
        .isLength({ min: 2, max: 50 }).withMessage('Scene name must be between 2 and 50 characters'),
    
    body('actions')
        .isArray({ min: 1 }).withMessage('At least one action is required')
        .custom(value => {
            return value.every(action => action.deviceId && action.command);
        }).withMessage('Each action must have deviceId and command'),
    
    body('icon')
        .optional()
        .isString().withMessage('Icon must be a string'),
    
    body('color')
        .optional()
        .matches(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/).withMessage('Invalid color format'),
];

const validateWebhookCreation = [
    body('url')
        .isURL().withMessage('Valid URL required'),
    
    body('events')
        .isArray({ min: 1 }).withMessage('At least one event is required')
        .custom(value => {
            const validEvents = ['device.on', 'device.off', 'device.state', 'temperature.high', 'temperature.low', 'motion.detected'];
            return value.every(event => validEvents.includes(event));
        }).withMessage('Invalid event type'),
    
    body('secret')
        .optional()
        .isLength({ min: 16, max: 64 }).withMessage('Secret must be between 16 and 64 characters'),
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
    validateAutomationCreation,
    validateAutomationUpdate,
    validateAutomationToggle,
    validateSceneCreation,
    validateWebhookCreation,
    validate,
};