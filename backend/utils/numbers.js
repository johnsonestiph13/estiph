const clamp = (num, min, max) => {
    return Math.min(Math.max(num, min), max);
};

const round = (num, decimals = 2) => {
    const factor = Math.pow(10, decimals);
    return Math.round(num * factor) / factor;
};

const floor = (num, decimals = 2) => {
    const factor = Math.pow(10, decimals);
    return Math.floor(num * factor) / factor;
};

const ceil = (num, decimals = 2) => {
    const factor = Math.pow(10, decimals);
    return Math.ceil(num * factor) / factor;
};

const randomInt = (min, max) => {
    return Math.floor(Math.random() * (max - min + 1)) + min;
};

const randomFloat = (min, max, decimals = 2) => {
    const value = min + Math.random() * (max - min);
    return round(value, decimals);
};

const formatNumber = (num, decimals = 2) => {
    return num.toLocaleString(undefined, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    });
};

const formatCompact = (num) => {
    return new Intl.NumberFormat('en-US', {
        notation: 'compact',
        compactDisplay: 'short'
    }).format(num);
};

const isNumber = (value) => {
    return typeof value === 'number' && !isNaN(value) && isFinite(value);
};

const toNumber = (value, defaultValue = 0) => {
    const num = Number(value);
    return isNaN(num) ? defaultValue : num;
};

const toInt = (value, defaultValue = 0) => {
    const num = parseInt(value);
    return isNaN(num) ? defaultValue : num;
};

const toFloat = (value, defaultValue = 0) => {
    const num = parseFloat(value);
    return isNaN(num) ? defaultValue : num;
};

const percentage = (value, total, decimals = 2) => {
    if (total === 0) return 0;
    return round((value / total) * 100, decimals);
};

const bytesToSize = (bytes) => {
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    if (bytes === 0) return '0 B';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return round(bytes / Math.pow(1024, i), 2) + ' ' + sizes[i];
};

const formatCurrency = (amount, currency = 'USD') => {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency
    }).format(amount);
};

const ordinal = (num) => {
    const j = num % 10;
    const k = num % 100;
    if (j === 1 && k !== 11) return `${num}st`;
    if (j === 2 && k !== 12) return `${num}nd`;
    if (j === 3 && k !== 13) return `${num}rd`;
    return `${num}th`;
};

const inRange = (num, min, max, inclusive = true) => {
    if (inclusive) return num >= min && num <= max;
    return num > min && num < max;
};

const sum = (arr) => {
    return arr.reduce((a, b) => a + (isNumber(b) ? b : 0), 0);
};

const average = (arr) => {
    if (arr.length === 0) return 0;
    return sum(arr) / arr.length;
};

const min = (arr) => {
    if (arr.length === 0) return null;
    return Math.min(...arr.filter(isNumber));
};

const max = (arr) => {
    if (arr.length === 0) return null;
    return Math.max(...arr.filter(isNumber));
};

module.exports = {
    clamp,
    round,
    floor,
    ceil,
    randomInt,
    randomFloat,
    formatNumber,
    formatCompact,
    isNumber,
    toNumber,
    toInt,
    toFloat,
    percentage,
    bytesToSize,
    formatCurrency,
    ordinal,
    inRange,
    sum,
    average,
    min,
    max
};