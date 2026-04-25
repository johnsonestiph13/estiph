/**
 * Scalability Testing - Tests horizontal scaling capabilities
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const successRate = new Rate('success_rate');
const responseTime = new Trend('response_time');

export const options = {
    scenarios: {
        // Test with different user loads
        low_load: {
            executor: 'constant-vus',
            vus: 10,
            duration: '1m',
            startTime: '0s',
        },
        medium_load: {
            executor: 'constant-vus',
            vus: 50,
            duration: '1m',
            startTime: '2m',
        },
        high_load: {
            executor: 'constant-vus',
            vus: 200,
            duration: '1m',
            startTime: '4m',
        },
        extreme_load: {
            executor: 'constant-vus',
            vus: 500,
            duration: '1m',
            startTime: '6m',
        },
    },
    thresholds: {
        response_time: [
            { threshold: 'p(95)<200', abortOnFail: true, delayAbortEval: '10s' },
        ],
    },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const SECONDARY_URL = __ENV.SECONDARY_URL || 'http://localhost:3001';

export default function () {
    // Distribute load across multiple instances
    const urls = [BASE_URL, SECONDARY_URL];
    const url = urls[Math.floor(Math.random() * urls.length)];
    
    const start = Date.now();
    const res = http.get(`${url}/api/health`);
    const latency = Date.now() - start;
    
    responseTime.add(latency);
    successRate.add(res.status === 200);
    
    check(res, {
        'health check passed': (r) => r.status === 200,
        'response consistent': (r) => {
            const body = JSON.parse(r.body);
            return body.status === 'healthy';
        },
    });
    
    // Measure throughput
    const batchRes = http.batch([
        ['GET', `${url}/api/v1/devices`],
        ['GET', `${url}/api/v1/homes`],
        ['GET', `${url}/api/v1/activities?limit=20`],
    ]);
    
    batchRes.forEach(r => {
        successRate.add(r.status === 200);
    });
    
    sleep(0.5);
}

export function handleSummary(data) {
    const summary = {
        timestamp: new Date().toISOString(),
        metrics: {
            total_requests: data.metrics.http_reqs.values.count,
            success_rate: data.metrics.success_rate.values.rate,
            avg_response_time: data.metrics.response_time.values.avg,
            p95_response_time: data.metrics.response_time.values['p(95)'],
        },
        scalability_score: calculateScalabilityScore(data),
    };
    
    console.log(JSON.stringify(summary, null, 2));
    return { 'scalability-report.json': JSON.stringify(summary) };
}

function calculateScalabilityScore(data) {
    const successRate = data.metrics.success_rate.values.rate;
    const responseTime = data.metrics.response_time.values['p(95)'];
    
    if (successRate > 0.99 && responseTime < 200) return 100;
    if (successRate > 0.95 && responseTime < 500) return 80;
    if (successRate > 0.90 && responseTime < 1000) return 60;
    return 40;
}