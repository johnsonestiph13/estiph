/**
 * Redis Integration Tests
 * Tests caching, session management, and real-time data storage
 */

const Redis = require('ioredis');
const mongoose = require('mongoose');

describe('Redis Integration Tests', () => {
    let redis;

    beforeAll(async () => {
        redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/estif_test');
    });

    afterAll(async () => {
        await redis.quit();
        await mongoose.disconnect();
    });

    beforeEach(async () => {
        await redis.flushall();
    });

    test('Should cache device state', async () => {
        const deviceId = 'test-device-123';
        const deviceState = { state: true, temperature: 23.5 };
        
        await redis.set(`device:${deviceId}`, JSON.stringify(deviceState), 'EX', 60);
        const cached = await redis.get(`device:${deviceId}`);
        
        expect(JSON.parse(cached)).toEqual(deviceState);
    });

    test('Should store user session', async () => {
        const sessionId = 'session-456';
        const userData = { userId: 'user123', name: 'Test User' };
        
        await redis.set(`session:${sessionId}`, JSON.stringify(userData), 'EX', 3600);
        const session = await redis.get(`session:${sessionId}`);
        
        expect(JSON.parse(session)).toEqual(userData);
    });

    test('Should handle TTL expiration', async () => {
        const key = 'temp-key';
        await redis.set(key, 'value', 'EX', 1);
        
        let value = await redis.get(key);
        expect(value).toBe('value');
        
        await new Promise(resolve => setTimeout(resolve, 1100));
        
        value = await redis.get(key);
        expect(value).toBeNull();
    });

    test('Should increment counters', async () => {
        const counter = await redis.incr('device:online:count');
        expect(counter).toBe(1);
        
        const newCounter = await redis.incr('device:online:count');
        expect(newCounter).toBe(2);
    });

    test('Should store and retrieve hash', async () => {
        await redis.hset('device:stats:123', {
            temperature: 23.5,
            humidity: 65,
            power: 120
        });
        
        const stats = await redis.hgetall('device:stats:123');
        expect(stats.temperature).toBe('23.5');
        expect(stats.humidity).toBe('65');
    });

    test('Should check key existence', async () => {
        await redis.set('existing-key', 'value');
        
        const exists = await redis.exists('existing-key');
        const notExists = await redis.exists('missing-key');
        
        expect(exists).toBe(1);
        expect(notExists).toBe(0);
    });

    test('Should delete keys', async () => {
        await redis.set('key-to-delete', 'value');
        let exists = await redis.exists('key-to-delete');
        expect(exists).toBe(1);
        
        await redis.del('key-to-delete');
        exists = await redis.exists('key-to-delete');
        expect(exists).toBe(0);
    });

    test('Should handle pub/sub', (done) => {
        const channel = 'test-channel';
        
        redis.subscribe(channel, () => {
            redis.publish(channel, JSON.stringify({ message: 'hello' }));
        });
        
        redis.on('message', (ch, message) => {
            expect(ch).toBe(channel);
            expect(JSON.parse(message)).toEqual({ message: 'hello' });
            redis.unsubscribe(channel);
            done();
        });
    });
});