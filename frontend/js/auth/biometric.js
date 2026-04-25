/**
 * ESTIF HOME ULTIMATE - BIOMETRIC AUTHENTICATION MODULE
 * Fingerprint, Face ID, and Windows Hello support
 * Version: 2.0.0
 * Author: Estifanos Yohannis
 */

// ============================================
// BIOMETRIC CONFIGURATION
// ============================================

const BiometricConfig = {
    // Feature detection
    supported: false,
    type: null, // 'fingerprint', 'face', 'windows-hello', 'touch-id'
    
    // Timeout settings
    timeout: 60000, // 60 seconds
    fallbackToPassword: true,
    
    // Storage keys
    storageKey: 'estif_biometric_enabled',
    userStorageKey: (userId) => `estif_biometric_${userId}`,
    
    // UI configuration
    dialogTitle: 'Biometric Authentication',
    dialogMessage: 'Use your fingerprint or face to continue',
    cancelButtonText: 'Use Password',
    
    // Security
    requireUserVerification: true,
    challenge: null,
    
    // Debug
    debug: false
};

// ============================================
// BIOMETRIC SUPPORT DETECTION
// ============================================

class BiometricSupport {
    static detect() {
        const support = {
            supported: false,
            type: null,
            available: false,
            platform: null
        };

        // Check for WebAuthn (Web Authentication API)
        if (window.PublicKeyCredential) {
            support.supported = true;
            support.type = 'webauthn';
        }

        // Check for Touch ID / Face ID on macOS/iOS
        if (window.PlatformAuthenticator && window.PlatformAuthenticator.isAvailable) {
            support.supported = true;
            support.type = 'platform-authenticator';
        }

        // Check for Windows Hello
        if (window.msCredentials && window.msCredentials.getCredentials) {
            support.supported = true;
            support.type = 'windows-hello';
        }

        // Check for Android Fingerprint (WebAuthn)
        if (window.PublicKeyCredential && 
            PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable) {
            PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
                .then(available => {
                    support.available = available;
                    if (available) support.type = 'fingerprint';
                });
        }

        // Check for Face ID on iOS (via platform authenticator)
        if (/iPhone|iPad|iPod/.test(navigator.platform) && window.PublicKeyCredential) {
            support.type = 'face-id';
        }

        // Detect platform
        if (/Mac|iPhone|iPad|iPod/.test(navigator.platform)) {
            support.platform = 'apple';
        } else if (/Windows/.test(navigator.platform)) {
            support.platform = 'windows';
        } else if (/Android/.test(navigator.userAgent)) {
            support.platform = 'android';
        } else if (/Linux/.test(navigator.platform)) {
            support.platform = 'linux';
        }

        BiometricConfig.supported = support.supported;
        BiometricConfig.type = support.type;

        return support;
    }

    static async checkAvailability() {
        try {
            if (!window.PublicKeyCredential) {
                return { available: false, reason: 'WebAuthn not supported' };
            }

            const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
            return { available, reason: available ? 'Available' : 'No platform authenticator found' };
        } catch (error) {
            return { available: false, reason: error.message };
        }
    }

    static getBiometricName() {
        const platform = this.getPlatform();
        const type = BiometricConfig.type;

        if (type === 'fingerprint') {
            if (platform === 'apple') return 'Touch ID';
            if (platform === 'android') return 'Fingerprint';
            return 'Fingerprint';
        }

        if (type === 'face-id' || (platform === 'apple' && !type)) return 'Face ID';
        if (type === 'windows-hello') return 'Windows Hello';
        
        return 'Biometric Authentication';
    }

    static getPlatform() {
        if (/Mac|iPhone|iPad|iPod/.test(navigator.platform)) return 'apple';
        if (/Windows/.test(navigator.platform)) return 'windows';
        if (/Android/.test(navigator.userAgent)) return 'android';
        return 'unknown';
    }

    static getIcon() {
        const name = this.getBiometricName();
        if (name === 'Touch ID') return 'fingerprint';
        if (name === 'Face ID') return 'face-id';
        if (name === 'Windows Hello') return 'windows';
        return 'fingerprint';
    }
}

// ============================================
// WEBAUTHN MANAGER
// ============================================

class WebAuthnManager {
    constructor() {
        this.credentialId = null;
        this.challenge = null;
    }

    /**
     * Generate a random challenge for authentication
     */
    generateChallenge() {
        const challenge = new Uint8Array(32);
        crypto.getRandomValues(challenge);
        return challenge;
    }

