/**
 * Voice Command E2E Tests
 * Tests voice recognition, NLP processing, and command execution
 */

const request = require('supertest');
const mongoose = require('mongoose');
const { app } = require('../../app');
const Device = require('../../models/Device');

describe('Voice Command E2E Tests', () => {
    let token, deviceId;

    beforeAll(async () => {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/estif_test');
        
        const register = await request(app)
            .post('/api/v1/auth/register')
            .send({ name: 'Voice User', email: 'voice@test.com', password: 'Voice123!' });
        token = register.body.data.token;

        const device = await request(app)
            .post('/api/v1/devices')
            .set('Authorization', `Bearer ${token}`)
            .send({ name: 'Voice Light', type: 'light', gpio: 23 });
        deviceId = device.body.data.id;
    });

    afterAll(async () => {
        await mongoose.connection.dropDatabase();
        await mongoose.disconnect();
    });

    test('Turn on device by voice', async () => {
        const res = await request(app)
            .post('/api/v1/voice/command')
            .set('Authorization', `Bearer ${token}`)
            .send({ text: 'turn on the light' });
        
        expect(res.status).toBe(200);
        expect(res.body.data.action.action).toBe('toggle');
        expect(res.body.data.action.state).toBe(true);
    });

    test('Turn off device by voice', async () => {
        const res = await request(app)
            .post('/api/v1/voice/command')
            .set('Authorization', `Bearer ${token}`)
            .send({ text: 'turn off the light' });
        
        expect(res.status).toBe(200);
        expect(res.body.data.action.state).toBe(false);
    });

    test('Enable auto mode by voice', async () => {
        const res = await request(app)
            .post('/api/v1/voice/command')
            .set('Authorization', `Bearer ${token}`)
            .send({ text: 'enable auto mode for light' });
        
        expect(res.status).toBe(200);
        expect(res.body.data.action.action).toBe('auto_mode');
        expect(res.body.data.action.enabled).toBe(true);
    });

    test('Master control by voice', async () => {
        const res = await request(app)
            .post('/api/v1/voice/command')
            .set('Authorization', `Bearer ${token}`)
            .send({ text: 'turn on all devices' });
        
        expect(res.status).toBe(200);
        expect(res.body.data.action.action).toBe('master');
    });

    test('Amharic voice command', async () => {
        const res = await request(app)
            .post('/api/v1/voice/command')
            .set('Authorization', `Bearer ${token}`)
            .send({ text: 'መብራት አብራ', language: 'am' });
        
        expect(res.status).toBe(200);
    });

    test('Voice command history', async () => {
        await request(app)
            .post('/api/v1/voice/command')
            .set('Authorization', `Bearer ${token}`)
            .send({ text: 'turn on light' });
        
        const history = await request(app)
            .get('/api/v1/voice/history')
            .set('Authorization', `Bearer ${token}`);
        
        expect(history.status).toBe(200);
        expect(history.body.data.length).toBeGreaterThan(0);
    });
});