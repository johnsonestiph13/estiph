/**
 * ESTIF HOME ULTIMATE - SESSION MANAGEMENT MODULE
 * Secure session handling with JWT tokens, refresh tokens, and activity tracking
 * Version: 2.0.0
 * Author: Estifanos Yohannis
 */

// ============================================
// SESSION CONFIGURATION
// ============================================

const SessionConfig = {
    // Token settings
    tokenKey: 'estif_auth_token',
    refreshTokenKey: 'estif_refresh_token',
    sessionKey: 'estif_session',
    
    // Timeouts (milliseconds)
    sessionTimeout: 86400000, // 24 hours
    refreshTokenTimeout: 604800000, // 7 days
    idleTimeout: 1800000, // 30 minutes
    warningBeforeTimeout: 60000, // 1 minute warning
    
    // Security
    secureCookies: true,
    sameSite: 'strict',
    httpOnly: true,
    
    // Features
    enableIdleLogout: true,
    enableMultiTabSync: true,
    enableActivityTracking: true,
    enableSessionRecovery: true,
    
    // Endpoints
    refreshEndpoint: '/api/auth/refresh',
    validateEndpoint: '/api/auth/validate',
    logoutEndpoint: '/api/auth/logout',
    sessionEndpoint: '/api/auth/session',
    
    // Debug
    debug: false
};

// ============================================
// SESSION MANAGER
// ============================================

class SessionManager {
    constructor() {
        this.session = null;
        this.refreshTimer = null;
        this.idleTimer = null;
        this.warningTimer = null;
        this.activeTabId = null;
        this.listeners = [];
        this.isRefreshing = false;
        this.pendingRequests = [];
        
        this.init();
    }

    init() {
        this.loadSession();
        this.setupEventListeners();
        this.setupActivityTracking();
        this.setupMultiTabSync();
        this.startIdleTimer();
        this.startRefreshTimer();
        SessionConfig.debug && console.log('[Session] Manager initialized');
    }

    // ============================================
    // SESSION LOADING & STORAGE
    // ============================================

    loadSession() {
        try {
            const savedSession = localStorage.getItem(SessionConfig.sessionKey);
            if (savedSession) {
                const session = JSON.parse(savedSession);
                const expiry = new Date(session.expiresAt);
                
                if (expiry > new Date()) {
                    this.session = session;
                    this.validateSession();
                    SessionConfig.debug && console.log('[Session] Session loaded');
                } else {
                    this.clearSession();
                }
            }
        } catch (error) {
            SessionConfig.debug && console.log('[Session] Failed to load session');
        }
    }

    saveSession() {
        if (this.session) {
            localStorage.setItem(SessionConfig.sessionKey, JSON.stringify(this.session));
            this.notifyListeners('session_saved', this.session);
        }
    }

    clearSession() {
        this.session = null;
        localStorage.removeItem(SessionConfig.sessionKey);
        localStorage.removeItem(SessionConfig.tokenKey);
        localStorage.removeItem(SessionConfig.refreshTokenKey);
        this.stopRefreshTimer();
        this.stopIdleTimer();
        this.notifyListeners('session_cleared');
        SessionConfig.debug && console.log('[Session] Session cleared');
    }

    // ============================================
    // SESSION VALIDATION
    // ============================================

