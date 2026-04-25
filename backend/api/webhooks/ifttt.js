/**
 * ESTIF HOME ULTIMATE - IFTTT WEBHOOK HANDLER
 * Handle IFTTT webhook triggers and actions for third-party automation
 * Version: 2.0.0
 * Author: Estifanos Yohannis
 */

const crypto = require('crypto');
const moment = require('moment');

// Models
const User = require('../../models/User');
const Device = require('../../models/Device');
const Home = require('../../models/Home');
const AutomationLog = require('../../models/AutomationLog');
const WebhookToken = require('../../models/WebhookToken');

// IFTTT Service Key
const IFTTT_SERVICE_KEY = process.env.IFTTT_SERVICE_KEY;

/**
 * Validate IFTTT webhook request
 */
const validateRequest = (req) => {
    const token = req.headers['x-ifttt-service-key'] || req.query.token;
    
    if (!token || token !== IFTTT_SERVICE_KEY) {
        throw new Error('Invalid or missing service key');
    }
    
    return true;
};

/**
 * Get user by webhook token
 */
const getUserByToken = async (userToken) => {
    const webhookToken = await WebhookToken.findOne({ token: userToken, isActive: true });
    if (!webhookToken || webhookToken.expiresAt < Date.now()) {
        throw new Error('Invalid or expired user token');
    }
    
    const user = await User.findById(webhookToken.userId);
    if (!user) {
        throw new Error('User not found');
    }
    
    return user;
};

/**
 * Handle IFTTT webhook trigger
 */
const handleTrigger = async (req, res) => {
    try {
        validateRequest(req);
        
        const { triggerIdentity, userToken } = req.body;
        
        const user = await getUserByToken(userToken);
        
        let data = [];
        
        switch (triggerIdentity) {
            case 'device_status':
                data = await getDeviceStatusTrigger(user);
                break;
                
            case 'device_state_changed':
                data = await getDeviceStateChangedTrigger(user);
                break;
                
            case 'temperature_reading':
                data = await getTemperatureReadingTrigger(user);
                break;
                
            case 'energy_usage':
                data = await getEnergyUsageTrigger(user);
                break;
                
            case 'motion_detected':
                data = await getMotionDetectedTrigger(user);
                break;
                
            default:
                data = [];
        }
        
        res.json({
            data: data
        });
        
    } catch (error) {
        console.error('IFTTT trigger error:', error);
        res.status(401).json({
            errors: [{ message: error.message }]
        });
    }
};

/**
 * Get device status trigger data
 */
const getDeviceStatusTrigger = async (user) => {
    const devices = await Device.find({ ownerId: user._id });
    
    return devices.map(device => ({
        id: device._id.toString(),
        name: device.name,
        state: device.state ? 'on' : 'off',
        room: device.room,
        type: device.type,
        lastUpdated: moment(device.updatedAt).toISOString()
    }));
};

/**
 * Get device state changed trigger data
 */
const getDeviceStateChangedTrigger = async (user) => {
    // Get recent state changes from activity log
    const changes = await AutomationLog.find({
        userId: user._id,
        action: { $in: ['device_on', 'device_off'] }
    }).sort({ createdAt: -1 }).limit(10);
    
    return changes.map(change => ({
        device_name: change.details?.deviceName,
        device_type: change.details?.deviceType,
        new_state: change.action === 'device_on' ? 'on' : 'off',
        timestamp: moment(change.createdAt).toISOString()
    }));
};

/**
 * Get temperature reading trigger data
 */
const getTemperatureReadingTrigger = async (user) => {
    const homes = await Home.find({ ownerId: user._id });
    const readings = [];
    
    for (const home of homes) {
        // Get temperature sensors for the home
        const sensors = await Device.find({ homeId: home._id, type: 'sensor' });
        
        for (const sensor of sensors) {
            readings.push({
                home_name: home.name,
                sensor_name: sensor.name,
                temperature: sensor.metadata?.temperature || 0,
                unit: 'celsius',
                timestamp: moment().toISOString()
            });
        }
    }
    
    return readings;
};

/**
 * Get energy usage trigger data
 */
const getEnergyUsageTrigger = async (user) => {
    const homes = await Home.find({ ownerId: user._id });
    const usages = [];
    
    for (const home of homes) {
        const devices = await Device.find({ homeId: home._id });
        const totalPower = devices.reduce((sum, d) => sum + (d.state ? d.power : 0), 0);
        
        usages.push({
            home_name: home.name,
            total_power: totalPower,
            device_count: devices.length,
            active_devices: devices.filter(d => d.state).length,
            estimated_cost: (totalPower / 1000) * 0.12,
            timestamp: moment().toISOString()
        });
    }
    
    return usages;
};

