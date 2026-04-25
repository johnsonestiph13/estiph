const request = require('supertest');
const { app } = require('../../app');
const Device = require('../../models/Device');
const User = require('../../models/User');

describe('Device Tests', () => {
    let token;
    let deviceId;

    beforeAll(async () => {
        const user = await User.findOne({ email: 'test@example.com' });
        const res = await request(app)
            .post('/api/v1/auth/login')
            .send({ email: 'test@example.com', password: 'Test@123456' });
        token = res.body.data.token;
    });

    describe('POST /api/v1/devices', () => {
        it('should create a new device', async () => {
            const res = await request(app)
                .post('/api/v1/devices')
                .set('Authorization', `Bearer ${token}`)
                .send({
                    name: 'Test Light',
                    type: 'light',
                    room: 'Living Room',
                    gpio: 23,
                    power: 10
                });
            
            expect(res.statusCode).toBe(201);
            expect(res.body.data).toHaveProperty('name', 'Test Light');
            deviceId = res.body.data._id;
        });
    });

    describe('POST /api/v1/devices/:id/toggle', () => {
        it('should toggle device state', async () => {
            const res = await request(app)
                .post(`/api/v1/devices/${deviceId}/toggle`)
                .set('Authorization', `Bearer ${token}`)
                .send({ state: true });
            
            expect(res.statusCode).toBe(200);
            expect(res.body.data.state).toBe(true);
        });
    });
});