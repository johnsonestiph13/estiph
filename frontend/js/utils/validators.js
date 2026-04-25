/**
 * ESTIF HOME ULTIMATE - VALIDATOR UTILITIES
 * Comprehensive validation for emails, phones, passwords, and custom rules
 * Version: 2.0.0
 * Author: Estifanos Yohannis
 */

// ============================================
// VALIDATION RULES
// ============================================

class Validator {
    // ============================================
    // BASIC VALIDATORS
    // ============================================

    static isEmail(email) {
        const regex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        return regex.test(email);
    }

    static isPhone(phone) {
        const regex = /^[\+]?[(]?[0-9]{1,4}[)]?[-\s\.]?[(]?[0-9]{1,4}[)]?[-\s\.]?[0-9]{1,9}$/;
        return regex.test(phone);
    }

    static isUrl(url) {
        try {
            new URL(url);
            return true;
        } catch {
            return false;
        }
    }

    static isIP(ip) {
        const ipv4Regex = /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
        const ipv6Regex = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/;
        return ipv4Regex.test(ip) || ipv6Regex.test(ip);
    }

    static isMAC(mac) {
        const regex = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;
        return regex.test(mac);
    }

    static isUUID(uuid) {
        const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        return regex.test(uuid);
    }

    static isHexColor(color) {
        const regex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
        return regex.test(color);
    }

    static isCreditCard(number) {
        const regex = /^(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|6(?:011|5[0-9][0-9])[0-9]{12})$/;
        return regex.test(number.replace(/\s/g, ''));
    }

    // ============================================
    // PASSWORD VALIDATORS
    // ============================================

    static isStrongPassword(password, options = {}) {
        const minLength = options.minLength || 8;
        const requireUppercase = options.requireUppercase !== false;
        const requireLowercase = options.requireLowercase !== false;
        const requireNumber = options.requireNumber !== false;
        const requireSpecial = options.requireSpecial !== false;
        
        const checks = {
            length: password.length >= minLength,
            uppercase: !requireUppercase || /[A-Z]/.test(password),
            lowercase: !requireLowercase || /[a-z]/.test(password),
            number: !requireNumber || /[0-9]/.test(password),
            special: !requireSpecial || /[!@#$%^&*(),.?":{}|<>]/.test(password)
        };
        
        const score = Object.values(checks).filter(Boolean).length;
        const isValid = score >= 3;
        
        return {
            isValid,
            score,
            strength: this.getPasswordStrength(score),
            checks
        };
    }

    static getPasswordStrength(score) {
        if (score <= 2) return 'weak';
        if (score === 3) return 'medium';
        if (score === 4) return 'strong';
        return 'very-strong';
    }

    static isPasswordMatch(password, confirmPassword) {
        return password === confirmPassword;
    }

    // ============================================
    // DOMAIN VALIDATORS
    // ============================================

    static isDomain(domain) {
        const regex = /^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}$/;
        return regex.test(domain);
    }

