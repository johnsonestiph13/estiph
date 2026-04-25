/**
 * Custom Validators
 * Reusable validation functions and custom validation rules
 */

const mongoose = require('mongoose');

// Custom validation functions
const isValidObjectId = (value) => {
    return mongoose.Types.ObjectId.isValid(value);
};

const isValidEmail = (email) => {
    const emailRegex = /^[^\s@]+@([^\s@.,]+\.)+[^\s@.,]{2,}$/;
    return emailRegex.test(email);
};

const isValidPhone = (phone) => {
    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    return phoneRegex.test(phone);
};

const isValidIPv4 = (ip) => {
    const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    return ipRegex.test(ip);
};

const isValidIPv6 = (ip) => {
    const ipRegex = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/;
    return ipRegex.test(ip);
};

const isValidMAC = (mac) => {
    const macRegex = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;
    return macRegex.test(mac);
};

const isValidHexColor = (color) => {
    const hexRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
    return hexRegex.test(color);
};

const isValidTemperature = (temp, unit = 'celsius') => {
    if (unit === 'celsius') {
        return temp >= -50 && temp <= 60;
    }
    return temp >= -58 && temp <= 140;
};

const isValidHumidity = (humidity) => {
    return humidity >= 0 && humidity <= 100;
};

const isValidPower = (watts) => {
    return watts >= 0 && watts <= 5000;
};

const isValidCronExpression = (cron) => {
    const cronRegex = /^(\*|([0-9]|1[0-9]|2[0-9]|3[0-9]|4[0-9]|5[0-9])|\*\/[0-9]+)\s+(\*|([0-9]|1[0-9]|2[0-3])|\*\/[0-9]+)\s+(\*|([1-9]|1[0-9]|2[0-9]|3[0-1])|\*\/[0-9]+)\s+(\*|([1-9]|1[0-2])|\*\/[0-9]+)\s+(\*|([0-6])|\*\/[0-9]+)$/;
    return cronRegex.test(cron);
};

const isValidTimeFormat = (time) => {
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    return timeRegex.test(time);
};

const isValidDateRange = (startDate, endDate) => {
    return new Date(endDate) > new Date(startDate);
};

const isValidJSON = (str) => {
    try {
        JSON.parse(str);
        return true;
    } catch (e) {
        return false;
    }
};

// Sanitization functions
const sanitizeInput = (input) => {
    if (typeof input === 'string') {
        return input.trim().replace(/[<>]/g, '');
    }
    return input;
};

const normalizeEmail = (email) => {
    return email.toLowerCase().trim();
};

const capitalizeName = (name) => {
    return name.split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
};

// Async validators
const isEmailUnique = async (email, model, excludeId = null) => {
    const query = { email: email.toLowerCase() };
    if (excludeId) {
        query._id = { $ne: excludeId };
    }
    const existing = await model.findOne(query);
    return !existing;
};

const isDeviceNameUnique = async (name, homeId, deviceId = null) => {
    const query = { name, homeId };
    if (deviceId) {
        query._id = { $ne: deviceId };
    }
    const Device = require('../models/Device');
    const existing = await Device.findOne(query);
    return !existing;
};

const isHomeMemberUnique = async (homeId, userId) => {
    const Home = require('../models/Home');
    const home = await Home.findById(homeId);
    return !home?.members.some(m => m.userId.toString() === userId);
};

// Validation chains for common fields
const commonValidators = {
    id: () => param('id').custom(isValidObjectId).withMessage('Invalid ID format'),
    email: () => body('email').isEmail().withMessage('Valid email required').normalizeEmail(),
    password: () => body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
    phone: () => body('phone').optional().custom(isValidPhone).withMessage('Invalid phone number'),
    mac: () => body('mac').custom(isValidMAC).withMessage('Invalid MAC address'),
    ip: () => body('ip').custom(isValidIPv4).withMessage('Invalid IP address'),
};

module.exports = {
    // Validation functions
    isValidObjectId,
    isValidEmail,
    isValidPhone,
    isValidIPv4,
    isValidIPv6,
    isValidMAC,
    isValidHexColor,
    isValidTemperature,
    isValidHumidity,
    isValidPower,
    isValidCronExpression,
    isValidTimeFormat,
    isValidDateRange,
    isValidJSON,
    
    // Sanitization
    sanitizeInput,
    normalizeEmail,
    capitalizeName,
    
    // Async validators
    isEmailUnique,
    isDeviceNameUnique,
    isHomeMemberUnique,
    
    // Common validators
    commonValidators,
};