    async validateSession() {
        if (!this.session?.token) return false;

        try {
            const response = await fetch(SessionConfig.validateEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.session.token}`
                }
            });

            const data = await response.json();

            if (response.ok && data.valid) {
                this.updateLastActivity();
                return true;
            } else {
                await this.refreshToken();
                return false;
            }
        } catch (error) {
            SessionConfig.debug && console.log('[Session] Validation failed');
            return false;
        }
    }

    async refreshToken() {
        if (this.isRefreshing) {
            // Wait for pending refresh to complete
            return new Promise((resolve) => {
                this.pendingRequests.push(resolve);
            });
        }

        this.isRefreshing = true;

        try {
            const refreshToken = localStorage.getItem(SessionConfig.refreshTokenKey);
            if (!refreshToken) {
                throw new Error('No refresh token');
            }

            const response = await fetch(SessionConfig.refreshEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refreshToken })
            });

            const data = await response.json();

            if (response.ok) {
                this.updateTokens(data.token, data.refreshToken);
                this.isRefreshing = false;
                this.pendingRequests.forEach(resolve => resolve(true));
                this.pendingRequests = [];
                this.notifyListeners('token_refreshed');
                SessionConfig.debug && console.log('[Session] Token refreshed');
                return true;
            } else {
                throw new Error('Refresh failed');
            }
        } catch (error) {
            this.isRefreshing = false;
            this.pendingRequests.forEach(resolve => resolve(false));
            this.pendingRequests = [];
            this.clearSession();
            this.notifyListeners('session_expired');
            SessionConfig.debug && console.log('[Session] Refresh failed, session expired');
            return false;
        }
    }

    updateTokens(token, refreshToken) {
        if (this.session) {
            this.session.token = token;
            this.session.refreshToken = refreshToken;
            this.session.expiresAt = new Date(Date.now() + SessionConfig.sessionTimeout).toISOString();
            this.saveSession();
            localStorage.setItem(SessionConfig.tokenKey, token);
            localStorage.setItem(SessionConfig.refreshTokenKey, refreshToken);
        }
    }

    // ============================================
    // TOKEN MANAGEMENT
    // ============================================

    getToken() {
        return this.session?.token || localStorage.getItem(SessionConfig.tokenKey);
    }

    getRefreshToken() {
        return this.session?.refreshToken || localStorage.getItem(SessionConfig.refreshTokenKey);
    }

    isTokenValid() {
        if (!this.session?.expiresAt) return false;
        return new Date(this.session.expiresAt) > new Date();
    }

    getTokenExpiry() {
        return this.session?.expiresAt || null;
    }

    getTokenRemainingTime() {
        if (!this.session?.expiresAt) return 0;
        const remaining = new Date(this.session.expiresAt) - new Date();
        return Math.max(0, remaining);
    }

    // ============================================
    // ACTIVITY TRACKING
    // ============================================

    setupActivityTracking() {
        if (!SessionConfig.enableActivityTracking) return;

        const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
        
        const updateActivity = () => {
            this.updateLastActivity();
        };

        events.forEach(event => {
            document.addEventListener(event, updateActivity);
        });
    }

    updateLastActivity() {
        if (this.session) {
            this.session.lastActivity = new Date().toISOString();
            this.saveSession();
            this.resetIdleTimer();
        }
    }

    getLastActivity() {
        return this.session?.lastActivity ? new Date(this.session.lastActivity) : null;
    }

    getIdleTime() {
        const lastActivity = this.getLastActivity();
        if (!lastActivity) return 0;
        return Date.now() - lastActivity.getTime();
    }

    isIdle() {
        return this.getIdleTime() >= SessionConfig.idleTimeout;
    }

    // ============================================
    // IDLE TIMER
    // ============================================

    startIdleTimer() {
        if (!SessionConfig.enableIdleLogout) return;
        
        this.stopIdleTimer();
        
        this.idleTimer = setInterval(() => {
            if (this.isIdle() && this.session) {
                this.handleIdleTimeout();
            } else if (this.getIdleTime() >= SessionConfig.idleTimeout - SessionConfig.warningBeforeTimeout) {
                this.showIdleWarning();
            }
        }, 10000); // Check every 10 seconds
    }

    stopIdleTimer() {
        if (this.idleTimer) {
            clearInterval(this.idleTimer);
            this.idleTimer = null;
        }
        if (this.warningTimer) {
            clearTimeout(this.warningTimer);
            this.warningTimer = null;
        }
    }

    resetIdleTimer() {
        this.stopIdleTimer();
        this.startIdleTimer();
    }

    handleIdleTimeout() {
        this.notifyListeners('idle_timeout');
        this.logout();
        SessionConfig.debug && console.log('[Session] Idle timeout - user logged out');
    }

    showIdleWarning() {
        if (this.warningTimer) return;
        
        this.warningTimer = setTimeout(() => {
            this.notifyListeners('idle_warning', {
                timeout: SessionConfig.idleTimeout,
                remaining: SessionConfig.warningBeforeTimeout
            });
            this.warningTimer = null;
        }, this.getIdleTime() >= SessionConfig.idleTimeout - SessionConfig.warningBeforeTimeout ? 0 : 
           (SessionConfig.idleTimeout - SessionConfig.warningBeforeTimeout - this.getIdleTime()));
    }

    // ============================================
    // REFRESH TIMER
    // ============================================

    startRefreshTimer() {
        this.stopRefreshTimer();
        
        // Refresh token every hour
        this.refreshTimer = setInterval(async () => {
            if (this.session && this.isTokenValid()) {
                const remaining = this.getTokenRemainingTime();
                // Refresh if less than 1 hour remaining
                if (remaining < 3600000) {
                    await this.refreshToken();
                }
            }
        }, 3600000); // Check every hour
    }

    stopRefreshTimer() {
        if (this.refreshTimer) {
            clearInterval(this.refreshTimer);
            this.refreshTimer = null;
        }
    }

    // ============================================
    // MULTI-TAB SYNC
    // ============================================

    setupMultiTabSync() {
        if (!SessionConfig.enableMultiTabSync) return;

        window.addEventListener('storage', (event) => {
            if (event.key === SessionConfig.sessionKey) {
                this.loadSession();
                this.notifyListeners('session_synced');
                SessionConfig.debug && console.log('[Session] Session synced from another tab');
            }
        });

        // Generate unique tab ID
        this.activeTabId = 'tab_' + Date.now() + '_' + Math.random().toString(36).substr(2, 8);
        
        // Broadcast channel for real-time sync (if supported)
        if (window.BroadcastChannel) {
            this.broadcastChannel = new BroadcastChannel('estif_session');
            this.broadcastChannel.onmessage = (event) => {
                if (event.data.type === 'logout') {
                    this.logout(false);
                } else if (event.data.type === 'session_update') {
                    this.loadSession();
                }
            };
        }
    }

    broadcastToOtherTabs(message) {
        if (this.broadcastChannel) {
            this.broadcastChannel.postMessage(message);
        }
    }

    // ============================================
    // LOGOUT
    // ============================================

    async logout(notifyServer = true) {
        try {
            if (notifyServer && this.session?.token) {
                await fetch(SessionConfig.logoutEndpoint, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${this.session.token}`,
                        'Content-Type': 'application/json'
                    }
                });
            }
        } catch (error) {
            SessionConfig.debug && console.log('[Session] Logout server call failed');
        }

        this.clearSession();
        this.broadcastToOtherTabs({ type: 'logout' });
        this.notifyListeners('logout');
        
        if (notifyServer) {
            window.location.href = '/login';
        }
    }

    // ============================================
    // SESSION CREATION
    // ============================================

    createSession(user, token, refreshToken, rememberMe = false) {
        const sessionData = {
            user,
            token,
            refreshToken,
            createdAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + SessionConfig.sessionTimeout).toISOString(),
            lastActivity: new Date().toISOString(),
            rememberMe,
            sessionId: this.generateSessionId()
        };

        this.session = sessionData;
        this.saveSession();
        localStorage.setItem(SessionConfig.tokenKey, token);
        localStorage.setItem(SessionConfig.refreshTokenKey, refreshToken);
        
        this.startIdleTimer();
        this.startRefreshTimer();
        this.notifyListeners('session_created', this.session);
        
        SessionConfig.debug && console.log('[Session] Session created for user:', user.email);
        
        return this.session;
    }

    generateSessionId() {
        return 'sess_' + Date.now() + '_' + Math.random().toString(36).substr(2, 16);
    }

    // ============================================
    // SESSION INFO
    // ============================================

    getSession() {
        return this.session;
    }

    getUser() {
        return this.session?.user || null;
    }

    isAuthenticated() {
        return this.session !== null && this.isTokenValid();
    }

    getSessionDuration() {
        if (!this.session?.createdAt) return 0;
        return Date.now() - new Date(this.session.createdAt).getTime();
    }

    getSessionRemaining() {
        if (!this.session?.expiresAt) return 0;
        return Math.max(0, new Date(this.session.expiresAt) - new Date());
    }

    getSessionSummary() {
        return {
            authenticated: this.isAuthenticated(),
            user: this.getUser(),
            createdAt: this.session?.createdAt,
            expiresAt: this.session?.expiresAt,
            lastActivity: this.session?.lastActivity,
            idleTime: this.getIdleTime(),
            remainingTime: this.getSessionRemaining(),
            rememberMe: this.session?.rememberMe || false
        };
    }

    // ============================================
    // SESSION RECOVERY
    // ============================================

    async recoverSession() {
        if (!SessionConfig.enableSessionRecovery) return false;

        const refreshToken = this.getRefreshToken();
        if (!refreshToken) return false;

        try {
            const response = await fetch(SessionConfig.refreshEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refreshToken, recovery: true })
            });

            const data = await response.json();

            if (response.ok) {
                this.createSession(data.user, data.token, data.refreshToken);
                return true;
            }
        } catch (error) {
            SessionConfig.debug && console.log('[Session] Recovery failed');
        }
        
        return false;
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
    // UTILITY METHODS
    // ============================================

    setupEventListeners() {
        // Before unload - cleanup
        window.addEventListener('beforeunload', () => {
            if (this.broadcastChannel) {
                this.broadcastChannel.close();
            }
        });

        // Online/offline detection
        window.addEventListener('online', () => {
            this.notifyListeners('online');
            if (this.session) {
                this.validateSession();
            }
        });

        window.addEventListener('offline', () => {
            this.notifyListeners('offline');
        });

        // Visibility change - update activity when tab becomes visible
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                this.updateLastActivity();
            }
        });
    }

    // API request interceptor
    async getAuthHeaders() {
        let token = this.getToken();
        
        if (!token || !this.isTokenValid()) {
            const refreshed = await this.refreshToken();
            if (refreshed) {
                token = this.getToken();
            } else {
                return null;
            }
        }
        
        return {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        };
    }

    async authenticatedFetch(url, options = {}) {
        const headers = await this.getAuthHeaders();
        if (!headers) {
            this.notifyListeners('auth_required');
            return null;
        }
        
        const response = await fetch(url, {
            ...options,
            headers: {
                ...options.headers,
                ...headers
            }
        });
        
        if (response.status === 401) {
            const refreshed = await this.refreshToken();
            if (refreshed) {
                return this.authenticatedFetch(url, options);
            } else {
                this.notifyListeners('auth_required');
                return null;
            }
        }
        
        return response;
    }
}

