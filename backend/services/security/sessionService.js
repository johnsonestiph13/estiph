/**
 * ESTIF HOME ULTIMATE - SESSION SERVICE
 * User session management with device tracking and security
 * Version: 2.0.0
 */

const Session = require('../../models/Session');
const User = require('../../models/User');
const jwtService = require('./jwtService');
const { logger } = require('../../utils/logger');

class SessionService {
    constructor() {
        this.activeSessions = new Map();
        this.sessionTimeout = 7 * 24 * 60 * 60 * 1000; // 7 days
    }

    async createSession(userId, ipAddress, userAgent, deviceInfo = {}) {
        const refreshToken = jwtService.generateRefreshToken({ id: userId });
        
        const session = await Session.create({
            userId,
            token: refreshToken,
            ipAddress,
            userAgent,
            deviceName: deviceInfo.deviceName || this.getDeviceName(userAgent),
            deviceType: this.getDeviceType(userAgent),
            expiresAt: new Date(Date.now() + this.sessionTimeout),
            createdAt: Date.now(),
            lastUsed: Date.now()
        });
        
        this.activeSessions.set(session._id.toString(), session);
        
        logger.info(`Session created for user ${userId} from ${ipAddress}`);
        return session;
    }

    async validateSession(token) {
        const payload = jwtService.verifyRefreshToken(token);
        if (!payload) return null;
        
        const session = await Session.findOne({ token, userId: payload.id, isActive: true });
        if (!session || session.expiresAt < new Date()) {
            if (session) await this.invalidateSession(session._id);
            return null;
        }
        
        session.lastUsed = Date.now();
        await session.save();
        
        this.activeSessions.set(session._id.toString(), session);
        
        return { session, user: payload };
    }

    async invalidateSession(sessionId) {
        const session = await Session.findByIdAndUpdate(sessionId, { isActive: false });
        if (session) {
            this.activeSessions.delete(sessionId);
            logger.info(`Session ${sessionId} invalidated`);
        }
        return session;
    }

    async invalidateAllUserSessions(userId, exceptSessionId = null) {
        const filter = { userId, isActive: true };
        if (exceptSessionId) {
            filter._id = { $ne: exceptSessionId };
        }
        
        const sessions = await Session.find(filter);
        for (const session of sessions) {
            await this.invalidateSession(session._id);
        }
        
        logger.info(`All sessions invalidated for user ${userId}`);
        return sessions.length;
    }

    async getUserSessions(userId) {
        const sessions = await Session.find({ userId, isActive: true })
            .sort({ lastUsed: -1 });
        
        return sessions.map(session => ({
            id: session._id,
            deviceName: session.deviceName,
            deviceType: session.deviceType,
            ipAddress: session.ipAddress,
            lastUsed: session.lastUsed,
            createdAt: session.createdAt,
            isCurrent: session.token === this.getCurrentToken()
        }));
    }

    getDeviceType(userAgent) {
        const ua = userAgent.toLowerCase();
        if (ua.includes('mobile')) return 'mobile';
        if (ua.includes('tablet')) return 'tablet';
        if (ua.includes('tv') || ua.includes('smarttv')) return 'tv';
        return 'desktop';
    }

    getDeviceName(userAgent) {
        const ua = userAgent;
        if (ua.includes('iPhone')) return 'iPhone';
        if (ua.includes('iPad')) return 'iPad';
        if (ua.includes('Mac')) return 'Mac';
        if (ua.includes('Windows')) return 'Windows PC';
        if (ua.includes('Android')) return 'Android Device';
        if (ua.includes('Linux')) return 'Linux PC';
        return 'Unknown Device';
    }

    getCurrentToken() {
        // This would be obtained from request context
        return null;
    }

    async cleanupExpiredSessions() {
        const expired = await Session.updateMany(
            { expiresAt: { $lt: new Date() }, isActive: true },
            { isActive: false }
        );
        
        for (const [id, session] of this.activeSessions.entries()) {
            if (session.expiresAt < new Date()) {
                this.activeSessions.delete(id);
            }
        }
        
        logger.info(`Cleaned up ${expired.modifiedCount} expired sessions`);
        return expired.modifiedCount;
    }

    async getSessionStats() {
        const total = await Session.countDocuments({ isActive: true });
        const byDevice = await Session.aggregate([
            { $match: { isActive: true } },
            { $group: { _id: '$deviceType', count: { $sum: 1 } } }
        ]);
        
        return {
            totalActive: total,
            byDevice,
            inMemory: this.activeSessions.size
        };
    }

    isSessionExpired(session) {
        return session.expiresAt < new Date();
    }

    getSessionRemainingTime(session) {
        const remaining = session.expiresAt - Date.now();
        return Math.max(0, remaining);
    }

    async extendSession(sessionId, additionalDays = 7) {
        const session = await Session.findById(sessionId);
        if (!session) return null;
        
        session.expiresAt = new Date(Date.now() + additionalDays * 24 * 60 * 60 * 1000);
        await session.save();
        
        return session;
    }
}

module.exports = new SessionService();