/**
 * ESTIF HOME ULTIMATE - HELPER FUNCTIONS MODULE
 * Utility functions for common operations
 * Version: 2.0.0
 * Author: Estifanos Yohannis
 */

// ============================================
// STRING HELPERS
// ============================================

export const StringHelpers = {
    /**
     * Capitalize first letter of a string
     */
    capitalize(str) {
        if (!str || typeof str !== 'string') return '';
        return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
    },

    /**
     * Capitalize first letter of each word
     */
    capitalizeWords(str) {
        if (!str || typeof str !== 'string') return '';
        return str.split(' ').map(word => this.capitalize(word)).join(' ');
    },

    /**
     * Truncate string to specified length
     */
    truncate(str, length = 50, suffix = '...') {
        if (!str || typeof str !== 'string') return '';
        if (str.length <= length) return str;
        return str.substring(0, length).trim() + suffix;
    },

    /**
     * Convert string to slug (URL friendly)
     */
    slugify(str) {
        if (!str || typeof str !== 'string') return '';
        return str
            .toLowerCase()
            .trim()
            .replace(/[^\w\s-]/g, '')
            .replace(/[\s_-]+/g, '-')
            .replace(/^-+|-+$/g, '');
    },

    /**
     * Generate random string
     */
    randomString(length = 8) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    },

    /**
     * Escape HTML special characters
     */
    escapeHtml(str) {
        if (!str || typeof str !== 'string') return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    },

    /**
     * Unescape HTML entities
     */
    unescapeHtml(str) {
        if (!str || typeof str !== 'string') return '';
        const div = document.createElement('div');
        div.innerHTML = str;
        return div.textContent;
    },

    /**
     * Check if string is valid email
     */
    isValidEmail(email) {
        const regex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        return regex.test(email);
    },

    /**
     * Check if string is valid phone number
     */
    isValidPhone(phone) {
        const regex = /^[\+]?[(]?[0-9]{1,4}[)]?[-\s\.]?[(]?[0-9]{1,4}[)]?[-\s\.]?[0-9]{1,9}$/;
        return regex.test(phone);
    },

    /**
     * Extract initials from name
     */
    getInitials(name) {
        if (!name) return '';
        return name
            .split(' ')
            .map(word => word[0])
            .join('')
            .toUpperCase()
            .slice(0, 2);
    },

    /**
     * Pluralize word based on count
     */
    pluralize(count, singular, plural = null) {
        if (count === 1) return `${count} ${singular}`;
        return `${count} ${plural || singular + 's'}`;
    },

    /**
     * Mask sensitive data (e.g., email, phone)
     */
    mask(str, start = 2, end = 2, maskChar = '*') {
        if (!str) return '';
        if (str.length <= start + end) return maskChar.repeat(str.length);
        return str.slice(0, start) + maskChar.repeat(str.length - start - end) + str.slice(-end);
    }
};

// ============================================
// NUMBER HELPERS
// ============================================

export const NumberHelpers = {
    /**
     * Format number with thousand separators
     */
    formatNumber(num, decimals = 0) {
        if (num === null || num === undefined) return '0';
        return Number(num).toLocaleString(undefined, {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        });
    },

    /**
     * Format currency
     */
    formatCurrency(amount, currency = 'USD', locale = 'en-US') {
        return new Intl.NumberFormat(locale, {
            style: 'currency',
            currency: currency
        }).format(amount);
    },

    /**
     * Format percentage
     */
    formatPercent(value, decimals = 1) {
        return `${(value * 100).toFixed(decimals)}%`;
    },

    /**
     * Format file size
     */
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    },

    /**
     * Format duration in seconds to human readable
     */
    formatDuration(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        
        const parts = [];
        if (hours > 0) parts.push(`${hours}h`);
        if (minutes > 0) parts.push(`${minutes}m`);
        if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);
        
        return parts.join(' ');
    },

    /**
     * Clamp number between min and max
     */
    clamp(num, min, max) {
        return Math.min(Math.max(num, min), max);
    },

    /**
     * Random number between min and max
     */
    random(min, max) {
        return Math.random() * (max - min) + min;
    },

    /**
     * Random integer between min and max (inclusive)
     */
    randomInt(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    },

    /**
     * Round to specified decimals
     */
    round(num, decimals = 0) {
        const factor = Math.pow(10, decimals);
        return Math.round(num * factor) / factor;
    },

    /**
     * Check if number is between range
     */
    isBetween(num, min, max, inclusive = true) {
        if (inclusive) return num >= min && num <= max;
        return num > min && num < max;
    },

    /**
     * Convert to percentage
     */
    toPercentage(value, total, decimals = 1) {
        if (total === 0) return 0;
        return ((value / total) * 100).toFixed(decimals);
    }
};

