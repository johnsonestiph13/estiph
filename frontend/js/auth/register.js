/**
 * ESTIF HOME ULTIMATE - REGISTRATION MODULE
 * User registration with validation, email verification, and profile setup
 * Version: 2.0.0
 * Author: Estifanos Yohannis
 */

// ============================================
// REGISTRATION CONFIGURATION
// ============================================

const RegisterConfig = {
    // Validation rules
    minPasswordLength: 8,
    maxPasswordLength: 64,
    minNameLength: 2,
    maxNameLength: 50,
    
    // Features
    requireEmailVerification: true,
    requireTermsAgreement: true,
    enableSocialRegistration: false,
    enableReferralSystem: true,
    
    // Security
    requireStrongPassword: true,
    preventDuplicateEmails: true,
    rateLimitPerIP: 5, // per hour
    
    // Endpoints
    apiEndpoint: '/api/auth',
    registerEndpoint: '/api/auth/register',
    verifyEndpoint: '/api/auth/verify-email',
    resendVerificationEndpoint: '/api/auth/resend-verification',
    
    // UI
    showPasswordStrength: true,
    showUsernameAvailability: true,
    showPasswordMatch: true,
    
    // Default values
    defaultRole: 'user',
    defaultLanguage: 'en',
    defaultTheme: 'light',
    
    // Debug
    debug: false
};

// ============================================
// VALIDATION CLASS
// ============================================

class RegistrationValidator {
    static validateEmail(email) {
        const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        const isValid = emailRegex.test(email);
        
        return {
            isValid,
            error: isValid ? null : 'Please enter a valid email address'
        };
    }

    static validateName(name, fieldName = 'name') {
        const trimmed = name?.trim() || '';
        const length = trimmed.length;
        
        if (length === 0) {
            return { isValid: false, error: `${fieldName} is required` };
        }
        
        if (length < RegisterConfig.minNameLength) {
            return { isValid: false, error: `${fieldName} must be at least ${RegisterConfig.minNameLength} characters` };
        }
        
        if (length > RegisterConfig.maxNameLength) {
            return { isValid: false, error: `${fieldName} must be less than ${RegisterConfig.maxNameLength} characters` };
        }
        
        // Check for invalid characters (letters, spaces, hyphens, apostrophes only)
        const nameRegex = /^[a-zA-Z\s\-'àáâãäåçèéêëìíîïðòóôõøùúûüýÿñ]+$/;
        if (!nameRegex.test(trimmed)) {
            return { isValid: false, error: 'Name can only contain letters, spaces, hyphens, and apostrophes' };
        }
        
        return { isValid: true, error: null, value: trimmed };
    }

    static validatePassword(password) {
        if (!password) {
            return { isValid: false, error: 'Password is required' };
        }
        
        const checks = {
            length: password.length >= RegisterConfig.minPasswordLength,
            maxLength: password.length <= RegisterConfig.maxPasswordLength,
            uppercase: /[A-Z]/.test(password),
            lowercase: /[a-z]/.test(password),
            number: /[0-9]/.test(password),
            special: /[!@#$%^&*(),.?":{}|<>]/.test(password),
            noSpaces: !/\s/.test(password)
        };
        
        const score = Object.values(checks).filter(Boolean).length;
        let strength = 'weak';
        
        if (score >= 6) strength = 'very-strong';
        else if (score >= 5) strength = 'strong';
        else if (score >= 4) strength = 'medium';
        else if (score >= 3) strength = 'weak';
        else strength = 'very-weak';
        
        const isValid = RegisterConfig.requireStrongPassword ? score >= 4 : score >= 3;
        
        const errors = [];
        if (!checks.length) errors.push(`Password must be at least ${RegisterConfig.minPasswordLength} characters`);
        if (!checks.uppercase) errors.push('Password must contain at least one uppercase letter');
        if (!checks.lowercase) errors.push('Password must contain at least one lowercase letter');
        if (!checks.number) errors.push('Password must contain at least one number');
        if (!checks.special) errors.push('Password must contain at least one special character');
        if (!checks.noSpaces) errors.push('Password cannot contain spaces');
        
        return {
            isValid,
            strength,
            score,
            checks,
            errors,
            error: isValid ? null : errors[0]
        };
    }

    static validatePasswordMatch(password, confirmPassword) {
        if (password !== confirmPassword) {
            return { isValid: false, error: 'Passwords do not match' };
        }
        return { isValid: true, error: null };
    }

    static validatePhone(phone) {
        if (!phone) return { isValid: true, error: null }; // Optional field
        
        const phoneRegex = /^[\+]?[(]?[0-9]{1,4}[)]?[-\s\.]?[(]?[0-9]{1,4}[)]?[-\s\.]?[0-9]{1,9}$/;
        const isValid = phoneRegex.test(phone);
        
        return {
            isValid,
            error: isValid ? null : 'Please enter a valid phone number'
        };
    }

    static validateReferralCode(code) {
        if (!code) return { isValid: true, error: null };
        
        const codeRegex = /^[A-Za-z0-9]{6,12}$/;
        const isValid = codeRegex.test(code);
        
        return {
            isValid,
            error: isValid ? null : 'Invalid referral code format'
        };
    }

    static async checkEmailAvailability(email) {
        if (!RegisterConfig.preventDuplicateEmails) {
            return { available: true };
        }
        
        try {
            const response = await fetch(`${RegisterConfig.apiEndpoint}/check-email`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });
            
            const data = await response.json();
            return { available: data.available, message: data.message };
        } catch (error) {
            return { available: true, error: 'Could not check email availability' };
        }
    }

    static validateTerms(accepted) {
        if (!accepted && RegisterConfig.requireTermsAgreement) {
            return { isValid: false, error: 'You must agree to the Terms of Service and Privacy Policy' };
        }
        return { isValid: true, error: null };
    }
}

// ============================================
// REGISTRATION MANAGER CLASS
// ============================================

class RegistrationManager {
    constructor() {
        this.pendingRegistration = null;
        this.verificationTimer = null;
        this.listeners = [];
        this.rateLimit = new Map();
        
        this.init();
    }

