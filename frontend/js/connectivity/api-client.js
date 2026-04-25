/**
 * ESTIF HOME ULTIMATE - API CLIENT MODULE
 * Advanced HTTP client with interceptors, caching, retry logic, and request queuing
 * Version: 2.0.0
 * Author: Estifanos Yohannis
 */

// ============================================
// API CLIENT CONFIGURATION
// ============================================

const APIConfig = {
    // Base settings
    baseURL: '/api',
    timeout: 30000,
    apiVersion: 'v1',
    
    // Retry settings
    retryAttempts: 3,
    retryDelay: 1000,
    retryStatusCodes: [408, 429, 500, 502, 503, 504],
    
    // Cache settings
    enableCache: true,
    cacheTTL: 300000, // 5 minutes
    cacheMaxSize: 100,
    
    // Queue settings
    enableQueue: true,
    queueMaxSize: 50,
    queuePersist: true,
    
    // Headers
    defaultHeaders: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    },
    
    // Debug
    debug: false,
    
    // Offline support
    enableOfflineSupport: true,
    offlineStorageKey: 'estif_api_queue',
    
    // Request debouncing
    enableDebounce: true,
    debounceDelay: 300,
    
    // Rate limiting
    enableRateLimit: true,
    rateLimitMax: 10,
    rateLimitWindow: 60000,
    
    // Endpoints
    endpoints: {
        devices: '/devices',
        device: (id) => `/devices/${id}`,
        homes: '/homes',
        home: (id) => `/homes/${id}`,
        automation: '/automation',
        analytics: '/analytics',
        voice: '/voice-command',
        esp32: '/esp32',
        auth: '/auth',
        users: '/users'
    }
};

// ============================================
// REQUEST QUEUE
// ============================================

class RequestQueue {
    constructor() {
        this.queue = [];
        this.isProcessing = false;
        this.loadFromStorage();
    }

    loadFromStorage() {
        if (!APIConfig.queuePersist) return;
        try {
            const saved = localStorage.getItem(APIConfig.offlineStorageKey);
            if (saved) {
                this.queue = JSON.parse(saved);
                APIConfig.debug && console.log(`[API] Loaded ${this.queue.length} queued requests`);
            }
        } catch (error) {
            APIConfig.debug && console.log('[API] Failed to load queue from storage');
        }
    }

    saveToStorage() {
        if (!APIConfig.queuePersist) return;
        try {
            localStorage.setItem(APIConfig.offlineStorageKey, JSON.stringify(this.queue));
        } catch (error) {
            APIConfig.debug && console.log('[API] Failed to save queue to storage');
        }
    }

    add(request) {
        if (this.queue.length >= APIConfig.queueMaxSize) {
            this.queue.shift();
        }
        this.queue.push({
            ...request,
            id: Date.now(),
            timestamp: new Date().toISOString(),
            retryCount: 0
        });
        this.saveToStorage();
        this.process();
    }

    async process() {
        if (this.isProcessing || this.queue.length === 0) return;
        if (!navigator.onLine && APIConfig.enableOfflineSupport) return;

        this.isProcessing = true;

        while (this.queue.length > 0) {
            const request = this.queue[0];
            try {
                const response = await this.executeRequest(request);
                if (response.ok) {
                    this.queue.shift();
                    this.saveToStorage();
                    APIConfig.debug && console.log(`[API] Processed queued request: ${request.url}`);
                } else if (request.retryCount < APIConfig.retryAttempts) {
                    request.retryCount++;
                    await this.delay(APIConfig.retryDelay * Math.pow(2, request.retryCount));
                    APIConfig.debug && console.log(`[API] Retrying request (${request.retryCount}/${APIConfig.retryAttempts})`);
                } else {
                    this.queue.shift();
                    this.saveToStorage();
                    APIConfig.debug && console.log(`[API] Failed request removed from queue`);
                }
            } catch (error) {
                if (request.retryCount < APIConfig.retryAttempts) {
                    request.retryCount++;
                    await this.delay(APIConfig.retryDelay * Math.pow(2, request.retryCount));
                } else {
                    this.queue.shift();
                    this.saveToStorage();
                }
            }
        }

        this.isProcessing = false;
    }

    async executeRequest(request) {
        return fetch(request.url, {
            method: request.method,
            headers: request.headers,
            body: request.body
        });
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    clear() {
        this.queue = [];
        this.saveToStorage();
    }

    getSize() {
        return this.queue.length;
    }

    getPendingRequests() {
        return this.queue;
    }
}

// ============================================
// REQUEST CACHE
// ============================================

class RequestCache {
    constructor() {
        this.cache = new Map();
    }

