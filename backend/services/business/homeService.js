/**
 * ESTIF HOME ULTIMATE - HOME SERVICE
 * Home management business logic
 * Version: 2.0.0
 */

const Home = require('../../models/Home');
const Device = require('../../models/Device');
const Member = require('../../models/Member');
const ActivityLog = require('../../models/ActivityLog');
const { logger } = require('../../utils/logger');

class HomeService {
    async createHome(userId, data) {
        const home = await Home.create({
            ...data,
            ownerId: userId,
            members: [{ userId, role: 'owner', joinedAt: new Date() }]
        });
        
        await ActivityLog.create({ userId, action: 'home_created', entityType: 'home', entityId: home._id });
        return home;
    }

    async updateHome(homeId, userId, updates) {
        const home = await Home.findOne({ _id: homeId, ownerId: userId });
        if (!home) throw new Error('Home not found or unauthorized');
        
        Object.assign(home, updates, { updatedAt: new Date() });
        await home.save();
        
        await ActivityLog.create({ userId, action: 'home_updated', entityType: 'home', entityId: home._id });
        return home;
    }

    async deleteHome(homeId, userId) {
        const home = await Home.findOne({ _id: homeId, ownerId: userId });
        if (!home) throw new Error('Home not found or unauthorized');
        
        await Device.updateMany({ homeId }, { homeId: null });
        await home.deleteOne();
        
        await ActivityLog.create({ userId, action: 'home_deleted', entityType: 'home', entityId: homeId });
        return true;
    }

    async getHome(homeId, userId) {
        const home = await Home.findOne({ _id: homeId, $or: [{ ownerId: userId }, { 'members.userId': userId }] });
        if (!home) throw new Error('Home not found');
        
        const devices = await Device.find({ homeId });
        const members = await Member.find({ homeId }).populate('userId', 'name email avatar');
        
        return { ...home.toObject(), devices, members };
    }

    async getUserHomes(userId) {
        const owned = await Home.find({ ownerId: userId });
        const member = await Home.find({ 'members.userId': userId });
        return { owned, member };
    }

    async addMember(homeId, userId, inviterId, email, role = 'member') {
        const home = await Home.findOne({ _id: homeId, ownerId: inviterId });
        if (!home) throw new Error('Home not found or unauthorized');
        
        const existing = home.members.find(m => m.email === email);
        if (existing) throw new Error('Member already exists');
        
        home.members.push({ email, role, joinedAt: new Date(), invitedBy: inviterId });
        await home.save();
        
        return home.members[home.members.length - 1];
    }

    async removeMember(homeId, memberEmail, userId) {
        const home = await Home.findOne({ _id: homeId, ownerId: userId });
        if (!home) throw new Error('Home not found or unauthorized');
        
        home.members = home.members.filter(m => m.email !== memberEmail);
        await home.save();
        return true;
    }

    async updateMemberRole(homeId, memberEmail, role, userId) {
        const home = await Home.findOne({ _id: homeId, ownerId: userId });
        if (!home) throw new Error('Home not found or unauthorized');
        
        const member = home.members.find(m => m.email === memberEmail);
        if (!member) throw new Error('Member not found');
        
        member.role = role;
        await home.save();
        return member;
    }

    async addRoom(homeId, userId, roomData) {
        const home = await Home.findOne({ _id: homeId, ownerId: userId });
        if (!home) throw new Error('Home not found or unauthorized');
        
        home.rooms.push({ ...roomData, createdAt: new Date() });
        await home.save();
        return home.rooms[home.rooms.length - 1];
    }

    async updateRoom(homeId, roomId, userId, updates) {
        const home = await Home.findOne({ _id: homeId, ownerId: userId });
        if (!home) throw new Error('Home not found or unauthorized');
        
        const room = home.rooms.id(roomId);
        if (!room) throw new Error('Room not found');
        
        Object.assign(room, updates);
        await home.save();
        return room;
    }

    async deleteRoom(homeId, roomId, userId) {
        const home = await Home.findOne({ _id: homeId, ownerId: userId });
        if (!home) throw new Error('Home not found or unauthorized');
        
        home.rooms = home.rooms.filter(r => r._id.toString() !== roomId);
        await home.save();
        return true;
    }

    async getHomeStats(homeId, userId) {
        const home = await Home.findOne({ _id: homeId, $or: [{ ownerId: userId }, { 'members.userId': userId }] });
        if (!home) throw new Error('Home not found');
        
        const devices = await Device.find({ homeId });
        const activeDevices = devices.filter(d => d.state).length;
        const totalPower = devices.reduce((sum, d) => sum + (d.state ? d.power : 0), 0);
        
        return {
            totalDevices: devices.length,
            activeDevices,
            totalPower,
            totalRooms: home.rooms.length,
            totalMembers: home.members.length,
            autoModeDevices: devices.filter(d => d.autoMode).length
        };
    }
}

module.exports = new HomeService();