/**
 * ESTIF HOME ULTIMATE - OFFLINE SYNC MODULE
 * Automatic offline data storage and synchronization when connection returns
 * Version: 2.0.0
 * Author: Estifanos Yohannis
 */

// ============================================
// OFFLINE SYNC CONFIGURATION
// ============================================

const OfflineSyncConfig = {
    // Storage settings
    dbName: 'EstifHomeDB',
    dbVersion: 1,
    stores: {
        actions: 'offline_actions',
        devices: 'devices_cache',
        homes: 'homes_cache',
        automations: 'automations_cache',
        activity: 'activity_logs',
        pending: 'pending_requests'
    },
    
    // Sync settings
    syncOnReconnect: true,
    syncInterval: 30000, // 30 seconds
    syncRetryAttempts: 5,
    syncRetryDelay: 5000, // 5 seconds
    maxQueueSize: 1000,
    
    // Conflict resolution
    conflictStrategy: 'server_wins', // 'server_wins', 'client_wins', 'manual'
    
    // Cache settings
    cacheTTL: 86400000, // 24 hours
    maxCacheSize: 50,
    
    // Debug
    debug: false
};

// ============================================
// INDEXEDDB MANAGER
// ============================================

class IndexedDBManager {
    constructor() {
        this.db = null;
        this.isInitialized = false;
        this.init();
    }

    async init() {
        await this.openDatabase();
        this.isInitialized = true;
        OfflineSyncConfig.debug && console.log('[IndexedDB] Initialized');
    }

    openDatabase() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(OfflineSyncConfig.dbName, OfflineSyncConfig.dbVersion);
            
            request.onerror = () => {
                console.error('[IndexedDB] Open failed:', request.error);
                reject(request.error);
            };
            
            request.onsuccess = () => {
                this.db = request.result;
                resolve();
            };
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                // Create object stores
                if (!db.objectStoreNames.contains(OfflineSyncConfig.stores.actions)) {
                    const actionStore = db.createObjectStore(OfflineSyncConfig.stores.actions, { 
                        keyPath: 'id', 
                        autoIncrement: true 
                    });
                    actionStore.createIndex('timestamp', 'timestamp', { unique: false });
                    actionStore.createIndex('synced', 'synced', { unique: false });
                    actionStore.createIndex('priority', 'priority', { unique: false });
                }
                
                if (!db.objectStoreNames.contains(OfflineSyncConfig.stores.devices)) {
                    const deviceStore = db.createObjectStore(OfflineSyncConfig.stores.devices, { 
                        keyPath: 'id' 
                    });
                    deviceStore.createIndex('lastUpdated', 'lastUpdated', { unique: false });
                }
                
                if (!db.objectStoreNames.contains(OfflineSyncConfig.stores.homes)) {
                    const homeStore = db.createObjectStore(OfflineSyncConfig.stores.homes, { 
                        keyPath: 'id' 
                    });
                    homeStore.createIndex('lastUpdated', 'lastUpdated', { unique: false });
                }
                
                if (!db.objectStoreNames.contains(OfflineSyncConfig.stores.automations)) {
                    const autoStore = db.createObjectStore(OfflineSyncConfig.stores.automations, { 
                        keyPath: 'id' 
                    });
                    autoStore.createIndex('lastUpdated', 'lastUpdated', { unique: false });
                }
                
                if (!db.objectStoreNames.contains(OfflineSyncConfig.stores.activity)) {
                    const activityStore = db.createObjectStore(OfflineSyncConfig.stores.activity, { 
                        keyPath: 'id', 
                        autoIncrement: true 
                    });
                    activityStore.createIndex('timestamp', 'timestamp', { unique: false });
                }
                
