/**
 * Schedule Execution E2E Tests
 * Tests scheduled tasks, cron jobs, and time-based automations
 */

const request = require('supertest');
const mongoose = require('mongoose');
const { app } = require('../../app');

describe('Schedule Execution E2E Tests', () => {
    let token, deviceId, scheduleId;

    beforeAll(async () => {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/estif_test');
        
        const register = await request(app)
            .post('/api/v1/auth/register')
            .send({ name: 'Schedule User', email: 'schedule@test.com', password: 'Schedule123!' });
        token = register.body.data.token;

        const device = await request(app)
            .post('/api/v1/devices')
            .set('Authorization', `Bearer ${token}`)
            .send({ name: 'Schedule Light', type: 'light', gpio: 23 });
        deviceId = device.body.data.id;
    });

    afterAll(async () => {
        await mongoose.connection.dropDatabase();
        await mongoose.disconnect();
    });

    test('Create schedule for device', async () => {
        const res = await request(app)
            .post(`/api/v1/devices/${deviceId}/schedule`)
            .set('Authorization', `Bearer ${token}`)
            .send({
                name: 'Morning ON',
                time: '06:30',
                days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
                action: 'on',
                enabled: true
            });
        
        expect(res.status).toBe(200);
        scheduleId = res.body.data.id;
    });

    test('Get all schedules', async () => {
        const res = await request(app)
            .get('/api/v1/schedules')
            .set('Authorization', `Bearer ${token}`);
        
        expect(res.status).toBe(200);
        expect(res.body.data.length).toBeGreaterThan(0);
    });

    test('Update schedule', async () => {
        const res = await request(app)
            .put(`/api/v1/schedules/${scheduleId}`)
            .set('Authorization', `Bearer ${token}`)
            .send({ time: '07:00', enabled: true });
        
        expect(res.status).toBe(200);
        expect(res.body.data.time).toBe('07:00');
    });

    test('Disable schedule', async () => {
        const res = await request(app)
            .patch(`/api/v1/schedules/${scheduleId}/disable`)
            .set('Authorization', `Bearer ${token}`);
        
        expect(res.status).toBe(200);
        expect(res.body.data.enabled).toBe(false);
    });

    test('Delete schedule', async () => {
        const res = await request(app)
            .delete(`/api/v1/schedules/${scheduleId}`)
            .set('Authorization', `Bearer ${token}`);
        
        expect(res.status).toBe(200);
    });
});