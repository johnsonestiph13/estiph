const moment = require('moment');

const formatDate = (date, format = 'YYYY-MM-DD HH:mm:ss') => {
    if (!date) return null;
    return moment(date).format(format);
};

const formatCurrency = (amount, currency = 'USD') => {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency
    }).format(amount);
};

const formatNumber = (num, decimals = 2) => {
    return new Intl.NumberFormat('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    }).format(num);
};

const formatPercentage = (value, decimals = 1) => {
    return `${(value * 100).toFixed(decimals)}%`;
};

const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const formatDuration = (ms) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
};

const formatPhoneNumber = (phone) => {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 10) {
        return `(${cleaned.slice(0,3)}) ${cleaned.slice(3,6)}-${cleaned.slice(6)}`;
    }
    return phone;
};

const truncate = (str, length = 50, suffix = '...') => {
    if (str.length <= length) return str;
    return str.substring(0, length) + suffix;
};

const capitalize = (str) => {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
};

const toSlug = (str) => {
    return str
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_-]+/g, '-')
        .replace(/^-+|-+$/g, '');
};

const maskEmail = (email) => {
    const [local, domain] = email.split('@');
    const maskedLocal = local.slice(0, 2) + '***' + local.slice(-2);
    return `${maskedLocal}@${domain}`;
};

const maskPhone = (phone) => {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length >= 10) {
        return '****' + cleaned.slice(-4);
    }
    return phone;
};

module.exports = {
    formatDate,
    formatCurrency,
    formatNumber,
    formatPercentage,
    formatFileSize,
    formatDuration,
    formatPhoneNumber,
    truncate,
    capitalize,
    toSlug,
    maskEmail,
    maskPhone
};