/**
 * ESTIF HOME ULTIMATE - OAUTH/SOCIAL LOGIN MODULE
 * Google, Facebook, Apple, and GitHub authentication integration
 * Version: 2.0.0
 * Author: Estifanos Yohannis
 */

// ============================================
// OAUTH CONFIGURATION
// ============================================

const OAuthConfig = {
    // Provider settings
    providers: {
        google: {
            enabled: true,
            clientId: null, // Set from backend
            scope: 'email profile',
            redirectUri: '/auth/google/callback',
            icon: 'fab fa-google',
            color: '#DB4437',
            name: 'Google'
        },
        facebook: {
            enabled: true,
            clientId: null,
            scope: 'email public_profile',
            redirectUri: '/auth/facebook/callback',
            icon: 'fab fa-facebook',
            color: '#4267B2',
            name: 'Facebook'
        },
        apple: {
            enabled: false,
            clientId: null,
            scope: 'name email',
            redirectUri: '/auth/apple/callback',
            icon: 'fab fa-apple',
            color: '#000000',
            name: 'Apple'
        },
        github: {
            enabled: true,
            clientId: null,
            scope: 'user:email',
            redirectUri: '/auth/github/callback',
            icon: 'fab fa-github',
            color: '#333333',
            name: 'GitHub'
        },
        microsoft: {
            enabled: false,
            clientId: null,
            scope: 'User.Read',
            redirectUri: '/auth/microsoft/callback',
            icon: 'fab fa-microsoft',
            color: '#00A4EF',
            name: 'Microsoft'
        }
    },
    
    // Security settings
    stateLength: 32,
    stateExpiry: 600000, // 10 minutes
    pkceEnabled: true,
    
    // Storage
    storageKey: 'estif_oauth_state',
    userStorageKey: 'estif_oauth_user',
    
    // Endpoints
    apiEndpoint: '/api/auth/oauth',
    loginEndpoint: '/api/auth/oauth/login',
    callbackEndpoint: '/api/auth/oauth/callback',
    
    // UI
    showProviderIcons: true,
    buttonStyle: 'rounded',
    
    // Debug
    debug: false
};

// ============================================
// PKCE (Proof Key for Code Exchange) HELPER
// ============================================

class PKCEHelper {
    static async generateCodeVerifier() {
        const array = new Uint8Array(32);
        crypto.getRandomValues(array);
        return this.base64URLEncode(array);
    }

    static async generateCodeChallenge(verifier) {
        const encoder = new TextEncoder();
        const data = encoder.encode(verifier);
        const hash = await crypto.subtle.digest('SHA-256', data);
        return this.base64URLEncode(new Uint8Array(hash));
    }

    static base64URLEncode(buffer) {
        const base64 = btoa(String.fromCharCode.apply(null, buffer));
        return base64
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');
    }

    static generateState() {
        const array = new Uint8Array(OAuthConfig.stateLength);
        crypto.getRandomValues(array);
        return this.base64URLEncode(array);
    }
}

// ============================================
// OAUTH STATE MANAGER
// ============================================

class OAuthStateManager {
    constructor() {
        this.states = new Map();
        this.loadStates();
    }

    loadStates() {
        try {
            const saved = localStorage.getItem(OAuthConfig.storageKey);
            if (saved) {
                const data = JSON.parse(saved);
                for (const [key, value] of Object.entries(data)) {
                    if (value.expiry > Date.now()) {
                        this.states.set(key, value);
                    }
                }
            }
        } catch (error) {
            OAuthConfig.debug && console.log('[OAuth] Failed to load states');
        }
    }

    saveStates() {
        try {
            const data = {};
            for (const [key, value] of this.states.entries()) {
                data[key] = value;
            }
            localStorage.setItem(OAuthConfig.storageKey, JSON.stringify(data));
        } catch (error) {
            OAuthConfig.debug && console.log('[OAuth] Failed to save states');
        }
    }

    createState(provider, redirectUrl) {
        const state = PKCEHelper.generateState();
        const codeVerifier = PKCEHelper.generateCodeVerifier();
        
        this.states.set(state, {
            provider,
            redirectUrl,
            codeVerifier,
            createdAt: Date.now(),
            expiry: Date.now() + OAuthConfig.stateExpiry
        });
        
        this.saveStates();
        return { state, codeVerifier };
    }

