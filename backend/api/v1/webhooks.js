/**
 * ESTIF HOME ULTIMATE - WEBHOOKS API ROUTES
 * Webhook management endpoints
 * Version: 2.0.0
 */

const express = require('express');
const router = express.Router();
const { body, param } = require('express-validator');
const webhookController = require('../../controllers/webhookController');
const { authMiddleware, adminMiddleware } = require('../../middleware/auth');

// Validation rules
const validateWebhookId = [
    param('id').isMongoId().withMessage('Invalid webhook ID')
];

const validateCreateWebhook = [
    body('url').isURL().withMessage('Valid URL is required'),
    body('events').isArray().withMessage('Events must be an array'),
    body('secret').optional().isString(),
    body('enabled').optional().isBoolean()
];

// Routes
router.get('/', authMiddleware, webhookController.getUserWebhooks);
router.post('/', authMiddleware, validateCreateWebhook, webhookController.createWebhook);
router.get('/:id', authMiddleware, validateWebhookId, webhookController.getWebhook);
router.put('/:id', authMiddleware, validateWebhookId, webhookController.updateWebhook);
router.delete('/:id', authMiddleware, validateWebhookId, webhookController.deleteWebhook);
router.post('/:id/toggle', authMiddleware, validateWebhookId, webhookController.toggleWebhook);
router.post('/:id/test', authMiddleware, validateWebhookId, webhookController.testWebhook);
router.get('/:id/deliveries', authMiddleware, validateWebhookId, webhookController.getWebhookDeliveries);

// Incoming webhook endpoints (no auth required)
router.post('/incoming/github', webhookController.handleGitHubWebhook);
router.post('/incoming/stripe', webhookController.handleStripeWebhook);
router.post('/incoming/ifttt', webhookController.handleIFTTTWebhook);

module.exports = router;