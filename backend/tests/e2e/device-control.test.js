/**
 * Device Control E2E Tests
 * Complete device lifecycle and control scenarios
 */

const request = require('supertest');
const mongoose = require('mongoose');
const { app } = require('../../app');
const Device = require('../../models/Device');

describe('Device Control E2E Tests', () => {
    let token, deviceId;

    beforeAll(async () => {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/estif_test');
        
        // Setup user
        const registerRes = await request(app)
            .post('/api/v1/auth/register')
            .send({ name: 'Device Tester', email: 'device@test.com', password: 'Device123!' });
        
        token = registerRes.body.data.token;
    });

    afterAll(async () => {
        await mongoose.connection.dropDatabase();
        await mongoose.disconnect();
    });

    test('Complete device control flow', async () => {
        // 1. Create device
        const createRes = await request(app)
            .post('/api/v1/devices')
            .set('Authorization', `Bearer ${token}`)
            .send({
                name: 'E2E Light',
                type: 'light',
                gpio: 23,
                power: 10
            });
        
        expect(createRes.status).toBe(201);
        deviceId = createRes.body.data.id;

        // 2. Turn ON
        const onRes = await request(app)
            .post(`/api/v1/devices/${deviceId}/toggle`)
            .set('Authorization', `Bearer ${token}`);
        
        expect(onRes.body.data.state).toBe(true);

        // 3. Turn OFF
        const offRes = await request(app)
            .post(`/api/v1/devices/${deviceId}/toggle`)
            .set('Authorization', `Bearer ${token}`);
        
        expect(offRes.body.data.state).toBe(false);

        // 4. Enable Auto Mode
        const autoRes = await request(app)
            .post(`/api/v1/devices/${deviceId}/auto`)
            .set('Authorization', `Bearer ${token}`)
            .send({ enabled: true });
        
        expect(autoRes.body.data.autoMode).toBe(true);

        // 5. Verify cannot manual control
        const manualRes = await request(app)
            .post(`/api/v1/devices/${deviceId}/toggle`)
            .set('Authorization', `Bearer ${token}`);
        
        expect(manualRes.status).toBe(400);
        expect(manualRes.body.message).toContain('AUTO');

        // 6. Update device
        const updateRes = await request(app)
            .put(`/api/v1/devices/${deviceId}`)
            .set('Authorization', `Bearer ${token}`)
            .send({ name: 'Updated Light', power: 15 });
        
        expect(updateRes.body.data.name).toBe('Updated Light');

        // 7. Delete device
        const deleteRes = await request(app)
            .delete(`/api/v1/devices/${deviceId}`)
            .set('Authorization', `Bearer ${token}`);
        
        expect(deleteRes.status).toBe(200);
    });

    test('Master control all devices', async () => {
        // Create multiple devices
        const devices = [];
        for (let i = 0; i < 3; i++) {
            const res = await request(app)
                .post('/api/v1/devices')
                .set('Authorization', `Bearer ${token}`)
                .send({ name: `Device ${i}`, type: 'light', gpio: 20 + i });
            devices.push(res.body.data.id);
        }

        // Master ON
        const masterOn = await request(app)
            .post('/api/v1/devices/master/on')
            .set('Authorization', `Bearer ${token}`);
        
        expect(masterOn.status).toBe(200);

        // Verify all on
        const getRes = await request(app)
            .get('/api/v1/devices')
            .set('Authorization', `Bearer ${token}`);
        
        getRes.body.data.forEach(d => {
            expect(d.state).toBe(true);
        });

        // Master OFF
        await request(app)
            .post('/api/v1/devices/master/off')
            .set('Authorization', `Bearer ${token}`);
    });
});