const crypto = require('crypto');

const generateRandomString = (length = 32) => {
    return crypto.randomBytes(length).toString('hex');
};

const generateOTP = (length = 6) => {
    return Math.floor(Math.random() * Math.pow(10, length)).toString().padStart(length, '0');
};

const sleep = (ms) => {
    return new Promise(resolve => setTimeout(resolve, ms));
};

const retry = async (fn, retries = 3, delay = 1000) => {
    try {
        return await fn();
    } catch (error) {
        if (retries <= 0) throw error;
        await sleep(delay);
        return retry(fn, retries - 1, delay * 2);
    }
};

const isEmpty = (value) => {
    if (value === null || value === undefined) return true;
    if (typeof value === 'string') return value.trim().length === 0;
    if (Array.isArray(value)) return value.length === 0;
    if (typeof value === 'object') return Object.keys(value).length === 0;
    return false;
};

const isObject = (value) => {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
};

const pick = (obj, keys) => {
    return keys.reduce((result, key) => {
        if (obj && obj.hasOwnProperty(key)) {
            result[key] = obj[key];
        }
        return result;
    }, {});
};

const omit = (obj, keys) => {
    const result = { ...obj };
    keys.forEach(key => delete result[key]);
    return result;
};

const deepClone = (obj) => {
    return JSON.parse(JSON.stringify(obj));
};

const compareObjects = (obj1, obj2) => {
    return JSON.stringify(obj1) === JSON.stringify(obj2);
};

const getNestedValue = (obj, path, defaultValue = null) => {
    const keys = path.split('.');
    let result = obj;
    for (const key of keys) {
        if (result === null || result === undefined) {
            return defaultValue;
        }
        result = result[key];
    }
    return result === undefined ? defaultValue : result;
};

const setNestedValue = (obj, path, value) => {
    const keys = path.split('.');
    let current = obj;
    for (let i = 0; i < keys.length - 1; i++) {
        if (!current[keys[i]]) current[keys[i]] = {};
        current = current[keys[i]];
    }
    current[keys[keys.length - 1]] = value;
    return obj;
};

module.exports = {
    generateRandomString,
    generateOTP,
    sleep,
    retry,
    isEmpty,
    isObject,
    pick,
    omit,
    deepClone,
    compareObjects,
    getNestedValue,
    setNestedValue
};