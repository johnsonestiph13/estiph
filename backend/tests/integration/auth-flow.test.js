/**
 * Authentication Flow Integration Tests
 * Tests complete auth lifecycle including 2FA, session management, and permissions
 */

const request = require('supertest');
const mongoose = require('mongoose');
const { app } = require('../../app');
const User = require('../../models/User');
const Session = require('../../models/Session');

describe('Authentication Flow Tests', () => {
    let token, refreshToken, userId;

    beforeAll(async () => {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/estif_test');
    });

    afterAll(async () => {
        await mongoose.connection.dropDatabase();
        await mongoose.disconnect();
    });

    beforeEach(async () => {
        await User.deleteMany({});
        await Session.deleteMany({});
    });

    test('Complete user registration flow', async () => {
        // Step 1: Register
        const registerRes = await request(app)
            .post('/api/v1/auth/register')
            .send({
                name: 'Flow User',
                email: 'flow@estif.com',
                password: 'Flow123!@#',
                confirmPassword: 'Flow123!@#'
            });
        
        expect(registerRes.status).toBe(201);
        expect(registerRes.body.data.user.email).toBe('flow@estif.com');
        userId = registerRes.body.data.user.id;

        // Step 2: Verify email (simulated)
        const verifyRes = await request(app)
            .post('/api/v1/auth/verify-email')
            .send({ email: 'flow@estif.com', code: '123456' });
        
        expect(verifyRes.status).toBe(200);

        // Step 3: Login
        const loginRes = await request(app)
            .post('/api/v1/auth/login')
            .send({ email: 'flow@estif.com', password: 'Flow123!@#' });
        
        expect(loginRes.status).toBe(200);
        expect(loginRes.body.data.token).toBeDefined();
        token = loginRes.body.data.token;
        refreshToken = loginRes.body.data.refreshToken;

        // Step 4: Access protected route
        const profileRes = await request(app)
            .get('/api/v1/users/profile')
            .set('Authorization', `Bearer ${token}`);
        
        expect(profileRes.status).toBe(200);
        expect(profileRes.body.data.email).toBe('flow@estif.com');

        // Step 5: Refresh token
        const refreshRes = await request(app)
            .post('/api/v1/auth/refresh')
            .send({ refreshToken });
        
        expect(refreshRes.status).toBe(200);
        expect(refreshRes.body.data.token).toBeDefined();

        // Step 6: Logout
        const logoutRes = await request(app)
            .post('/api/v1/auth/logout')
            .set('Authorization', `Bearer ${token}`);
        
        expect(logoutRes.status).toBe(200);
    });

    test('2FA enrollment and verification', async () => {
        // Create and login user
        await request(app)
            .post('/api/v1/auth/register')
            .send({ name: '2FA User', email: '2fa@estif.com', password: '2fa123!@#' });
        
        const loginRes = await request(app)
            .post('/api/v1/auth/login')
            .send({ email: '2fa@estif.com', password: '2fa123!@#' });
        
        token = loginRes.body.data.token;

        // Enable 2FA
        const enableRes = await request(app)
            .post('/api/v1/auth/2fa/enable')
            .set('Authorization', `Bearer ${token}`);
        
        expect(enableRes.status).toBe(200);
        expect(enableRes.body.data.secret).toBeDefined();
        expect(enableRes.body.data.qrCode).toBeDefined();

        // Verify 2FA
        const verifyRes = await request(app)
            .post('/api/v1/auth/2fa/verify')
            .set('Authorization', `Bearer ${token}`)
            .send({ code: '123456' });
        
        expect(verifyRes.status).toBe(200);
    });

    test('Password reset flow', async () => {
        // Create user
        await request(app)
            .post('/api/v1/auth/register')
            .send({ name: 'Reset User', email: 'reset@estif.com', password: 'OldPass123!' });

        // Request password reset
        const forgotRes = await request(app)
            .post('/api/v1/auth/forgot-password')
            .send({ email: 'reset@estif.com' });
        
        expect(forgotRes.status).toBe(200);
        expect(forgotRes.body.data.resetToken).toBeDefined();
        const resetToken = forgotRes.body.data.resetToken;

        // Reset password
        const resetRes = await request(app)
            .post('/api/v1/auth/reset-password')
            .send({ token: resetToken, newPassword: 'NewPass123!' });
        
        expect(resetRes.status).toBe(200);

        // Login with new password
        const loginRes = await request(app)
            .post('/api/v1/auth/login')
            .send({ email: 'reset@estif.com', password: 'NewPass123!' });
        
        expect(loginRes.status).toBe(200);
    });

    test('Session management', async () => {
        // Login from multiple devices
        const loginRes = await request(app)
            .post('/api/v1/auth/login')
            .send({ email: 'flow@estif.com', password: 'Flow123!@#' });
        
        const sessionsRes = await request(app)
            .get('/api/v1/auth/sessions')
            .set('Authorization', `Bearer ${loginRes.body.data.token}`);
        
        expect(sessionsRes.status).toBe(200);
        expect(sessionsRes.body.data.length).toBeGreaterThan(0);

        // Revoke session
        const revokeRes = await request(app)
            .delete('/api/v1/auth/sessions/all')
            .set('Authorization', `Bearer ${loginRes.body.data.token}`);
        
        expect(revokeRes.status).toBe(200);
    });

    test('Role-based access control', async () => {
        // Create admin user
        const adminRes = await request(app)
            .post('/api/v1/auth/register')
            .send({ name: 'Admin', email: 'admin@estif.com', password: 'Admin123!' });
        
        // Create regular user
        const userRes = await request(app)
            .post('/api/v1/auth/register')
            .send({ name: 'User', email: 'user@estif.com', password: 'User123!' });

        // Admin can access admin routes
        const adminLogin = await request(app)
            .post('/api/v1/auth/login')
            .send({ email: 'admin@estif.com', password: 'Admin123!' });
        
        const adminRouteRes = await request(app)
            .get('/api/v1/admin/users')
            .set('Authorization', `Bearer ${adminLogin.body.data.token}`);
        
        expect(adminRouteRes.status).toBe(200);

        // Regular user cannot access admin routes
        const userLogin = await request(app)
            .post('/api/v1/auth/login')
            .send({ email: 'user@estif.com', password: 'User123!' });
        
        const forbiddenRes = await request(app)
            .get('/api/v1/admin/users')
            .set('Authorization', `Bearer ${userLogin.body.data.token}`);
        
        expect(forbiddenRes.status).toBe(403);
    });
});