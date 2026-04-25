/**
 * ESTIF HOME ULTIMATE - BLUETOOTH API ROUTES
 * Bluetooth device management endpoints
 * Version: 2.0.0
 */

const express = require('express');
const router = express.Router();
const { body, param } = require('express-validator');
const bluetoothController = require('../../controllers/bluetoothController');
const { authMiddleware } = require('../../middleware/auth');

// Validation rules
const validateDeviceId = [
    param('id').isMongoId().withMessage('Invalid device ID')
];

// Routes
router.get('/devices', authMiddleware, bluetoothController.getPairedDevices);
router.post('/scan', authMiddleware, bluetoothController.startScan);
router.post('/pair', authMiddleware, bluetoothController.pairDevice);
router.post('/connect/:id', authMiddleware, validateDeviceId, bluetoothController.connectDevice);
router.post('/disconnect/:id', authMiddleware, validateDeviceId, bluetoothController.disconnectDevice);
router.delete('/unpair/:id', authMiddleware, validateDeviceId, bluetoothController.unpairDevice);
router.get('/:id/status', authMiddleware, validateDeviceId, bluetoothController.getDeviceStatus);
router.post('/:id/command', authMiddleware, validateDeviceId, bluetoothController.sendCommand);
router.post('/:id/ota', authMiddleware, validateDeviceId, bluetoothController.startOTAUpdate);

module.exports = router;