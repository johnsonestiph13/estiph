/**
 * Multi-User E2E Tests
 * Tests concurrent users, permissions, and isolation
 */

const request = require('supertest');
const mongoose = require('mongoose');
const { app } = require('../../app');

describe('Multi-User E2E Tests', () => {
    let adminToken, user1Token, user2Token;
    let adminId, user1Id, user2Id;
    let sharedHomeId, adminDeviceId;

    beforeAll(async () => {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/estif_test');
    });

    afterAll(async () => {
        await mongoose.connection.dropDatabase();
        await mongoose.disconnect();
    });

    beforeEach(async () => {
        // Create users
        const admin = await request(app)
            .post('/api/v1/auth/register')
            .send({ name: 'Admin', email: 'admin@multi.com', password: 'Admin123!' });
        adminToken = admin.body.data.token;
        adminId = admin.body.data.user.id;

        const user1 = await request(app)
            .post('/api/v1/auth/register')
            .send({ name: 'User1', email: 'user1@multi.com', password: 'User1123!' });
        user1Token = user1.body.data.token;
        user1Id = user1.body.data.user.id;

        const user2 = await request(app)
            .post('/api/v1/auth/register')
            .send({ name: 'User2', email: 'user2@multi.com', password: 'User2123!' });
        user2Token = user2.body.data.token;
        user2Id = user2.body.data.user.id;

        // Admin creates shared home
        const home = await request(app)
            .post('/api/v1/homes')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ name: 'Shared Home' });
        sharedHomeId = home.body.data.id;

        // Add users to home
        await request(app)
            .post(`/api/v1/homes/${sharedHomeId}/members`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ email: 'user1@multi.com', role: 'member' });
        
        await request(app)
            .post(`/api/v1/homes/${sharedHomeId}/members`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ email: 'user2@multi.com', role: 'member' });

        // Admin creates device
        const device = await request(app)
            .post('/api/v1/devices')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ name: 'Shared Light', type: 'light', gpio: 23, homeId: sharedHomeId });
        adminDeviceId = device.body.data.id;
    });

    test('Multiple users can control same device', async () => {
        // User1 turns on
        const user1On = await request(app)
            .post(`/api/v1/devices/${adminDeviceId}/toggle`)
            .set('Authorization', `Bearer ${user1Token}`);
        expect(user1On.body.data.state).toBe(true);

        // User2 turns off
        const user2Off = await request(app)
            .post(`/api/v1/devices/${adminDeviceId}/toggle`)
            .set('Authorization', `Bearer ${user2Token}`);
        expect(user2Off.body.data.state).toBe(false);
    });

    test('Users cannot access each others private homes', async () => {
        // User1 creates private home
        const privateHome = await request(app)
            .post('/api/v1/homes')
            .set('Authorization', `Bearer ${user1Token}`)
            .send({ name: 'Private Home' });
        
        const privateHomeId = privateHome.body.data.id;

        // User2 cannot access
        const access = await request(app)
            .get(`/api/v1/homes/${privateHomeId}`)
            .set('Authorization', `Bearer ${user2Token}`);
        
        expect(access.status).toBe(403);
    });

    test('Admin can remove member from home', async () => {
        const removeRes = await request(app)
            .delete(`/api/v1/homes/${sharedHomeId}/members/${user2Id}`)
            .set('Authorization', `Bearer ${adminToken}`);
        
        expect(removeRes.status).toBe(200);

        // User2 cannot access anymore
        const access = await request(app)
            .get(`/api/v1/homes/${sharedHomeId}`)
            .set('Authorization', `Bearer ${user2Token}`);
        
        expect(access.status).toBe(403);
    });

    test('Concurrent device control', async () => {
        const promises = [];
        for (let i = 0; i < 10; i++) {
            promises.push(
                request(app)
                    .post(`/api/v1/devices/${adminDeviceId}/toggle`)
                    .set('Authorization', `Bearer ${user1Token}`)
            );
        }
        
        const results = await Promise.all(promises);
        const successful = results.filter(r => r.status === 200);
        expect(successful.length).toBeGreaterThan(0);
    });
});