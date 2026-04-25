/**
 * ESTIF HOME ULTIMATE - AUDIT API ROUTES
 * Audit log management endpoints
 * Version: 2.0.0
 */

const express = require('express');
const router = express.Router();
const { query, param } = require('express-validator');
const auditController = require('../../controllers/auditController');
const { authMiddleware, adminMiddleware } = require('../../middleware/auth');

// Validation rules
const validateAuditId = [
    param('id').isMongoId().withMessage('Invalid audit ID')
];

const validateDateRange = [
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601()
];

// Routes
router.get('/', authMiddleware, validateDateRange, auditController.getAuditLogs);
router.get('/user/:userId', authMiddleware, validateDateRange, auditController.getUserAuditLogs);
router.get('/home/:homeId', authMiddleware, validateDateRange, auditController.getHomeAuditLogs);
router.get('/device/:deviceId', authMiddleware, validateDateRange, auditController.getDeviceAuditLogs);
router.get('/count', authMiddleware, auditController.getAuditCount);
router.get('/export', authMiddleware, auditController.exportAuditLogs);
router.get('/categories', authMiddleware, auditController.getAuditCategories);
router.get('/stats', authMiddleware, adminMiddleware, auditController.getAuditStats);
router.delete('/old', authMiddleware, adminMiddleware, auditController.cleanupOldAuditLogs);

// Admin only
router.get('/admin/all', authMiddleware, adminMiddleware, auditController.getAllAuditLogs);
router.get('/admin/sensitive', authMiddleware, adminMiddleware, auditController.getSensitiveAuditLogs);

module.exports = router;