/**
 * ESTIF HOME ULTIMATE - WEBSOCKET MODULE
 * Real-time bidirectional communication for device control and updates
 * Version: 2.0.0
 * Author: Estifanos Yohannis
 */

// ============================================
// WEBSOCKET CONFIGURATION
// ============================================

const WebSocketConfig = {
    // Connection settings
    url: null, // Auto-detect from current host
    path: '/socket.io',
    protocols: ['estif-protocol'],
    
    // Reconnection settings
    reconnect: true,
    reconnectAttempts: 10,
    reconnectDelay: 1000,
    reconnectDelayMax: 5000,
    
    // Heartbeat settings
    heartbeatInterval: 25000,
    heartbeatTimeout: 10000,
    
    // Message settings
    maxMessageSize: 1024 * 1024, // 1MB
    messageQueueSize: 100,
    
    // Debug
    debug: false
};

// ============================================
// MESSAGE QUEUE
// ============================================

class MessageQueue {
    constructor() {
        this.queue = [];
        this.processing = false;
        this.maxSize = WebSocketConfig.messageQueueSize;
    }

    add(message) {
        if (this.queue.length >= this.maxSize) {
            this.queue.shift();
        }
        this.queue.push({
            ...message,
            id: this.generateId(),
            timestamp: Date.now(),
            attempts: 0
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
                message.attempts++;
                if (message.attempts >= 3) {
                    this.queue.shift();
                    console.error('[WebSocket] Failed to send message after 3 attempts:', message);
                } else {
                    await this.delay(1000 * message.attempts);
                }
            }
        }
        
        this.processing = false;
    }

