/**
 * ESTIF HOME ULTIMATE - BACKEND SERVER
 * Enterprise-grade Node.js server with Express, WebSocket, MQTT, and AI integration
 * Version: 2.0.0
 * Author: Estifanos Yohannis
 */

// ============================================
// DEPENDENCIES
// ============================================

const express = require('express');
const http = require('http');
const https = require('https');
const socketIo = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const hpp = require('hpp');
const cookieParser = require('cookie-parser');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const mqtt = require('mqtt');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Database
const mongoose = require('mongoose');
const Redis = require('ioredis');

// Load environment variables
dotenv.config();

// ============================================
// INITIALIZATION
// ============================================

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: process.env.CORS_ORIGIN || '*',
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
        credentials: true
    },
    pingTimeout: 60000,
    pingInterval: 25000
});

// Redis client
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

// Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const geminiModel = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

// MQTT Client
let mqttClient = null;

// ============================================
// MIDDLEWARE
// ============================================

// Security middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://cdn.jsdelivr.net"],
            connectSrc: ["'self'", "ws:", "wss:"],
            imgSrc: ["'self'", "data:", "https:"],
        }
    }
}));

app.use(cors({
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true
}));

app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());
app.use(mongoSanitize());
app.use(xss());
app.use(hpp());

// Logging
app.use(morgan('combined'));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false
});
app.use('/api/', limiter);

// Static files
app.use(express.static(path.join(__dirname, '../public')));

// ============================================
// DATABASE CONNECTION
// ============================================

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/estif_home', {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log('✅ MongoDB connected successfully');
    } catch (error) {
        console.error('❌ MongoDB connection error:', error);
        process.exit(1);
    }
};

connectDB();

// ============================================
// REDIS CONNECTION
// ============================================

redis.on('connect', () => {
    console.log('✅ Redis connected successfully');
});

redis.on('error', (error) => {
    console.error('❌ Redis connection error:', error);
});

// ============================================
// MQTT CONNECTION
// ============================================

const connectMQTT = () => {
    if (process.env.MQTT_BROKER) {
        mqttClient = mqtt.connect(process.env.MQTT_BROKER, {
            username: process.env.MQTT_USERNAME,
            password: process.env.MQTT_PASSWORD
        });
        
        mqttClient.on('connect', () => {
            console.log('✅ MQTT connected successfully');
            mqttClient.subscribe('estif/+/+');
        });
        
        mqttClient.on('message', (topic, message) => {
            handleMQTTMessage(topic, message.toString());
        });
        
        mqttClient.on('error', (error) => {
            console.error('❌ MQTT error:', error);
        });
    }
};

connectMQTT();

// ============================================
// MODELS
// ============================================

// User Model
const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    nameAm: { type: String },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['super_admin', 'admin', 'user'], default: 'user' },
    avatar: { type: String },
    phone: { type: String },
    homes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Home' }],
    settings: {
        language: { type: String, default: 'en' },
        theme: { type: String, default: 'light' },
        notifications: { type: Boolean, default: true },
        twoFactorEnabled: { type: Boolean, default: false }
    },
    isActive: { type: Boolean, default: true },
    lastLogin: { type: Date },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

userSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next();
    this.password = await bcrypt.hash(this.password, 12);
    this.updatedAt = Date.now();
    next();
});

