/**
 * ESTIF HOME ULTIMATE - LIVE UPDATES MODULE
 * Real-time data streaming with automatic reconnection and state management
 * Version: 2.0.0
 * Author: Estifanos Yohannis
 */

// ============================================
// LIVE UPDATES CONFIGURATION
// ============================================

const LiveUpdatesConfig = {
    // Subscription settings
    subscriptionTimeout: 5000,
    maxSubscriptions: 100,
    
    // Update throttling
    throttleInterval: 100, // ms between batched updates
    
    // Cache settings
    cacheSize: 1000,
    cacheTTL: 60000, // 1 minute
    
    // Storage
    storageKey: 'estif_live_updates',
    
    // Debug
    debug: false
};

// ============================================
// LIVE UPDATES MANAGER
// ============================================

class LiveUpdatesManager {
    constructor(wsClient) {
        this.wsClient = wsClient;
        this.subscriptions = new Map(); // topic -> { callback, options }
        this.updateQueue = [];
        this.updateTimer = null;
        this.cache = new Map(); // topic -> lastData
        this.pendingSubscriptions = new Map();
        self.reconnectAttempts = 0;
        this.listeners = [];
        
        self.init();
    }

    init() {
        this.loadCache();
        this.setupWebSocketHandlers();
        LiveUpdatesConfig.debug && console.log('[LiveUpdates] Manager initialized');
    }

    loadCache() {
        try {
            const saved = localStorage.getItem(LiveUpdatesConfig.storageKey);
            if (saved) {
                const cache = JSON.parse(saved);
                for (const [topic, data] of Object.entries(cache)) {
                    if (Date.now() - data.timestamp < LiveUpdatesConfig.cacheTTL) {
                        this.cache.set(topic, data);
                    }
                }
            }
        } catch (error) {
            console.error('[LiveUpdates] Failed to load cache:', error);
        }
    }

    saveCache() {
        try {
            const cache = Object.fromEntries(this.cache);
            localStorage.setItem(LiveUpdatesConfig.storageKey, JSON.stringify(cache));
        } catch (error) {
            console.error('[LiveUpdates] Failed to save cache:', error);
        }
    }

    // ============================================
    // SUBSCRIPTION MANAGEMENT
    // ============================================

    subscribe(topic, callback, options = {}) {
        if (this.subscriptions.size >= LiveUpdatesConfig.maxSubscriptions) {
            console.warn('[LiveUpdates] Max subscriptions reached');
            return () => {};
        }
        
        this.subscriptions.set(topic, { callback, options });
        
        // Send subscription to server
        this.sendSubscription(topic, 'subscribe');
        
        // Return unsubscribe function
        return () => this.unsubscribe(topic);
    }

    unsubscribe(topic) {
        this.subscriptions.delete(topic);
        this.sendSubscription(topic, 'unsubscribe');
    }

    sendSubscription(topic, action) {
        if (!this.wsClient || !this.wsClient.isConnected()) {
            this.pendingSubscriptions.set(topic, action);
            return;
        }
        
        this.wsClient.send('subscription', { topic, action });
    }

    // ============================================
    // UPDATE HANDLING
    // ============================================

    handleUpdate(update) {
        const { topic, data, timestamp } = update;
        
        // Update cache
        this.cache.set(topic, { data, timestamp });
        this.saveCache();
        
        // Queue for throttled delivery
        this.updateQueue.push({ topic, data, timestamp });
        
        if (!this.updateTimer) {
            this.updateTimer = setTimeout(() => {
                this.processUpdates();
            }, LiveUpdatesConfig.throttleInterval);
        }
    }

    processUpdates() {
        const updates = this.updateQueue;
        this.updateQueue = [];
        this.updateTimer = null;
        
        // Group by topic
        const grouped = new Map();
        for (const update of updates) {
            if (!grouped.has(update.topic)) {
                grouped.set(update.topic, []);
            }
            grouped.get(update.topic).push(update);
        }
        
        // Dispatch to subscribers
        for (const [topic, topicUpdates] of grouped) {
            const subscription = this.subscriptions.get(topic);
            if (subscription && subscription.callback) {
                const latestUpdate = topicUpdates[topicUpdates.length - 1];
                subscription.callback(latestUpdate.data, latestUpdate);
            }
        }
        
        this.notifyListeners('updates_processed', { count: updates.length });
    }

    // ============================================
    // CACHE METHODS
    // ============================================

