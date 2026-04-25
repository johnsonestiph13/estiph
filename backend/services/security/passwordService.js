/**
 * ESTIF HOME ULTIMATE - PASSWORD SERVICE
 * Password hashing, validation, and strength checking
 * Version: 2.0.0
 */

const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const validator = require('validator');

class PasswordService {
    constructor() {
        this.saltRounds = 12;
        this.minLength = 8;
        this.maxLength = 64;
    }

    async hashPassword(password) {
        return bcrypt.hash(password, this.saltRounds);
    }

    async verifyPassword(password, hashedPassword) {
        return bcrypt.compare(password, hashedPassword);
    }

    validatePasswordStrength(password) {
        const checks = {
            length: password.length >= this.minLength,
            maxLength: password.length <= this.maxLength,
            uppercase: /[A-Z]/.test(password),
            lowercase: /[a-z]/.test(password),
            number: /[0-9]/.test(password),
            special: /[!@#$%^&*(),.?":{}|<>]/.test(password),
            noSpaces: !/\s/.test(password),
            noCommon: !this.isCommonPassword(password)
        };

        const score = Object.values(checks).filter(Boolean).length;
        
        let strength = 'weak';
        if (score >= 7) strength = 'very-strong';
        else if (score >= 6) strength = 'strong';
        else if (score >= 4) strength = 'medium';
        else if (score >= 3) strength = 'weak';
        else strength = 'very-weak';

        const errors = [];
        if (!checks.length) errors.push(`Password must be at least ${this.minLength} characters`);
        if (!checks.uppercase) errors.push('Must contain at least one uppercase letter');
        if (!checks.lowercase) errors.push('Must contain at least one lowercase letter');
        if (!checks.number) errors.push('Must contain at least one number');
        if (!checks.special) errors.push('Must contain at least one special character');
        if (!checks.noSpaces) errors.push('Cannot contain spaces');
        if (checks.noCommon) errors.push('Password is too common');

        return {
            isValid: score >= 4,
            strength,
            score,
            checks,
            errors,
            scorePercent: (score / 7) * 100
        };
    }

    isCommonPassword(password) {
        const commonPasswords = [
            'password', '123456', '12345678', '123456789', 'qwerty', 'abc123',
            'password123', 'admin', 'iloveyou', 'welcome', 'monkey', 'sunshine'
        ];
        return commonPasswords.includes(password.toLowerCase());
    }

    generateRandomPassword(length = 12) {
        const uppercase = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
        const lowercase = 'abcdefghijkmnopqrstuvwxyz';
        const numbers = '23456789';
        const symbols = '!@#$%^&*';
        
        let password = '';
        password += uppercase[Math.floor(Math.random() * uppercase.length)];
        password += lowercase[Math.floor(Math.random() * lowercase.length)];
        password += numbers[Math.floor(Math.random() * numbers.length)];
        password += symbols[Math.floor(Math.random() * symbols.length)];
        
        const allChars = uppercase + lowercase + numbers + symbols;
        for (let i = password.length; i < length; i++) {
            password += allChars[Math.floor(Math.random() * allChars.length)];
        }
        
        return password.split('').sort(() => Math.random() - 0.5).join('');
    }

    generateResetToken() {
        return crypto.randomBytes(32).toString('hex');
    }

    generateVerificationToken() {
        return crypto.randomBytes(32).toString('hex');
    }

    generateOTP(length = 6) {
        const digits = '0123456789';
        let otp = '';
        for (let i = 0; i < length; i++) {
            otp += digits[Math.floor(Math.random() * digits.length)];
        }
        return otp;
    }

    hashResetToken(token) {
        return crypto.createHash('sha256').update(token).digest('hex');
    }

    verifyResetToken(token, hashedToken) {
        const hashedInput = crypto.createHash('sha256').update(token).digest('hex');
        return crypto.timingSafeEqual(Buffer.from(hashedInput), Buffer.from(hashedToken));
    }

    getPasswordStrengthLabel(strength) {
        const labels = {
            'very-weak': 'Very Weak',
            'weak': 'Weak',
            'medium': 'Medium',
            'strong': 'Strong',
            'very-strong': 'Very Strong'
        };
        return labels[strength] || 'Unknown';
    }

    getPasswordStrengthColor(strength) {
        const colors = {
            'very-weak': '#ef476f',
            'weak': '#ffd166',
            'medium': '#4cc9f0',
            'strong': '#06d6a0',
            'very-strong': '#06d6a0'
        };
        return colors[strength] || '#6c757d';
    }

    estimateCrackTime(password) {
        const charsetSizes = {
            lowercase: 26,
            uppercase: 26,
            numbers: 10,
            symbols: 32
        };
        
        let charsetSize = 0;
        if (/[a-z]/.test(password)) charsetSize += charsetSizes.lowercase;
        if (/[A-Z]/.test(password)) charsetSize += charsetSizes.uppercase;
        if (/[0-9]/.test(password)) charsetSize += charsetSizes.numbers;
        if (/[^a-zA-Z0-9]/.test(password)) charsetSize += charsetSizes.symbols;
        
        const combinations = Math.pow(charsetSize, password.length);
        const guessesPerSecond = 1000000000; // 1 billion guesses per second
        const seconds = combinations / guessesPerSecond;
        
        if (seconds < 60) return 'less than a minute';
        if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes`;
        if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours`;
        if (seconds < 31536000) return `${Math.floor(seconds / 86400)} days`;
        return `${Math.floor(seconds / 31536000)} years`;
    }
}

module.exports = new PasswordService();