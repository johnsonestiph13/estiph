/**
 * ESTIF HOME ULTIMATE - MQTT SERVICE
 * MQTT protocol communication for IoT device integration
 * Version: 2.0.0
 */

const mqtt = require('mqtt');
const Device = require('../../models/Device');
const { logger } = require('../../utils/logger');

class MQTTService {
    constructor() {
        this.client = null;
        this.isConnected = false;
        this.subscriptions = new Map();
        this.messageHandlers = new Map();
    }

    initialize() {
        if (!process.env.MQTT_BROKER) {
            logger.warn('MQTT broker not configured, skipping MQTT initialization');
            return null;
        }

        const options = {
            username: process.env.MQTT_USERNAME,
            password: process.env.MQTT_PASSWORD,
            keepalive: 60,
            reconnectPeriod: 5000,
            connectTimeout: 30000,
            will: {
                topic: 'estif/status',
                payload: JSON.stringify({ status: 'offline', timestamp: Date.now() }),
                qos: 1,
                retain: true
            },
            clientId: `estif_backend_${Math.random().toString(16).substr(2, 8)}`
        };

        this.client = mqtt.connect(process.env.MQTT_BROKER, options);

        this.client.on('connect', () => {
            this.isConnected = true;
            logger.info('MQTT connected to broker');
            this.subscribeToTopics();
        });

        this.client.on('error', (error) => {
            logger.error('MQTT error:', error);
            this.isConnected = false;
        });

        this.client.on('reconnect', () => {
            logger.info('MQTT reconnecting...');
        });

        this.client.on('offline', () => {
            logger.warn('MQTT offline');
            this.isConnected = false;
        });

        this.client.on('message', (topic, message) => {
            this.handleMessage(topic, message);
        });

        return this.client;
    }

    subscribeToTopics() {
        const topics = [
            'estif/device/+/state',
            'estif/device/+/command',
            'estif/device/+/telemetry',
            'estif/esp32/+/status',
            'estif/sensor/+/data',
            'estif/system/broadcast'
        ];

        topics.forEach(topic => {
            this.client.subscribe(topic, { qos: 1 }, (err) => {
                if (err) {
                    logger.error(`Failed to subscribe to ${topic}:`, err);
                } else {
                    logger.debug(`Subscribed to ${topic}`);
                    this.subscriptions.set(topic, true);
                }
            });
        });
    }

    async handleMessage(topic, message) {
        try {
            let payload;
            try {
                payload = JSON.parse(message.toString());
            } catch {
                payload = message.toString();
            }

            logger.debug(`MQTT message received on ${topic}:`, payload);

            const topicParts = topic.split('/');
            
            if (topic.startsWith('estif/device/')) {
                await this.handleDeviceMessage(topicParts, payload);
            } else if (topic.startsWith('estif/esp32/')) {
                await this.handleESP32Message(topicParts, payload);
            } else if (topic.startsWith('estif/sensor/')) {
                await this.handleSensorMessage(topicParts, payload);
            }

            if (this.messageHandlers.has(topic)) {
                const handlers = this.messageHandlers.get(topic);
                handlers.forEach(handler => handler(payload, topic));
            }
        } catch (error) {
            logger.error('MQTT message handling error:', error);
        }
    }

    async handleDeviceMessage(topicParts, payload) {
        const deviceId = topicParts[2];
        const messageType = topicParts[3];

        const device = await Device.findOne({ _id: deviceId });
        if (!device) return;

        switch (messageType) {
            case 'state':
                if (payload.state !== undefined && !device.autoMode) {
                    device.state = payload.state;
                    device.lastStateChange = Date.now();
                    await device.save();
                    logger.info(`Device ${device.name} state updated to ${payload.state}`);
                }
                break;
            case 'telemetry':
                device.metadata = { ...device.metadata, ...payload };
                device.lastSeen = Date.now();
                await device.save();
                break;
        }
    }

    async handleESP32Message(topicParts, payload) {
        const esp32Id = topicParts[2];
        const messageType = topicParts[3];

        logger.debug(`ESP32 ${esp32Id} ${messageType}:`, payload);

        if (messageType === 'status') {
            await Device.updateOne(
                { mac: esp32Id },
                { online: payload.status === 'online', lastSeen: Date.now() }
            );
        }
    }

    async handleSensorMessage(topicParts, payload) {
        const sensorId = topicParts[2];
        const dataType = topicParts[3];

        logger.debug(`Sensor ${sensorId} data:`, payload);

        // Broadcast sensor data to WebSocket clients
        const webSocketService = require('./websocketService');
        webSocketService.broadcast('sensor_data', {
            sensorId,
            type: dataType,
            data: payload,
            timestamp: Date.now()
        });
    }

    async publishDeviceState(deviceId, state) {
        if (!this.isConnected) return false;

        const topic = `estif/device/${deviceId}/command`;
        const payload = JSON.stringify({ command: 'set_state', state, timestamp: Date.now() });

        return new Promise((resolve) => {
            this.client.publish(topic, payload, { qos: 1 }, (error) => {
                if (error) {
                    logger.error(`Failed to publish device state: ${error.message}`);
                    resolve(false);
                } else {
                    resolve(true);
                }
            });
        });
    }

    async publishDeviceCommand(deviceId, command, params = {}) {
        if (!this.isConnected) return false;

        const topic = `estif/device/${deviceId}/command`;
        const payload = JSON.stringify({ command, ...params, timestamp: Date.now() });

        return new Promise((resolve) => {
            this.client.publish(topic, payload, { qos: 1 }, (error) => {
                if (error) {
                    logger.error(`Failed to publish device command: ${error.message}`);
                    resolve(false);
                } else {
                    resolve(true);
                }
            });
        });
    }

    subscribe(topic, handler) {
        if (!this.messageHandlers.has(topic)) {
            this.messageHandlers.set(topic, []);
        }
        this.messageHandlers.get(topic).push(handler);
        
        if (this.isConnected) {
            this.client.subscribe(topic);
        }
        
        return () => this.unsubscribe(topic, handler);
    }

    unsubscribe(topic, handler) {
        if (this.messageHandlers.has(topic)) {
            const handlers = this.messageHandlers.get(topic);
            const index = handlers.indexOf(handler);
            if (index !== -1) handlers.splice(index, 1);
            if (handlers.length === 0) {
                this.messageHandlers.delete(topic);
                this.client.unsubscribe(topic);
            }
        }
    }

    isConnected() {
        return this.isConnected && this.client?.connected;
    }

    getStatus() {
        return {
            connected: this.isConnected,
            subscriptions: Array.from(this.subscriptions.keys()),
            messageHandlers: this.messageHandlers.size
        };
    }

    close() {
        if (this.client) {
            this.client.end();
            logger.info('MQTT service closed');
        }
    }
}

module.exports = new MQTTService();