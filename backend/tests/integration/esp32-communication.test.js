/**
 * ESP32 Communication Integration Tests
 * Tests firmware updates, device registration, and bidirectional communication
 */

const request = require('supertest');
const mongoose = require('mongoose');
const { app } = require('../../app');
const Device = require('../../models/Device');

describe('ESP32 Communication Tests', () => {
    let esp32Mac = 'AA:BB:CC:DD:EE:FF';

    beforeAll(async () => {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/estif_test');
    });

    afterAll(async () => {
        await mongoose.disconnect();
    });

    beforeEach(async () => {
        await Device.deleteMany({});
    });

    test('Should register ESP32 device', async () => {
        const res = await request(app)
            .post('/api/esp32/register')
            .send({
                mac: esp32Mac,
                name: 'Living Room ESP32',
                version: '1.0.0',
                ip: '192.168.1.100'
            })
            .expect(200);
        
        expect(res.body.success).toBe(true);
    });

    test('Should receive heartbeat from ESP32', async () => {
        const res = await request(app)
            .post('/api/esp32/heartbeat')
            .send({
                mac: esp32Mac,
                devices: [
                    { id: 0, state: true, gpio: 23 },
                    { id: 1, state: false, gpio: 22 }
                ],
                sensors: {
                    temperature: 24.5,
                    humidity: 55,
                    pressure: 1013
                }
            })
            .expect(200);
        
        expect(res.body.success).toBe(true);
    });

    test('Should check for firmware updates', async () => {
        const res = await request(app)
            .get('/api/esp32/firmware/version')
            .query({ currentVersion: '1.0.0', mac: esp32Mac })
            .expect(200);
        
        expect(res.body).toHaveProperty('latestVersion');
        expect(res.body).toHaveProperty('updateAvailable');
    });

    test('Should receive OTA update command', async () => {
        const res = await request(app)
            .post(`/api/esp32/ota/${esp32Mac}`)
            .send({
                action: 'update',
                version: '1.1.0',
                url: 'https://firmware.estif.com/esp32-v1.1.0.bin'
            })
            .expect(200);
        
        expect(res.body.success).toBe(true);
    });

    test('Should report device status', async () => {
        const res = await request(app)
            .post('/api/esp32/status')
            .send({
                mac: esp32Mac,
                uptime: 86400,
                freeHeap: 180000,
                wifiRSSI: -45,
                devices: [
                    { gpio: 23, state: true, power: 10 }
                ]
            })
            .expect(200);
        
        expect(res.body.success).toBe(true);
    });
});