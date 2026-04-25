/**
 * ESTIF HOME ULTIMATE - LOGIN MODULE
 * Secure authentication with multiple methods, remember me, and session management
 * Version: 2.0.0
 * Author: Estifanos Yohannis
 */

// ============================================
// DEPENDENCIES
// ============================================

// Import biometric module if available
import { biometric, biometricUI } from './biometric.js';

// ============================================
// LOGIN CONFIGURATION
// ============================================

const LoginConfig = {
    // Security settings
    maxLoginAttempts: 5,
    lockoutDuration: 900000, // 15 minutes in milliseconds
    sessionTimeout: 86400000, // 24 hours in milliseconds
    
    // Features
    enableBiometric: true,
    enable2FA: true,
    enableRememberMe: true,
    enableSocialLogin: false, // Google, Facebook, etc.
    
    // UI settings
    showPasswordStrength: true,
    showLoginHistory: true,
    showDeviceInfo: true,
    
    // Endpoints
    apiEndpoint: '/api/auth',
    loginEndpoint: '/api/auth/login',
    logoutEndpoint: '/api/auth/logout',
    verifyEndpoint: '/api/auth/verify',
    refreshEndpoint: '/api/auth/refresh',
    
    // Debug
    debug: false
};

// ============================================
// LOGIN MANAGER CLASS
// ============================================

class LoginManager {
    constructor() {
        this.loginAttempts = new Map();
        this.currentSession = null;
        this.refreshTimer = null;
        this.listeners = [];
        this.pending2FA = null;
        this.redirectUrl = null;
        
        this.init();
    }

    init() {
        this.loadSession();
        this.setupEventListeners();
        this.startSessionRefresh();
        LoginConfig.debug && console.log('[Login] Manager initialized');
    }

    // ============================================
    // SESSION MANAGEMENT
    // ============================================

    loadSession() {
        try {
            const savedSession = localStorage.getItem('estif_session');
            if (savedSession) {
                const session = JSON.parse(savedSession);
                const expiry = new Date(session.expiresAt);
                
                if (expiry > new Date()) {
                    this.currentSession = session;
                    this.notifyListeners('session_restored', session);
                    LoginConfig.debug && console.log('[Login] Session restored');
                } else {
                    this.clearSession();
                }
            }
        } catch (error) {
            console.error('[Login] Failed to load session:', error);
        }
    }

    saveSession(sessionData) {
        this.currentSession = {
            ...sessionData,
            expiresAt: new Date(Date.now() + LoginConfig.sessionTimeout).toISOString()
        };
        localStorage.setItem('estif_session', JSON.stringify(this.currentSession));
        this.notifyListeners('session_created', this.currentSession);
    }

    clearSession() {
        this.currentSession = null;
        localStorage.removeItem('estif_session');
        localStorage.removeItem('estif_remember_me');
        if (this.refreshTimer) {
            clearInterval(this.refreshTimer);
            this.refreshTimer = null;
        }
        this.notifyListeners('session_cleared');
    }

    startSessionRefresh() {
        // Refresh token every hour
        this.refreshTimer = setInterval(async () => {
            if (this.currentSession && this.currentSession.refreshToken) {
                try {
                    const refreshed = await this.refreshSession();
                    if (!refreshed) {
                        this.logout();
                    }
                } catch (error) {
                    LoginConfig.debug && console.log('[Login] Session refresh failed');
                }
            }
        }, 3600000); // 1 hour
    }