    async sendMessage(message) {
        if (window.wsClient && window.wsClient.isConnected()) {
            window.wsClient.send(message.type, message.data);
            return true;
        }
        throw new Error('WebSocket not connected');
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
// WEBSOCKET CLIENT
// ============================================

class WebSocketClient {
    constructor() {
        this.socket = null;
        this.isConnected = false;
        this.isConnecting = false;
        this.reconnectTimer = null;
        self.heartbeatTimer = null;
        self.reconnectAttempts = 0;
        self.messageQueue = new MessageQueue();
        self.eventHandlers = new Map();
        self.messageHandlers = new Map();
        self.pendingRequests = new Map();
        self.requestId = 0;
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.connect();
        WebSocketConfig.debug && console.log('[WebSocket] Client initialized');
    }

    setupEventListeners() {
        window.addEventListener('beforeunload', () => {
            if (this.socket) {
                this.socket.close();
            }
        });
        
        window.addEventListener('online', () => {
            if (!this.isConnected && WebSocketConfig.reconnect) {
                this.reconnect();
            }
        });
    }

    // ============================================
    // CONNECTION MANAGEMENT
    // ============================================

    connect() {
        if (this.isConnected || this.isConnecting) return;
        
        this.isConnecting = true;
        const url = this.getWebSocketUrl();
        
        WebSocketConfig.debug && console.log('[WebSocket] Connecting to:', url);
        
        try {
            this.socket = new WebSocket(url, WebSocketConfig.protocols);
            this.socket.binaryType = 'arraybuffer';
            
            this.socket.onopen = () => this.handleOpen();
            this.socket.onclose = (event) => this.handleClose(event);
            this.socket.onerror = (error) => this.handleError(error);
            this.socket.onmessage = (event) => this.handleMessage(event);
        } catch (error) {
            console.error('[WebSocket] Connection failed:', error);
            this.handleClose({ code: 1006, reason: error.message });
        }
    }

    getWebSocketUrl() {
        if (WebSocketConfig.url) {
            return WebSocketConfig.url;
        }
        
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.host;
        const path = WebSocketConfig.path;
        
        return `${protocol}//${host}${path}`;
    }

    handleOpen() {
        this.isConnected = true;
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        
        WebSocketConfig.debug && console.log('[WebSocket] Connected');
        
        this.startHeartbeat();
        this.notify('connected', { timestamp: Date.now() });
        
        // Process queued messages
        this.messageQueue.process();
    }

    handleClose(event) {
        this.isConnected = false;
        this.isConnecting = false;
        this.stopHeartbeat();
        
        WebSocketConfig.debug && console.log('[WebSocket] Disconnected:', event.code, event.reason);
        this.notify('disconnected', { code: event.code, reason: event.reason });
        
        if (WebSocketConfig.reconnect && event.code !== 1000) {
            this.scheduleReconnect();
        }
    }

    handleError(error) {
        console.error('[WebSocket] Error:', error);
        this.notify('error', { error });
    }

    scheduleReconnect() {
        if (this.reconnectTimer) return;
        
        const delay = Math.min(
            WebSocketConfig.reconnectDelay * Math.pow(2, this.reconnectAttempts),
            WebSocketConfig.reconnectDelayMax
        );
        
        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            this.reconnectAttempts++;
            this.connect();
        }, delay);
        
        WebSocketConfig.debug && console.log(`[WebSocket] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
    }

    reconnect() {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        
        if (this.socket) {
            this.socket.close();
        }
        
        this.connect();
    }

    disconnect() {
        WebSocketConfig.reconnect = false;
        
        if (this.socket) {
            this.socket.close(1000, 'Manual disconnect');
            this.socket = null;
        }
        
        this.isConnected = false;
        this.stopHeartbeat();
    }

    // ============================================
    // HEARTBEAT
    // ============================================

    startHeartbeat() {
        this.stopHeartbeat();
        
        this.heartbeatTimer = setInterval(() => {
            if (this.isConnected) {
                this.send('ping', { timestamp: Date.now() });
            }
        }, WebSocketConfig.heartbeatInterval);
    }

    stopHeartbeat() {
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = null;
        }
    }

    // ============================================
    // MESSAGE HANDLING
    // ============================================

    handleMessage(event) {
        let data;
        
        if (event.data instanceof ArrayBuffer) {
            data = this.decodeBinary(event.data);
        } else {
            try {
                data = JSON.parse(event.data);
            } catch (e) {
                data = event.data;
            }
        }
        
        WebSocketConfig.debug && console.log('[WebSocket] Received:', data);
        
        // Handle pong response
        if (data.type === 'pong') {
            this.notify('pong', data);
            return;
        }
        
        // Handle request response
        if (data.id && this.pendingRequests.has(data.id)) {
            const { resolve, reject } = this.pendingRequests.get(data.id);
            this.pendingRequests.delete(data.id);
            
            if (data.error) {
                reject(data.error);
            } else {
                resolve(data);
            }
            return;
        }
        
        // Handle event
        this.notify(data.type, data.data);
        
        // Handle specific message handlers
        if (this.messageHandlers.has(data.type)) {
            const handlers = this.messageHandlers.get(data.type);
            handlers.forEach(handler => handler(data.data, data));
        }
    }

    send(type, data, options = {}) {
        const message = {
            type,
            data,
            timestamp: Date.now()
        };
        
        if (options.id) {
            message.id = options.id;
        }
        
        if (this.isConnected) {
            const encoded = JSON.stringify(message);
            
            if (encoded.length > WebSocketConfig.maxMessageSize) {
                console.error('[WebSocket] Message too large:', encoded.length);
                return null;
            }
            
            this.socket.send(encoded);
            WebSocketConfig.debug && console.log('[WebSocket] Sent:', message);
            return message.id;
        } else {
            // Queue message for later
            this.messageQueue.add(message);
            return null;
        }
    }

    request(type, data, timeout = 30000) {
        return new Promise((resolve, reject) => {
            const id = this.generateRequestId();
            
            const timeoutId = setTimeout(() => {
                this.pendingRequests.delete(id);
                reject(new Error('Request timeout'));
            }, timeout);
            
            this.pendingRequests.set(id, {
                resolve: (result) => {
                    clearTimeout(timeoutId);
                    resolve(result);
                },
                reject: (error) => {
                    clearTimeout(timeoutId);
                    reject(error);
                }
            });
            
            this.send(type, data, { id });
        });
    }

    generateRequestId() {
        return `req_${++this.requestId}_${Date.now()}`;
    }

    // ============================================
    // DEVICE CONTROL METHODS
    // ============================================

    getDevices() {
        return this.request('get_devices');
    }

    toggleDevice(deviceId, state) {
        return this.request('toggle_device', { deviceId, state });
    }

    setAutoMode(deviceId, enabled) {
        return this.request('set_auto_mode', { deviceId, enabled });
    }

    masterControl(state) {
        return this.request('master_control', { state });
    }

    getDeviceStatus(deviceId) {
        return this.request('get_device_status', { deviceId });
    }

    subscribeDevice(deviceId) {
        return this.request('subscribe_device', { deviceId });
    }

    unsubscribeDevice(deviceId) {
        return this.request('unsubscribe_device', { deviceId });
    }

    getSystemStats() {
        return this.request('get_system_stats');
    }

    getActivityLogs(limit = 50) {
        return this.request('get_activity_logs', { limit });
    }

    // ============================================
    // HOME MANAGEMENT
    // ============================================

    getHomes() {
        return this.request('get_homes');
    }

    switchHome(homeId) {
        return this.request('switch_home', { homeId });
    }

    getHomeMembers(homeId) {
        return this.request('get_home_members', { homeId });
    }

    inviteMember(email, role = 'member') {
        return this.request('invite_member', { email, role });
    }

    removeMember(memberId) {
        return this.request('remove_member', { memberId });
    }

    // ============================================
    // AUTOMATION
    // ============================================

    getAutomations() {
        return this.request('get_automations');
    }

    toggleAutomation(ruleId, enabled) {
        return this.request('toggle_automation', { ruleId, enabled });
    }

    createAutomation(rule) {
        return this.request('create_automation', { rule });
    }

    deleteAutomation(ruleId) {
        return this.request('delete_automation', { ruleId });
    }

    // ============================================
    // VOICE COMMANDS
    // ============================================

    sendVoiceCommand(text, language = 'en') {
        return this.request('voice_command', { text, language });
    }

    // ============================================
    // ESP32 COMMUNICATION
    // ============================================

    registerESP32(deviceInfo) {
        return this.request('register_esp32', deviceInfo);
    }

    getESP32Status(esp32Id) {
        return this.request('get_esp32_status', { esp32Id });
    }

    sendESP32Command(esp32Id, command, params) {
        return this.request('esp32_command', { esp32Id, command, params });
    }

    // ============================================
    // EVENT HANDLING
    // ============================================

    on(event, handler) {
        if (!this.eventHandlers.has(event)) {
            this.eventHandlers.set(event, []);
        }
        this.eventHandlers.get(event).push(handler);
        return () => this.off(event, handler);
    }

    off(event, handler) {
        if (this.eventHandlers.has(event)) {
            const handlers = this.eventHandlers.get(event);
            const index = handlers.indexOf(handler);
            if (index !== -1) handlers.splice(index, 1);
        }
    }

    onMessage(type, handler) {
        if (!this.messageHandlers.has(type)) {
            this.messageHandlers.set(type, []);
        }
        this.messageHandlers.get(type).push(handler);
        return () => this.offMessage(type, handler);
    }

    offMessage(type, handler) {
        if (this.messageHandlers.has(type)) {
            const handlers = this.messageHandlers.get(type);
            const index = handlers.indexOf(handler);
            if (index !== -1) handlers.splice(index, 1);
        }
    }

    notify(event, data) {
        if (this.eventHandlers.has(event)) {
            this.eventHandlers.get(event).forEach(handler => handler(data));
        }
    }

    // ============================================
    // UTILITY METHODS
    // ============================================

    decodeBinary(buffer) {
        const decoder = new TextDecoder();
        return decoder.decode(buffer);
    }

    encodeBinary(data) {
        const encoder = new TextEncoder();
        return encoder.encode(data);
    }

    isConnected() {
        return this.isConnected;
    }

    getConnectionStatus() {
        return {
            connected: this.isConnected,
            connecting: this.isConnecting,
            url: this.getWebSocketUrl(),
            reconnectAttempts: this.reconnectAttempts,
            queueSize: this.messageQueue.getSize()
        };
    }

    clearQueue() {
        this.messageQueue.clear();
    }
}

// ============================================
// WEBSOCKET UI COMPONENT
// ============================================

class WebSocketUI {
    constructor(client) {
        this.client = client;
        this.init();
    }

    init() {
        this.createUI();
        this.bindEvents();
        WebSocketConfig.debug && console.log('[WebSocketUI] Initialized');
    }

    createUI() {
        const container = document.getElementById('websocket-container');
        if (!container) return;

        container.innerHTML = `
            <div class="websocket-panel">
                <div class="ws-header">
                    <i class="fas fa-plug"></i>
                    <h3>Real-time Connection</h3>
                    <span class="ws-status" id="ws-status">${this.client.isConnected() ? 'Connected' : 'Disconnected'}</span>
                </div>
                
                <div class="ws-stats">
                    <div class="stat">
                        <span class="stat-label">Queue Size</span>
                        <span class="stat-value" id="queue-size">0</span>
                    </div>
                    <div class="stat">
                        <span class="stat-label">Reconnect Attempts</span>
                        <span class="stat-value" id="reconnect-attempts">0</span>
                    </div>
                </div>
                
                <div class="ws-controls">
                    <button id="ws-reconnect-btn" class="btn btn-primary">
                        <i class="fas fa-sync-alt"></i> Reconnect
                    </button>
                    <button id="ws-clear-queue-btn" class="btn btn-secondary">
                        <i class="fas fa-trash"></i> Clear Queue
                    </button>
                </div>
                
                <div class="ws-messages">
                    <h4>Message Log</h4>
                    <div class="messages-list" id="ws-messages-list"></div>
                </div>
            </div>
        `;

        this.cacheElements();
        this.startUpdates();
    }

    cacheElements() {
        this.statusSpan = document.getElementById('ws-status');
        this.queueSizeSpan = document.getElementById('queue-size');
        this.reconnectAttemptsSpan = document.getElementById('reconnect-attempts');
        this.reconnectBtn = document.getElementById('ws-reconnect-btn');
        this.clearQueueBtn = document.getElementById('ws-clear-queue-btn');
        this.messagesList = document.getElementById('ws-messages-list');
    }

    bindEvents() {
        if (this.reconnectBtn) {
            this.reconnectBtn.addEventListener('click', () => this.client.reconnect());
        }
        
        if (this.clearQueueBtn) {
            this.clearQueueBtn.addEventListener('click', () => this.client.clearQueue());
        }
        
        this.client.on('connected', () => this.updateStatus(true));
        this.client.on('disconnected', () => this.updateStatus(false));
        this.client.on('message', (message) => this.addMessage(message));
    }

    startUpdates() {
        setInterval(() => {
            const status = this.client.getConnectionStatus();
            this.updateQueueSize(status.queueSize);
            this.updateReconnectAttempts(status.reconnectAttempts);
        }, 1000);
    }

    updateStatus(connected) {
        if (this.statusSpan) {
            this.statusSpan.textContent = connected ? 'Connected' : 'Disconnected';
            this.statusSpan.className = `ws-status ${connected ? 'connected' : 'disconnected'}`;
        }
    }

    updateQueueSize(size) {
        if (this.queueSizeSpan) {
            this.queueSizeSpan.textContent = size;
        }
    }

    updateReconnectAttempts(attempts) {
        if (this.reconnectAttemptsSpan) {
            this.reconnectAttemptsSpan.textContent = attempts;
        }
    }

    addMessage(message) {
        if (!this.messagesList) return;
        
        const messageEl = document.createElement('div');
        messageEl.className = 'ws-message';
        
        const time = new Date(message.timestamp).toLocaleTimeString();
        
        messageEl.innerHTML = `
            <div class="message-header">
                <span class="message-type">${message.type}</span>
                <span class="message-time">${time}</span>
            </div>
            <div class="message-data">${this.formatData(message.data)}</div>
        `;
        
        this.messagesList.insertBefore(messageEl, this.messagesList.firstChild);
        
        // Limit messages
        while (this.messagesList.children.length > 50) {
            this.messagesList.removeChild(this.messagesList.lastChild);
        }
    }

    formatData(data) {
        if (typeof data === 'object') {
            return JSON.stringify(data).substring(0, 100);
        }
        return String(data).substring(0, 100);
    }
}

// ============================================
// CSS STYLES (Auto-injected)
// ============================================

const websocketStyles = `
    .websocket-panel {
        background: var(--bg-card);
        border-radius: 12px;
        padding: 20px;
        border: 1px solid var(--border-color);
    }
    
    .ws-header {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 20px;
        padding-bottom: 12px;
        border-bottom: 1px solid var(--border-color);
    }
    
    .ws-header i {
        font-size: 20px;
        color: var(--primary);
    }
    
    .ws-header h3 {
        flex: 1;
        margin: 0;
    }
    
    .ws-status {
        padding: 4px 12px;
        border-radius: 20px;
        font-size: 12px;
        font-weight: 500;
    }
    
    .ws-status.connected {
        background: var(--success-soft);
        color: var(--success);
    }
    
    .ws-status.disconnected {
        background: var(--danger-soft);
        color: var(--danger);
    }
    
    .ws-stats {
        display: flex;
        gap: 20px;
        margin-bottom: 20px;
        padding: 12px;
        background: var(--bg-secondary);
        border-radius: 8px;
    }
    
    .stat {
        flex: 1;
        text-align: center;
    }
    
    .stat-label {
        display: block;
        font-size: 11px;
        color: var(--text-muted);
        margin-bottom: 4px;
    }
    
    .stat-value {
        display: block;
        font-size: 18px;
        font-weight: 600;
        color: var(--text-primary);
    }
    
    .ws-controls {
        display: flex;
        gap: 12px;
        margin-bottom: 20px;
    }
    
    .ws-messages h4 {
        margin-bottom: 12px;
    }
    
    .messages-list {
        max-height: 250px;
        overflow-y: auto;
        background: var(--bg-secondary);
        border-radius: 8px;
        padding: 8px;
    }
    
    .ws-message {
        padding: 8px;
        border-bottom: 1px solid var(--border-color);
        font-size: 11px;
    }
    
    .ws-message:last-child {
        border-bottom: none;
    }
    
    .message-header {
        display: flex;
        justify-content: space-between;
        margin-bottom: 4px;
    }
    
    .message-type {
        font-weight: 600;
        color: var(--primary);
        text-transform: uppercase;
    }
    
    .message-time {
        color: var(--text-muted);
        font-size: 10px;
    }
    
    .message-data {
        color: var(--text-secondary);
        font-family: monospace;
        word-break: break-all;
    }
`;

// Inject styles
if (typeof document !== 'undefined') {
    const styleSheet = document.createElement('style');
    styleSheet.textContent = websocketStyles;
    document.head.appendChild(styleSheet);
}

// ============================================
// CREATE SINGLETON INSTANCES
// ============================================

const wsClient = new WebSocketClient();
const wsUI = new WebSocketUI(wsClient);

// ============================================
// EXPORTS
// ============================================

// Expose to window
window.wsClient = wsClient;
window.wsUI = wsUI;
window.WebSocketClient = WebSocketClient;
window.WebSocketConfig = WebSocketConfig;

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        wsClient,
        wsUI,
        WebSocketClient,
        WebSocketConfig
    };
}

// ES modules export
export {
    wsClient,
    wsUI,
    WebSocketClient,
    WebSocketConfig
};