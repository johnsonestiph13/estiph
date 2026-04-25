/**
 * ESTIF HOME ULTIMATE - STORAGE UTILITIES
 * Secure local storage with encryption, expiration, and namespacing
 * Version: 2.0.0
 * Author: Estifanos Yohannis
 */

// ============================================
// STORAGE CONFIGURATION
// ============================================

const StorageConfig = {
    prefix: 'estif_',
    version: 'v2',
    enableEncryption: false,
    defaultTTL: 86400000, // 24 hours
    maxSize: 5 * 1024 * 1024, // 5MB
    debug: false
};

// ============================================
// STORAGE MANAGER
// ============================================

class StorageManager {
    constructor(namespace = 'global') {
        this.namespace = namespace;
        this.prefix = `${StorageConfig.prefix}${StorageConfig.version}_${namespace}_`;
        this.memoryCache = new Map();
        this.init();
    }

    init() {
        this.checkStorageQuota();
        this.loadMemoryCache();
        StorageConfig.debug && console.log(`[Storage] Initialized namespace: ${this.namespace}`);
    }

    getKey(key) {
        return `${this.prefix}${key}`;
    }

    // ============================================
    // CRUD OPERATIONS
    // ============================================

    set(key, value, options = {}) {
        const ttl = options.ttl || StorageConfig.defaultTTL;
        const data = {
            value: this.encodeValue(value),
            createdAt: Date.now(),
            expiresAt: Date.now() + ttl,
            version: StorageConfig.version
        };
        
        try {
            const serialized = JSON.stringify(data);
            localStorage.setItem(this.getKey(key), serialized);
            this.memoryCache.set(key, data);
            StorageConfig.debug && console.log(`[Storage] Set: ${key}`);
            return true;
        } catch (error) {
            console.error('[Storage] Set failed:', error);
            this.handleQuotaError();
            return false;
        }
    }

    get(key, defaultValue = null) {
        // Check memory cache first
        if (this.memoryCache.has(key)) {
            const cached = this.memoryCache.get(key);
            if (!this.isExpired(cached)) {
                return this.decodeValue(cached.value);
            }
            this.memoryCache.delete(key);
        }
        
        // Check localStorage
        const item = localStorage.getItem(this.getKey(key));
        if (!item) return defaultValue;
        
        try {
            const data = JSON.parse(item);
            if (this.isExpired(data)) {
                this.remove(key);
                return defaultValue;
            }
            
            this.memoryCache.set(key, data);
            return this.decodeValue(data.value);
        } catch (error) {
            console.error('[Storage] Get failed:', error);
            return defaultValue;
        }
    }

    remove(key) {
        localStorage.removeItem(this.getKey(key));
        this.memoryCache.delete(key);
        StorageConfig.debug && console.log(`[Storage] Removed: ${key}`);
        return true;
    }

    clear() {
        const keys = this.getAllKeys();
        keys.forEach(key => this.remove(key));
        StorageConfig.debug && console.log(`[Storage] Cleared namespace: ${this.namespace}`);
    }

    has(key) {
        return localStorage.getItem(this.getKey(key)) !== null;
    }

    // ============================================
    // BATCH OPERATIONS
    // ============================================

    setMultiple(items) {
        const results = {};
        for (const [key, value] of Object.entries(items)) {
            results[key] = this.set(key, value);
        }
        return results;
    }

    getMultiple(keys) {
        const results = {};
        for (const key of keys) {
            results[key] = this.get(key);
        }
        return results;
    }

    removeMultiple(keys) {
        keys.forEach(key => this.remove(key));
    }

    // ============================================
    // QUERY METHODS
    // ============================================

    getAllKeys() {
        const keys = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith(this.prefix)) {
                keys.push(key.replace(this.prefix, ''));
            }
        }
        return keys;
    }

    getAll() {
        const result = {};
        const keys = this.getAllKeys();
        for (const key of keys) {
            result[key] = this.get(key);
        }
        return result;
    }

    getSize() {
        let total = 0;
        const keys = this.getAllKeys();
        for (const key of keys) {
            const item = localStorage.getItem(this.getKey(key));
            if (item) total += item.length;
        }
        return total;
    }

    // ============================================
    // EXPIRY MANAGEMENT
    // ============================================

    isExpired(data) {
        return data.expiresAt && Date.now() > data.expiresAt;
    }

    cleanExpired() {
        const keys = this.getAllKeys();
        let cleaned = 0;
        for (const key of keys) {
            const item = localStorage.getItem(this.getKey(key));
            if (item) {
                try {
                    const data = JSON.parse(item);
                    if (this.isExpired(data)) {
                        this.remove(key);
                        cleaned++;
                    }
                } catch (e) {}
            }
        }
        StorageConfig.debug && console.log(`[Storage] Cleaned ${cleaned} expired items`);
        return cleaned;
    }

    // ============================================
    // ENCODING/DECODING
    // ============================================

    encodeValue(value) {
        if (StorageConfig.enableEncryption && window.encryptionManager) {
            return window.encryptionManager.encryptString(JSON.stringify(value));
        }
        return value;
    }

    decodeValue(value) {
        if (StorageConfig.enableEncryption && window.encryptionManager && typeof value === 'string') {
            try {
                return JSON.parse(window.encryptionManager.decryptString(value));
            } catch {
                return value;
            }
        }
        return value;
    }

    // ============================================
    // QUOTA MANAGEMENT
    // ============================================

    checkStorageQuota() {
        const currentSize = this.getSize();
        if (currentSize > StorageConfig.maxSize) {
            console.warn(`[Storage] Quota warning: ${currentSize} / ${StorageConfig.maxSize} bytes`);
            this.cleanExpired();
        }
    }

    handleQuotaError() {
        this.cleanExpired();
        if (this.getSize() > StorageConfig.maxSize) {
            console.error('[Storage] Storage quota exceeded. Clearing old items...');
            const keys = this.getAllKeys();
            const toRemove = keys.slice(0, Math.floor(keys.length / 2));
            toRemove.forEach(key => this.remove(key));
        }
    }

    // ============================================
    // MEMORY CACHE
    // ============================================

    loadMemoryCache() {
        const keys = this.getAllKeys();
        for (const key of keys) {
            const item = localStorage.getItem(this.getKey(key));
            if (item) {
                try {
                    const data = JSON.parse(item);
                    if (!this.isExpired(data)) {
                        this.memoryCache.set(key, data);
                    }
                } catch (e) {}
            }
        }
    }

    clearMemoryCache() {
        this.memoryCache.clear();
    }

    // ============================================
    // UTILITY
    // ============================================

    getNamespace() {
        return this.namespace;
    }

    getStats() {
        return {
            namespace: this.namespace,
            itemCount: this.getAllKeys().length,
            totalSize: this.getSize(),
            memoryCacheSize: this.memoryCache.size,
            maxSize: StorageConfig.maxSize
        };
    }
}