    getCachedData(topic) {
        const cached = this.cache.get(topic);
        if (cached && Date.now() - cached.timestamp < LiveUpdatesConfig.cacheTTL) {
            return cached.data;
        }
        return null;
    }

    invalidateCache(topic) {
        this.cache.delete(topic);
        this.saveCache();
    }

    clearCache() {
        this.cache.clear();
        this.saveCache();
    }

    // ============================================
    // WEB SOCKET HANDLERS
    // ============================================

    setupWebSocketHandlers() {
        if (!this.wsClient) return;
        
        this.wsClient.on('live_update', (data) => {
            this.handleUpdate(data);
        });
        
        this.wsClient.on('live_batch', (batch) => {
            batch.forEach(update => this.handleUpdate(update));
        });
        
        this.wsClient.on('subscribed', (data) => {
            LiveUpdatesConfig.debug && console.log('[LiveUpdates] Subscribed to:', data.topic);
        });
        
        this.wsClient.on('unsubscribed', (data) => {
            LiveUpdatesConfig.debug && console.log('[LiveUpdates] Unsubscribed from:', data.topic);
        });
        
        this.wsClient.on('reconnect', () => {
            this.resubscribeAll();
        });
    }

    resubscribeAll() {
        for (const topic of this.subscriptions.keys()) {
            this.sendSubscription(topic, 'subscribe');
        }
        
        for (const [topic, action] of this.pendingSubscriptions.entries()) {
            this.sendSubscription(topic, action);
            this.pendingSubscriptions.delete(topic);
        }
    }

    // ============================================
    // DATA REQUEST
    // ============================================

    async requestData(topic, params = {}) {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Request timeout'));
            }, LiveUpdatesConfig.subscriptionTimeout);
            
            if (!this.wsClient || !this.wsClient.isConnected()) {
                clearTimeout(timeout);
                reject(new Error('Not connected'));
                return;
            }
            
            const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            
            const handler = (response) => {
                if (response.requestId === requestId) {
                    this.wsClient.off('data_response', handler);
                    clearTimeout(timeout);
                    resolve(response.data);
                }
            };
            
            this.wsClient.on('data_response', handler);
            this.wsClient.send('request_data', { topic, params, requestId });
        });
    }

    // ============================================
    // STATISTICS
    // ============================================

    getStats() {
        return {
            subscriptions: this.subscriptions.size,
            queueSize: this.updateQueue.length,
            cacheSize: this.cache.size,
            isProcessing: this.updateTimer !== null
        };
    }

    // ============================================
    // EVENT SYSTEM
    // ============================================

    addEventListener(event, callback) {
        this.listeners.push({ event, callback });
        return () => {
            const index = this.listeners.findIndex(l => l.event === event && l.callback === callback);
            if (index !== -1) this.listeners.splice(index, 1);
        };
    }

    notifyListeners(event, data) {
        this.listeners.forEach(listener => {
            if (listener.event === event) {
                listener.callback(data);
            }
        });
    }
}

// ============================================
// LIVE UPDATES UI COMPONENT
// ============================================

class LiveUpdatesUI {
    constructor(updatesManager) {
        this.updatesManager = updatesManager;
        this.statusElement = null;
        this.init();
    }

    init() {
        this.createUI();
        this.bindEvents();
        this.startStatusUpdates();
        LiveUpdatesConfig.debug && console.log('[LiveUpdatesUI] Initialized');
    }

    createUI() {
        const container = document.getElementById('live-updates-container');
        if (!container) return;

        container.innerHTML = `
            <div class="live-updates-panel">
                <div class="updates-header">
                    <i class="fas fa-bolt"></i>
                    <h3>Live Updates</h3>
                    <span class="connection-status" id="live-status">Connecting...</span>
                </div>
                <div class="updates-stats">
                    <div class="stat">
                        <span class="stat-label">Subscriptions</span>
                        <span class="stat-value" id="sub-count">0</span>
                    </div>
                    <div class="stat">
                        <span class="stat-label">Queue Size</span>
                        <span class="stat-value" id="queue-size">0</span>
                    </div>
                    <div class="stat">
                        <span class="stat-label">Cache Size</span>
                        <span class="stat-value" id="cache-size">0</span>
                    </div>
                </div>
                <div class="updates-log" id="updates-log">
                    <div class="log-placeholder">Waiting for updates...</div>
                </div>
            </div>
        `;

        this.cacheElements();
    }

