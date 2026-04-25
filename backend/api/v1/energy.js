/**
 * ESTIF HOME ULTIMATE - ENERGY API ROUTES
 * Energy monitoring and management endpoints
 * Version: 2.0.0
 */

const express = require('express');
const router = express.Router();
const { query } = require('express-validator');
const energyController = require('../../controllers/energyController');
const { authMiddleware } = require('../../middleware/auth');

// Validation rules
const validateDateRange = [
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
    query('interval').optional().isIn(['hour', 'day', 'week', 'month'])
];

// Routes
router.get('/consumption', authMiddleware, validateDateRange, energyController.getEnergyConsumption);
router.get('/cost', authMiddleware, validateDateRange, energyController.getEnergyCost);
router.get('/devices', authMiddleware, energyController.getDeviceEnergyUsage);
router.get('/savings', authMiddleware, energyController.getEnergySavings);
router.get('/forecast', authMiddleware, energyController.getEnergyForecast);
router.get('/reports', authMiddleware, energyController.getEnergyReports);
router.post('/reports', authMiddleware, energyController.generateEnergyReport);
router.get('/reports/:id/download', authMiddleware, energyController.downloadEnergyReport);
router.get('/alerts', authMiddleware, energyController.getEnergyAlerts);
router.post('/alerts/:id/acknowledge', authMiddleware, energyController.acknowledgeEnergyAlert);

module.exports = router;