    async refreshSession() {
        if (!this.currentSession?.refreshToken) return false;
        
        try {
            const response = await fetch(LoginConfig.refreshEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refreshToken: this.currentSession.refreshToken })
            });
            
            if (response.ok) {
                const data = await response.json();
                this.currentSession.token = data.token;
                this.currentSession.refreshToken = data.refreshToken;
                localStorage.setItem('estif_session', JSON.stringify(this.currentSession));
                return true;
            }
        } catch (error) {
            LoginConfig.debug && console.log('[Login] Refresh error:', error);
        }
        return false;
    }

    // ============================================
    // AUTHENTICATION METHODS
    // ============================================

    async login(email, password, options = {}) {
        // Check for lockout
        if (this.isLockedOut(email)) {
            const remaining = this.getLockoutRemaining(email);
            return {
                success: false,
                error: `Too many failed attempts. Try again in ${Math.ceil(remaining / 60000)} minutes.`,
                locked: true,
                remainingTime: remaining
            };
        }

        try {
            const response = await fetch(LoginConfig.loginEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password, ...options })
            });

            const data = await response.json();

            if (response.ok) {
                // Reset login attempts on success
                this.resetLoginAttempts(email);
                
                // Check if 2FA is required
                if (data.requires2FA) {
                    this.pending2FA = { email, tempToken: data.tempToken };
                    return {
                        success: true,
                        requires2FA: true,
                        message: '2FA verification required'
                    };
                }
                
                // Handle remember me
                if (options.rememberMe) {
                    localStorage.setItem('estif_remember_me', email);
                }
                
                // Save session
                this.saveSession({
                    user: data.user,
                    token: data.token,
                    refreshToken: data.refreshToken
                });
                
                // Record login history
                this.recordLoginHistory(email);
                
                this.notifyListeners('login_success', { email, user: data.user });
                LoginConfig.debug && console.log('[Login] Successful login:', email);
                
                return {
                    success: true,
                    user: data.user,
                    token: data.token,
                    redirectUrl: options.redirectUrl || '/dashboard'
                };
            } else {
                this.recordFailedAttempt(email);
                return { success: false, error: data.message || 'Invalid email or password' };
            }
        } catch (error) {
            console.error('[Login] Login error:', error);
            return { success: false, error: 'Network error. Please try again.' };
        }
    }

    async verify2FA(code, backupCode = null) {
        if (!this.pending2FA) {
            return { success: false, error: 'No pending 2FA verification' };
        }

        try {
            const response = await fetch(`${LoginConfig.apiEndpoint}/verify-2fa`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    tempToken: this.pending2FA.tempToken,
                    code,
                    backupCode
                })
            });

            const data = await response.json();

            if (response.ok) {
                this.saveSession({
                    user: data.user,
                    token: data.token,
                    refreshToken: data.refreshToken
                });
                
                this.pending2FA = null;
                
                return {
                    success: true,
                    user: data.user,
                    token: data.token
                };
            } else {
                return { success: false, error: data.message || 'Invalid verification code' };
            }
        } catch (error) {
            return { success: false, error: 'Verification failed. Please try again.' };
        }
    }

    async loginWithBiometric(userId) {
        if (!LoginConfig.enableBiometric) {
            return { success: false, error: 'Biometric login not enabled' };
        }

        const result = await biometric.authenticate(userId);
        
        if (result.success) {
            // Auto-login with stored credentials
            const savedEmail = localStorage.getItem('estif_remember_me');
            if (savedEmail) {
                // Get stored password hash or token
                const storedToken = localStorage.getItem(`estif_token_${userId}`);
                if (storedToken) {
                    return await this.loginWithToken(storedToken);
                }
            }
        }
        
        return result;
    }

    async loginWithToken(token) {
        try {
            const response = await fetch(`${LoginConfig.apiEndpoint}/verify-token`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token })
            });

            const data = await response.json();

            if (response.ok) {
                this.saveSession({
                    user: data.user,
                    token: data.token,
                    refreshToken: data.refreshToken
                });
                
                return { success: true, user: data.user };
            }
        } catch (error) {
            return { success: false, error: 'Invalid token' };
        }
        
        return { success: false, error: 'Invalid token' };
    }

    // ============================================
    // LOGOUT
    // ============================================

    async logout(redirectToLogin = true) {
        try {
            if (this.currentSession?.token) {
                await fetch(LoginConfig.logoutEndpoint, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${this.currentSession.token}`,
                        'Content-Type': 'application/json'
                    }
                });
            }
        } catch (error) {
            // Silent fail
        }
        
        this.clearSession();
        this.notifyListeners('logout');
        LoginConfig.debug && console.log('[Login] User logged out');
        
        if (redirectToLogin) {
            window.location.href = '/login';
        }
    }

    // ============================================
    // ATTEMPT TRACKING
    // ============================================

    recordFailedAttempt(email) {
        const attempts = this.loginAttempts.get(email) || { count: 0, firstAttempt: Date.now() };
        attempts.count++;
        attempts.lastAttempt = Date.now();
        this.loginAttempts.set(email, attempts);
        
        LoginConfig.debug && console.log(`[Login] Failed attempt ${attempts.count} for ${email}`);
    }

    resetLoginAttempts(email) {
        this.loginAttempts.delete(email);
    }

    isLockedOut(email) {
        const attempts = this.loginAttempts.get(email);
        if (!attempts || attempts.count < LoginConfig.maxLoginAttempts) {
            return false;
        }
        
        const timeSinceFirst = Date.now() - attempts.firstAttempt;
        return timeSinceFirst < LoginConfig.lockoutDuration;
    }

    getLockoutRemaining(email) {
        const attempts = this.loginAttempts.get(email);
        if (!attempts) return 0;
        
        const elapsed = Date.now() - attempts.firstAttempt;
        return Math.max(0, LoginConfig.lockoutDuration - elapsed);
    }

    // ============================================
    // LOGIN HISTORY
    // ============================================

    async recordLoginHistory(email) {
        const historyEntry = {
            email,
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent,
            platform: navigator.platform,
            ip: await this.getClientIP()
        };
        
        // Store in localStorage for demo (would be server-side in production)
        const history = this.getLoginHistory();
        history.unshift(historyEntry);
        if (history.length > 20) history.pop();
        localStorage.setItem('estif_login_history', JSON.stringify(history));
    }

    getLoginHistory() {
        try {
            return JSON.parse(localStorage.getItem('estif_login_history') || '[]');
        } catch {
            return [];
        }
    }

    async getClientIP() {
        try {
            const response = await fetch('https://api.ipify.org?format=json');
            const data = await response.json();
            return data.ip;
        } catch {
            return 'Unknown';
        }
    }

    // ============================================
    // PASSWORD MANAGEMENT
    // ============================================

    validatePassword(password) {
        const checks = {
            length: password.length >= 8,
            uppercase: /[A-Z]/.test(password),
            lowercase: /[a-z]/.test(password),
            number: /[0-9]/.test(password),
            special: /[!@#$%^&*(),.?":{}|<>]/.test(password)
        };
        
        const score = Object.values(checks).filter(Boolean).length;
        let strength = 'weak';
        
        if (score >= 5) strength = 'very-strong';
        else if (score >= 4) strength = 'strong';
        else if (score >= 3) strength = 'medium';
        else if (score >= 2) strength = 'weak';
        else strength = 'very-weak';
        
        return {
            isValid: score >= 3,
            strength,
            score,
            checks
        };
    }

    getPasswordStrengthLabel(strength) {
        const labels = {
            'very-weak': 'Very Weak',
            'weak': 'Weak',
            'medium': 'Medium',
            'strong': 'Strong',
            'very-strong': 'Very Strong'
        };
        return labels[strength] || 'Unknown';
    }

    async requestPasswordReset(email) {
        try {
            const response = await fetch(`${LoginConfig.apiEndpoint}/forgot-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });
            
            return { success: response.ok };
        } catch (error) {
            return { success: false, error: 'Failed to send reset request' };
        }
    }

    async resetPassword(token, newPassword) {
        const validation = this.validatePassword(newPassword);
        if (!validation.isValid) {
            return { success: false, error: 'Password does not meet security requirements' };
        }
        
        try {
            const response = await fetch(`${LoginConfig.apiEndpoint}/reset-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, newPassword })
            });
            
            return { success: response.ok };
        } catch (error) {
            return { success: false, error: 'Failed to reset password' };
        }
    }

    // ============================================
    // SESSION INFO
    // ============================================

    isAuthenticated() {
        return this.currentSession !== null && new Date(this.currentSession.expiresAt) > new Date();
    }

    getCurrentUser() {
        return this.currentSession?.user || null;
    }

    getAuthToken() {
        return this.currentSession?.token || null;
    }

    getSessionExpiry() {
        return this.currentSession?.expiresAt || null;
    }

    getSessionTimeRemaining() {
        if (!this.currentSession) return 0;
        const expiry = new Date(this.currentSession.expiresAt);
        const remaining = expiry - new Date();
        return Math.max(0, remaining);
    }

    // ============================================
    // REDIRECT MANAGEMENT
    // ============================================

    setRedirectUrl(url) {
        this.redirectUrl = url;
    }

    getRedirectUrl() {
        const url = this.redirectUrl;
        this.redirectUrl = null;
        return url || '/dashboard';
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

    setupEventListeners() {
        // Auto-logout on tab close (optional)
        window.addEventListener('beforeunload', () => {
            if (!this.currentSession) return;
            // Don't clear session, just notify
            this.notifyListeners('session_will_expire');
        });
        
        // Handle online/offline
        window.addEventListener('online', () => {
            this.notifyListeners('online');
        });
        
        window.addEventListener('offline', () => {
            this.notifyListeners('offline');
        });
    }
}

// ============================================
// LOGIN UI COMPONENT
// ============================================

class LoginUI {
    constructor(loginManager) {
        this.loginManager = loginManager;
        this.form = null;
        this.elements = {};
        this.isLoading = false;
        this.init();
    }

    init() {
        this.cacheElements();
        this.bindEvents();
        this.setupBiometric();
        this.checkSavedCredentials();
        LoginConfig.debug && console.log('[LoginUI] Initialized');
    }

    cacheElements() {
        this.form = document.getElementById('loginForm');
        this.elements = {
            email: document.getElementById('loginEmail'),
            password: document.getElementById('loginPassword'),
            rememberMe: document.getElementById('rememberMe'),
            submitBtn: document.querySelector('#loginForm button[type="submit"]'),
            errorMsg: document.getElementById('loginError'),
            biometricBtn: document.getElementById('biometricLoginBtn'),
            forgotPassword: document.getElementById('forgotPassword'),
            passwordStrength: document.getElementById('passwordStrength')
        };
    }

    bindEvents() {
        if (this.form) {
            this.form.addEventListener('submit', (e) => this.handleSubmit(e));
        }
        
        if (this.elements.password) {
            this.elements.password.addEventListener('input', () => this.updatePasswordStrength());
        }
        
        if (this.elements.forgotPassword) {
            this.elements.forgotPassword.addEventListener('click', (e) => this.handleForgotPassword(e));
        }
    }

    async handleSubmit(event) {
        event.preventDefault();
        
        if (this.isLoading) return;
        
        const email = this.elements.email?.value.trim();
        const password = this.elements.password?.value;
        
        if (!email || !password) {
            this.showError('Please enter email and password');
            return;
        }
        
        this.setLoading(true);
        
        const options = {
            rememberMe: this.elements.rememberMe?.checked || false,
            redirectUrl: this.loginManager.getRedirectUrl()
        };
        
        const result = await this.loginManager.login(email, password, options);
        
        this.setLoading(false);
        
        if (result.success) {
            if (result.requires2FA) {
                this.show2FADialog();
            } else {
                this.handleSuccess(result);
            }
        } else {
            this.showError(result.error);
        }
    }

    handleSuccess(result) {
        this.showSuccess('Login successful! Redirecting...');
        
        // Redirect after short delay
        setTimeout(() => {
            window.location.href = result.redirectUrl;
        }, 1000);
    }

    show2FADialog() {
        const code = prompt('Enter your 2FA verification code:');
        if (code) {
            this.verify2FA(code);
        }
    }

    async verify2FA(code) {
        this.setLoading(true);
        const result = await this.loginManager.verify2FA(code);
        this.setLoading(false);
        
        if (result.success) {
            this.handleSuccess({ redirectUrl: '/dashboard' });
        } else {
            this.showError(result.error);
        }
    }

    setupBiometric() {
        if (!LoginConfig.enableBiometric) return;
        
        const hasBiometric = biometric?.isEnabled;
        if (hasBiometric && this.elements.biometricBtn) {
            this.elements.biometricBtn.style.display = 'flex';
            this.elements.biometricBtn.addEventListener('click', () => this.handleBiometricLogin());
        }
    }

    async handleBiometricLogin() {
        const savedEmail = localStorage.getItem('estif_remember_me');
        if (!savedEmail) {
            this.showError('Please login with password first to enable biometric');
            return;
        }
        
        this.setLoading(true);
        
        // Get user ID from saved email
        const userId = btoa(savedEmail); // Simple encoding for demo
        
        const result = await this.loginManager.loginWithBiometric(userId);
        
        this.setLoading(false);
        
        if (result.success) {
            this.handleSuccess(result);
        } else {
            this.showError(result.error || 'Biometric authentication failed');
        }
    }

    checkSavedCredentials() {
        const savedEmail = localStorage.getItem('estif_remember_me');
        if (savedEmail && this.elements.email) {
            this.elements.email.value = savedEmail;
            if (this.elements.rememberMe) {
                this.elements.rememberMe.checked = true;
            }
            
            // Auto-focus password
            if (this.elements.password) {
                this.elements.password.focus();
            }
        }
    }

    updatePasswordStrength() {
        if (!LoginConfig.showPasswordStrength) return;
        
        const password = this.elements.password?.value || '';
        const validation = this.loginManager.validatePassword(password);
        
        if (!this.elements.passwordStrength) return;
        
        if (password.length === 0) {
            this.elements.passwordStrength.style.display = 'none';
            return;
        }
        
        this.elements.passwordStrength.style.display = 'block';
        
        const strengthPercent = (validation.score / 5) * 100;
        const strengthColor = this.getStrengthColor(validation.strength);
        
        this.elements.passwordStrength.innerHTML = `
            <div class="password-strength-bar">
                <div class="password-strength-fill" style="width: ${strengthPercent}%; background: ${strengthColor}"></div>
            </div>
            <div class="password-strength-text" style="color: ${strengthColor}">
                ${this.loginManager.getPasswordStrengthLabel(validation.strength)}
            </div>
        `;
    }

    getStrengthColor(strength) {
        const colors = {
            'very-weak': '#ef476f',
            'weak': '#ffd166',
            'medium': '#4cc9f0',
            'strong': '#06d6a0',
            'very-strong': '#06d6a0'
        };
        return colors[strength] || '#6c757d';
    }

    async handleForgotPassword(event) {
        event.preventDefault();
        
        const email = this.elements.email?.value.trim();
        if (!email) {
            this.showError('Please enter your email address');
            return;
        }
        
        this.setLoading(true);
        const result = await this.loginManager.requestPasswordReset(email);
        this.setLoading(false);
        
        if (result.success) {
            this.showSuccess('Password reset link sent to your email');
        } else {
            this.showError(result.error || 'Failed to send reset link');
        }
    }

    setLoading(loading) {
        this.isLoading = loading;
        
        if (this.elements.submitBtn) {
            this.elements.submitBtn.disabled = loading;
            this.elements.submitBtn.innerHTML = loading ? 
                '<i class="fas fa-spinner fa-spin"></i> Loading...' : 
                '<i class="fas fa-sign-in-alt"></i> Login';
        }
    }

    showError(message) {
        if (this.elements.errorMsg) {
            this.elements.errorMsg.textContent = message;
            this.elements.errorMsg.style.display = 'block';
            
            setTimeout(() => {
                if (this.elements.errorMsg) {
                    this.elements.errorMsg.style.display = 'none';
                }
            }, 5000);
        }
        
        // Also show toast if available
        if (window.showToast) {
            window.showToast(message, 'error');
        }
    }

    showSuccess(message) {
        if (window.showToast) {
            window.showToast(message, 'success');
        }
    }
}

// ============================================
// CREATE SINGLETON INSTANCES
// ============================================

const loginManager = new LoginManager();
const loginUI = new LoginUI(loginManager);

// ============================================
// EXPORTS
// ============================================

// Expose to window
window.loginManager = loginManager;
window.loginUI = loginUI;
window.LoginManager = LoginManager;
window.LoginConfig = LoginConfig;

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        loginManager,
        loginUI,
        LoginManager,
        LoginConfig
    };
}

// ES modules export
export {
    loginManager,
    loginUI,
    LoginManager,
    LoginConfig
};