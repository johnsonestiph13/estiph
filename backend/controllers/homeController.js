/**
 * ESTIF HOME ULTIMATE - HOME CONTROLLER
 * Home management logic
 * Version: 2.0.0
 * Author: Estifanos Yohannis
 */

const Home = require('../models/Home');
const User = require('../models/User');
const Device = require('../models/Device');
const ActivityLog = require('../models/ActivityLog');
const { sendEmail } = require('../services/communication/emailService');

// Get user's homes
exports.getUserHomes = async (req, res) => {
    try {
        const ownedHomes = await Home.find({ ownerId: req.user._id });
        const memberHomes = await Home.find({ 'members.userId': req.user._id });

        // Get stats for each home
        const enrichHome = async (home) => {
            const devices = await Device.find({ homeId: home._id });
            return {
                ...home.toObject(),
                stats: {
                    totalDevices: devices.length,
                    activeDevices: devices.filter(d => d.state).length,
                    autoModeDevices: devices.filter(d => d.autoMode).length,
                    totalPower: devices.reduce((sum, d) => sum + (d.state ? d.power : 0), 0)
                }
            };
        };

        const enrichedOwned = await Promise.all(ownedHomes.map(enrichHome));
        const enrichedMember = await Promise.all(memberHomes.map(enrichHome));

        res.json({
            success: true,
            data: {
                owned: enrichedOwned,
                member: enrichedMember
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

// Create home
exports.createHome = async (req, res) => {
    try {
        const { name, nameAm, address, city, country, zipCode, settings } = req.body;

        const home = await Home.create({
            name,
            nameAm,
            address,
            city,
            country,
            zipCode,
            settings,
            ownerId: req.user._id,
            members: [{ userId: req.user._id, role: 'owner' }]
        });

        await ActivityLog.create({
            userId: req.user._id,
            action: 'home_created',
            entityType: 'home',
            entityId: home._id,
            ip: req.ip,
            userAgent: req.headers['user-agent'],
            details: { homeName: home.name }
        });

        res.status(201).json({
            success: true,
            data: home
        });
    } catch (error) {
        console.error('Create home error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Get home by ID
exports.getHome = async (req, res) => {
    try {
        const { id } = req.params;

        const home = await Home.findById(id);
        if (!home) {
            return res.status(404).json({
                success: false,
                message: 'Home not found'
            });
        }

        // Check access
        const isOwner = home.ownerId.toString() === req.user._id.toString();
        const isMember = home.members.some(m => m.userId.toString() === req.user._id.toString());

        if (!isOwner && !isMember) {
            return res.status(403).json({
                success: false,
                message: 'Access denied'
            });
        }

        // Get devices
        const devices = await Device.find({ homeId: home._id });

        // Get member details
        const memberDetails = await Promise.all(
            home.members.map(async (member) => {
                const user = await User.findById(member.userId).select('name email avatar');
                return {
                    ...member.toObject(),
                    user: user ? { name: user.name, email: user.email, avatar: user.avatar } : null
                };
            })
        );

        res.json({
            success: true,
            data: {
                ...home.toObject(),
                members: memberDetails,
                devices,
                stats: {
                    totalDevices: devices.length,
                    activeDevices: devices.filter(d => d.state).length,
                    autoModeDevices: devices.filter(d => d.autoMode).length,
                    totalMembers: home.members.length
                }
            }
        });
    } catch (error) {
        console.error('Get home error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Update home
exports.updateHome = async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        const home = await Home.findOneAndUpdate(
            { _id: id, ownerId: req.user._id },
            { ...updates, updatedAt: Date.now() },
            { new: true, runValidators: true }
        );

        if (!home) {
            return res.status(404).json({
                success: false,
                message: 'Home not found or you are not the owner'
            });
        }

        await ActivityLog.create({
            userId: req.user._id,
            action: 'home_updated',
            entityType: 'home',
            entityId: home._id,
            ip: req.ip,
            userAgent: req.headers['user-agent'],
            details: { homeName: home.name, updates: Object.keys(updates) }
        });

        res.json({
            success: true,
            data: home
        });
    } catch (error) {
        console.error('Update home error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Delete home
exports.deleteHome = async (req, res) => {
    try {
        const { id } = req.params;

        const home = await Home.findOneAndDelete({ _id: id, ownerId: req.user._id });
        if (!home) {
            return res.status(404).json({
                success: false,
                message: 'Home not found or you are not the owner'
            });
        }

        // Unassign devices from this home
        await Device.updateMany({ homeId: home._id }, { homeId: null });

        await ActivityLog.create({
            userId: req.user._id,
            action: 'home_deleted',
            entityType: 'home',
            entityId: home._id,
            ip: req.ip,
            userAgent: req.headers['user-agent'],
            details: { homeName: home.name }
        });

        res.json({
            success: true,
            message: 'Home deleted successfully'
        });
    } catch (error) {
        console.error('Delete home error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Get home members
exports.getHomeMembers = async (req, res) => {
    try {
        const { id } = req.params;

        const home = await Home.findById(id);
        if (!home) {
            return res.status(404).json({
                success: false,
                message: 'Home not found'
            });
        }

        // Check access
        const isOwner = home.ownerId.toString() === req.user._id.toString();
        const isMember = home.members.some(m => m.userId.toString() === req.user._id.toString());

        if (!isOwner && !isMember) {
            return res.status(403).json({
                success: false,
                message: 'Access denied'
            });
        }

        // Get member details
        const members = await Promise.all(
            home.members.map(async (member) => {
                const user = await User.findById(member.userId).select('name email avatar phone');
                return {
                    ...member.toObject(),
                    user: user || null
                };
            })
        );

        res.json({
            success: true,
            data: members
        });
    } catch (error) {
        console.error('Get home members error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Add member to home
exports.addMember = async (req, res) => {
    try {
        const { id } = req.params;
        const { email, role = 'member' } = req.body;

        const home = await Home.findById(id);
        if (!home) {
            return res.status(404).json({
                success: false,
                message: 'Home not found'
            });
        }

        // Check permission (owner or admin can add members)
        const userMembership = home.members.find(m => m.userId.toString() === req.user._id.toString());
        if (!userMembership || (userMembership.role !== 'owner' && userMembership.role !== 'admin')) {
            return res.status(403).json({
                success: false,
                message: 'You do not have permission to add members'
            });
        }

        // Find user to add
        const userToAdd = await User.findOne({ email });
        if (!userToAdd) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Check if already a member
        if (home.members.some(m => m.userId.toString() === userToAdd._id.toString())) {
            return res.status(400).json({
                success: false,
                message: 'User is already a member of this home'
            });
        }

        // Add member
        home.members.push({
            userId: userToAdd._id,
            role,
            joinedAt: Date.now()
        });
        await home.save();

        await ActivityLog.create({
            userId: req.user._id,
            action: 'member_added',
            entityType: 'home',
            entityId: home._id,
            ip: req.ip,
            userAgent: req.headers['user-agent'],
            details: { homeName: home.name, addedUser: userToAdd.email, role }
        });

        // Send notification email
        await sendEmail({
            to: userToAdd.email,
            subject: `You've been added to ${home.name}`,
            template: 'home-invite',
            data: {
                homeName: home.name,
                inviterName: req.user.name,
                role
            }
        });

        res.json({
            success: true,
            data: {
                userId: userToAdd._id,
                name: userToAdd.name,
                email: userToAdd.email,
                role
            }
        });
    } catch (error) {
        console.error('Add member error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Update member role
exports.updateMemberRole = async (req, res) => {
    try {
        const { id, memberId } = req.params;
        const { role } = req.body;

        const home = await Home.findById(id);
        if (!home) {
            return res.status(404).json({
                success: false,
                message: 'Home not found'
            });
        }

        // Only owner can change roles
        if (home.ownerId.toString() !== req.user._id.toString()) {
            return res.status(403).json({
                success: false,
                message: 'Only the home owner can change member roles'
            });
        }

        const member = home.members.find(m => m.userId.toString() === memberId);
        if (!member) {
            return res.status(404).json({
                success: false,
                message: 'Member not found'
            });
        }

        member.role = role;
        await home.save();

        await ActivityLog.create({
            userId: req.user._id,
            action: 'member_role_updated',
            entityType: 'home',
            entityId: home._id,
            ip: req.ip,
            userAgent: req.headers['user-agent'],
            details: { homeName: home.name, targetUser: memberId, newRole: role }
        });

        res.json({
            success: true,
            message: 'Member role updated successfully'
        });
    } catch (error) {
        console.error('Update member role error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Remove member from home
exports.removeMember = async (req, res) => {
    try {
        const { id, memberId } = req.params;

        const home = await Home.findById(id);
        if (!home) {
            return res.status(404).json({
                success: false,
                message: 'Home not found'
            });
        }

        // Check permission
        const isOwner = home.ownerId.toString() === req.user._id.toString();
        const isSelf = memberId === req.user._id.toString();

        if (!isOwner && !isSelf) {
            return res.status(403).json({
                success: false,
                message: 'You do not have permission to remove this member'
            });
        }

        // Cannot remove owner
        const memberToRemove = home.members.find(m => m.userId.toString() === memberId);
        if (memberToRemove?.role === 'owner') {
            return res.status(400).json({
                success: false,
                message: 'Cannot remove the home owner'
            });
        }

        home.members = home.members.filter(m => m.userId.toString() !== memberId);
        await home.save();

        await ActivityLog.create({
            userId: req.user._id,
            action: 'member_removed',
            entityType: 'home',
            entityId: home._id,
            ip: req.ip,
            userAgent: req.headers['user-agent'],
            details: { homeName: home.name, removedUser: memberId }
        });

        res.json({
            success: true,
            message: 'Member removed successfully'
        });
    } catch (error) {
        console.error('Remove member error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Get home rooms
exports.getHomeRooms = async (req, res) => {
    try {
        const { id } = req.params;

        const home = await Home.findById(id);
        if (!home) {
            return res.status(404).json({
                success: false,
                message: 'Home not found'
            });
        }

        // Get devices grouped by room
        const devices = await Device.find({ homeId: home._id });
        const roomsWithDevices = home.rooms.map(room => ({
            ...room.toObject(),
            devices: devices.filter(d => d.room === room.name)
        }));

        res.json({
            success: true,
            data: roomsWithDevices
        });
    } catch (error) {
        console.error('Get home rooms error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Add room to home
exports.addRoom = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, nameAm, icon, type } = req.body;

        const home = await Home.findById(id);
        if (!home) {
            return res.status(404).json({
                success: false,
                message: 'Home not found'
            });
        }

        // Check permission
        const userMembership = home.members.find(m => m.userId.toString() === req.user._id.toString());
        if (!userMembership || (userMembership.role !== 'owner' && userMembership.role !== 'admin')) {
            return res.status(403).json({
                success: false,
                message: 'You do not have permission to add rooms'
            });
        }

        home.rooms.push({
            name,
            nameAm,
            icon: icon || '🚪',
            type: type || 'custom',
            createdAt: Date.now()
        });
        await home.save();

        await ActivityLog.create({
            userId: req.user._id,
            action: 'room_added',
            entityType: 'home',
            entityId: home._id,
            ip: req.ip,
            userAgent: req.headers['user-agent'],
            details: { homeName: home.name, roomName: name }
        });

        res.status(201).json({
            success: true,
            data: home.rooms[home.rooms.length - 1]
        });
    } catch (error) {
        console.error('Add room error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Update room
exports.updateRoom = async (req, res) => {
    try {
        const { id, roomId } = req.params;
        const updates = req.body;

        const home = await Home.findById(id);
        if (!home) {
            return res.status(404).json({
                success: false,
                message: 'Home not found'
            });
        }

        const roomIndex = home.rooms.findIndex(r => r._id.toString() === roomId);
        if (roomIndex === -1) {
            return res.status(404).json({
                success: false,
                message: 'Room not found'
            });
        }

        Object.assign(home.rooms[roomIndex], updates);
        await home.save();

        res.json({
            success: true,
            data: home.rooms[roomIndex]
        });
    } catch (error) {
        console.error('Update room error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Delete room
exports.deleteRoom = async (req, res) => {
    try {
        const { id, roomId } = req.params;

        const home = await Home.findById(id);
        if (!home) {
            return res.status(404).json({
                success: false,
                message: 'Home not found'
            });
        }

        home.rooms = home.rooms.filter(r => r._id.toString() !== roomId);
        await home.save();

        res.json({
            success: true,
            message: 'Room deleted successfully'
        });
    } catch (error) {
        console.error('Delete room error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Get home settings
exports.getHomeSettings = async (req, res) => {
    try {
        const { id } = req.params;

        const home = await Home.findById(id).select('settings name nameAm address');
        if (!home) {
            return res.status(404).json({
                success: false,
                message: 'Home not found'
            });
        }

        res.json({
            success: true,
            data: home
        });
    } catch (error) {
        console.error('Get home settings error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Update home settings
exports.updateHomeSettings = async (req, res) => {
    try {
        const { id } = req.params;
        const { settings } = req.body;

        const home = await Home.findOneAndUpdate(
            { _id: id },
            { settings, updatedAt: Date.now() },
            { new: true }
        ).select('settings');

        if (!home) {
            return res.status(404).json({
                success: false,
                message: 'Home not found'
            });
        }

        res.json({
            success: true,
            data: home.settings
        });
    } catch (error) {
        console.error('Update home settings error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Get home statistics
exports.getHomeStats = async (req, res) => {
    try {
        const { id } = req.params;

        const home = await Home.findById(id);
        if (!home) {
            return res.status(404).json({
                success: false,
                message: 'Home not found'
            });
        }

        const devices = await Device.find({ homeId: home._id });
        const activities = await ActivityLog.find({ homeId: home._id })
            .sort({ createdAt: -1 })
            .limit(50);

        const stats = {
            totalDevices: devices.length,
            activeDevices: devices.filter(d => d.state).length,
            autoModeDevices: devices.filter(d => d.autoMode).length,
            devicesByType: {},
            totalPower: devices.reduce((sum, d) => sum + (d.state ? d.power : 0), 0),
            energyConsumption: devices.reduce((sum, d) => sum + (d.state ? d.power : 0), 0) / 1000,
            recentActivity: activities
        };

        // Group devices by type
        devices.forEach(device => {
            stats.devicesByType[device.type] = (stats.devicesByType[device.type] || 0) + 1;
        });

        res.json({
            success: true,
            data: stats
        });
    } catch (error) {
        console.error('Get home stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Get home activity
exports.getHomeActivity = async (req, res) => {
    try {
        const { id } = req.params;
        const { limit = 50, offset = 0 } = req.query;

        const activities = await ActivityLog.find({ homeId: id })
            .sort({ createdAt: -1 })
            .skip(parseInt(offset))
            .limit(parseInt(limit))
            .populate('userId', 'name email avatar');

        const total = await ActivityLog.countDocuments({ homeId: id });

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
        console.error('Get home activity error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Transfer home ownership
exports.transferOwnership = async (req, res) => {
    try {
        const { id } = req.params;
        const { newOwnerId } = req.body;

        const home = await Home.findById(id);
        if (!home) {
            return res.status(404).json({
                success: false,
                message: 'Home not found'
            });
        }

        // Only current owner can transfer
        if (home.ownerId.toString() !== req.user._id.toString()) {
            return res.status(403).json({
                success: false,
                message: 'Only the home owner can transfer ownership'
            });
        }

        const newOwner = await User.findById(newOwnerId);
        if (!newOwner) {
            return res.status(404).json({
                success: false,
                message: 'New owner not found'
            });
        }

        // Transfer ownership
        home.ownerId = newOwnerId;
        
        // Update member roles
        const currentOwnerMember = home.members.find(m => m.userId.toString() === req.user._id.toString());
        if (currentOwnerMember) {
            currentOwnerMember.role = 'admin';
        }

        const newOwnerMember = home.members.find(m => m.userId.toString() === newOwnerId);
        if (newOwnerMember) {
            newOwnerMember.role = 'owner';
        } else {
            home.members.push({
                userId: newOwnerId,
                role: 'owner',
                joinedAt: Date.now()
            });
        }

        await home.save();

        await ActivityLog.create({
            userId: req.user._id,
            action: 'home_transferred',
            entityType: 'home',
            entityId: home._id,
            ip: req.ip,
            userAgent: req.headers['user-agent'],
            details: { homeName: home.name, newOwner: newOwner.email }
        });

        res.json({
            success: true,
            message: 'Home ownership transferred successfully'
        });
    } catch (error) {
        console.error('Transfer ownership error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};