                if (!db.objectStoreNames.contains(OfflineSyncConfig.stores.pending)) {
                    const pendingStore = db.createObjectStore(OfflineSyncConfig.stores.pending, { 
                        keyPath: 'id', 
                        autoIncrement: true 
                    });
                    pendingStore.createIndex('url', 'url', { unique: false });
                    pendingStore.createIndex('timestamp', 'timestamp', { unique: false });
                }
            };
        });
    }

    async add(storeName, data) {
        if (!this.isInitialized) await this.init();
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.add(data);
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async put(storeName, data) {
        if (!this.isInitialized) await this.init();
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.put(data);
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async get(storeName, key) {
        if (!this.isInitialized) await this.init();
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.get(key);
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async getAll(storeName, indexName = null, indexValue = null) {
        if (!this.isInitialized) await this.init();
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            let request;
            
            if (indexName && indexValue !== null) {
                const index = store.index(indexName);
                request = index.getAll(indexValue);
            } else {
                request = store.getAll();
            }
            
            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => reject(request.error);
        });
    }

    async delete(storeName, key) {
        if (!this.isInitialized) await this.init();
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.delete(key);
            
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async clear(storeName) {
        if (!this.isInitialized) await this.init();
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.clear();
            
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async getCount(storeName, indexName = null, indexValue = null) {
        if (!this.isInitialized) await this.init();
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            let request;
            
            if (indexName && indexValue !== null) {
                const index = store.index(indexName);
                request = index.count(indexValue);
            } else {
                request = store.count();
            }
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }
}

// ============================================
// OFFLINE ACTION QUEUE
// ============================================

class OfflineActionQueue {
    constructor(db) {
        this.db = db;
        this.isProcessing = false;
        this.priorityOrder = ['high', 'normal', 'low'];
    }

    async addAction(action) {
        const actionData = {
            ...action,
            timestamp: Date.now(),
            synced: false,
            retryCount: 0,
            priority: action.priority || 'normal'
        };
        
        const count = await this.db.getCount(OfflineSyncConfig.stores.actions);
        if (count >= OfflineSyncConfig.maxQueueSize) {
            await this.cleanOldActions();
        }
        
        await this.db.add(OfflineSyncConfig.stores.actions, actionData);
        OfflineSyncConfig.debug && console.log('[OfflineSync] Action queued:', action.type);
        
        return actionData;
    }

    async getPendingActions() {
        return await this.db.getAll(OfflineSyncConfig.stores.actions, 'synced', false);
    }

    async markSynced(actionId) {
        const action = await this.db.get(OfflineSyncConfig.stores.actions, actionId);
        if (action) {
            action.synced = true;
            action.syncedAt = Date.now();
            await this.db.put(OfflineSyncConfig.stores.actions, action);
        }
    }

    async removeAction(actionId) {
        await this.db.delete(OfflineSyncConfig.stores.actions, actionId);
    }

    async cleanOldActions() {
        const actions = await this.getPendingActions();
        const sorted = actions.sort((a, b) => a.timestamp - b.timestamp);
        
        // Remove oldest actions
        const toRemove = sorted.slice(0, Math.floor(sorted.length / 2));
        for (const action of toRemove) {
            await this.removeAction(action.id);
        }
    }

    async processQueue(syncHandler) {
        if (this.isProcessing) return;
        
        this.isProcessing = true;
        
        try {
            let actions = await this.getPendingActions();
            
            // Sort by priority
            actions.sort((a, b) => {
                const priorityA = this.priorityOrder.indexOf(a.priority);
                const priorityB = this.priorityOrder.indexOf(b.priority);
                if (priorityA !== priorityB) return priorityA - priorityB;
                return a.timestamp - b.timestamp;
            });
            
            for (const action of actions) {
                try {
                    const result = await syncHandler(action);
                    if (result.success) {
                        await this.markSynced(action.id);
                        OfflineSyncConfig.debug && console.log('[OfflineSync] Action synced:', action.type);
                    } else if (action.retryCount >= OfflineSyncConfig.syncRetryAttempts) {
                        await this.removeAction(action.id);
                        console.warn('[OfflineSync] Action failed after retries:', action.type);
                    } else {
                        action.retryCount++;
                        await this.db.put(OfflineSyncConfig.stores.actions, action);
                    }
                } catch (error) {
                    console.error('[OfflineSync] Action sync error:', error);
                    if (action.retryCount >= OfflineSyncConfig.syncRetryAttempts) {
                        await this.removeAction(action.id);
                    } else {
                        action.retryCount++;
                        await this.db.put(OfflineSyncConfig.stores.actions, action);
                    }
                }
            }
        } finally {
            this.isProcessing = false;
        }
    }
}

// ============================================
// CACHE MANAGER
// ============================================

class CacheManager {
    constructor(db) {
        this.db = db;
        this.cache = new Map();
    }

    async cacheDevices(devices) {
        for (const device of devices) {
            device.lastUpdated = Date.now();
            await this.db.put(OfflineSyncConfig.stores.devices, device);
        }
        await this.cleanCache(OfflineSyncConfig.stores.devices);
    }

    async cacheHomes(homes) {
        for (const home of homes) {
            home.lastUpdated = Date.now();
            await this.db.put(OfflineSyncConfig.stores.homes, home);
        }
        await this.cleanCache(OfflineSyncConfig.stores.homes);
    }

    async cacheAutomations(automations) {
        for (const automation of automations) {
            automation.lastUpdated = Date.now();
            await this.db.put(OfflineSyncConfig.stores.automations, automation);
        }
        await this.cleanCache(OfflineSyncConfig.stores.automations);
    }

    async getCachedDevices() {
        return await this.db.getAll(OfflineSyncConfig.stores.devices);
    }

    async getCachedHomes() {
        return await this.db.getAll(OfflineSyncConfig.stores.homes);
    }

    async getCachedAutomations() {
        return await this.db.getAll(OfflineSyncConfig.stores.automations);
    }

    async getCachedDevice(deviceId) {
        return await this.db.get(OfflineSyncConfig.stores.devices, deviceId);
    }

    async updateCachedDevice(device) {
        device.lastUpdated = Date.now();
        await this.db.put(OfflineSyncConfig.stores.devices, device);
    }

    async cleanCache(storeName) {
        const items = await this.db.getAll(storeName);
        const now = Date.now();
        
        // Filter expired items
        const validItems = items.filter(item => 
            now - (item.lastUpdated || 0) < OfflineSyncConfig.cacheTTL
        );
        
        // Keep only maxCacheSize items
        if (validItems.length > OfflineSyncConfig.maxCacheSize) {
            validItems.sort((a, b) => (b.lastUpdated || 0) - (a.lastUpdated || 0));
            const toKeep = validItems.slice(0, OfflineSyncConfig.maxCacheSize);
            
            // Clear and re-add
            await this.db.clear(storeName);
            for (const item of toKeep) {
                await this.db.put(storeName, item);
            }
        } else if (validItems.length !== items.length) {
            await this.db.clear(storeName);
            for (const item of validItems) {
                await this.db.put(storeName, item);
            }
        }
    }

    async clearCache() {
        await this.db.clear(OfflineSyncConfig.stores.devices);
        await this.db.clear(OfflineSyncConfig.stores.homes);
        await this.db.clear(OfflineSyncConfig.stores.automations);
    }
}

// ============================================
// OFFLINE SYNC MANAGER
// ============================================

class OfflineSyncManager {
    constructor() {
        this.db = new IndexedDBManager();
        this.actionQueue = null;
        this.cacheManager = null;
        this.isOnline = navigator.onLine;
        this.syncTimer = null;
        this.listeners = [];
        
        this.init();
    }

    async init() {
        await this.db.init();
        this.actionQueue = new OfflineActionQueue(this.db);
        this.cacheManager = new CacheManager(this.db);
        
        this.setupEventListeners();
        this.startSyncTimer();
        
        OfflineSyncConfig.debug && console.log('[OfflineSync] Manager initialized');
    }

    setupEventListeners() {
        window.addEventListener('online', () => {
            this.isOnline = true;
            this.notifyListeners('online', { timestamp: Date.now() });
            
            if (OfflineSyncConfig.syncOnReconnect) {
                this.syncNow();
            }
        });
        
        window.addEventListener('offline', () => {
            this.isOnline = false;
            this.notifyListeners('offline', { timestamp: Date.now() });
        });
    }

    startSyncTimer() {
        this.syncTimer = setInterval(() => {
            if (this.isOnline) {
                this.syncNow();
            }
        }, OfflineSyncConfig.syncInterval);
    }

    stopSyncTimer() {
        if (this.syncTimer) {
            clearInterval(this.syncTimer);
            this.syncTimer = null;
        }
    }

    async syncNow() {
        if (!this.isOnline) {
            OfflineSyncConfig.debug && console.log('[OfflineSync] Cannot sync - offline');
            return;
        }
        
        OfflineSyncConfig.debug && console.log('[OfflineSync] Starting sync...');
        this.notifyListeners('sync_started', { timestamp: Date.now() });
        
        await this.actionQueue.processQueue(async (action) => {
            return await this.executeSyncAction(action);
        });
        
        this.notifyListeners('sync_completed', { timestamp: Date.now() });
        OfflineSyncConfig.debug && console.log('[OfflineSync] Sync completed');
    }

    async executeSyncAction(action) {
        try {
            let response;
            
            switch (action.type) {
                case 'device_toggle':
                    response = await fetch(`/api/device/${action.deviceId}/toggle`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ state: action.state })
                    });
                    break;
                    
                case 'device_auto_mode':
                    response = await fetch(`/api/device/${action.deviceId}/auto`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ enabled: action.enabled })
                    });
                    break;
                    
                case 'master_control':
                    response = await fetch(`/api/master/${action.state ? 'on' : 'off'}`, {
                        method: 'POST'
                    });
                    break;
                    
                case 'device_add':
                    response = await fetch('/api/devices', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(action.device)
                    });
                    break;
                    
                case 'device_edit':
                    response = await fetch(`/api/device/${action.deviceId}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(action.data)
                    });
                    break;
                    
                case 'device_delete':
                    response = await fetch(`/api/device/${action.deviceId}`, {
                        method: 'DELETE'
                    });
                    break;
                    
                case 'automation_toggle':
                    response = await fetch(`/api/automation/${action.ruleId}/toggle`, {
                        method: 'POST',
                        body: JSON.stringify({ enabled: action.enabled })
                    });
                    break;
                    
                case 'activity_log':
                    // Activity logs are stored locally, no sync needed
                    return { success: true };
                    
                default:
                    console.warn('[OfflineSync] Unknown action type:', action.type);
                    return { success: false, error: 'Unknown action type' };
            }
            
            if (response && response.ok) {
                return { success: true };
            } else {
                const error = await response?.text();
                return { success: false, error };
            }
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // ============================================
    // PUBLIC METHODS
    // ============================================

    async queueAction(action) {
        if (this.isOnline && !action.forceOffline) {
            // Execute immediately if online
            try {
                const result = await this.executeSyncAction(action);
                if (result.success) {
                    this.notifyListeners('action_executed', action);
                    return result;
                }
            } catch (error) {
                console.error('[OfflineSync] Immediate execution failed:', error);
            }
        }
        
        // Queue for later sync
        const queuedAction = await this.actionQueue.addAction(action);
        this.notifyListeners('action_queued', queuedAction);
        
        return { success: true, queued: true, actionId: queuedAction.id };
    }

    async toggleDevice(deviceId, state) {
        return this.queueAction({
            type: 'device_toggle',
            deviceId,
            state,
            priority: 'high'
        });
    }

    async setAutoMode(deviceId, enabled) {
        return this.queueAction({
            type: 'device_auto_mode',
            deviceId,
            enabled,
            priority: 'normal'
        });
    }

    async masterControl(state) {
        return this.queueAction({
            type: 'master_control',
            state,
            priority: 'high'
        });
    }

    async addDevice(device) {
        return this.queueAction({
            type: 'device_add',
            device,
            priority: 'normal'
        });
    }

    async editDevice(deviceId, data) {
        return this.queueAction({
            type: 'device_edit',
            deviceId,
            data,
            priority: 'normal'
        });
    }

    async deleteDevice(deviceId) {
        return this.queueAction({
            type: 'device_delete',
            deviceId,
            priority: 'normal'
        });
    }

    async toggleAutomation(ruleId, enabled) {
        return this.queueAction({
            type: 'automation_toggle',
            ruleId,
            enabled,
            priority: 'normal'
        });
    }

    async logActivity(action, message) {
        return this.queueAction({
            type: 'activity_log',
            action,
            message,
            timestamp: Date.now(),
            priority: 'low'
        });
    }

    async getPendingCount() {
        const actions = await this.actionQueue.getPendingActions();
        return actions.length;
    }

    async getSyncStatus() {
        const pendingCount = await this.getPendingCount();
        return {
            isOnline: this.isOnline,
            pendingActions: pendingCount,
            isSyncing: this.actionQueue.isProcessing,
            lastSync: null // Track last sync time
        };
    }

    async clearQueue() {
        await this.db.clear(OfflineSyncConfig.stores.actions);
        this.notifyListeners('queue_cleared');
    }

    // ============================================
    // CACHE METHODS
    // ============================================

    async cacheData(type, data) {
        switch (type) {
            case 'devices':
                await this.cacheManager.cacheDevices(data);
                break;
            case 'homes':
                await this.cacheManager.cacheHomes(data);
                break;
            case 'automations':
                await this.cacheManager.cacheAutomations(data);
                break;
        }
        this.notifyListeners('data_cached', { type, data });
    }

    async getCachedData(type) {
        switch (type) {
            case 'devices':
                return await this.cacheManager.getCachedDevices();
            case 'homes':
                return await this.cacheManager.getCachedHomes();
            case 'automations':
                return await this.cacheManager.getCachedAutomations();
            default:
                return null;
        }
    }

    async clearCache() {
        await this.cacheManager.clearCache();
        this.notifyListeners('cache_cleared');
    }

    // ============================================
    // CONFLICT RESOLUTION
    // ============================================

    resolveConflict(local, remote) {
        switch (OfflineSyncConfig.conflictStrategy) {
            case 'server_wins':
                return remote;
            case 'client_wins':
                return local;
            case 'manual':
                this.notifyListeners('conflict_detected', { local, remote });
                return local; // Return local until manual resolution
            default:
                return remote;
        }
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
// OFFLINE SYNC UI COMPONENT
// ============================================

class OfflineSyncUI {
    constructor(syncManager) {
        this.syncManager = syncManager;
        this.init();
    }

    init() {
        this.createUI();
        this.bindEvents();
        this.startStatusUpdates();
        OfflineSyncConfig.debug && console.log('[OfflineSyncUI] Initialized');
    }

    createUI() {
        const container = document.getElementById('offline-sync-container');
        if (!container) return;

        container.innerHTML = `
            <div class="offline-sync-panel">
                <div class="sync-header">
                    <i class="fas fa-sync-alt"></i>
                    <h3>Offline Sync</h3>
                    <span class="sync-status" id="sync-status">Ready</span>
                </div>
                
                <div class="sync-stats">
                    <div class="stat">
                        <span class="stat-label">Pending Actions</span>
                        <span class="stat-value" id="pending-count">0</span>
                    </div>
                    <div class="stat">
                        <span class="stat-label">Connection</span>
                        <span class="stat-value" id="connection-status">${this.syncManager.isOnline ? 'Online' : 'Offline'}</span>
                    </div>
                </div>
                
                <div class="sync-actions">
                    <button id="sync-now-btn" class="btn btn-primary" ${!this.syncManager.isOnline ? 'disabled' : ''}>
                        <i class="fas fa-sync-alt"></i> Sync Now
                    </button>
                    <button id="clear-queue-btn" class="btn btn-secondary">
                        <i class="fas fa-trash"></i> Clear Queue
                    </button>
                </div>
                
                <div class="pending-actions" id="pending-actions">
                    <h4>Pending Actions</h4>
                    <div class="actions-list"></div>
                </div>
            </div>
        `;

        this.cacheElements();
        this.updatePendingList();
    }

    cacheElements() {
        this.statusSpan = document.getElementById('sync-status');
        this.pendingCountSpan = document.getElementById('pending-count');
        this.connectionStatusSpan = document.getElementById('connection-status');
        this.syncNowBtn = document.getElementById('sync-now-btn');
        this.clearQueueBtn = document.getElementById('clear-queue-btn');
        this.actionsList = document.querySelector('.actions-list');
    }

    bindEvents() {
        if (this.syncNowBtn) {
            this.syncNowBtn.addEventListener('click', () => this.syncNow());
        }
        
        if (this.clearQueueBtn) {
            this.clearQueueBtn.addEventListener('click', () => this.clearQueue());
        }
        
        this.syncManager.addEventListener('action_queued', () => this.updatePendingList());
        this.syncManager.addEventListener('sync_started', () => this.setSyncing(true));
        this.syncManager.addEventListener('sync_completed', () => this.setSyncing(false));
        this.syncManager.addEventListener('online', () => this.updateConnectionStatus(true));
        this.syncManager.addEventListener('offline', () => this.updateConnectionStatus(false));
    }

    startStatusUpdates() {
        setInterval(async () => {
            const status = await this.syncManager.getSyncStatus();
            this.updatePendingCount(status.pendingActions);
        }, 2000);
    }

    async updatePendingList() {
        if (!this.actionsList) return;
        
        const actions = await this.syncManager.actionQueue.getPendingActions();
        
        if (actions.length === 0) {
            this.actionsList.innerHTML = '<p class="no-actions">No pending actions</p>';
            return;
        }
        
        this.actionsList.innerHTML = actions.slice(0, 10).map(action => `
            <div class="action-item" data-action-id="${action.id}">
                <div class="action-info">
                    <span class="action-type">${action.type}</span>
                    <span class="action-time">${new Date(action.timestamp).toLocaleTimeString()}</span>
                </div>
                <div class="action-status">
                    ${action.synced ? '<span class="synced">✓ Synced</span>' : 
                      action.retryCount > 0 ? `<span class="retrying">Retrying (${action.retryCount}/${OfflineSyncConfig.syncRetryAttempts})</span>` :
                      '<span class="pending">Pending</span>'}
                </div>
            </div>
        `).join('');
    }

    updatePendingCount(count) {
        if (this.pendingCountSpan) {
            this.pendingCountSpan.textContent = count;
        }
    }

    updateConnectionStatus(online) {
        if (this.connectionStatusSpan) {
            this.connectionStatusSpan.textContent = online ? 'Online' : 'Offline';
            this.connectionStatusSpan.className = `stat-value ${online ? 'online' : 'offline'}`;
        }
        
        if (this.syncNowBtn) {
            this.syncNowBtn.disabled = !online;
        }
    }

    setSyncing(syncing) {
        if (this.statusSpan) {
            this.statusSpan.textContent = syncing ? 'Syncing...' : 'Ready';
        }
        
        if (this.syncNowBtn) {
            if (!syncing) {
                this.syncNowBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Sync Now';
            } else {
                this.syncNowBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Syncing...';
            }
        }
    }

    async syncNow() {
        await this.syncManager.syncNow();
        this.updatePendingList();
    }

    async clearQueue() {
        if (confirm('Are you sure you want to clear all pending actions?')) {
            await this.syncManager.clearQueue();
            this.updatePendingList();
        }
    }
}

// ============================================
// CSS STYLES (Auto-injected)
// ============================================

const offlineSyncStyles = `
    .offline-sync-panel {
        background: var(--bg-card);
        border-radius: 12px;
        padding: 20px;
        border: 1px solid var(--border-color);
    }
    
    .sync-header {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 20px;
        padding-bottom: 12px;
        border-bottom: 1px solid var(--border-color);
    }
    
    .sync-header i {
        font-size: 20px;
        color: var(--primary);
    }
    
    .sync-header h3 {
        flex: 1;
        margin: 0;
    }
    
    .sync-status {
        padding: 4px 12px;
        border-radius: 20px;
        font-size: 12px;
        font-weight: 500;
        background: var(--success-soft);
        color: var(--success);
    }
    
    .sync-stats {
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
    
    .stat-value.online { color: var(--success); }
    .stat-value.offline { color: var(--danger); }
    
    .sync-actions {
        display: flex;
        gap: 12px;
        margin-bottom: 20px;
    }
    
    .pending-actions h4 {
        margin-bottom: 12px;
    }
    
    .actions-list {
        max-height: 250px;
        overflow-y: auto;
        background: var(--bg-secondary);
        border-radius: 8px;
        padding: 8px;
    }
    
    .action-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 10px;
        border-bottom: 1px solid var(--border-color);
    }
    
    .action-item:last-child {
        border-bottom: none;
    }
    
    .action-type {
        font-weight: 500;
        font-size: 12px;
        text-transform: uppercase;
        color: var(--primary);
    }
    
    .action-time {
        font-size: 10px;
        color: var(--text-muted);
        margin-left: 8px;
    }
    
    .action-status span {
        font-size: 11px;
        padding: 2px 8px;
        border-radius: 12px;
    }
    
    .synced { background: var(--success-soft); color: var(--success); }
    .pending { background: var(--warning-soft); color: var(--warning); }
    .retrying { background: var(--info-soft); color: var(--info); }
    
    .no-actions {
        text-align: center;
        color: var(--text-muted);
        padding: 20px;
    }
`;

// Inject styles
if (typeof document !== 'undefined') {
    const styleSheet = document.createElement('style');
    styleSheet.textContent = offlineSyncStyles;
    document.head.appendChild(styleSheet);
}

// ============================================
// CREATE SINGLETON INSTANCES
// ============================================

const offlineSyncManager = new OfflineSyncManager();
const offlineSyncUI = new OfflineSyncUI(offlineSyncManager);

// ============================================
// EXPORTS
// ============================================

// Expose to window
window.offlineSyncManager = offlineSyncManager;
window.offlineSyncUI = offlineSyncUI;
window.OfflineSyncManager = OfflineSyncManager;
window.OfflineSyncConfig = OfflineSyncConfig;

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        offlineSyncManager,
        offlineSyncUI,
        OfflineSyncManager,
        OfflineSyncConfig
    };
}

// ES modules export
export {
    offlineSyncManager,
    offlineSyncUI,
    OfflineSyncManager,
    OfflineSyncConfig
};