// ============================================
// DATE HELPERS
// ============================================

export const DateHelpers = {
    /**
     * Format date
     */
    formatDate(date, format = 'YYYY-MM-DD') {
        const d = new Date(date);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const hours = String(d.getHours()).padStart(2, '0');
        const minutes = String(d.getMinutes()).padStart(2, '0');
        const seconds = String(d.getSeconds()).padStart(2, '0');
        
        return format
            .replace('YYYY', year)
            .replace('MM', month)
            .replace('DD', day)
            .replace('HH', hours)
            .replace('mm', minutes)
            .replace('ss', seconds);
    },

    /**
     * Get relative time (e.g., "2 hours ago")
     */
    timeAgo(date) {
        const seconds = Math.floor((new Date() - new Date(date)) / 1000);
        
        const intervals = {
            year: 31536000,
            month: 2592000,
            week: 604800,
            day: 86400,
            hour: 3600,
            minute: 60,
            second: 1
        };
        
        for (const [unit, secondsInUnit] of Object.entries(intervals)) {
            const interval = Math.floor(seconds / secondsInUnit);
            if (interval >= 1) {
                return `${interval} ${unit}${interval === 1 ? '' : 's'} ago`;
            }
        }
        
        return 'just now';
    },

    /**
     * Check if date is today
     */
    isToday(date) {
        const today = new Date();
        const d = new Date(date);
        return d.getDate() === today.getDate() &&
            d.getMonth() === today.getMonth() &&
            d.getFullYear() === today.getFullYear();
    },

    /**
     * Check if date is yesterday
     */
    isYesterday(date) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const d = new Date(date);
        return d.getDate() === yesterday.getDate() &&
            d.getMonth() === yesterday.getMonth() &&
            d.getFullYear() === yesterday.getFullYear();
    },

    /**
     * Check if date is tomorrow
     */
    isTomorrow(date) {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const d = new Date(date);
        return d.getDate() === tomorrow.getDate() &&
            d.getMonth() === tomorrow.getMonth() &&
            d.getFullYear() === tomorrow.getFullYear();
    },

    /**
     * Get days difference between dates
     */
    daysBetween(date1, date2) {
        const d1 = new Date(date1);
        const d2 = new Date(date2);
        const diffTime = Math.abs(d2 - d1);
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    },

    /**
     * Add days to date
     */
    addDays(date, days) {
        const result = new Date(date);
        result.setDate(result.getDate() + days);
        return result;
    },

    /**
     * Subtract days from date
     */
    subtractDays(date, days) {
        return this.addDays(date, -days);
    },

    /**
     * Get start of day
     */
    startOfDay(date) {
        const d = new Date(date);
        d.setHours(0, 0, 0, 0);
        return d;
    },

    /**
     * Get end of day
     */
    endOfDay(date) {
        const d = new Date(date);
        d.setHours(23, 59, 59, 999);
        return d;
    },

    /**
     * Get week number
     */
    getWeekNumber(date) {
        const d = new Date(date);
        const dayNum = d.getDay();
        const firstDay = new Date(d.getFullYear(), 0, 1);
        const dayOfYear = Math.floor((d - firstDay) / (24 * 60 * 60 * 1000));
        return Math.ceil((dayOfYear + firstDay.getDay() + 1) / 7);
    }
};

// ============================================
// ARRAY HELPERS
// ============================================