// ============================================
// SESSION STORAGE MANAGER
// ============================================

class SessionStorageManager {
    constructor(namespace = 'global') {
        this.namespace = namespace;
        this.prefix = `${StorageConfig.prefix}${StorageConfig.version}_${namespace}_`;
    }

    getKey(key) {
        return `${this.prefix}${key}`;
    }

    set(key, value) {
        try {
            sessionStorage.setItem(this.getKey(key), JSON.stringify(value));
            return true;
        } catch (error) {
            console.error('[SessionStorage] Set failed:', error);
            return false;
        }
    }

    get(key, defaultValue = null) {
        const item = sessionStorage.getItem(this.getKey(key));
        if (!item) return defaultValue;
        try {
            return JSON.parse(item);
        } catch {
            return defaultValue;
        }
    }

    remove(key) {
        sessionStorage.removeItem(this.getKey(key));
    }

    clear() {
        const keys = [];
        for (let i = 0; i < sessionStorage.length; i++) {
            const key = sessionStorage.key(i);
            if (key && key.startsWith(this.prefix)) {
                keys.push(key);
            }
        }
        keys.forEach(key => sessionStorage.removeItem(key));
    }

    has(key) {
        return sessionStorage.getItem(this.getKey(key)) !== null;
    }

    getAllKeys() {
        const keys = [];
        for (let i = 0; i < sessionStorage.length; i++) {
            const key = sessionStorage.key(i);
            if (key && key.startsWith(this.prefix)) {
                keys.push(key.replace(this.prefix, ''));
            }
        }
        return keys;
    }
}

// ============================================
// COOKIE MANAGER
// ============================================

class CookieManager {
    static set(name, value, options = {}) {
        const cookieOptions = {
            path: '/',
            ...options
        };
        
        let cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}`;
        
        if (cookieOptions.expires) {
            const expires = typeof cookieOptions.expires === 'object' 
                ? cookieOptions.expires 
                : new Date(Date.now() + cookieOptions.expires);
            cookie += `; expires=${expires.toUTCString()}`;
        }
        
        if (cookieOptions.path) cookie += `; path=${cookieOptions.path}`;
        if (cookieOptions.domain) cookie += `; domain=${cookieOptions.domain}`;
        if (cookieOptions.secure) cookie += `; secure`;
        if (cookieOptions.sameSite) cookie += `; samesite=${cookieOptions.sameSite}`;
        
        document.cookie = cookie;
    }

    static get(name) {
        const cookieName = `${encodeURIComponent(name)}=`;
        const cookie = document.cookie.split(';').find(c => c.trim().startsWith(cookieName));
        if (cookie) {
            return decodeURIComponent(cookie.trim().substring(cookieName.length));
        }
        return null;
    }

    static remove(name, options = {}) {
        this.set(name, '', { ...options, expires: -1 });
    }

    static exists(name) {
        return this.get(name) !== null;
    }

    static getAll() {
        const cookies = {};
        document.cookie.split(';').forEach(cookie => {
            const [name, value] = cookie.trim().split('=');
            if (name && value) {
                cookies[decodeURIComponent(name)] = decodeURIComponent(value);
            }
        });
        return cookies;
    }

    static clear() {
        const cookies = this.getAll();
        Object.keys(cookies).forEach(name => this.remove(name));
    }
}

// ============================================
// CREATE SINGLETON INSTANCES
// ============================================

const storage = new StorageManager('app');
const sessionStorage = new SessionStorageManager('app');

// Expose globally
window.storage = storage;
window.sessionStorageManager = sessionStorage;
window.CookieManager = CookieManager;

export { storage, sessionStorage, CookieManager, StorageManager, SessionStorageManager, StorageConfig };