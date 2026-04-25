/**
 * ESTIF HOME ULTIMATE - VOICE CONTROLLER
 * Voice command processing and AI integration
 * Version: 2.0.0
 * Author: Estifanos Yohannis
 */

const Device = require('../models/Device');
const ActivityLog = require('../models/ActivityLog');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

// Process voice command
exports.processCommand = async (req, res) => {
    try {
        const { text, language = 'en' } = req.body;

        if (!text) {
            return res.status(400).json({
                success: false,
                message: 'No voice text provided'
            });
        }

        // Get user's devices for context
        const devices = await Device.find({ ownerId: req.user._id }).lean();

        // Build prompt for Gemini AI
        const prompt = buildCommandPrompt(text, devices, language);

        // Call Gemini AI
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const actionText = response.text();

        // Parse AI response
        let action;
        try {
            action = JSON.parse(actionText);
        } catch (e) {
            // Try to extract JSON from text
            const jsonMatch = actionText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                action = JSON.parse(jsonMatch[0]);
            } else {
                throw new Error('Invalid AI response format');
            }
        }

        // Execute the action
        const executionResult = await executeVoiceAction(action, req.user._id);

        // Log activity
        await ActivityLog.create({
            userId: req.user._id,
            action: 'voice_command',
            details: {
                command: text,
                interpreted: action,
                result: executionResult
            },
            ip: req.ip,
            userAgent: req.headers['user-agent']
        });

        res.json({
            success: true,
            data: {
                interpreted: action,
                result: executionResult,
                response: executionResult.message || 'Command executed successfully'
            }
        });
    } catch (error) {
        console.error('Process voice command error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to process voice command',
            error: error.message
        });
    }
};

// Process streaming voice command
exports.processStreamingCommand = async (req, res) => {
    try {
        const { text, sessionId } = req.body;

        // In production, maintain conversation context per session
        // For now, just process as single command

        const result = await exports.processCommand({ body: { text }, user: req.user }, { json: () => {} });
        
        res.json({
            success: true,
            data: result.data
        });
    } catch (error) {
        console.error('Process streaming command error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to process streaming command'
        });
    }
};

// Get command history
exports.getCommandHistory = async (req, res) => {
    try {
        const { limit = 50, offset = 0 } = req.query;

        const history = await ActivityLog.find({
            userId: req.user._id,
            action: 'voice_command'
        })
            .sort({ createdAt: -1 })
            .skip(parseInt(offset))
            .limit(parseInt(limit));

        const total = await ActivityLog.countDocuments({
            userId: req.user._id,
            action: 'voice_command'
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
        console.error('Get command history error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Clear command history
exports.clearCommandHistory = async (req, res) => {
    try {
        await ActivityLog.deleteMany({
            userId: req.user._id,
            action: 'voice_command'
        });

        res.json({
            success: true,
            message: 'Command history cleared'
        });
    } catch (error) {
        console.error('Clear command history error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Get command suggestions
exports.getCommandSuggestions = async (req, res) => {
    try {
        const suggestions = [
            { command: 'turn on the light', description: 'Turn on light device' },
            { command: 'turn off the fan', description: 'Turn off fan device' },
            { command: 'set temperature to 24 degrees', description: 'Set AC temperature' },
            { command: 'turn on all devices', description: 'Master ON' },
            { command: 'turn off all devices', description: 'Master OFF' },
            { command: 'enable auto mode for ac', description: 'Enable auto mode' },
            { command: 'what is the temperature', description: 'Get current temperature' },
            { command: 'turn on cinema mode', description: 'Activate cinema scene' },
            { command: 'good night', description: 'Activate night mode' },
            { command: 'good morning', description: 'Activate morning mode' }
        ];

        res.json({
            success: true,
            data: suggestions
        });
    } catch (error) {
        console.error('Get command suggestions error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Train custom command
exports.trainCustomCommand = async (req, res) => {
    try {
        const { phrase, action, deviceId, command } = req.body;

        // In production, store custom command mapping in database
        // For now, just log and return success

        await ActivityLog.create({
            userId: req.user._id,
            action: 'voice_command_trained',
            details: { phrase, action, deviceId, command },
            ip: req.ip,
            userAgent: req.headers['user-agent']
        });

        res.json({
            success: true,
            message: 'Custom command trained successfully'
        });
    } catch (error) {
        console.error('Train custom command error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Get voice models
exports.getVoiceModels = async (req, res) => {
    try {
        // In production, retrieve from database
        const models = [
            {
                id: 'default',
                name: 'Default Model',
                language: 'en',
                isActive: true,
                createdAt: new Date()
            }
        ];

        res.json({
            success: true,
            data: models
        });
    } catch (error) {
        console.error('Get voice models error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Delete voice model
exports.deleteVoiceModel = async (req, res) => {
    try {
        const { modelId } = req.params;

        // In production, delete from database

        res.json({
            success: true,
            message: 'Voice model deleted'
        });
    } catch (error) {
        console.error('Delete voice model error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Helper function to build AI prompt
function buildCommandPrompt(text, devices, language) {
    const deviceList = devices.map(d => 
        `- ${d.name} (type: ${d.type}, state: ${d.state ? 'ON' : 'OFF'}, autoMode: ${d.autoMode})`
    ).join('\n');

    return `You are a home automation assistant. Parse the following voice command and return a JSON object.

Current devices:
${deviceList}

Available actions:
- {"action":"toggle","deviceId":"device_id","state":true/false}
- {"action":"master","state":true/false}
- {"action":"auto_mode","deviceId":"device_id","enabled":true/false}
- {"action":"query","message":"response message"}

User command: "${text}"

Return ONLY valid JSON. Do not include any other text.`;
}

// Execute voice action
async function executeVoiceAction(action, userId) {
    switch (action.action) {
        case 'toggle':
            const device = await Device.findOne({ _id: action.deviceId, ownerId: userId });
            if (!device) {
                return { success: false, message: 'Device not found' };
            }
            if (device.autoMode) {
                return { success: false, message: 'Device is in AUTO mode' };
            }
            device.state = action.state;
            await device.save();
            return { success: true, message: `${device.name} turned ${action.state ? 'ON' : 'OFF'}`, device };

        case 'master':
            await Device.updateMany(
                { ownerId: userId, autoMode: false },
                { state: action.state }
            );
            return { success: true, message: `All devices turned ${action.state ? 'ON' : 'OFF'}` };

        case 'auto_mode':
            const autoDevice = await Device.findOne({ _id: action.deviceId, ownerId: userId });
            if (!autoDevice) {
                return { success: false, message: 'Device not found' };
            }
            autoDevice.autoMode = action.enabled;
            await autoDevice.save();
            return { success: true, message: `${autoDevice.name} auto mode ${action.enabled ? 'enabled' : 'disabled'}` };

        case 'query':
            return { success: true, message: action.message };

        default:
            return { success: false, message: 'Unknown action' };
    }
}