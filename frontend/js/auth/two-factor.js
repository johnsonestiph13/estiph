/**
 * ESTIF HOME ULTIMATE - TWO-FACTOR AUTHENTICATION MODULE
 * Time-based One-Time Password (TOTP), SMS, Email 2FA support
 * Version: 2.0.0
 * Author: Estifanos Yohannis
 */

// ============================================
// TWO-FACTOR CONFIGURATION
// ============================================

const TwoFactorConfig = {
    // TOTP settings
    totp: {
        issuer: 'EstifHome',
        algorithm: 'SHA-1',
        digits: 6,
        period: 30,
        window: 1 // 1 period before/after for time drift
    },
    
    // Backup codes
    backupCodes: {
        count: 10,
        length: 8,
        enabled: true
    },
    
    // Methods
    methods: {
        authenticator: { enabled: true, name: 'Authenticator App', icon: 'fas fa-mobile-alt' },
        sms: { enabled: true, name: 'SMS', icon: 'fas fa-sms' },
        email: { enabled: true, name: 'Email', icon: 'fas fa-envelope' },
        backup: { enabled: true, name: 'Backup Codes', icon: 'fas fa-key' }
    },
    
    // Security settings
    maxAttempts: 5,
    lockoutDuration: 900000, // 15 minutes
    rememberDeviceDays: 30,
    
    // Endpoints
    apiEndpoint: '/api/auth/2fa',
    setupEndpoint: '/api/auth/2fa/setup',
    verifyEndpoint: '/api/auth/2fa/verify',
    disableEndpoint: '/api/auth/2fa/disable',
    backupCodesEndpoint: '/api/auth/2fa/backup-codes',
    
    // UI
    showQRCode: true,
    showRecoveryCodes: true,
    autoSubmit: true,
    
    // Debug
    debug: false
};

// ============================================
// TOTP HELPER CLASS
// ============================================

class TOTPHelper {
    /**
     * Generate TOTP secret key
     */
    static generateSecret() {
        const array = new Uint8Array(20);
        crypto.getRandomValues(array);
        return this.base32Encode(array);
    }

    /**
     * Generate provisioning URI for QR code
     */
    static generateProvisioningUri(secret, email) {
        const issuer = encodeURIComponent(TwoFactorConfig.totp.issuer);
        const account = encodeURIComponent(email);
        return `otpauth://totp/${issuer}:${account}?secret=${secret}&issuer=${issuer}&algorithm=${TwoFactorConfig.totp.algorithm}&digits=${TwoFactorConfig.totp.digits}&period=${TwoFactorConfig.totp.period}`;
    }

    /**
     * Generate TOTP code (client-side for testing)
     */
    static async generateTOTP(secret) {
        // This is a simplified version. In production, use a proper TOTP library
        const key = this.base32ToBytes(secret);
        const counter = Math.floor(Date.now() / 1000 / TwoFactorConfig.totp.period);
        const counterBytes = this.intToBytes(counter);
        
        // HMAC-SHA1 would be done server-side
        // Client-side only for demonstration
        return this.hotp(key, counter, TwoFactorConfig.totp.digits);
    }

    /**
     * Verify TOTP code
     */
    static async verifyTOTP(secret, code) {
        const generated = await this.generateTOTP(secret);
        return generated === code;
    }

    /**
     * Generate backup codes
     */
    static generateBackupCodes() {
        const codes = [];
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789';
        
        for (let i = 0; i < TwoFactorConfig.backupCodes.count; i++) {
            let code = '';
            for (let j = 0; j < TwoFactorConfig.backupCodes.length; j++) {
                code += chars[Math.floor(Math.random() * chars.length)];
            }
            codes.push(code);
        }
        
        return codes;
    }

    // ============================================
    // UTILITY FUNCTIONS
    // ============================================

