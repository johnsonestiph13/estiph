const validator = require('validator');

const isValidEmail = (email) => {
    return validator.isEmail(email);
};

const isValidPhone = (phone) => {
    return validator.isMobilePhone(phone);
};

const isValidURL = (url) => {
    return validator.isURL(url);
};

const isValidIP = (ip) => {
    return validator.isIP(ip);
};

const isValidUUID = (uuid) => {
    return validator.isUUID(uuid);
};

const isValidObjectId = (id) => {
    return validator.isMongoId(id);
};

const isValidPassword = (password, minLength = 6) => {
    const hasMinLength = password.length >= minLength;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    
    return {
        isValid: hasMinLength && (hasUpperCase || hasLowerCase) && hasNumber,
        strength: {
            length: hasMinLength,
            uppercase: hasUpperCase,
            lowercase: hasLowerCase,
            number: hasNumber,
            special: hasSpecial
        }
    };
};

const isValidName = (name) => {
    return name && name.length >= 2 && name.length <= 50 && /^[a-zA-Z\s\-']+$/.test(name);
};

const isValidHexColor = (color) => {
    return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(color);
};

const isInRange = (value, min, max) => {
    const num = Number(value);
    return !isNaN(num) && num >= min && num <= max;
};

const isPositiveInteger = (value) => {
    const num = Number(value);
    return Number.isInteger(num) && num > 0;
};

const validateCoordinates = (lat, lng) => {
    return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
};

const validateMacAddress = (mac) => {
    return /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/.test(mac);
};

module.exports = {
    isValidEmail,
    isValidPhone,
    isValidURL,
    isValidIP,
    isValidUUID,
    isValidObjectId,
    isValidPassword,
    isValidName,
    isValidHexColor,
    isInRange,
    isPositiveInteger,
    validateCoordinates,
    validateMacAddress
};