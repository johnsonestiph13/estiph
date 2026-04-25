/**
 * ESTIF HOME ULTIMATE - JWT SERVICE
 * JSON Web Token generation and validation
 * Version: 2.0.0
 */

const jwt = require('jsonwebtoken');
const crypto = require('crypto');

class JWTService {
    constructor() {
        this.accessSecret = process.env.JWT_SECRET;
        this.refreshSecret = process.env.JWT_REFRESH_SECRET;
        this.accessExpiry = process.env.JWT_EXPIRES_IN || '15m';
        this.refreshExpiry = process.env.JWT_REFRESH_EXPIRES_IN || '7d';
    }

    generateAccessToken(payload) {
        return jwt.sign(payload, this.accessSecret, { expiresIn: this.accessExpiry });
    }

    generateRefreshToken(payload) {
        return jwt.sign(payload, this.refreshSecret, { expiresIn: this.refreshExpiry });
    }

    generateTokenPair(userId, role, additionalData = {}) {
        const payload = { id: userId, role, ...additionalData };
        return {
            accessToken: this.generateAccessToken(payload),
            refreshToken: this.generateRefreshToken(payload),
            expiresIn: this.accessExpiry,
            tokenType: 'Bearer'
        };
    }

    verifyAccessToken(token) {
        try {
            return jwt.verify(token, this.accessSecret);
        } catch (error) {
            return null;
        }
    }

    verifyRefreshToken(token) {
        try {
            return jwt.verify(token, this.refreshSecret);
        } catch (error) {
            return null;
        }
    }

    decodeToken(token) {
        return jwt.decode(token);
    }

    isTokenExpired(token) {
        const decoded = this.decodeToken(token);
        if (!decoded || !decoded.exp) return true;
        return decoded.exp * 1000 < Date.now();
    }

    getTokenExpiry(token) {
        const decoded = this.decodeToken(token);
        return decoded?.exp ? new Date(decoded.exp * 1000) : null;
    }

    refreshAccessToken(refreshToken) {
        const payload = this.verifyRefreshToken(refreshToken);
        if (!payload) return null;
        return this.generateAccessToken({ id: payload.id, role: payload.role });
    }

    generateAPIKey(name, userId) {
        const key = `estif_${crypto.randomBytes(32).toString('hex')}`;
        const secret = crypto.randomBytes(32).toString('hex');
        const apiKeyId = crypto.randomBytes(16).toString('hex');
        
        return { apiKeyId, key, secret };
    }

    verifyAPIKey(key, storedKey, storedSecret, providedSecret) {
        const isValidKey = crypto.timingSafeEqual(Buffer.from(key), Buffer.from(storedKey));
        const isValidSecret = crypto.timingSafeEqual(Buffer.from(providedSecret), Buffer.from(storedSecret));
        return isValidKey && isValidSecret;
    }
}

module.exports = new JWTService();