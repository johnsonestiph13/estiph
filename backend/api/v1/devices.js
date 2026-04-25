/**
 * ESTIF HOME ULTIMATE - DEVICES API ROUTES
 * Device management endpoints
 * Version: 2.0.0
 */

const express = require('express');
const router = express.Router();
const { body, param, query } = require('express-validator');
const deviceController = require('../../controllers/deviceController');
const { authMiddleware, deviceOwnerMiddleware } = require('../../middleware/auth');

// Validation rules
const validateDeviceId = [
    param('id').isMongoId().withMessage('Invalid device ID')
];

const validateCreateDevice = [
    body('name').notEmpty().withMessage('Device name is required').isLength({ min: 2, max: 50 }),
    body('type').isIn(['light', 'fan', 'ac', 'tv', 'heater', 'pump', 'sensor', 'camera', 'lock']),
    body('room').optional(),
    body('gpio').optional().isInt({ min: 0, max: 39 }),
    body('power').optional().isInt({ min: 0 }),
    body('homeId').isMongoId().withMessage('Valid home ID is required')
];

const validateUpdateDevice = [
    body('name').optional().isLength({ min: 2, max: 50 }),
    body('room').optional(),
    body('gpio').optional().isInt({ min: 0, max: 39 }),
    body('power').optional().isInt({ min: 0 }),
    body('metadata').optional().isObject()
];

const validateToggleDevice = [
    body('state').isBoolean().withMessage('State must be boolean')
];

const validateAutoMode = [
    body('enabled').isBoolean().withMessage('Enabled must be boolean')
];

// Routes
router.get('/', authMiddleware, deviceController.getUserDevices);
router.post('/', authMiddleware, validateCreateDevice, deviceController.createDevice);
router.get('/:id', authMiddleware, validateDeviceId, deviceOwnerMiddleware, deviceController.getDevice);
router.put('/:id', authMiddleware, validateDeviceId, deviceOwnerMiddleware, validateUpdateDevice, deviceController.updateDevice);
router.delete('/:id', authMiddleware, validateDeviceId, deviceOwnerMiddleware, deviceController.deleteDevice);

// Device control
router.post('/:id/toggle', authMiddleware, validateDeviceId, deviceOwnerMiddleware, validateToggleDevice, deviceController.toggleDevice);
router.post('/:id/auto', authMiddleware, validateDeviceId, deviceOwnerMiddleware, validateAutoMode, deviceController.setAutoMode);
router.post('/master/:command', authMiddleware, deviceController.masterControl);

// Device groups
router.get('/groups', authMiddleware, deviceController.getDeviceGroups);
router.post('/groups', authMiddleware, deviceController.createDeviceGroup);
router.put('/groups/:groupId', authMiddleware, deviceController.updateDeviceGroup);
router.delete('/groups/:groupId', authMiddleware, deviceController.deleteDeviceGroup);
router.post('/groups/:groupId/devices/:deviceId', authMiddleware, deviceController.addDeviceToGroup);
router.delete('/groups/:groupId/devices/:deviceId', authMiddleware, deviceController.removeDeviceFromGroup);

// Device schedules
router.get('/:id/schedules', authMiddleware, validateDeviceId, deviceOwnerMiddleware, deviceController.getDeviceSchedules);
router.post('/:id/schedules', authMiddleware, validateDeviceId, deviceOwnerMiddleware, deviceController.addDeviceSchedule);
router.delete('/:id/schedules/:scheduleId', authMiddleware, validateDeviceId, deviceOwnerMiddleware, deviceController.deleteDeviceSchedule);

// Device analytics
router.get('/:id/analytics', authMiddleware, validateDeviceId, deviceOwnerMiddleware, deviceController.getDeviceAnalytics);
router.get('/:id/history', authMiddleware, validateDeviceId, deviceOwnerMiddleware, deviceController.getDeviceHistory);

// Device calibration
router.post('/:id/calibrate', authMiddleware, validateDeviceId, deviceOwnerMiddleware, deviceController.calibrateDevice);

module.exports = router;