/**
 * Get motion detected trigger data
 */
const getMotionDetectedTrigger = async (user) => {
    const motionEvents = await AutomationLog.find({
        userId: user._id,
        action: 'motion_detected'
    }).sort({ createdAt: -1 }).limit(10);
    
    return motionEvents.map(event => ({
        device_name: event.details?.deviceName,
        location: event.details?.location,
        timestamp: moment(event.createdAt).toISOString()
    }));
};

/**
 * Handle IFTTT action
 */
const handleAction = async (req, res) => {
    try {
        validateRequest(req);
        
        const { actionIdentity, userToken, dataFields } = req.body;
        
        const user = await getUserByToken(userToken);
        
        let result;
        
        switch (actionIdentity) {
            case 'toggle_device':
                result = await toggleDeviceAction(user, dataFields);
                break;
                
            case 'turn_on_device':
                result = await turnOnDeviceAction(user, dataFields);
                break;
                
            case 'turn_off_device':
                result = await turnOffDeviceAction(user, dataFields);
                break;
                
            case 'set_temperature':
                result = await setTemperatureAction(user, dataFields);
                break;
                
            case 'activate_scene':
                result = await activateSceneAction(user, dataFields);
                break;
                
            case 'send_notification':
                result = await sendNotificationAction(user, dataFields);
                break;
                
            default:
                throw new Error(`Unknown action: ${actionIdentity}`);
        }
        
        res.json({
            data: [{
                id: result.id || Date.now().toString(),
                ...result
            }]
        });
        
    } catch (error) {
        console.error('IFTTT action error:', error);
        res.status(500).json({
            errors: [{ message: error.message }]
        });
    }
};

/**
 * Toggle device action
 */
const toggleDeviceAction = async (user, dataFields) => {
    const { device_name } = dataFields;
    
    const device = await Device.findOne({
        ownerId: user._id,
        name: { $regex: new RegExp(device_name, 'i') }
    });
    
    if (!device) {
        throw new Error(`Device "${device_name}" not found`);
    }
    
    if (device.autoMode) {
        throw new Error(`Device "${device_name}" is in AUTO mode`);
    }
    
    device.state = !device.state;
    await device.save();
    
    return {
        success: true,
        device: device.name,
        new_state: device.state ? 'on' : 'off',
        timestamp: moment().toISOString()
    };
};

/**
 * Turn on device action
 */
const turnOnDeviceAction = async (user, dataFields) => {
    const { device_name } = dataFields;
    
    const device = await Device.findOne({
        ownerId: user._id,
        name: { $regex: new RegExp(device_name, 'i') }
    });
    
    if (!device) {
        throw new Error(`Device "${device_name}" not found`);
    }
    
    if (device.autoMode) {
        throw new Error(`Device "${device_name}" is in AUTO mode`);
    }
    
    device.state = true;
    await device.save();
    
    return {
        success: true,
        device: device.name,
        new_state: 'on',
        timestamp: moment().toISOString()
    };
};

/**
 * Turn off device action
 */
const turnOffDeviceAction = async (user, dataFields) => {
    const { device_name } = dataFields;
    
    const device = await Device.findOne({
        ownerId: user._id,
        name: { $regex: new RegExp(device_name, 'i') }
    });
    
    if (!device) {
        throw new Error(`Device "${device_name}" not found`);
    }
    
    if (device.autoMode) {
        throw new Error(`Device "${device_name}" is in AUTO mode`);
    }
    
    device.state = false;
    await device.save();
    
    return {
        success: true,
        device: device.name,
        new_state: 'off',
        timestamp: moment().toISOString()
    };
};

/**
 * Set temperature action
 */
const setTemperatureAction = async (user, dataFields) => {
    const { device_name, temperature } = dataFields;
    
    const device = await Device.findOne({
        ownerId: user._id,
        type: 'ac',
        name: { $regex: new RegExp(device_name, 'i') }
    });
    
    if (!device) {
        throw new Error(`Temperature device "${device_name}" not found`);
    }
    
    device.metadata = device.metadata || {};
    device.metadata.targetTemperature = parseFloat(temperature);
    await device.save();
    
    return {
        success: true,
        device: device.name,
        temperature,
        timestamp: moment().toISOString()
    };
};