    init() {
        this.loadPendingRegistration();
        RegisterConfig.debug && console.log('[Register] Manager initialized');
    }

    loadPendingRegistration() {
        try {
            const saved = localStorage.getItem('estif_pending_registration');
            if (saved) {
                const data = JSON.parse(saved);
                const expiry = new Date(data.expiresAt);
                if (expiry > new Date()) {
                    this.pendingRegistration = data;
                } else {
                    localStorage.removeItem('estif_pending_registration');
                }
            }
        } catch (error) {
            RegisterConfig.debug && console.log('[Register] Failed to load pending registration');
        }
    }

    savePendingRegistration(data) {
        this.pendingRegistration = {
            ...data,
            expiresAt: new Date(Date.now() + 3600000).toISOString() // 1 hour expiry
        };
        localStorage.setItem('estif_pending_registration', JSON.stringify(this.pendingRegistration));
    }

    clearPendingRegistration() {
        this.pendingRegistration = null;
        localStorage.removeItem('estif_pending_registration');
    }

    // ============================================
    // REGISTRATION METHODS
    // ============================================

    async register(userData, options = {}) {
        // Check rate limit
        if (this.isRateLimited()) {
            return {
                success: false,
                error: 'Too many registration attempts. Please try again later.',
                rateLimited: true
            };
        }

        // Validate all fields
        const validation = await this.validateRegistrationData(userData);
        if (!validation.isValid) {
            return { success: false, error: validation.error, fieldErrors: validation.fieldErrors };
        }

        try {
            const response = await fetch(RegisterConfig.registerEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...userData,
                    role: RegisterConfig.defaultRole,
                    settings: {
                        language: RegisterConfig.defaultLanguage,
                        theme: RegisterConfig.defaultTheme
                    }
                })
            });

            const data = await response.json();