userSchema.methods.comparePassword = async function(candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

const User = mongoose.model('User', userSchema);

// Home Model
const homeSchema = new mongoose.Schema({
    name: { type: String, required: true },
    nameAm: { type: String },
    address: { type: String },
    city: { type: String },
    country: { type: String, default: 'Ethiopia' },
    zipCode: { type: String },
    location: {
        lat: Number,
        lng: Number
    },
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    members: [{
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        role: { type: String, enum: ['owner', 'admin', 'member', 'guest'], default: 'member' },
        joinedAt: { type: Date, default: Date.now }
    }],
    rooms: [{
        name: String,
        nameAm: String,
        icon: String,
        type: String,
        devices: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Device' }]
    }],
    settings: {
        timezone: { type: String, default: 'Africa/Addis_Ababa' },
        temperatureUnit: { type: String, enum: ['celsius', 'fahrenheit'], default: 'celsius' },
        language: { type: String, default: 'en' }
    },
    isActive: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

const Home = mongoose.model('Home', homeSchema);

// Device Model
const deviceSchema = new mongoose.Schema({
    name: { type: String, required: true },
    nameAm: { type: String },
    type: { type: String, required: true },
    room: { type: String },
    roomAm: { type: String },
    gpio: { type: Number },
    power: { type: Number, default: 0 },
    state: { type: Boolean, default: false },
    autoMode: { type: Boolean, default: false },
    homeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Home' },
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    metadata: { type: mongoose.Schema.Types.Mixed },
    lastSeen: { type: Date, default: Date.now },
    lastStateChange: { type: Date, default: Date.now },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

const Device = mongoose.model('Device', deviceSchema);

// Activity Log Model
const activityLogSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    homeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Home' },
    action: { type: String, required: true },
    entityType: { type: String },
    entityId: { type: String },
    details: { type: mongoose.Schema.Types.Mixed },
    ip: { type: String },
    userAgent: { type: String },
    timestamp: { type: Date, default: Date.now }
});

const ActivityLog = mongoose.model('ActivityLog', activityLogSchema);

// ============================================
// AUTHENTICATION MIDDLEWARE
// ============================================

const authMiddleware = async (req, res, next) => {
    try {
        let token;
        
        if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
            token = req.headers.authorization.split(' ')[1];
        } else if (req.cookies.token) {
            token = req.cookies.token;
        }
        
        if (!token) {
            return res.status(401).json({ success: false, message: 'Not authorized' });
        }
        
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id).select('-password');
        
        if (!user) {
            return res.status(401).json({ success: false, message: 'User not found' });
        }
        
        req.user = user;
        next();
    } catch (error) {
        return res.status(401).json({ success: false, message: 'Invalid token' });
    }
};

// ============================================
// API ROUTES
// ============================================

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        status: 'healthy',
        timestamp: new Date(),
        uptime: process.uptime(),
        version: '2.0.0'
    });
});

// ============================================
// AUTH ROUTES
// ============================================

