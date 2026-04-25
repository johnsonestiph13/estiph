/**
 * Load Testing - Simulates multiple users accessing the system concurrently
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

const errorRate = new Rate('error_rate');
const responseTime = new Trend('response_time');
const requestsTotal = new Counter('requests_total');

export const options = {
    stages: [
        { duration: '30s', target: 50 },   // Ramp up to 50 users
        { duration: '1m', target: 100 },   // Ramp to 100 users
        { duration: '2m', target: 200 },   // Peak load
        { duration: '1m', target: 100 },   // Ramp down
        { duration: '30s', target: 0 },    // Scale to 0
    ],
    thresholds: {
        http_req_duration: ['p(95)<500', 'p(99)<1000'], // 95% under 500ms
        error_rate: ['rate<0.05'], // Error rate below 5%
    },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
let authToken = null;

export function setup() {
    // Login once before tests
    const loginRes = http.post(`${BASE_URL}/api/v1/auth/login`, JSON.stringify({
        email: 'loadtest@estif.com',
        password: 'Load123!'
    }), {
        headers: { 'Content-Type': 'application/json' }
    });
    
    const token = JSON.parse(loginRes.body).data.token;
    return { token };
}

export default function (data) {
    const headers = {
        'Authorization': `Bearer ${data.token}`,
        'Content-Type': 'application/json',
    };
    
    // Simulate user actions
    const actions = ['get_devices', 'toggle_device', 'get_homes', 'get_activity'];
    const action = actions[Math.floor(Math.random() * actions.length)];
    
    let res;
    let start = Date.now();
    
    switch(action) {
        case 'get_devices':
            res = http.get(`${BASE_URL}/api/v1/devices`, { headers });
            break;
        case 'toggle_device':
            res = http.post(`${BASE_URL}/api/v1/devices/device_id/toggle`, {}, { headers });
            break;
        case 'get_homes':
            res = http.get(`${BASE_URL}/api/v1/homes`, { headers });
            break;
        case 'get_activity':
            res = http.get(`${BASE_URL}/api/v1/activities?limit=20`, { headers });
            break;
    }
    
    const duration = Date.now() - start;
    responseTime.add(duration);
    requestsTotal.add(1);
    
    const success = res.status >= 200 && res.status < 400;
    errorRate.add(!success);
    
    check(res, {
        'status is 200': (r) => r.status === 200,
        'response time < 500ms': () => duration < 500,
    });
    
    sleep(Math.random() * 2);
}

export function teardown(data) {
    console.log(`Load test completed. Total requests: ${requestsTotal.value}`);
}