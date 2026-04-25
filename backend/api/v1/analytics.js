/**
 * ESTIF HOME ULTIMATE - ANALYTICS API ROUTES
 * Data analytics and insights endpoints
 * Version: 2.0.0
 */

const express = require('express');
const router = express.Router();
const { query } = require('express-validator');
const analyticsController = require('../../controllers/analyticsController');
const { authMiddleware } = require('../../middleware/auth');

// Validation rules
const validateAnalyticsQuery = [
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
    query('deviceId').optional().isMongoId(),
    query('homeId').optional().isMongoId(),
    query('interval').optional().isIn(['hour', 'day', 'week', 'month', 'year'])
];

// Routes
router.get('/dashboard', authMiddleware, analyticsController.getDashboardAnalytics);
router.get('/devices', authMiddleware, analyticsController.getDeviceAnalytics);
router.get('/usage', authMiddleware, validateAnalyticsQuery, analyticsController.getUsageAnalytics);
router.get('/peak-hours', authMiddleware, validateAnalyticsQuery, analyticsController.getPeakHours);
router.get('/trends', authMiddleware, validateAnalyticsQuery, analyticsController.getTrends);
router.get('/predictions', authMiddleware, analyticsController.getPredictions);
router.get('/insights', authMiddleware, analyticsController.getInsights);
router.get('/export', authMiddleware, analyticsController.exportAnalytics);
router.get('/custom', authMiddleware, analyticsController.getCustomAnalytics);

module.exports = router;