    cacheElements() {
        this.statusElement = document.getElementById('live-status');
        this.subCount = document.getElementById('sub-count');
        this.queueSize = document.getElementById('queue-size');
        this.cacheSize = document.getElementById('cache-size');
        this.updatesLog = document.getElementById('updates-log');
    }

    bindEvents() {
        this.updatesManager.addEventListener('updates_processed', () => this.updateStats());
    }

    startStatusUpdates() {
        setInterval(() => {
            this.updateStats();
        }, 1000);
    }

    updateStats() {
        const stats = this.updatesManager.getStats();
        
        if (this.subCount) this.subCount.textContent = stats.subscriptions;
        if (this.queueSize) this.queueSize.textContent = stats.queueSize;
        if (this.cacheSize) this.cacheSize.textContent = stats.cacheSize;
        
        const isConnected = this.updatesManager.wsClient?.isConnected();
        if (this.statusElement) {
            this.statusElement.textContent = isConnected ? 'Connected' : 'Disconnected';
            this.statusElement.className = `connection-status ${isConnected ? 'connected' : 'disconnected'}`;
        }
    }

    addLogEntry(topic, data) {
        if (!this.updatesLog) return;
        
        if (this.updatesLog.querySelector('.log-placeholder')) {
            this.updatesLog.innerHTML = '';
        }
        
        const entry = document.createElement('div');
        entry.className = 'log-entry';
        entry.innerHTML = `
            <span class="log-time">${new Date().toLocaleTimeString()}</span>
            <span class="log-topic">${topic}</span>
            <span class="log-data">${JSON.stringify(data).substring(0, 50)}...</span>
        `;
        
        this.updatesLog.insertBefore(entry, this.updatesLog.firstChild);
        
        while (this.updatesLog.children.length > 50) {
            this.updatesLog.removeChild(this.updatesLog.lastChild);
        }
    }
}

// ============================================
// CSS STYLES
// ============================================

const liveUpdatesStyles = `
    .live-updates-panel {
        background: var(--bg-card);
        border-radius: 12px;
        padding: 20px;
        border: 1px solid var(--border-color);
    }
    
    .updates-header {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 20px;
        padding-bottom: 12px;
        border-bottom: 1px solid var(--border-color);
    }
    
    .updates-header i {
        font-size: 20px;
        color: var(--primary);
    }
    
    .updates-header h3 {
        flex: 1;
        margin: 0;
    }
    
    .connection-status {
        padding: 4px 12px;
        border-radius: 20px;
        font-size: 12px;
    }
    
    .connection-status.connected {
        background: var(--success-soft);
        color: var(--success);
    }
    
    .connection-status.disconnected {
        background: var(--danger-soft);
        color: var(--danger);
    }
    
    .updates-stats {
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
        color: var(--primary);
    }
    
    .updates-log {
        max-height: 250px;
        overflow-y: auto;
        background: var(--bg-secondary);
        border-radius: 8px;
        padding: 8px;
    }
    
    .log-entry {
        display: flex;
        gap: 12px;
        padding: 6px 8px;
        border-bottom: 1px solid var(--border-light);
        font-size: 11px;
        font-family: monospace;
    }
    
    .log-time {
        color: var(--text-muted);
        width: 70px;
    }
    
    .log-topic {
        color: var(--primary);
        font-weight: 500;
    }
    
    .log-data {
        color: var(--text-secondary);
        flex: 1;
    }
    
    .log-placeholder {
        text-align: center;
        color: var(--text-muted);
        padding: 20px;
    }
`;

// Inject styles
if (typeof document !== 'undefined') {
    const styleSheet = document.createElement('style');
    styleSheet.textContent = liveUpdatesStyles;
    document.head.appendChild(styleSheet);
}

// ============================================
// CREATE SINGLETON INSTANCES
// ============================================

let liveUpdatesManager = null;
let liveUpdatesUI = null;

const initLiveUpdates = (wsClient) => {
    liveUpdatesManager = new LiveUpdatesManager(wsClient);
    liveUpdatesUI = new LiveUpdatesUI(liveUpdatesManager);
    return { liveUpdatesManager, liveUpdatesUI };
};

// Exports
window.LiveUpdatesManager = LiveUpdatesManager;
window.initLiveUpdates = initLiveUpdates;

export { liveUpdatesManager, liveUpdatesUI, LiveUpdatesManager, LiveUpdatesConfig, initLiveUpdates };