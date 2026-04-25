/**
 * WebSocket Load Testing - Tests real-time connection limits
 */

import ws from 'k6/ws';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const connectionError = new Rate('connection_error');
const messageLatency = new Trend('message_latency');

export const options = {
    stages: [
        { duration: '30s', target: 100 },   // 100 concurrent WS connections
        { duration: '1m', target: 500 },    // 500 connections
        { duration: '2m', target: 1000 },   // 1000 connections peak
        { duration: '30s', target: 0 },     // Close all
    ],
};

const WS_URL = __ENV.WS_URL || 'ws://localhost:3000';
let authToken = null;

export function setup() {
    // Get auth token
    const loginRes = http.post('http://localhost:3000/api/v1/auth/login', JSON.stringify({
        email: 'wsload@estif.com',
        password: 'Ws123!'
    }), {
        headers: { 'Content-Type': 'application/json' }
    });
    
    return { token: JSON.parse(loginRes.body).data.token };
}

export default function (data) {
    const url = `${WS_URL}?token=${data.token}`;
    let startTime;
    
    const res = ws.connect(url, {}, function (socket) {
        socket.on('open', () => {
            console.log('WebSocket connected');
            connectionError.add(false);
            
            // Send messages periodically
            const interval = setInterval(() => {
                startTime = Date.now();
                socket.send(JSON.stringify({
                    type: 'ping',
                    timestamp: startTime
                }));
            }, 1000);
            
            socket.setInterval(() => {
                socket.send(JSON.stringify({
                    type: 'device_control',
                    deviceId: 'test_device',
                    state: Math.random() > 0.5
                }));
            }, 5000);
        });
        
        socket.on('message', (data) => {
            const latency = Date.now() - startTime;
            if (startTime) {
                messageLatency.add(latency);
            }
            
            const msg = JSON.parse(data);
            if (msg.type === 'pong') {
                check(msg, {
                    'pong received': (m) => m.type === 'pong'
                });
            }
        });
        
        socket.on('error', (e) => {
            connectionError.add(true);
            console.error('WebSocket error:', e);
        });
        
        socket.on('close', () => {
            console.log('WebSocket closed');
        });
        
        socket.setTimeout(() => {
            socket.close();
        }, 30000);
    });
    
    check(res, { 'WebSocket connected': (r) => r && r.status === 101 });
    sleep(1);
}