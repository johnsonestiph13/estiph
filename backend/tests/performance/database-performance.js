/**
 * Database Performance Testing - Tests query optimization and indexing
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Rate } from 'k6/metrics';

const queryTime = new Trend('query_time');
const writeTime = new Trend('write_time');

export const options = {
    vus: 20,
    duration: '1m',
    thresholds: {
        query_time: ['p(95)<100'], // 95% queries under 100ms
        write_time: ['p(95)<150'], // 95% writes under 150ms
    },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
let authToken = null;

export function setup() {
    const loginRes = http.post(`${BASE_URL}/api/v1/auth/login`, JSON.stringify({
        email: 'dbperf@estif.com',
        password: 'Db123!'
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
    
    // Test complex queries
    const complexQueryStart = Date.now();
    const devicesRes = http.get(`${BASE_URL}/api/v1/devices?filter=active&sort=name&limit=100`, { headers });
    queryTime.add(Date.now() - complexQueryStart);
    
    // Test pagination
    const paginationStart = Date.now();
    const paginatedRes = http.get(`${BASE_URL}/api/v1/devices?page=1&limit=50`, { headers });
    queryTime.add(Date.now() - paginationStart);
    
    // Test search
    const searchStart = Date.now();
    const searchRes = http.get(`${BASE_URL}/api/v1/devices?search=light`, { headers });
    queryTime.add(Date.now() - searchStart);
    
    // Test aggregation
    const statsStart = Date.now();
    const statsRes = http.get(`${BASE_URL}/api/v1/devices/stats`, { headers });
    queryTime.add(Date.now() - statsStart);
    
    // Test bulk write
    if (Math.random() > 0.8) {
        const writeStart = Date.now();
        const activityRes = http.post(`${BASE_URL}/api/v1/activities`, JSON.stringify({
            action: 'performance_test',
            details: { test: 'database_performance' }
        }), { headers });
        writeTime.add(Date.now() - writeStart);
    }
    
    sleep(0.5);
}