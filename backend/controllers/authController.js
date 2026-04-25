/**
 * ESTIF HOME ULTIMATE - AUTH CONTROLLER
 * Authentication and authorization logic
 * Version: 2.0.0
 * Author: Estifanos Yohannis
 */

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const User = require('../models/User');
const Session = require('../models/Session');
const ActivityLog = require('../models/ActivityLog');
const { sendEmail } = require('../services/communication/emailService');

// Generate JWT token
const generateToken = (userId) => {
    return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
        expiresIn: '7d'
    });
};

// Generate refresh token
const generateRefreshToken = (userId) => {
    return jwt.sign({ id: userId }, process.env.JWT_REFRESH_SECRET, {
        expiresIn: '30d'
    });
};

// Register new user
exports.register = async (req, res) => {
    try {
        const { name, email, password } = req.body;

        // Check if user exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'Email already registered'
            });
        }

        // Create verification token
        const verificationToken = crypto.randomBytes(32).toString('hex');

        // Create user
        const user = await User.create({
            name,
            email,
            password,
            verificationToken,
            verificationTokenExpires: Date.now() + 24 * 60 * 60 * 1000
        });

        // Send verification email
        await sendEmail({
            to: email,
            subject: 'Verify Your Email',
            template: 'email-verification',
            data: { name, token: verificationToken }
        });

        res.status(201).json({
            success: true,
            message: 'Registration successful. Please check your email to verify your account.',
            data: {
                userId: user._id,
                email: user.email
            }
        });
    } catch (error) {
        console.error('Register error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Login user
exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Find user
        const user = await User.findOne({ email }).select('+password');
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        // Check if email is verified
        if (!user.isEmailVerified) {
            return res.status(401).json({
                success: false,
                message: 'Please verify your email before logging in'
            });
        }

        // Check password
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            // Track failed login attempt
            await ActivityLog.create({
                userId: user._id,
                action: 'login_failed',
                ip: req.ip,
                userAgent: req.headers['user-agent']
            });
            
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        // Generate tokens
        const token = generateToken(user._id);
        const refreshToken = generateRefreshToken(user._id);

        // Save session
        await Session.create({
            userId: user._id,
            token: refreshToken,
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
            expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        });

        // Update last login
        user.lastLogin = Date.now();
        await user.save();

        // Log activity
        await ActivityLog.create({
            userId: user._id,
            action: 'login_success',
            ip: req.ip,
            userAgent: req.headers['user-agent']
        });

        // Set cookie
        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000
        });

        res.json({
            success: true,
            data: {
                user: {
                    id: user._id,
                    name: user.name,
                    email: user.email,
                    role: user.role,
                    avatar: user.avatar,
                    settings: user.settings
                },
                token,
                refreshToken
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Logout user
exports.logout = async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1] || req.cookies.token;
        
        if (token) {
            // Blacklist token (optional - implement Redis blacklist)
            await Session.deleteOne({ token });
        }

        res.clearCookie('token');
        
        await ActivityLog.create({
            userId: req.user?._id,
            action: 'logout',
            ip: req.ip,
            userAgent: req.headers['user-agent']
        });

        res.json({
            success: true,
            message: 'Logged out successfully'
        });
    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Refresh token
exports.refreshToken = async (req, res) => {
    try {
        const { refreshToken } = req.body;

        if (!refreshToken) {
            return res.status(401).json({
                success: false,
                message: 'Refresh token required'
            });
        }

        // Verify refresh token
        const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
        
        // Check if session exists
        const session = await Session.findOne({ token: refreshToken, userId: decoded.id });
        if (!session) {
            return res.status(401).json({
                success: false,
                message: 'Invalid refresh token'
            });
        }

        // Generate new tokens
        const newToken = generateToken(decoded.id);
        const newRefreshToken = generateRefreshToken(decoded.id);

        // Update session
        session.token = newRefreshToken;
        session.lastUsed = Date.now();
        await session.save();

        res.json({
            success: true,
            data: {
                token: newToken,
                refreshToken: newRefreshToken
            }
        });
    } catch (error) {
        console.error('Refresh token error:', error);
        res.status(401).json({
            success: false,
            message: 'Invalid refresh token'
        });
    }
};

// Forgot password
exports.forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;

        const user = await User.findOne({ email });
        if (!user) {
            // Don't reveal that user doesn't exist for security
            return res.json({
                success: true,
                message: 'If your email is registered, you will receive a password reset link'
            });
        }

        // Generate reset token
        const resetToken = crypto.randomBytes(32).toString('hex');
        user.resetPasswordToken = resetToken;
        user.resetPasswordExpires = Date.now() + 1 * 60 * 60 * 1000; // 1 hour
        await user.save();

        // Send reset email
        await sendEmail({
            to: email,
            subject: 'Password Reset Request',
            template: 'password-reset',
            data: { name: user.name, token: resetToken }
        });

        res.json({
            success: true,
            message: 'Password reset email sent'
        });
    } catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Reset password
exports.resetPassword = async (req, res) => {
    try {
        const { token, password } = req.body;

        const user = await User.findOne({
            resetPasswordToken: token,
            resetPasswordExpires: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).json({
                success: false,
                message: 'Invalid or expired reset token'
            });
        }

        // Update password
        user.password = await bcrypt.hash(password, 12);
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;
        await user.save();

        // Log activity
        await ActivityLog.create({
            userId: user._id,
            action: 'password_reset',
            ip: req.ip,
            userAgent: req.headers['user-agent']
        });

        res.json({
            success: true,
            message: 'Password reset successful'
        });
    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Verify email
exports.verifyEmail = async (req, res) => {
    try {
        const { token } = req.params;

        const user = await User.findOne({
            verificationToken: token,
            verificationTokenExpires: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).json({
                success: false,
                message: 'Invalid or expired verification token'
            });
        }

        user.isEmailVerified = true;
        user.verificationToken = undefined;
        user.verificationTokenExpires = undefined;
        await user.save();

        res.json({
            success: true,
            message: 'Email verified successfully'
        });
    } catch (error) {
        console.error('Verify email error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Resend verification email
exports.resendVerification = async (req, res) => {
    try {
        const { email } = req.body;

        const user = await User.findOne({ email });
        if (!user || user.isEmailVerified) {
            return res.status(400).json({
                success: false,
                message: 'Invalid request'
            });
        }

        // Generate new token
        const verificationToken = crypto.randomBytes(32).toString('hex');
        user.verificationToken = verificationToken;
        user.verificationTokenExpires = Date.now() + 24 * 60 * 60 * 1000;
        await user.save();

        // Send verification email
        await sendEmail({
            to: email,
            subject: 'Verify Your Email',
            template: 'email-verification',
            data: { name: user.name, token: verificationToken }
        });

        res.json({
            success: true,
            message: 'Verification email sent'
        });
    } catch (error) {
        console.error('Resend verification error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Get current user
exports.getCurrentUser = async (req, res) => {
    try {
        const user = await User.findById(req.user._id)
            .select('-password -verificationToken -resetPasswordToken');

        res.json({
            success: true,
            data: user
        });
    } catch (error) {
        console.error('Get current user error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Update profile
exports.updateProfile = async (req, res) => {
    try {
        const { name, avatar, phone, settings } = req.body;

        const user = await User.findByIdAndUpdate(
            req.user._id,
            { name, avatar, phone, settings, updatedAt: Date.now() },
            { new: true, runValidators: true }
        ).select('-password');

        await ActivityLog.create({
            userId: req.user._id,
            action: 'profile_updated',
            ip: req.ip,
            userAgent: req.headers['user-agent'],
            details: { updatedFields: Object.keys(req.body) }
        });

        res.json({
            success: true,
            data: user
        });
    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Change password
exports.changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        const user = await User.findById(req.user._id).select('+password');

        const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({
                success: false,
                message: 'Current password is incorrect'
            });
        }

        user.password = await bcrypt.hash(newPassword, 12);
        await user.save();

        await ActivityLog.create({
            userId: req.user._id,
            action: 'password_changed',
            ip: req.ip,
            userAgent: req.headers['user-agent']
        });

        res.json({
            success: true,
            message: 'Password changed successfully'
        });
    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Enable two-factor authentication
exports.enableTwoFactor = async (req, res) => {
    try {
        const { code } = req.body;
        
        // Verify 2FA code (implementation depends on 2FA method)
        // This is a placeholder - implement actual 2FA logic
        
        await User.findByIdAndUpdate(req.user._id, {
            'settings.twoFactorEnabled': true,
            'settings.twoFactorMethod': 'authenticator'
        });

        await ActivityLog.create({
            userId: req.user._id,
            action: 'two_factor_enabled',
            ip: req.ip,
            userAgent: req.headers['user-agent']
        });

        res.json({
            success: true,
            message: 'Two-factor authentication enabled'
        });
    } catch (error) {
        console.error('Enable 2FA error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Verify two-factor authentication
exports.verifyTwoFactor = async (req, res) => {
    try {
        const { code } = req.body;
        
        // Verify 2FA code (implementation depends on 2FA method)
        // This is a placeholder - implement actual 2FA logic
        
        res.json({
            success: true,
            message: 'Two-factor verification successful'
        });
    } catch (error) {
        console.error('Verify 2FA error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Disable two-factor authentication
exports.disableTwoFactor = async (req, res) => {
    try {
        await User.findByIdAndUpdate(req.user._id, {
            'settings.twoFactorEnabled': false,
            'settings.twoFactorMethod': null
        });

        await ActivityLog.create({
            userId: req.user._id,
            action: 'two_factor_disabled',
            ip: req.ip,
            userAgent: req.headers['user-agent']
        });

        res.json({
            success: true,
            message: 'Two-factor authentication disabled'
        });
    } catch (error) {
        console.error('Disable 2FA error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Logout all devices
exports.logoutAllDevices = async (req, res) => {
    try {
        await Session.deleteMany({ userId: req.user._id });

        await ActivityLog.create({
            userId: req.user._id,
            action: 'logout_all_devices',
            ip: req.ip,
            userAgent: req.headers['user-agent']
        });

        res.json({
            success: true,
            message: 'Logged out from all devices'
        });
    } catch (error) {
        console.error('Logout all devices error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Get active sessions
exports.getActiveSessions = async (req, res) => {
    try {
        const sessions = await Session.find({ userId: req.user._id })
            .sort({ lastUsed: -1 });

        res.json({
            success: true,
            data: sessions
        });
    } catch (error) {
        console.error('Get active sessions error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Revoke session
exports.revokeSession = async (req, res) => {
    try {
        const { sessionId } = req.params;

        const session = await Session.findOneAndDelete({
            _id: sessionId,
            userId: req.user._id
        });

        if (!session) {
            return res.status(404).json({
                success: false,
                message: 'Session not found'
            });
        }

        await ActivityLog.create({
            userId: req.user._id,
            action: 'session_revoked',
            ip: req.ip,
            userAgent: req.headers['user-agent'],
            details: { sessionId }
        });

        res.json({
            success: true,
            message: 'Session revoked successfully'
        });
    } catch (error) {
        console.error('Revoke session error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};