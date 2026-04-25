/**
 * ESTIF HOME ULTIMATE - USER SERVICE
 * User management business logic
 * Version: 2.0.0
 */

const User = require('../../models/User');
const Device = require('../../models/Device');
const Home = require('../../models/Home');
const ActivityLog = require('../../models/ActivityLog');
const { hashPassword, verifyPassword } = require('../security/passwordService');
const { logger } = require('../../utils/logger');

class UserService {
    async createUser(data) {
        const existing = await User.findOne({ email: data.email });
        if (existing) throw new Error('Email already registered');
        
        const hashedPassword = await hashPassword(data.password);
        const user = await User.create({ ...data, password: hashedPassword });
        
        const { password, ...userWithoutPassword } = user.toObject();
        return userWithoutPassword;
    }

    async authenticateUser(email, password) {
        const user = await User.findOne({ email }).select('+password');
        if (!user) throw new Error('Invalid credentials');
        
        const isValid = await verifyPassword(password, user.password);
        if (!isValid) throw new Error('Invalid credentials');
        
        user.lastLogin = new Date();
        await user.save();
        
        const { password: _, ...userWithoutPassword } = user.toObject();
        return userWithoutPassword;
    }

    async getUserProfile(userId) {
        const user = await User.findById(userId).select('-password');
        if (!user) throw new Error('User not found');
        
        const devices = await Device.countDocuments({ ownerId: userId });
        const homes = await Home.countDocuments({ ownerId: userId });
        const memberHomes = await Home.countDocuments({ 'members.userId': userId });
        
        return { ...user.toObject(), stats: { devices, homes, memberHomes } };
    }

    async updateUser(userId, updates) {
        const user = await User.findByIdAndUpdate(userId, updates, { new: true }).select('-password');
        if (!user) throw new Error('User not found');
        
        await ActivityLog.create({ userId, action: 'profile_updated' });
        return user;
    }

    async changePassword(userId, oldPassword, newPassword) {
        const user = await User.findById(userId).select('+password');
        if (!user) throw new Error('User not found');
        
        const isValid = await verifyPassword(oldPassword, user.password);
        if (!isValid) throw new Error('Current password is incorrect');
        
        user.password = await hashPassword(newPassword);
        await user.save();
        
        await ActivityLog.create({ userId, action: 'password_changed' });
        return true;
    }

    async getAllUsers(adminId, filters = {}) {
        const admin = await User.findById(adminId);
        if (admin.role !== 'super_admin') throw new Error('Unauthorized');
        
        const query = {};
        if (filters.role) query.role = filters.role;
        if (filters.isActive !== undefined) query.isActive = filters.isActive;
        
        return await User.find(query).select('-password');
    }

    async toggleUserStatus(userId, adminId, isActive) {
        const admin = await User.findById(adminId);
        if (admin.role !== 'super_admin') throw new Error('Unauthorized');
        
        const user = await User.findByIdAndUpdate(userId, { isActive }, { new: true });
        if (!user) throw new Error('User not found');
        
        await ActivityLog.create({ userId: adminId, action: isActive ? 'user_activated' : 'user_suspended', details: { targetUser: userId } });
        return user;
    }

    async deleteUser(userId, adminId) {
        const admin = await User.findById(adminId);
        if (admin.role !== 'super_admin') throw new Error('Unauthorized');
        
        await Device.deleteMany({ ownerId: userId });
        await Home.deleteMany({ ownerId: userId });
        await User.findByIdAndDelete(userId);
        
        await ActivityLog.create({ userId: adminId, action: 'user_deleted', details: { targetUser: userId } });
        return true;
    }
}

module.exports = new UserService();