            if (response.ok) {
                this.recordRegistrationAttempt(true);
                
                if (RegisterConfig.requireEmailVerification) {
                    this.savePendingRegistration({
                        email: userData.email,
                        userId: data.userId,
                        tempToken: data.tempToken
                    });
                    
                    return {
                        success: true,
                        requiresVerification: true,
                        message: 'Registration successful! Please verify your email.',
                        userId: data.userId
                    };
                } else {
                    return {
                        success: true,
                        user: data.user,
                        token: data.token,
                        message: 'Registration successful! Welcome aboard!'
                    };
                }
            } else {
                this.recordRegistrationAttempt(false);
                return { success: false, error: data.message || 'Registration failed' };
            }
        } catch (error) {
            console.error('[Register] Registration error:', error);
            return { success: false, error: 'Network error. Please try again.' };
        }
    }

    async validateRegistrationData(userData) {
        const fieldErrors = {};
        
        // Validate name
        const nameValidation = RegistrationValidator.validateName(userData.name, 'Name');
        if (!nameValidation.isValid) {
            fieldErrors.name = nameValidation.error;
        }
        
        // Validate email
        const emailValidation = RegistrationValidator.validateEmail(userData.email);
        if (!emailValidation.isValid) {
            fieldErrors.email = emailValidation.error;
        } else if (RegisterConfig.preventDuplicateEmails) {
            const availability = await RegistrationValidator.checkEmailAvailability(userData.email);
            if (!availability.available) {
                fieldErrors.email = availability.message || 'Email already registered';
            }
        }
        
        // Validate password
        const passwordValidation = RegistrationValidator.validatePassword(userData.password);
        if (!passwordValidation.isValid) {
            fieldErrors.password = passwordValidation.error;
        }
        
        // Validate password match
        if (userData.confirmPassword !== undefined) {
            const matchValidation = RegistrationValidator.validatePasswordMatch(
                userData.password,
                userData.confirmPassword
            );
            if (!matchValidation.isValid) {
                fieldErrors.confirmPassword = matchValidation.error;
            }
        }
        
        // Validate phone (optional)
        if (userData.phone) {
            const phoneValidation = RegistrationValidator.validatePhone(userData.phone);
            if (!phoneValidation.isValid) {
                fieldErrors.phone = phoneValidation.error;
            }
        }
        
        // Validate referral code (optional)
        if (userData.referralCode) {
            const referralValidation = RegistrationValidator.validateReferralCode(userData.referralCode);
            if (!referralValidation.isValid) {
                fieldErrors.referralCode = referralValidation.error;
            }
        }
        
        // Validate terms
        const termsValidation = RegistrationValidator.validateTerms(userData.acceptedTerms);
        if (!termsValidation.isValid) {
            fieldErrors.terms = termsValidation.error;
        }
        
        const isValid = Object.keys(fieldErrors).length === 0;
        
        return {
            isValid,
            fieldErrors,
            error: isValid ? null : 'Please fix the errors above'
        };
    }

    async verifyEmail(code, userId = null) {
        const id = userId || this.pendingRegistration?.userId;
        
        if (!id) {
            return { success: false, error: 'No pending registration found' };
        }
        
        try {
            const response = await fetch(RegisterConfig.verifyEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: id, code })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                this.clearPendingRegistration();
                return {
                    success: true,
                    user: data.user,
                    token: data.token,
                    message: 'Email verified! You can now log in.'
                };
            } else {
                return { success: false, error: data.message || 'Invalid verification code' };
            }
        } catch (error) {
            return { success: false, error: 'Verification failed. Please try again.' };
        }
    }

    async resendVerificationEmail(email) {
        try {
            const response = await fetch(RegisterConfig.resendVerificationEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });
            
            const data = await response.json();
            
            return {
                success: response.ok,
                message: data.message || 'Verification email sent'
            };
        } catch (error) {
            return { success: false, error: 'Failed to resend verification email' };
        }
    }

    // ============================================
    // RATE LIMITING
    // ============================================

    isRateLimited() {
        const clientId = this.getClientId();
        const attempts = this.rateLimit.get(clientId) || { count: 0, timestamp: Date.now() };
        
        // Reset after 1 hour
        if (Date.now() - attempts.timestamp > 3600000) {
            attempts.count = 0;
            attempts.timestamp = Date.now();
        }
        
        return attempts.count >= RegisterConfig.rateLimitPerIP;
    }

    recordRegistrationAttempt(success) {
        const clientId = this.getClientId();
        const attempts = this.rateLimit.get(clientId) || { count: 0, timestamp: Date.now() };
        
        attempts.count++;
        if (!success) attempts.failed = (attempts.failed || 0) + 1;
        
        this.rateLimit.set(clientId, attempts);
        
        // Clean up old entries
        setTimeout(() => {
            this.rateLimit.delete(clientId);
        }, 3600000);
    }

    getClientId() {
        // Simple client identification (in production, use IP from server)
        let id = localStorage.getItem('estif_client_id');
        if (!id) {
            id = 'client_' + Date.now() + '_' + Math.random().toString(36).substr(2, 16);
            localStorage.setItem('estif_client_id', id);
        }
        return id;
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
}

