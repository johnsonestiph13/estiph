/**
 * ESTIF HOME ULTIMATE - AUTH API ROUTES
 * Authentication and authorization endpoints
 * Version: 2.0.0
 */

const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');
const authController = require('../../controllers/authController');

// Rate limiting for auth routes
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: { success: false, message: 'Too many login attempts, please try again later' }
});

const registerLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 10,
    message: { success: false, message: 'Too many registration attempts, please try again later' }
});

// Validation rules
const validateRegister = [
    body('name').notEmpty().withMessage('Name is required').isLength({ min: 2, max: 50 }),
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
];

const validateLogin = [
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').notEmpty().withMessage('Password is required')
];

const validateForgotPassword = [
    body('email').isEmail().withMessage('Valid email is required')
];

const validateResetPassword = [
    body('token').notEmpty().withMessage('Token is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
];

// Routes
router.post('/register', registerLimiter, validateRegister, authController.register);
router.post('/login', loginLimiter, validateLogin, authController.login);
router.post('/logout', authController.logout);
router.post('/refresh-token', authController.refreshToken);
router.post('/forgot-password', validateForgotPassword, authController.forgotPassword);
router.post('/reset-password', validateResetPassword, authController.resetPassword);
router.post('/verify-email/:token', authController.verifyEmail);
router.post('/resend-verification', authController.resendVerification);
router.get('/me', authController.getCurrentUser);
router.put('/profile', authController.updateProfile);
router.post('/change-password', authController.changePassword);
router.post('/enable-2fa', authController.enableTwoFactor);
router.post('/verify-2fa', authController.verifyTwoFactor);
router.post('/disable-2fa', authController.disableTwoFactor);
router.post('/logout-all', authController.logoutAllDevices);
router.get('/sessions', authController.getActiveSessions);
router.delete('/sessions/:sessionId', authController.revokeSession);

module.exports = router;