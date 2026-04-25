/**
 * ESTIF HOME ULTIMATE - FORMATTER UTILITIES
 * Date, time, number, currency, and file size formatting
 * Version: 2.0.0
 * Author: Estifanos Yohannis
 */

// ============================================
// DATE FORMATTER
// ============================================

class DateFormatter {
    static format(date, format = 'YYYY-MM-DD', locale = 'en') {
        const d = new Date(date);
        
        const tokens = {
            YYYY: d.getFullYear(),
            YY: String(d.getFullYear()).slice(-2),
            MM: String(d.getMonth() + 1).padStart(2, '0'),
            M: d.getMonth() + 1,
            DD: String(d.getDate()).padStart(2, '0'),
            D: d.getDate(),
            HH: String(d.getHours()).padStart(2, '0'),
            H: d.getHours(),
            hh: String(d.getHours() % 12 || 12).padStart(2, '0'),
            h: d.getHours() % 12 || 12,
            mm: String(d.getMinutes()).padStart(2, '0'),
            m: d.getMinutes(),
            ss: String(d.getSeconds()).padStart(2, '0'),
            s: d.getSeconds(),
            SSS: String(d.getMilliseconds()).padStart(3, '0'),
            A: d.getHours() < 12 ? 'AM' : 'PM',
            a: d.getHours() < 12 ? 'am' : 'pm'
        };
        
        let result = format;
        for (const [token, value] of Object.entries(tokens)) {
            result = result.replace(new RegExp(token, 'g'), value);
        }
        
        return result;
    }

    static relativeTime(date, locale = 'en') {
        const now = new Date();
        const diff = now - new Date(date);
        const seconds = Math.floor(diff / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);
        const weeks = Math.floor(days / 7);
        const months = Math.floor(days / 30);
        const years = Math.floor(days / 365);
        
        if (seconds < 60) return 'just now';
        if (minutes < 60) return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
        if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
        if (days < 7) return `${days} day${days !== 1 ? 's' : ''} ago`;
        if (weeks < 4) return `${weeks} week${weeks !== 1 ? 's' : ''} ago`;
        if (months < 12) return `${months} month${months !== 1 ? 's' : ''} ago`;
        return `${years} year${years !== 1 ? 's' : ''} ago`;
    }

    static isToday(date) {
        const today = new Date();
        const d = new Date(date);
        return d.getDate() === today.getDate() &&
            d.getMonth() === today.getMonth() &&
            d.getFullYear() === today.getFullYear();
    }

    static isYesterday(date) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const d = new Date(date);
        return d.getDate() === yesterday.getDate() &&
            d.getMonth() === yesterday.getMonth() &&
            d.getFullYear() === yesterday.getFullYear();
    }

    static isTomorrow(date) {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const d = new Date(date);
        return d.getDate() === tomorrow.getDate() &&
            d.getMonth() === tomorrow.getMonth() &&
            d.getFullYear() === tomorrow.getFullYear();
    }

    static getTimeAgo(date) {
        return this.relativeTime(date);
    }

    static getTimeUntil(date) {
        const now = new Date();
        const diff = new Date(date) - now;
        const seconds = Math.floor(diff / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);
        
        if (days > 0) return `${days} day${days !== 1 ? 's' : ''} from now`;
        if (hours > 0) return `${hours} hour${hours !== 1 ? 's' : ''} from now`;
        if (minutes > 0) return `${minutes} minute${minutes !== 1 ? 's' : ''} from now`;
        return 'just now';
    }
}

// ============================================
// NUMBER FORMATTER
// ============================================

class NumberFormatter {
    static format(num, decimals = 0, locale = 'en') {
        return new Intl.NumberFormat(locale, {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        }).format(num);
    }

    static formatCurrency(amount, currency = 'USD', locale = 'en') {
        return new Intl.NumberFormat(locale, {
            style: 'currency',
            currency: currency
        }).format(amount);
    }

    static formatPercent(value, decimals = 1) {
        return `${(value * 100).toFixed(decimals)}%`;
    }

    static formatCompact(num, locale = 'en') {
        return new Intl.NumberFormat(locale, {
            notation: 'compact',
            compactDisplay: 'short'
        }).format(num);
    }

    static formatFileSize(bytes, decimals = 2) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return `${parseFloat((bytes / Math.pow(k, i)).toFixed(decimals))} ${sizes[i]}`;
    }

    static formatDuration(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        
        const parts = [];
        if (hours > 0) parts.push(`${hours}h`);
        if (minutes > 0) parts.push(`${minutes}m`);
        if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);
        
        return parts.join(' ');
    }

    static formatPower(watts) {
        if (watts >= 1000) {
            return `${(watts / 1000).toFixed(1)} kW`;
        }
        return `${watts} W`;
    }

    static formatEnergy(kwh) {
        if (kwh >= 1000) {
            return `${(kwh / 1000).toFixed(1)} MWh`;
        }
        return `${kwh.toFixed(2)} kWh`;
    }

    static formatTemperature(celsius, unit = 'celsius') {
        if (unit === 'fahrenheit') {
            const fahrenheit = (celsius * 9/5) + 32;
            return `${Math.round(fahrenheit)}°F`;
        }
        return `${Math.round(celsius)}°C`;
    }

    static addCommas(num) {
        return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }

    static ordinal(num) {
        const j = num % 10;
        const k = num % 100;
        if (j === 1 && k !== 11) return `${num}st`;
        if (j === 2 && k !== 12) return `${num}nd`;
        if (j === 3 && k !== 13) return `${num}rd`;
        return `${num}th`;
    }
}

// ============================================
// STRING FORMATTER
// ============================================

class StringFormatter {
    static capitalize(str) {
        if (!str) return '';
        return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
    }

    static capitalizeWords(str) {
        if (!str) return '';
        return str.split(' ').map(word => this.capitalize(word)).join(' ');
    }

    static truncate(str, length = 50, suffix = '...') {
        if (!str) return '';
        if (str.length <= length) return str;
        return str.substring(0, length).trim() + suffix;
    }

    static slugify(str) {
        if (!str) return '';
        return str
            .toLowerCase()
            .trim()
            .replace(/[^\w\s-]/g, '')
            .replace(/[\s_-]+/g, '-')
            .replace(/^-+|-+$/g, '');
    }

    static camelCase(str) {
        return str.replace(/[-_\s]+(.)?/g, (_, c) => c ? c.toUpperCase() : '');
    }

    static snakeCase(str) {
        return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`).replace(/^_/, '');
    }

    static kebabCase(str) {
        return str.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`).replace(/^-/, '');
    }

    static mask(str, start = 2, end = 2, maskChar = '*') {
        if (!str) return '';
        if (str.length <= start + end) return maskChar.repeat(str.length);
        return str.slice(0, start) + maskChar.repeat(str.length - start - end) + str.slice(-end);
    }

    static maskEmail(email) {
        if (!email) return '';
        const [local, domain] = email.split('@');
        const maskedLocal = this.mask(local, 2, 1);
        return `${maskedLocal}@${domain}`;
    }

    static maskPhone(phone) {
        if (!phone) return '';
        return this.mask(phone, 3, 2);
    }

    static htmlEntities(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    static reverse(str) {
        return str.split('').reverse().join('');
    }

    static countWords(str) {
        if (!str) return 0;
        return str.trim().split(/\s+/).length;
    }
}

// ============================================
// EXPORTS
// ============================================

const Formatters = {
    Date: DateFormatter,
    Number: NumberFormatter,
    String: StringFormatter
};

// Expose globally
window.Formatters = Formatters;

export { DateFormatter, NumberFormatter, StringFormatter, Formatters };