// ============================================
// REGISTRATION UI COMPONENT
// ============================================

class RegistrationUI {
    constructor(registrationManager) {
        this.registrationManager = registrationManager;
        this.form = null;
        this.elements = {};
        this.isLoading = false;
        this.passwordStrengthTimeout = null;
        this.init();
    }

    init() {
        this.cacheElements();
        this.bindEvents();
        this.setupPasswordStrength();
        this.setupEmailAvailability();
        RegisterConfig.debug && console.log('[RegistrationUI] Initialized');
    }

    cacheElements() {
        this.form = document.getElementById('registerForm');
        this.elements = {
            name: document.getElementById('regName'),
            email: document.getElementById('regEmail'),
            password: document.getElementById('regPassword'),
            confirmPassword: document.getElementById('regConfirmPassword'),
            phone: document.getElementById('regPhone'),
            referralCode: document.getElementById('regReferralCode'),
            terms: document.getElementById('regTerms'),
            submitBtn: document.querySelector('#registerForm button[type="submit"]'),
            errorMsg: document.getElementById('registerError'),
            successMsg: document.getElementById('registerSuccess'),
            passwordStrength: document.getElementById('passwordStrength'),
            passwordMatch: document.getElementById('passwordMatch'),
            emailAvailability: document.getElementById('emailAvailability'),
            verificationDialog: document.getElementById('verificationDialog')
        };
    }

    bindEvents() {
        if (this.form) {
            this.form.addEventListener('submit', (e) => this.handleSubmit(e));
        }
        
        // Real-time validation
        if (this.elements.password) {
            this.elements.password.addEventListener('input', () => this.updatePasswordStrength());
        }
        
        if (this.elements.confirmPassword) {
            this.elements.confirmPassword.addEventListener('input', () => this.updatePasswordMatch());
        }
        
        if (this.elements.email) {
            this.elements.email.addEventListener('blur', () => this.checkEmailAvailability());
        }
        
        if (this.elements.terms) {
            this.elements.terms.addEventListener('change', () => this.updateSubmitButton());
        }
    }

    async handleSubmit(event) {
        event.preventDefault();
        
        if (this.isLoading) return;
        
        const userData = {
            name: this.elements.name?.value.trim(),
            email: this.elements.email?.value.trim(),
            password: this.elements.password?.value,
            confirmPassword: this.elements.confirmPassword?.value,
            phone: this.elements.phone?.value.trim(),
            referralCode: this.elements.referralCode?.value.trim(),
            acceptedTerms: this.elements.terms?.checked || false
        };
        
        this.setLoading(true);
        this.clearMessages();
        
        const result = await this.registrationManager.register(userData);
        
        this.setLoading(false);
        
        if (result.success) {
            if (result.requiresVerification) {
                this.showVerificationDialog(result.userId);
            } else {
                this.showSuccess(result.message);
                setTimeout(() => {
                    window.location.href = '/login';
                }, 2000);
            }
        } else {
            this.showErrors(result);
        }
    }

    showVerificationDialog(userId) {
        const code = prompt('A verification code has been sent to your email. Please enter it below:');
        if (code) {
            this.verifyEmail(code, userId);
        }
    }