    verifyState(state, codeVerifier) {
        const stored = this.states.get(state);
        
        if (!stored) {
            return { valid: false, error: 'Invalid state parameter' };
        }
        
        if (Date.now() > stored.expiry) {
            this.states.delete(state);
            this.saveStates();
            return { valid: false, error: 'State expired' };
        }
        
        if (OAuthConfig.pkceEnabled && stored.codeVerifier !== codeVerifier) {
            return { valid: false, error: 'Invalid code verifier' };
        }
        
        const result = {
            valid: true,
            provider: stored.provider,
            redirectUrl: stored.redirectUrl
        };
        
        // Clean up used state
        this.states.delete(state);
        this.saveStates();
        
        return result;
    }

    clearExpired() {
        let cleared = false;
        for (const [key, value] of this.states.entries()) {
            if (Date.now() > value.expiry) {
                this.states.delete(key);
                cleared = true;
            }
        }
        if (cleared) this.saveStates();
    }
}

// ============================================
// OAUTH PROVIDER HANDLER
// ============================================

class OAuthProvider {
    constructor(provider, config) {
        this.provider = provider;
        this.config = config;
        this.stateManager = new OAuthStateManager();
    }

    getAuthorizationUrl(redirectUrl) {
        const { state, codeVerifier } = this.stateManager.createState(this.provider, redirectUrl);
        
        let authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
            `client_id=${this.config.clientId}&` +
            `redirect_uri=${encodeURIComponent(OAuthConfig.providers[this.provider].redirectUri)}&` +
            `response_type=code&` +
            `scope=${encodeURIComponent(this.config.scope)}&` +
            `state=${state}`;
        
        if (OAuthConfig.pkceEnabled && codeVerifier) {
            // Store codeVerifier for later use
            sessionStorage.setItem(`oauth_pkce_${state}`, codeVerifier);
        }
        
        return authUrl;
    }

    async handleCallback(code, state, codeVerifier) {
        const verification = this.stateManager.verifyState(state, codeVerifier);
        
        if (!verification.valid) {
            return { success: false, error: verification.error };
        }
        
        try {
            const response = await fetch(OAuthConfig.callbackEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    provider: this.provider,
                    code,
                    state,
                    codeVerifier
                })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                return {
                    success: true,
                    user: data.user,
                    token: data.token,
                    isNewUser: data.isNewUser
                };
            } else {
                return { success: false, error: data.message || 'Authentication failed' };
            }
        } catch (error) {
            return { success: false, error: 'Network error' };
        }
    }
}

// ============================================
// OAUTH MANAGER
// ============================================

class OAuthManager {
    constructor() {
        this.providers = new Map();
        this.stateManager = new OAuthStateManager();
        this.listeners = [];
        this.currentPopup = null;
        this.popupInterval = null;
        
        this.init();
    }

    init() {
        this.initializeProviders();
        this.checkForCallback();
        this.setupMessageListener();
        OAuthConfig.debug && console.log('[OAuth] Manager initialized');
    }

    initializeProviders() {
        for (const [name, config] of Object.entries(OAuthConfig.providers)) {
            if (config.enabled) {
                this.providers.set(name, new OAuthProvider(name, config));
            }
        }
    }

    checkForCallback() {
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        const state = urlParams.get('state');
        
        if (code && state) {
            const codeVerifier = sessionStorage.getItem(`oauth_pkce_${state}`);
            sessionStorage.removeItem(`oauth_pkce_${state}`);
            
            this.handleCallback(code, state, codeVerifier);
        }
    }

    setupMessageListener() {
        window.addEventListener('message', async (event) => {
            if (event.data.type === 'oauth_callback') {
                const { code, state, codeVerifier } = event.data;
                await this.handleCallback(code, state, codeVerifier);
            }
        });
    }

