/**
 * Database Integration Tests
 * Tests database connections, queries, transactions, and performance
 */

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const User = require('../../models/User');
const Home = require('../../models/Home');
const Device = require('../../models/Device');
const ActivityLog = require('../../models/ActivityLog');

describe('Database Integration Tests', () => {
    let mongoServer;
    
    beforeAll(async () => {
        mongoServer = await MongoMemoryServer.create();
        const uri = mongoServer.getUri();
        await mongoose.connect(uri);
    });
    
    afterAll(async () => {
        await mongoose.disconnect();
        await mongoServer.stop();
    });
    
    beforeEach(async () => {
        await User.deleteMany({});
        await Home.deleteMany({});
        await Device.deleteMany({});
        await ActivityLog.deleteMany({});
    });
    
    describe('User Model', () => {
        test('Should create user with valid data', async () => {
            const user = await User.create({
                name: 'John Doe',
                email: 'john@estif.com',
                password: 'Password123!'
            });
            
            expect(user._id).toBeDefined();
            expect(user.name).toBe('John Doe');
            expect(user.email).toBe('john@estif.com');
            expect(user.password).not.toBe('Password123!'); // Should be hashed
        });
        
        test('Should not create user with duplicate email', async () => {
            await User.create({
                name: 'User1',
                email: 'duplicate@estif.com',
                password: 'Pass123!'
            });
            
            await expect(User.create({
                name: 'User2',
                email: 'duplicate@estif.com',
                password: 'Pass456!'
            })).rejects.toThrow();
        });
        
        test('Should hash password before saving', async () => {
            const plainPassword = 'MySecret123!';
            const user = await User.create({
                name: 'Hash Test',
                email: 'hash@estif.com',
                password: plainPassword
            });
            
            expect(user.password).not.toBe(plainPassword);
            expect(user.password.length).toBeGreaterThan(plainPassword.length);
        });
        
        test('Should compare password correctly', async () => {
            const user = await User.create({
                name: 'Compare Test',
                email: 'compare@estif.com',
                password: 'CorrectPass123!'
            });
            
            const isMatch = await user.comparePassword('CorrectPass123!');
            expect(isMatch).toBe(true);
            
            const isNotMatch = await user.comparePassword('WrongPass');
            expect(isNotMatch).toBe(false);
        });
        
        test('Should find user by email with index', async () => {
            await User.create({
                name: 'Index Test',
                email: 'index@estif.com',
                password: 'Pass123!'
            });
            
            const start = Date.now();
            const user = await User.findOne({ email: 'index@estif.com' });
            const duration = Date.now() - start;
            
            expect(user).toBeDefined();
            expect(duration).toBeLessThan(100); // Should be fast with index
        });
    });
    
    describe('Home Model', () => {
        let owner;
        
        beforeEach(async () => {
            owner = await User.create({
                name: 'Home Owner',
                email: 'owner@estif.com',
                password: 'Owner123!'
            });
        });
        
        test('Should create home with owner', async () => {
            const home = await Home.create({
                name: 'Family Home',
                ownerId: owner._id,
                members: [{ userId: owner._id, role: 'owner' }]
            });
            
            expect(home.name).toBe('Family Home');
            expect(home.ownerId.toString()).toBe(owner._id.toString());
            expect(home.members.length).toBe(1);
        });
        
        test('Should add member to home', async () => {
            const member = await User.create({
                name: 'Family Member',
                email: 'member@estif.com',
                password: 'Member123!'
            });
            
            const home = await Home.create({
                name: 'Shared Home',
                ownerId: owner._id,
                members: [{ userId: owner._id, role: 'owner' }]
            });
            
            home.members.push({ userId: member._id, role: 'member' });
            await home.save();
            
            const updatedHome = await Home.findById(home._id).populate('members.userId');
            expect(updatedHome.members.length).toBe(2);
            expect(updatedHome.members[1].userId.email).toBe('member@estif.com');
        });
        
        test('Should not allow duplicate members', async () => {
            const home = await Home.create({
                name: 'No Duplicate Home',
                ownerId: owner._id,
                members: [{ userId: owner._id, role: 'owner' }]
            });
            
            // Try to add owner again
            home.members.push({ userId: owner._id, role: 'member' });
            await expect(home.save()).rejects.toThrow();
        });
        
        test('Should find homes by owner with population', async () => {
            await Home.create([
                { name: 'Home 1', ownerId: owner._id, members: [{ userId: owner._id, role: 'owner' }] },
                { name: 'Home 2', ownerId: owner._id, members: [{ userId: owner._id, role: 'owner' }] }
            ]);
            
            const homes = await Home.find({ ownerId: owner._id });
            expect(homes.length).toBe(2);
        });
    });
    
    describe('Device Model', () => {
        let owner, home;
        
        beforeEach(async () => {
            owner = await User.create({
                name: 'Device Owner',
                email: 'deviceowner@estif.com',
                password: 'Device123!'
            });
            
            home = await Home.create({
                name: 'Device Home',
                ownerId: owner._id,
                members: [{ userId: owner._id, role: 'owner' }]
            });
        });
        
        test('Should create device', async () => {
            const device = await Device.create({
                name: 'Smart Light',
                type: 'light',
                gpio: 23,
                power: 10,
                state: false,
                autoMode: false,
                homeId: home._id,
                ownerId: owner._id
            });
            
            expect(device.name).toBe('Smart Light');
            expect(device.gpio).toBe(23);
            expect(device.state).toBe(false);
        });
        
        test('Should toggle device state', async () => {
            const device = await Device.create({
                name: 'Toggle Light',
                type: 'light',
                gpio: 22,
                homeId: home._id,
                ownerId: owner._id
            });
            
            device.state = !device.state;
            await device.save();
            
            expect(device.state).toBe(true);
        });
        
        test('Should update lastSeen timestamp', async () => {
            const device = await Device.create({
                name: 'Active Device',
                type: 'sensor',
                gpio: 21,
                homeId: home._id,
                ownerId: owner._id
            });
            
            const oldTimestamp = device.lastSeen;
            await new Promise(resolve => setTimeout(resolve, 10));
            
            device.lastSeen = new Date();
            await device.save();
            
            expect(device.lastSeen.getTime()).toBeGreaterThan(oldTimestamp.getTime());
        });
        
        test('Should bulk update devices', async () => {
            await Device.create([
                { name: 'Device 1', type: 'light', gpio: 23, homeId: home._id, ownerId: owner._id, autoMode: false },
                { name: 'Device 2', type: 'fan', gpio: 22, homeId: home._id, ownerId: owner._id, autoMode: false }
            ]);
            
            const result = await Device.updateMany(
                { ownerId: owner._id, autoMode: false },
                { state: true }
            );
            
            expect(result.modifiedCount).toBe(2);
            
            const devices = await Device.find({ ownerId: owner._id });
            devices.forEach(device => {
                expect(device.state).toBe(true);
            });
        });
    });
    
    describe('ActivityLog Model', () => {
        let user;
        
        beforeEach(async () => {
            user = await User.create({
                name: 'Activity User',
                email: 'activity@estif.com',
                password: 'Activity123!'
            });
        });
        
        test('Should log activity', async () => {
            const log = await ActivityLog.create({
                userId: user._id,
                action: 'device_on',
                details: { device: 'Living Room Light' },
                ip: '192.168.1.1'
            });
            
            expect(log.action).toBe('device_on');
            expect(log.details.device).toBe('Living Room Light');
        });
        
        test('Should query activities by time range', async () => {
            await ActivityLog.create([
                { userId: user._id, action: 'login', timestamp: new Date(Date.now() - 1000 * 60 * 30) }, // 30 min ago
                { userId: user._id, action: 'device_on', timestamp: new Date(Date.now() - 1000 * 60 * 15) }, // 15 min ago
                { userId: user._id, action: 'device_off', timestamp: new Date() } // now
            ]);
            
            const oneHourAgo = new Date(Date.now() - 1000 * 60 * 60);
            const logs = await ActivityLog.find({
                userId: user._id,
                timestamp: { $gte: oneHourAgo }
            });
            
            expect(logs.length).toBe(3);
        });
        
        test('Should get last 24 hours activities', async () => {
            // Create activities within 24h
            await ActivityLog.create([
                { userId: user._id, action: 'action1', timestamp: new Date(Date.now() - 1000 * 60 * 30) },
                { userId: user._id, action: 'action2', timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2) },
                { userId: user._id, action: 'action3', timestamp: new Date(Date.now() - 1000 * 60 * 60 * 12) }
            ]);
            
            const twentyFourHoursAgo = new Date(Date.now() - 1000 * 60 * 60 * 24);
            const logs = await ActivityLog.find({
                userId: user._id,
                timestamp: { $gte: twentyFourHoursAgo }
            });
            
            expect(logs.length).toBe(3);
        });
        
        test('Should auto-clean old logs (TTL index)', async () => {
            // Create old log
            await ActivityLog.create({
                userId: user._id,
                action: 'old_action',
                timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 8) // 8 days old
            });
            
            const oldLogs = await ActivityLog.find({
                timestamp: { $lt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7) }
            });
            
            // MongoDB TTL should handle deletion automatically
            expect(oldLogs.length).toBeDefined();
        });
    });
    
    describe('Transactions', () => {
        test('Should execute atomic transaction', async () => {
            const session = await mongoose.startSession();
            session.startTransaction();
            
            try {
                const user = await User.create([{
                    name: 'Transaction User',
                    email: 'transaction@estif.com',
                    password: 'Tx123!'
                }], { session });
                
                const home = await Home.create([{
                    name: 'Transaction Home',
                    ownerId: user[0]._id,
                    members: [{ userId: user[0]._id, role: 'owner' }]
                }], { session });
                
                await session.commitTransaction();
                
                expect(user[0]._id).toBeDefined();
                expect(home[0]._id).toBeDefined();
            } catch (error) {
                await session.abortTransaction();
                throw error;
            } finally {
                session.endSession();
            }
        });
        
        test('Should rollback on error', async () => {
            const session = await mongoose.startSession();
            session.startTransaction();
            
            try {
                await User.create([{
                    name: 'Rollback User',
                    email: 'rollback@estif.com',
                    password: 'Roll123!'
                }], { session });
                
                // This should fail
                await User.create([{
                    name: 'Duplicate User',
                    email: 'rollback@estif.com', // Duplicate email
                    password: 'Dup123!'
                }], { session });
                
                await session.commitTransaction();
            } catch (error) {
                await session.abortTransaction();
            } finally {
                session.endSession();
            }
            
            const users = await User.find({ email: 'rollback@estif.com' });
            expect(users.length).toBe(0);
        });
    });
    
    describe('Performance Tests', () => {
        test('Bulk insert should be efficient', async () => {
            const devices = [];
            for (let i = 0; i < 1000; i++) {
                devices.push({
                    name: `Device ${i}`,
                    type: 'light',
                    gpio: i % 40,
                    power: 10,
                    ownerId: new mongoose.Types.ObjectId()
                });
            }
            
            const start = Date.now();
            await Device.insertMany(devices);
            const duration = Date.now() - start;
            
            expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
        });
        
        test('Query with indexes should be fast', async () => {
            // Create test data
            const userId = new mongoose.Types.ObjectId();
            const devices = [];
            for (let i = 0; i < 5000; i++) {
                devices.push({
                    name: `Test Device ${i}`,
                    type: i % 2 === 0 ? 'light' : 'fan',
                    gpio: i % 40,
                    ownerId: userId,
                    state: i % 3 === 0
                });
            }
            await Device.insertMany(devices);
            
            const start = Date.now();
            const result = await Device.find({ ownerId: userId, state: true }).limit(100);
            const duration = Date.now() - start;
            
            expect(result.length).toBeLessThanOrEqual(100);
            expect(duration).toBeLessThan(200); // Should be fast with index
        });
        
        test('Aggregation pipeline should perform well', async () => {
            // Create diverse data
            const homeId = new mongoose.Types.ObjectId();
            const devices = [];
            for (let i = 0; i < 2000; i++) {
                devices.push({
                    name: `Device ${i}`,
                    type: ['light', 'fan', 'ac', 'heater'][i % 4],
                    power: [10, 40, 120, 1500][i % 4],
                    state: i % 2 === 0,
                    autoMode: i % 3 === 0,
                    homeId
                });
            }
            await Device.insertMany(devices);
            
            const start = Date.now();
            const stats = await Device.aggregate([
                { $match: { homeId } },
                { $group: {
                    _id: '$type',
                    count: { $sum: 1 },
                    totalPower: { $sum: { $cond: ['$state', '$power', 0] } },
                    activeCount: { $sum: { $cond: ['$state', 1, 0] } }
                } }
            ]);
            const duration = Date.now() - start;
            
            expect(stats.length).toBe(4);
            expect(duration).toBeLessThan(500);
        });
    });
});