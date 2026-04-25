/**
 * ESTIF HOME ULTIMATE - PASSWORD RESET MODULE
 * Secure password reset with email verification, OTP, and security questions
 * Version: 2.0.0
 * Author: Estifanos Yohannis
 */

// ============================================
// PASSWORD RESET CONFIGURATION
// ============================================

const PasswordResetConfig = {
    // Security settings
    otpLength: 6,
    otpExpiry: 600000, // 10 minutes in milliseconds
    resetTokenExpiry: 3600000, // 1 hour
    maxResetAttempts: 3,
    lockoutDuration: 900000, // 15 minutes
    
    // Features
    enableSecurityQuestions: true,
    enableOTPVerification: true,
    requireCurrentPassword: false,
    enableBiometricReset: false,
    
    // Validation
    minPasswordLength: 8,
    maxPasswordLength: 64,
    requireStrongPassword: true,
    
    // Endpoints
    apiEndpoint: '/api/auth',
    forgotEndpoint: '/api/auth/forgot-password',
    resetEndpoint: '/api/auth/reset-password',
    verifyOTPEndpoint: '/api/auth/verify-otp',
    securityQuestionsEndpoint: '/api/auth/security-questions',
    
    // UI
    showPasswordStrength: true,
    showPasswordMatch: true,
    enableProgressSteps: true,
    
    // Debug
    debug: false
};

// ============================================
// PASSWORD VALIDATOR
// ============================================

class PasswordValidator {
    static validatePassword(password) {
        if (!password) {
            return { isValid: false, error: 'Password is required' };
        }
        
        const checks = {
            length: password.length >= PasswordResetConfig.minPasswordLength,
            maxLength: password.length <= PasswordResetConfig.maxPasswordLength,
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
        
        const isValid = PasswordResetConfig.requireStrongPassword ? score >= 4 : score >= 3;
        
        const errors = [];
        if (!checks.length) errors.push(`Password must be at least ${PasswordResetConfig.minPasswordLength} characters`);
        if (!checks.uppercase) errors.push('Must contain at least one uppercase letter');
        if (!checks.lowercase) errors.push('Must contain at least one lowercase letter');
        if (!checks.number) errors.push('Must contain at least one number');
        if (!checks.special) errors.push('Must contain at least one special character');
        if (!checks.noSpaces) errors.push('Cannot contain spaces');
        
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

    static getStrengthLabel(strength) {
        const labels = {
            'very-weak': 'Very Weak',
            'weak': 'Weak',
            'medium': 'Medium',
            'strong': 'Strong',
            'very-strong': 'Very Strong'
        };
        return labels[strength] || 'Unknown';
    }

    static getStrengthColor(strength) {
        const colors = {
            'very-weak': '#ef476f',
            'weak': '#ffd166',
            'medium': '#4cc9f0',
            'strong': '#06d6a0',
            'very-strong': '#06d6a0'
        };
        return colors[strength] || '#6c757d';
    }
}

// ============================================
// PASSWORD RESET MANAGER
// ============================================

class PasswordResetManager {
    constructor() {
        this.resetState = {
            step: 'email', // email, otp, security, reset, complete
            email: null,
            otp: null,
            otpExpiry: null,
            resetToken: null,
            securityAnswers: {},
            attempts: 0,
            lockedUntil: null
        };
        
        this.securityQuestions = [];
        this.listeners = [];
        
        this.init();
    }

    init() {
        this.loadState();
        this.loadSecurityQuestions();
        PasswordResetConfig.debug && console.log('[PasswordReset] Manager initialized');
    }

    loadState() {
        try {
            const saved = localStorage.getItem('estif_password_reset');
            if (saved) {
                const state = JSON.parse(saved);
                const expiry = new Date(state.resetState?.otpExpiry);
                if (expiry > new Date()) {
                    this.resetState = state.resetState;
                } else {
                    this.clearState();
                }
            }
        } catch (error) {
            PasswordResetConfig.debug && console.log('[PasswordReset] Failed to load state');
        }
    }

    saveState() {
        try {
            localStorage.setItem('estif_password_reset', JSON.stringify({
                resetState: this.resetState,
                savedAt: new Date().toISOString()
            }));
        } catch (error) {
            PasswordResetConfig.debug && console.log('[PasswordReset] Failed to save state');
        }
    }

    clearState() {
        this.resetState = {
            step: 'email',
            email: null,
            otp: null,
            otpExpiry: null,
            resetToken: null,
            securityAnswers: {},
            attempts: 0,
            lockedUntil: null
        };
        localStorage.removeItem('estif_password_reset');
        this.notifyListeners('state_cleared');
    }

    async loadSecurityQuestions() {
        try {
            const response = await fetch(PasswordResetConfig.securityQuestionsEndpoint);
            if (response.ok) {
                this.securityQuestions = await response.json();
            } else {
                // Default security questions
                this.securityQuestions = [
                    { id: 1, question: 'What was your first pet\'s name?' },
                    { id: 2, question: 'What is your mother\'s maiden name?' },
                    { id: 3, question: 'What city were you born in?' },
                    { id: 4, question: 'What was your first car?' },
                    { id: 5, question: 'What is your favorite book?' }
                ];
            }
        } catch (error) {
            // Default questions if API fails
            this.securityQuestions = [
                { id: 1, question: 'What was your first pet\'s name?' },
                { id: 2, question: 'What is your mother\'s maiden name?' },
                { id: 3, question: 'What city were you born in?' },
                { id: 4, question: 'What was your first car?' },
                { id: 5, question: 'What is your favorite book?' }
            ];
        }
    }

    // ============================================
    // RESET STEPS
    // ============================================

    async requestOTP(email) {
        // Check lockout
        if (this.isLockedOut()) {
            return {
                success: false,
                error: `Too many attempts. Please try again in ${Math.ceil(this.getLockoutRemaining() / 60000)} minutes.`,
                locked: true
            };
        }

        try {
            const response = await fetch(PasswordResetConfig.forgotEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });

            const data = await response.json();

            if (response.ok) {
                this.resetState.email = email;
                this.resetState.otpExpiry = Date.now() + PasswordResetConfig.otpExpiry;
                this.resetState.step = PasswordResetConfig.enableSecurityQuestions ? 'security' : 'otp';
                this.saveState();
                
                this.notifyListeners('otp_sent', { email });
                
                return {
                    success: true,
                    message: 'Verification code sent to your email',
                    requiresSecurityQuestions: PasswordResetConfig.enableSecurityQuestions && data.requiresSecurityQuestions
                };
            } else {
                this.incrementAttempts();
                return { success: false, error: data.message || 'Email not found' };
            }
        } catch (error) {
            console.error('[PasswordReset] Request OTP error:', error);
            return { success: false, error: 'Network error. Please try again.' };
        }
    }

    async verifySecurityAnswers(answers) {
        if (!PasswordResetConfig.enableSecurityQuestions) {
            return { success: true };
        }

        try {
            const response = await fetch(`${PasswordResetConfig.apiEndpoint}/verify-security`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: this.resetState.email,
                    answers
                })
            });

