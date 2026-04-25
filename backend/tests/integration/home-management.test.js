/**
 * Home Management Integration Tests
 * Tests multi-home support, member management, Wi-Fi isolation, and family groups
 */

const request = require('supertest');
const mongoose = require('mongoose');
const { app } = require('../../app');
const User = require('../../models/User');
const Home = require('../../models/Home');
const Device = require('../../models/Device');

describe('Home Management Tests', () => {
    let ownerToken, ownerId;
    let memberToken, memberId;
    let homeId;

    beforeAll(async () => {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/estif_test');
    });

    afterAll(async () => {
        await mongoose.connection.dropDatabase();
        await mongoose.disconnect();
    });

    beforeEach(async () => {
        await User.deleteMany({});
        await Home.deleteMany({});
        await Device.deleteMany({});

        // Create owner
        const ownerRes = await request(app)
            .post('/api/v1/auth/register')
            .send({ name: 'Home Owner', email: 'owner@estif.com', password: 'Owner123!' });
        
        ownerId = ownerRes.body.data.user.id;
        ownerToken = ownerRes.body.data.token;

        // Create member
        const memberRes = await request(app)
            .post('/api/v1/auth/register')
            .send({ name: 'Home Member', email: 'member@estif.com', password: 'Member123!' });
        
        memberId = memberRes.body.data.user.id;
        memberToken = memberRes.body.data.token;

        // Create home
        const homeRes = await request(app)
            .post('/api/v1/homes')
            .set('Authorization', `Bearer ${ownerToken}`)
            .send({ name: 'Main Home', address: '123 Main St' });
        
        homeId = homeRes.body.data.id;
    });

    test('Should create multiple homes for same user', async () => {
        const home2Res = await request(app)
            .post('/api/v1/homes')
            .set('Authorization', `Bearer ${ownerToken}`)
            .send({ name: 'Vacation Home', address: '456 Beach Rd' });
        
        expect(home2Res.status).toBe(201);
        expect(home2Res.body.data.name).toBe('Vacation Home');

        const homesRes = await request(app)
            .get('/api/v1/homes')
            .set('Authorization', `Bearer ${ownerToken}`);
        
        expect(homesRes.status).toBe(200);
        expect(homesRes.body.data.length).toBe(2);
    });

    test('Should add member to home with role', async () => {
        const addRes = await request(app)
            .post(`/api/v1/homes/${homeId}/members`)
            .set('Authorization', `Bearer ${ownerToken}`)
            .send({ email: 'member@estif.com', role: 'member' });
        
        expect(addRes.status).toBe(200);
        expect(addRes.body.data.members.length).toBe(2);

        // Member can view home
        const memberHomeRes = await request(app)
            .get(`/api/v1/homes/${homeId}`)
            .set('Authorization', `Bearer ${memberToken}`);
        
        expect(memberHomeRes.status).toBe(200);
    });

    test('Should enforce Wi-Fi isolation between homes', async () => {
        // Create device in home
        await request(app)
            .post('/api/v1/devices')
            .set('Authorization', `Bearer ${ownerToken}`)
            .send({ name: 'Light', type: 'light', gpio: 23, homeId });
        
        // Member from other home cannot access
        const otherHome = await request(app)
            .post('/api/v1/homes')
            .set('Authorization', `Bearer ${memberToken}`)
            .send({ name: 'Other Home' });
        
        const accessRes = await request(app)
            .get(`/api/v1/devices?homeId=${homeId}`)
            .set('Authorization', `Bearer ${memberToken}`);
        
        expect(accessRes.body.data.length).toBe(0);
    });

    test('Should inherit device permissions from home role', async () => {
        // Add member to home
        await request(app)
            .post(`/api/v1/homes/${homeId}/members`)
            .set('Authorization', `Bearer ${ownerToken}`)
            .send({ email: 'member@estif.com', role: 'member' });
        
        // Owner creates device
        const deviceRes = await request(app)
            .post('/api/v1/devices')
            .set('Authorization', `Bearer ${ownerToken}`)
            .send({ name: 'AC', type: 'ac', gpio: 19, homeId });
        
        const deviceId = deviceRes.body.data.id;

        // Member can view device
        const viewRes = await request(app)
            .get(`/api/v1/devices/${deviceId}`)
            .set('Authorization', `Bearer ${memberToken}`);
        
        expect(viewRes.status).toBe(200);

        // Member can control device
        const controlRes = await request(app)
            .post(`/api/v1/devices/${deviceId}/toggle`)
            .set('Authorization', `Bearer ${memberToken}`);
        
        expect(controlRes.status).toBe(200);
    });

    test('Should not allow member to delete home', async () => {
        // Add member
        await request(app)
            .post(`/api/v1/homes/${homeId}/members`)
            .set('Authorization', `Bearer ${ownerToken}`)
            .send({ email: 'member@estif.com', role: 'member' });
        
        // Member tries to delete
        const deleteRes = await request(app)
            .delete(`/api/v1/homes/${homeId}`)
            .set('Authorization', `Bearer ${memberToken}`);
        
        expect(deleteRes.status).toBe(403);
    });

    test('Should transfer home ownership', async () => {
        // Add member as admin
        await request(app)
            .post(`/api/v1/homes/${homeId}/members`)
            .set('Authorization', `Bearer ${ownerToken}`)
            .send({ email: 'member@estif.com', role: 'admin' });
        
        // Transfer ownership
        const transferRes = await request(app)
            .post(`/api/v1/homes/${homeId}/transfer`)
            .set('Authorization', `Bearer ${ownerToken}`)
            .send({ newOwnerEmail: 'member@estif.com' });
        
        expect(transferRes.status).toBe(200);
        expect(transferRes.body.data.ownerId).toBe(memberId);
    });

    test('Should remove member from home', async () => {
        // Add member
        await request(app)
            .post(`/api/v1/homes/${homeId}/members`)
            .set('Authorization', `Bearer ${ownerToken}`)
            .send({ email: 'member@estif.com', role: 'member' });
        
        // Remove member
        const removeRes = await request(app)
            .delete(`/api/v1/homes/${homeId}/members/${memberId}`)
            .set('Authorization', `Bearer ${ownerToken}`);
        
        expect(removeRes.status).toBe(200);
        expect(removeRes.body.data.members.length).toBe(1);

        // Member cannot access
        const accessRes = await request(app)
            .get(`/api/v1/homes/${homeId}`)
            .set('Authorization', `Bearer ${memberToken}`);
        
        expect(accessRes.status).toBe(403);
    });

    test('Should get home activity for all members', async () => {
        // Add member
        await request(app)
            .post(`/api/v1/homes/${homeId}/members`)
            .set('Authorization', `Bearer ${ownerToken}`)
            .send({ email: 'member@estif.com', role: 'member' });
        
        // Owner creates device
        await request(app)
            .post('/api/v1/devices')
            .set('Authorization', `Bearer ${ownerToken}`)
            .send({ name: 'Light', type: 'light', gpio: 23, homeId });
        
        // Member toggles device
        const deviceRes = await request(app)
            .get('/api/v1/devices')
            .set('Authorization', `Bearer ${memberToken}`);
        
        const deviceId = deviceRes.body.data[0].id;
        
        await request(app)
            .post(`/api/v1/devices/${deviceId}/toggle`)
            .set('Authorization', `Bearer ${memberToken}`);
        
        // Get home activity
        const activityRes = await request(app)
            .get(`/api/v1/homes/${homeId}/activities`)
            .set('Authorization', `Bearer ${ownerToken}`);
        
        expect(activityRes.status).toBe(200);
        expect(activityRes.body.data.length).toBeGreaterThan(0);
    });

    test('Should manage multiple Wi-Fi networks per home', async () => {
        const wifiRes = await request(app)
            .post(`/api/v1/homes/${homeId}/wifi`)
            .set('Authorization', `Bearer ${ownerToken}`)
            .send({
                ssid: 'HomeWiFi',
                password: 'wifi123',
                encryption: 'WPA2',
                isPrimary: true
            });
        
        expect(wifiRes.status).toBe(200);
        expect(wifiRes.body.data.ssid).toBe('HomeWiFi');
    });
});