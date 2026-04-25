/**
 * ESTIF HOME ULTIMATE - CONFIGURATION MODULE
 * Centralized configuration management with environment support
 * Version: 2.0.0
 * Author: Estifanos Yohannis
 */

// ============================================
// ENVIRONMENT DETECTION
// ============================================

const Environment = {
    DEVELOPMENT: 'development',
    STAGING: 'staging',
    PRODUCTION: 'production',
    TEST: 'test'
};

const detectEnvironment = () => {
    const hostname = window.location.hostname;
    const url = window.location.href;
    
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return Environment.DEVELOPMENT;
    }
    
    if (url.includes('staging') || hostname.includes('staging')) {
        return Environment.STAGING;
    }
    
    if (url.includes('test') || hostname.includes('test')) {
        return Environment.TEST;
    }
    
    return Environment.PRODUCTION;
};

// ============================================
// CONFIGURATION MANAGER
// ============================================

class ConfigManager {
    constructor() {
        this.config = null;
        this.env = detectEnvironment();
        this.listeners = [];
        this.init();
    }

    init() {
        this.loadConfig();
        this.setupEventListeners();
        Config.debug && console.log(`[Config] Initialized in ${this.env} mode`);
    }

    loadConfig() {
        // Default configuration
        const defaultConfig = {
            // App Info
            app: {
                name: 'Estif Home Ultimate',
                version: '2.0.0',
                build: process.env.BUILD_NUMBER || 'dev',
                releaseDate: '2024-01-01'
            },
            
            // Environment
            env: this.env,
            debug: this.env === Environment.DEVELOPMENT,
            
            // API Configuration
            api: {
                baseURL: this.getApiBaseURL(),
                timeout: 30000,
                retryAttempts: 3,
                retryDelay: 1000
            },
            
            // WebSocket Configuration
            websocket: {
                url: this.getWebSocketURL(),
                reconnect: true,
                reconnectAttempts: 10,
                reconnectDelay: 1000,
                heartbeatInterval: 25000
            },
            
            // MQTT Configuration
            mqtt: {
                brokerUrl: this.getMQTTBrokerURL(),
                clientId: null,
                username: null,
                password: null,
                keepAlive: 60
            },
            
            // WebRTC Configuration
            webrtc: {
                signalingServer: this.getSignalingServer(),
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' },
                    { urls: 'stun:stun2.l.google.com:19302' }
                ]
            },
            
            // Firebase Configuration (Optional)
            firebase: {
                apiKey: null,
                authDomain: null,
                projectId: null,
                storageBucket: null,
                messagingSenderId: null,
                appId: null
            },
            
            // Google APIs
            google: {
                geminiApiKey: null,
                mapsApiKey: null
            },
            
            // Features
            features: {
                voiceControl: true,
                biometricAuth: true,
                twoFactorAuth: true,
                oauthLogin: true,
                offlineMode: true,
                darkMode: true,
                multiLanguage: true,
                pushNotifications: true,
                energyAnalytics: true,
                automation: true,
                backupRestore: true
            },
            
            // Limits
            limits: {
                maxDevices: 50,
                maxHomes: 10,
                maxMembersPerHome: 20,
                maxAutomations: 100,
                maxFileSize: 10 * 1024 * 1024, // 10MB
                maxRetryAttempts: 3
            },
            
            // UI Configuration
            ui: {
                defaultTheme: 'light',
                defaultLanguage: 'en',
                itemsPerPage: 20,
                dateFormat: 'YYYY-MM-DD',
                timeFormat: 'HH:mm',
                animations: true,
                toastDuration: 3000,
                modalAnimation: true
            },
            
            // Security
            security: {
                sessionTimeout: 86400000, // 24 hours
                idleTimeout: 1800000, // 30 minutes
                maxLoginAttempts: 5,
                lockoutDuration: 900000, // 15 minutes
                passwordMinLength: 8,
                requireSpecialChar: true,
                requireNumber: true,
                requireUppercase: true
            },
            
            // Storage Keys
            storage: {
                authToken: 'estif_auth_token',
                refreshToken: 'estif_refresh_token',
                user: 'estif_user',
                settings: 'estif_settings',
                theme: 'estif_theme',
                language: 'estif_language',
                devices: 'estif_devices',
                homes: 'estif_homes'
            },
            
            // Analytics
            analytics: {
                enabled: true,
                provider: 'self-hosted', // 'self-hosted', 'google', 'mixpanel'
                trackingId: null
            },
            
            // Error Tracking
            sentry: {
                dsn: null,
                enabled: false,
                environment: this.env
            },
            
            // PWA Configuration
            pwa: {
                enabled: true,
                cacheVersion: 'v1',
                offlinePage: '/offline.html'
            }
        };
        
