const request = require('supertest');
const { app } = require('../../app');
const Automation = require('../../models/Automation');

describe('Automation Tests', () => {
    let token;
    let ruleId;

    beforeAll(async () => {
        const res = await request(app)
            .post('/api/v1/auth/login')
            .send({ email: 'test@example.com', password: 'Test@123456' });
        token = res.body.data.token;
    });

    describe('POST /api/v1/automations', () => {
        it('should create automation rule', async () => {
            const res = await request(app)
                .post('/api/v1/automations')
                .set('Authorization', `Bearer ${token}`)
                .send({
                    name: 'Test Rule',
                    trigger: { type: 'schedule', config: { time: '07:00', days: [1,2,3,4,5] } },
                    action: { type: 'device_on', config: { deviceId: 'test' } },
                    enabled: true
                });
            
            expect(res.statusCode).toBe(201);
            ruleId = res.body.data._id;
        });
    });

    describe('POST /api/v1/automations/:id/toggle', () => {
        it('should toggle automation', async () => {
            const res = await request(app)
                .post(`/api/v1/automations/${ruleId}/toggle`)
                .set('Authorization', `Bearer ${token}`)
                .send({ enabled: false });
            
            expect(res.statusCode).toBe(200);
            expect(res.body.data.enabled).toBe(false);
        });
    });
});