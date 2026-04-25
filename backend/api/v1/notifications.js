/**
 * ESTIF HOME ULTIMATE - NOTIFICATIONS API ROUTES
 * Push notification management endpoints
 * Version: 2.0.0
 */

const express = require('express');
const router = express.Router();
const { body, param } = require('express-validator');
const notificationController = require('../../controllers/notificationController');
const { authMiddleware, adminMiddleware } = require('../../middleware/auth');

// Validation rules
const validateNotificationId = [
    param('id').isMongoId().withMessage('Invalid notification ID')
];

const validateSendNotification = [
    body('title').notEmpty().withMessage('Title is required'),
    body('body').notEmpty().withMessage('Body is required'),
    body('type').optional().isIn(['info', 'warning', 'error', 'success']),
    body('targetUsers').optional().isArray(),
    body('targetHomes').optional().isArray()
];

// Routes
router.get('/', authMiddleware, notificationController.getUserNotifications);
router.get('/unread-count', authMiddleware, notificationController.getUnreadCount);
router.put('/:id/read', authMiddleware, validateNotificationId, notificationController.markAsRead);
router.put('/read-all', authMiddleware, notificationController.markAllAsRead);
router.delete('/:id', authMiddleware, validateNotificationId, notificationController.deleteNotification);
router.delete('/', authMiddleware, notificationController.deleteAllNotifications);

// Push notification subscription
router.post('/subscribe', authMiddleware, notificationController.subscribePush);
router.post('/unsubscribe', authMiddleware, notificationController.unsubscribePush);
router.post('/test', authMiddleware, notificationController.sendTestNotification);

// Admin routes
router.post('/broadcast', authMiddleware, adminMiddleware, validateSendNotification, notificationController.broadcastNotification);
router.get('/templates', authMiddleware, adminMiddleware, notificationController.getNotificationTemplates);
router.post('/templates', authMiddleware, adminMiddleware, notificationController.createNotificationTemplate);

module.exports = router;