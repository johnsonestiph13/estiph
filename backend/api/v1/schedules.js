/**
 * ESTIF HOME ULTIMATE - SCHEDULES API ROUTES
 * Device scheduling endpoints
 * Version: 2.0.0
 */

const express = require('express');
const router = express.Router();
const { body, param } = require('express-validator');
const scheduleController = require('../../controllers/scheduleController');
const { authMiddleware } = require('../../middleware/auth');

// Validation rules
const validateScheduleId = [
    param('id').isMongoId().withMessage('Invalid schedule ID')
];

const validateCreateSchedule = [
    body('name').notEmpty().withMessage('Schedule name is required'),
    body('deviceId').isMongoId().withMessage('Valid device ID is required'),
    body('time').matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Invalid time format'),
    body('days').isArray().withMessage('Days must be an array'),
    body('action').isIn(['on', 'off', 'toggle']).withMessage('Invalid action'),
    body('enabled').optional().isBoolean()
];

// Routes
router.get('/', authMiddleware, scheduleController.getUserSchedules);
router.post('/', authMiddleware, validateCreateSchedule, scheduleController.createSchedule);
router.get('/:id', authMiddleware, validateScheduleId, scheduleController.getSchedule);
router.put('/:id', authMiddleware, validateScheduleId, scheduleController.updateSchedule);
router.delete('/:id', authMiddleware, validateScheduleId, scheduleController.deleteSchedule);
router.post('/:id/toggle', authMiddleware, validateScheduleId, scheduleController.toggleSchedule);
router.post('/:id/run', authMiddleware, validateScheduleId, scheduleController.runScheduleNow);
router.get('/device/:deviceId', authMiddleware, scheduleController.getDeviceSchedules);

module.exports = router;