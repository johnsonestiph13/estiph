/**
 * Device Validator
 * Validates device creation, updates, control commands, and configurations
 */

const { body, param, query, validationResult } = require('express-validator');

// Valid GPIO pins for ESP32
const VALID_GPIO_PINS = [0, 1, 2, 3, 4, 5, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 23, 25, 26, 27, 32, 33];

// Valid device types
const DEVICE_TYPES = ['light', 'fan', 'ac', 'heater', 'tv', 'pump', 'sensor', 'camera', 'lock', 'outlet'];

const validateDeviceCreation = [
    body('name')
        .trim()
        .notEmpty().withMessage('Device name is required')
        .isLength({ min: 2, max: 50 }).withMessage('Device name must be between 2 and 50 characters'),
    
    body('type')
        .isIn(DEVICE_TYPES).withMessage(`Invalid device type. Must be one of: ${DEVICE_TYPES.join(', ')}`),
    
    body('gpio')
        .optional()
        .isInt({ min: 0, max: 39 }).withMessage('GPIO pin must be between 0 and 39')
        .custom(value => VALID_GPIO_PINS.includes(value)).withMessage(`Invalid GPIO pin. Valid pins: ${VALID_GPIO_PINS.join(', ')}`),
    
    body('power')
        .optional()
        .isInt({ min: 0, max: 5000 }).withMessage('Power must be between 0 and 5000 watts'),
    
    body('room')
        .optional()
        .trim()
        .isLength({ max: 50 }).withMessage('Room name too long'),
    
    body('homeId')
        .isMongoId().withMessage('Invalid home ID'),
    
    body('autoMode')
        .optional()
        .isBoolean().withMessage('autoMode must be a boolean'),
    
    body('autoConditions')
        .optional()
        .isObject().withMessage('autoConditions must be an object'),
    
    body('autoConditions.tempOn')
        .optional()
        .isFloat({ min: -10, max: 50 }).withMessage('Temperature threshold must be between -10 and 50'),
    
    body('autoConditions.tempOff')
        .optional()
        .isFloat({ min: -10, max: 50 }).withMessage('Temperature threshold must be between -10 and 50'),
    
    body('autoConditions.schedule')
        .optional()
        .isObject().withMessage('Schedule must be an object'),
];

const validateDeviceUpdate = [
    param('id')
        .isMongoId().withMessage('Invalid device ID'),
    
    body('name')
        .optional()
        .trim()
        .isLength({ min: 2, max: 50 }).withMessage('Device name must be between 2 and 50 characters'),
    
    body('room')
        .optional()
        .trim(),
    
    body('power')
        .optional()
        .isInt({ min: 0, max: 5000 }).withMessage('Power must be between 0 and 5000 watts'),
];

const validateDeviceToggle = [
    param('id')
        .isMongoId().withMessage('Invalid device ID'),
];

const validateAutoMode = [
    param('id')
        .isMongoId().withMessage('Invalid device ID'),
    
    body('enabled')
        .isBoolean().withMessage('enabled must be a boolean'),
    
    body('conditions')
        .optional()
        .isObject().withMessage('conditions must be an object'),
];

const validateDeviceSchedule = [
    param('id')
        .isMongoId().withMessage('Invalid device ID'),
    
    body('time')
        .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Invalid time format. Use HH:MM'),
    
    body('days')
        .isArray().withMessage('days must be an array')
        .custom(value => {
            const validDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday', 'weekdays', 'weekends'];
            return value.every(day => validDays.includes(day));
        }).withMessage('Invalid day specified'),
    
    body('action')
        .isIn(['on', 'off', 'toggle']).withMessage('Action must be on, off, or toggle'),
    
    body('enabled')
        .optional()
        .isBoolean().withMessage('enabled must be a boolean'),
];

const validateGroupCreation = [
    body('name')
        .trim()
        .notEmpty().withMessage('Group name is required')
        .isLength({ min: 2, max: 50 }).withMessage('Group name must be between 2 and 50 characters'),
    
    body('deviceIds')
        .isArray().withMessage('deviceIds must be an array')
        .custom(value => value.every(id => id.match(/^[0-9a-fA-F]{24}$/))).withMessage('Invalid device ID format'),
    
    body('scene')
        .optional()
        .isObject().withMessage('Scene must be an object'),
];

const validateMasterControl = [
    body('state')
        .isBoolean().withMessage('state must be a boolean'),
    
    body('deviceTypes')
        .optional()
        .isArray().withMessage('deviceTypes must be an array')
        .custom(value => value.every(type => DEVICE_TYPES.includes(type))).withMessage('Invalid device type'),
];

const validateFirmwareUpdate = [
    param('id')
        .isMongoId().withMessage('Invalid device ID'),
    
    body('version')
        .matches(/^\d+\.\d+\.\d+$/).withMessage('Invalid version format. Use X.Y.Z'),
    
    body('force')
        .optional()
        .isBoolean().withMessage('force must be a boolean'),
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
    validateDeviceCreation,
    validateDeviceUpdate,
    validateDeviceToggle,
    validateAutoMode,
    validateDeviceSchedule,
    validateGroupCreation,
    validateMasterControl,
    validateFirmwareUpdate,
    validate,
    DEVICE_TYPES,
    VALID_GPIO_PINS,
};