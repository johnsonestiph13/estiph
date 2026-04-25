/**
 * ESTIF HOME ULTIMATE - AUTOMATIONS API ROUTES
 * Automation rule management endpoints
 * Version: 2.0.0
 */

const express = require('express');
const router = express.Router();
const { body, param } = require('express-validator');
const automationController = require('../../controllers/automationController');
const { authMiddleware, homeAdminMiddleware } = require('../../middleware/auth');

// Validation rules
const validateAutomationId = [
    param('id').isMongoId().withMessage('Invalid automation ID')
];

const validateCreateAutomation = [
    body('name').notEmpty().withMessage('Automation name is required'),
    body('homeId').isMongoId().withMessage('Valid home ID is required'),
    body('trigger').isObject().withMessage('Trigger configuration is required'),
    body('action').isObject().withMessage('Action configuration is required'),
    body('enabled').optional().isBoolean()
];

const validateUpdateAutomation = [
    body('name').optional(),
    body('trigger').optional().isObject(),
    body('action').optional().isObject(),
    body('enabled').optional().isBoolean()
];

// Routes
router.get('/', authMiddleware, automationController.getUserAutomations);
router.post('/', authMiddleware, validateCreateAutomation, automationController.createAutomation);
router.get('/:id', authMiddleware, validateAutomationId, automationController.getAutomation);
router.put('/:id', authMiddleware, validateAutomationId, validateUpdateAutomation, automationController.updateAutomation);
router.delete('/:id', authMiddleware, validateAutomationId, automationController.deleteAutomation);
router.post('/:id/toggle', authMiddleware, validateAutomationId, automationController.toggleAutomation);
router.post('/:id/trigger', authMiddleware, validateAutomationId, automationController.triggerAutomation);
router.get('/:id/history', authMiddleware, validateAutomationId, automationController.getAutomationHistory);
router.post('/test', authMiddleware, automationController.testAutomation);
router.get('/templates', authMiddleware, automationController.getAutomationTemplates);
router.post('/templates/:templateId', authMiddleware, automationController.createFromTemplate);

module.exports = router;