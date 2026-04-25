/**
 * Real-time Sync E2E Tests
 * Tests WebSocket synchronization across multiple clients
 */

const io = require('socket.io-client');
const request = require('supertest');
const mongoose = require('mongoose');
const { server } = require('../../app');

describe('Real-time Sync E2E Tests', () => {
    let client1, client2;
    let token1, token2;
    let deviceId;
    let SOCKET_URL;

    beforeAll(async () => {
        SOCKET_URL = `http://localhost:${process.env.PORT || 3000}`;
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/estif_test');
        
        // Create users
        const user1 = await request(require('../../app').app)
            .post('/api/v1/auth/register')
            .send({ name: 'Sync1', email: 'sync1@test.com', password: 'Sync123!' });
        token1 = user1.body.data.token;

        const user2 = await request(require('../../app').app)
            .post('/api/v1/auth/register')
            .send({ name: 'Sync2', email: 'sync2@test.com', password: 'Sync123!' });
        token2 = user2.body.data.token;

        // Create device
        const device = await request(require('../../app').app)
            .post('/api/v1/devices')
            .set('Authorization', `Bearer ${token1}`)
            .send({ name: 'Sync Light', type: 'light', gpio: 23 });
        deviceId = device.body.data.id;
    });

    afterAll(async () => {
        await mongoose.connection.dropDatabase();
        await mongoose.disconnect();
        server.close();
    });

    beforeEach(() => {
        client1 = io(SOCKET_URL, { auth: { token: token1 } });
        client2 = io(SOCKET_URL, { auth: { token: token2 } });
    });

    afterEach(() => {
        if (client1) client1.disconnect();
        if (client2) client2.disconnect();
    });

    test('Device state sync across clients', (done) => {
        client2.on('device_updated', (data) => {
            expect(data.deviceId).toBe(deviceId);
            expect(data.state).toBe(true);
            done();
        });

        setTimeout(() => {
            client1.emit('device_control', { deviceId, state: true });
        }, 500);
    });

    test('Auto mode sync across clients', (done) => {
        client2.on('auto_mode_updated', (data) => {
            expect(data.deviceId).toBe(deviceId);
            expect(data.enabled).toBe(true);
            done();
        });

        setTimeout(() => {
            client1.emit('auto_mode', { deviceId, enabled: true });
        }, 500);
    });

    test('Activity broadcast to all members', (done) => {
        client2.on('new_activity', (data) => {
            expect(data.action).toBeDefined();
            done();
        });

        setTimeout(() => {
            client1.emit('device_control', { deviceId, state: true });
        }, 500);
    });
});