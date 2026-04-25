const jwt = require('jsonwebtoken');
const User = require('../models/User');

const websocketAuth = async (socket, next) => {
    try {
        const token = socket.handshake.auth.token 
            || socket.handshake.headers.authorization?.split(' ')[1];
        
        if (!token) {
            return next(new Error('Authentication required'));
        }
        
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id).select('-password');
        
        if (!user) {
            return next(new Error('User not found'));
        }
        
        if (!user.isActive) {
            return next(new Error('Account is disabled'));
        }
        
        socket.user = user;
        socket.userId = user._id;
        
        socket.join(`user:${user._id}`);
        
        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return next(new Error('Token expired'));
        }
        return next(new Error('Invalid token'));
    }
};

const websocketRateLimit = (options = {}) => {
    const { maxConnections = 5, windowMs = 60000 } = options;
    const connections = new Map();
    
    return (socket, next) => {
        const userId = socket.user?._id;
        if (!userId) return next();
        
        const now = Date.now();
        const userConnections = connections.get(userId) || [];
        const recentConnections = userConnections.filter(time => now - time < windowMs);
        
        if (recentConnections.length >= maxConnections) {
            return next(new Error('Too many WebSocket connections'));
        }
        
        recentConnections.push(now);
        connections.set(userId, recentConnections);
        
        socket.on('disconnect', () => {
            const updated = connections.get(userId) || [];
            const index = updated.indexOf(now);
            if (index > -1) updated.splice(index, 1);
            connections.set(userId, updated);
        });
        
        next();
    };
};

const websocketRoomAuth = (requiredRole = null) => {
    return (socket, room, next) => {
        const userRole = socket.user?.role;
        
        if (requiredRole && userRole !== requiredRole && userRole !== 'super_admin') {
            return next(new Error('Insufficient permissions for this room'));
        }
        
        next();
    };
};

const websocketEventLogger = (socket, next) => {
    const originalEmit = socket.emit;
    socket.emit = function(event, ...args) {
        console.log(`[WebSocket] Emitting: ${event} to ${socket.userId}`);
        originalEmit.call(this, event, ...args);
    };
    
    next();
};

module.exports = {
    websocketAuth,
    websocketRateLimit,
    websocketRoomAuth,
    websocketEventLogger
};