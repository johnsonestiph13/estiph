/**
 * ESTIF HOME ULTIMATE - USER CONTROLLER
 * User management logic
 * Version: 2.0.0
 * Author: Estifanos Yohannis
 */

const User = require('../models/User');
const Device = require('../models/Device');
const Home = require('../models/Home');
const ActivityLog = require('../models/ActivityLog');
const Notification = require('../models/Notification');
const { sendEmail } = require('../services/communication/emailService');

// Get user profile
exports.getProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user._id)
            .select('-password -verificationToken -resetPasswordToken');

        const stats = {
            totalDevices: await Device.countDocuments({ ownerId: user._id }),
            totalHomes: await Home.countDocuments({ ownerId: user._id }),
            memberOfHomes: await Home.countDocuments({ 'members.userId': user._id }),
            unreadNotifications: await Notification.countDocuments({ userId: user._id, read: false })
        };

        res.json({
            success: true,
            data: { ...user.toObject(), stats }
        });
    } catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Update profile
exports.updateProfile = async (req, res) => {
    try {
        const { name, nameAm, avatar, phone, settings } = req.body;

        const user = await User.findByIdAndUpdate(
            req.user._id,
            {
                name,
                nameAm,
                avatar,
                phone,
                settings,
                updatedAt: Date.now()
            },
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

// Delete account
exports.deleteAccount = async (req, res) => {
    try {
        const { password } = req.body;

        const user = await User.findById(req.user._id).select('+password');
        
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({
                success: false,
                message: 'Password is incorrect'
            });
        }

        // Delete user data
        await Device.deleteMany({ ownerId: user._id });
        await Home.deleteMany({ ownerId: user._id });
        await ActivityLog.deleteMany({ userId: user._id });
        await Notification.deleteMany({ userId: user._id });
        await user.deleteOne();

        res.json({
            success: true,
            message: 'Account deleted successfully'
        });
    } catch (error) {
        console.error('Delete account error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Get user devices
exports.getUserDevices = async (req, res) => {
    try {
        const devices = await Device.find({ ownerId: req.user._id });

        res.json({
            success: true,
            data: devices
        });
    } catch (error) {
        console.error('Get user devices error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Get user homes
exports.getUserHomes = async (req, res) => {
    try {
        const ownedHomes = await Home.find({ ownerId: req.user._id });
        const memberHomes = await Home.find({ 'members.userId': req.user._id });

        res.json({
            success: true,
            data: {
                owned: ownedHomes,
                member: memberHomes
            }
        });
    } catch (error) {
        console.error('Get user homes error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Get user activity
exports.getUserActivity = async (req, res) => {
    try {
        const { limit = 50, offset = 0 } = req.query;

        const activities = await ActivityLog.find({ userId: req.user._id })
            .sort({ createdAt: -1 })
            .skip(parseInt(offset))
            .limit(parseInt(limit));

        const total = await ActivityLog.countDocuments({ userId: req.user._id });

        res.json({
            success: true,
            data: activities,
            pagination: {
                total,
                limit: parseInt(limit),
                offset: parseInt(offset),
                hasMore: offset + limit < total
            }
        });
    } catch (error) {
        console.error('Get user activity error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Get user notifications
exports.getUserNotifications = async (req, res) => {
    try {
        const { limit = 50, offset = 0, unreadOnly = false } = req.query;

        const filter = { userId: req.user._id };
        if (unreadOnly === 'true') {
            filter.read = false;
        }

        const notifications = await Notification.find(filter)
            .sort({ createdAt: -1 })
            .skip(parseInt(offset))
            .limit(parseInt(limit));

        const total = await Notification.countDocuments(filter);
        const unreadCount = await Notification.countDocuments({ userId: req.user._id, read: false });

        res.json({
            success: true,
            data: notifications,
            unreadCount,
            pagination: {
                total,
                limit: parseInt(limit),
                offset: parseInt(offset),
                hasMore: offset + limit < total
            }
        });
    } catch (error) {
        console.error('Get user notifications error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Mark notification as read
exports.markNotificationRead = async (req, res) => {
    try {
        const { id } = req.params;

        const notification = await Notification.findOneAndUpdate(
            { _id: id, userId: req.user._id },
            { read: true, readAt: Date.now() },
            { new: true }
        );

        if (!notification) {
            return res.status(404).json({
                success: false,
                message: 'Notification not found'
            });
        }

        res.json({
            success: true,
            data: notification
        });
    } catch (error) {
        console.error('Mark notification read error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Mark all notifications as read
exports.markAllNotificationsRead = async (req, res) => {
    try {
        await Notification.updateMany(
            { userId: req.user._id, read: false },
            { read: true, readAt: Date.now() }
        );

        res.json({
            success: true,
            message: 'All notifications marked as read'
        });
    } catch (error) {
        console.error('Mark all notifications read error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// ============================================
// ADMIN ONLY CONTROLLERS
// ============================================

// Get all users (admin)
exports.getAllUsers = async (req, res) => {
    try {
        const { limit = 50, offset = 0, search, role } = req.query;

        const filter = {};
        if (search) {
            filter.$or = [
                { name: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } }
            ];
        }
        if (role) {
            filter.role = role;
        }

        const users = await User.find(filter)
            .select('-password')
            .skip(parseInt(offset))
            .limit(parseInt(limit))
            .sort({ createdAt: -1 });

        const total = await User.countDocuments(filter);

        res.json({
            success: true,
            data: users,
            pagination: {
                total,
                limit: parseInt(limit),
                offset: parseInt(offset),
                hasMore: offset + limit < total
            }
        });
    } catch (error) {
        console.error('Get all users error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Get user by ID (admin)
exports.getUserById = async (req, res) => {
    try {
        const { id } = req.params;

        const user = await User.findById(id).select('-password');
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        const stats = {
            totalDevices: await Device.countDocuments({ ownerId: user._id }),
            totalHomes: await Home.countDocuments({ ownerId: user._id }),
            memberOfHomes: await Home.countDocuments({ 'members.userId': user._id }),
            totalActivity: await ActivityLog.countDocuments({ userId: user._id })
        };

        res.json({
            success: true,
            data: { ...user.toObject(), stats }
        });
    } catch (error) {
        console.error('Get user by ID error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Update user (admin)
exports.updateUser = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, email, role, settings, isActive } = req.body;

        const user = await User.findByIdAndUpdate(
            id,
            { name, email, role, settings, isActive, updatedAt: Date.now() },
            { new: true, runValidators: true }
        ).select('-password');

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        await ActivityLog.create({
            userId: req.user._id,
            action: 'admin_user_updated',
            ip: req.ip,
            userAgent: req.headers['user-agent'],
            details: { targetUser: user._id, updates: Object.keys(req.body) }
        });

        res.json({
            success: true,
            data: user
        });
    } catch (error) {
        console.error('Update user error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Delete user (admin)
exports.deleteUser = async (req, res) => {
    try {
        const { id } = req.params;

        const user = await User.findByIdAndDelete(id);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Delete user data
        await Device.deleteMany({ ownerId: user._id });
        await Home.deleteMany({ ownerId: user._id });
        await ActivityLog.deleteMany({ userId: user._id });
        await Notification.deleteMany({ userId: user._id });

        await ActivityLog.create({
            userId: req.user._id,
            action: 'admin_user_deleted',
            ip: req.ip,
            userAgent: req.headers['user-agent'],
            details: { targetUser: user._id, userEmail: user.email }
        });

        res.json({
            success: true,
            message: 'User deleted successfully'
        });
    } catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Impersonate user (admin)
exports.impersonateUser = async (req, res) => {
    try {
        const { id } = req.params;

        const user = await User.findById(id);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Generate impersonation token
        const token = jwt.sign(
            { id: user._id, impersonatedBy: req.user._id },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );

        await ActivityLog.create({
            userId: req.user._id,
            action: 'admin_impersonated_user',
            ip: req.ip,
            userAgent: req.headers['user-agent'],
            details: { targetUser: user._id, targetEmail: user.email }
        });

        res.json({
            success: true,
            data: {
                token,
                user: {
                    id: user._id,
                    name: user.name,
                    email: user.email
                },
                message: 'You are now impersonating this user'
            }
        });
    } catch (error) {
        console.error('Impersonate user error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Suspend user (admin)
exports.suspendUser = async (req, res) => {
    try {
        const { id } = req.params;

        const user = await User.findByIdAndUpdate(
            id,
            { isActive: false, suspendedAt: Date.now() },
            { new: true }
        );

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Send notification email
        await sendEmail({
            to: user.email,
            subject: 'Account Suspended',
            template: 'account-suspended',
            data: { name: user.name }
        });

        await ActivityLog.create({
            userId: req.user._id,
            action: 'admin_user_suspended',
            ip: req.ip,
            userAgent: req.headers['user-agent'],
            details: { targetUser: user._id, targetEmail: user.email }
        });

        res.json({
            success: true,
            message: 'User suspended successfully'
        });
    } catch (error) {
        console.error('Suspend user error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Unsuspend user (admin)
exports.unsuspendUser = async (req, res) => {
    try {
        const { id } = req.params;

        const user = await User.findByIdAndUpdate(
            id,
            { isActive: true, suspendedAt: null },
            { new: true }
        );

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Send notification email
        await sendEmail({
            to: user.email,
            subject: 'Account Reactivated',
            template: 'account-reactivated',
            data: { name: user.name }
        });

        await ActivityLog.create({
            userId: req.user._id,
            action: 'admin_user_unsuspended',
            ip: req.ip,
            userAgent: req.headers['user-agent'],
            details: { targetUser: user._id, targetEmail: user.email }
        });

        res.json({
            success: true,
            message: 'User unsuspended successfully'
        });
    } catch (error) {
        console.error('Unsuspend user error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};