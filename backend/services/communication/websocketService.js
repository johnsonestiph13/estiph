/**
 * ESTIF HOME ULTIMATE - WEBSOCKET SERVICE
 * Real-time bidirectional communication for device updates and events
 * Version: 2.0.0
 */

const socketIo = require('socket.io');
const jwt = require('jsonwebtoken');
const User = require('../../models/User');
const Device = require('../../models/Device');
const { logger } = require('../../utils/logger');

class WebSocketService {
    constructor() {
        this.io = null;
        this.connectedClients = new Map();
        this.userSockets = new Map();
        this.roomSubscriptions = new Map();
    }

    initialize(server) {
        this.io = socketIo(server, {
            cors: {
                origin: process.env.CORS_ORIGIN || '*',
                methods: ['GET', 'POST'],
                credentials: true
            },
            pingTimeout: 60000,
            pingInterval: 25000,
            transports: ['websocket', 'polling']
        });

        this.setupMiddleware();
        this.setupEventHandlers();
        
        logger.info('WebSocket service initialized');
        return this.io;
    }

    setupMiddleware() {
        this.io.use(async (socket, next) => {
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

                if (!user.isActive) {
                    return next(new Error('Account disabled'));
                }

                socket.user = user;
                socket.userId = user._id;
                next();
            } catch (error) {
                logger.error(`WebSocket auth error: ${error.message}`);
                next(new Error('Invalid token'));
            }
        });
    }

    setupEventHandlers() {
        this.io.on('connection', (socket) => {
            logger.info(`Client connected: ${socket.id} (User: ${socket.user?.email})`);
            
            this.connectedClients.set(socket.id, {
                socket,
                userId: socket.userId,
                connectedAt: Date.now()
            });
            
            this.addUserToRoom(socket.userId, socket);

            socket.emit('connected', {
                message: 'Connected to Estif Home WebSocket',
                timestamp: Date.now(),
                userId: socket.userId
            });

            this.handleDeviceEvents(socket);
            this.handleRoomEvents(socket);
            this.handlePresenceEvents(socket);

            socket.on('disconnect', () => {
                this.handleDisconnect(socket);
            });
        });
    }

    handleDeviceEvents(socket) {
        socket.on('device_control', async (data) => {
            try {
                const { deviceId, state } = data;
                const device = await Device.findOne({ _id: deviceId, ownerId: socket.userId });
                
                if (device && !device.autoMode) {
                    device.state = state;
                    device.lastStateChange = Date.now();
                    await device.save();
                    
                    this.emitToUser(socket.userId, 'device_updated', {
                        deviceId: device._id,
                        state: device.state,
                        autoMode: device.autoMode,
                        timestamp: Date.now()
                    });
                    
                    socket.emit('device_control_success', { deviceId, state });
                } else {
                    socket.emit('device_control_error', { 
                        deviceId, 
                        error: device?.autoMode ? 'Device in AUTO mode' : 'Device not found'
                    });
                }
            } catch (error) {
                logger.error(`Device control error: ${error.message}`);
                socket.emit('device_control_error', { error: error.message });
            }
        });

        socket.on('auto_mode_toggle', async (data) => {
            try {
                const { deviceId, enabled } = data;
                const device = await Device.findOne({ _id: deviceId, ownerId: socket.userId });
                
                if (device) {
                    device.autoMode = enabled;
                    await device.save();
                    
                    this.emitToUser(socket.userId, 'auto_mode_updated', {
                        deviceId: device._id,
                        autoMode: device.autoMode,
                        timestamp: Date.now()
                    });
                    
                    socket.emit('auto_mode_success', { deviceId, enabled });
                }
            } catch (error) {
                socket.emit('auto_mode_error', { error: error.message });
            }
        });

        socket.on('master_control', async (data) => {
            try {
                const { state } = data;
                await Device.updateMany(
                    { ownerId: socket.userId, autoMode: false },
                    { state, lastStateChange: Date.now() }
                );
                
                this.emitToUser(socket.userId, 'master_control_updated', { state, timestamp: Date.now() });
                socket.emit('master_control_success', { state });
            } catch (error) {
                socket.emit('master_control_error', { error: error.message });
            }
        });

        socket.on('get_device_status', async (data) => {
            const { deviceId } = data;
            const device = await Device.findOne({ _id: deviceId, ownerId: socket.userId });
            socket.emit('device_status', { deviceId, status: device });
        });
    }

    handleRoomEvents(socket) {
        socket.on('join_room', (roomId) => {
            socket.join(roomId);
            if (!this.roomSubscriptions.has(roomId)) {
                this.roomSubscriptions.set(roomId, new Set());
            }
            this.roomSubscriptions.get(roomId).add(socket.id);
            socket.emit('room_joined', { roomId });
            logger.debug(`Socket ${socket.id} joined room ${roomId}`);
        });

        socket.on('leave_room', (roomId) => {
            socket.leave(roomId);
            if (this.roomSubscriptions.has(roomId)) {
                this.roomSubscriptions.get(roomId).delete(socket.id);
            }
            socket.emit('room_left', { roomId });
        });

        socket.on('room_message', (data) => {
            const { roomId, message } = data;
            this.io.to(roomId).emit('room_message', {
                userId: socket.userId,
                userName: socket.user.name,
                message,
                timestamp: Date.now()
            });
        });
    }

    handlePresenceEvents(socket) {
        socket.on('presence_update', (data) => {
            const { status, activity } = data;
            this.broadcastToUserContacts(socket.userId, 'user_presence', {
                userId: socket.userId,
                userName: socket.user.name,
                status,
                activity,
                timestamp: Date.now()
            });
        });

        socket.on('typing_start', (data) => {
            const { roomId } = data;
            socket.to(roomId).emit('user_typing', {
                userId: socket.userId,
                userName: socket.user.name,
                isTyping: true
            });
        });

        socket.on('typing_stop', (data) => {
            const { roomId } = data;
            socket.to(roomId).emit('user_typing', {
                userId: socket.userId,
                userName: socket.user.name,
                isTyping: false
            });
        });
    }

    handleDisconnect(socket) {
        logger.info(`Client disconnected: ${socket.id}`);
        this.connectedClients.delete(socket.id);
        
        for (const [roomId, sockets] of this.roomSubscriptions.entries()) {
            if (sockets.has(socket.id)) {
                sockets.delete(socket.id);
                if (sockets.size === 0) {
                    this.roomSubscriptions.delete(roomId);
                }
            }
        }
        
        this.broadcastToUserContacts(socket.userId, 'user_offline', {
            userId: socket.userId,
            userName: socket.user.name,
            timestamp: Date.now()
        });
    }

    addUserToRoom(userId, socket) {
        socket.join(`user:${userId}`);
        if (!this.userSockets.has(userId)) {
            this.userSockets.set(userId, new Set());
        }
        this.userSockets.get(userId).add(socket.id);
        
        this.broadcastToUserContacts(userId, 'user_online', {
            userId,
            userName: socket.user.name,
            timestamp: Date.now()
        });
    }

    emitToUser(userId, event, data) {
        this.io.to(`user:${userId}`).emit(event, data);
    }

    emitToRoom(roomId, event, data) {
        this.io.to(roomId).emit(event, data);
    }

    broadcast(event, data) {
        this.io.emit(event, data);
    }

    broadcastToUserContacts(userId, event, data) {
        // Implementation would fetch user's contacts and emit to them
        // For now, broadcast to all
        this.broadcast(event, data);
    }

    getConnectedClients() {
        return Array.from(this.connectedClients.values()).map(client => ({
            socketId: client.socket.id,
            userId: client.userId,
            connectedAt: client.connectedAt
        }));
    }

    getRoomSubscribers() {
        const rooms = {};
        for (const [roomId, sockets] of this.roomSubscriptions.entries()) {
            rooms[roomId] = sockets.size;
        }
        return rooms;
    }

    getStats() {
        return {
            connectedClients: this.connectedClients.size,
            userSockets: this.userSockets.size,
            activeRooms: this.roomSubscriptions.size,
            totalMessages: 0
        };
    }

    close() {
        if (this.io) {
            this.io.close();
            logger.info('WebSocket service closed');
        }
    }
}

module.exports = new WebSocketService();