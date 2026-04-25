/**
 * API Integration Tests
 * Tests all API endpoints for correctness, authentication, and error handling
 * Version: 3.0.0
 */

const request = require('supertest');
const mongoose = require('mongoose');
const { app, server } = require('../../app');
const User = require('../../models/User');
const Home = require('../../models/Home');
const Device = require('../../models/Device');
const ActivityLog = require('../../models/ActivityLog');

describe('API Integration Tests', () => {
    let authToken;
    let testUser;
    let testHome;
    let testDevice;

    beforeAll(async () => {
        await mongoose.connect(process.env.TEST_MONGODB_URI || 'mongodb://localhost:27017/estif_test');
    });

    afterAll(async () => {
        await mongoose.connection.dropDatabase();
        await mongoose.connection.close();
        server.close();
    });

    beforeEach(async () => {
        await User.deleteMany({});
        await Home.deleteMany({});
        await Device.deleteMany({});
        
        // Create test user
        testUser = await User.create({
            name: 'Test User',
            email: 'test@estif.com',
            password: 'Test123!@#',
            role: 'admin'
        });
        
        // Generate token
        const loginRes = await request(app)
            .post('/api/v1/auth/login')
            .send({ email: 'test@estif.com', password: 'Test123!@#' });
        authToken = loginRes.body.data.token;
        
        // Create test home
        testHome = await Home.create({
            name: 'Test Home',
            ownerId: testUser._id,
            members: [{ userId: testUser._id, role: 'owner' }]
        });
        
        // Create test device
        testDevice = await Device.create({
            name: 'Test Light',
            type: 'light',
            gpio: 23,
            power: 10,
            homeId: testHome._id,
            ownerId: testUser._id
        });
    });

    describe('Health Check', () => {
        test('GET /api/health - should return server status', async () => {
            const res = await request(app)
                .get('/api/health')
                .expect(200);
            
            expect(res.body.success).toBe(true);
            expect(res.body.status).toBe('healthy');
            expect(res.body.version).toBeDefined();
        });
    });

    describe('Authentication API', () => {
        test('POST /api/v1/auth/register - should create new user', async () => {
            const res = await request(app)
                .post('/api/v1/auth/register')
                .send({
                    name: 'New User',
                    email: 'new@estif.com',
                    password: 'Password123!',
                    confirmPassword: 'Password123!'
                })
                .expect(201);
            
            expect(res.body.success).toBe(true);
            expect(res.body.data.user).toHaveProperty('id');
            expect(res.body.data.user.email).toBe('new@estif.com');
        });

        test('POST /api/v1/auth/register - should reject duplicate email', async () => {
            const res = await request(app)
                .post('/api/v1/auth/register')
                .send({
                    name: 'Duplicate User',
                    email: 'test@estif.com',
                    password: 'Password123!',
                    confirmPassword: 'Password123!'
                })
                .expect(400);
            
            expect(res.body.success).toBe(false);
            expect(res.body.message).toContain('already registered');
        });

        test('POST /api/v1/auth/login - should authenticate valid user', async () => {
            const res = await request(app)
                .post('/api/v1/auth/login')
                .send({ email: 'test@estif.com', password: 'Test123!@#' })
                .expect(200);
            
            expect(res.body.success).toBe(true);
            expect(res.body.data.token).toBeDefined();
            expect(res.body.data.user.email).toBe('test@estif.com');
        });

        test('POST /api/v1/auth/login - should reject invalid password', async () => {
            const res = await request(app)
                .post('/api/v1/auth/login')
                .send({ email: 'test@estif.com', password: 'wrongpassword' })
                .expect(401);
            
            expect(res.body.success).toBe(false);
            expect(res.body.message).toBe('Invalid credentials');
        });

        test('POST /api/v1/auth/logout - should logout user', async () => {
            const res = await request(app)
                .post('/api/v1/auth/logout')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);
            
            expect(res.body.success).toBe(true);
        });
    });

    describe('Device Management API', () => {
        test('GET /api/v1/devices - should get all user devices', async () => {
            const res = await request(app)
                .get('/api/v1/devices')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);
            
            expect(res.body.success).toBe(true);
            expect(Array.isArray(res.body.data)).toBe(true);
            expect(res.body.data.length).toBeGreaterThan(0);
        });

        test('POST /api/v1/devices - should create new device', async () => {
            const res = await request(app)
                .post('/api/v1/devices')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    name: 'New Fan',
                    type: 'fan',
                    gpio: 22,
                    power: 40,
                    homeId: testHome._id.toString(),
                    room: 'Bedroom'
                })
                .expect(201);
            
            expect(res.body.success).toBe(true);
            expect(res.body.data.name).toBe('New Fan');
            expect(res.body.data.gpio).toBe(22);
        });

        test('PUT /api/v1/devices/:id - should update device', async () => {
            const res = await request(app)
                .put(`/api/v1/devices/${testDevice._id}`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({ name: 'Updated Light', power: 15 })
                .expect(200);
            
            expect(res.body.success).toBe(true);
            expect(res.body.data.name).toBe('Updated Light');
            expect(res.body.data.power).toBe(15);
        });

        test('POST /api/v1/devices/:id/toggle - should toggle device state', async () => {
            const res = await request(app)
                .post(`/api/v1/devices/${testDevice._id}/toggle`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);
            
            expect(res.body.success).toBe(true);
            expect(res.body.data.state).toBe(true);
        });

        test('POST /api/v1/devices/:id/auto - should enable auto mode', async () => {
            const res = await request(app)
                .post(`/api/v1/devices/${testDevice._id}/auto`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({ enabled: true })
                .expect(200);
            
            expect(res.body.success).toBe(true);
            expect(res.body.data.autoMode).toBe(true);
        });

        test('POST /api/v1/devices/master/on - should turn on all devices', async () => {
            const res = await request(app)
                .post('/api/v1/devices/master/on')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);
            
            expect(res.body.success).toBe(true);
            
            // Verify all devices are on
            const devices = await Device.find({ ownerId: testUser._id });
            devices.forEach(device => {
                if (!device.autoMode) {
                    expect(device.state).toBe(true);
                }
            });
        });

        test('DELETE /api/v1/devices/:id - should delete device', async () => {
            const res = await request(app)
                .delete(`/api/v1/devices/${testDevice._id}`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);
            
            expect(res.body.success).toBe(true);
            
            const deletedDevice = await Device.findById(testDevice._id);
            expect(deletedDevice).toBeNull();
        });
    });

    describe('Home Management API', () => {
        test('GET /api/v1/homes - should get user homes', async () => {
            const res = await request(app)
                .get('/api/v1/homes')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);
            
            expect(res.body.success).toBe(true);
            expect(res.body.data.length).toBeGreaterThan(0);
        });

        test('POST /api/v1/homes - should create new home', async () => {
            const res = await request(app)
                .post('/api/v1/homes')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    name: 'Vacation Home',
                    address: '123 Beach Road',
                    city: 'Addis Ababa'
                })
                .expect(201);
            
            expect(res.body.success).toBe(true);
            expect(res.body.data.name).toBe('Vacation Home');
            expect(res.body.data.ownerId).toBe(testUser._id.toString());
        });

        test('POST /api/v1/homes/:id/members - should add member to home', async () => {
            const newUser = await User.create({
                name: 'Family Member',
                email: 'family@estif.com',
                password: 'Family123!'
            });
            
            const res = await request(app)
                .post(`/api/v1/homes/${testHome._id}/members`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    email: 'family@estif.com',
                    role: 'member'
                })
                .expect(200);
            
            expect(res.body.success).toBe(true);
            expect(res.body.data.members.some(m => m.userId === newUser._id.toString())).toBe(true);
        });

        test('DELETE /api/v1/homes/:id - should delete home', async () => {
            const res = await request(app)
                .delete(`/api/v1/homes/${testHome._id}`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);
            
            expect(res.body.success).toBe(true);
            
            const deletedHome = await Home.findById(testHome._id);
            expect(deletedHome).toBeNull();
        });
    });

    describe('Activity Log API', () => {
        test('GET /api/v1/activities - should get recent activities', async () => {
            // Create some activities
            await ActivityLog.create({
                userId: testUser._id,
                action: 'device_on',
                details: { device: 'Light' }
            });
            
            const res = await request(app)
                .get('/api/v1/activities?limit=10')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);
            
            expect(res.body.success).toBe(true);
            expect(Array.isArray(res.body.data)).toBe(true);
        });

        test('GET /api/v1/activities/recent/24h - should get last 24 hours activities', async () => {
            const res = await request(app)
                .get('/api/v1/activities/recent/24h')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);
            
            expect(res.body.success).toBe(true);
            expect(res.body.data).toBeDefined();
        });
    });

    describe('Rate Limiting', () => {
        test('Should rate limit excessive requests', async () => {
            const requests = [];
            for (let i = 0; i < 110; i++) {
                requests.push(
                    request(app)
                        .get('/api/health')
                        .set('Authorization', `Bearer ${authToken}`)
                );
            }
            
            const responses = await Promise.all(requests);
            const rateLimited = responses.some(r => r.status === 429);
            expect(rateLimited).toBe(true);
        });
    });

    describe('Error Handling', () => {
        test('Should handle invalid route', async () => {
            const res = await request(app)
                .get('/api/invalid-route')
                .expect(404);
            
            expect(res.body.success).toBe(false);
        });

        test('Should handle missing authentication', async () => {
            const res = await request(app)
                .get('/api/v1/devices')
                .expect(401);
            
            expect(res.body.success).toBe(false);
            expect(res.body.message).toContain('authorization');
        });

        test('Should handle invalid device ID', async () => {
            const res = await request(app)
                .get('/api/v1/devices/invalid-id')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(400);
            
            expect(res.body.success).toBe(false);
        });
    });

    describe('Multi-Tenant Isolation', () => {
        test('User should not access another user\'s device', async () => {
            // Create another user
            const otherUser = await User.create({
                name: 'Other User',
                email: 'other@estif.com',
                password: 'Other123!'
            });
            
            const otherLogin = await request(app)
                .post('/api/v1/auth/login')
                .send({ email: 'other@estif.com', password: 'Other123!' });
            
            const otherToken = otherLogin.body.data.token;
            
            // Try to access test device
            const res = await request(app)
                .get(`/api/v1/devices/${testDevice._id}`)
                .set('Authorization', `Bearer ${otherToken}`)
                .expect(404);
            
            expect(res.body.success).toBe(false);
        });
    });
});