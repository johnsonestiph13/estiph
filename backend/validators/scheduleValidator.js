/**
 * Schedule Validator
 * Validates scheduled tasks, cron expressions, and recurring jobs
 */

const { body, param, validationResult } = require('express-validator');

const validateScheduleCreation = [
    body('name')
        .trim()
        .notEmpty().withMessage('Schedule name is required')
        .isLength({ min: 2, max: 100 }).withMessage('Name must be between 2 and 100 characters'),
    
    body('cronExpression')
        .matches(/^(\*|([0-9]|1[0-9]|2[0-9]|3[0-9]|4[0-9]|5[0-9])|\*\/[0-9]+)\s+(\*|([0-9]|1[0-9]|2[0-3])|\*\/[0-9]+)\s+(\*|([1-9]|1[0-9]|2[0-9]|3[0-1])|\*\/[0-9]+)\s+(\*|([1-9]|1[0-2])|\*\/[0-9]+)\s+(\*|([0-6])|\*\/[0-9]+)$/)
        .withMessage('Invalid cron expression'),
    
    body('action')
        .isObject().withMessage('Action must be an object'),
    
    body('action.type')
        .isIn(['device', 'automation', 'webhook', 'scene']).withMessage('Invalid action type'),
    
    body('action.params')
        .custom((value, { req }) => {
            const type = req.body.action.type;
            if (type === 'device') {
                return value.deviceId && value.command;
            }
            if (type === 'automation') {
                return value.automationId;
            }
            return true;
        }).withMessage('Invalid params for action type'),
    
    body('enabled')
        .optional()
        .isBoolean().withMessage('enabled must be a boolean'),
    
    body('startDate')
        .optional()
        .isISO8601().withMessage('Invalid start date'),
    
    body('endDate')
        .optional()
        .isISO8601().withMessage('Invalid end date')
        .custom((value, { req }) => {
            if (req.body.startDate && value <= req.body.startDate) {
                throw new Error('End date must be after start date');
            }
            return true;
        }),
];

const validateScheduleUpdate = [
    param('id')
        .isMongoId().withMessage('Invalid schedule ID'),
    
    body('name')
        .optional()
        .trim()
        .isLength({ min: 2, max: 100 }).withMessage('Name must be between 2 and 100 characters'),
    
    body('cronExpression')
        .optional()
        .matches(/^(\*|([0-9]|1[0-9]|2[0-9]|3[0-9]|4[0-9]|5[0-9])|\*\/[0-9]+)\s+(\*|([0-9]|1[0-9]|2[0-3])|\*\/[0-9]+)\s+(\*|([1-9]|1[0-9]|2[0-9]|3[0-1])|\*\/[0-9]+)\s+(\*|([1-9]|1[0-2])|\*\/[0-9]+)\s+(\*|([0-6])|\*\/[0-9]+)$/)
        .withMessage('Invalid cron expression'),
    
    body('enabled')
        .optional()
        .isBoolean().withMessage('enabled must be a boolean'),
];

const validateScheduleToggle = [
    param('id')
        .isMongoId().withMessage('Invalid schedule ID'),
    
    body('enabled')
        .isBoolean().withMessage('enabled must be a boolean'),
];

const validateScheduleDelete = [
    param('id')
        .isMongoId().withMessage('Invalid schedule ID'),
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
    validateScheduleCreation,
    validateScheduleUpdate,
    validateScheduleToggle,
    validateScheduleDelete,
    validate,
};