    async verifyEmail(code, userId) {
        this.setLoading(true);
        const result = await this.registrationManager.verifyEmail(code, userId);
        this.setLoading(false);
        
        if (result.success) {
            this.showSuccess('Email verified! Redirecting to login...');
            setTimeout(() => {
                window.location.href = '/login';
            }, 2000);
        } else {
            this.showError(result.error);
            // Option to resend
            if (confirm('Verification failed. Would you like to resend the code?')) {
                this.resendVerification();
            }
        }
    }

    async resendVerification() {
        const email = this.elements.email?.value.trim();
        if (!email) return;
        
        this.setLoading(true);
        const result = await this.registrationManager.resendVerificationEmail(email);
        this.setLoading(false);
        
        if (result.success) {
            this.showSuccess('Verification email resent!');
        } else {
            this.showError(result.error);
        }
    }

    updatePasswordStrength() {
        if (!RegisterConfig.showPasswordStrength) return;
        
        const password = this.elements.password?.value || '';
        const validation = RegistrationValidator.validatePassword(password);
        
        if (!this.elements.passwordStrength) return;
        
        if (password.length === 0) {
            this.elements.passwordStrength.style.display = 'none';
            return;
        }
        
        this.elements.passwordStrength.style.display = 'block';
        
        const strengthPercent = (validation.score / 6) * 100;
        const strengthColor = this.getStrengthColor(validation.strength);
        const strengthLabel = this.getStrengthLabel(validation.strength);
        
        this.elements.passwordStrength.innerHTML = `
            <div class="password-strength-bar">
                <div class="password-strength-fill" style="width: ${strengthPercent}%; background: ${strengthColor}"></div>
            </div>
            <div class="password-strength-text" style="color: ${strengthColor}">
                Password Strength: ${strengthLabel}
            </div>
            ${validation.errors.length > 0 ? `
                <div class="password-requirements">
                    ${validation.errors.map(e => `<span class="req-missing">✗ ${e}</span>`).join('')}
                </div>
            ` : ''}
        `;
    }

    updatePasswordMatch() {
        if (!RegisterConfig.showPasswordMatch) return;
        
        const password = this.elements.password?.value || '';
        const confirmPassword = this.elements.confirmPassword?.value || '';
        
        if (!this.elements.passwordMatch) return;
        
        if (confirmPassword.length === 0) {
            this.elements.passwordMatch.style.display = 'none';
            return;
        }
        
        this.elements.passwordMatch.style.display = 'block';
        
        const match = password === confirmPassword;
        const hasPassword = password.length > 0;
        
        this.elements.passwordMatch.innerHTML = `
            <div class="password-match ${match ? 'match' : 'mismatch'}">
                ${match ? '✓ Passwords match' : '✗ Passwords do not match'}
            </div>
        `;
    }

    async checkEmailAvailability() {
        const email = this.elements.email?.value.trim();
        if (!email || !RegistrationValidator.validateEmail(email).isValid) return;
        
        const availability = await RegistrationValidator.checkEmailAvailability(email);
        
        if (this.elements.emailAvailability) {
            this.elements.emailAvailability.style.display = 'block';
            this.elements.emailAvailability.innerHTML = `
                <div class="email-availability ${availability.available ? 'available' : 'taken'}">
                    ${availability.available ? 
                        '✓ Email is available' : 
                        '✗ ' + (availability.message || 'Email already registered')}
                </div>
            `;
        }
    }

