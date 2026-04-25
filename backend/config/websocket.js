const socketIo = require('socket.io');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

let io = null;

const initWebSocket = (server) => {
    io = socketIo(server, {
        cors: {
            origin: process.env.CORS_ORIGIN || '*',
            methods: ['GET', 'POST'],
            credentials: true
        },
        pingTimeout: 60000,
        pingInterval: 25000,
        transports: ['websocket', 'polling']
    });
    
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
        console.log(`WebSocket connected: ${socket.id} (User: ${socket.user?.email})`);
        
        socket.join(`user:${socket.user._id}`);
        
        socket.on('disconnect', () => {
            console.log(`WebSocket disconnected: ${socket.id}`);
        });
    });
    
    console.log('✅ WebSocket server initialized');
    return io;
};

const getIO = () => {
    if (!io) {
        throw new Error('WebSocket not initialized');
    }
    return io;
};

const emitToUser = (userId, event, data) => {
    if (!io) return;
    io.to(`user:${userId}`).emit(event, data);
};

const emitToRoom = (room, event, data) => {
    if (!io) return;
    io.to(room).emit(event, data);
};

const broadcast = (event, data) => {
    if (!io) return;
    io.emit(event, data);
};

module.exports = {
    initWebSocket,
    getIO,
    emitToUser,
    emitToRoom,
    broadcast
};