// ============================================
// SESSION UI COMPONENT
// ============================================

class SessionUI {
    constructor(sessionManager) {
        this.sessionManager = sessionManager;
        this.init();
    }

    init() {
        this.createIdleWarningModal();
        this.bindEvents();
        this.updateUI();
        SessionConfig.debug && console.log('[SessionUI] Initialized');
    }

    createIdleWarningModal() {
        const modalHTML = `
            <div id="idle-warning-modal" class="modal-overlay" style="display: none;">
                <div class="modal idle-warning-modal">
                    <div class="modal-header">
                        <h3>Session Expiring Soon</h3>
                    </div>
                    <div class="modal-body">
                        <p>Your session will expire due to inactivity.</p>
                        <p id="idle-timer">You will be logged out in <span id="idle-countdown">60</span> seconds.</p>
                        <p>Click "Stay Logged In" to continue your session.</p>
                    </div>
                    <div class="modal-footer">
                        <button id="stay-logged-in" class="btn btn-primary">Stay Logged In</button>
                        <button id="logout-now" class="btn btn-secondary">Logout</button>
                    </div>
                </div>
            </div>
        `;
        
        if (!document.getElementById('idle-warning-modal')) {
            document.body.insertAdjacentHTML('beforeend', modalHTML);
        }
        
        this.modal = document.getElementById('idle-warning-modal');
        this.countdown = document.getElementById('idle-countdown');
        this.countdownInterval = null;
    }

