/**
 * ESTIF HOME ULTIMATE - API V1 ROUTES INDEX
 * Centralized routing for all API endpoints
 * Version: 2.0.0
 * Author: Estifanos Yohannis
 */

const express = require('express');
const router = express.Router();

// Import route modules
const authRoutes = require('./auth');
const userRoutes = require('./users');
const homeRoutes = require('./homes');
const deviceRoutes = require('./devices');
const automationRoutes = require('./automations');
const scheduleRoutes = require('./schedules');
const energyRoutes = require('./energy');
const analyticsRoutes = require('./analytics');
const notificationRoutes = require('./notifications');
const webhookRoutes = require('./webhooks');
const voiceRoutes = require('./voice');
const bluetoothRoutes = require('./bluetooth');
const backupRoutes = require('./backup');
const auditRoutes = require('./audit');

// Mount routes
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/homes', homeRoutes);
router.use('/devices', deviceRoutes);
router.use('/automations', automationRoutes);
router.use('/schedules', scheduleRoutes);
router.use('/energy', energyRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/notifications', notificationRoutes);
router.use('/webhooks', webhookRoutes);
router.use('/voice', voiceRoutes);
router.use('/bluetooth', bluetoothRoutes);
router.use('/backup', backupRoutes);
router.use('/audit', auditRoutes);

// Health check for API version
router.get('/health', (req, res) => {
    res.json({
        success: true,
        version: 'v1',
        status: 'operational',
        timestamp: new Date().toISOString()
    });
});

module.exports = router;