    async handleCallback(code, state, codeVerifier) {
        const verification = this.stateManager.verifyState(state, codeVerifier);
        
        if (!verification.valid) {
            this.notifyListeners('error', { error: verification.error });
            return;
        }
        
        const provider = this.providers.get(verification.provider);
        if (!provider) {
            this.notifyListeners('error', { error: 'Provider not found' });
            return;
        }
        
        const result = await provider.handleCallback(code, state, codeVerifier);
        
        if (result.success) {
            // Store user data
            localStorage.setItem(OAuthConfig.userStorageKey, JSON.stringify(result.user));
            
            this.notifyListeners('success', {
                user: result.user,
                token: result.token,
                isNewUser: result.isNewUser
            });
            
            // Redirect after successful login
            setTimeout(() => {
                window.location.href = verification.redirectUrl || '/dashboard';
            }, 500);
        } else {
            this.notifyListeners('error', { error: result.error });
        }
    }

    async loginWithProvider(providerName, redirectUrl = '/dashboard', options = {}) {
        const provider = this.providers.get(providerName);
        
        if (!provider) {
            return { success: false, error: `Provider ${providerName} not enabled` };
        }
        
        const config = OAuthConfig.providers[providerName];
        
        if (options.popup) {
            return this.loginWithPopup(provider, redirectUrl);
        } else {
            return this.loginWithRedirect(provider, redirectUrl);
        }
    }

    loginWithRedirect(provider, redirectUrl) {
        const authUrl = provider.getAuthorizationUrl(redirectUrl);
        window.location.href = authUrl;
        return { success: true, redirect: true };
    }

