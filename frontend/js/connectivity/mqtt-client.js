/**
 * ESTIF HOME ULTIMATE - MQTT CLIENT MODULE
 * MQTT over WebSocket client for real-time device communication
 * Version: 2.0.0
 * Author: Estifanos Yohannis
 */

// ============================================
// MQTT CONFIGURATION
// ============================================

const MQTTConfig = {
    // Broker settings
    brokerUrl: 'wss://mqtt.estif-home.com:8084',
    brokerHost: 'mqtt.estif-home.com',
    brokerPort: 8084,
    useSSL: true,
    
    // Connection settings
    clientId: null, // Auto-generated
    username: null,
    password: null,
    keepAlive: 60,
    cleanSession: true,
    reconnectPeriod: 5000,
    connectTimeout: 30000,
    
    // QoS levels
    qos: {
        at_most_once: 0,
        at_least_once: 1,
        exactly_once: 2
    },
    
    // Retain settings
    defaultRetain: false,
    
    // Will message
    willMessage: {
        topic: 'estif/status',
        payload: JSON.stringify({ status: 'offline', timestamp: Date.now() }),
        qos: 1,
        retain: true
    },
    
    // Topics
    topics: {
        // Device topics
        deviceStatus: (deviceId) => `estif/device/${deviceId}/status`,
        deviceCommand: (deviceId) => `estif/device/${deviceId}/command`,
        deviceConfig: (deviceId) => `estif/device/${deviceId}/config`,
        deviceTelemetry: (deviceId) => `estif/device/${deviceId}/telemetry`,
        
        // Home topics
        homeStatus: (homeId) => `estif/home/${homeId}/status`,
        homeCommand: (homeId) => `estif/home/${homeId}/command`,
        
        // System topics
        systemStatus: 'estif/system/status',
        systemBroadcast: 'estif/system/broadcast',
        
        // User topics
        userNotifications: (userId) => `estif/user/${userId}/notifications`,
        
        // ESP32 specific
        esp32Status: (esp32Id) => `estif/esp32/${esp32Id}/status`,
        esp32Command: (esp32Id) => `estif/esp32/${esp32Id}/command`,
        esp32Telemetry: (esp32Id) => `estif/esp32/${esp32Id}/telemetry`,
        
        // Discovery
        discovery: 'estif/discovery',
        announcement: 'estif/announce'
    },
    
    // Subscriptions
    subscriptions: [
        'estif/device/+/status',
        'estif/device/+/command/response',
        'estif/system/broadcast',
        'estif/discovery',
        'estif/announce',
        'estif/esp32/+/status'
    ],
    
    // Message handling
    messageBufferSize: 100,
    debug: false
};

// ============================================
// MESSAGE QUEUE
// ============================================

class MessageQueue {
    constructor() {
        this.queue = [];
        this.processing = false;
        this.maxSize = MQTTConfig.messageBufferSize;
    }

    add(message) {
        if (this.queue.length >= this.maxSize) {
            this.queue.shift();
        }
        this.queue.push({
            ...message,
            timestamp: Date.now(),
            id: this.generateId()
        });
        this.process();
    }

    async process() {
        if (this.processing || this.queue.length === 0) return;
        
        this.processing = true;
        
        while (this.queue.length > 0) {
            const message = this.queue[0];
            try {
                await this.sendMessage(message);
                this.queue.shift();
            } catch (error) {
                console.error('[MQTT] Failed to send message:', error);
                if (message.retryCount >= 3) {
                    this.queue.shift();
                } else {
                    message.retryCount = (message.retryCount || 0) + 1;
                    await this.delay(1000 * message.retryCount);
                }
            }
        }
        
        this.processing = false;
    }

    async sendMessage(message) {
        // Actual sending is handled by MQTT client
        if (window.mqttClient && window.mqttClient.isConnected()) {
            await window.mqttClient.publish(message.topic, message.payload, message.options);
        } else {
            throw new Error('MQTT client not connected');
        }
    }

    generateId() {
        return 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 8);
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    clear() {
        this.queue = [];
    }

    getSize() {
        return this.queue.length;
    }
}

// ============================================
// MQTT CLIENT
// ============================================

