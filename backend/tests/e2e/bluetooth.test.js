/**
 * Bluetooth E2E Tests
 * Tests Bluetooth device discovery, pairing, and proximity triggers
 */

const request = require('supertest');
const mongoose = require('mongoose');
const { app } = require('../../app');

describe('Bluetooth E2E Tests', () => {
    let token, deviceId, beaconId;

    beforeAll(async () => {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/estif_test');
        
        const register = await request(app)
            .post('/api/v1/auth/register')
            .send({ name: 'BT User', email: 'bt@test.com', password: 'Bt123!' });
        token = register.body.data.token;
    });

    afterAll(async () => {
        await mongoose.connection.dropDatabase();
        await mongoose.disconnect();
    });

    test('Discover Bluetooth devices', async () => {
        const res = await request(app)
            .get('/api/v1/bluetooth/discover')
            .set('Authorization', `Bearer ${token}`)
            .query({ timeout: 5000 });
        
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body.data)).toBe(true);
    });

    test('Pair with Bluetooth device', async () => {
        const res = await request(app)
            .post('/api/v1/bluetooth/pair')
            .set('Authorization', `Bearer ${token}`)
            .send({
                address: 'AA:BB:CC:DD:EE:FF',
                name: 'ESP32 Device',
                type: 'esp32'
            });
        
        expect(res.status).toBe(200);
        beaconId = res.body.data.id;
    });

    test('Create proximity trigger', async () => {
        const res = await request(app)
            .post('/api/v1/bluetooth/proximity')
            .set('Authorization', `Bearer ${token}`)
            .send({
                beaconId,
                deviceId,
                onEnter: { action: 'turn_on' },
                onExit: { action: 'turn_off' },
                range: 5
            });
        
        expect(res.status).toBe(200);
    });

    test('Get paired devices', async () => {
        const res = await request(app)
            .get('/api/v1/bluetooth/devices')
            .set('Authorization', `Bearer ${token}`);
        
        expect(res.status).toBe(200);
    });

    test('Unpair device', async () => {
        const res = await request(app)
            .delete(`/api/v1/bluetooth/devices/${beaconId}`)
            .set('Authorization', `Bearer ${token}`);
        
        expect(res.status).toBe(200);
    });
});