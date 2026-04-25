/**
 * ESTIF HOME ULTIMATE - REALTIME SERVICE
 * Real-time data streaming and event distribution
 * Version: 2.0.0
 */

const { logger } = require('../../utils/logger');
const webSocketService = require('./websocketService');
const mqttService = require('./mqttService');
const pushService = require('./pushService');

class RealtimeService {
    constructor() {
        this.eventSubscribers = new Map();
        this.streams = new Map();
        this.eventHistory = [];
        this.maxHistorySize = 1000;
    }

    emit(event, data, options = {}) {
        const eventData = {
            event,
            data,
            timestamp: Date.now(),
            ...options
        };

        this.storeEventHistory(eventData);

        if (options.broadcast !== false) {
            this.broadcastToWebSocket(event, eventData);
        }

        if (options.mqtt !== false) {
            this.publishToMQTT(event, eventData);
        }

        if (options.push && options.userId) {
            this.sendPushNotification(options.userId, event, data);
        }

        if (this.eventSubscribers.has(event)) {
            const subscribers = this.eventSubscribers.get(event);
            subscribers.forEach(callback => callback(eventData));
        }

        logger.debug(`Realtime event emitted: ${event}`);
        return eventData;
    }

    broadcastToWebSocket(event, data) {
        try {
            webSocketService.broadcast(event, data);
        } catch (error) {
            logger.error(`WebSocket broadcast failed: ${error.message}`);
        }
    }

    publishToMQTT(event, data) {
        try {
            const topic = `estif/event/${event}`;
            mqttService.client?.publish(topic, JSON.stringify(data));
        } catch (error) {
            logger.error(`MQTT publish failed: ${error.message}`);
        }
    }

    async sendPushNotification(userId, event, data) {
        try {
            const title = this.getPushTitle(event);
            const body = this.getPushBody(event, data);
            
            if (title && body) {
                await pushService.sendPushNotification(userId, title, body, { event, ...data });
            }
        } catch (error) {
            logger.error(`Push notification failed: ${error.message}`);
        }
    }

    getPushTitle(event) {
        const titles = {
            device_toggled: 'Device Updated',
            device_added: 'New Device Added',
            automation_triggered: 'Automation Triggered',
            energy_alert: 'Energy Alert',
            security_alert: 'Security Alert',
            backup_completed: 'Backup Completed',
            member_added: 'New Member Added',
            scene_activated: 'Scene Activated'
        };
        return titles[event] || 'Estif Home Update';
    }

    getPushBody(event, data) {
        switch (event) {
            case 'device_toggled':
                return `${data.deviceName} was turned ${data.state ? 'ON' : 'OFF'}`;
            case 'device_added':
                return `${data.deviceName} has been added to your home`;
            case 'automation_triggered':
                return `Automation "${data.automationName}" was triggered`;
            case 'energy_alert':
                return `Energy consumption: ${data.consumption} kWh`;
            case 'security_alert':
                return `Security event: ${data.eventType}`;
            default:
                return null;
        }
    }

    storeEventHistory(eventData) {
        this.eventHistory.unshift(eventData);
        if (this.eventHistory.length > this.maxHistorySize) {
            this.eventHistory.pop();
        }
    }

    subscribe(event, callback) {
        if (!this.eventSubscribers.has(event)) {
            this.eventSubscribers.set(event, []);
        }
        this.eventSubscribers.get(event).push(callback);
        
        return () => this.unsubscribe(event, callback);
    }

    unsubscribe(event, callback) {
        if (this.eventSubscribers.has(event)) {
            const callbacks = this.eventSubscribers.get(event);
            const index = callbacks.indexOf(callback);
            if (index !== -1) callbacks.splice(index, 1);
            if (callbacks.length === 0) {
                this.eventSubscribers.delete(event);
            }
        }
    }

    subscribeToUserEvents(userId, callback) {
        const userEvent = `user:${userId}`;
        return this.subscribe(userEvent, callback);
    }

    subscribeToHomeEvents(homeId, callback) {
        const homeEvent = `home:${homeId}`;
        return this.subscribe(homeEvent, callback);
    }

    subscribeToDeviceEvents(deviceId, callback) {
        const deviceEvent = `device:${deviceId}`;
        return this.subscribe(deviceEvent, callback);
    }

    emitToUser(userId, event, data) {
        const userEvent = `user:${userId}`;
        return this.emit(userEvent, data, { broadcast: true, userId });
    }

    emitToHome(homeId, event, data) {
        const homeEvent = `home:${homeId}`;
        return this.emit(homeEvent, data);
    }

    emitToDevice(deviceId, event, data) {
        const deviceEvent = `device:${deviceId}`;
        return this.emit(deviceEvent, data);
    }

    createStream(streamId, options = {}) {
        const stream = {
            id: streamId,
            events: [],
            subscribers: new Set(),
            isActive: true,
            createdAt: Date.now(),
            ...options
        };
        
        this.streams.set(streamId, stream);
        return stream;
    }

    subscribeToStream(streamId, callback) {
        const stream = this.streams.get(streamId);
        if (!stream) return null;
        
        stream.subscribers.add(callback);
        
        // Send existing events
        stream.events.forEach(event => callback(event));
        
        return () => {
            stream.subscribers.delete(callback);
            if (stream.subscribers.size === 0 && stream.autoCleanup) {
                this.streams.delete(streamId);
            }
        };
    }

    pushToStream(streamId, data) {
        const stream = this.streams.get(streamId);
        if (!stream) return false;
        
        const eventData = {
            ...data,
            streamId,
            timestamp: Date.now()
        };
        
        stream.events.push(eventData);
        
        if (stream.events.length > (stream.maxSize || 100)) {
            stream.events.shift();
        }
        
        stream.subscribers.forEach(callback => callback(eventData));
        
        return true;
    }

    getEventHistory(event, limit = 100) {
        if (event) {
            return this.eventHistory.filter(e => e.event === event).slice(0, limit);
        }
        return this.eventHistory.slice(0, limit);
    }

    clearEventHistory() {
        this.eventHistory = [];
    }

    getStats() {
        return {
            subscribedEvents: this.eventSubscribers.size,
            activeStreams: this.streams.size,
            historySize: this.eventHistory.length,
            totalEvents: this.eventHistory.length
        };
    }
}

module.exports = new RealtimeService();