    bindEvents() {
        this.sessionManager.addEventListener('idle_warning', () => {
            this.showIdleWarning();
        });
        
        this.sessionManager.addEventListener('idle_timeout', () => {
            this.hideIdleWarning();
            this.showLogoutMessage();
        });
        
        this.sessionManager.addEventListener('session_expired', () => {
            this.showSessionExpiredMessage();
        });
        
        const stayBtn = document.getElementById('stay-logged-in');
        const logoutBtn = document.getElementById('logout-now');
        
        if (stayBtn) {
            stayBtn.addEventListener('click', () => {
                this.sessionManager.updateLastActivity();
                this.hideIdleWarning();
            });
        }
        
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                this.sessionManager.logout();
            });
        }
    }

    showIdleWarning() {
        if (!this.modal) return;
        
        this.modal.style.display = 'flex';
        let seconds = 60;
        
        if (this.countdownInterval) clearInterval(this.countdownInterval);
        
        this.countdownInterval = setInterval(() => {
            seconds--;
            if (this.countdown) this.countdown.textContent = seconds;
            
            if (seconds <= 0) {
                clearInterval(this.countdownInterval);
            }
        }, 1000);
    }

    hideIdleWarning() {
        if (this.modal) {
            this.modal.style.display = 'none';
        }
        if (this.countdownInterval) {
            clearInterval(this.countdownInterval);
            this.countdownInterval = null;
        }
    }

    showLogoutMessage() {
        if (window.showToast) {
            window.showToast('Session expired due to inactivity', 'warning');
        }
    }

    showSessionExpiredMessage() {
        if (window.showToast) {
            window.showToast('Your session has expired. Please login again.', 'warning');
        }
    }

    updateUI() {
        const isAuthenticated = this.sessionManager.isAuthenticated();
        const user = this.sessionManager.getUser();
        
        // Update UI elements based on session state
        const loginBtn = document.getElementById('login-btn');
        const logoutBtn = document.getElementById('logout-btn');
        const userMenu = document.getElementById('user-menu');
        
        if (loginBtn) loginBtn.style.display = isAuthenticated ? 'none' : 'block';
        if (logoutBtn) logoutBtn.style.display = isAuthenticated ? 'block' : 'none';
        if (userMenu) userMenu.style.display = isAuthenticated ? 'block' : 'none';
        
        // Update user display
        if (user && document.getElementById('user-name')) {
            document.getElementById('user-name').textContent = user.name;
        }
    }
}

