/**
 * ESTIF HOME ULTIMATE - AUTOMATION CONTROLLER
 * Automation rule management and execution logic
 * Version: 2.0.0
 * Author: Estifanos Yohannis
 */

const Automation = require('../models/Automation');
const Device = require('../models/Device');
const ActivityLog = require('../models/ActivityLog');
const { evaluateCondition, executeAction } = require('../services/automationService');

// Get user's automations
exports.getUserAutomations = async (req, res) => {
    try {
        const { homeId, enabled, page = 1, limit = 50 } = req.query;

        const filter = { userId: req.user._id };
        if (homeId) filter.homeId = homeId;
        if (enabled !== undefined) filter.enabled = enabled === 'true';

        const skip = (page - 1) * limit;

        const automations = await Automation.find(filter)
            .skip(skip)
            .limit(parseInt(limit))
            .sort({ createdAt: -1 });

        const total = await Automation.countDocuments(filter);

        res.json({
            success: true,
            data: automations,
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('Get user automations error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Create automation
exports.createAutomation = async (req, res) => {
    try {
        const { name, nameAm, description, homeId, trigger, condition, action, enabled } = req.body;

        // Validate trigger and action
        if (!trigger || !trigger.type) {
            return res.status(400).json({
                success: false,
                message: 'Trigger configuration is required'
            });
        }

        if (!action || !action.type) {
            return res.status(400).json({
                success: false,
                message: 'Action configuration is required'
            });
        }

        const automation = await Automation.create({
            name,
            nameAm,
            description,
            userId: req.user._id,
            homeId,
            trigger,
            condition,
            action,
            enabled: enabled !== false
        });

        await ActivityLog.create({
            userId: req.user._id,
            action: 'automation_created',
            entityType: 'automation',
            entityId: automation._id,
            ip: req.ip,
            userAgent: req.headers['user-agent'],
            details: { automationName: automation.name }
        });

        res.status(201).json({
            success: true,
            data: automation
        });
    } catch (error) {
        console.error('Create automation error:', error);
        await ActivityLog.create({
            userId: req.user._id,
            action: 'automation_creation_failed',
            ip: req.ip,
            userAgent: req.headers['user-agent'],
            details: { error: error.message }
        });
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Get automation by ID
exports.getAutomation = async (req, res) => {
    try {
        const { id } = req.params;

        const automation = await Automation.findOne({ _id: id, userId: req.user._id });
        if (!automation) {
            return res.status(404).json({
                success: false,
                message: 'Automation not found'
            });
        }

        res.json({
            success: true,
            data: automation
        });
    } catch (error) {
        console.error('Get automation error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Update automation
exports.updateAutomation = async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        const automation = await Automation.findOneAndUpdate(
            { _id: id, userId: req.user._id },
            { ...updates, updatedAt: Date.now() },
            { new: true, runValidators: true }
        );

        if (!automation) {
            return res.status(404).json({
                success: false,
                message: 'Automation not found'
            });
        }

        await ActivityLog.create({
            userId: req.user._id,
            action: 'automation_updated',
            entityType: 'automation',
            entityId: automation._id,
            ip: req.ip,
            userAgent: req.headers['user-agent'],
            details: { automationName: automation.name, updates: Object.keys(updates) }
        });

        res.json({
            success: true,
            data: automation
        });
    } catch (error) {
        console.error('Update automation error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Delete automation
exports.deleteAutomation = async (req, res) => {
    try {
        const { id } = req.params;

        const automation = await Automation.findOneAndDelete({ _id: id, userId: req.user._id });
        if (!automation) {
            return res.status(404).json({
                success: false,
                message: 'Automation not found'
            });
        }

        await ActivityLog.create({
            userId: req.user._id,
            action: 'automation_deleted',
            entityType: 'automation',
            entityId: automation._id,
            ip: req.ip,
            userAgent: req.headers['user-agent'],
            details: { automationName: automation.name }
        });

        res.json({
            success: true,
            message: 'Automation deleted successfully'
        });
    } catch (error) {
        console.error('Delete automation error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Toggle automation
exports.toggleAutomation = async (req, res) => {
    try {
        const { id } = req.params;
        const { enabled } = req.body;

        const automation = await Automation.findOneAndUpdate(
            { _id: id, userId: req.user._id },
            { enabled, updatedAt: Date.now() },
            { new: true }
        );

        if (!automation) {
            return res.status(404).json({
                success: false,
                message: 'Automation not found'
            });
        }

        await ActivityLog.create({
            userId: req.user._id,
            action: enabled ? 'automation_enabled' : 'automation_disabled',
            entityType: 'automation',
            entityId: automation._id,
            ip: req.ip,
            userAgent: req.headers['user-agent'],
            details: { automationName: automation.name }
        });

        res.json({
            success: true,
            data: automation
        });
    } catch (error) {
        console.error('Toggle automation error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Trigger automation manually
exports.triggerAutomation = async (req, res) => {
    try {
        const { id } = req.params;

        const automation = await Automation.findOne({ _id: id, userId: req.user._id });
        if (!automation) {
            return res.status(404).json({
                success: false,
                message: 'Automation not found'
            });
        }

        if (!automation.enabled) {
            return res.status(400).json({
                success: false,
                message: 'Automation is disabled'
            });
        }

        // Execute automation
        const result = await executeAutomation(automation, req.user._id);

        await ActivityLog.create({
            userId: req.user._id,
            action: 'automation_manually_triggered',
            entityType: 'automation',
            entityId: automation._id,
            ip: req.ip,
            userAgent: req.headers['user-agent'],
            details: { automationName: automation.name, result }
        });

        res.json({
            success: true,
            message: 'Automation triggered successfully',
            data: result
        });
    } catch (error) {
        console.error('Trigger automation error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Get automation history
exports.getAutomationHistory = async (req, res) => {
    try {
        const { id } = req.params;
        const { limit = 50, offset = 0 } = req.query;

        const history = await ActivityLog.find({
            entityType: 'automation',
            entityId: id,
            userId: req.user._id,
            action: { $in: ['automation_triggered', 'automation_executed'] }
        })
            .sort({ createdAt: -1 })
            .skip(parseInt(offset))
            .limit(parseInt(limit));

        const total = await ActivityLog.countDocuments({
            entityType: 'automation',
            entityId: id,
            userId: req.user._id,
            action: { $in: ['automation_triggered', 'automation_executed'] }
        });

        res.json({
            success: true,
            data: history,
            pagination: {
                total,
                limit: parseInt(limit),
                offset: parseInt(offset),
                hasMore: offset + limit < total
            }
        });
    } catch (error) {
        console.error('Get automation history error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Test automation
exports.testAutomation = async (req, res) => {
    try {
        const { trigger, condition, action } = req.body;

        // Simulate trigger evaluation
        const triggerResult = await evaluateCondition(trigger, { testMode: true });
        
        let conditionResult = true;
        if (condition) {
            conditionResult = await evaluateCondition(condition, { testMode: true });
        }

        let actionResult = null;
        if (triggerResult && conditionResult) {
            actionResult = await executeAction(action, { testMode: true });
        }

        res.json({
            success: true,
            data: {
                triggerResult,
                conditionResult,
                actionResult,
                wouldExecute: triggerResult && conditionResult
            }
        });
    } catch (error) {
        console.error('Test automation error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Get automation templates
exports.getAutomationTemplates = async (req, res) => {
    try {
        const templates = [
            {
                id: 'template_1',
                name: 'Schedule Light',
                description: 'Turn lights on/off at specific times',
                trigger: { type: 'schedule', time: '07:00', days: [1,2,3,4,5] },
                action: { type: 'device', deviceId: null, command: 'on' }
            },
            {
                id: 'template_2',
                name: 'Temperature Control',
                description: 'Control AC based on temperature',
                trigger: { type: 'temperature', operator: '>', value: 26 },
                action: { type: 'device', deviceId: null, command: 'on' }
            },
            {
                id: 'template_3',
                name: 'Motion Detection',
                description: 'Turn on lights when motion detected',
                trigger: { type: 'motion', deviceId: null },
                action: { type: 'device', deviceId: null, command: 'on', duration: 300000 }
            },
            {
                id: 'template_4',
                name: 'Vacation Mode',
                description: 'Randomize lights when away',
                trigger: { type: 'time', start: '18:00', end: '23:00' },
                action: { type: 'randomize', devices: [], probability: 0.3 }
            }
        ];

        res.json({
            success: true,
            data: templates
        });
    } catch (error) {
        console.error('Get automation templates error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Create automation from template
exports.createFromTemplate = async (req, res) => {
    try {
        const { templateId, deviceId, homeId } = req.params;

        const templates = {
            template_1: {
                name: 'Schedule Light',
                trigger: { type: 'schedule', time: '07:00', days: [1,2,3,4,5] },
                action: { type: 'device', deviceId: deviceId, command: 'on' }
            },
            template_2: {
                name: 'Temperature Control',
                trigger: { type: 'temperature', operator: '>', value: 26 },
                action: { type: 'device', deviceId: deviceId, command: 'on' }
            },
            template_3: {
                name: 'Motion Detection',
                trigger: { type: 'motion', deviceId: null },
                action: { type: 'device', deviceId: deviceId, command: 'on', duration: 300000 }
            }
        };

        const template = templates[templateId];
        if (!template) {
            return res.status(404).json({
                success: false,
                message: 'Template not found'
            });
        }

        const automation = await Automation.create({
            name: template.name,
            userId: req.user._id,
            homeId,
            trigger: template.trigger,
            action: template.action,
            enabled: true
        });

        res.status(201).json({
            success: true,
            data: automation
        });
    } catch (error) {
        console.error('Create from template error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Helper function to execute automation
async function executeAutomation(automation, userId) {
    // Check trigger condition
    const isTriggered = await evaluateCondition(automation.trigger, { automation, userId });
    
    if (!isTriggered) {
        return { executed: false, reason: 'Trigger condition not met' };
    }

    // Check additional conditions
    if (automation.condition) {
        const conditionMet = await evaluateCondition(automation.condition, { automation, userId });
        if (!conditionMet) {
            return { executed: false, reason: 'Condition not met' };
        }
    }

    // Execute action
    const result = await executeAction(automation.action, { automation, userId });

    // Log execution
    await ActivityLog.create({
        userId,
        action: 'automation_triggered',
        entityType: 'automation',
        entityId: automation._id,
        details: {
            automationName: automation.name,
            trigger: automation.trigger,
            action: automation.action,
            result
        }
    });

    return { executed: true, result };
}