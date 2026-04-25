const request = require('supertest');
const { app } = require('../../app');
const User = require('../../models/User');

describe('User Tests', () => {
    let token;
    let userId;

    beforeAll(async () => {
        const res = await request(app)
            .post('/api/v1/auth/login')
            .send({ email: 'test@example.com', password: 'Test@123456' });
        token = res.body.data.token;
        userId = res.body.data.user.id;
    });

    describe('GET /api/v1/users/me', () => {
        it('should get current user profile', async () => {
            const res = await request(app)
                .get('/api/v1/users/me')
                .set('Authorization', `Bearer ${token}`);
            
            expect(res.statusCode).toBe(200);
            expect(res.body.data).toHaveProperty('email', 'test@example.com');
        });
    });

    describe('PUT /api/v1/users/me', () => {
        it('should update user profile', async () => {
            const res = await request(app)
                .put('/api/v1/users/me')
                .set('Authorization', `Bearer ${token}`)
                .send({ name: 'Updated Name' });
            
            expect(res.statusCode).toBe(200);
            expect(res.body.data.name).toBe('Updated Name');
        });
    });
});