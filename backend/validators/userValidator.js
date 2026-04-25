/**
 * User Validator
 * Validates user registration, login, profile updates, and password changes
 */

const { body, param, query, validationResult } = require('express-validator');

// Validation rules
const validateUserRegistration = [
    body('name')
        .trim()
        .notEmpty().withMessage('Name is required')
        .isLength({ min: 2, max: 100 }).withMessage('Name must be between 2 and 100 characters')
        .matches(/^[a-zA-Z\s\u1200-\u137F]+$/).withMessage('Name can only contain letters and spaces'),
    
    body('email')
        .trim()
        .notEmpty().withMessage('Email is required')
        .isEmail().withMessage('Please provide a valid email')
        .normalizeEmail(),
    
    body('password')
        .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/)
        .withMessage('Password must contain at least one uppercase, one lowercase, one number, and one special character'),
    
    body('confirmPassword')
        .custom((value, { req }) => value === req.body.password)
        .withMessage('Passwords do not match'),
    
    body('phone')
        .optional()
        .matches(/^\+?[0-9]{10,15}$/).withMessage('Please provide a valid phone number'),
];

const validateUserLogin = [
    body('email')
        .trim()
        .notEmpty().withMessage('Email is required')
        .isEmail().withMessage('Please provide a valid email'),
    
    body('password')
        .notEmpty().withMessage('Password is required'),
];

const validateUserUpdate = [
    param('id')
        .isMongoId().withMessage('Invalid user ID'),
    
    body('name')
        .optional()
        .trim()
        .isLength({ min: 2, max: 100 }).withMessage('Name must be between 2 and 100 characters'),
    
    body('phone')
        .optional()
        .matches(/^\+?[0-9]{10,15}$/).withMessage('Please provide a valid phone number'),
    
    body('avatar')
        .optional()
        .isURL().withMessage('Avatar must be a valid URL'),
];

const validatePasswordChange = [
    body('currentPassword')
        .notEmpty().withMessage('Current password is required'),
    
    body('newPassword')
        .isLength({ min: 8 }).withMessage('New password must be at least 8 characters')
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/)
        .withMessage('Password must contain uppercase, lowercase, number, and special character'),
    
    body('confirmNewPassword')
        .custom((value, { req }) => value === req.body.newPassword)
        .withMessage('New passwords do not match'),
];

const validateEmailVerification = [
    body('email')
        .isEmail().withMessage('Valid email required'),
    
    body('code')
        .isLength({ min: 6, max: 6 }).withMessage('Verification code must be 6 digits')
        .isNumeric().withMessage('Verification code must be numeric'),
];

const validateTwoFactorEnable = [
    body('code')
        .isLength({ min: 6, max: 6 }).withMessage('2FA code must be 6 digits')
        .isNumeric().withMessage('2FA code must be numeric'),
];

const validateForgotPassword = [
    body('email')
        .isEmail().withMessage('Valid email required'),
];

const validateResetPassword = [
    body('token')
        .notEmpty().withMessage('Reset token is required'),
    
    body('newPassword')
        .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/)
        .withMessage('Password must contain uppercase, lowercase, number, and special character'),
];

// Validation result handler
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
    validateUserRegistration,
    validateUserLogin,
    validateUserUpdate,
    validatePasswordChange,
    validateEmailVerification,
    validateTwoFactorEnable,
    validateForgotPassword,
    validateResetPassword,
    validate,
};