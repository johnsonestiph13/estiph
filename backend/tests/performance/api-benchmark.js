/**
 * API Benchmark Testing - Measures response times for critical endpoints
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Rate } from 'k6/metrics';

const benchmarkResults = {};

const endpoints = [
    { name: 'Health Check', method: 'GET', path: '/api/health' },
    { name: 'User Login', method: 'POST', path: '/api/v1/auth/login', body: { email: 'bench@estif.com', password: 'Bench123!' } },
    { name: 'Get Devices', method: 'GET', path: '/api/v1/devices' },
    { name: 'Get Homes', method: 'GET', path: '/api/v1/homes' },
    { name: 'Get Activities', method: 'GET', path: '/api/v1/activities?limit=20' },
    { name: 'Toggle Device', method: 'POST', path: '/api/v1/devices/:id/toggle' },
];

export const options = {
    vus: 10,
    duration: '30s',
    thresholds: {
        'benchmark_duration': ['p(95)<200'],
    },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export function setup() {
    // Create test data
    const registerRes = http.post(`${BASE_URL}/api/v1/auth/register`, JSON.stringify({
        name: 'Benchmark User',
        email: 'bench@estif.com',
        password: 'Bench123!'
    }), {
        headers: { 'Content-Type': 'application/json' }
    });
    
    const loginRes = http.post(`${BASE_URL}/api/v1/auth/login`, JSON.stringify({
        email: 'bench@estif.com',
        password: 'Bench123!'
    }), {
        headers: { 'Content-Type': 'application/json' }
    });
    
    const token = JSON.parse(loginRes.body).data.token;
    
    // Create device
    const deviceRes = http.post(`${BASE_URL}/api/v1/devices`, JSON.stringify({
        name: 'Bench Light',
        type: 'light',
        gpio: 23
    }), {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    });
    
    const deviceId = JSON.parse(deviceRes.body).data.id;
    
    return { token, deviceId };
}

export default function (data) {
    const headers = {
        'Authorization': `Bearer ${data.token}`,
        'Content-Type': 'application/json',
    };
    
    // Benchmark each endpoint
    for (const endpoint of endpoints) {
        let url = `${BASE_URL}${endpoint.path}`;
        if (endpoint.path.includes(':id')) {
            url = url.replace(':id', data.deviceId);
        }
        
        let res;
        const startTime = Date.now();
        
        if (endpoint.method === 'GET') {
            res = http.get(url, { headers });
        } else {
            res = http.post(url, JSON.stringify(endpoint.body || {}), { headers });
        }
        
        const duration = Date.now() - startTime;
        
        check(res, {
            [`${endpoint.name} status OK`]: (r) => r.status === 200 || r.status === 201,
        });
        
        // Record benchmark
        console.log(`${endpoint.name}: ${duration}ms`);
    }
    
    sleep(1);
}

export function teardown(data) {
    console.log('API Benchmark completed');
}