/**
 * Activate scene action
 */
const activateSceneAction = async (user, dataFields) => {
    const { scene_name } = dataFields;
    
    // Find scene for the user
    const scene = await Scene.findOne({
        userId: user._id,
        name: { $regex: new RegExp(scene_name, 'i') }
    });
    
    if (!scene) {
        throw new Error(`Scene "${scene_name}" not found`);
    }
    
    // Activate scene
    // await sceneController.activateScene(scene._id);
    
    return {
        success: true,
        scene: scene.name,
        activated: true,
        timestamp: moment().toISOString()
    };
};

/**
 * Send notification action
 */
const sendNotificationAction = async (user, dataFields) => {
    const { message } = dataFields;
    
    // Send push notification to user
    // await sendPushNotification(user._id, 'IFTTT Action', message);
    
    return {
        success: true,
        message_sent: true,
        timestamp: moment().toISOString()
    };
};

/**
 * Generate webhook token for user
 */
const generateUserToken = async (userId) => {
    const token = crypto.randomBytes(32).toString('hex');
    
    await WebhookToken.create({
        userId,
        token,
        platform: 'ifttt',
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 year
    });
    
    return token;
};

/**
 * Get IFTTT service information
 */
const getServiceInfo = (req, res) => {
    res.json({
        name: 'Estif Home Ultimate',
        description: 'Control your smart home devices with IFTTT',
        author: 'Estifanos Yohannis',
        homepage_url: 'https://estif-home.com',
        primary_authentication: [
            {
                type: 'header',
                header_name: 'X-IFTTT-Service-Key'
            }
        ],
        triggers: [
            {
                id: 'device_status',
                name: 'Device Status',
                description: 'Get the current status of your devices',
                fields: []
            },
            {
                id: 'device_state_changed',
                name: 'Device State Changed',
                description: 'Triggered when a device state changes',
                fields: []
            },
            {
                id: 'temperature_reading',
                name: 'Temperature Reading',
                description: 'Get current temperature readings',
                fields: []
            },
            {
                id: 'energy_usage',
                name: 'Energy Usage',
                description: 'Get current energy consumption',
                fields: []
            },
            {
                id: 'motion_detected',
                name: 'Motion Detected',
                description: 'Triggered when motion is detected',
                fields: []
            }
        ],
        actions: [
            {
                id: 'toggle_device',
                name: 'Toggle Device',
                description: 'Turn a device on or off',
                fields: [
                    {
                        name: 'device_name',
                        type: 'text',
                        required: true,
                        description: 'Name of the device to toggle'
                    }
                ]
            },
            {
                id: 'turn_on_device',
                name: 'Turn On Device',
                description: 'Turn a device on',
                fields: [
                    {
                        name: 'device_name',
                        type: 'text',
                        required: true,
                        description: 'Name of the device to turn on'
                    }
                ]
            },
            {
                id: 'turn_off_device',
                name: 'Turn Off Device',
                description: 'Turn a device off',
                fields: [
                    {
                        name: 'device_name',
                        type: 'text',
                        required: true,
                        description: 'Name of the device to turn off'
                    }
                ]
            },
            {
                id: 'set_temperature',
                name: 'Set Temperature',
                description: 'Set target temperature for AC',
                fields: [
                    {
                        name: 'device_name',
                        type: 'text',
                        required: true,
                        description: 'Name of the AC device'
                    },
                    {
                        name: 'temperature',
                        type: 'number',
                        required: true,
                        description: 'Target temperature in Celsius'
                    }
                ]
            },
            {
                id: 'activate_scene',
                name: 'Activate Scene',
                description: 'Activate a saved scene',
                fields: [
                    {
                        name: 'scene_name',
                        type: 'text',
                        required: true,
                        description: 'Name of the scene to activate'
                    }
                ]
            },
            {
                id: 'send_notification',
                name: 'Send Notification',
                description: 'Send a push notification',
                fields: [
                    {
                        name: 'message',
                        type: 'text',
                        required: true,
                        description: 'Message to send'
                    }
                ]
            }
        ]
    });
};

/**
 * Main webhook router
 */
const router = require('express').Router();

router.get('/info', getServiceInfo);
router.post('/trigger', handleTrigger);
router.post('/action', handleAction);
router.post('/generate-token', async (req, res) => {
    const { userId } = req.body;
    const token = await generateUserToken(userId);
    res.json({ token });
});

module.exports = router;