// ============================================
// CSS STYLES (Auto-injected)
// ============================================

const sessionStyles = `
    .idle-warning-modal {
        max-width: 400px;
        text-align: center;
    }
    
    .idle-warning-modal .modal-body {
        padding: 20px;
    }
    
    #idle-countdown {
        font-weight: bold;
        color: var(--warning);
        font-size: 18px;
    }
    
    .session-status {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 4px 12px;
        border-radius: 20px;
        font-size: 12px;
    }
    
    .session-status.active {
        background: var(--success-soft);
        color: var(--success);
    }
    
    .session-status.expiring {
        background: var(--warning-soft);
        color: var(--warning);
    }
    
    .session-status.expired {
        background: var(--danger-soft);
        color: var(--danger);
    }
`;

// Inject styles
if (typeof document !== 'undefined') {
    const styleSheet = document.createElement('style');
    styleSheet.textContent = sessionStyles;
    document.head.appendChild(styleSheet);
}

// ============================================
// CREATE SINGLETON INSTANCES
// ============================================

const sessionManager = new SessionManager();
const sessionUI = new SessionUI(sessionManager);

// ============================================
// AXIOS/FETCH INTERCEPTOR (Optional)
// ============================================

if (typeof window !== 'undefined') {
    // Monkey patch fetch to include auth header automatically
    const originalFetch = window.fetch;
    window.fetch = async function(url, options = {}) {
        // Skip for auth endpoints
        if (url.includes('/api/auth/') || url.includes('/login') || url.includes('/register')) {
            return originalFetch(url, options);
        }
        
        // Add auth header if session exists
        if (sessionManager.isAuthenticated()) {
            const token = sessionManager.getToken();
            if (token) {
                options.headers = {
                    ...options.headers,
                    'Authorization': `Bearer ${token}`
                };
            }
        }
        
        const response = await originalFetch(url, options);
        
        // Handle 401 Unauthorized
        if (response.status === 401) {
            const refreshed = await sessionManager.refreshToken();
            if (refreshed) {
                // Retry the request with new token
                const newToken = sessionManager.getToken();
                options.headers['Authorization'] = `Bearer ${newToken}`;
                return originalFetch(url, options);
            } else {
                sessionManager.logout();
                window.location.href = '/login';
            }
        }
        
        return response;
    };
}

// ============================================
// EXPORTS
// ============================================

// Expose to window
window.sessionManager = sessionManager;
window.sessionUI = sessionUI;
window.SessionManager = SessionManager;
window.SessionConfig = SessionConfig;

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        sessionManager,
        sessionUI,
        SessionManager,
        SessionConfig
    };
}

// ES modules export
export {
    sessionManager,
    sessionUI,
    SessionManager,
    SessionConfig
};