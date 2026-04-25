/**
 * ESTIF HOME ULTIMATE - XSS PROTECTION MODULE
 * Cross-Site Scripting prevention with Content Security Policy and input filtering
 * Version: 2.0.0
 * Author: Estifanos Yohannis
 */

// ============================================
// XSS PROTECTION CONFIGURATION
// ============================================

const XSSConfig = {
    // Content Security Policy
    csp: {
        'default-src': ["'self'"],
        'script-src': ["'self'", "'unsafe-inline'", "'unsafe-eval'", 'https://cdn.jsdelivr.net'],
        'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        'font-src': ["'self'", 'https://fonts.gstatic.com', 'https://cdnjs.cloudflare.com'],
        'img-src': ["'self'", 'data:', 'https:', 'http:'],
        'connect-src': ["'self'", 'ws:', 'wss:', 'https://api.estif-home.com'],
        'frame-src': ["'none'"],
        'object-src': ["'none'"],
        'base-uri': ["'self'"],
        'form-action': ["'self'"]
    },
    
    // Trusted types policy
    enableTrustedTypes: true,
    
    // Sanitization
    stripTags: true,
    stripAttributes: true,
    
    // Debug
    debug: false
};

// ============================================
// XSS PROTECTION MANAGER
// ============================================

class XSSProtectionManager {
    constructor() {
        this.init();
    }

    init() {
        this.applyCSP();
        this.setupTrustedTypes();
        this.setupEventListeners();
        XSSConfig.debug && console.log('[XSS] Manager initialized');
    }

    // ============================================
    // CONTENT SECURITY POLICY
    // ============================================

    applyCSP() {
        const cspString = this.buildCSPString();
        const meta = document.createElement('meta');
        meta.httpEquiv = 'Content-Security-Policy';
        meta.content = cspString;
        document.head.appendChild(meta);
        
        XSSConfig.debug && console.log('[XSS] CSP applied');
    }

    buildCSPString() {
        const directives = [];
        for (const [directive, sources] of Object.entries(XSSConfig.csp)) {
            directives.push(`${directive} ${sources.join(' ')}`);
        }
        return directives.join('; ');
    }

    updateCSP(directive, sources) {
        XSSConfig.csp[directive] = sources;
        this.applyCSP();
    }

    // ============================================
    // TRUSTED TYPES
    // ============================================

    setupTrustedTypes() {
        if (!XSSConfig.enableTrustedTypes || !window.trustedTypes) return;
        
        try {
            const policy = trustedTypes.createPolicy('estif-policy', {
                createHTML: (input) => this.sanitizeHTML(input),
                createScriptURL: (input) => this.sanitizeURL(input),
                createScript: (input) => this.sanitizeScript(input)
            });
            
            window.trustedTypesPolicy = policy;
            XSSConfig.debug && console.log('[XSS] Trusted Types policy created');
        } catch (error) {
            console.error('[XSS] Failed to create Trusted Types policy:', error);
        }
    }

    sanitizeHTML(input) {
        // Remove script tags
        let sanitized = input.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
        // Remove event handlers
        sanitized = sanitized.replace(/on\w+="[^"]*"/g, '');
        sanitized = sanitized.replace(/on\w+='[^']*'/g, '');
        // Remove javascript: URLs
        sanitized = sanitized.replace(/javascript:/gi, '');
        return sanitized;
    }

    sanitizeURL(url) {
        if (url.toLowerCase().startsWith('javascript:')) {
            return 'about:blank';
        }
        return url;
    }