export const ArrayHelpers = {
    /**
     * Chunk array into smaller arrays
     */
    chunk(arr, size) {
        const result = [];
        for (let i = 0; i < arr.length; i += size) {
            result.push(arr.slice(i, i + size));
        }
        return result;
    },

    /**
     * Unique array values
     */
    unique(arr, key = null) {
        if (!key) return [...new Set(arr)];
        
        const seen = new Set();
        return arr.filter(item => {
            const value = typeof item === 'object' ? item[key] : item;
            if (seen.has(value)) return false;
            seen.add(value);
            return true;
        });
    },

    /**
     * Group array by key
     */
    groupBy(arr, key) {
        return arr.reduce((result, item) => {
            const groupKey = typeof item === 'object' ? item[key] : item;
            if (!result[groupKey]) result[groupKey] = [];
            result[groupKey].push(item);
            return result;
        }, {});
    },

    /**
     * Shuffle array (Fisher-Yates)
     */
    shuffle(arr) {
        const array = [...arr];
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    },

    /**
     * Move item in array
     */
    move(arr, fromIndex, toIndex) {
        const result = [...arr];
        const [movedItem] = result.splice(fromIndex, 1);
        result.splice(toIndex, 0, movedItem);
        return result;
    },

    /**
     * Insert item at index
     */
    insert(arr, index, item) {
        const result = [...arr];
        result.splice(index, 0, item);
        return result;
    },

    /**
     * Remove item by value or predicate
     */
    remove(arr, predicate) {
        const index = typeof predicate === 'function'
            ? arr.findIndex(predicate)
            : arr.indexOf(predicate);
        
        if (index === -1) return [...arr];
        
        const result = [...arr];
        result.splice(index, 1);
        return result;
    },

    /**
     * Toggle item in array
     */
    toggle(arr, item) {
        const index = arr.indexOf(item);
        if (index === -1) return [...arr, item];
        const result = [...arr];
        result.splice(index, 1);
        return result;
    },

    /**
     * Intersection of arrays
     */
    intersection(arr1, arr2) {
        return arr1.filter(item => arr2.includes(item));
    },

    /**
     * Difference of arrays
     */
    difference(arr1, arr2) {
        return arr1.filter(item => !arr2.includes(item));
    },

    /**
     * Union of arrays
     */
    union(arr1, arr2) {
        return [...new Set([...arr1, ...arr2])];
    },

    /**
     * Sum of array values
     */
    sum(arr, key = null) {
        if (key) {
            return arr.reduce((total, item) => total + (item[key] || 0), 0);
        }
        return arr.reduce((total, item) => total + (item || 0), 0);
    },

    /**
     * Average of array values
     */
    average(arr, key = null) {
        if (arr.length === 0) return 0;
        return this.sum(arr, key) / arr.length;
    },

    /**
     * Min value in array
     */
    min(arr, key = null) {
        if (arr.length === 0) return null;
        if (key) {
            return Math.min(...arr.map(item => item[key]));
        }
        return Math.min(...arr);
    },

    /**
     * Max value in array
     */
    max(arr, key = null) {
        if (arr.length === 0) return null;
        if (key) {
            return Math.max(...arr.map(item => item[key]));
        }
        return Math.max(...arr);
    }
};

// ============================================
// OBJECT HELPERS
// ============================================

