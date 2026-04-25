const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const generateAccessToken = (payload, expiresIn = '7d') => {
    return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn });
};

const generateRefreshToken = (payload, expiresIn = '30d') => {
    return jwt.sign(payload, process.env.JWT_REFRESH_SECRET, { expiresIn });
};

const verifyAccessToken = (token) => {
    try {
        return jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
        return null;
    }
};

const verifyRefreshToken = (token) => {
    try {
        return jwt.verify(token, process.env.JWT_REFRESH_SECRET);
    } catch (error) {
        return null;
    }
};

const generateResetToken = () => {
    return crypto.randomBytes(32).toString('hex');
};

const generateVerificationToken = () => {
    return crypto.randomBytes(32).toString('hex');
};

const generateAPIKey = () => {
    return `estif_${crypto.randomBytes(32).toString('hex')}`;
};

const generateInviteToken = () => {
    return crypto.randomBytes(32).toString('hex');
};

const decodeToken = (token) => {
    try {
        return jwt.decode(token);
    } catch {
        return null;
    }
};

const getTokenExpiry = (token) => {
    const decoded = decodeToken(token);
    return decoded?.exp ? new Date(decoded.exp * 1000) : null;
};

const isTokenExpired = (token) => {
    const expiry = getTokenExpiry(token);
    return expiry ? expiry < new Date() : true;
};

module.exports = {
    generateAccessToken,
    generateRefreshToken,
    verifyAccessToken,
    verifyRefreshToken,
    generateResetToken,
    generateVerificationToken,
    generateAPIKey,
    generateInviteToken,
    decodeToken,
    getTokenExpiry,
    isTokenExpired
};