    static isSubdomain(subdomain) {
        const regex = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9](\.[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9])*$/;
        return regex.test(subdomain);
    }

    // ============================================
    // DATE VALIDATORS
    // ============================================

    static isDate(date) {
        return !isNaN(new Date(date).getTime());
    }

    static isFutureDate(date) {
        return new Date(date) > new Date();
    }

    static isPastDate(date) {
        return new Date(date) < new Date();
    }

    static isDateBetween(date, start, end) {
        const d = new Date(date);
        return d >= new Date(start) && d <= new Date(end);
    }

    static isWeekend(date) {
        const day = new Date(date).getDay();
        return day === 0 || day === 6;
    }

    static isWeekday(date) {
        return !this.isWeekend(date);
    }

    // ============================================
    // NUMBER VALIDATORS
    // ============================================

    static isNumber(value) {
        return !isNaN(parseFloat(value)) && isFinite(value);
    }

    static isInteger(value) {
        return Number.isInteger(Number(value));
    }

    static isPositive(value) {
        return Number(value) > 0;
    }

    static isNegative(value) {
        return Number(value) < 0;
    }

    static isBetween(value, min, max) {
        const num = Number(value);
        return num >= min && num <= max;
    }

    static isInRange(value, min, max) {
        return this.isBetween(value, min, max);
    }

    // ============================================
    // STRING VALIDATORS
    // ============================================

    static isEmpty(str) {
        return !str || str.trim().length === 0;
    }

    static isLength(str, min, max) {
        const length = str.length;
        return length >= min && length <= max;
    }

    static matches(str, regex) {
        return regex.test(str);
    }

    static contains(str, substring) {
        return str.includes(substring);
    }

    static startsWith(str, prefix) {
        return str.startsWith(prefix);
    }

    static endsWith(str, suffix) {
        return str.endsWith(suffix);
    }

    static isAlphanumeric(str) {
        return /^[a-zA-Z0-9]+$/.test(str);
    }

    static isAlpha(str) {
        return /^[a-zA-Z]+$/.test(str);
    }

    static isNumeric(str) {
        return /^\d+$/.test(str);
    }

    // ============================================
    // FILE VALIDATORS
    // ============================================

    static isImageFile(file) {
        const imageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
        return imageTypes.includes(file.type);
    }

    static isVideoFile(file) {
        const videoTypes = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'];
        return videoTypes.includes(file.type);
    }

    static isAudioFile(file) {
        const audioTypes = ['audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/webm'];
        return audioTypes.includes(file.type);
    }

    static isDocumentFile(file) {
        const docTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
        return docTypes.includes(file.type);
    }

    static isFileSizeValid(file, maxSizeMB = 5) {
        return file.size <= maxSizeMB * 1024 * 1024;
    }

    // ============================================
    // OBJECT VALIDATORS
    // ============================================

    static isObject(obj) {
        return obj && typeof obj === 'object' && !Array.isArray(obj);
    }

    static isEmptyObject(obj) {
        return this.isObject(obj) && Object.keys(obj).length === 0;
    }

    static hasKeys(obj, keys) {
        return keys.every(key => key in obj);
    }

    // ============================================
    // ARRAY VALIDATORS
    // ============================================

    static isArray(arr) {
        return Array.isArray(arr);
    }

    static isEmptyArray(arr) {
        return this.isArray(arr) && arr.length === 0;
    }

    static arrayContains(arr, value) {
        return arr.includes(value);
    }

    static arrayUnique(arr) {
        return new Set(arr).size === arr.length;
    }

    // ============================================
    // CUSTOM VALIDATION
    // ============================================

    static async validate(validator, value) {
        if (typeof validator === 'function') {
            return validator(value);
        }
        if (typeof validator === 'string') {
            return this[validator](value);
        }
        if (validator instanceof RegExp) {
            return validator.test(value);
        }
        return false;
    }

    static validateAll(rules, data) {
        const errors = {};
        
        for (const [field, fieldRules] of Object.entries(rules)) {
            const value = data[field];
            const fieldErrors = [];
            
            for (const rule of fieldRules) {
                let isValid = true;
                let errorMessage = '';
                
                if (typeof rule === 'string') {
                    isValid = this[rule](value);
                    errorMessage = `${field} ${rule} failed`;
                } else if (rule.validator) {
                    isValid = this[rule.validator](value);
                    errorMessage = rule.message || `${field} validation failed`;
                } else if (rule.regex) {
                    isValid = rule.regex.test(value);
                    errorMessage = rule.message || `${field} format is invalid`;
                } else if (rule.custom) {
                    isValid = rule.custom(value);
                    errorMessage = rule.message || `${field} validation failed`;
                }
                
                if (!isValid) {
                    fieldErrors.push(errorMessage);
                }
            }
            
            if (fieldErrors.length > 0) {
                errors[field] = fieldErrors;
            }
        }
        
        return {
            isValid: Object.keys(errors).length === 0,
            errors
        };
    }
}

// ============================================
// EXPORTS
// ============================================

// Expose globally
window.Validator = Validator;

export { Validator };