class MQTTClient {
    constructor() {
        this.client = null;
        this.isConnected = false;
        this.isConnecting = false;
        self.reconnectTimer = null;
        self.messageHandlers = new Map();
        self.topicSubscriptions = new Map();
        self.pendingMessages = new MessageQueue();
        self.eventListeners = [];
        self.messageHistory = [];
        
        this.init();
    }

    init() {
        this.generateClientId();
        this.loadStoredCredentials();
        MQTTConfig.debug && console.log('[MQTT] Client initialized');
    }

    generateClientId() {
        if (!MQTTConfig.clientId) {
            MQTTConfig.clientId = `estif_web_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
        }
        return MQTTConfig.clientId;
    }

    loadStoredCredentials() {
        try {
            const saved = localStorage.getItem('estif_mqtt_credentials');
            if (saved) {
                const creds = JSON.parse(saved);
                MQTTConfig.username = creds.username;
                MQTTConfig.password = creds.password;
            }
        } catch (error) {
            MQTTConfig.debug && console.log('[MQTT] Failed to load credentials');
        }
    }

    saveCredentials(username, password) {
        try {
            localStorage.setItem('estif_mqtt_credentials', JSON.stringify({ username, password }));
            MQTTConfig.username = username;
            MQTTConfig.password = password;
        } catch (error) {
            console.error('[MQTT] Failed to save credentials:', error);
        }
    }

    // ============================================
    // CONNECTION MANAGEMENT
    // ============================================

    async connect(options = {}) {
        if (this.isConnected) {
            MQTTConfig.debug && console.log('[MQTT] Already connected');
            return { success: true };
        }

        if (this.isConnecting) {
            MQTTConfig.debug && console.log('[MQTT] Connection already in progress');
            return { success: false, error: 'Connection in progress' };
        }

        this.isConnecting = true;

        return new Promise((resolve, reject) => {
            try {
                // Use MQTT.js or WebSocket directly
                const brokerUrl = options.brokerUrl || MQTTConfig.brokerUrl;
                
                // For demonstration, we'll simulate MQTT connection
                // In production, use mqtt.js library: import mqtt from 'mqtt'
                
                this.connectWebSocket(brokerUrl, options);
                
                const timeout = setTimeout(() => {
                    reject(new Error('Connection timeout'));
                }, MQTTConfig.connectTimeout);
                
                this.once('connected', () => {
                    clearTimeout(timeout);
                    this.isConnected = true;
                    this.isConnecting = false;
                    this.subscribeToTopics();
                    this.sendWillMessage(false);
                    resolve({ success: true });
                });
                
                this.once('error', (error) => {
                    clearTimeout(timeout);
                    this.isConnecting = false;
                    reject(error);
                });
                
            } catch (error) {
                this.isConnecting = false;
                reject(error);
            }
        });
    }

    connectWebSocket(brokerUrl, options) {
        // Simulate WebSocket connection
        // In production, implement actual MQTT over WebSocket
        this.simulateConnection();
    }

    simulateConnection() {
        // Simulate connection for demo
        setTimeout(() => {
            this.isConnected = true;
            this.notifyListeners('connected');
            this.startSimulatedMessages();
        }, 1000);
    }

    startSimulatedMessages() {
        // Simulate incoming messages for demo
        setInterval(() => {
            if (this.isConnected) {
                const simulatedMessage = {
                    topic: 'estif/system/status',
                    payload: JSON.stringify({
                        timestamp: Date.now(),
                        uptime: Math.floor(Math.random() * 10000),
                        devices: Math.floor(Math.random() * 10)
                    })
                };
                this.handleMessage(simulatedMessage);
            }
        }, 30000);
    }

    async disconnect() {
        if (!this.isConnected) {
            return { success: true };
        }

        try {
            await this.sendWillMessage(true);
            
            if (this.client) {
                this.client.end();
                this.client = null;
            }
            
            this.isConnected = false;
            if (this.reconnectTimer) {
                clearTimeout(this.reconnectTimer);
                this.reconnectTimer = null;
            }
            
            MQTTConfig.debug && console.log('[MQTT] Disconnected');
            this.notifyListeners('disconnected');
            
            return { success: true };
        } catch (error) {
            console.error('[MQTT] Disconnect error:', error);
            return { success: false, error: error.message };
        }
    }

    async reconnect() {
        if (this.reconnectTimer) return;
        
        this.reconnectTimer = setTimeout(async () => {
            this.reconnectTimer = null;
            if (!this.isConnected) {
                MQTTConfig.debug && console.log('[MQTT] Attempting reconnect...');
                await this.connect();
            }
        }, MQTTConfig.reconnectPeriod);
    }

    sendWillMessage(isDisconnecting) {
        const willMessage = {
            ...MQTTConfig.willMessage,
            payload: JSON.stringify({
                status: isDisconnecting ? 'offline' : 'online',
                clientId: MQTTConfig.clientId,
                timestamp: Date.now()
            })
        };
        
        return this.publish(willMessage.topic, willMessage.payload, {
            qos: willMessage.qos,
            retain: willMessage.retain
        });
    }

    // ============================================
    // PUBLISH/SUBSCRIBE
    // ============================================

    async publish(topic, payload, options = {}) {
        if (!this.isConnected) {
            if (options.queue !== false) {
                this.pendingMessages.add({ topic, payload, options });
            }
            return { success: false, queued: true };
        }

        try {
            const message = {
                topic,
                payload: typeof payload === 'string' ? payload : JSON.stringify(payload),
                qos: options.qos || MQTTConfig.qos.at_least_once,
                retain: options.retain !== undefined ? options.retain : MQTTConfig.defaultRetain
            };
            
            // Simulate publish
            MQTTConfig.debug && console.log(`[MQTT] Published to ${topic}:`, message.payload);
            
            this.addToHistory('publish', topic, message.payload);
            this.notifyListeners('message_published', { topic, payload: message.payload });
            
            return { success: true };
        } catch (error) {
            console.error('[MQTT] Publish error:', error);
            return { success: false, error: error.message };
        }
    }

    async subscribe(topic, callback, options = {}) {
        if (!this.isConnected) {
            return { success: false, error: 'Not connected' };
        }

        try {
            if (!this.messageHandlers.has(topic)) {
                this.messageHandlers.set(topic, []);
            }
            this.messageHandlers.get(topic).push(callback);
            
            this.topicSubscriptions.set(topic, options);
            
            MQTTConfig.debug && console.log(`[MQTT] Subscribed to ${topic}`);
            
            return { success: true };
        } catch (error) {
            console.error('[MQTT] Subscribe error:', error);
            return { success: false, error: error.message };
        }
    }

    async unsubscribe(topic, callback = null) {
        if (!this.messageHandlers.has(topic)) {
            return { success: true };
        }

        if (callback) {
            const handlers = this.messageHandlers.get(topic);
            const index = handlers.indexOf(callback);
            if (index !== -1) handlers.splice(index, 1);
            if (handlers.length === 0) {
                this.messageHandlers.delete(topic);
            }
        } else {
            this.messageHandlers.delete(topic);
        }
        
        this.topicSubscriptions.delete(topic);
        
        MQTTConfig.debug && console.log(`[MQTT] Unsubscribed from ${topic}`);
        
        return { success: true };
    }

    subscribeToTopics() {
        for (const topic of MQTTConfig.subscriptions) {
            this.subscribe(topic, (message) => {
                this.handleMessage(message);
            });
        }
    }

    handleMessage(message) {
        this.addToHistory('receive', message.topic, message.payload);
        this.notifyListeners('message_received', message);
        
        // Call specific topic handlers
        const handlers = this.messageHandlers.get(message.topic);
        if (handlers) {
            for (const handler of handlers) {
                try {
                    handler(message);
                } catch (error) {
                    console.error(`[MQTT] Handler error for ${message.topic}:`, error);
                }
            }
        }
        
        // Handle wildcard topics
        for (const [subTopic, handlers] of this.messageHandlers.entries()) {
            if (this.matchesWildcard(subTopic, message.topic)) {
                for (const handler of handlers) {
                    try {
                        handler(message);
                    } catch (error) {
                        console.error(`[MQTT] Wildcard handler error for ${subTopic}:`, error);
                    }
                }
            }
        }
    }

    matchesWildcard(pattern, topic) {
        const patternParts = pattern.split('/');
        const topicParts = topic.split('/');
        
        for (let i = 0; i < patternParts.length; i++) {
            if (patternParts[i] === '+') continue;
            if (patternParts[i] === '#') return true;
            if (patternParts[i] !== topicParts[i]) return false;
        }
        
        return patternParts.length === topicParts.length;
    }

    // ============================================
    // DEVICE COMMUNICATION
    // ============================================

    async sendDeviceCommand(deviceId, command, params = {}) {
        const topic = MQTTConfig.topics.deviceCommand(deviceId);
        const payload = JSON.stringify({
            command,
            params,
            clientId: MQTTConfig.clientId,
            timestamp: Date.now()
        });
        
        return this.publish(topic, payload);
    }

    async getDeviceStatus(deviceId) {
        return new Promise((resolve, reject) => {
            const topic = MQTTConfig.topics.deviceStatus(deviceId);
            const responseTopic = `${topic}/response`;
            
            const timeout = setTimeout(() => {
                this.unsubscribe(responseTopic, handler);
                reject(new Error('Device status request timeout'));
            }, 5000);
            
            const handler = (message) => {
                clearTimeout(timeout);
                this.unsubscribe(responseTopic, handler);
                resolve(JSON.parse(message.payload));
            };
            
            this.subscribe(responseTopic, handler);
            this.publish(topic, { command: 'get_status' });
        });
    }

    async sendESP32Command(esp32Id, command, params = {}) {
        const topic = MQTTConfig.topics.esp32Command(esp32Id);
        const payload = JSON.stringify({
            command,
            params,
            clientId: MQTTConfig.clientId,
            timestamp: Date.now()
        });
        
        return this.publish(topic, payload);
    }

    async getESP32Status(esp32Id) {
        return new Promise((resolve, reject) => {
            const topic = MQTTConfig.topics.esp32Status(esp32Id);
            
            const timeout = setTimeout(() => {
                reject(new Error('ESP32 status request timeout'));
            }, 5000);
            
            const handler = (message) => {
                clearTimeout(timeout);
                this.unsubscribe(topic, handler);
                resolve(JSON.parse(message.payload));
            };
            
            this.subscribe(topic, handler);
            this.publish(topic, { command: 'get_status' });
        });
    }

    async broadcastMessage(message, topic = MQTTConfig.topics.systemBroadcast) {
        const payload = JSON.stringify({
            message,
            sender: MQTTConfig.clientId,
            timestamp: Date.now()
        });
        
        return this.publish(topic, payload);
    }

    async announceDevice(deviceInfo) {
        const payload = JSON.stringify({
            ...deviceInfo,
            clientId: MQTTConfig.clientId,
            timestamp: Date.now()
        });
        
        return this.publish(MQTTConfig.topics.announcement, payload);
    }

    // ============================================
    // TELEMETRY HANDLING
    // ============================================

    async publishTelemetry(deviceId, data) {
        const topic = MQTTConfig.topics.deviceTelemetry(deviceId);
        const payload = JSON.stringify({
            ...data,
            timestamp: Date.now()
        });
        
        return this.publish(topic, payload);
    }

    async publishESP32Telemetry(esp32Id, data) {
        const topic = MQTTConfig.topics.esp32Telemetry(esp32Id);
        const payload = JSON.stringify({
            ...data,
            timestamp: Date.now()
        });
        
        return this.publish(topic, payload);
    }

    // ============================================
    // MESSAGE HISTORY
    // ============================================

    addToHistory(type, topic, payload) {
        this.messageHistory.unshift({
            type,
            topic,
            payload,
            timestamp: Date.now()
        });
        
        if (this.messageHistory.length > 100) {
            this.messageHistory.pop();
        }
    }

    getMessageHistory(limit = 50) {
        return this.messageHistory.slice(0, limit);
    }

    clearHistory() {
        this.messageHistory = [];
    }

    // ============================================
    // CONNECTION STATUS
    // ============================================

    isConnected() {
        return this.isConnected;
    }

    getConnectionStatus() {
        return {
            connected: this.isConnected,
            connecting: this.isConnecting,
            clientId: MQTTConfig.clientId,
            brokerUrl: MQTTConfig.brokerUrl
        };
    }

    // ============================================
    // EVENT SYSTEM
    // ============================================

    on(event, callback) {
        this.eventListeners.push({ event, callback });
        return () => {
            const index = this.eventListeners.findIndex(l => l.event === event && l.callback === callback);
            if (index !== -1) this.eventListeners.splice(index, 1);
        };
    }

    once(event, callback) {
        const wrapper = (...args) => {
            callback(...args);
            this.off(event, wrapper);
        };
        this.on(event, wrapper);
    }

    off(event, callback) {
        const index = this.eventListeners.findIndex(l => l.event === event && l.callback === callback);
        if (index !== -1) this.eventListeners.splice(index, 1);
    }

    notifyListeners(event, data) {
        this.eventListeners.forEach(listener => {
            if (listener.event === event) {
                listener.callback(data);
            }
        });
    }
}

// ============================================
// MQTT UI COMPONENT
// ============================================

class MQTTUI {
    constructor(client) {
        this.client = client;
        this.init();
    }

    init() {
        this.createUI();
        this.bindEvents();
        MQTTConfig.debug && console.log('[MQTT UI] Initialized');
    }

    createUI() {
        const container = document.getElementById('mqtt-container');
        if (!container) return;

        container.innerHTML = `
            <div class="mqtt-panel">
                <div class="mqtt-header">
                    <i class="fas fa-exchange-alt"></i>
                    <h3>MQTT Connection</h3>
                    <span class="mqtt-status" id="mqtt-status">Disconnected</span>
                </div>
                
                <div class="mqtt-controls">
                    <button id="mqtt-connect-btn" class="btn btn-primary">
                        <i class="fas fa-plug"></i> Connect
                    </button>
                    <button id="mqtt-disconnect-btn" class="btn btn-secondary" disabled>
                        <i class="fas fa-unplug"></i> Disconnect
                    </button>
                </div>
                
                <div class="mqtt-config">
                    <div class="form-group">
                        <label>Broker URL</label>
                        <input type="text" id="mqtt-broker" value="${MQTTConfig.brokerUrl}" placeholder="wss://broker:8084">
                    </div>
                    <div class="form-group">
                        <label>Username</label>
                        <input type="text" id="mqtt-username">
                    </div>
                    <div class="form-group">
                        <label>Password</label>
                        <input type="password" id="mqtt-password">
                    </div>
                </div>
                
                <div class="mqtt-messages" id="mqtt-messages">
                    <h4>Message Log</h4>
                    <div class="messages-list"></div>
                </div>
            </div>
        `;

        this.cacheElements();
    }

    cacheElements() {
        this.connectBtn = document.getElementById('mqtt-connect-btn');
        this.disconnectBtn = document.getElementById('mqtt-disconnect-btn');
        this.statusSpan = document.getElementById('mqtt-status');
        this.brokerInput = document.getElementById('mqtt-broker');
        this.usernameInput = document.getElementById('mqtt-username');
        this.passwordInput = document.getElementById('mqtt-password');
        this.messagesList = document.querySelector('.messages-list');
    }

    bindEvents() {
        if (this.connectBtn) {
            this.connectBtn.addEventListener('click', () => this.connect());
        }
        
        if (this.disconnectBtn) {
            this.disconnectBtn.addEventListener('click', () => this.disconnect());
        }
        
        this.client.on('connected', () => this.updateStatus(true));
        this.client.on('disconnected', () => this.updateStatus(false));
        this.client.on('message_received', (message) => this.addMessage(message));
        this.client.on('message_published', (message) => this.addMessage(message, true));
    }

    async connect() {
        const options = {
            brokerUrl: this.brokerInput?.value || MQTTConfig.brokerUrl,
            username: this.usernameInput?.value,
            password: this.passwordInput?.value
        };
        
        if (options.username && options.password) {
            this.client.saveCredentials(options.username, options.password);
        }
        
        this.setLoading(true);
        const result = await this.client.connect(options);
        this.setLoading(false);
        
        if (!result.success) {
            alert('Connection failed: ' + result.error);
        }
    }

    async disconnect() {
        await this.client.disconnect();
    }

    updateStatus(connected) {
        if (this.statusSpan) {
            this.statusSpan.textContent = connected ? 'Connected' : 'Disconnected';
            this.statusSpan.className = `mqtt-status ${connected ? 'connected' : 'disconnected'}`;
        }
        
        if (this.connectBtn) {
            this.connectBtn.disabled = connected;
        }
        
        if (this.disconnectBtn) {
            this.disconnectBtn.disabled = !connected;
        }
    }

    addMessage(message, isPublished = false) {
        if (!this.messagesList) return;
        
        const messageEl = document.createElement('div');
        messageEl.className = `mqtt-message ${isPublished ? 'published' : 'received'}`;
        
        const time = new Date(message.timestamp || Date.now()).toLocaleTimeString();
        
        messageEl.innerHTML = `
            <div class="message-header">
                <span class="message-type">${isPublished ? '→' : '←'}</span>
                <span class="message-topic">${message.topic}</span>
                <span class="message-time">${time}</span>
            </div>
            <div class="message-payload">${this.truncatePayload(message.payload)}</div>
        `;
        
        this.messagesList.insertBefore(messageEl, this.messagesList.firstChild);
        
        // Limit messages
        while (this.messagesList.children.length > 50) {
            this.messagesList.removeChild(this.messagesList.lastChild);
        }
    }

    truncatePayload(payload) {
        let str = typeof payload === 'string' ? payload : JSON.stringify(payload);
        if (str.length > 100) {
            str = str.substring(0, 100) + '...';
        }
        return str;
    }

    setLoading(loading) {
        if (this.connectBtn) {
            this.connectBtn.disabled = loading;
            this.connectBtn.innerHTML = loading ? 
                '<i class="fas fa-spinner fa-spin"></i> Connecting...' : 
                '<i class="fas fa-plug"></i> Connect';
        }
    }
}

// ============================================
// CSS STYLES (Auto-injected)
// ============================================

const mqttStyles = `
    .mqtt-panel {
        background: var(--bg-card);
        border-radius: 12px;
        padding: 20px;
        border: 1px solid var(--border-color);
    }
    
    .mqtt-header {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 20px;
        padding-bottom: 12px;
        border-bottom: 1px solid var(--border-color);
    }
    
    .mqtt-header i {
        font-size: 20px;
        color: var(--primary);
    }
    
    .mqtt-header h3 {
        flex: 1;
        margin: 0;
    }
    
    .mqtt-status {
        padding: 4px 12px;
        border-radius: 20px;
        font-size: 12px;
        font-weight: 500;
    }
    
    .mqtt-status.connected {
        background: var(--success-soft);
        color: var(--success);
    }
    
    .mqtt-status.disconnected {
        background: var(--danger-soft);
        color: var(--danger);
    }
    
    .mqtt-controls {
        display: flex;
        gap: 12px;
        margin-bottom: 20px;
    }
    
    .mqtt-config {
        margin-bottom: 20px;
        padding: 16px;
        background: var(--bg-secondary);
        border-radius: 8px;
    }
    
    .mqtt-messages {
        margin-top: 20px;
    }
    
    .mqtt-messages h4 {
        margin-bottom: 12px;
    }
    
    .messages-list {
        max-height: 300px;
        overflow-y: auto;
        background: var(--bg-secondary);
        border-radius: 8px;
        padding: 8px;
    }
    
    .mqtt-message {
        padding: 8px;
        border-bottom: 1px solid var(--border-color);
        font-size: 12px;
    }
    
    .mqtt-message:last-child {
        border-bottom: none;
    }
    
    .mqtt-message.received {
        border-left: 3px solid var(--info);
    }
    
    .mqtt-message.published {
        border-left: 3px solid var(--success);
    }
    
    .message-header {
        display: flex;
        gap: 8px;
        margin-bottom: 4px;
    }
    
    .message-type {
        font-weight: bold;
        width: 20px;
    }
    
    .message-topic {
        color: var(--primary);
        font-family: monospace;
        flex: 1;
    }
    
    .message-time {
        color: var(--text-muted);
        font-size: 10px;
    }
    
    .message-payload {
        color: var(--text-secondary);
        word-break: break-all;
        font-family: monospace;
        font-size: 11px;
        padding-left: 28px;
    }
`;

// Inject styles
if (typeof document !== 'undefined') {
    const styleSheet = document.createElement('style');
    styleSheet.textContent = mqttStyles;
    document.head.appendChild(styleSheet);
}

// ============================================
// CREATE SINGLETON INSTANCES
// ============================================

const mqttClient = new MQTTClient();
const mqttUI = new MQTTUI(mqttClient);

// ============================================
// EXPORTS
// ============================================

// Expose to window
window.mqttClient = mqttClient;
window.mqttUI = mqttUI;
window.MQTTClient = MQTTClient;
window.MQTTConfig = MQTTConfig;

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        mqttClient,
        mqttUI,
        MQTTClient,
        MQTTConfig
    };
}

// ES modules export
export {
    mqttClient,
    mqttUI,
    MQTTClient,
    MQTTConfig
};