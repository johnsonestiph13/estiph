/**
 * Offline Mode E2E Tests
 * Tests PWA offline capabilities, local storage sync, and reconnection
 */

const request = require('supertest');
const mongoose = require('mongoose');
const { app, server } = require('../../app');

describe('Offline Mode E2E Tests', () => {
    let token, deviceId;

    beforeAll(async () => {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/estif_test');
        
        const register = await request(app)
            .post('/api/v1/auth/register')
            .send({ name: 'Offline User', email: 'offline@test.com', password: 'Offline123!' });
        token = register.body.data.token;

        const device = await request(app)
            .post('/api/v1/devices')
            .set('Authorization', `Bearer ${token}`)
            .send({ name: 'Offline Light', type: 'light', gpio: 23 });
        deviceId = device.body.data.id;
    });

    afterAll(async () => {
        await mongoose.connection.dropDatabase();
        await mongoose.disconnect();
        server.close();
    });

    test('Cache static assets for offline', async () => {
        const res = await request(app)
            .get('/manifest.json')
            .expect(200);
        
        expect(res.headers['cache-control']).toBeDefined();
    });

    test('Service worker registration endpoint', async () => {
        const res = await request(app)
            .get('/sw.js')
            .expect(200);
        
        expect(res.text).toContain('self.addEventListener');
    });

    test('Offline page exists', async () => {
        const res = await request(app)
            .get('/offline.html')
            .expect(200);
        
        expect(res.text).toContain('Offline');
    });

    test('Queue offline actions', async () => {
        const res = await request(app)
            .post('/api/v1/offline/queue')
            .set('Authorization', `Bearer ${token}`)
            .send({
                action: 'device_toggle',
                payload: { deviceId, state: true },
                timestamp: Date.now()
            });
        
        expect(res.status).toBe(200);
    });

    test('Sync offline queue on reconnect', async () => {
        const syncRes = await request(app)
            .post('/api/v1/offline/sync')
            .set('Authorization', `Bearer ${token}`)
            .send({ deviceId });
        
        expect(syncRes.status).toBe(200);
    });

    test('Get pending offline actions', async () => {
        const res = await request(app)
            .get('/api/v1/offline/pending')
            .set('Authorization', `Bearer ${token}`);
        
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body.data)).toBe(true);
    });
});