    getKey(url, params = {}) {
        return `${url}?${JSON.stringify(params)}`;
    }

    get(url, params = {}) {
        if (!APIConfig.enableCache) return null;
        
        const key = this.getKey(url, params);
        const cached = this.cache.get(key);
        
        if (cached && cached.expiry > Date.now()) {
            APIConfig.debug && console.log(`[API] Cache hit: ${key}`);
            return cached.data;
        }
        
        if (cached) {
            this.cache.delete(key);
        }
        
        return null;
    }

    set(url, data, params = {}, ttl = APIConfig.cacheTTL) {
        if (!APIConfig.enableCache) return;
        
        // Limit cache size
        if (this.cache.size >= APIConfig.cacheMaxSize) {
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }
        
        const key = this.getKey(url, params);
        this.cache.set(key, {
            data: JSON.parse(JSON.stringify(data)), // Deep clone
            expiry: Date.now() + ttl
        });
        
        APIConfig.debug && console.log(`[API] Cached: ${key}`);
    }

    invalidate(url, params = {}) {
        const key = this.getKey(url, params);
        this.cache.delete(key);
        APIConfig.debug && console.log(`[API] Invalidated: ${key}`);
    }

    clear() {
        this.cache.clear();
        APIConfig.debug && console.log('[API] Cache cleared');
    }

    getStats() {
        return {
            size: this.cache.size,
            keys: Array.from(this.cache.keys())
        };
    }
}

// ============================================
// RATE LIMITER
// ============================================

class RateLimiter {
    constructor() {
        this.requests = new Map();
    }

    canMakeRequest(endpoint) {
        if (!APIConfig.enableRateLimit) return true;
        
        const now = Date.now();
        const endpointRequests = this.requests.get(endpoint) || [];
        
        // Filter requests within window
        const recentRequests = endpointRequests.filter(t => now - t < APIConfig.rateLimitWindow);
        
        if (recentRequests.length >= APIConfig.rateLimitMax) {
            APIConfig.debug && console.log(`[API] Rate limit reached for ${endpoint}`);
            return false;
        }
        
        recentRequests.push(now);
        this.requests.set(endpoint, recentRequests);
        return true;
    }

    reset() {
        this.requests.clear();
    }
}

// ============================================
// REQUEST DEBOUNCER
// ============================================

class RequestDebouncer {
    constructor() {
        this.debounceTimers = new Map();
    }

    debounce(key, callback, delay = APIConfig.debounceDelay) {
        if (!APIConfig.enableDebounce) {
            return callback();
        }
        
        const existingTimer = this.debounceTimers.get(key);
        if (existingTimer) {
            clearTimeout(existingTimer);
        }
        
        const timer = setTimeout(() => {
            callback();
            this.debounceTimers.delete(key);
        }, delay);
        
        this.debounceTimers.set(key, timer);
    }

    cancel(key) {
        const timer = this.debounceTimers.get(key);
        if (timer) {
            clearTimeout(timer);
            this.debounceTimers.delete(key);
        }
    }

    clear() {
        for (const timer of this.debounceTimers.values()) {
            clearTimeout(timer);
        }
        this.debounceTimers.clear();
    }
}

// ============================================
// API CLIENT
// ============================================

class APIClient {
    constructor(config = {}) {
        this.config = { ...APIConfig, ...config };
        this.cache = new RequestCache();
        this.queue = new RequestQueue();
        this.rateLimiter = new RateLimiter();
        this.debouncer = new RequestDebouncer();
        this.interceptors = {
            request: [],
            response: [],
            error: []
        };
        this.listeners = [];
        
        this.init();
    }

    init() {
        this.setupOnlineListener();
        APIConfig.debug && console.log('[API] Client initialized');
    }

    setupOnlineListener() {
        window.addEventListener('online', () => {
            APIConfig.debug && console.log('[API] Online - processing queue');
            this.queue.process();
        });
    }

    // ============================================
    // INTERCEPTORS
    // ============================================

    addRequestInterceptor(interceptor) {
        this.interceptors.request.push(interceptor);
        return () => {
            const index = this.interceptors.request.indexOf(interceptor);
            if (index !== -1) this.interceptors.request.splice(index, 1);
        };
    }

    addResponseInterceptor(interceptor) {
        this.interceptors.response.push(interceptor);
        return () => {
            const index = this.interceptors.response.indexOf(interceptor);
            if (index !== -1) this.interceptors.response.splice(index, 1);
        };
    }

    addErrorInterceptor(interceptor) {
        this.interceptors.error.push(interceptor);
        return () => {
            const index = this.interceptors.error.indexOf(interceptor);
            if (index !== -1) this.interceptors.error.splice(index, 1);
        };
    }

