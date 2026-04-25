/**
 * Automation Trigger Integration Tests
 * Tests scheduled tasks, conditions, scenes, and webhook triggers
 */

const request = require('supertest');
const mongoose = require('mongoose');
const { app } = require('../../app');
const User = require('../../models/User');
const Device = require('../../models/Device');
const Automation = require('../../models/Automation');

describe('Automation Trigger Tests', () => {
    let token, userId, deviceId;

    beforeAll(async () => {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/estif_test');
    });

    afterAll(async () => {
        await mongoose.connection.dropDatabase();
        await mongoose.disconnect();
    });

    beforeEach(async () => {
        await User.deleteMany({});
        await Device.deleteMany({});
        await Automation.deleteMany({});

        // Create user
        const userRes = await request(app)
            .post('/api/v1/auth/register')
            .send({ name: 'Auto User', email: 'auto@estif.com', password: 'Auto123!' });
        
        userId = userRes.body.data.user.id;
        token = userRes.body.data.token;

        // Create device
        const deviceRes = await request(app)
            .post('/api/v1/devices')
            .set('Authorization', `Bearer ${token}`)
            .send({ name: 'Test Light', type: 'light', gpio: 23 });
        
        deviceId = deviceRes.body.data.id;
    });

    test('Should create time-based automation', async () => {
        const autoRes = await request(app)
            .post('/api/v1/automations')
            .set('Authorization', `Bearer ${token}`)
            .send({
                name: 'Morning Light',
                trigger: { type: 'time', time: '06:30', days: ['weekdays'] },
                action: { type: 'device', deviceId, command: 'on' },
                enabled: true
            });
        
        expect(autoRes.status).toBe(201);
        expect(autoRes.body.data.name).toBe('Morning Light');
    });

    test('Should create temperature-based automation', async () => {
        const autoRes = await request(app)
            .post('/api/v1/automations')
            .set('Authorization', `Bearer ${token}`)
            .send({
                name: 'AC Control',
                trigger: { 
                    type: 'temperature', 
                    condition: 'above', 
                    threshold: 26,
                    sensor: 'living_room'
                },
                action: { type: 'device', deviceId, command: 'on' },
                enabled: true
            });
        
        expect(autoRes.status).toBe(201);
    });

    test('Should trigger automation on device state change', async () => {
        // Create automation
        await request(app)
            .post('/api/v1/automations')
            .set('Authorization', `Bearer ${token}`)
            .send({
                name: 'Fan with Light',
                trigger: { type: 'device_state', deviceId, state: 'on' },
                action: { type: 'device', deviceId: 'fan_id', command: 'on' },
                enabled: true
            });
        
        // Trigger by toggling device
        const toggleRes = await request(app)
            .post(`/api/v1/devices/${deviceId}/toggle`)
            .set('Authorization', `Bearer ${token}`);
        
        expect(toggleRes.status).toBe(200);
    });

    test('Should create scene automation', async () => {
        const sceneRes = await request(app)
            .post('/api/v1/scenes')
            .set('Authorization', `Bearer ${token}`)
            .send({
                name: 'Movie Mode',
                actions: [
                    { deviceId, command: 'off' },
                    { deviceId: 'tv_id', command: 'on', brightness: 50 }
                ],
                icon: '🎬'
            });
        
        expect(sceneRes.status).toBe(201);
        
        // Activate scene
        const activateRes = await request(app)
            .post(`/api/v1/scenes/${sceneRes.body.data.id}/activate`)
            .set('Authorization', `Bearer ${token}`);
        
        expect(activateRes.status).toBe(200);
    });

    test('Should create webhook automation', async () => {
        const webhookRes = await request(app)
            .post('/api/v1/webhooks')
            .set('Authorization', `Bearer ${token}`)
            .send({
                url: 'https://api.estif.com/webhook',
                events: ['device.on', 'device.off', 'temperature.high'],
                secret: 'webhook_secret'
            });
        
        expect(webhookRes.status).toBe(201);
    });

    test('Should list and manage automations', async () => {
        // Create multiple automations
        await request(app)
            .post('/api/v1/automations')
            .set('Authorization', `Bearer ${token}`)
            .send({ name: 'Auto 1', trigger: { type: 'time', time: '08:00' }, action: {} });
        
        await request(app)
            .post('/api/v1/automations')
            .set('Authorization', `Bearer ${token}`)
            .send({ name: 'Auto 2', trigger: { type: 'time', time: '20:00' }, action: {} });
        
        const listRes = await request(app)
            .get('/api/v1/automations')
            .set('Authorization', `Bearer ${token}`);
        
        expect(listRes.status).toBe(200);
        expect(listRes.body.data.length).toBe(2);
    });
});