export const ObjectHelpers = {
    /**
     * Deep clone object
     */
    deepClone(obj) {
        if (obj === null || typeof obj !== 'object') return obj;
        if (obj instanceof Date) return new Date(obj);
        if (obj instanceof RegExp) return new RegExp(obj);
        if (obj instanceof Map) return new Map(obj);
        if (obj instanceof Set) return new Set(obj);
        
        const clone = Array.isArray(obj) ? [] : {};
        for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
                clone[key] = this.deepClone(obj[key]);
            }
        }
        return clone;
    },

    /**
     * Merge objects deeply
     */
    deepMerge(target, ...sources) {
        if (!sources.length) return target;
        const source = sources.shift();
        
        if (this.isObject(target) && this.isObject(source)) {
            for (const key in source) {
                if (this.isObject(source[key])) {
                    if (!target[key]) Object.assign(target, { [key]: {} });
                    this.deepMerge(target[key], source[key]);
                } else {
                    Object.assign(target, { [key]: source[key] });
                }
            }
        }
        
        return this.deepMerge(target, ...sources);
    },

    /**
     * Check if value is object (not null, not array)
     */
    isObject(item) {
        return item && typeof item === 'object' && !Array.isArray(item);
    },

    /**
     * Check if object is empty
     */
    isEmpty(obj) {
        return obj && Object.keys(obj).length === 0 && obj.constructor === Object;
    },

    /**
     * Pick specific keys from object
     */
    pick(obj, keys) {
        return keys.reduce((result, key) => {
            if (obj.hasOwnProperty(key)) {
                result[key] = obj[key];
            }
            return result;
        }, {});
    },

    /**
     * Omit specific keys from object
     */
    omit(obj, keys) {
        const result = { ...obj };
        keys.forEach(key => delete result[key]);
        return result;
    },

    /**
     * Get nested property safely
     */
    get(obj, path, defaultValue = null) {
        const keys = path.split('.');
        let result = obj;
        
        for (const key of keys) {
            if (result === null || result === undefined || typeof result !== 'object') {
                return defaultValue;
            }
            result = result[key];
        }
        
        return result !== undefined ? result : defaultValue;
    },

    /**
     * Set nested property safely
     */
    set(obj, path, value) {
        const keys = path.split('.');
        let current = obj;
        
        for (let i = 0; i < keys.length - 1; i++) {
            if (!current[keys[i]] || typeof current[keys[i]] !== 'object') {
                current[keys[i]] = {};
            }
            current = current[keys[i]];
        }
        
        current[keys[keys.length - 1]] = value;
        return obj;
    },

    /**
     * Convert object to FormData
     */
    toFormData(obj, formData = new FormData(), parentKey = null) {
        for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
                const value = obj[key];
                const formKey = parentKey ? `${parentKey}[${key}]` : key;
                
                if (value instanceof File || value instanceof Blob) {
                    formData.append(formKey, value);
                } else if (Array.isArray(value)) {
                    value.forEach((item, index) => {
                        if (typeof item === 'object' && !(item instanceof File)) {
                            this.toFormData(item, formData, `${formKey}[${index}]`);
                        } else {
                            formData.append(`${formKey}[${index}]`, item);
                        }
                    });
                } else if (typeof value === 'object' && value !== null) {
                    this.toFormData(value, formData, formKey);
                } else {
                    formData.append(formKey, value);
                }
            }
        }
        return formData;
    },

    /**
     * Convert object to query string
     */
    toQueryString(obj) {
        const params = new URLSearchParams();
        for (const [key, value] of Object.entries(obj)) {
            if (value !== undefined && value !== null) {
                params.append(key, value);
            }
        }
        return params.toString();
    }
};

// ============================================
// COLOR HELPERS
// ============================================

export const ColorHelpers = {
    /**
     * Convert hex to RGB
     */
    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : null;
    },

    /**
     * Convert RGB to hex
     */
    rgbToHex(r, g, b) {
        return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
    },

    /**
     * Lighten color
     */
    lighten(color, percent) {
        const rgb = this.hexToRgb(color);
        if (!rgb) return color;
        
        const r = Math.min(255, rgb.r + (255 - rgb.r) * percent);
        const g = Math.min(255, rgb.g + (255 - rgb.g) * percent);
        const b = Math.min(255, rgb.b + (255 - rgb.b) * percent);
        
        return this.rgbToHex(r, g, b);
    },

    /**
     * Darken color
     */
    darken(color, percent) {
        const rgb = this.hexToRgb(color);
        if (!rgb) return color;
        
        const r = rgb.r * (1 - percent);
        const g = rgb.g * (1 - percent);
        const b = rgb.b * (1 - percent);
        
        return this.rgbToHex(r, g, b);
    },

    /**
     * Get contrasting text color (black or white)
     */
    getContrastColor(hex) {
        const rgb = this.hexToRgb(hex);
        if (!rgb) return '#000000';
        
        const brightness = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
        return brightness > 128 ? '#000000' : '#ffffff';
    },

    /**
     * Generate random color
     */
    randomColor() {
        const letters = '0123456789ABCDEF';
        let color = '#';
        for (let i = 0; i < 6; i++) {
            color += letters[Math.floor(Math.random() * 16)];
        }
        return color;
    },

    /**
     * Generate color palette from base color
     */
    generatePalette(baseColor, count = 5) {
        const colors = [];
        for (let i = 0; i < count; i++) {
            const percent = i / (count - 1);
            colors.push(this.lighten(baseColor, percent * 0.5));
        }
        return colors;
    }
};

// ============================================
// DOM HELPERS
// ============================================

