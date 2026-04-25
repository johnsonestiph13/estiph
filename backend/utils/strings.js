const capitalize = (str) => {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
};

const capitalizeWords = (str) => {
    if (!str) return '';
    return str.split(' ').map(word => capitalize(word)).join(' ');
};

const capitalizeEachWord = (str) => {
    if (!str) return '';
    return str.replace(/\b\w/g, char => char.toUpperCase());
};

const toCamelCase = (str) => {
    return str.replace(/[-_\s]+(.)?/g, (_, c) => c ? c.toUpperCase() : '');
};

const toSnakeCase = (str) => {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`).replace(/^_/, '');
};

const toKebabCase = (str) => {
    return str.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`).replace(/^-/, '');
};

const truncate = (str, length = 50, suffix = '...') => {
    if (!str || str.length <= length) return str;
    return str.substring(0, length).trim() + suffix;
};

const truncateWords = (str, wordCount = 10, suffix = '...') => {
    const words = str.split(' ');
    if (words.length <= wordCount) return str;
    return words.slice(0, wordCount).join(' ') + suffix;
};

const slugify = (str) => {
    return str
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_-]+/g, '-')
        .replace(/^-+|-+$/g, '');
};

const removeSpecialChars = (str) => {
    return str.replace(/[^\w\s]/gi, '');
};

const removeWhitespace = (str) => {
    return str.replace(/\s/g, '');
};

const countWords = (str) => {
    if (!str) return 0;
    return str.trim().split(/\s+/).length;
};

const countCharacters = (str, includeSpaces = true) => {
    if (!str) return 0;
    return includeSpaces ? str.length : str.replace(/\s/g, '').length;
};

const reverse = (str) => {
    return str.split('').reverse().join('');
};

const isPalindrome = (str) => {
    const cleaned = str.toLowerCase().replace(/[^a-z0-9]/g, '');
    return cleaned === reverse(cleaned);
};

const escapeHtml = (str) => {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
};

const unescapeHtml = (str) => {
    return str
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");
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

const extractInitials = (name) => {
    if (!name) return '';
    return name
        .split(' ')
        .map(word => word[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
};

const isValidEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};

const isAlphanumeric = (str) => {
    return /^[a-zA-Z0-9]+$/.test(str);
};

const isAlpha = (str) => {
    return /^[a-zA-Z]+$/.test(str);
};

const isNumeric = (str) => {
    return /^\d+$/.test(str);
};

module.exports = {
    capitalize,
    capitalizeWords,
    capitalizeEachWord,
    toCamelCase,
    toSnakeCase,
    toKebabCase,
    truncate,
    truncateWords,
    slugify,
    removeSpecialChars,
    removeWhitespace,
    countWords,
    countCharacters,
    reverse,
    isPalindrome,
    escapeHtml,
    unescapeHtml,
    maskEmail,
    maskPhone,
    extractInitials,
    isValidEmail,
    isAlphanumeric,
    isAlpha,
    isNumeric
};