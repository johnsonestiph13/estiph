const jwt = require('jsonwebtoken');
const User = require('../models/User');

const authMiddleware = async (req, res, next) => {
    try {
        let token;
        
        if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
            token = req.headers.authorization.split(' ')[1];
        } else if (req.cookies?.token) {
            token = req.cookies.token;
        }
        
        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
        }
        
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id).select('-password');
        
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'User not found'
            });
        }
        
        if (!user.isActive) {
            return res.status(401).json({
                success: false,
                message: 'Account is disabled'
            });
        }
        
        req.user = user;
        next();
    } catch (error) {
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({
                success: false,
                message: 'Invalid token'
            });
        }
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                message: 'Token expired'
            });
        }
        
        console.error('Auth middleware error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

const adminMiddleware = (req, res, next) => {
    if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
        return res.status(403).json({
            success: false,
            message: 'Admin access required'
        });
    }
    next();
};

const superAdminMiddleware = (req, res, next) => {
    if (req.user.role !== 'super_admin') {
        return res.status(403).json({
            success: false,
            message: 'Super admin access required'
        });
    }
    next();
};

const homeOwnerMiddleware = async (req, res, next) => {
    try {
        const Home = require('../models/Home');
        const home = await Home.findById(req.params.id);
        
        if (!home) {
            return res.status(404).json({
                success: false,
                message: 'Home not found'
            });
        }
        
        if (home.ownerId.toString() !== req.user._id.toString()) {
            return res.status(403).json({
                success: false,
                message: 'Home owner access required'
            });
        }
        
        next();
    } catch (error) {
        console.error('Home owner middleware error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

const homeAdminMiddleware = async (req, res, next) => {
    try {
        const Home = require('../models/Home');
        const home = await Home.findById(req.params.id);
        
        if (!home) {
            return res.status(404).json({
                success: false,
                message: 'Home not found'
            });
        }
        
        const isOwner = home.ownerId.toString() === req.user._id.toString();
        const member = home.members.find(m => m.userId.toString() === req.user._id.toString());
        const isAdmin = member && (member.role === 'admin' || member.role === 'owner');
        
        if (!isOwner && !isAdmin) {
            return res.status(403).json({
                success: false,
                message: 'Home admin access required'
            });
        }
        
        next();
    } catch (error) {
        console.error('Home admin middleware error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

const homeMemberMiddleware = async (req, res, next) => {
    try {
        const Home = require('../models/Home');
        const home = await Home.findById(req.params.id);
        
        if (!home) {
            return res.status(404).json({
                success: false,
                message: 'Home not found'
            });
        }
        
        const isOwner = home.ownerId.toString() === req.user._id.toString();
        const isMember = home.members.some(m => m.userId.toString() === req.user._id.toString());
        
        if (!isOwner && !isMember) {
            return res.status(403).json({
                success: false,
                message: 'Home member access required'
            });
        }
        
        next();
    } catch (error) {
        console.error('Home member middleware error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

const deviceOwnerMiddleware = async (req, res, next) => {
    try {
        const Device = require('../models/Device');
        const device = await Device.findById(req.params.id);
        
        if (!device) {
            return res.status(404).json({
                success: false,
                message: 'Device not found'
            });
        }
        
        if (device.ownerId.toString() !== req.user._id.toString()) {
            return res.status(403).json({
                success: false,
                message: 'Device owner access required'
            });
        }
        
        next();
    } catch (error) {
        console.error('Device owner middleware error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

const apiKeyMiddleware = async (req, res, next) => {
    try {
        const apiKey = req.headers['x-api-key'];
        
        if (!apiKey) {
            return res.status(401).json({
                success: false,
                message: 'API key required'
            });
        }
        
        const ApiKey = require('../models/ApiKey');
        const keyDoc = await ApiKey.findOne({ key: apiKey, isActive: true });
        
        if (!keyDoc) {
            return res.status(401).json({
                success: false,
                message: 'Invalid API key'
            });
        }
        
        if (keyDoc.expiresAt && keyDoc.expiresAt < Date.now()) {
            return res.status(401).json({
                success: false,
                message: 'API key expired'
            });
        }
        
        keyDoc.lastUsed = Date.now();
        await keyDoc.save();
        
        req.apiKey = keyDoc;
        req.user = await User.findById(keyDoc.userId);
        next();
    } catch (error) {
        console.error('API key middleware error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

module.exports = {
    authMiddleware,
    adminMiddleware,
    superAdminMiddleware,
    homeOwnerMiddleware,
    homeAdminMiddleware,
    homeMemberMiddleware,
    deviceOwnerMiddleware,
    apiKeyMiddleware
};