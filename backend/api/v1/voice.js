/**
 * ESTIF HOME ULTIMATE - VOICE API ROUTES
 * Voice command processing endpoints
 * Version: 2.0.0
 */

const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const voiceController = require('../../controllers/voiceController');
const { authMiddleware } = require('../../middleware/auth');

// Validation rules
const validateVoiceCommand = [
    body('text').notEmpty().withMessage('Voice text is required'),
    body('language').optional().isString().isLength({ min: 2, max: 5 })
];

// Routes
router.post('/command', authMiddleware, validateVoiceCommand, voiceController.processCommand);
router.post('/stream', authMiddleware, voiceController.processStreamingCommand);
router.get('/history', authMiddleware, voiceController.getCommandHistory);
router.delete('/history', authMiddleware, voiceController.clearCommandHistory);
router.get('/suggestions', authMiddleware, voiceController.getCommandSuggestions);
router.post('/train', authMiddleware, voiceController.trainCustomCommand);
router.get('/models', authMiddleware, voiceController.getVoiceModels);
router.delete('/models/:modelId', authMiddleware, voiceController.deleteVoiceModel);

module.exports = router;