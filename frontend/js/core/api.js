/**
 * ESTIF HOME ULTIMATE - CORE API MODULE
 * Centralized API service with authentication, caching, and error handling
 * Version: 2.0.0
 * Author: Estifanos Yohannis
 */

// ============================================
// API CONFIGURATION
// ============================================

const APIConfig = {
    // Base settings
    baseURL: '/api/v1',
    timeout: 30000,
    
    // Headers
    headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    },
    
    // Auth
    authTokenKey: 'estif_auth_token',
    refreshTokenKey: 'estif_refresh_token',
    
    // Cache
    enableCache: true,
    cacheTTL: 300000, // 5 minutes
    
    // Retry
    retryAttempts: 3,
    retryDelay: 1000,
    
    // Debug
    debug: false
};

// ============================================
// API REQUEST INTERCEPTOR
// ============================================

class APIInterceptor {
    constructor() {
        this.requestInterceptors = [];
        this.responseInterceptors = [];
        this.errorInterceptors = [];
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
        return result;
    }
}

// ============================================
// API CACHE
// ============================================

class APICache {
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
        
        if (cached) this.cache.delete(key);
        return null;
    }

    set(url, data, params = {}, ttl = APIConfig.cacheTTL) {
        if (!APIConfig.enableCache) return;
        
        const key = this.getKey(url, params);
        this.cache.set(key, {
            data: JSON.parse(JSON.stringify(data)),
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
}

// ============================================
// API CLIENT
// ============================================

class APIClient {
    constructor() {
        this.interceptors = new APIInterceptor();
        this.cache = new APICache();
        this.pendingRequests = new Map();
        this.isRefreshing = false;
        this.refreshSubscribers = [];
        
        this.setupAuthInterceptor();
    }

    setupAuthInterceptor() {
        // Add auth token to requests
        this.interceptors.addRequestInterceptor(async (config) => {
            const token = this.getAuthToken();
            if (token) {
                config.headers = {
                    ...config.headers,
                    'Authorization': `Bearer ${token}`
                };
            }
            return config;
        });
        
        // Handle 401 responses
        this.interceptors.addErrorInterceptor(async (error) => {
            if (error.response && error.response.status === 401) {
                return this.handleUnauthorized(error);
            }
            throw error;
        });
    }

    async handleUnauthorized(error) {
        const originalRequest = error.config;
        
        if (this.isRefreshing) {
            // Queue request while refreshing
            return new Promise((resolve, reject) => {
                this.refreshSubscribers.push({ resolve, reject, config: originalRequest });
            });
        }
        
        this.isRefreshing = true;
        
        try {
            const newToken = await this.refreshToken();
            this.setAuthToken(newToken);
            
            // Retry queued requests
            this.refreshSubscribers.forEach(({ resolve, reject, config }) => {
                this.request(config).then(resolve).catch(reject);
            });
            
            this.refreshSubscribers = [];
            this.isRefreshing = false;
            
            // Retry original request
            return this.request(originalRequest);
        } catch (refreshError) {
            this.refreshSubscribers.forEach(({ reject }) => reject(refreshError));
            this.refreshSubscribers = [];
            this.isRefreshing = false;
            this.logout();
            throw refreshError;
        }
    }

    async refreshToken() {
        const refreshToken = localStorage.getItem(APIConfig.refreshTokenKey);
        if (!refreshToken) {
            throw new Error('No refresh token');
        }
        
        const response = await fetch(`${APIConfig.baseURL}/auth/refresh`, {
            method: 'POST',
            headers: APIConfig.headers,
            body: JSON.stringify({ refreshToken })
        });
        
        if (!response.ok) {
            throw new Error('Refresh failed');
        }
        
        const data = await response.json();
        return data.token;
    }

    // ============================================
    // TOKEN MANAGEMENT
    // ============================================

    getAuthToken() {
        return localStorage.getItem(APIConfig.authTokenKey);
    }

    setAuthToken(token) {
        localStorage.setItem(APIConfig.authTokenKey, token);
    }

    clearAuthToken() {
        localStorage.removeItem(APIConfig.authTokenKey);
        localStorage.removeItem(APIConfig.refreshTokenKey);
    }

    logout() {
        this.clearAuthToken();
        window.dispatchEvent(new CustomEvent('auth:logout'));
        window.location.href = '/login';
    }

    // ============================================
    // REQUEST METHODS
    // ============================================

    async request(url, options = {}) {
        const config = {
            url,
            method: options.method || 'GET',
            headers: { ...APIConfig.headers, ...options.headers },
            params: options.params,
            data: options.body,
            timeout: options.timeout || APIConfig.timeout,
            skipCache: options.skipCache || false,
            cacheTTL: options.cacheTTL
        };
        
        // Apply request interceptors
        const interceptedConfig = await this.interceptors.applyRequestInterceptors(config);
        
        // Build full URL
        const fullUrl = this.buildUrl(interceptedConfig.url, interceptedConfig.params);
        
        // Check cache for GET requests
        if (interceptedConfig.method === 'GET' && !interceptedConfig.skipCache) {
            const cached = this.cache.get(fullUrl, interceptedConfig.params);
            if (cached) {
                return cached;
            }
        }
        
        // Check for pending identical request
        const requestKey = `${interceptedConfig.method}:${fullUrl}`;
        if (this.pendingRequests.has(requestKey)) {
            return this.pendingRequests.get(requestKey);
        }
        
        // Create abort controller for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), interceptedConfig.timeout);
        
        const requestPromise = (async () => {
            try {
                const response = await fetch(fullUrl, {
                    method: interceptedConfig.method,
                    headers: interceptedConfig.headers,
                    body: interceptedConfig.data ? JSON.stringify(interceptedConfig.data) : undefined,
                    signal: controller.signal
                });
                
                clearTimeout(timeoutId);
                
                // Parse response
                let data;
                const contentType = response.headers.get('content-type');
                if (contentType && contentType.includes('application/json')) {
                    data = await response.json();
                } else {
                    data = await response.text();
                }
                
                // Handle error responses
                if (!response.ok) {
                    const error = new Error(data.message || 'Request failed');
                    error.response = { status: response.status, data, headers: response.headers };
                    error.config = interceptedConfig;
                    throw error;
                }
                
                const result = {
                    success: true,
                    data,
                    status: response.status,
                    headers: response.headers
                };
                
                // Cache GET responses
                if (interceptedConfig.method === 'GET' && !interceptedConfig.skipCache) {
                    this.cache.set(fullUrl, result, interceptedConfig.params, interceptedConfig.cacheTTL);
                }
                
                // Apply response interceptors
                return await this.interceptors.applyResponseInterceptors(result);
            } catch (error) {
                clearTimeout(timeoutId);
                
                if (error.name === 'AbortError') {
                    error.message = 'Request timeout';
                }
                
                // Apply error interceptors
                throw await this.interceptors.applyErrorInterceptors(error);
            } finally {
                this.pendingRequests.delete(requestKey);
            }
        })();
        
        this.pendingRequests.set(requestKey, requestPromise);
        return requestPromise;
    }

    async get(url, options = {}) {
        return this.request(url, { ...options, method: 'GET' });
    }

    async post(url, data, options = {}) {
        return this.request(url, { ...options, method: 'POST', body: data });
    }

    async put(url, data, options = {}) {
        return this.request(url, { ...options, method: 'PUT', body: data });
    }

    async patch(url, data, options = {}) {
        return this.request(url, { ...options, method: 'PATCH', body: data });
    }

    async delete(url, options = {}) {
        return this.request(url, { ...options, method: 'DELETE' });
    }

    // ============================================
    // AUTHENTICATION ENDPOINTS
    // ============================================

    async login(email, password) {
        const result = await this.post('/auth/login', { email, password });
        if (result.success && result.data.token) {
            this.setAuthToken(result.data.token);
            if (result.data.refreshToken) {
                localStorage.setItem(APIConfig.refreshTokenKey, result.data.refreshToken);
            }
        }
        return result;
    }

    async register(userData) {
        return this.post('/auth/register', userData);
    }

    async logout() {
        try {
            await this.post('/auth/logout');
        } finally {
            this.clearAuthToken();
        }
    }

    async forgotPassword(email) {
        return this.post('/auth/forgot-password', { email });
    }

    async resetPassword(token, newPassword) {
        return this.post('/auth/reset-password', { token, newPassword });
    }

    async verifyEmail(token) {
        return this.post('/auth/verify-email', { token });
    }

    // ============================================
    // USER ENDPOINTS
    // ============================================

    async getCurrentUser() {
        return this.get('/users/me');
    }

    async updateProfile(data) {
        return this.put('/users/me', data);
    }

    async changePassword(oldPassword, newPassword) {
        return this.post('/users/change-password', { oldPassword, newPassword });
    }

    async deleteAccount() {
        return this.delete('/users/me');
    }

    // ============================================
    // HOME ENDPOINTS
    // ============================================

    async getHomes() {
        return this.get('/homes');
    }

    async getHome(homeId) {
        return this.get(`/homes/${homeId}`);
    }

    async createHome(data) {
        return this.post('/homes', data);
    }

    async updateHome(homeId, data) {
        return this.put(`/homes/${homeId}`, data);
    }

    async deleteHome(homeId) {
        return this.delete(`/homes/${homeId}`);
    }

    async getHomeMembers(homeId) {
        return this.get(`/homes/${homeId}/members`);
    }

    async addHomeMember(homeId, email, role) {
        return this.post(`/homes/${homeId}/members`, { email, role });
    }

    async removeHomeMember(homeId, memberId) {
        return this.delete(`/homes/${homeId}/members/${memberId}`);
    }

    async updateMemberRole(homeId, memberId, role) {
        return this.put(`/homes/${homeId}/members/${memberId}`, { role });
    }

    // ============================================
    // DEVICE ENDPOINTS
    // ============================================

    async getDevices(homeId = null) {
        const params = homeId ? { homeId } : {};
        return this.get('/devices', { params });
    }

    async getDevice(deviceId) {
        return this.get(`/devices/${deviceId}`);
    }

    async createDevice(data) {
        return this.post('/devices', data);
    }

    async updateDevice(deviceId, data) {
        return this.put(`/devices/${deviceId}`, data);
    }

    async deleteDevice(deviceId) {
        return this.delete(`/devices/${deviceId}`);
    }

    async toggleDevice(deviceId, state) {
        return this.post(`/devices/${deviceId}/toggle`, { state });
    }

    async setDeviceAutoMode(deviceId, enabled) {
        return this.post(`/devices/${deviceId}/auto`, { enabled });
    }

    async masterControl(state) {
        return this.post('/devices/master', { state });
    }

    // ============================================
    // AUTOMATION ENDPOINTS
    // ============================================

    async getAutomations(homeId = null) {
        const params = homeId ? { homeId } : {};
        return this.get('/automations', { params });
    }

    async getAutomation(automationId) {
        return this.get(`/automations/${automationId}`);
    }

    async createAutomation(data) {
        return this.post('/automations', data);
    }

    async updateAutomation(automationId, data) {
        return this.put(`/automations/${automationId}`, data);
    }

    async deleteAutomation(automationId) {
        return this.delete(`/automations/${automationId}`);
    }

    async toggleAutomation(automationId, enabled) {
        return this.post(`/automations/${automationId}/toggle`, { enabled });
    }

    // ============================================
    // ANALYTICS ENDPOINTS
    // ============================================

    async getEnergyData(params = {}) {
        return this.get('/analytics/energy', { params });
    }

    async getDeviceStats(params = {}) {
        return this.get('/analytics/devices', { params });
    }

    async getPeakHours(params = {}) {
        return this.get('/analytics/peak-hours', { params });
    }

    async exportReport(type, format = 'json', params = {}) {
        return this.get(`/analytics/export/${type}`, { params, headers: { 'Accept': `application/${format}` } });
    }

    // ============================================
    // VOICE ENDPOINTS
    // ============================================

    async sendVoiceCommand(text, language = 'en') {
        return this.post('/voice/command', { text, language });
    }

    // ============================================
    // ESP32 ENDPOINTS
    // ============================================

    async registerESP32(data) {
        return this.post('/esp32/register', data);
    }

    async getESP32Devices() {
        return this.get('/esp32/devices');
    }

    async updateESP32Status(deviceId, status) {
        return this.put(`/esp32/devices/${deviceId}/status`, { status });
    }

    // ============================================
    // UTILITY METHODS
    // ============================================

    buildUrl(url, params = {}) {
        if (!params || Object.keys(params).length === 0) {
            return `${APIConfig.baseURL}${url}`;
        }
        
        const queryString = new URLSearchParams(params).toString();
        return `${APIConfig.baseURL}${url}?${queryString}`;
    }

    invalidateCache(url, params = {}) {
        this.cache.invalidate(`${APIConfig.baseURL}${url}`, params);
    }

    clearCache() {
        this.cache.clear();
    }

    setBaseURL(baseURL) {
        APIConfig.baseURL = baseURL;
    }

    setAuthTokenHeader(token) {
        this.setAuthToken(token);
        APIConfig.headers['Authorization'] = `Bearer ${token}`;
    }
}

// ============================================
// CREATE SINGLETON INSTANCE
// ============================================

const api = new APIClient();

// ============================================
// EXPORTS
// ============================================

// Expose to window
window.api = api;
window.APIClient = APIClient;
window.APIConfig = APIConfig;

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        api,
        APIClient,
        APIConfig
    };
}

// ES modules export
export {
    api,
    APIClient,
    APIConfig
};