    static base32Encode(buffer) {
        const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
        let result = '';
        let bits = 0;
        let value = 0;
        
        for (let i = 0; i < buffer.length; i++) {
            value = (value << 8) | buffer[i];
            bits += 8;
            while (bits >= 5) {
                result += alphabet[(value >>> (bits - 5)) & 31];
                bits -= 5;
            }
        }
        if (bits > 0) {
            result += alphabet[(value << (5 - bits)) & 31];
        }
        return result;
    }

    static base32ToBytes(base32) {
        const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
        const bytes = [];
        let bits = 0;
        let value = 0;
        
        for (let i = 0; i < base32.length; i++) {
            value = (value << 5) | alphabet.indexOf(base32[i]);
            bits += 5;
            if (bits >= 8) {
                bytes.push((value >>> (bits - 8)) & 255);
                bits -= 8;
            }
        }
        return new Uint8Array(bytes);
    }

    static intToBytes(int) {
        const bytes = new Uint8Array(8);
        for (let i = 7; i >= 0; i--) {
            bytes[i] = int & 255;
            int >>= 8;
        }
        return bytes;
    }

    static hotp(key, counter, digits) {
        // Simplified - actual HMAC would be done server-side
        // This is a placeholder for the algorithm
        const hash = Math.floor(Math.random() * Math.pow(10, digits));
        return hash.toString().padStart(digits, '0');
    }
}

// ============================================
// TWO-FACTOR MANAGER
// ============================================

class TwoFactorManager {
    constructor() {
        this.currentMethod = 'authenticator';
        this.pendingSetup = null;
        this.attempts = 0;
        this.lockedUntil = null;
        this.trustedDevices = [];
        this.listeners = [];
        
        this.init();
    }

    init() {
        this.loadTrustedDevices();
        TwoFactorConfig.debug && console.log('[2FA] Manager initialized');
    }

    loadTrustedDevices() {
        try {
            const saved = localStorage.getItem('estif_2fa_trusted');
            if (saved) {
                this.trustedDevices = JSON.parse(saved);
            }
        } catch (error) {
            TwoFactorConfig.debug && console.log('[2FA] Failed to load trusted devices');
        }
    }

    saveTrustedDevices() {
        try {
            localStorage.setItem('estif_2fa_trusted', JSON.stringify(this.trustedDevices));
        } catch (error) {
            TwoFactorConfig.debug && console.log('[2FA] Failed to save trusted devices');
        }
    }

    // ============================================
    // SETUP METHODS
    // ============================================