    updateSubmitButton() {
        const termsAccepted = this.elements.terms?.checked || false;
        if (this.elements.submitBtn) {
            this.elements.submitBtn.disabled = !termsAccepted;
        }
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

    getStrengthLabel(strength) {
        const labels = {
            'very-weak': 'Very Weak',
            'weak': 'Weak',
            'medium': 'Medium',
            'strong': 'Strong',
            'very-strong': 'Very Strong'
        };
        return labels[strength] || 'Unknown';
    }

    setupPasswordStrength() {
        // Add CSS for password strength indicator
        const style = document.createElement('style');
        style.textContent = `
            .password-strength-bar {
                height: 4px;
                background: #e0e0e0;
                border-radius: 2px;
                overflow: hidden;
                margin: 8px 0;
            }
            .password-strength-fill {
                height: 100%;
                transition: width 0.3s ease;
            }
            .password-strength-text {
                font-size: 12px;
                margin-bottom: 8px;
            }
            .password-requirements {
                display: flex;
                flex-wrap: wrap;
                gap: 8px;
                margin-top: 8px;
            }
            .req-missing {
                font-size: 11px;
                color: #ef476f;
            }
            .password-match {
                font-size: 12px;
                margin-top: 4px;
            }
            .password-match.match { color: #06d6a0; }
            .password-match.mismatch { color: #ef476f; }
            .email-availability {
                font-size: 12px;
                margin-top: 4px;
            }
            .email-availability.available { color: #06d6a0; }
            .email-availability.taken { color: #ef476f; }
        `;
        document.head.appendChild(style);
    }

    setupEmailAvailability() {
        // Debounced email check
        let timeout;
        if (this.elements.email) {
            this.elements.email.addEventListener('input', () => {
                clearTimeout(timeout);
                timeout = setTimeout(() => this.checkEmailAvailability(), 500);
            });
        }
    }

    setLoading(loading) {
        this.isLoading = loading;
        
        if (this.elements.submitBtn) {
            this.elements.submitBtn.disabled = loading;
            this.elements.submitBtn.innerHTML = loading ? 
                '<i class="fas fa-spinner fa-spin"></i> Registering...' : 
                '<i class="fas fa-user-plus"></i> Register';
        }
    }

    clearMessages() {
        if (this.elements.errorMsg) {
            this.elements.errorMsg.style.display = 'none';
            this.elements.errorMsg.textContent = '';
        }
        if (this.elements.successMsg) {
            this.elements.successMsg.style.display = 'none';
            this.elements.successMsg.textContent = '';
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
        
        if (window.showToast) {
            window.showToast(message, 'error');
        }
    }

    showSuccess(message) {
        if (this.elements.successMsg) {
            this.elements.successMsg.textContent = message;
            this.elements.successMsg.style.display = 'block';
        }
        
        if (window.showToast) {
            window.showToast(message, 'success');
        }
    }

    showErrors(result) {
        if (result.fieldErrors) {
            // Show field-specific errors
            for (const [field, error] of Object.entries(result.fieldErrors)) {
                const fieldElement = document.getElementById(`reg${field.charAt(0).toUpperCase() + field.slice(1)}`);
                if (fieldElement) {
                    this.showFieldError(fieldElement, error);
                }
            }
        } else if (result.error) {
            this.showError(result.error);
        }
    }

    showFieldError(fieldElement, error) {
        fieldElement.classList.add('error');
        
        // Create or update error message element
        let errorDiv = fieldElement.parentElement.querySelector('.field-error');
        if (!errorDiv) {
            errorDiv = document.createElement('div');
            errorDiv.className = 'field-error';
            fieldElement.parentElement.appendChild(errorDiv);
        }
        errorDiv.textContent = error;
        errorDiv.style.color = '#ef476f';
        errorDiv.style.fontSize = '12px';
        errorDiv.style.marginTop = '4px';
        
        // Remove error on input
        fieldElement.addEventListener('input', () => {
            fieldElement.classList.remove('error');
            if (errorDiv) errorDiv.remove();
        }, { once: true });
    }
}

// ============================================
// CREATE SINGLETON INSTANCES
// ============================================

const registrationManager = new RegistrationManager();
const registrationUI = new RegistrationUI(registrationManager);

// ============================================
// EXPORTS
// ============================================

// Expose to window
window.registrationManager = registrationManager;
window.registrationUI = registrationUI;
window.RegistrationManager = RegistrationManager;
window.RegistrationValidator = RegistrationValidator;
window.RegisterConfig = RegisterConfig;

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        registrationManager,
        registrationUI,
        RegistrationManager,
        RegistrationValidator,
        RegisterConfig
    };
}

// ES modules export
export {
    registrationManager,
    registrationUI,
    RegistrationManager,
    RegistrationValidator,
    RegisterConfig
};