    /**
     * Register a new biometric credential for a user
     */
    async registerCredential(userId, userName, userDisplayName) {
        try {
            this.challenge = this.generateChallenge();

            const publicKeyCredentialCreationOptions = {
                challenge: this.challenge,
                rp: {
                    name: 'Estif Home Ultimate',
                    id: window.location.hostname
                },
                user: {
                    id: new TextEncoder().encode(userId),
                    name: userName,
                    displayName: userDisplayName
                },
                pubKeyCredParams: [
                    { type: 'public-key', alg: -7 },   // ES256
                    { type: 'public-key', alg: -257 }  // RS256
                ],
                authenticatorSelection: {
                    authenticatorAttachment: 'platform',
                    userVerification: 'required',
                    residentKey: 'preferred'
                },
                timeout: BiometricConfig.timeout,
                attestation: 'none'
            };

            const credential = await navigator.credentials.create({
                publicKey: publicKeyCredentialCreationOptions
            });

            if (credential && credential.id) {
                this.credentialId = credential.id;
                
                // Store credential info
                const credentialData = {
                    id: credential.id,
                    type: credential.type,
                    transports: credential.response.getTransports?.() || [],
                    registeredAt: new Date().toISOString()
                };

                localStorage.setItem(
                    BiometricConfig.userStorageKey(userId),
                    JSON.stringify(credentialData)
                );

                BiometricConfig.debug && console.log('[Biometric] Credential registered:', credentialData);
                
                return { success: true, credentialId: credential.id };
            }

            return { success: false, error: 'Registration failed' };

        } catch (error) {
            console.error('[Biometric] Registration error:', error);
            
            let errorMessage = 'Registration failed';
            if (error.name === 'NotAllowedError') {
                errorMessage = 'Biometric authentication was cancelled or not allowed';
            } else if (error.name === 'SecurityError') {
                errorMessage = 'Security error occurred';
            }
            
            return { success: false, error: errorMessage };
        }
    }

    /**
     * Authenticate using biometric credential
     */
    async authenticate(userId) {
        try {
            // Get stored credential
            const storedData = localStorage.getItem(BiometricConfig.userStorageKey(userId));
            if (!storedData) {
                return { success: false, error: 'No biometric credential registered' };
            }

            const credentialData = JSON.parse(storedData);
            this.challenge = this.generateChallenge();

            const publicKeyCredentialRequestOptions = {
                challenge: this.challenge,
                allowCredentials: [{
                    id: this.base64ToArrayBuffer(credentialData.id),
                    type: 'public-key',
                    transports: credentialData.transports || ['internal']
                }],
                timeout: BiometricConfig.timeout,
                userVerification: BiometricConfig.requireUserVerification ? 'required' : 'preferred'
            };

            const assertion = await navigator.credentials.get({
                publicKey: publicKeyCredentialRequestOptions
            });

            if (assertion) {
                BiometricConfig.debug && console.log('[Biometric] Authentication successful');
                return { success: true, credentialId: assertion.id };
            }

            return { success: false, error: 'Authentication failed' };

        } catch (error) {
            console.error('[Biometric] Authentication error:', error);
            
            let errorMessage = 'Authentication failed';
            if (error.name === 'NotAllowedError') {
                errorMessage = 'Biometric authentication was cancelled';
            } else if (error.name === 'SecurityError') {
                errorMessage = 'Security error occurred';
            } else if (error.name === 'NotFoundError') {
                errorMessage = 'No biometric credential found';
            }
            
            return { success: false, error: errorMessage };
        }
    }

    /**
     * Remove biometric credential for a user
     */
    removeCredential(userId) {
        localStorage.removeItem(BiometricConfig.userStorageKey(userId));
        BiometricConfig.debug && console.log('[Biometric] Credential removed for user:', userId);
    }

    /**
     * Check if user has registered biometric credential
     */
    hasCredential(userId) {
        const stored = localStorage.getItem(BiometricConfig.userStorageKey(userId));
        return stored !== null;
    }

    /**
     * Utility: Convert base64 to ArrayBuffer
     */
    base64ToArrayBuffer(base64) {
        const binaryString = atob(base64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes.buffer;
    }

    /**
     * Utility: Convert ArrayBuffer to base64
     */
    arrayBufferToBase64(buffer) {
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    }
}

// ============================================
// BIOMETRIC AUTHENTICATOR
// ============================================

class BiometricAuthenticator {
    constructor() {
        this.webauthn = new WebAuthnManager();
        this.support = BiometricSupport.detect();
        this.isEnabled = false;
        this.currentUserId = null;
        this.listeners = [];
        
        this.init();
    }

    init() {
        // Load saved preference
        const saved = localStorage.getItem(BiometricConfig.storageKey);
        this.isEnabled = saved === 'true';
        
        BiometricConfig.debug && console.log('[Biometric] Initialized, supported:', this.support.supported);
    }

