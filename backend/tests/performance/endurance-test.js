/**
 * Endurance Testing - Long duration stability test
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

const errorRate = new Rate('error_rate');
const memoryUsage = new Trend('memory_usage');
const cpuUsage = new Trend('cpu_usage');

export const options = {
    stages: [
        { duration: '5m', target: 100 },   // Steady load
        { duration: '4h', target: 100 },   // 4 hours sustained
        { duration: '5m', target: 0 },     // Cooldown
    ],
    thresholds: {
        http_req_duration: ['p(95)<1000'],
        error_rate: ['rate<0.01'], // Very low error rate for endurance
    },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
let authToken = null;

export function setup() {
    const loginRes = http.post(`${BASE_URL}/api/v1/auth/login`, JSON.stringify({
        email: 'endurance@estif.com',
        password: 'Endure123!'
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
    
    // Simulate realistic user behavior
    const deviceRes = http.get(`${BASE_URL}/api/v1/devices`, { headers });
    check(deviceRes, { 'devices fetched': (r) => r.status === 200 });
    
    // Toggle device occasionally
    if (Math.random() > 0.7) {
        const toggleRes = http.post(`${BASE_URL}/api/v1/devices/device_id/toggle`, {}, { headers });
        check(toggleRes, { 'device toggled': (r) => r.status === 200 });
    }
    
    // Get activity log
    const activityRes = http.get(`${BASE_URL}/api/v1/activities?limit=50`, { headers });
    check(activityRes, { 'activity fetched': (r) => r.status === 200 });
    
    sleep(2);
}