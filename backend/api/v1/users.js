/**
 * ESTIF HOME ULTIMATE - USERS API ROUTES
 * User management endpoints
 * Version: 2.0.0
 */

const express = require('express');
const router = express.Router();
const { body, param, query } = require('express-validator');
const userController = require('../../controllers/userController');
const { authMiddleware, adminMiddleware } = require('../../middleware/auth');

// Validation rules
const validateUserId = [
    param('id').isMongoId().withMessage('Invalid user ID')
];

const validateUpdateUser = [
    body('name').optional().isLength({ min: 2, max: 50 }),
    body('email').optional().isEmail(),
    body('role').optional().isIn(['user', 'admin', 'super_admin']),
    body('settings').optional().isObject()
];

// User routes (protected)
router.get('/me', authMiddleware, userController.getProfile);
router.put('/me', authMiddleware, userController.updateProfile);
router.delete('/me', authMiddleware, userController.deleteAccount);
router.get('/me/devices', authMiddleware, userController.getUserDevices);
router.get('/me/homes', authMiddleware, userController.getUserHomes);
router.get('/me/activity', authMiddleware, userController.getUserActivity);
router.get('/me/notifications', authMiddleware, userController.getUserNotifications);
router.put('/me/notifications/:id/read', authMiddleware, userController.markNotificationRead);
router.put('/me/notifications/read-all', authMiddleware, userController.markAllNotificationsRead);

// Admin only routes
router.get('/', authMiddleware, adminMiddleware, userController.getAllUsers);
router.get('/:id', authMiddleware, adminMiddleware, validateUserId, userController.getUserById);
router.put('/:id', authMiddleware, adminMiddleware, validateUserId, validateUpdateUser, userController.updateUser);
router.delete('/:id', authMiddleware, adminMiddleware, validateUserId, userController.deleteUser);
router.post('/:id/impersonate', authMiddleware, adminMiddleware, validateUserId, userController.impersonateUser);
router.post('/:id/suspend', authMiddleware, adminMiddleware, validateUserId, userController.suspendUser);
router.post('/:id/unsuspend', authMiddleware, adminMiddleware, validateUserId, userController.unsuspendUser);

module.exports = router;