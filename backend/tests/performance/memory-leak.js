/**
 * Memory Leak Detection - Long-running test to detect memory issues
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Counter } from 'k6/metrics';

const memoryTrend = new Trend('memory_mb');
const heapTrend = new Trend('heap_mb');

export const options = {
    stages: [
        { duration: '10m', target: 50 },   // 10 minutes at 50 users
        { duration: '30m', target: 50 },   // 30 minutes sustained
        { duration: '10m', target: 100 },  // 10 minutes at 100 users
        { duration: '30m', target: 100 },  // 30 minutes sustained
        { duration: '10m', target: 0 },    // Cooldown
    ],
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
let authToken = null;

export function setup() {
    const loginRes = http.post(`${BASE_URL}/api/v1/auth/login`, JSON.stringify({
        email: 'memtest@estif.com',
        password: 'Mem123!'
    }), {
        headers: { 'Content-Type': 'application/json' }
    });
    
    return { token: JSON.parse(loginRes.body).data.token };
}

export default function (data) {
    const headers = {
        'Authorization': `Bearer ${data.token}`,
        'Content-Type': 'application/json',
    };
    
    // Mixed operations to simulate real usage
    const operations = [
        () => http.get(`${BASE_URL}/api/v1/devices`, { headers }),
        () => http.get(`${BASE_URL}/api/v1/homes`, { headers }),
        () => http.get(`${BASE_URL}/api/v1/activities?limit=100`, { headers }),
        () => http.post(`${BASE_URL}/api/v1/devices/device_id/toggle`, {}, { headers }),
        () => http.get(`${BASE_URL}/api/v1/devices/stats`, { headers }),
        () => http.get(`${BASE_URL}/api/v1/analytics/energy`, { headers }),
    ];
    
    const operation = operations[Math.floor(Math.random() * operations.length)];
    const res = operation();
    
    check(res, { 'status OK': (r) => r.status < 500 });
    
    // Get memory stats from server
    if (__ITER % 100 === 0) {
        const memRes = http.get(`${BASE_URL}/api/debug/memory`, { headers });
        if (memRes.status === 200) {
            const memData = JSON.parse(memRes.body);
            memoryTrend.add(memData.rss / 1024 / 1024);
            heapTrend.add(memData.heapUsed / 1024 / 1024);
        }
    }
    
    sleep(Math.random() * 2);
}