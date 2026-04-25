/**
 * Stress Testing - Pushes system beyond normal limits
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const errorRate = new Rate('error_rate');
const responseTime = new Trend('response_time');

export const options = {
    stages: [
        { duration: '1m', target: 500 },   // Rapid ramp to 500 users
        { duration: '2m', target: 1000 },  // Spike to 1000 users
        { duration: '1m', target: 2000 },  // Extreme load
        { duration: '30s', target: 0 },    // Sudden stop
    ],
    thresholds: {
        http_req_duration: ['p(95)<2000'], // Allow higher latency under stress
        error_rate: ['rate<0.10'], // Allow 10% error rate
    },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export default function () {
    const batch = http.batch([
        ['GET', `${BASE_URL}/api/health`, null, { tags: { name: 'health' } }],
        ['GET', `${BASE_URL}/api/v1/devices`, null, { tags: { name: 'devices' } }],
        ['GET', `${BASE_URL}/api/v1/homes`, null, { tags: { name: 'homes' } }],
    ]);
    
    batch.forEach(res => {
        const success = res.status >= 200 && res.status < 400;
        errorRate.add(!success);
        responseTime.add(res.timings.duration);
        
        check(res, {
            'status is not 500': (r) => r.status !== 500,
        });
    });
    
    sleep(0.1);
}