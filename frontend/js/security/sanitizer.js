/**
 * ESTIF HOME ULTIMATE - SANITIZER MODULE
 * Input sanitization and output encoding for XSS prevention
 * Version: 2.0.0
 * Author: Estifanos Yohannis
 */

// ============================================
// SANITIZER CONFIGURATION
// ============================================

const SanitizerConfig = {
    // Allowed tags for HTML sanitization
    allowedTags: ['b', 'i', 'em', 'strong', 'a', 'br', 'p', 'ul', 'ol', 'li'],
    allowedAttributes: ['href', 'target', 'rel'],
    
    // Maximum input length
    maxInputLength: 10000,
    
    // Debug
    debug: false
};

// ============================================
// SANITIZER MANAGER
// ============================================

class SanitizerManager {
    constructor() {
        this.init();
    }

    init() {
        SanitizerConfig.debug && console.log('[Sanitizer] Manager initialized');
    }

    // ============================================
    // HTML SANITIZATION
    // ============================================

    sanitizeHtml(html) {
        if (!html || typeof html !== 'string') return '';
        
        // Create a temporary DOM element
        const temp = document.createElement('div');
        temp.textContent = html;
        let sanitized = temp.innerHTML;
        
        // Remove script tags
        sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
        
        // Remove event handlers
        sanitized = sanitized.replace(/on\w+="[^"]*"/g, '');
        sanitized = sanitized.replace(/on\w+='[^']*'/g, '');
        
        // Remove javascript: URLs
        sanitized = sanitized.replace(/javascript:/gi, '');
        
        // Remove data: URLs except images
        sanitized = sanitized.replace(/data:(?!image)/gi, '');
        
        return sanitized;
    }

    sanitizeText(text) {
        if (!text || typeof text !== 'string') return '';
        
        // Limit length
        if (text.length > SanitizerConfig.maxInputLength) {
            text = text.substring(0, SanitizerConfig.maxInputLength);
        }
        
        // Remove control characters
        text = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
        
        return text;
    }

    // ============================================
    // OUTPUT ENCODING
    // ============================================

    encodeHtml(str) {
        if (!str || typeof str !== 'string') return '';
        
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;')
            .replace(/\//g, '&#x2F;');
    }

    encodeAttribute(str) {
        if (!str || typeof str !== 'string') return '';
        
        return str
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    encodeUrl(url) {
        if (!url || typeof url !== 'string') return '';
        
        return encodeURIComponent(url).replace(/[!'()*]/g, (c) => {
            return '%' + c.charCodeAt(0).toString(16);
        });
    }

    // ============================================
    // INPUT VALIDATION
    // ============================================

    isValidEmail(email) {
        const regex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        return regex.test(email);
    }

    isValidPhone(phone) {
        const regex = /^[\+]?[(]?[0-9]{1,4}[)]?[-\s\.]?[(]?[0-9]{1,4}[)]?[-\s\.]?[0-9]{1,9}$/;
        return regex.test(phone);
    }

    isValidUrl(url) {
        try {
            new URL(url);
            return true;
        } catch {
            return false;
        }
    }

    isValidIp(ip) {
        const ipv4Regex = /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
        const ipv6Regex = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/;
        return ipv4Regex.test(ip) || ipv6Regex.test(ip);
    }

    // ============================================
    // JSON SANITIZATION
    // ============================================

    sanitizeObject(obj, maxDepth = 5, currentDepth = 0) {
        if (currentDepth > maxDepth) return null;
        
        if (typeof obj === 'string') {
            return this.sanitizeText(obj);
        } else if (typeof obj === 'number') {
            return isFinite(obj) ? obj : 0;
        } else if (typeof obj === 'boolean') {
            return obj;
        } else if (Array.isArray(obj)) {
            return obj.map(item => this.sanitizeObject(item, maxDepth, currentDepth + 1));
        } else if (obj && typeof obj === 'object') {
            const result = {};
            for (const [key, value] of Object.entries(obj)) {
                const sanitizedKey = this.sanitizeText(key);
                result[sanitizedKey] = this.sanitizeObject(value, maxDepth, currentDepth + 1);
            }
            return result;
        }
        
        return null;
    }

    // ============================================
    // SQL INJECTION PREVENTION
    // ============================================

    escapeSqlString(str) {
        if (!str || typeof str !== 'string') return '';
        
        return str
            .replace(/'/g, "''")
            .replace(/\\/g, '\\\\')
            .replace(/\0/g, '\\0')
            .replace(/\n/g, '\\n')
            .replace(/\r/g, '\\r')
            .replace(/\x1a/g, '\\Z');
    }

    // ============================================
    // COMMAND INJECTION PREVENTION
    // ============================================

    escapeShellArg(arg) {
        if (!arg || typeof arg !== 'string') return '';
        
        // Remove shell metacharacters
        return arg.replace(/[&|;`$<>(){}\[\]\\]/g, '');
    }

    // ============================================
    // COMPREHENSIVE SANITIZATION
    // ============================================

    sanitize(input, type = 'string') {
        switch (type) {
            case 'html':
                return this.sanitizeHtml(input);
            case 'text':
                return this.sanitizeText(input);
            case 'email':
                const email = this.sanitizeText(input);
                return this.isValidEmail(email) ? email : '';
            case 'phone':
                const phone = this.sanitizeText(input);
                return this.isValidPhone(phone) ? phone : '';
            case 'url':
                const url = this.sanitizeText(input);
                return this.isValidUrl(url) ? url : '';
            case 'ip':
                const ip = this.sanitizeText(input);
                return this.isValidIp(ip) ? ip : '';
            case 'object':
                return this.sanitizeObject(input);
            default:
                return this.sanitizeText(input);
        }
    }
}

// ============================================
// CREATE SINGLETON INSTANCE
// ============================================

const sanitizer = new SanitizerManager();

// Exports
window.sanitizer = sanitizer;
window.SanitizerManager = SanitizerManager;

export { sanitizer, SanitizerManager, SanitizerConfig };