    async setupAuthenticator(userId) {
        try {
            const response = await fetch(`${TwoFactorConfig.setupEndpoint}/authenticator`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
                },
                body: JSON.stringify({ userId })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                this.pendingSetup = {
                    method: 'authenticator',
                    secret: data.secret,
                    provisioningUri: data.provisioningUri,
                    backupCodes: data.backupCodes
                };
                
                return {
                    success: true,
                    secret: data.secret,
                    provisioningUri: data.provisioningUri,
                    backupCodes: data.backupCodes
                };
            } else {
                return { success: false, error: data.message };
            }
        } catch (error) {
            return { success: false, error: 'Failed to setup authenticator' };
        }
    }

    async verifySetup(verificationCode) {
        if (!this.pendingSetup) {
            return { success: false, error: 'No pending setup found' };
        }
        
        try {
            const response = await fetch(`${TwoFactorConfig.verifyEndpoint}/setup`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
                },
                body: JSON.stringify({
                    method: this.pendingSetup.method,
                    code: verificationCode,
                    secret: this.pendingSetup.secret
                })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                const setupResult = {
                    success: true,
                    enabled: true,
                    backupCodes: this.pendingSetup.backupCodes
                };
                
                this.pendingSetup = null;
                this.notifyListeners('enabled', { method: this.currentMethod });
                
                return setupResult;
            } else {
                return { success: false, error: data.message };
            }
        } catch (error) {
            return { success: false, error: 'Verification failed' };
        }
    }

    async enableSMS(phoneNumber) {
        try {
            const response = await fetch(`${TwoFactorConfig.setupEndpoint}/sms`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
                },
                body: JSON.stringify({ phoneNumber })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                return { success: true, message: 'Verification code sent to your phone' };
            } else {
                return { success: false, error: data.message };
            }
        } catch (error) {
            return { success: false, error: 'Failed to enable SMS 2FA' };
        }
    }

    async enableEmail() {
        try {
            const response = await fetch(`${TwoFactorConfig.setupEndpoint}/email`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
                }
            });
            
            const data = await response.json();
            
            if (response.ok) {
                return { success: true, message: 'Verification code sent to your email' };
            } else {
                return { success: false, error: data.message };
            }
        } catch (error) {
            return { success: false, error: 'Failed to enable email 2FA' };
        }
    }

    async disable2FA(method, verificationCode) {
        try {
            const response = await fetch(TwoFactorConfig.disableEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
                },
                body: JSON.stringify({ method, code: verificationCode })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                this.notifyListeners('disabled', { method });
                return { success: true };
            } else {
                return { success: false, error: data.message };
            }
        } catch (error) {
            return { success: false, error: 'Failed to disable 2FA' };
        }
    }

    // ============================================
    // VERIFICATION METHODS
    // ============================================

    async verifyCode(code, method = null, rememberDevice = false) {
        // Check lockout
        if (this.isLockedOut()) {
            const remaining = this.getLockoutRemaining();
            return {
                success: false,
                error: `Too many attempts. Try again in ${Math.ceil(remaining / 60000)} minutes.`,
                locked: true
            };
        }
        
        const verifyMethod = method || this.currentMethod;
        
        try {
            const response = await fetch(TwoFactorConfig.verifyEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    method: verifyMethod,
                    code,
                    rememberDevice,
                    deviceId: this.getDeviceId()
                })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                this.resetAttempts();
                
                if (rememberDevice) {
                    this.rememberCurrentDevice();
                }
                
                this.notifyListeners('verified', { method: verifyMethod });
                
                return { success: true, token: data.token };
            } else {
                this.incrementAttempts();
                return { success: false, error: data.message || 'Invalid verification code' };
            }
        } catch (error) {
            return { success: false, error: 'Verification failed' };
        }
    }

    async verifyBackupCode(backupCode) {
        try {
            const response = await fetch(`${TwoFactorConfig.verifyEndpoint}/backup`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
                },
                body: JSON.stringify({ backupCode })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                return { success: true, token: data.token };
            } else {
                return { success: false, error: data.message || 'Invalid backup code' };
            }
        } catch (error) {
            return { success: false, error: 'Verification failed' };
        }
    }

    async generateNewBackupCodes() {
        try {
            const response = await fetch(TwoFactorConfig.backupCodesEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
                }
            });
            
            const data = await response.json();
            
            if (response.ok) {
                return { success: true, backupCodes: data.backupCodes };
            } else {
                return { success: false, error: data.message };
            }
        } catch (error) {
            return { success: false, error: 'Failed to generate backup codes' };
        }
    }

    // ============================================
    // TRUSTED DEVICES
    // ============================================

    getDeviceId() {
        let deviceId = localStorage.getItem('estif_device_id');
        if (!deviceId) {
            deviceId = 'device_' + Date.now() + '_' + Math.random().toString(36).substr(2, 16);
            localStorage.setItem('estif_device_id', deviceId);
        }
        return deviceId;
    }

    getDeviceFingerprint() {
        const components = [
            navigator.userAgent,
            navigator.language,
            screen.colorDepth,
            screen.width + 'x' + screen.height,
            new Date().getTimezoneOffset(),
            !!window.sessionStorage,
            !!window.localStorage
        ];
        return btoa(components.join('|'));
    }

    rememberCurrentDevice() {
        const device = {
            id: this.getDeviceId(),
            fingerprint: this.getDeviceFingerprint(),
            name: this.getDeviceName(),
            platform: navigator.platform,
            userAgent: navigator.userAgent,
            rememberedAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + TwoFactorConfig.rememberDeviceDays * 86400000).toISOString()
        };
        
        this.trustedDevices.push(device);
        this.saveTrustedDevices();
        this.notifyListeners('device_remembered', device);
    }

    isDeviceTrusted() {
        const deviceId = this.getDeviceId();
        const fingerprint = this.getDeviceFingerprint();
        
        return this.trustedDevices.some(device => 
            (device.id === deviceId || device.fingerprint === fingerprint) &&
            new Date(device.expiresAt) > new Date()
        );
    }

    getDeviceName() {
        const platform = navigator.platform;
        const userAgent = navigator.userAgent;
        
        if (userAgent.includes('Windows')) return 'Windows PC';
        if (userAgent.includes('Mac')) return 'Mac';
        if (userAgent.includes('iPhone')) return 'iPhone';
        if (userAgent.includes('iPad')) return 'iPad';
        if (userAgent.includes('Android')) return 'Android Device';
        if (userAgent.includes('Linux')) return 'Linux PC';
        
        return 'Unknown Device';
    }

    removeTrustedDevice(deviceId) {
        this.trustedDevices = this.trustedDevices.filter(d => d.id !== deviceId);
        this.saveTrustedDevices();
        this.notifyListeners('device_removed', { deviceId });
    }

    getTrustedDevices() {
        return this.trustedDevices.filter(d => new Date(d.expiresAt) > new Date());
    }

    // ============================================
    // RATE LIMITING
    // ============================================

    isLockedOut() {
        return this.lockedUntil && Date.now() < this.lockedUntil;
    }

    getLockoutRemaining() {
        if (!this.lockedUntil) return 0;
        return Math.max(0, this.lockedUntil - Date.now());
    }

    incrementAttempts() {
        this.attempts++;
        if (this.attempts >= TwoFactorConfig.maxAttempts) {
            this.lockedUntil = Date.now() + TwoFactorConfig.lockoutDuration;
            this.attempts = 0;
            this.notifyListeners('locked_out', { until: this.lockedUntil });
        }
        this.notifyListeners('attempt_failed', { attempts: this.attempts });
    }

    resetAttempts() {
        this.attempts = 0;
        this.lockedUntil = null;
    }

    // ============================================
    // UTILITY METHODS
    // ============================================

    is2FAEnabled(userId = null) {
        const user = userId ? this.getUser(userId) : this.currentUser;
        return user?.twoFactorEnabled || false;
    }

    getEnabledMethods() {
        const methods = [];
        for (const [method, config] of Object.entries(TwoFactorConfig.methods)) {
            if (config.enabled) {
                methods.push({ method, ...config });
            }
        }
        return methods;
    }

    setCurrentMethod(method) {
        if (TwoFactorConfig.methods[method]?.enabled) {
            this.currentMethod = method;
            this.notifyListeners('method_changed', { method });
        }
    }

    // ============================================
    // UI COMPONENT
    // ============================================

    render2FAUI(containerId = '2fa-container') {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        const methods = this.getEnabledMethods();
        
        container.innerHTML = `
            <div class="two-factor-container">
                <div class="two-factor-header">
                    <h3>Two-Factor Authentication</h3>
                    <p>Add an extra layer of security to your account</p>
                </div>
                
                <div class="two-factor-methods">
                    ${methods.map(method => `
                        <div class="method-card" data-method="${method.method}">
                            <div class="method-icon">
                                <i class="${method.icon}"></i>
                            </div>
                            <div class="method-info">
                                <h4>${method.name}</h4>
                                <p>Secure your account with ${method.name}</p>
                            </div>
                            <div class="method-action">
                                <button class="btn setup-2fa" data-method="${method.method}">
                                    Setup
                                </button>
                            </div>
                        </div>
                    `).join('')}
                </div>
                
                <div class="trusted-devices-section">
                    <h4>Trusted Devices</h4>
                    <div class="trusted-devices-list" id="trusted-devices-list"></div>
                </div>
            </div>
        `;
        
        this.bindUIEvents();
        this.renderTrustedDevices();
    }

    bindUIEvents() {
        document.querySelectorAll('.setup-2fa').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const method = btn.dataset.method;
                this.showSetupDialog(method);
            });
        });
    }

    renderTrustedDevices() {
        const container = document.getElementById('trusted-devices-list');
        if (!container) return;
        
        const devices = this.getTrustedDevices();
        
        if (devices.length === 0) {
            container.innerHTML = '<p class="no-devices">No trusted devices</p>';
            return;
        }
        
        container.innerHTML = devices.map(device => `
            <div class="trusted-device">
                <div class="device-info">
                    <i class="fas fa-laptop"></i>
                    <span>${device.name}</span>
                    <small>Added: ${new Date(device.rememberedAt).toLocaleDateString()}</small>
                </div>
                <button class="remove-device" data-device-id="${device.id}">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `).join('');
        
        document.querySelectorAll('.remove-device').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const deviceId = btn.dataset.deviceId;
                this.removeTrustedDevice(deviceId);
                this.renderTrustedDevices();
            });
        });
    }

    showSetupDialog(method) {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal 2fa-setup-modal">
                <div class="modal-header">
                    <h3>Setup ${TwoFactorConfig.methods[method]?.name}</h3>
                    <button class="modal-close">&times;</button>
                </div>
                <div class="modal-body" id="setup-modal-body">
                    <div class="loading">Loading...</div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        modal.style.display = 'flex';
        
        modal.querySelector('.modal-close').addEventListener('click', () => {
            modal.remove();
        });
        
        this.loadSetupContent(method, modal);
    }

    async loadSetupContent(method, modal) {
        const body = modal.querySelector('#setup-modal-body');
        
        if (method === 'authenticator') {
            const result = await this.setupAuthenticator(this.currentUser?.id);
            
            if (result.success) {
                body.innerHTML = `
                    <div class="setup-authenticator">
                        <p>Scan this QR code with your authenticator app:</p>
                        <div class="qr-code" id="qr-code"></div>
                        <p>Or enter this code manually:</p>
                        <code class="secret-key">${result.secret}</code>
                        <div class="form-group">
                            <label>Verification Code</label>
                            <input type="text" id="verification-code" placeholder="Enter 6-digit code" maxlength="6">
                        </div>
                        <div class="backup-codes" id="backup-codes" style="display: none;">
                            <h4>Save these backup codes:</h4>
                            <div class="codes-list"></div>
                            <p class="warning">Store these codes in a safe place. You'll need them to access your account if you lose your device.</p>
                        </div>
                        <button id="verify-setup" class="btn btn-primary">Verify & Enable</button>
                    </div>
                `;
                
                // Generate QR code (using a simple approach)
                const qrContainer = body.querySelector('#qr-code');
                await this.generateQRCode(result.provisioningUri, qrContainer);
                
                body.querySelector('#verify-setup').addEventListener('click', async () => {
                    const code = body.querySelector('#verification-code').value;
                    const verifyResult = await this.verifySetup(code);
                    
                    if (verifyResult.success) {
                        const backupCodesDiv = body.querySelector('#backup-codes');
                        const codesList = backupCodesDiv.querySelector('.codes-list');
                        codesList.innerHTML = verifyResult.backupCodes.map(code => 
                            `<div class="backup-code">${code}</div>`
                        ).join('');
                        backupCodesDiv.style.display = 'block';
                        
                        setTimeout(() => {
                            modal.remove();
                            this.notifyListeners('enabled', { method });
                        }, 5000);
                    } else {
                        alert(verifyResult.error);
                    }
                });
            }
        }
    }

    async generateQRCode(uri, container) {
        // Use a QR code library or API
        // For simplicity, using an API service
        container.innerHTML = `
            <img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(uri)}" 
                 alt="QR Code" style="width: 200px; height: 200px;">
        `;
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

    getUser(userId) {
        // This should be replaced with actual API call
        const users = JSON.parse(localStorage.getItem('estif_users') || '[]');
        return users.find(u => u.id === userId);
    }
}

