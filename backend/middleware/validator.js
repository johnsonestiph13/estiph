const { validationResult, body, param, query } = require('express-validator');

const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            message: 'Validation failed',
            errors: errors.array()
        });
    }
    next();
};

const validateObjectId = (paramName) => {
    return param(paramName).isMongoId().withMessage(`Invalid ${paramName} format`);
};

const validateEmail = body('email').isEmail().withMessage('Valid email is required').normalizeEmail();
const validatePassword = body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters');
const validateName = body('name').notEmpty().withMessage('Name is required').isLength({ min: 2, max: 50 });

const paginationValidator = [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt()
];

const dateRangeValidator = [
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601()
];

module.exports = {
    validate,
    validateObjectId,
    validateEmail,
    validatePassword,
    validateName,
    paginationValidator,
    dateRangeValidator
};