const request = require('supertest');
const { app } = require('../../app');
const Home = require('../../models/Home');
const User = require('../../models/User');

describe('Home Tests', () => {
    let token;
    let homeId;

    beforeAll(async () => {
        const res = await request(app)
            .post('/api/v1/auth/login')
            .send({ email: 'test@example.com', password: 'Test@123456' });
        token = res.body.data.token;
    });

    describe('POST /api/v1/homes', () => {
        it('should create a new home', async () => {
            const res = await request(app)
                .post('/api/v1/homes')
                .set('Authorization', `Bearer ${token}`)
                .send({ name: 'Test Home', address: '123 Test St' });
            
            expect(res.statusCode).toBe(201);
            expect(res.body.data).toHaveProperty('name', 'Test Home');
            homeId = res.body.data._id;
        });
    });

    describe('GET /api/v1/homes/:id', () => {
        it('should get home details', async () => {
            const res = await request(app)
                .get(`/api/v1/homes/${homeId}`)
                .set('Authorization', `Bearer ${token}`);
            
            expect(res.statusCode).toBe(200);
            expect(res.body.data.name).toBe('Test Home');
        });
    });
});