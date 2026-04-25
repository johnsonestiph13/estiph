/**
 * ESTIF HOME ULTIMATE - INTERCEPTORS MODULE
 * Request/response interceptors for API calls with caching, retry, auth, and logging
 * Version: 2.0.0
 * Author: Estifanos Yohannis
 */

// ============================================
// INTERCEPTOR CONFIGURATION
// ============================================

const InterceptorConfig = {
    // Auth interceptor
    auth: {
        enabled: true,
        tokenKey: 'estif_auth_token',
        refreshTokenKey: 'estif_refresh_token',
        tokenHeader: 'Authorization',
        tokenPrefix: 'Bearer '
    },
    
    // Logging interceptor
    logging: {
        enabled: true,
        logRequest: true,
        logResponse: true,
        logError: true,
        maxBodyLength: 1000
    },
    
    // Retry interceptor
    retry: {
        enabled: true,
        maxRetries: 3,
        retryDelay: 1000,
        retryStatusCodes: [408, 429, 500, 502, 503, 504],
        retryMethods: ['GET', 'PUT', 'DELETE']
    },
    
    // Cache interceptor
    cache: {
        enabled: true,
        ttl: 300000, // 5 minutes
        methods: ['GET'],
        maxSize: 100
    },
    
    // Rate limit interceptor
    rateLimit: {
        enabled: true,
        maxRequests: 100,
        timeWindow: 60000 // 1 minute
    },
    
    // Offline interceptor
    offline: {
        enabled: true,
        queueKey: 'estif_offline_queue',
        maxQueueSize: 50
    },
    
    // Transform interceptor
    transform: {
        enabled: true,
        snakeToCamel: true,
        camelToSnake: true
    },
    
    // Debug
    debug: false
};

// ============================================
// AUTH INTERCEPTOR
// ============================================

class AuthInterceptor {
    constructor() {
        this.isRefreshing = false;
        this.refreshSubscribers = [];
    }

    async request(config) {
        if (!InterceptorConfig.auth.enabled) return config;
        
        const token = this.getToken();
        if (token) {
            config.headers = config.headers || {};
            config.headers[InterceptorConfig.auth.tokenHeader] = 
                InterceptorConfig.auth.tokenPrefix + token;
        }
        
        return config;
    }

    async responseError(error) {
        if (!InterceptorConfig.auth.enabled) throw error;
        
        const originalRequest = error.config;
        
        if (error.response && error.response.status === 401 && !originalRequest._retry) {
            if (this.isRefreshing) {
                return new Promise((resolve, reject) => {
                    this.refreshSubscribers.push({ resolve, reject, config: originalRequest });
                });
            }
            
            originalRequest._retry = true;
            this.isRefreshing = true;
            
            try {
                const newToken = await this.refreshToken();
                this.setToken(newToken);
                this.onRefreshSuccess();
                
                // Retry original request
                originalRequest.headers[InterceptorConfig.auth.tokenHeader] = 
                    InterceptorConfig.auth.tokenPrefix + newToken;
                return this.retryRequest(originalRequest);
            } catch (refreshError) {
                this.onRefreshError(refreshError);
                this.logout();
                throw refreshError;
            } finally {
                this.isRefreshing = false;
            }
        }
        
        throw error;
    }

    getToken() {
        return localStorage.getItem(InterceptorConfig.auth.tokenKey);
    }

    setToken(token) {
        localStorage.setItem(InterceptorConfig.auth.tokenKey, token);
    }

    clearToken() {
        localStorage.removeItem(InterceptorConfig.auth.tokenKey);
        localStorage.removeItem(InterceptorConfig.auth.refreshTokenKey);
    }

