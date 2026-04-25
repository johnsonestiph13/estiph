const request = require('supertest');
const { app } = require('../../app');
const EnergyLog = require('../../models/EnergyLog');

describe('Energy Tests', () => {
    let token;

    beforeAll(async () => {
        const res = await request(app)
            .post('/api/v1/auth/login')
            .send({ email: 'test@example.com', password: 'Test@123456' });
        token = res.body.data.token;
        
        await EnergyLog.create({
            userId: res.body.data.user.id,
            deviceId: 'test',
            energyConsumed: 10.5,
            power: 100,
            runtime: 3600000,
            timestamp: new Date()
        });
    });

    describe('GET /api/v1/energy/consumption', () => {
        it('should get energy consumption', async () => {
            const res = await request(app)
                .get('/api/v1/energy/consumption')
                .set('Authorization', `Bearer ${token}`);
            
            expect(res.statusCode).toBe(200);
            expect(res.body.success).toBe(true);
        });
    });
});