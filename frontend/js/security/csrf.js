/**
 * ESTIF HOME ULTIMATE - CSRF PROTECTION MODULE
 * Cross-Site Request Forgery protection with tokens and double-submit cookies
 * Version: 2.0.0
 * Author: Estifanos Yohannis
 */

// ============================================
// CSRF CONFIGURATION
// ============================================

const CSRFConfig = {
    // Token settings
    tokenHeader: 'X-CSRF-Token',
    tokenCookie: 'csrf_token',
    tokenLength: 32,
    tokenExpiry: 3600000, // 1 hour
    
    // Request methods to protect
    protectedMethods: ['POST', 'PUT', 'PATCH', 'DELETE'],
    
    // Storage
    storageKey: 'estif_csrf_token',
    
    // Debug
    debug: false
};

// ============================================
// CSRF MANAGER
// ============================================

class CSRFManager {
    constructor() {
        this.currentToken = null;
        this.tokenExpiry = null;
        this.init();
    }

    init() {
        this.loadOrGenerateToken();
        this.setupFetchInterceptor();
        CSRFConfig.debug && console.log('[CSRF] Manager initialized');
    }

    loadOrGenerateToken() {
        try {
            // Try to load from storage
            const saved = localStorage.getItem(CSRFConfig.storageKey);
            if (saved) {
                const data = JSON.parse(saved);
                if (Date.now() < data.expiry) {
                    this.currentToken = data.token;
                    this.tokenExpiry = data.expiry;
                    CSRFConfig.debug && console.log('[CSRF] Token loaded');
                    return;
                }
            }
        } catch (error) {
            console.error('[CSRF] Failed to load token:', error);
        }
        
        // Generate new token
        this.generateToken();
    }

    generateToken() {
        const array = new Uint8Array(CSRFConfig.tokenLength);
        crypto.getRandomValues(array);
        this.currentToken = btoa(String.fromCharCode.apply(null, array));
        this.tokenExpiry = Date.now() + CSRFConfig.tokenExpiry;
        
        // Save to storage
        localStorage.setItem(CSRFConfig.storageKey, JSON.stringify({
            token: this.currentToken,
            expiry: this.tokenExpiry
        }));
        
        // Set cookie for double-submit
        this.setCookie(CSRFConfig.tokenCookie, this.currentToken, CSRFConfig.tokenExpiry / 1000);
        
        CSRFConfig.debug && console.log('[CSRF] Token generated');
    }

    refreshToken() {
        this.generateToken();
        CSRFConfig.debug && console.log('[CSRF] Token refreshed');
    }

    getToken() {
        // Check if token expired
        if (Date.now() > this.tokenExpiry) {
            this.generateToken();
        }
        return this.currentToken;
    }

    // ============================================
    // COOKIE MANAGEMENT
    // ============================================

    setCookie(name, value, maxAgeSeconds) {
        const cookie = `${name}=${value}; path=/; SameSite=Strict`;
        if (maxAgeSeconds) {
            document.cookie = `${cookie}; max-age=${maxAgeSeconds}`;
        } else {
            document.cookie = cookie;
        }
    }

    getCookie(name) {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) return parts.pop().split(';').shift();
        return null;
    }

    deleteCookie(name) {
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
    }

    // ============================================
    // REQUEST INTERCEPTOR
    // ============================================

    setupFetchInterceptor() {
        const originalFetch = window.fetch;
        
        window.fetch = async (url, options = {}) => {
            const method = (options.method || 'GET').toUpperCase();
            
            // Add CSRF token to protected methods
            if (CSRFConfig.protectedMethods.includes(method)) {
                options.headers = {
                    ...options.headers,
                    [CSRFConfig.tokenHeader]: this.getToken()
                };
            }
            
            const response = await originalFetch(url, options);
            
            // Check if token was rejected
            if (response.status === 403 && response.headers.get('X-CSRF-Error')) {
                this.refreshToken();
                // Retry request with new token
                options.headers[CSRFConfig.tokenHeader] = this.getToken();
                return originalFetch(url, options);
            }
            
            return response;
        };
    }

    // ============================================
    // VALIDATION
    // ============================================

    validateToken(token) {
        return token === this.currentToken;
    }

    validateDoubleSubmit() {
        const cookieToken = this.getCookie(CSRFConfig.tokenCookie);
        return cookieToken === this.currentToken;
    }

    // ============================================
    // FORM PROTECTION
    // ============================================

    addTokenToForm(form) {
        let input = form.querySelector(`input[name="${CSRFConfig.tokenHeader}"]`);
        if (!input) {
            input = document.createElement('input');
            input.type = 'hidden';
            input.name = CSRFConfig.tokenHeader;
            form.appendChild(input);
        }
        input.value = this.getToken();
    }

    protectForms() {
        document.querySelectorAll('form').forEach(form => {
            this.addTokenToForm(form);
        });
        
        // Watch for dynamically added forms
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === 1 && node.tagName === 'FORM') {
                        this.addTokenToForm(node);
                    }
                });
            });
        });
        
        observer.observe(document.body, { childList: true, subtree: true });
    }

    // ============================================
    // AJAX PROTECTION
    // ============================================

    getCSRFHeaders() {
        return {
            [CSRFConfig.tokenHeader]: this.getToken()
        };
    }

    addToXMLHttpRequest(xhr) {
        xhr.setRequestHeader(CSRFConfig.tokenHeader, this.getToken());
    }

    // ============================================
    // UTILITY
    // ============================================

    reset() {
        this.deleteCookie(CSRFConfig.tokenCookie);
        localStorage.removeItem(CSRFConfig.storageKey);
        this.generateToken();
    }
}

// ============================================
// CREATE SINGLETON INSTANCE
// ============================================

const csrfManager = new CSRFManager();

// Auto-protect forms on load
if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        csrfManager.protectForms();
    });
}

// Exports
window.csrfManager = csrfManager;
window.CSRFManager = CSRFManager;

export { csrfManager, CSRFManager, CSRFConfig };