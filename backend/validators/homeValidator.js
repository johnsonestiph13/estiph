/**
 * Home Validator
 * Validates home creation, updates, member management, and settings
 */

const { body, param, query, validationResult } = require('express-validator');

const validateHomeCreation = [
    body('name')
        .trim()
        .notEmpty().withMessage('Home name is required')
        .isLength({ min: 2, max: 100 }).withMessage('Home name must be between 2 and 100 characters'),
    
    body('nameAm')
        .optional()
        .trim()
        .isLength({ max: 100 }).withMessage('Amharic name too long'),
    
    body('address')
        .optional()
        .trim()
        .isLength({ max: 200 }).withMessage('Address too long'),
    
    body('city')
        .optional()
        .trim()
        .isLength({ max: 100 }).withMessage('City name too long'),
    
    body('country')
        .optional()
        .trim()
        .isLength({ max: 100 }).withMessage('Country name too long'),
    
    body('zipCode')
        .optional()
        .matches(/^[0-9]{3,10}$/).withMessage('Invalid zip code'),
    
    body('location.lat')
        .optional()
        .isFloat({ min: -90, max: 90 }).withMessage('Invalid latitude'),
    
    body('location.lng')
        .optional()
        .isFloat({ min: -180, max: 180 }).withMessage('Invalid longitude'),
];

const validateHomeUpdate = [
    param('id')
        .isMongoId().withMessage('Invalid home ID'),
    
    body('name')
        .optional()
        .trim()
        .isLength({ min: 2, max: 100 }).withMessage('Home name must be between 2 and 100 characters'),
    
    body('address')
        .optional()
        .trim(),
    
    body('settings.timezone')
        .optional()
        .isString().withMessage('Timezone must be a string'),
    
    body('settings.temperatureUnit')
        .optional()
        .isIn(['celsius', 'fahrenheit']).withMessage('Temperature unit must be celsius or fahrenheit'),
];

const validateAddMember = [
    param('id')
        .isMongoId().withMessage('Invalid home ID'),
    
    body('email')
        .isEmail().withMessage('Valid email required'),
    
    body('role')
        .optional()
        .isIn(['owner', 'admin', 'member', 'guest']).withMessage('Invalid role'),
];

const validateUpdateMember = [
    param('homeId')
        .isMongoId().withMessage('Invalid home ID'),
    
    param('memberId')
        .isMongoId().withMessage('Invalid member ID'),
    
    body('role')
        .isIn(['admin', 'member', 'guest']).withMessage('Invalid role'),
];

const validateRemoveMember = [
    param('id')
        .isMongoId().withMessage('Invalid home ID'),
    
    param('memberId')
        .isMongoId().withMessage('Invalid member ID'),
];

const validateTransferOwnership = [
    param('id')
        .isMongoId().withMessage('Invalid home ID'),
    
    body('newOwnerEmail')
        .isEmail().withMessage('Valid email required for new owner'),
];

const validateAddRoom = [
    param('id')
        .isMongoId().withMessage('Invalid home ID'),
    
    body('name')
        .trim()
        .notEmpty().withMessage('Room name is required')
        .isLength({ min: 2, max: 50 }).withMessage('Room name must be between 2 and 50 characters'),
    
    body('icon')
        .optional()
        .isString().withMessage('Icon must be a string'),
    
    body('type')
        .optional()
        .isIn(['living', 'bedroom', 'kitchen', 'bathroom', 'office', 'other']).withMessage('Invalid room type'),
];

const validateWiFiConfig = [
    param('id')
        .isMongoId().withMessage('Invalid home ID'),
    
    body('ssid')
        .trim()
        .notEmpty().withMessage('WiFi SSID is required')
        .isLength({ min: 2, max: 32 }).withMessage('SSID must be between 2 and 32 characters'),
    
    body('password')
        .optional()
        .isLength({ min: 8, max: 63 }).withMessage('WiFi password must be between 8 and 63 characters'),
    
    body('encryption')
        .optional()
        .isIn(['WPA2', 'WPA3', 'WEP', 'None']).withMessage('Invalid encryption type'),
];

const validateHomeInvite = [
    param('id')
        .isMongoId().withMessage('Invalid home ID'),
    
    body('email')
        .isEmail().withMessage('Valid email required'),
    
    body('expiresIn')
        .optional()
        .isInt({ min: 1, max: 7 }).withMessage('Expiry must be between 1 and 7 days'),
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
    validateHomeCreation,
    validateHomeUpdate,
    validateAddMember,
    validateUpdateMember,
    validateRemoveMember,
    validateTransferOwnership,
    validateAddRoom,
    validateWiFiConfig,
    validateHomeInvite,
    validate,
};