    async refreshToken() {
        const refreshToken = localStorage.getItem(InterceptorConfig.auth.refreshTokenKey);
        if (!refreshToken) {
            throw new Error('No refresh token');
        }
        
        const response = await fetch('/api/auth/refresh', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken })
        });
        
        if (!response.ok) {
            throw new Error('Refresh failed');
        }
        
        const data = await response.json();
        return data.token;
    }

    onRefreshSuccess() {
        this.refreshSubscribers.forEach(subscriber => {
            subscriber.resolve(this.retryRequest(subscriber.config));
        });
        this.refreshSubscribers = [];
    }

    onRefreshError(error) {
        this.refreshSubscribers.forEach(subscriber => {
            subscriber.reject(error);
        });
        this.refreshSubscribers = [];
    }

    async retryRequest(config) {
        const response = await fetch(config.url, config);
        return response;
    }

    logout() {
        this.clearToken();
        window.dispatchEvent(new CustomEvent('auth:logout'));
        window.location.href = '/login';
    }
}

// ============================================
// LOGGING INTERCEPTOR
// ============================================

class LoggingInterceptor {
    constructor() {
        this.requestCount = 0;
    }

    async request(config) {
        if (!InterceptorConfig.logging.enabled || !InterceptorConfig.logging.logRequest) {
            return config;
        }
        
        this.requestCount++;
        
        const logData = {
            id: this.requestCount,
            method: config.method,
            url: config.url,
            timestamp: new Date().toISOString()
        };
        
        if (config.data && InterceptorConfig.logging.maxBodyLength) {
            const dataStr = JSON.stringify(config.data);
            logData.body = dataStr.length > InterceptorConfig.logging.maxBodyLength 
                ? dataStr.substring(0, InterceptorConfig.logging.maxBodyLength) + '...'
                : dataStr;
        }
        
        console.log(`[API Request] ${logData.method} ${logData.url}`, logData);
        
        return config;
    }

    async response(response) {
        if (!InterceptorConfig.logging.enabled || !InterceptorConfig.logging.logResponse) {
            return response;
        }
        
        const logData = {
            method: response.config?.method,
            url: response.config?.url,
            status: response.status,
            duration: response.duration,
            timestamp: new Date().toISOString()
        };
        
        console.log(`[API Response] ${logData.method} ${logData.url} - ${logData.status}`, logData);
        
        return response;
    }

    async responseError(error) {
        if (!InterceptorConfig.logging.enabled || !InterceptorConfig.logging.logError) {
            throw error;
        }
        
        const logData = {
            method: error.config?.method,
            url: error.config?.url,
            status: error.response?.status,
            message: error.message,
            timestamp: new Date().toISOString()
        };
        
        console.error(`[API Error] ${logData.method} ${logData.url} - ${logData.status}`, logData);
        
        throw error;
    }
}

// ============================================
// RETRY INTERCEPTOR
// ============================================

class RetryInterceptor {
    constructor() {
        this.retryCounts = new Map();
    }

    async responseError(error) {
        if (!InterceptorConfig.retry.enabled) throw error;
        
        const config = error.config;
        if (!config) throw error;
        
        const shouldRetry = this.shouldRetry(error, config);
        if (!shouldRetry) throw error;
        
        const retryCount = this.getRetryCount(config);
        if (retryCount >= InterceptorConfig.retry.maxRetries) {
            this.clearRetryCount(config);
            throw error;
        }
        
        this.incrementRetryCount(config);
        
        const delay = this.calculateDelay(retryCount);
        await this.sleep(delay);
        
        return this.retryRequest(config);
    }

    shouldRetry(error, config) {
        // Check method
        const method = (config.method || 'GET').toUpperCase();
        if (!InterceptorConfig.retry.retryMethods.includes(method)) {
            return false;
        }
        
        // Check status code
        const status = error.response?.status;
        if (status && InterceptorConfig.retry.retryStatusCodes.includes(status)) {
            return true;
        }
        
        // Check network errors
        if (error.message === 'Network Error' || error.code === 'ECONNABORTED') {
            return true;
        }
        
        return false;
    }