    sanitizeScript(script) {
        // Block potentially dangerous scripts
        const dangerousPatterns = [
            /document\.cookie/i,
            /window\.location/i,
            /eval\(/i,
            /Function\(/i,
            /setTimeout\(/i,
            /setInterval\(/i
        ];
        
        for (const pattern of dangerousPatterns) {
            if (pattern.test(script)) {
                return '';
            }
        }
        return script;
    }

    // ============================================
    // DOM SANITIZATION
    // ============================================

    sanitizeElement(element) {
        // Remove script tags
        const scripts = element.querySelectorAll('script');
        scripts.forEach(script => script.remove());
        
        // Remove event handlers
        const allElements = element.querySelectorAll('*');
        allElements.forEach(el => {
            for (const attr of el.attributes) {
                if (attr.name.toLowerCase().startsWith('on')) {
                    el.removeAttribute(attr.name);
                }
            }
        });
        
        // Sanitize href and src attributes
        const links = element.querySelectorAll('[href], [src]');
        links.forEach(link => {
            const href = link.getAttribute('href');
            if (href && href.toLowerCase().startsWith('javascript:')) {
                link.removeAttribute('href');
            }
            const src = link.getAttribute('src');
            if (src && src.toLowerCase().startsWith('javascript:')) {
                link.removeAttribute('src');
            }
        });
        
        return element;
    }

    // ============================================
    // INNERHTML/OUTERHTML PROTECTION
    // ============================================

    safeSetInnerHTML(element, html) {
        const sanitized = this.sanitizeHTML(html);
        if (window.trustedTypesPolicy) {
            element.innerHTML = window.trustedTypesPolicy.createHTML(sanitized);
        } else {
            element.innerHTML = sanitized;
        }
        this.sanitizeElement(element);
    }

    safeSetOuterHTML(element, html) {
        const sanitized = this.sanitizeHTML(html);
        if (window.trustedTypesPolicy) {
            element.outerHTML = window.trustedTypesPolicy.createHTML(sanitized);
        } else {
            element.outerHTML = sanitized;
        }
    }

    // ============================================
    // URL PROTECTION
    // ============================================

    safeSetHref(element, url) {
        const sanitized = this.sanitizeURL(url);
        element.href = sanitized;
    }

    safeSetSrc(element, url) {
        const sanitized = this.sanitizeURL(url);
        element.src = sanitized;
    }

    // ============================================
    // EVENT LISTENERS
    // ============================================

    setupEventListeners() {
        // Block dynamically created script tags
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === 1 && node.tagName === 'SCRIPT') {
                        node.remove();
                    }
                });
            });
        });
        
        observer.observe(document.body, { childList: true, subtree: true });
    }

    // ============================================
    // INPUT SANITIZATION
    // ============================================

    sanitizeInput(input) {
        if (typeof input !== 'string') return input;
        
        let sanitized = input;
        
        if (XSSConfig.stripTags) {
            sanitized = sanitized.replace(/<[^>]*>/g, '');
        }
        
        if (XSSConfig.stripAttributes) {
            sanitized = sanitized.replace(/on\w+="[^"]*"/g, '');
            sanitized = sanitized.replace(/on\w+='[^']*'/g, '');
        }
        
        // Remove javascript: protocol
        sanitized = sanitized.replace(/javascript:/gi, '');
        
        // Remove data: protocol (except images)
        sanitized = sanitized.replace(/data:(?!image)/gi, '');
        
        return sanitized;
    }

    // ============================================
    // COOKIE PROTECTION
    // ============================================

    secureCookies() {
        document.cookie = `HttpOnly; Secure; SameSite=Strict`;
    }

    // ============================================
    // HEADERS
    // ============================================

    getSecurityHeaders() {
        return {
            'X-XSS-Protection': '1; mode=block',
            'X-Content-Type-Options': 'nosniff',
            'X-Frame-Options': 'DENY',
            'Referrer-Policy': 'strict-origin-when-cross-origin',
            'Permissions-Policy': 'geolocation=(), microphone=(), camera=()'
        };
    }
}

// ============================================
// CREATE SINGLETON INSTANCE
// ============================================

const xssProtection = new XSSProtectionManager();

// Exports
window.xssProtection = xssProtection;
window.XSSProtectionManager = XSSProtectionManager;

export { xssProtection, XSSProtectionManager, XSSConfig };