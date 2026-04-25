/**
 * ESTIF HOME ULTIMATE - PERMISSION SERVICE
 * Role-based access control business logic
 * Version: 2.0.0
 */

const User = require('../../models/User');
const Home = require('../../models/Home');

class PermissionService {
    constructor() {
        this.roleHierarchy = {
            super_admin: 100,
            admin: 80,
            home_owner: 60,
            home_admin: 50,
            member: 30,
            guest: 10
        };
        
        this.permissions = {
            view_devices: ['super_admin', 'admin', 'home_owner', 'home_admin', 'member', 'guest'],
            control_devices: ['super_admin', 'admin', 'home_owner', 'home_admin', 'member'],
            manage_devices: ['super_admin', 'admin', 'home_owner', 'home_admin'],
            delete_devices: ['super_admin', 'admin', 'home_owner'],
            manage_members: ['super_admin', 'admin', 'home_owner'],
            manage_home: ['super_admin', 'admin', 'home_owner'],
            view_analytics: ['super_admin', 'admin', 'home_owner', 'home_admin', 'member'],
            manage_automation: ['super_admin', 'admin', 'home_owner', 'home_admin'],
            view_settings: ['super_admin', 'admin', 'home_owner', 'home_admin'],
            manage_settings: ['super_admin', 'admin', 'home_owner']
        };
    }

    async hasPermission(userId, permission, context = {}) {
        const user = await User.findById(userId);
        if (!user) return false;
        
        if (user.role === 'super_admin') return true;
        
        const allowedRoles = this.permissions[permission];
        if (!allowedRoles) return false;
        
        if (allowedRoles.includes(user.role)) {
            if (context.homeId && !['super_admin', 'admin'].includes(user.role)) {
                return await this.isHomeMember(userId, context.homeId);
            }
            return true;
        }
        
        return false;
    }

    async isHomeMember(userId, homeId) {
        const home = await Home.findOne({ _id: homeId, $or: [{ ownerId: userId }, { 'members.userId': userId }] });
        return !!home;
    }

    async getUserRoleInHome(userId, homeId) {
        const home = await Home.findOne({ _id: homeId });
        if (!home) return null;
        
        if (home.ownerId.toString() === userId) return 'owner';
        
        const member = home.members.find(m => m.userId.toString() === userId);
        return member ? member.role : null;
    }

    async canManageHome(userId, homeId) {
        const role = await this.getUserRoleInHome(userId, homeId);
        return ['owner', 'admin'].includes(role);
    }

    async canManageMembers(userId, homeId) {
        const role = await this.getUserRoleInHome(userId, homeId);
        return ['owner'].includes(role);
    }

    async canControlDevice(userId, deviceId) {
        const Device = require('../../models/Device');
        const device = await Device.findById(deviceId);
        if (!device) return false;
        
        if (device.ownerId.toString() === userId) return true;
        
        return await this.isHomeMember(userId, device.homeId);
    }

    getUserRoleLevel(role) {
        return this.roleHierarchy[role] || 0;
    }

    hasHigherRole(role1, role2) {
        return this.getUserRoleLevel(role1) > this.getUserRoleLevel(role2);
    }
}

module.exports = new PermissionService();