export const DOMHelpers = {
    /**
     * Check if element is in viewport
     */
    isInViewport(element, offset = 0) {
        const rect = element.getBoundingClientRect();
        return (
            rect.top >= -offset &&
            rect.left >= -offset &&
            rect.bottom <= (window.innerHeight + offset) &&
            rect.right <= (window.innerWidth + offset)
        );
    },

    /**
     * Smooth scroll to element
     */
    scrollToElement(element, offset = 0, behavior = 'smooth') {
        const rect = element.getBoundingClientRect();
        const scrollTop = window.pageYOffset + rect.top - offset;
        window.scrollTo({ top: scrollTop, behavior });
    },

    /**
     * Get element dimensions
     */
    getDimensions(element) {
        const rect = element.getBoundingClientRect();
        return {
            width: rect.width,
            height: rect.height,
            top: rect.top,
            left: rect.left,
            right: rect.right,
            bottom: rect.bottom,
            x: rect.x,
            y: rect.y
        };
    },

    /**
     * Create element with attributes
     */
    createElement(tag, attributes = {}, children = []) {
        const element = document.createElement(tag);
        
        for (const [key, value] of Object.entries(attributes)) {
            if (key === 'className') {
                element.className = value;
            } else if (key === 'style' && typeof value === 'object') {
                Object.assign(element.style, value);
            } else {
                element.setAttribute(key, value);
            }
        }
        
        children.forEach(child => {
            if (typeof child === 'string') {
                element.appendChild(document.createTextNode(child));
            } else if (child instanceof Node) {
                element.appendChild(child);
            }
        });
        
        return element;
    },

    /**
     * Add multiple event listeners
     */
    addEvents(element, events) {
        const handlers = {};
        for (const [event, handler] of Object.entries(events)) {
            element.addEventListener(event, handler);
            handlers[event] = handler;
        }
        
        return () => {
            for (const [event, handler] of Object.entries(handlers)) {
                element.removeEventListener(event, handler);
            }
        };
    }
};

// ============================================
// STORAGE HELPERS
// ============================================

export const StorageHelpers = {
    /**
     * Set item with expiry
     */
    setWithExpiry(key, value, ttl) {
        const item = {
            value: value,
            expiry: Date.now() + ttl
        };
        localStorage.setItem(key, JSON.stringify(item));
    },

    /**
     * Get item with expiry check
     */
    getWithExpiry(key) {
        const item = localStorage.getItem(key);
        if (!item) return null;
        
        const parsed = JSON.parse(item);
        if (Date.now() > parsed.expiry) {
            localStorage.removeItem(key);
            return null;
        }
        
        return parsed.value;
    },

    /**
     * Clear all app storage
     */
    clearAppStorage() {
        const keys = [
            'estif_auth_token',
            'estif_refresh_token',
            'estif_user',
            'estif_settings',
            'estif_theme',
            'estif_language',
            'estif_devices',
            'estif_homes',
            'estif_session',
            'estif_config',
            'estif_offline_queue'
        ];
        
        keys.forEach(key => localStorage.removeItem(key));
    }
};

// ============================================
// EXPORT ALL HELPERS
// ============================================

const Helpers = {
    String: StringHelpers,
    Number: NumberHelpers,
    Date: DateHelpers,
    Array: ArrayHelpers,
    Object: ObjectHelpers,
    Color: ColorHelpers,
    DOM: DOMHelpers,
    Storage: StorageHelpers
};

// ============================================
// GLOBAL HELPER FUNCTIONS (Shortcuts)
// ============================================

// Expose to window
window.helpers = Helpers;
window.$helpers = Helpers;

// Convenience shortcuts
window.capitalize = StringHelpers.capitalize;
window.formatNumber = NumberHelpers.formatNumber;
window.formatDate = DateHelpers.formatDate;
window.timeAgo = DateHelpers.timeAgo;
window.deepClone = ObjectHelpers.deepClone;
window.randomColor = ColorHelpers.randomColor;

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Helpers;
}

// ES modules export
export {
    StringHelpers,
    NumberHelpers,
    DateHelpers,
    ArrayHelpers,
    ObjectHelpers,
    ColorHelpers,
    DOMHelpers,
    StorageHelpers,
    Helpers
};