    getRetryCount(config) {
        const key = this.getRequestKey(config);
        return this.retryCounts.get(key) || 0;
    }

    incrementRetryCount(config) {
        const key = this.getRequestKey(config);
        const count = this.getRetryCount(config);
        this.retryCounts.set(key, count + 1);
    }

    clearRetryCount(config) {
        const key = this.getRequestKey(config);
        this.retryCounts.delete(key);
    }

    getRequestKey(config) {
        return `${config.method}:${config.url}`;
    }

    calculateDelay(retryCount) {
        const delay = InterceptorConfig.retry.retryDelay * Math.pow(2, retryCount);
        return Math.min(delay, 30000); // Max 30 seconds
    }

    async retryRequest(config) {
        const response = await fetch(config.url, config);
        return response;
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// ============================================
// CACHE INTERCEPTOR
// ============================================

class CacheInterceptor {
    constructor() {
        this.cache = new Map();
        this.pendingRequests = new Map();
    }

    async request(config) {
        if (!InterceptorConfig.cache.enabled) return config;
        
        const method = (config.method || 'GET').toUpperCase();
        if (!InterceptorConfig.cache.methods.includes(method)) return config;
        
        if (config.skipCache) return config;
        
        const cacheKey = this.getCacheKey(config);
        const cached = this.getFromCache(cacheKey);
        
        if (cached && !this.isExpired(cached)) {
            // Return cached response
            const response = new Response(JSON.stringify(cached.data), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
            response.fromCache = true;
            response.cachedAt = cached.timestamp;
            return response;
        }
        
        // Check for pending request
        if (this.pendingRequests.has(cacheKey)) {
            return this.pendingRequests.get(cacheKey);
        }
        
        // Create pending promise
        const requestPromise = new Promise((resolve, reject) => {
            const originalFetch = window.fetch;
            window.fetch = (url, options) => {
                return originalFetch(url, options).then(response => {
                    if (response.ok && method === 'GET') {
                        this.cacheResponse(cacheKey, response);
                    }
                    return response;
                });
            };
        });
        
        this.pendingRequests.set(cacheKey, requestPromise);
        
        return config;
    }

    getCacheKey(config) {
        const url = config.url;
        const params = config.params ? JSON.stringify(config.params) : '';
        return `${config.method}:${url}:${params}`;
    }

    getFromCache(key) {
        return this.cache.get(key);
    }

    isExpired(cached) {
        return Date.now() - cached.timestamp > InterceptorConfig.cache.ttl;
    }

    async cacheResponse(key, response) {
        const clone = response.clone();
        const data = await clone.json();
        
        if (this.cache.size >= InterceptorConfig.cache.maxSize) {
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }
        
        this.cache.set(key, {
            data,
            timestamp: Date.now(),
            headers: Object.fromEntries(response.headers.entries())
        });
        
        this.pendingRequests.delete(key);
    }

    clearCache() {
        this.cache.clear();
        this.pendingRequests.clear();
    }

    invalidate(urlPattern) {
        for (const key of this.cache.keys()) {
            if (key.includes(urlPattern)) {
                this.cache.delete(key);
            }
        }
    }
}

// ============================================
// RATE LIMIT INTERCEPTOR
// ============================================

class RateLimitInterceptor {
    constructor() {
        this.requests = [];
        this.limits = new Map();
    }

    async request(config) {
        if (!InterceptorConfig.rateLimit.enabled) return config;
        
        const now = Date.now();
        const windowStart = now - InterceptorConfig.rateLimit.timeWindow;
        
        // Clean old requests
        this.requests = this.requests.filter(timestamp => timestamp > windowStart);
        
        if (this.requests.length >= InterceptorConfig.rateLimit.maxRequests) {
            const oldestRequest = this.requests[0];
            const waitTime = InterceptorConfig.rateLimit.timeWindow - (now - oldestRequest);
            
            if (waitTime > 0) {
                await this.sleep(waitTime);
                return this.retryRequest(config);
            }
        }
        
        this.requests.push(now);
        return config;
    }

    async retryRequest(config) {
        const response = await fetch(config.url, config);
        return response;
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    reset() {
        this.requests = [];
        this.limits.clear();
    }
}

// ============================================
// OFFLINE INTERCEPTOR
// ============================================

class OfflineInterceptor {
    constructor() {
        this.queue = this.loadQueue();
        this.setupOnlineListener();
    }

    loadQueue() {
        try {
            const saved = localStorage.getItem(InterceptorConfig.offline.queueKey);
            return saved ? JSON.parse(saved) : [];
        } catch {
            return [];
        }
    }

    saveQueue() {
        try {
            localStorage.setItem(InterceptorConfig.offline.queueKey, JSON.stringify(this.queue));
        } catch (error) {
            console.error('Failed to save offline queue:', error);
        }
    }

    setupOnlineListener() {
        window.addEventListener('online', () => {
            this.processQueue();
        });
    }

    async request(config) {
        if (!InterceptorConfig.offline.enabled) return config;
        
        if (!navigator.onLine) {
            const method = (config.method || 'GET').toUpperCase();
            
            // Cache GET requests
            if (method === 'GET') {
                const cached = await this.getCachedResponse(config);
                if (cached) {
                    return cached;
                }
            }
            
            // Queue non-GET requests
            if (method !== 'GET') {
                this.queueRequest(config);
                throw new Error('Offline: Request queued');
            }
        }
        
        return config;
    }

    queueRequest(config) {
        if (this.queue.length >= InterceptorConfig.offline.maxQueueSize) {
            this.queue.shift();
        }
        
        this.queue.push({
            ...config,
            queuedAt: Date.now(),
            retryCount: 0
        });
        
        this.saveQueue();
        
        window.dispatchEvent(new CustomEvent('offline:request_queued', {
            detail: { queueSize: this.queue.length }
        }));
    }

    async processQueue() {
        if (!navigator.onLine) return;
        
        const queue = [...this.queue];
        this.queue = [];
        
        for (const request of queue) {
            try {
                await this.processRequest(request);
                window.dispatchEvent(new CustomEvent('offline:request_processed', {
                    detail: { request, success: true }
                }));
            } catch (error) {
                if (request.retryCount < 3) {
                    request.retryCount++;
                    this.queue.push(request);
                }
                window.dispatchEvent(new CustomEvent('offline:request_failed', {
                    detail: { request, error }
                }));
            }
        }
        
        this.saveQueue();
    }

    async processRequest(config) {
        const response = await fetch(config.url, config);
        return response;
    }

    async getCachedResponse(config) {
        // Implement cache logic
        return null;
    }

    getQueueSize() {
        return this.queue.length;
    }

    clearQueue() {
        this.queue = [];
        this.saveQueue();
    }
}

// ============================================
// TRANSFORM INTERCEPTOR
// ============================================

class TransformInterceptor {
    async request(config) {
        if (!InterceptorConfig.transform.enabled) return config;
        
        // Convert camelCase to snake_case for request body
        if (config.data && InterceptorConfig.transform.camelToSnake) {
            config.data = this.camelToSnake(config.data);
        }
        
        // Convert camelCase to snake_case for params
        if (config.params && InterceptorConfig.transform.camelToSnake) {
            config.params = this.camelToSnake(config.params);
        }
        
        return config;
    }

    async response(response) {
        if (!InterceptorConfig.transform.enabled) return response;
        
        // Convert snake_case to camelCase for response data
        if (response.data && InterceptorConfig.transform.snakeToCamel) {
            response.data = this.snakeToCamel(response.data);
        }
        
        return response;
    }

    camelToSnake(obj) {
        if (typeof obj !== 'object' || obj === null) return obj;
        
        const result = {};
        for (const [key, value] of Object.entries(obj)) {
            const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
            result[snakeKey] = this.camelToSnake(value);
        }
        return result;
    }

    snakeToCamel(obj) {
        if (typeof obj !== 'object' || obj === null) return obj;
        
        const result = {};
        for (const [key, value] of Object.entries(obj)) {
            const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
            result[camelKey] = this.snakeToCamel(value);
        }
        return result;
    }
}

// ============================================
// INTERCEPTOR MANAGER
// ============================================

class InterceptorManager {
    constructor() {
        this.auth = new AuthInterceptor();
        this.logging = new LoggingInterceptor();
        this.retry = new RetryInterceptor();
        this.cache = new CacheInterceptor();
        this.rateLimit = new RateLimitInterceptor();
        this.offline = new OfflineInterceptor();
        this.transform = new TransformInterceptor();
        
        this.requestInterceptors = [];
        this.responseInterceptors = [];
        this.errorInterceptors = [];
        
        this.setupDefaultInterceptors();
    }

    setupDefaultInterceptors() {
        // Order matters!
        this.addRequestInterceptor(this.auth.request.bind(this.auth));
        this.addRequestInterceptor(this.logging.request.bind(this.logging));
        this.addRequestInterceptor(this.cache.request.bind(this.cache));
        this.addRequestInterceptor(this.rateLimit.request.bind(this.rateLimit));
        this.addRequestInterceptor(this.offline.request.bind(this.offline));
        this.addRequestInterceptor(this.transform.request.bind(this.transform));
        
        this.addResponseInterceptor(this.logging.response.bind(this.logging));
        this.addResponseInterceptor(this.transform.response.bind(this.transform));
        
        this.addErrorInterceptor(this.auth.responseError.bind(this.auth));
        this.addErrorInterceptor(this.retry.responseError.bind(this.retry));
        this.addErrorInterceptor(this.logging.responseError.bind(this.logging));
    }

    addRequestInterceptor(interceptor) {
        this.requestInterceptors.push(interceptor);
        return () => {
            const index = this.requestInterceptors.indexOf(interceptor);
            if (index !== -1) this.requestInterceptors.splice(index, 1);
        };
    }

    addResponseInterceptor(interceptor) {
        this.responseInterceptors.push(interceptor);
        return () => {
            const index = this.responseInterceptors.indexOf(interceptor);
            if (index !== -1) this.responseInterceptors.splice(index, 1);
        };
    }

    addErrorInterceptor(interceptor) {
        this.errorInterceptors.push(interceptor);
        return () => {
            const index = this.errorInterceptors.indexOf(interceptor);
            if (index !== -1) this.errorInterceptors.splice(index, 1);
        };
    }

    async applyRequestInterceptors(config) {
        let result = config;
        for (const interceptor of this.requestInterceptors) {
            result = await interceptor(result);
        }
        return result;
    }

    async applyResponseInterceptors(response) {
        let result = response;
        for (const interceptor of this.responseInterceptors) {
            result = await interceptor(result);
        }
        return result;
    }

    async applyErrorInterceptors(error) {
        let result = error;
        for (const interceptor of this.errorInterceptors) {
            result = await interceptor(result);
        }
        throw result;
    }

    clearCache() {
        this.cache.clearCache();
    }

    invalidateCache(urlPattern) {
        this.cache.invalidate(urlPattern);
    }

    getOfflineQueueSize() {
        return this.offline.getQueueSize();
    }

    clearOfflineQueue() {
        this.offline.clearQueue();
    }
}

// ============================================
// CREATE SINGLETON INSTANCE
// ============================================

const interceptors = new InterceptorManager();

// ============================================
// EXPORTS
// ============================================

// Expose to window
window.interceptors = interceptors;
window.InterceptorManager = InterceptorManager;
window.InterceptorConfig = InterceptorConfig;

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        interceptors,
        InterceptorManager,
        InterceptorConfig
    };
}

// ES modules export
export {
    interceptors,
    InterceptorManager,
    InterceptorConfig
};