    // ============================================
    // REQUEST METHODS
    // ============================================

    async request(url, options = {}) {
        const startTime = Date.now();
        
        // Check rate limit
        if (!this.rateLimiter.canMakeRequest(url)) {
            throw new Error('Rate limit exceeded. Please try again later.');
        }
        
        // Build full URL
        const fullUrl = this.buildUrl(url, options.params);
        
        // Check cache for GET requests
        if (options.method === 'GET' && !options.skipCache) {
            const cached = this.cache.get(fullUrl);
            if (cached) {
                return cached;
            }
        }
        
        // Prepare request config
        let requestConfig = {
            method: options.method || 'GET',
            headers: this.getHeaders(options.headers),
            signal: options.signal,
            credentials: 'include'
        };
        
        if (options.body) {
            requestConfig.body = JSON.stringify(options.body);
        }
        
        // Run request interceptors
        for (const interceptor of this.interceptors.request) {
            requestConfig = await interceptor(requestConfig);
        }
        
        try {
            // Execute request with retry logic
            let response = await this.executeWithRetry(fullUrl, requestConfig, options.retryCount || 0);
            
            // Parse response
            let data = await this.parseResponse(response);
            
            // Run response interceptors
            for (const interceptor of this.interceptors.response) {
                data = await interceptor(data);
            }
            
            // Cache GET responses
            if (options.method === 'GET' && !options.skipCache && response.ok) {
                this.cache.set(fullUrl, data, options.params, options.cacheTTL);
            }
            
            const duration = Date.now() - startTime;
            APIConfig.debug && console.log(`[API] ${requestConfig.method} ${fullUrl} - ${duration}ms`);
            
            return {
                success: response.ok,
                data,
                status: response.status,
                statusText: response.statusText,
                headers: response.headers
            };
            
        } catch (error) {
            // Run error interceptors
            for (const interceptor of this.interceptors.error) {
                await interceptor(error, url, options);
            }
            
            // Queue request if offline
            if (!navigator.onLine && APIConfig.enableOfflineSupport && options.method !== 'GET') {
                this.queue.add({
                    url: fullUrl,
                    method: options.method,
                    headers: requestConfig.headers,
                    body: requestConfig.body
                });
                
                return {
                    success: false,
                    queued: true,
                    error: 'Request queued for offline processing',
                    status: 0
                };
            }
            
            throw error;
        }
    }

    async executeWithRetry(url, config, retryCount) {
        try {
            const response = await fetch(url, config);
            
            if (!response.ok && APIConfig.retryStatusCodes.includes(response.status) && retryCount < APIConfig.retryAttempts) {
                const delay = APIConfig.retryDelay * Math.pow(2, retryCount);
                await this.delay(delay);
                return this.executeWithRetry(url, config, retryCount + 1);
            }
            
            return response;
        } catch (error) {
            if (retryCount < APIConfig.retryAttempts) {
                const delay = APIConfig.retryDelay * Math.pow(2, retryCount);
                await this.delay(delay);
                return this.executeWithRetry(url, config, retryCount + 1);
            }
            throw error;
        }
    }

    async parseResponse(response) {
        const contentType = response.headers.get('content-type');
        
        if (contentType && contentType.includes('application/json')) {
            return await response.json();
        }
        
        if (contentType && contentType.includes('text')) {
            return await response.text();
        }
        
        return response;
    }

    // ============================================
    // HTTP METHODS
    // ============================================

    get(url, options = {}) {
        return this.request(url, { ...options, method: 'GET' });
    }

    post(url, body, options = {}) {
        return this.request(url, { ...options, method: 'POST', body });
    }

    put(url, body, options = {}) {
        return this.request(url, { ...options, method: 'PUT', body });
    }

    patch(url, body, options = {}) {
        return this.request(url, { ...options, method: 'PATCH', body });
    }

    delete(url, options = {}) {
        return this.request(url, { ...options, method: 'DELETE' });
    }

    // ============================================
    // API ENDPOINT METHODS
    // ============================================

    async getDevices(params = {}) {
        return this.get(APIConfig.endpoints.devices, { params });
    }

    async getDevice(id) {
        return this.get(APIConfig.endpoints.device(id));
    }

    async toggleDevice(id, state) {
        return this.post(APIConfig.endpoints.device(id) + '/toggle', { state });
    }

    async setDeviceAutoMode(id, enabled) {
        return this.post(APIConfig.endpoints.device(id) + '/auto', { enabled });
    }

    async masterControl(state) {
        return this.post('/master', { state });
    }

    async getHomes() {
        return this.get(APIConfig.endpoints.homes);
    }