// ============================================
// CSS STYLES (Auto-injected)
// ============================================

const twoFactorStyles = `
    .two-factor-container {
        max-width: 600px;
        margin: 0 auto;
    }
    
    .two-factor-header {
        text-align: center;
        margin-bottom: 30px;
    }
    
    .two-factor-methods {
        display: flex;
        flex-direction: column;
        gap: 16px;
        margin-bottom: 30px;
    }
    
    .method-card {
        display: flex;
        align-items: center;
        gap: 16px;
        padding: 16px;
        background: var(--bg-secondary);
        border-radius: 12px;
        border: 1px solid var(--border-color);
    }
    
    .method-icon {
        width: 48px;
        height: 48px;
        background: var(--primary-soft);
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 20px;
        color: var(--primary);
    }
    
    .method-info {
        flex: 1;
    }
    
    .method-info h4 {
        margin: 0 0 4px;
    }
    
    .method-info p {
        margin: 0;
        font-size: 12px;
        color: var(--text-secondary);
    }
    
    .setup-authenticator {
        text-align: center;
    }
    
    .qr-code {
        margin: 20px 0;
        display: flex;
        justify-content: center;
    }
    
    .secret-key {
        background: var(--bg-tertiary);
        padding: 8px 12px;
        border-radius: 8px;
        font-family: monospace;
        margin: 10px 0;
        display: inline-block;
    }
    
    .backup-codes {
        margin-top: 20px;
        padding: 16px;
        background: var(--warning-soft);
        border-radius: 12px;
        text-align: left;
    }
    
    .codes-list {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 8px;
        margin: 12px 0;
    }
    
    .backup-code {
        font-family: monospace;
        background: var(--bg-primary);
        padding: 6px;
        border-radius: 4px;
        text-align: center;
    }
    
    .warning {
        color: var(--warning);
        font-size: 12px;
        margin-top: 12px;
    }
    
    .trusted-devices-section {
        margin-top: 30px;
        padding-top: 20px;
        border-top: 1px solid var(--border-color);
    }
    
    .trusted-devices-list {
        margin-top: 12px;
    }
    
    .trusted-device {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 10px;
        background: var(--bg-secondary);
        border-radius: 8px;
        margin-bottom: 8px;
    }
    
    .device-info {
        display: flex;
        align-items: center;
        gap: 10px;
    }
    
    .remove-device {
        background: none;
        border: none;
        color: var(--danger);
        cursor: pointer;
        padding: 5px;
    }
    
    .no-devices {
        color: var(--text-muted);
        text-align: center;
        padding: 20px;
    }
`;

// Inject styles
if (typeof document !== 'undefined') {
    const styleSheet = document.createElement('style');
    styleSheet.textContent = twoFactorStyles;
    document.head.appendChild(styleSheet);
}

// ============================================
// CREATE SINGLETON INSTANCE
// ============================================

const twoFactorManager = new TwoFactorManager();

// ============================================
// EXPORTS
// ============================================

// Expose to window
window.twoFactorManager = twoFactorManager;
window.TwoFactorManager = TwoFactorManager;
window.TOTPHelper = TOTPHelper;
window.TwoFactorConfig = TwoFactorConfig;

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        twoFactorManager,
        TwoFactorManager,
        TOTPHelper,
        TwoFactorConfig
    };
}

// ES modules export
export {
    twoFactorManager,
    TwoFactorManager,
    TOTPHelper,
    TwoFactorConfig
};