            const data = await response.json();

            if (response.ok) {
                this.resetState.securityAnswers = answers;
                this.resetState.step = 'otp';
                this.saveState();
                
                return { success: true };
            } else {
                this.incrementAttempts();
                return { success: false, error: data.message || 'Security answers incorrect' };
            }
        } catch (error) {
            return { success: false, error: 'Verification failed' };
        }
    }

    async verifyOTP(otp) {
        // Check expiry
        if (this.resetState.otpExpiry && Date.now() > this.resetState.otpExpiry) {
            return { success: false, error: 'OTP has expired. Please request a new one.' };
        }

        try {
            const response = await fetch(PasswordResetConfig.verifyOTPEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: this.resetState.email,
                    otp
                })
            });

            const data = await response.json();

            if (response.ok) {
                this.resetState.resetToken = data.resetToken;
                this.resetState.step = 'reset';
                this.saveState();
                
                return { success: true, resetToken: data.resetToken };
            } else {
                this.incrementAttempts();
                return { success: false, error: data.message || 'Invalid verification code' };
            }
        } catch (error) {
            return { success: false, error: 'Verification failed' };
        }
    }

    async resetPassword(newPassword, confirmPassword) {
        // Validate password
        const validation = PasswordValidator.validatePassword(newPassword);
        if (!validation.isValid) {
            return { success: false, error: validation.error };
        }
        
        const matchValidation = PasswordValidator.validatePasswordMatch(newPassword, confirmPassword);
        if (!matchValidation.isValid) {
            return { success: false, error: matchValidation.error };
        }

        if (!this.resetState.resetToken) {
            return { success: false, error: 'No reset token found. Please restart the process.' };
        }

        try {
            const response = await fetch(PasswordResetConfig.resetEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: this.resetState.email,
                    token: this.resetState.resetToken,
                    newPassword
                })
            });

            const data = await response.json();

            if (response.ok) {
                this.resetState.step = 'complete';
                this.saveState();
                this.notifyListeners('password_reset', { email: this.resetState.email });
                
                return { success: true, message: 'Password reset successful! You can now log in.' };
            } else {
                return { success: false, error: data.message || 'Password reset failed' };
            }
        } catch (error) {
            return { success: false, error: 'Network error. Please try again.' };
        }
    }

    async resendOTP() {
        if (!this.resetState.email) {
            return { success: false, error: 'No email found. Please restart the process.' };
        }
        
        return await this.requestOTP(this.resetState.email);
    }

    // ============================================
    // RATE LIMITING
    // ============================================

    isLockedOut() {
        if (this.resetState.lockedUntil && Date.now() < this.resetState.lockedUntil) {
            return true;
        }
        return false;
    }

    getLockoutRemaining() {
        if (!this.resetState.lockedUntil) return 0;
        return Math.max(0, this.resetState.lockedUntil - Date.now());
    }

    incrementAttempts() {
        this.resetState.attempts++;
        
        if (this.resetState.attempts >= PasswordResetConfig.maxResetAttempts) {
            this.resetState.lockedUntil = Date.now() + PasswordResetConfig.lockoutDuration;
            this.resetState.attempts = 0;
        }
        
        this.saveState();
        this.notifyListeners('attempts_updated', { attempts: this.resetState.attempts });
    }

    resetAttempts() {
        this.resetState.attempts = 0;
        this.resetState.lockedUntil = null;
        this.saveState();
    }

    // ============================================
    // STATE MANAGEMENT
    // ============================================

    getCurrentStep() {
        return this.resetState.step;
    }

    getEmail() {
        return this.resetState.email;
    }

    isComplete() {
        return this.resetState.step === 'complete';
    }

    canResendOTP() {
        return this.resetState.step === 'otp' && 
               this.resetState.otpExpiry && 
               Date.now() > this.resetState.otpExpiry - 30000; // Allow resend 30 seconds before expiry
    }

    getOTPExpiryTime() {
        return this.resetState.otpExpiry;
    }

    getOTPRemainingSeconds() {
        if (!this.resetState.otpExpiry) return 0;
        return Math.max(0, Math.floor((this.resetState.otpExpiry - Date.now()) / 1000));
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
// PASSWORD RESET UI COMPONENT
// ============================================

class PasswordResetUI {
    constructor(resetManager) {
        this.resetManager = resetManager;
        this.container = null;
        this.steps = {};
        this.currentStep = null;
        this.otpTimer = null;
        this.init();
    }

    init() {
        this.container = document.getElementById('password-reset-container');
        if (!this.container) return;
        
        this.createUI();
        this.bindEvents();
        this.subscribeToManager();
        this.showStep(this.resetManager.getCurrentStep());
        
        PasswordResetConfig.debug && console.log('[PasswordResetUI] Initialized');
    }

    createUI() {
        this.container.innerHTML = `
            <div class="password-reset">
                <div class="reset-header">
                    <h2>Reset Password</h2>
                    <p>Enter your email to receive a verification code</p>
                </div>
                
                <div class="reset-steps" id="resetSteps">
                    <div class="step email-step active" data-step="email">
                        <div class="step-icon">1</div>
                        <div class="step-label">Email</div>
                    </div>
                    <div class="step security-step" data-step="security">
                        <div class="step-icon">2</div>
                        <div class="step-label">Security</div>
                    </div>
                    <div class="step otp-step" data-step="otp">
                        <div class="step-icon">3</div>
                        <div class="step-label">Verification</div>
                    </div>
                    <div class="step reset-step" data-step="reset">
                        <div class="step-icon">4</div>
                        <div class="step-label">New Password</div>
                    </div>
                    <div class="step complete-step" data-step="complete">
                        <div class="step-icon">5</div>
                        <div class="step-label">Complete</div>
                    </div>
                </div>
                
                <div class="reset-content">
                    <!-- Email Step -->
                    <div class="reset-step-content" id="step-email">
                        <div class="form-group">
                            <label>Email Address</label>
                            <input type="email" id="resetEmail" placeholder="Enter your email address" required>
                        </div>
                        <button id="sendOtpBtn" class="btn btn-primary">Send Verification Code</button>
                    </div>
                    
                    <!-- Security Questions Step -->
                    <div class="reset-step-content" id="step-security" style="display: none;">
                        <div id="securityQuestionsContainer"></div>
                        <button id="verifySecurityBtn" class="btn btn-primary">Verify Answers</button>
                    </div>
                    
                    <!-- OTP Step -->
                    <div class="reset-step-content" id="step-otp" style="display: none;">
                        <div class="form-group">
                            <label>Verification Code</label>
                            <input type="text" id="resetOtp" placeholder="Enter 6-digit code" maxlength="6" required>
                            <small class="otp-timer" id="otpTimer"></small>
                        </div>
                        <button id="verifyOtpBtn" class="btn btn-primary">Verify Code</button>
                        <button id="resendOtpBtn" class="btn btn-link" style="display: none;">Resend Code</button>
                    </div>
                    
                    <!-- Reset Password Step -->
                    <div class="reset-step-content" id="step-reset" style="display: none;">
                        <div class="form-group">
                            <label>New Password</label>
                            <input type="password" id="newPassword" placeholder="Enter new password" required>
                            <div id="passwordStrength" class="password-strength"></div>
                        </div>
                        <div class="form-group">
                            <label>Confirm New Password</label>
                            <input type="password" id="confirmPassword" placeholder="Confirm new password" required>
                            <div id="passwordMatch" class="password-match"></div>
                        </div>
                        <button id="resetPasswordBtn" class="btn btn-primary">Reset Password</button>
                    </div>
                    
                    <!-- Complete Step -->
                    <div class="reset-step-content" id="step-complete" style="display: none;">
                        <div class="success-icon">✓</div>
                        <h3>Password Reset Successful!</h3>
                        <p>Your password has been changed. You can now log in with your new password.</p>
                        <button id="loginBtn" class="btn btn-primary">Go to Login</button>
                    </div>
                </div>
                
                <div class="reset-footer">
                    <a href="/login" class="back-to-login">← Back to Login</a>
                </div>
            </div>
        `;
        
        // Cache elements
        this.elements = {
            emailInput: document.getElementById('resetEmail'),
            sendBtn: document.getElementById('sendOtpBtn'),
            otpInput: document.getElementById('resetOtp'),
            verifyOtpBtn: document.getElementById('verifyOtpBtn'),
            resendBtn: document.getElementById('resendOtpBtn'),
            otpTimer: document.getElementById('otpTimer'),
            newPassword: document.getElementById('newPassword'),
            confirmPassword: document.getElementById('confirmPassword'),
            resetBtn: document.getElementById('resetPasswordBtn'),
            passwordStrength: document.getElementById('passwordStrength'),
            passwordMatch: document.getElementById('passwordMatch'),
            loginBtn: document.getElementById('loginBtn'),
            securityContainer: document.getElementById('securityQuestionsContainer'),
            verifySecurityBtn: document.getElementById('verifySecurityBtn')
        };
    }

    bindEvents() {
        if (this.elements.sendBtn) {
            this.elements.sendBtn.addEventListener('click', () => this.handleSendOTP());
        }
        
        if (this.elements.verifyOtpBtn) {
            this.elements.verifyOtpBtn.addEventListener('click', () => this.handleVerifyOTP());
        }
        
        if (this.elements.resendBtn) {
            this.elements.resendBtn.addEventListener('click', () => this.handleResendOTP());
        }
        
        if (this.elements.resetBtn) {
            this.elements.resetBtn.addEventListener('click', () => this.handleResetPassword());
        }
        
        if (this.elements.loginBtn) {
            this.elements.loginBtn.addEventListener('click', () => {
                window.location.href = '/login';
            });
        }
        
        if (this.elements.verifySecurityBtn) {
            this.elements.verifySecurityBtn.addEventListener('click', () => this.handleVerifySecurity());
        }
        
        // Real-time validation
        if (this.elements.newPassword) {
            this.elements.newPassword.addEventListener('input', () => this.updatePasswordStrength());
        }
        
        if (this.elements.confirmPassword) {
            this.elements.confirmPassword.addEventListener('input', () => this.updatePasswordMatch());
        }
        
        // Enter key support
        if (this.elements.otpInput) {
            this.elements.otpInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.handleVerifyOTP();
            });
        }
    }

    subscribeToManager() {
        this.resetManager.addEventListener('otp_sent', () => {
            this.showStep('otp');
            this.startOTPTimer();
        });
        
        this.resetManager.addEventListener('password_reset', () => {
            this.showStep('complete');
        });
    }

    async handleSendOTP() {
        const email = this.elements.emailInput?.value.trim();
        
        if (!email) {
            this.showError('Please enter your email address');
            return;
        }
        
        this.setLoading(true);
        const result = await this.resetManager.requestOTP(email);
        this.setLoading(false);
        
        if (result.success) {
            if (result.requiresSecurityQuestions) {
                await this.loadSecurityQuestions();
                this.showStep('security');
            } else {
                this.showStep('otp');
                this.startOTPTimer();
            }
            this.showSuccess(result.message);
        } else {
            this.showError(result.error);
        }
    }

    async loadSecurityQuestions() {
        const questions = this.resetManager.securityQuestions;
        if (!this.elements.securityContainer) return;
        
        this.elements.securityContainer.innerHTML = questions.map(q => `
            <div class="form-group">
                <label>${q.question}</label>
                <input type="text" class="security-answer" data-question-id="${q.id}" placeholder="Your answer" required>
            </div>
        `).join('');
    }

    async handleVerifySecurity() {
        const answers = {};
        const answerInputs = document.querySelectorAll('.security-answer');
        
        for (const input of answerInputs) {
            const questionId = parseInt(input.dataset.questionId);
            answers[questionId] = input.value.trim();
        }
        
        this.setLoading(true);
        const result = await this.resetManager.verifySecurityAnswers(answers);
        this.setLoading(false);
        
        if (result.success) {
            this.showStep('otp');
            this.startOTPTimer();
        } else {
            this.showError(result.error);
        }
    }

    async handleVerifyOTP() {
        const otp = this.elements.otpInput?.value.trim();
        
        if (!otp || otp.length !== PasswordResetConfig.otpLength) {
            this.showError(`Please enter the ${PasswordResetConfig.otpLength}-digit verification code`);
            return;
        }
        
        this.setLoading(true);
        const result = await this.resetManager.verifyOTP(otp);
        this.setLoading(false);
        
        if (result.success) {
            this.showStep('reset');
        } else {
            this.showError(result.error);
        }
    }

    async handleResendOTP() {
        this.setLoading(true);
        const result = await this.resetManager.resendOTP();
        this.setLoading(false);
        
        if (result.success) {
            this.showSuccess('New verification code sent!');
            this.startOTPTimer();
        } else {
            this.showError(result.error);
        }
    }

    async handleResetPassword() {
        const newPassword = this.elements.newPassword?.value;
        const confirmPassword = this.elements.confirmPassword?.value;
        
        this.setLoading(true);
        const result = await this.resetManager.resetPassword(newPassword, confirmPassword);
        this.setLoading(false);
        
        if (result.success) {
            this.showSuccess(result.message);
        } else {
            this.showError(result.error);
        }
    }

    updatePasswordStrength() {
        if (!PasswordResetConfig.showPasswordStrength) return;
        
        const password = this.elements.newPassword?.value || '';
        const validation = PasswordValidator.validatePassword(password);
        
        if (!this.elements.passwordStrength) return;
        
        if (password.length === 0) {
            this.elements.passwordStrength.style.display = 'none';
            return;
        }
        
        this.elements.passwordStrength.style.display = 'block';
        
        const strengthPercent = (validation.score / 6) * 100;
        const strengthColor = PasswordValidator.getStrengthColor(validation.strength);
        const strengthLabel = PasswordValidator.getStrengthLabel(validation.strength);
        
        this.elements.passwordStrength.innerHTML = `
            <div class="strength-bar">
                <div class="strength-fill" style="width: ${strengthPercent}%; background: ${strengthColor}"></div>
            </div>
            <div class="strength-text" style="color: ${strengthColor}">
                Password Strength: ${strengthLabel}
            </div>
            ${validation.errors.length > 0 ? `
                <div class="strength-requirements">
                    ${validation.errors.map(e => `<span class="req-missing">✗ ${e}</span>`).join('')}
                </div>
            ` : ''}
        `;
    }

    updatePasswordMatch() {
        if (!PasswordResetConfig.showPasswordMatch) return;
        
        const password = this.elements.newPassword?.value || '';
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
            <div class="match-indicator ${match ? 'match' : 'mismatch'}">
                ${match ? '✓ Passwords match' : '✗ Passwords do not match'}
            </div>
        `;
    }

    startOTPTimer() {
        if (this.otpTimer) clearInterval(this.otpTimer);
        
        const updateTimer = () => {
            const remaining = this.resetManager.getOTPRemainingSeconds();
            
            if (remaining <= 0) {
                clearInterval(this.otpTimer);
                if (this.elements.otpTimer) {
                    this.elements.otpTimer.textContent = 'Code expired. Please request a new one.';
                }
                if (this.elements.resendBtn) {
                    this.elements.resendBtn.style.display = 'block';
                }
                return;
            }
            
            const minutes = Math.floor(remaining / 60);
            const seconds = remaining % 60;
            
            if (this.elements.otpTimer) {
                this.elements.otpTimer.textContent = `Code expires in: ${minutes}:${seconds.toString().padStart(2, '0')}`;
            }
        };
        
        updateTimer();
        this.otpTimer = setInterval(updateTimer, 1000);
    }

    showStep(step) {
        this.currentStep = step;
        
        // Update step indicators
        const steps = document.querySelectorAll('.reset-steps .step');
        steps.forEach(s => {
            const stepName = s.dataset.step;
            s.classList.remove('active', 'completed');
            
            if (stepName === step) {
                s.classList.add('active');
            } else if (this.getStepIndex(stepName) < this.getStepIndex(step)) {
                s.classList.add('completed');
            }
        });
        
        // Show/hide content
        const contents = document.querySelectorAll('.reset-step-content');
        contents.forEach(content => content.style.display = 'none');
        
        const activeContent = document.getElementById(`step-${step}`);
        if (activeContent) activeContent.style.display = 'block';
        
        // Focus first input
        const firstInput = activeContent?.querySelector('input');
        if (firstInput) firstInput.focus();
    }

    getStepIndex(step) {
        const steps = ['email', 'security', 'otp', 'reset', 'complete'];
        return steps.indexOf(step);
    }

    setLoading(loading) {
        const buttons = ['sendBtn', 'verifyOtpBtn', 'resendBtn', 'resetBtn', 'verifySecurityBtn'];
        buttons.forEach(btn => {
            if (this.elements[btn]) {
                this.elements[btn].disabled = loading;
                if (loading) {
                    this.elements[btn].innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';
                } else {
                    const originalText = this.getOriginalButtonText(btn);
                    this.elements[btn].innerHTML = originalText;
                }
            }
        });
    }

    getOriginalButtonText(btn) {
        const texts = {
            sendBtn: 'Send Verification Code',
            verifyOtpBtn: 'Verify Code',
            resendBtn: 'Resend Code',
            resetBtn: 'Reset Password',
            verifySecurityBtn: 'Verify Answers'
        };
        return texts[btn] || 'Submit';
    }

    showError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.textContent = message;
        errorDiv.style.color = '#ef476f';
        errorDiv.style.padding = '10px';
        errorDiv.style.marginBottom = '10px';
        errorDiv.style.borderRadius = '8px';
        errorDiv.style.background = 'rgba(239, 71, 111, 0.1)';
        
        const container = document.querySelector('.reset-content');
        const existing = container.querySelector('.error-message');
        if (existing) existing.remove();
        
        container.insertBefore(errorDiv, container.firstChild);
        
        setTimeout(() => errorDiv.remove(), 5000);
        
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

const passwordResetManager = new PasswordResetManager();
const passwordResetUI = new PasswordResetUI(passwordResetManager);

// ============================================
// EXPORTS
// ============================================

// Expose to window
window.passwordResetManager = passwordResetManager;
window.passwordResetUI = passwordResetUI;
window.PasswordResetManager = PasswordResetManager;
window.PasswordValidator = PasswordValidator;
window.PasswordResetConfig = PasswordResetConfig;

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        passwordResetManager,
        passwordResetUI,
        PasswordResetManager,
        PasswordValidator,
        PasswordResetConfig
    };
}

// ES modules export
export {
    passwordResetManager,
    passwordResetUI,
    PasswordResetManager,
    PasswordValidator,
    PasswordResetConfig
};