    async getHome(id) {
        return this.get(APIConfig.endpoints.home(id));
    }

    async getAutomations() {
        return this.get(APIConfig.endpoints.automation);
    }

    async getAnalytics(range = 'week') {
        return this.get(APIConfig.endpoints.analytics, { params: { range } });
    }

    async sendVoiceCommand(text, language = 'en') {
        return this.post(APIConfig.endpoints.voice, { text, language });
    }

    async esp32Heartbeat(data) {
        return this.post(APIConfig.endpoints.esp32 + '/heartbeat', data);
    }

    async login(email, password) {
        return this.post(APIConfig.endpoints.auth + '/login', { email, password });
    }

    async register(userData) {
        return this.post(APIConfig.endpoints.auth + '/register', userData);
    }

    async logout() {
        return this.post(APIConfig.endpoints.auth + '/logout');
    }

    async getCurrentUser() {
        return this.get(APIConfig.endpoints.users + '/me');
    }

    // ============================================
    // UTILITY METHODS
    // ============================================

    buildUrl(url, params = {}) {
        const baseUrl = url.startsWith('http') ? url : this.config.baseURL + '/' + this.config.apiVersion + url;
        
        if (Object.keys(params).length === 0) {
            return baseUrl;
        }
        
        const queryString = new URLSearchParams(params).toString();
        return `${baseUrl}?${queryString}`;
    }

    getHeaders(customHeaders = {}) {
        const headers = { ...this.config.defaultHeaders, ...customHeaders };
        
        // Add auth token if available
        const token = this.getAuthToken();
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        
        return headers;
    }

    getAuthToken() {
        return localStorage.getItem('estif_auth_token') || sessionStorage.getItem('estif_auth_token');
    }

    setAuthToken(token, remember = true) {
        const storage = remember ? localStorage : sessionStorage;
        storage.setItem('estif_auth_token', token);
    }

    clearAuthToken() {
        localStorage.removeItem('estif_auth_token');
        sessionStorage.removeItem('estif_auth_token');
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // ============================================
    // CACHE MANAGEMENT
    // ============================================

    invalidateCache(url, params = {}) {
        this.cache.invalidate(url, params);
    }

    clearCache() {
        this.cache.clear();
    }

    getCacheStats() {
        return this.cache.getStats();
    }

    // ============================================
    // QUEUE MANAGEMENT
    // ============================================

    getPendingRequests() {
        return this.queue.getPendingRequests();
    }

    clearQueue() {
        this.queue.clear();
    }

    processQueue() {
        this.queue.process();
    }

    // ============================================
    // EVENT SYSTEM
    // ============================================

    addEventListener(event, callback) {
        this.listeners.push({ event, callback });
        return () => {
            const index = this.listeners.findIndex(l => l.event === event && l.callback === callback);
            if (index !== -1) this.listeners.splice(index, 1);
        };
    }

    notifyListeners(event, data) {
        this.listeners.forEach(listener => {
            if (listener.event === event) {
                listener.callback(data);
            }
        });
    }

    // ============================================
    // DEBOUNCE HELPERS
    // ============================================

    debouncedGet(url, key, options = {}) {
        return new Promise((resolve, reject) => {
            this.debouncer.debounce(key, async () => {
                try {
                    const result = await this.get(url, options);
                    resolve(result);
                } catch (error) {
                    reject(error);
                }
            });
        });
    }

    cancelDebouncedRequest(key) {
        this.debouncer.cancel(key);
    }

    // ============================================
    // HEALTH CHECK
    // ============================================

    async healthCheck() {
        try {
            const response = await this.get('/health', { skipCache: true });
            return response.success;
        } catch {
            return false;
        }
    }

    // ============================================
    // BATCH REQUESTS
    // ============================================

    async batch(requests) {
        const results = await Promise.allSettled(
            requests.map(req => this.request(req.url, req.options))
        );
        
        return results.map(result => ({
            success: result.status === 'fulfilled',
            data: result.status === 'fulfilled' ? result.value : null,
            error: result.status === 'rejected' ? result.reason : null
        }));
    }
}

// ============================================
// CREATE SINGLETON INSTANCE
// ============================================

const apiClient = new APIClient();

// ============================================
// EXPORTS
// ============================================

// Expose to window
window.apiClient = apiClient;
window.APIClient = APIClient;
window.APIConfig = APIConfig;

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        apiClient,
        APIClient,
        APIConfig,
        RequestQueue,
        RequestCache,
        RateLimiter,
        RequestDebouncer
    };
}

// ES modules export
export {
    apiClient,
    APIClient,
    APIConfig,
    RequestQueue,
    RequestCache,
    RateLimiter,
    RequestDebouncer
};