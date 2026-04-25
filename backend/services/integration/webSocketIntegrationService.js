/**
* ESTIF HOME ULTIMATE - WEBSOCKET INTEGRATION SERVICE
* External WebSocket connections for real-time data
* Version: 2.0.0
*/

const WebSocket = require('ws');
const { logger } = require('../../utils/logger');

class WebSocketIntegrationService {
    constructor() {
        this.connections = new Map();
    }

    connect(url, options = {}) {
        const ws = new WebSocket(url, options);
        
        ws.on('open', () => {
            logger.info(`WebSocket connected: ${url}`);
            this.connections.set(url, ws);
        });
        
        ws.on('message', (data) => {
            this.handleMessage(url, data);
        });
        
        ws.on('error', (error) => {
            logger.error(`WebSocket error for ${url}:`, error);
        });
        
        ws.on('close', () => {
            logger.info(`WebSocket closed: ${url}`);
            this.connections.delete(url);
            
            if (options.reconnect !== false) {
                setTimeout(() => this.connect(url, options), 5000);
            }
        });
        
        return ws;
    }

    disconnect(url) {
        const ws = this.connections.get(url);
        if (ws) ws.close();
    }

    send(url, data) {
        const ws = this.connections.get(url);
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(data));
            return true;
        }
        return false;
    }

    handleMessage(url, data) {
        try {
            const parsed = JSON.parse(data);
            logger.debug(`WebSocket message from ${url}:`, parsed);
        } catch {
            logger.debug(`WebSocket message from ${url}:`, data);
        }
    }

    isConnected(url) {
        const ws = this.connections.get(url);
        return ws && ws.readyState === WebSocket.OPEN;
    }
}

module.exports = new WebSocketIntegrationService();