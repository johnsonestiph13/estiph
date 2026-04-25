/**
 * Device Control Integration Tests
 * Tests device discovery, control, auto/manual modes, and energy monitoring
 */

const request = require('supertest');
const mongoose = require('mongoose');
const { app } = require('../../app');
const User = require('../../models/User');
const Device = require('../../models/Device');
const Home = require('../../models/Home');

describe('Device Control Tests', () => {
    let token, userId, homeId, deviceIds = [];

    const GPIO_DEVICES = [
        { gpio: 23, name: 'Light', type: 'light', power: 10, autoTemp: null },
        { gpio: 22, name: 'Fan', type: 'fan', power: 40, autoTemp: { on: 26, off: 24 } },
        { gpio: 21, name: 'Heater', type: 'heater', power: 1500, autoTemp: { on: 18, off: 20 } },
        { gpio: 19, name: 'AC', type: 'ac', power: 120, autoTemp: { on: 26, off: 24 } },
        { gpio: 18, name: 'TV', type: 'entertainment', power: 80, autoTemp: null },
        { gpio: 5, name: 'Pump', type: 'pump', power: 250, autoTemp: null }
    ];

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
        await Home.deleteMany({});

        // Create user
        const userRes = await request(app)
            .post('/api/v1/auth/register')
            .send({ name: 'Device User', email: 'device@estif.com', password: 'Device123!' });
        
        userId = userRes.body.data.user.id;
        token = userRes.body.data.token;

        // Create home
        const homeRes = await request(app)
            .post('/api/v1/homes')
            .set('Authorization', `Bearer ${token}`)
            .send({ name: 'Device Home' });
        
        homeId = homeRes.body.data.id;

        // Create devices
        for (const device of GPIO_DEVICES) {
            const deviceRes = await request(app)
                .post('/api/v1/devices')
                .set('Authorization', `Bearer ${token}`)
                .send({ ...device, homeId });
            
            deviceIds.push(deviceRes.body.data.id);
        }
    });

    test('Should discover all devices', async () => {
        const res = await request(app)
            .get('/api/v1/devices')
            .set('Authorization', `Bearer ${token}`);
        
        expect(res.status).toBe(200);
        expect(res.body.data.length).toBe(GPIO_DEVICES.length);
    });

    test('Should control individual device', async () => {
        const lightId = deviceIds[0];
        
        // Turn on
        const onRes = await request(app)
            .post(`/api/v1/devices/${lightId}/toggle`)
            .set('Authorization', `Bearer ${token}`);
        
        expect(onRes.status).toBe(200);
        expect(onRes.body.data.state).toBe(true);

        // Turn off
        const offRes = await request(app)
            .post(`/api/v1/devices/${lightId}/toggle`)
            .set('Authorization', `Bearer ${token}`);
        
        expect(offRes.status).toBe(200);
        expect(offRes.body.data.state).toBe(false);
    });

    test('Should enable auto mode with temperature conditions', async () => {
        const acId = deviceIds[3]; // AC device
        
        // Enable auto mode
        const autoRes = await request(app)
            .post(`/api/v1/devices/${acId}/auto`)
            .set('Authorization', `Bearer ${token}`)
            .send({ enabled: true });
        
        expect(autoRes.status).toBe(200);
        expect(autoRes.body.data.autoMode).toBe(true);
    });

    test('Should not allow manual control when auto mode is on', async () => {
        const fanId = deviceIds[1]; // Fan with auto mode
        
        // Enable auto mode
        await request(app)
            .post(`/api/v1/devices/${fanId}/auto`)
            .set('Authorization', `Bearer ${token}`)
            .send({ enabled: true });
        
        // Try manual toggle
        const toggleRes = await request(app)
            .post(`/api/v1/devices/${fanId}/toggle`)
            .set('Authorization', `Bearer ${token}`);
        
        expect(toggleRes.status).toBe(400);
        expect(toggleRes.body.message).toContain('AUTO mode');
    });

    test('Should master control all devices', async () => {
        // Turn all on
        const onRes = await request(app)
            .post('/api/v1/devices/master/on')
            .set('Authorization', `Bearer ${token}`);
        
        expect(onRes.status).toBe(200);

        // Verify all non-auto devices are on
        const devicesRes = await request(app)
            .get('/api/v1/devices')
            .set('Authorization', `Bearer ${token}`);
        
        const autoDevices = devicesRes.body.data.filter(d => d.autoMode);
        const manualDevices = devicesRes.body.data.filter(d => !d.autoMode);
        
        manualDevices.forEach(d => expect(d.state).toBe(true));
        autoDevices.forEach(d => expect(d.state).toBe(false));

        // Turn all off
        const offRes = await request(app)
            .post('/api/v1/devices/master/off')
            .set('Authorization', `Bearer ${token}`);
        
        expect(offRes.status).toBe(200);
    });

    test('Should track power consumption', async () => {
        // Turn on some devices
        await request(app)
            .post(`/api/v1/devices/${deviceIds[0]}/toggle`)
            .set('Authorization', `Bearer ${token}`); // Light: 10W
        
        await request(app)
            .post(`/api/v1/devices/${deviceIds[1]}/toggle`)
            .set('Authorization', `Bearer ${token}`); // Fan: 40W

        // Get power stats
        const statsRes = await request(app)
            .get('/api/v1/devices/power/stats')
            .set('Authorization', `Bearer ${token}`);
        
        expect(statsRes.status).toBe(200);
        expect(statsRes.body.data.totalPower).toBe(50); // 10 + 40
        expect(statsRes.body.data.activeCount).toBe(2);
    });

    test('Should schedule device operations', async () => {
        const lightId = deviceIds[0];
        
        const scheduleRes = await request(app)
            .post(`/api/v1/devices/${lightId}/schedule`)
            .set('Authorization', `Bearer ${token}`)
            .send({
                time: '06:30',
                action: 'on',
                days: ['weekdays'],
                enabled: true
            });
        
        expect(scheduleRes.status).toBe(200);
        expect(scheduleRes.body.data.schedule).toBeDefined();
    });

    test('Should group devices', async () => {
        const groupRes = await request(app)
            .post('/api/v1/devices/groups')
            .set('Authorization', `Bearer ${token}`)
            .send({
                name: 'Living Room',
                deviceIds: [deviceIds[0], deviceIds[3]],
                scene: { light: 80, ac: 22 }
            });
        
        expect(groupRes.status).toBe(200);
        expect(groupRes.body.data.name).toBe('Living Room');

        // Control group
        const controlRes = await request(app)
            .post('/api/v1/devices/groups/living-room/on')
            .set('Authorization', `Bearer ${token}`);
        
        expect(controlRes.status).toBe(200);
    });

    test('Should log device activity', async () => {
        // Perform actions
        await request(app)
            .post(`/api/v1/devices/${deviceIds[0]}/toggle`)
            .set('Authorization', `Bearer ${token}`);
        
        // Get activity log
        const logRes = await request(app)
            .get('/api/v1/activities?entityType=device')
            .set('Authorization', `Bearer ${token}`);
        
        expect(logRes.status).toBe(200);
        expect(logRes.body.data.length).toBeGreaterThan(0);
    });

    test('Should handle device discovery via Bluetooth', async () => {
        const discoverRes = await request(app)
            .post('/api/v1/devices/discover/bluetooth')
            .set('Authorization', `Bearer ${token}`)
            .send({ timeout: 5000 });
        
        expect(discoverRes.status).toBe(200);
        expect(Array.isArray(discoverRes.body.data)).toBe(true);
    });

    test('Should update device firmware', async () => {
        const deviceId = deviceIds[0];
        
        const firmwareRes = await request(app)
            .post(`/api/v1/devices/${deviceId}/firmware`)
            .set('Authorization', `Bearer ${token}`)
            .send({ version: '2.0.0', force: false });
        
        expect(firmwareRes.status).toBe(200);
        expect(firmwareRes.body.data.status).toBeDefined();
    });
});