        // Load environment specific overrides
        const envConfig = this.loadEnvConfig();
        
        // Load local storage overrides
        const localConfig = this.loadLocalConfig();
        
        // Merge configurations
        this.config = this.mergeDeep(defaultConfig, envConfig, localConfig);
        
        // Apply runtime overrides from URL parameters
        this.applyUrlOverrides();
    }
    
    getApiBaseURL() {
        if (this.env === Environment.DEVELOPMENT) {
            return 'http://localhost:3000/api/v1';
        }
        if (this.env === Environment.STAGING) {
            return 'https://api.staging.estif-home.com/api/v1';
        }
        if (this.env === Environment.PRODUCTION) {
            return 'https://api.estif-home.com/api/v1';
        }
        return '/api/v1';
    }
    
    getWebSocketURL() {
        if (this.env === Environment.DEVELOPMENT) {
            return 'ws://localhost:3000/socket.io';
        }
        if (this.env === Environment.STAGING) {
            return 'wss://api.staging.estif-home.com/socket.io';
        }
        if (this.env === Environment.PRODUCTION) {
            return 'wss://api.estif-home.com/socket.io';
        }
        return '/socket.io';
    }
    
    getMQTTBrokerURL() {
        if (this.env === Environment.DEVELOPMENT) {
            return 'ws://localhost:8084';
        }
        if (this.env === Environment.STAGING) {
            return 'wss://mqtt.staging.estif-home.com:8084';
        }
        if (this.env === Environment.PRODUCTION) {
            return 'wss://mqtt.estif-home.com:8084';
        }
        return null;
    }
    
    getSignalingServer() {
        if (this.env === Environment.DEVELOPMENT) {
            return 'ws://localhost:3001';
        }
        if (this.env === Environment.STAGING) {
            return 'wss://signaling.staging.estif-home.com';
        }
        if (this.env === Environment.PRODUCTION) {
            return 'wss://signaling.estif-home.com';
        }
        return null;
    }
    
    loadEnvConfig() {
        // Try to load from window.__ENV__ (injected by server)
        if (window.__ENV__) {
            return window.__ENV__;
        }
        
        // Try to load from meta tags
        const metaConfig = {};
        const metaTags = document.querySelectorAll('meta[name^="config:"]');
        metaTags.forEach(meta => {
            const key = meta.getAttribute('name').replace('config:', '');
            metaConfig[key] = meta.getAttribute('content');
        });
        
        return metaConfig;
    }
    
    loadLocalConfig() {
        try {
            const saved = localStorage.getItem('estif_config');
            if (saved) {
                return JSON.parse(saved);
            }
        } catch (error) {
            Config.debug && console.log('[Config] Failed to load local config');
        }
        return {};
    }
    
    applyUrlOverrides() {
        const urlParams = new URLSearchParams(window.location.search);
        
        // Override debug mode
        if (urlParams.has('debug')) {
            this.config.debug = urlParams.get('debug') === 'true';
        }
        
        // Override theme
        if (urlParams.has('theme')) {
            this.config.ui.defaultTheme = urlParams.get('theme');
        }
        
        // Override language
        if (urlParams.has('lang')) {
            this.config.ui.defaultLanguage = urlParams.get('lang');
        }
    }
    
    mergeDeep(target, ...sources) {
        if (!sources.length) return target;
        const source = sources.shift();
        
        if (this.isObject(target) && this.isObject(source)) {
            for (const key in source) {
                if (this.isObject(source[key])) {
                    if (!target[key]) Object.assign(target, { [key]: {} });
                    this.mergeDeep(target[key], source[key]);
                } else {
                    Object.assign(target, { [key]: source[key] });
                }
            }
        }
        
        return this.mergeDeep(target, ...sources);
    }
    
    isObject(item) {
        return item && typeof item === 'object' && !Array.isArray(item);
    }
    
    setupEventListeners() {
        // Listen for storage events to sync config across tabs
        window.addEventListener('storage', (event) => {
            if (event.key === 'estif_config') {
                this.reload();
            }
        });
    }
    
    // ============================================
    // PUBLIC METHODS
    // ============================================
    
    get(key, defaultValue = null) {
        const keys = key.split('.');
        let value = this.config;
        
        for (const k of keys) {
            if (value && typeof value === 'object' && k in value) {
                value = value[k];
            } else {
                return defaultValue;
            }
        }
        
        return value !== undefined ? value : defaultValue;
    }
    
    set(key, value, saveToStorage = false) {
        const keys = key.split('.');
        let current = this.config;
        
        for (let i = 0; i < keys.length - 1; i++) {
            if (!current[keys[i]]) {
                current[keys[i]] = {};
            }
            current = current[keys[i]];
        }
        
        current[keys[keys.length - 1]] = value;
        
        if (saveToStorage) {
            this.saveToLocalStorage();
        }
        
        this.notifyListeners(key, value);
    }
    
    saveToLocalStorage() {
        try {
            localStorage.setItem('estif_config', JSON.stringify(this.config));
        } catch (error) {
            Config.debug && console.log('[Config] Failed to save config');
        }
    }
    
    reload() {
        this.loadConfig();
        this.notifyListeners('*', this.config);
        Config.debug && console.log('[Config] Reloaded');
    }
    
    reset() {
        this.loadConfig();
        localStorage.removeItem('estif_config');
        this.notifyListeners('*', this.config);
        Config.debug && console.log('[Config] Reset to defaults');
    }
    
    // ============================================
    // FEATURE FLAGS
    // ============================================
    
    isFeatureEnabled(feature) {
        return this.get(`features.${feature}`, false);
    }
    
    enableFeature(feature) {
        this.set(`features.${feature}`, true);
    }
    
    disableFeature(feature) {
        this.set(`features.${feature}`, false);
    }
    
    // ============================================
    // ENVIRONMENT HELPERS
    // ============================================
    
    isDevelopment() {
        return this.env === Environment.DEVELOPMENT;
    }
    
    isStaging() {
        return this.env === Environment.STAGING;
    }
    
    isProduction() {
        return this.env === Environment.PRODUCTION;
    }
    
    isTest() {
        return this.env === Environment.TEST;
    }
    
    isDebug() {
        return this.get('debug', false);
    }
    
    // ============================================
    // API HELPERS
    // ============================================
    
    getApiUrl(endpoint = '') {
        const baseURL = this.get('api.baseURL');
        return `${baseURL}${endpoint}`;
    }
    
    getWebSocketUrl() {
        return this.get('websocket.url');
    }
    
    getMQTTBrokerUrl() {
        return this.get('mqtt.brokerUrl');
    }
    
    // ============================================
    // STORAGE HELPERS
    // ============================================
    
    getStorageKey(key) {
        return this.get(`storage.${key}`, key);
    }
    
    // ============================================
    // EVENT SYSTEM
    // ============================================
    
    onChange(callback) {
        this.listeners.push(callback);
        return () => {
            const index = this.listeners.indexOf(callback);
            if (index !== -1) this.listeners.splice(index, 1);
        };
    }
    
    notifyListeners(key, value) {
        this.listeners.forEach(callback => callback(key, value));
    }
}

// ============================================
// DEFAULT EXPORT
// ============================================

const Config = new ConfigManager();

// ============================================
// EXPORTS
// ============================================

// Expose to window
window.Config = Config;
window.Environment = Environment;
window.ConfigManager = ConfigManager;

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        Config,
        Environment,
        ConfigManager
    };
}

// ES modules export
export {
    Config,
    Environment,
    ConfigManager
};