    /**
     * Check if biometric is available on this device
     */
    async isAvailable() {
        if (!this.support.supported) return false;
        
        const availability = await BiometricSupport.checkAvailability();
        return availability.available;
    }

    /**
     * Enable biometric for current user
     */
    async enable(userId, userName, userDisplayName) {
        try {
            const available = await this.isAvailable();
            if (!available) {
                return { success: false, error: 'Biometric authentication not available on this device' };
            }

            const result = await this.webauthn.registerCredential(userId, userName, userDisplayName);
            
            if (result.success) {
                this.isEnabled = true;
                this.currentUserId = userId;
                localStorage.setItem(BiometricConfig.storageKey, 'true');
                this.notifyListeners('enabled', { userId });
                
                BiometricConfig.debug && console.log('[Biometric] Enabled for user:', userId);
            }
            
            return result;

        } catch (error) {
            console.error('[Biometric] Enable error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Disable biometric for current user
     */
    disable(userId) {
        this.webauthn.removeCredential(userId);
        this.isEnabled = false;
        this.currentUserId = null;
        localStorage.setItem(BiometricConfig.storageKey, 'false');
        this.notifyListeners('disabled', { userId });
        
        BiometricConfig.debug && console.log('[Biometric] Disabled for user:', userId);
    }

    /**
     * Authenticate using biometric
     */
    async authenticate(userId, options = {}) {
        if (!this.isEnabled && !options.force) {
            return { success: false, error: 'Biometric not enabled' };
        }

        const hasCredential = this.webauthn.hasCredential(userId);
        if (!hasCredential) {
            return { success: false, error: 'No biometric credential registered' };
        }

        const result = await this.webauthn.authenticate(userId);
        
        if (result.success) {
            this.notifyListeners('authenticated', { userId, timestamp: Date.now() });
        }
        
        return result;
    }

    /**
     * Check if user has biometric enabled
     */
    isEnabledForUser(userId) {
        return this.isEnabled && this.webauthn.hasCredential(userId);
    }

    /**
     * Get biometric information
     */
    getInfo() {
        return {
            supported: this.support.supported,
            type: this.support.type,
            available: this.support.available,
            platform: this.support.platform,
            isEnabled: this.isEnabled,
            biometricName: BiometricSupport.getBiometricName(),
            icon: BiometricSupport.getIcon()
        };
    }

    /**
     * Show biometric prompt dialog
     */
    async showBiometricPrompt(userId, options = {}) {
        const info = this.getInfo();
        const biometricName = info.biometricName;
        
        // Create custom prompt if needed
        const result = await this.authenticate(userId, options);
        
        if (!result.success && BiometricConfig.fallbackToPassword && options.onFallback) {
            options.onFallback();
        }
        
        return result;
    }

    /**
     * Event listeners
     */
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
}

// ============================================
// BIOMETRIC UI COMPONENTS
// ============================================

class BiometricUI {
    constructor(authenticator) {
        this.authenticator = authenticator;
        this.modalElement = null;
        this.init();
    }

    init() {
        this.createModal();
        this.bindEvents();
    }

    createModal() {
        const modalHTML = `
            <div id="biometric-modal" class="modal-overlay" style="display: none;">
                <div class="modal biometric-modal">
                    <div class="biometric-modal-content">
                        <div class="biometric-icon">
                            <i class="fas fa-fingerprint"></i>
                        </div>
                        <h3 id="biometric-title">Biometric Authentication</h3>
                        <p id="biometric-message">Use your fingerprint or face to continue</p>
                        <div class="biometric-status">
                            <div class="biometric-spinner"></div>
                            <span id="biometric-status-text">Waiting...</span>
                        </div>
                        <div class="biometric-buttons">
                            <button id="biometric-cancel" class="btn btn-secondary">Cancel</button>
                            <button id="biometric-use-password" class="btn btn-outline-primary">Use Password</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Add modal to body if not exists
        if (!document.getElementById('biometric-modal')) {
            document.body.insertAdjacentHTML('beforeend', modalHTML);
        }
        
        this.modalElement = document.getElementById('biometric-modal');
    }

    bindEvents() {
        const cancelBtn = document.getElementById('biometric-cancel');
        const usePasswordBtn = document.getElementById('biometric-use-password');
        
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => this.hide());
        }
        
        if (usePasswordBtn) {
            usePasswordBtn.addEventListener('click', () => {
                this.hide();
                if (this.onFallback) this.onFallback();
            });
        }
    }

    show(options = {}) {
        if (!this.modalElement) return;
        
        const title = document.getElementById('biometric-title');
        const message = document.getElementById('biometric-message');
        const icon = document.querySelector('.biometric-icon i');
        const info = this.authenticator.getInfo();
        
        if (title) title.textContent = options.title || BiometricConfig.dialogTitle;
        if (message) message.textContent = options.message || BiometricConfig.dialogMessage;
        
        // Update icon based on biometric type
        if (icon) {
            icon.className = `fas fa-${info.icon}`;
        }
        
        this.onSuccess = options.onSuccess;
        this.onError = options.onError;
        this.onFallback = options.onFallback;
        
        this.modalElement.style.display = 'flex';
        this.updateStatus('waiting', 'Waiting for biometric...');
        
        // Start authentication
        this.startAuthentication(options);
    }

    hide() {
        if (this.modalElement) {
            this.modalElement.style.display = 'none';
        }
    }

    updateStatus(status, message) {
        const statusText = document.getElementById('biometric-status-text');
        const spinner = document.querySelector('.biometric-spinner');
        
        if (statusText) statusText.textContent = message;
        
        if (spinner) {
            if (status === 'loading') {
                spinner.classList.add('active');
            } else {
                spinner.classList.remove('active');
            }
        }
        
        if (status === 'success') {
            const icon = document.querySelector('.biometric-icon i');
            if (icon) {
                icon.className = 'fas fa-check-circle';
                icon.style.color = '#06d6a0';
            }
        } else if (status === 'error') {
            const icon = document.querySelector('.biometric-icon i');
            if (icon) {
                icon.className = 'fas fa-times-circle';
                icon.style.color = '#ef476f';
            }
        }
    }

    async startAuthentication(options) {
        try {
            this.updateStatus('loading', 'Authenticating...');
            
            const result = await this.authenticator.authenticate(options.userId, options);
            
            if (result.success) {
                this.updateStatus('success', 'Authentication successful!');
                setTimeout(() => {
                    this.hide();
                    if (this.onSuccess) this.onSuccess(result);
                }, 1000);
            } else {
                this.updateStatus('error', result.error || 'Authentication failed');
                setTimeout(() => {
                    if (this.onError) this.onError(result);
                    if (BiometricConfig.fallbackToPassword && options.showFallback !== false) {
                        this.updateStatus('waiting', 'Try again or use password');
                    }
                }, 2000);
            }
        } catch (error) {
            this.updateStatus('error', error.message);
            if (this.onError) this.onError(error);
        }
    }
}

// ============================================
// REACT HOOK (For React Integration)
// ============================================

if (typeof React !== 'undefined') {
    const useBiometric = () => {
        const [biometric, setBiometric] = React.useState(null);
        const [isAvailable, setIsAvailable] = React.useState(false);
        const [isEnabled, setIsEnabled] = React.useState(false);
        
        React.useEffect(() => {
            const init = async () => {
                const auth = new BiometricAuthenticator();
                setBiometric(auth);
                setIsAvailable(await auth.isAvailable());
                setIsEnabled(auth.isEnabled);
            };
            init();
        }, []);
        
        const enableBiometric = async (userId, userName, displayName) => {
            if (biometric) {
                const result = await biometric.enable(userId, userName, displayName);
                if (result.success) setIsEnabled(true);
                return result;
            }
            return { success: false, error: 'Biometric not initialized' };
        };
        
        const disableBiometric = (userId) => {
            if (biometric) {
                biometric.disable(userId);
                setIsEnabled(false);
            }
        };
        
        const authenticate = async (userId) => {
            if (biometric) {
                return await biometric.authenticate(userId);
            }
            return { success: false, error: 'Biometric not initialized' };
        };
        
        return {
            isAvailable,
            isEnabled,
            enableBiometric,
            disableBiometric,
            authenticate,
            getInfo: () => biometric?.getInfo() || null
        };
    };
}

// ============================================
// CREATE SINGLETON INSTANCE
// ============================================

const biometric = new BiometricAuthenticator();
const biometricUI = new BiometricUI(biometric);

// ============================================
// EXPORTS
// ============================================

// Expose to window
window.biometric = biometric;
window.biometricUI = biometricUI;
window.BiometricAuthenticator = BiometricAuthenticator;
window.BiometricSupport = BiometricSupport;
window.WebAuthnManager = WebAuthnManager;

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        biometric,
        biometricUI,
        BiometricAuthenticator,
        BiometricSupport,
        WebAuthnManager,
        BiometricConfig
    };
}

// ES modules export
export {
    biometric,
    biometricUI,
    BiometricAuthenticator,
    BiometricSupport,
    WebAuthnManager,
    BiometricConfig
};