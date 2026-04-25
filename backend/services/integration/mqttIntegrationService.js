/**
 * ESTIF HOME ULTIMATE - MQTT INTEGRATION SERVICE
 * External MQTT broker integration
 * Version: 2.0.0
 */

const mqtt = require('mqtt');
const { logger } = require('../../utils/logger');

class MQTTIntegrationService {
    constructor() {
        this.clients = new Map();
    }

    connect(brokerUrl, options = {}) {
        const client = mqtt.connect(brokerUrl, options);
        
        client.on('connect', () => {
            logger.info(`MQTT connected: ${brokerUrl}`);
            this.clients.set(brokerUrl, client);
        });
        
        client.on('error', (error) => {
            logger.error(`MQTT error for ${brokerUrl}:`, error);
        });
        
        return client;
    }

    disconnect(brokerUrl) {
        const client = this.clients.get(brokerUrl);
        if (client) client.end();
        this.clients.delete(brokerUrl);
    }

    publish(brokerUrl, topic, message, options = {}) {
        const client = this.clients.get(brokerUrl);
        if (client && client.connected) {
            client.publish(topic, JSON.stringify(message), options);
            return true;
        }
        return false;
    }

    subscribe(brokerUrl, topic, callback) {
        const client = this.clients.get(brokerUrl);
        if (client && client.connected) {
            client.subscribe(topic);
            client.on('message', (receivedTopic, message) => {
                if (receivedTopic === topic) {
                    try {
                        callback(JSON.parse(message.toString()));
                    } catch {
                        callback(message.toString());
                    }
                }
            });
            return true;
        }
        return false;
    }
}

module.exports = new MQTTIntegrationService();