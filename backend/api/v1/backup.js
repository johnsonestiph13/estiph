/**
 * ESTIF HOME ULTIMATE - BACKUP API ROUTES
 * Data backup and restore endpoints
 * Version: 2.0.0
 */

const express = require('express');
const router = express.Router();
const { body, param } = require('express-validator');
const backupController = require('../../controllers/backupController');
const { authMiddleware, adminMiddleware } = require('../../middleware/auth');

// Validation rules
const validateBackupId = [
    param('id').isMongoId().withMessage('Invalid backup ID')
];

// Routes
router.get('/', authMiddleware, backupController.getUserBackups);
router.post('/create', authMiddleware, backupController.createBackup);
router.get('/:id/download', authMiddleware, validateBackupId, backupController.downloadBackup);
router.post('/restore/:id', authMiddleware, validateBackupId, backupController.restoreBackup);
router.delete('/:id', authMiddleware, validateBackupId, backupController.deleteBackup);
router.post('/schedule', authMiddleware, backupController.scheduleBackup);
router.get('/settings', authMiddleware, backupController.getBackupSettings);
router.put('/settings', authMiddleware, backupController.updateBackupSettings);

// Admin routes
router.get('/admin/all', authMiddleware, adminMiddleware, backupController.getAllBackups);
router.post('/admin/cleanup', authMiddleware, adminMiddleware, backupController.cleanupOldBackups);

module.exports = router;