/**
 * WebSocket Integration Tests
 * Tests real-time communication, device sync, and cross-device mode synchronization
 * Version: 3.0.0
 */

const io = require('socket.io-client');
const mongoose = require('mongoose');
const { server } = require('../../server');
const User = require('../../models/User');
const Device = require('../../models/Device');
const Home = require('../../models/Home');

describe('WebSocket Integration Tests', () => {
    let clientSocket;
    let adminSocket;
    let memberSocket;
    let testUser;
    let memberUser;
    let testDevice;
    let testHome;
    let SOCKET_URL;

    beforeAll(async () => {
        SOCKET_URL = `http://localhost:${process.env.PORT || 3000}`;
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/estif_test');
    });

    afterAll(async () => {
        await mongoose.connection.dropDatabase();
        await mongoose.disconnect();
        server.close();
    });

    beforeEach(async () => {
        await User.deleteMany({});
        await Device.deleteMany({});
        await Home.deleteMany({});

        // Create users
        testUser = await User.create({
            name: 'Admin User',
            email: 'admin@estif.com',
            password: 'Admin123!',
            role: 'admin'
        });

        memberUser = await User.create({
            name: 'Member User',
            email: 'member@estif.com',
            password: 'Member123!',
            role: 'user'
        });

        // Create home
        testHome = await Home.create({
            name: 'Test Home',
            ownerId: testUser._id,
            members: [
                { userId: testUser._id, role: 'owner' },
                { userId: memberUser._id, role: 'member' }
            ]
        });

        // Create device
        testDevice = await Device.create({
            name: 'Test Light',
            type: 'light',
            gpio: 23,
            power: 10,
            state: false,
            autoMode: false,
            homeId: testHome._id,
            ownerId: testUser._id
        });

        // Generate tokens
        const jwt = require('jsonwebtoken');
        const adminToken = jwt.sign({ id: testUser._id }, process.env.JWT_SECRET);
        const memberToken = jwt.sign({ id: memberUser._id }, process.env.JWT_SECRET);

        // Connect sockets
        clientSocket = io(SOCKET_URL, { auth: { token: adminToken } });
        adminSocket = io(SOCKET_URL, { auth: { token: adminToken } });
        memberSocket = io(SOCKET_URL, { auth: { token: memberToken } });

        await Promise.all([
            new Promise(resolve => clientSocket.on('connect', resolve)),
            new Promise(resolve => adminSocket.on('connect', resolve)),
            new Promise(resolve => memberSocket.on('connect', resolve))
        ]);
    });

    afterEach(() => {
        if (clientSocket) clientSocket.disconnect();
        if (adminSocket) adminSocket.disconnect();
        if (memberSocket) memberSocket.disconnect();
    });

    describe('Connection Tests', () => {
        test('Should connect with valid token', (done) => {
            clientSocket.emit('ping', { time: Date.now() });
            clientSocket.once('pong', (data) => {
                expect(data).toBeDefined();
                done();
            });
        });

        test('Should reject connection without token', (done) => {
            const unauthSocket = io(SOCKET_URL);
            unauthSocket.on('connect_error', (err) => {
                expect(err.message).toContain('Authentication');
                unauthSocket.disconnect();
                done();
            });
        });

        test('Should receive initial data on connect', (done) => {
            adminSocket.once('initial_data', (data) => {
                expect(data.user).toBeDefined();
                expect(data.devices).toBeDefined();
                expect(data.homes).toBeDefined();
                done();
            });
        });
    });

    describe('Device Control Tests', () => {
        test('Should toggle device and sync to all members', (done) => {
            let adminReceived = false;
            let memberReceived = false;

            adminSocket.on('device_updated', (data) => {
                if (data.deviceId === testDevice._id.toString()) {
                    adminReceived = true;
                }
                if (adminReceived && memberReceived) done();
            });

            memberSocket.on('device_updated', (data) => {
                if (data.deviceId === testDevice._id.toString()) {
                    memberReceived = true;
                }
                if (adminReceived && memberReceived) done();
            });

            adminSocket.emit('device_control', {
                deviceId: testDevice._id.toString(),
                state: true
            });
        });

        test('Should not toggle device in auto mode', (done) => {
            testDevice.autoMode = true;
            testDevice.save().then(() => {
                adminSocket.emit('device_control', {
                    deviceId: testDevice._id.toString(),
                    state: true
                });

                adminSocket.once('error', (data) => {
                    expect(data.message).toContain('AUTO mode');
                    done();
                });
            });
        });

        test('Should handle master control (all devices)', (done) => {
            memberSocket.on('master_updated', (data) => {
                expect(data.state).toBe(true);
                done();
            });

            adminSocket.emit('master_control', { state: true });
        });
    });

    describe('Auto Mode Tests', () => {
        test('Should toggle auto mode and sync', (done) => {
            memberSocket.on('auto_mode_updated', (data) => {
                expect(data.deviceId).toBe(testDevice._id.toString());
                expect(data.autoMode).toBe(true);
                done();
            });

            adminSocket.emit('auto_mode', {
                deviceId: testDevice._id.toString(),
                enabled: true
            });
        });

        test('Should show auto mode status on other devices', (done) => {
            let adminConfirmed = false;
            let memberConfirmed = false;

            const checkComplete = () => {
                if (adminConfirmed && memberConfirmed) done();
            };

            adminSocket.on('mode_status', (data) => {
                if (data.mode === 'auto' && data.deviceId === testDevice._id.toString()) {
                    adminConfirmed = true;
                    checkComplete();
                }
            });

            memberSocket.on('mode_status', (data) => {
                if (data.mode === 'auto' && data.deviceId === testDevice._id.toString()) {
                    memberConfirmed = true;
                    checkComplete();
                }
            });

            adminSocket.emit('auto_mode', {
                deviceId: testDevice._id.toString(),
                enabled: true
            });
        });
    });

    describe('Real-time Sync Tests', () => {
        test('Should sync device state across multiple clients instantly', (done) => {
            const startTime = Date.now();
            
            memberSocket.on('device_updated', () => {
                const latency = Date.now() - startTime;
                expect(latency).toBeLessThan(500); // Under 500ms
                done();
            });

            adminSocket.emit('device_control', {
                deviceId: testDevice._id.toString(),
                state: true
            });
        });

        test('Should broadcast activity to all home members', (done) => {
            let activitiesReceived = 0;
            
            const checkActivities = () => {
                activitiesReceived++;
                if (activitiesReceived === 2) done();
            };

            adminSocket.on('new_activity', checkActivities);
            memberSocket.on('new_activity', checkActivities);

            adminSocket.emit('device_control', {
                deviceId: testDevice._id.toString(),
                state: true
            });
        });
    });

    describe('Presence Tests', () => {
        test('Should track online/offline status of members', (done) => {
            memberSocket.on('member_status', (data) => {
                expect(data.userId).toBe(testUser._id.toString());
                expect(data.status).toBe('online');
                done();
            });

            adminSocket.emit('presence_update', { status: 'online' });
        });

        test('Should notify when member goes offline', (done) => {
            adminSocket.on('member_offline', (data) => {
                expect(data.userId).toBe(memberUser._id.toString());
                done();
            });

            memberSocket.disconnect();
        });
    });

    describe('Permission Tests', () => {
        test('Member cannot control devices they dont own', (done) => {
            const otherDevice = new Device({
                name: 'Other Device',
                type: 'light',
                gpio: 25,
                ownerId: new mongoose.Types.ObjectId(),
                homeId: testHome._id
            });
            
            otherDevice.save().then(() => {
                memberSocket.emit('device_control', {
                    deviceId: otherDevice._id.toString(),
                    state: true
                });

                memberSocket.once('error', (data) => {
                    expect(data.message).toContain('permission');
                    done();
                });
            });
        });

        test('Admin can control all home devices', (done) => {
            adminSocket.on('device_updated', (data) => {
                expect(data.deviceId).toBe(testDevice._id.toString());
                expect(data.state).toBe(true);
                done();
            });

            adminSocket.emit('device_control', {
                deviceId: testDevice._id.toString(),
                state: true
            });
        });
    });

    describe('Reconnection Tests', () => {
        test('Should reconnect and sync state', (done) => {
            clientSocket.disconnect();
            
            setTimeout(() => {
                const jwt = require('jsonwebtoken');
                const newToken = jwt.sign({ id: testUser._id }, process.env.JWT_SECRET);
                const newSocket = io(SOCKET_URL, { auth: { token: newToken } });
                
                newSocket.on('connect', () => {
                    newSocket.on('initial_data', (data) => {
                        expect(data.devices).toBeDefined();
                        newSocket.disconnect();
                        done();
                    });
                });
            }, 100);
        });
    });

    describe('Performance Tests', () => {
        test('Should handle multiple rapid events', (done) => {
            let received = 0;
            const targetCount = 10;
            
            memberSocket.on('device_updated', () => {
                received++;
                if (received === targetCount) {
                    expect(received).toBe(targetCount);
                    done();
                }
            });

            for (let i = 0; i < targetCount; i++) {
                adminSocket.emit('device_control', {
                    deviceId: testDevice._id.toString(),
                    state: i % 2 === 0
                });
            }
        });

        test('Should maintain order of events', (done) => {
            const states = [];
            
            memberSocket.on('device_updated', (data) => {
                states.push(data.state);
                if (states.length === 5) {
                    expect(states).toEqual([true, false, true, false, true]);
                    done();
                }
            });

            [true, false, true, false, true].forEach((state, i) => {
                setTimeout(() => {
                    adminSocket.emit('device_control', {
                        deviceId: testDevice._id.toString(),
                        state
                    });
                }, i * 50);
            });
        });
    });
});