    loginWithPopup(provider, redirectUrl) {
        const authUrl = provider.getAuthorizationUrl(redirectUrl);
        
        const width = 500;
        const height = 600;
        const left = (window.screen.width - width) / 2;
        const top = (window.screen.height - height) / 2;
        
        this.currentPopup = window.open(
            authUrl,
            'oauth_popup',
            `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
        );
        
        // Check for popup close
        this.popupInterval = setInterval(() => {
            if (this.currentPopup && this.currentPopup.closed) {
                clearInterval(this.popupInterval);
                this.popupInterval = null;
                this.currentPopup = null;
                this.notifyListeners('popup_closed');
            }
        }, 500);
        
        return { success: true, popup: true };
    }

    async linkAccount(providerName, currentUserId) {
        const provider = this.providers.get(providerName);
        
        if (!provider) {
            return { success: false, error: `Provider ${providerName} not enabled` };
        }
        
        try {
            const response = await fetch(`${OAuthConfig.apiEndpoint}/link`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
                },
                body: JSON.stringify({
                    provider: providerName,
                    userId: currentUserId
                })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                return { success: true, data };
            } else {
                return { success: false, error: data.message };
            }
        } catch (error) {
            return { success: false, error: 'Failed to link account' };
        }
    }

    async unlinkAccount(providerName) {
        try {
            const response = await fetch(`${OAuthConfig.apiEndpoint}/unlink`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
                },
                body: JSON.stringify({ provider: providerName })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                return { success: true };
            } else {
                return { success: false, error: data.message };
            }
        } catch (error) {
            return { success: false, error: 'Failed to unlink account' };
        }
    }

    getConnectedProviders() {
        const user = JSON.parse(localStorage.getItem(OAuthConfig.userStorageKey) || '{}');
        return user.connectedProviders || [];
    }

    isProviderConnected(providerName) {
        const providers = this.getConnectedProviders();
        return providers.includes(providerName);
    }

    getProviderConfig(providerName) {
        return OAuthConfig.providers[providerName];
    }

    getEnabledProviders() {
        const enabled = [];
        for (const [name, config] of Object.entries(OAuthConfig.providers)) {
            if (config.enabled) {
                enabled.push({ name, ...config });
            }
        }
        return enabled;
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

    // Clean up
    destroy() {
        if (this.popupInterval) {
            clearInterval(this.popupInterval);
        }
        if (this.currentPopup) {
            this.currentPopup.close();
        }
    }
}

// ============================================
// OAUTH UI COMPONENT
// ============================================

class OAuthUI {
    constructor(oauthManager) {
        this.oauthManager = oauthManager;
        this.container = null;
        this.buttons = [];
        this.init();
    }

    init() {
        this.container = document.getElementById('oauth-buttons');
        if (this.container) {
            this.renderButtons();
        }
        this.bindEvents();
        OAuthConfig.debug && console.log('[OAuthUI] Initialized');
    }

    renderButtons() {
        const providers = this.oauthManager.getEnabledProviders();
        
        if (providers.length === 0) {
            this.container.style.display = 'none';
            return;
        }
        
        this.container.innerHTML = `
            <div class="oauth-divider">
                <span>Or continue with</span>
            </div>
            <div class="oauth-buttons">
                ${providers.map(provider => `
                    <button class="oauth-btn oauth-${provider.name.toLowerCase()} ${OAuthConfig.buttonStyle}" 
                            data-provider="${provider.name.toLowerCase()}">
                        <i class="${provider.icon}"></i>
                        <span>${provider.name}</span>
                    </button>
                `).join('')}
            </div>
        `;
        
        // Cache buttons
        this.buttons = document.querySelectorAll('.oauth-btn');
    }

    bindEvents() {
        if (this.buttons.length === 0) return;
        
        this.buttons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const provider = btn.dataset.provider;
                this.handleOAuthLogin(provider);
            });
        });
        
        // Listen for OAuth events
        this.oauthManager.addEventListener('success', (data) => {
            this.handleSuccess(data);
        });
        
        this.oauthManager.addEventListener('error', (data) => {
            this.handleError(data.error);
        });
        
        this.oauthManager.addEventListener('popup_closed', () => {
            this.handlePopupClosed();
        });
    }

    async handleOAuthLogin(provider) {
        this.setLoading(true);
        
        const result = await this.oauthManager.loginWithProvider(provider, '/dashboard', {
            popup: window.innerWidth > 768 // Use popup on desktop, redirect on mobile
        });
        
        if (!result.success && result.error) {
            this.setLoading(false);
            this.showError(result.error);
        }
    }

    handleSuccess(data) {
        this.setLoading(false);
        this.showSuccess(`Welcome ${data.user.name || data.user.email}!`);
        
        if (window.loginManager) {
            window.loginManager.saveSession({
                user: data.user,
                token: data.token
            });
        }
    }

    handleError(error) {
        this.setLoading(false);
        this.showError(error || 'Authentication failed');
    }

    handlePopupClosed() {
        this.setLoading(false);
    }

    setLoading(loading) {
        this.buttons.forEach(btn => {
            btn.disabled = loading;
            if (loading) {
                btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';
            } else {
                const provider = btn.dataset.provider;
                const config = this.oauthManager.getProviderConfig(provider);
                btn.innerHTML = `<i class="${config.icon}"></i><span>${config.name}</span>`;
            }
        });
    }

    showError(message) {
        if (window.showToast) {
            window.showToast(message, 'error');
        } else {
            console.error('[OAuth]', message);
        }
    }

    showSuccess(message) {
        if (window.showToast) {
            window.showToast(message, 'success');
        }
    }

    // Render connected providers (for settings page)
    renderConnectedProviders() {
        const connectedContainer = document.getElementById('connected-oauth');
        if (!connectedContainer) return;
        
        const providers = this.oauthManager.getEnabledProviders();
        const connected = this.oauthManager.getConnectedProviders();
        
        connectedContainer.innerHTML = providers.map(provider => `
            <div class="oauth-connection-item">
                <div class="provider-info">
                    <i class="${provider.icon}"></i>
                    <span>${provider.name}</span>
                </div>
                <div class="provider-status">
                    ${connected.includes(provider.name.toLowerCase()) ? `
                        <span class="connected-badge">Connected</span>
                        <button class="unlink-btn" data-provider="${provider.name.toLowerCase()}">Unlink</button>
                    ` : `
                        <button class="link-btn" data-provider="${provider.name.toLowerCase()}">Connect</button>
                    `}
                </div>
            </div>
        `).join('');
        
        // Bind link/unlink events
        document.querySelectorAll('.link-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const provider = btn.dataset.provider;
                await this.handleLinkAccount(provider);
            });
        });
        
        document.querySelectorAll('.unlink-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const provider = btn.dataset.provider;
                await this.handleUnlinkAccount(provider);
            });
        });
    }

    async handleLinkAccount(provider) {
        const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
        if (!currentUser.id) {
            this.showError('Please login first');
            return;
        }
        
        this.setLoading(true);
        const result = await this.oauthManager.linkAccount(provider, currentUser.id);
        this.setLoading(false);
        
        if (result.success) {
            this.showSuccess(`${provider} account linked successfully`);
            this.renderConnectedProviders();
        } else {
            this.showError(result.error);
        }
    }

    async handleUnlinkAccount(provider) {
        this.setLoading(true);
        const result = await this.oauthManager.unlinkAccount(provider);
        this.setLoading(false);
        
        if (result.success) {
            this.showSuccess(`${provider} account unlinked successfully`);
            this.renderConnectedProviders();
        } else {
            this.showError(result.error);
        }
    }
}

// ============================================
// CREATE SINGLETON INSTANCES
// ============================================

const oauthManager = new OAuthManager();
const oauthUI = new OAuthUI(oauthManager);

// ============================================
// CSS STYLES (Auto-injected)
// ============================================

const oauthStyles = `
    .oauth-divider {
        text-align: center;
        margin: 20px 0;
        position: relative;
    }
    .oauth-divider::before,
    .oauth-divider::after {
        content: '';
        position: absolute;
        top: 50%;
        width: calc(50% - 30px);
        height: 1px;
        background: var(--border-color);
    }
    .oauth-divider::before { left: 0; }
    .oauth-divider::after { right: 0; }
    .oauth-divider span {
        background: var(--bg-primary);
        padding: 0 10px;
        color: var(--text-secondary);
        font-size: 12px;
    }
    
    .oauth-buttons {
        display: flex;
        flex-direction: column;
        gap: 10px;
    }
    
    .oauth-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
        padding: 12px;
        border: none;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.3s ease;
        color: white;
    }
    
    .oauth-btn.rounded { border-radius: 8px; }
    .oauth-btn.pill { border-radius: 50px; }
    
    .oauth-google { background: #DB4437; }
    .oauth-google:hover { background: #c33c2e; }
    
    .oauth-facebook { background: #4267B2; }
    .oauth-facebook:hover { background: #365899; }
    
    .oauth-apple { background: #000000; }
    .oauth-apple:hover { background: #1a1a1a; }
    
    .oauth-github { background: #333333; }
    .oauth-github:hover { background: #242424; }
    
    .oauth-microsoft { background: #00A4EF; }
    .oauth-microsoft:hover { background: #0085c4; }
    
    .oauth-connection-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px;
        border-bottom: 1px solid var(--border-color);
    }
    
    .provider-info {
        display: flex;
        align-items: center;
        gap: 10px;
    }
    
    .connected-badge {
        background: #06d6a0;
        color: white;
        padding: 4px 8px;
        border-radius: 12px;
        font-size: 11px;
        margin-right: 10px;
    }
    
    .link-btn, .unlink-btn {
        padding: 6px 12px;
        border-radius: 6px;
        font-size: 12px;
        cursor: pointer;
        border: 1px solid;
    }
    
    .link-btn {
        background: var(--primary);
        color: white;
        border-color: var(--primary);
    }
    
    .unlink-btn {
        background: transparent;
        color: var(--danger);
        border-color: var(--danger);
    }
    
    .link-btn:hover, .unlink-btn:hover {
        transform: translateY(-1px);
    }
`;

// Inject styles
if (typeof document !== 'undefined') {
    const styleSheet = document.createElement('style');
    styleSheet.textContent = oauthStyles;
    document.head.appendChild(styleSheet);
}

// ============================================
// EXPORTS
// ============================================

// Expose to window
window.oauthManager = oauthManager;
window.oauthUI = oauthUI;
window.OAuthManager = OAuthManager;
window.OAuthConfig = OAuthConfig;
window.PKCEHelper = PKCEHelper;

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        oauthManager,
        oauthUI,
        OAuthManager,
        OAuthConfig,
        PKCEHelper
    };
}

// ES modules export
export {
    oauthManager,
    oauthUI,
    OAuthManager,
    OAuthConfig,
    PKCEHelper
};