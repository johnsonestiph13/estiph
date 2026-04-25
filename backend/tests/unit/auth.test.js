const request = require('supertest');
const mongoose = require('mongoose');
const { app } = require('../../app');
const User = require('../../models/User');

describe('Authentication Tests', () => {
    let testUser = {
        name: 'Test User',
        email: 'test@example.com',
        password: 'Test@123456'
    };

    beforeAll(async () => {
        await mongoose.connect(process.env.MONGODB_URI_TEST);
        await User.deleteMany({});
    });

    afterAll(async () => {
        await mongoose.connection.close();
    });

    describe('POST /api/v1/auth/register', () => {
        it('should register a new user', async () => {
            const res = await request(app)
                .post('/api/v1/auth/register')
                .send(testUser);
            
            expect(res.statusCode).toBe(201);
            expect(res.body.success).toBe(true);
            expect(res.body.data.user).toHaveProperty('email', testUser.email);
        });

        it('should not register with existing email', async () => {
            const res = await request(app)
                .post('/api/v1/auth/register')
                .send(testUser);
            
            expect(res.statusCode).toBe(400);
            expect(res.body.success).toBe(false);
        });
    });

    describe('POST /api/v1/auth/login', () => {
        it('should login with correct credentials', async () => {
            const res = await request(app)
                .post('/api/v1/auth/login')
                .send({ email: testUser.email, password: testUser.password });
            
            expect(res.statusCode).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toHaveProperty('token');
        });

        it('should not login with wrong password', async () => {
            const res = await request(app)
                .post('/api/v1/auth/login')
                .send({ email: testUser.email, password: 'wrong' });
            
            expect(res.statusCode).toBe(401);
        });
    });
});