// Register
app.post('/api/auth/register', async (req, res) => {
    try {
        const { name, email, password } = req.body;
        
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ success: false, message: 'Email already registered' });
        }
        
        const user = await User.create({ name, email, password });
        
        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
        
        res.status(201).json({
            success: true,
            data: {
                user: {
                    id: user._id,
                    name: user.name,
                    email: user.email,
                    role: user.role
                },
                token
            }
        });
    } catch (error) {
        console.error('Register error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Login
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }
        
        const isPasswordValid = await user.comparePassword(password);
        if (!isPasswordValid) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }
        
        user.lastLogin = Date.now();
        await user.save();
        
        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
        const refreshToken = jwt.sign({ id: user._id }, process.env.JWT_REFRESH_SECRET, { expiresIn: '30d' });
        
        // Log activity
        await ActivityLog.create({
            userId: user._id,
            action: 'user_login',
            ip: req.ip,
            userAgent: req.headers['user-agent']
        });
        
        res.json({
            success: true,
            data: {
                user: {
                    id: user._id,
                    name: user.name,
                    email: user.email,
                    role: user.role,
                    avatar: user.avatar,
                    settings: user.settings
                },
                token,
                refreshToken
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Refresh token
app.post('/api/auth/refresh', async (req, res) => {
    try {
        const { refreshToken } = req.body;
        
        if (!refreshToken) {
            return res.status(401).json({ success: false, message: 'Refresh token required' });
        }
        
        const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
        const user = await User.findById(decoded.id);
        
        if (!user) {
            return res.status(401).json({ success: false, message: 'User not found' });
        }
        
        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
        
        res.json({ success: true, data: { token } });
    } catch (error) {
        res.status(401).json({ success: false, message: 'Invalid refresh token' });
    }
});

// Logout
app.post('/api/auth/logout', authMiddleware, async (req, res) => {
    await ActivityLog.create({
        userId: req.user._id,
        action: 'user_logout',
        ip: req.ip,
        userAgent: req.headers['user-agent']
    });
    
    res.json({ success: true, message: 'Logged out successfully' });
});

// ============================================
// DEVICE ROUTES
// ============================================

// Get all devices
app.get('/api/devices', authMiddleware, async (req, res) => {
    try {
        const devices = await Device.find({ ownerId: req.user._id });
        res.json({ success: true, data: devices });
    } catch (error) {
        console.error('Get devices error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Get device by ID
app.get('/api/devices/:id', authMiddleware, async (req, res) => {
    try {
        const device = await Device.findOne({ _id: req.params.id, ownerId: req.user._id });
        if (!device) {
            return res.status(404).json({ success: false, message: 'Device not found' });
        }
        res.json({ success: true, data: device });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Create device
app.post('/api/devices', authMiddleware, async (req, res) => {
    try {
        const device = await Device.create({
            ...req.body,
            ownerId: req.user._id
        });
        
        await ActivityLog.create({
            userId: req.user._id,
            action: 'device_created',
            entityType: 'device',
            entityId: device._id,
            details: { name: device.name }
        });
        
        io.emit('device_added', device);
        
        res.status(201).json({ success: true, data: device });
    } catch (error) {
        console.error('Create device error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Update device
app.put('/api/devices/:id', authMiddleware, async (req, res) => {
    try {
        const device = await Device.findOneAndUpdate(
            { _id: req.params.id, ownerId: req.user._id },
            { ...req.body, updatedAt: Date.now() },
            { new: true, runValidators: true }
        );
        
        if (!device) {
            return res.status(404).json({ success: false, message: 'Device not found' });
        }
        
        await ActivityLog.create({
            userId: req.user._id,
            action: 'device_updated',
            entityType: 'device',
            entityId: device._id,
            details: { name: device.name }
        });
        
        io.emit('device_updated', device);
        
        res.json({ success: true, data: device });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Toggle device
app.post('/api/devices/:id/toggle', authMiddleware, async (req, res) => {
    try {
        const device = await Device.findOne({ _id: req.params.id, ownerId: req.user._id });
        
        if (!device) {
            return res.status(404).json({ success: false, message: 'Device not found' });
        }
        
        if (device.autoMode) {
            return res.status(400).json({ success: false, message: 'Device is in AUTO mode' });
        }
        
        device.state = !device.state;
        device.lastStateChange = Date.now();
        await device.save();
        
        await ActivityLog.create({
            userId: req.user._id,
            action: device.state ? 'device_on' : 'device_off',
            entityType: 'device',
            entityId: device._id,
            details: { name: device.name }
        });
        
        io.emit('device_toggled', { deviceId: device._id, state: device.state });
        
        // Send MQTT message if available
        if (mqttClient) {
            mqttClient.publish(`estif/device/${device._id}/state`, JSON.stringify({ state: device.state }));
        }
        
        res.json({ success: true, data: device });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Set auto mode
app.post('/api/devices/:id/auto', authMiddleware, async (req, res) => {
    try {
        const device = await Device.findOne({ _id: req.params.id, ownerId: req.user._id });
        
        if (!device) {
            return res.status(404).json({ success: false, message: 'Device not found' });
        }
        
        device.autoMode = req.body.enabled;
        await device.save();
        
        await ActivityLog.create({
            userId: req.user._id,
            action: device.autoMode ? 'auto_mode_enabled' : 'auto_mode_disabled',
            entityType: 'device',
            entityId: device._id,
            details: { name: device.name }
        });
        
        io.emit('auto_mode_changed', { deviceId: device._id, enabled: device.autoMode });
        
        res.json({ success: true, data: device });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Master control
app.post('/api/devices/master/:command', authMiddleware, async (req, res) => {
    try {
        const state = req.params.command === 'on';
        
        await Device.updateMany(
            { ownerId: req.user._id, autoMode: false },
            { state, lastStateChange: Date.now() }
        );
        
        await ActivityLog.create({
            userId: req.user._id,
            action: state ? 'master_on' : 'master_off',
            details: { devices: 'all' }
        });
        
        io.emit('master_control', { state });
        
        res.json({ success: true, message: `All devices turned ${state ? 'ON' : 'OFF'}` });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ============================================
// HOME ROUTES
// ============================================

// Get all homes
app.get('/api/homes', authMiddleware, async (req, res) => {
    try {
        const homes = await Home.find({
            $or: [
                { ownerId: req.user._id },
                { 'members.userId': req.user._id }
            ]
        });
        
        res.json({ success: true, data: homes });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Create home
app.post('/api/homes', authMiddleware, async (req, res) => {
    try {
        const home = await Home.create({
            ...req.body,
            ownerId: req.user._id,
            members: [{ userId: req.user._id, role: 'owner' }]
        });
        
        await ActivityLog.create({
            userId: req.user._id,
            action: 'home_created',
            entityType: 'home',
            entityId: home._id,
            details: { name: home.name }
        });
        
        res.status(201).json({ success: true, data: home });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Update home
app.put('/api/homes/:id', authMiddleware, async (req, res) => {
    try {
        const home = await Home.findOneAndUpdate(
            { _id: req.params.id, ownerId: req.user._id },
            { ...req.body, updatedAt: Date.now() },
            { new: true }
        );
        
        if (!home) {
            return res.status(404).json({ success: false, message: 'Home not found' });
        }
        
        res.json({ success: true, data: home });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Delete home
app.delete('/api/homes/:id', authMiddleware, async (req, res) => {
    try {
        const home = await Home.findOneAndDelete({ _id: req.params.id, ownerId: req.user._id });
        
        if (!home) {
            return res.status(404).json({ success: false, message: 'Home not found' });
        }
        
        await Device.deleteMany({ homeId: home._id });
        
        await ActivityLog.create({
            userId: req.user._id,
            action: 'home_deleted',
            entityType: 'home',
            entityId: home._id,
            details: { name: home.name }
        });
        
        res.json({ success: true, message: 'Home deleted successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ============================================
// VOICE COMMAND WITH GEMINI AI
// ============================================

app.post('/api/voice/command', authMiddleware, async (req, res) => {
    try {
        const { text, language = 'en' } = req.body;
        
        if (!text) {
            return res.status(400).json({ success: false, message: 'No voice text provided' });
        }
        
        // Get user's devices for context
        const devices = await Device.find({ ownerId: req.user._id });
        
        const prompt = `You are a home automation assistant. Parse the following voice command and return a JSON object.

Current devices:
${devices.map(d => `- ${d.name} (id: ${d._id}, state: ${d.state ? 'ON' : 'OFF'}, autoMode: ${d.autoMode})`).join('\n')}

Commands to recognize:
- "turn on [device]" -> {"action":"toggle","deviceId":"id","state":true}
- "turn off [device]" -> {"action":"toggle","deviceId":"id","state":false}
- "turn on all" -> {"action":"master","state":true}
- "turn off all" -> {"action":"master","state":false}
- "enable auto mode for [device]" -> {"action":"auto_mode","deviceId":"id","enabled":true}
- "disable auto mode for [device]" -> {"action":"auto_mode","deviceId":"id","enabled":false}
- "what's the temperature" -> {"action":"query","message":"Current temperature is X°C"}

User command: "${text}"

Return ONLY valid JSON, no other text.`;

        const result = await geminiModel.generateContent(prompt);
        const response = await result.response;
        let action = JSON.parse(response.text());
        
        // Execute the action
        let commandResult = null;
        
        switch (action.action) {
            case 'toggle':
                const device = await Device.findOne({ _id: action.deviceId, ownerId: req.user._id });
                if (device) {
                    if (device.autoMode) {
                        commandResult = { success: false, message: 'Device is in AUTO mode' };
                    } else {
                        device.state = action.state;
                        await device.save();
                        io.emit('device_toggled', { deviceId: device._id, state: device.state });
                        commandResult = { success: true, device };
                    }
                }
                break;
                
            case 'auto_mode':
                const autoDevice = await Device.findOne({ _id: action.deviceId, ownerId: req.user._id });
                if (autoDevice) {
                    autoDevice.autoMode = action.enabled;
                    await autoDevice.save();
                    io.emit('auto_mode_changed', { deviceId: autoDevice._id, enabled: autoDevice.autoMode });
                    commandResult = { success: true, device: autoDevice };
                }
                break;
                
            case 'master':
                await Device.updateMany(
                    { ownerId: req.user._id, autoMode: false },
                    { state: action.state }
                );
                io.emit('master_control', { state: action.state });
                commandResult = { success: true, message: `All devices turned ${action.state ? 'ON' : 'OFF'}` };
                break;
                
            case 'query':
                commandResult = { success: true, message: action.message };
                break;
                
            default:
                commandResult = { success: false, message: 'Command not recognized' };
        }
        
        await ActivityLog.create({
            userId: req.user._id,
            action: 'voice_command',
            details: { command: text, result: action.action }
        });
        
        res.json({ success: true, data: { action, result: commandResult } });
    } catch (error) {
        console.error('Voice command error:', error);
        res.status(500).json({ success: false, message: 'Failed to process voice command' });
    }
});

// ============================================
// ESP32 ROUTES
// ============================================

app.post('/api/esp32/register', async (req, res) => {
    try {
        const { ip, name, mac, version } = req.body;
        
        await redis.set(`esp32:${mac}`, JSON.stringify({
            ip,
            name,
            mac,
            version,
            lastSeen: Date.now()
        }), 'EX', 300);
        
        res.json({ success: true, message: 'ESP32 registered' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

app.post('/api/esp32/heartbeat', async (req, res) => {
    try {
        const { mac, devices, sensors } = req.body;
        
        await redis.set(`esp32:${mac}`, JSON.stringify({
            ...JSON.parse(await redis.get(`esp32:${mac}`) || '{}'),
            lastSeen: Date.now(),
            devices,
            sensors
        }), 'EX', 300);
        
        if (sensors) {
            io.emit('sensor_update', sensors);
        }
        
        if (devices) {
            for (const device of devices) {
                io.emit('device_toggled', device);
            }
        }
        
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ============================================
// WEBSOCKET HANDLERS
// ============================================

io.use(async (socket, next) => {
    try {
        const token = socket.handshake.auth.token;
        if (!token) {
            return next(new Error('Authentication required'));
        }
        
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id).select('-password');
        
        if (!user) {
            return next(new Error('User not found'));
        }
        
        socket.user = user;
        next();
    } catch (error) {
        next(new Error('Invalid token'));
    }
});

io.on('connection', (socket) => {
    console.log(`Client connected: ${socket.id} (User: ${socket.user?.email})`);
    
    // Join user's room
    socket.join(`user:${socket.user._id}`);
    
    // Send initial data
    socket.emit('connected', { timestamp: Date.now() });
    
    // Device control
    socket.on('device_control', async (data) => {
        const { deviceId, state } = data;
        const device = await Device.findOne({ _id: deviceId, ownerId: socket.user._id });
        
        if (device && !device.autoMode) {
            device.state = state;
            await device.save();
            io.to(`user:${socket.user._id}`).emit('device_updated', device);
        }
    });
    
    // Auto mode toggle
    socket.on('auto_mode', async (data) => {
        const { deviceId, enabled } = data;
        const device = await Device.findOne({ _id: deviceId, ownerId: socket.user._id });
        
        if (device) {
            device.autoMode = enabled;
            await device.save();
            io.to(`user:${socket.user._id}`).emit('auto_mode_updated', device);
        }
    });
    
    // Master control
    socket.on('master_control', async (data) => {
        const { state } = data;
        await Device.updateMany(
            { ownerId: socket.user._id, autoMode: false },
            { state }
        );
        io.to(`user:${socket.user._id}`).emit('master_updated', { state });
    });
    
    // Disconnect
    socket.on('disconnect', () => {
        console.log(`Client disconnected: ${socket.id}`);
    });
});

// ============================================
// ERROR HANDLER
// ============================================

app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
});

// Handle 404
app.use('*', (req, res) => {
    res.status(404).json({ success: false, message: 'Route not found' });
});

// ============================================
// START SERVER
// ============================================

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════════════════════════════════╗
║                                                                   ║
║   🏠 ESTIF HOME ULTIMATE - BACKEND SERVER                         ║
║                                                                   ║
║   📡 Server: http://localhost:${PORT}                               ║
║   🔌 WebSocket: Active                                            ║
║   🤖 Gemini AI: Ready                                              ║
║   💾 MongoDB: Connected                                            ║
║   📡 Redis: Connected                                              ║
║   📡 MQTT: ${mqttClient ? 'Connected' : 'Disabled'}                               ║
║                                                                   ║
║   🚀 Ready to accept connections                                  ║
║                                                                   ║
╚═══════════════════════════════════════════════════════════════════╝
    `);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, closing server...');
    server.close(() => {
        mongoose.connection.close();
        redis.quit();
        if (mqttClient) mqttClient.end();
        console.log('Server closed');
        process.exit(0);
    });
});

module.exports = { app, server, io };