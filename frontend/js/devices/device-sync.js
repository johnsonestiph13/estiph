/**
 * ESTIF HOME ULTIMATE - DEVICE SYNC MODULE
 * Real-time device state synchronization across multiple clients and devices
 * Version: 2.0.0
 * Author: Estifanos Yohannis
 */

// ============================================
// DEVICE SYNC CONFIGURATION
// ============================================

const DeviceSyncConfig = {
    // Sync settings
    syncInterval: 5000, // ms
    batchSize: 50,
    maxRetries: 3,
    retryDelay: 1000,
    
    // Conflict resolution
    conflictStrategy: 'server_wins', // 'server_wins', 'client_wins', 'last_write_wins', 'manual'
    
    // Delta sync
    enableDeltaSync: true,
    deltaThreshold: 100, // bytes
    
    // Offline support
    offlineQueueSize: 100,
    syncOnReconnect: true,
    
    // Storage
    storageKey: 'estif_device_sync_state',
    syncHistorySize: 100,
    
    // Debug
    debug: false
};

// ============================================
// SYNC STATE CLASS
// ============================================

class SyncState {
    constructor(deviceId) {
        this.deviceId = deviceId;
        this.localVersion = 0;
        this.remoteVersion = 0;
        this.lastSync = Date.now();
        this.pendingChanges = [];
        this.conflicts = [];
    }

    incrementVersion() {
        this.localVersion++;
        this.lastSync = Date.now();
    }

    updateRemoteVersion(version) {
        this.remoteVersion = version;
        this.lastSync = Date.now();
    }

    hasConflict() {
        return this.conflicts.length > 0;
    }

    addConflict(change) {
        this.conflicts.push(change);
    }

    resolveConflict(resolution) {
        this.conflicts = this.conflicts.filter(c => c.id !== resolution.id);
        if (resolution.resolution === 'local') {
            this.localVersion++;
        }
    }

    toJSON() {
        return {
            deviceId: this.deviceId,
            localVersion: this.localVersion,
            remoteVersion: this.remoteVersion,
            lastSync: this.lastSync,
            pendingChanges: this.pendingChanges,
            conflicts: this.conflicts
        };
    }
}

// ============================================
// CHANGE CLASS
// ============================================

class DeviceChange {
    constructor(deviceId, field, oldValue, newValue, source = 'local') {
        this.id = this.generateId();
        this.deviceId = deviceId;
        this.field = field;
        this.oldValue = oldValue;
        this.newValue = newValue;
        this.source = source;
        this.timestamp = Date.now();
        this.version = 0;
        this.synced = false;
    }

    generateId() {
        return `change_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    toJSON() {
        return {
            id: this.id,
            deviceId: this.deviceId,
            field: this.field,
            oldValue: this.oldValue,
            newValue: this.newValue,
            source: this.source,
            timestamp: this.timestamp,
            version: this.version,
            synced: this.synced
        };
    }
}

// ============================================
// DEVICE SYNC MANAGER
// ============================================

class DeviceSyncManager {
    constructor() {
        this.syncStates = new Map();
        this.pendingChanges = [];
        this.syncQueue = [];
        this.isSyncing = false;
        this.syncTimer = null;
        this.offlineQueue = [];
        this.listeners = [];
        this.syncHistory = [];
        
        this.init();
    }

    init() {
        this.loadSyncState();
        this.startSyncTimer();
        this.setupEventListeners();
        DeviceSyncConfig.debug && console.log('[DeviceSync] Manager initialized');
    }

    loadSyncState() {
        try {
            const saved = localStorage.getItem(DeviceSyncConfig.storageKey);
            if (saved) {
                const data = JSON.parse(saved);
                for (const [deviceId, stateData] of Object.entries(data.syncStates || {})) {
                    const state = new SyncState(deviceId);
                    state.localVersion = stateData.localVersion;
                    state.remoteVersion = stateData.remoteVersion;
                    state.lastSync = stateData.lastSync;
                    this.syncStates.set(deviceId, state);
                }
                this.syncHistory = data.syncHistory || [];
            }
        } catch (error) {
            console.error('[DeviceSync] Failed to load sync state:', error);
        }
    }

    saveSyncState() {
        try {
            const data = {
                syncStates: Object.fromEntries(this.syncStates),
                syncHistory: this.syncHistory.slice(0, DeviceSyncConfig.syncHistorySize)
            };
            localStorage.setItem(DeviceSyncConfig.storageKey, JSON.stringify(data));
        } catch (error) {
            console.error('[DeviceSync] Failed to save sync state:', error);
        }
    }

    // ============================================
    // CHANGE TRACKING
    // ============================================

    trackChange(deviceId, field, oldValue, newValue, source = 'local') {
        if (oldValue === newValue) return null;
        
        const change = new DeviceChange(deviceId, field, oldValue, newValue, source);
        
        // Get or create sync state
        let syncState = this.syncStates.get(deviceId);
        if (!syncState) {
            syncState = new SyncState(deviceId);
            this.syncStates.set(deviceId, syncState);
        }
        
        change.version = syncState.localVersion + 1;
        syncState.incrementVersion();
        
        if (source === 'local') {
            this.pendingChanges.push(change);
            this.addToSyncQueue(change);
        }
        
        this.saveSyncState();
        this.notifyListeners('change_tracked', change);
        
        return change;
    }

    addToSyncQueue(change) {
        this.syncQueue.push(change);
        if (!this.isSyncing) {
            this.processSyncQueue();
        }
    }

    async processSyncQueue() {
        if (this.isSyncing || this.syncQueue.length === 0) return;
        
        this.isSyncing = true;
        
        while (this.syncQueue.length > 0) {
            const batch = this.syncQueue.splice(0, DeviceSyncConfig.batchSize);
            
            try {
                const result = await this.syncBatch(batch);
                this.handleSyncResult(batch, result);
            } catch (error) {
                console.error('[DeviceSync] Batch sync failed:', error);
                // Requeue failed changes
                this.syncQueue.unshift(...batch);
                await this.delay(DeviceSyncConfig.retryDelay);
            }
        }
        
        this.isSyncing = false;
    }

    async syncBatch(changes) {
        // Prepare sync payload
        const payload = {
            changes: changes.map(c => c.toJSON()),
            timestamp: Date.now(),
            clientId: this.getClientId()
        };
        
        // Send to server
        const response = await fetch('/api/devices/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        if (!response.ok) {
            throw new Error(`Sync failed: ${response.statusText}`);
        }
        
        return await response.json();
    }

    handleSyncResult(changes, result) {
        for (const change of changes) {
            const syncState = this.syncStates.get(change.deviceId);
            
            if (result.conflicts && result.conflicts.includes(change.id)) {
                // Handle conflict
                this.handleConflict(change, result);
            } else if (result.success) {
                // Mark as synced
                change.synced = true;
                if (syncState) {
                    syncState.updateRemoteVersion(result.remoteVersion);
                }
                this.recordSyncHistory(change, true);
                this.notifyListeners('change_synced', change);
            } else {
                // Failed sync
                change.synced = false;
                this.recordSyncHistory(change, false, result.error);
                this.notifyListeners('change_sync_failed', { change, error: result.error });
            }
        }
        
        this.saveSyncState();
        this.cleanupSyncedChanges();
    }

    handleConflict(change, result) {
        const syncState = this.syncStates.get(change.deviceId);
        const resolution = this.resolveConflict(change, result.remoteChange);
        
        syncState.addConflict({ change, remoteChange: result.remoteChange, resolution: null });
        
        this.notifyListeners('conflict_detected', {
            change,
            remoteChange: result.remoteChange,
            resolve: (resolution) => this.resolveConflictManually(change.id, resolution)
        });
    }

    resolveConflict(change, remoteChange) {
        switch (DeviceSyncConfig.conflictStrategy) {
            case 'server_wins':
                return 'remote';
            case 'client_wins':
                return 'local';
            case 'last_write_wins':
                return change.timestamp > remoteChange.timestamp ? 'local' : 'remote';
            case 'manual':
                return null;
            default:
                return 'remote';
        }
    }

    resolveConflictManually(changeId, resolution) {
        const syncState = Array.from(this.syncStates.values()).find(s => 
            s.conflicts.some(c => c.change.id === changeId)
        );
        
        if (syncState) {
            syncState.resolveConflict({ id: changeId, resolution });
            this.saveSyncState();
            this.notifyListeners('conflict_resolved', { changeId, resolution });
            
            if (resolution === 'local') {
                // Re-sync the change
                const change = syncState.pendingChanges.find(c => c.id === changeId);
                if (change) {
                    this.addToSyncQueue(change);
                }
            }
        }
    }

    // ============================================
    // DELTA SYNC
    // ============================================

    calculateDelta(oldState, newState) {
        const delta = {};
        for (const [key, value] of Object.entries(newState)) {
            if (JSON.stringify(oldState[key]) !== JSON.stringify(value)) {
                delta[key] = value;
            }
        }
        return delta;
    }

    applyDelta(device, delta) {
        const changes = [];
        for (const [field, value] of Object.entries(delta)) {
            const oldValue = device[field];
            if (oldValue !== value) {
                device[field] = value;
                changes.push(this.trackChange(device.id, field, oldValue, value));
            }
        }
        return changes;
    }

    // ============================================
    // OFFLINE SUPPORT
    // ============================================

    queueOfflineChange(change) {
        if (this.offlineQueue.length >= DeviceSyncConfig.offlineQueueSize) {
            this.offlineQueue.shift();
        }
        this.offlineQueue.push(change);
        this.notifyListeners('offline_change_queued', change);
    }

    async processOfflineQueue() {
        if (!navigator.onLine) return;
        
        while (this.offlineQueue.length > 0) {
            const change = this.offlineQueue.shift();
            this.addToSyncQueue(change);
            await this.delay(100);
        }
        
        this.notifyListeners('offline_queue_processed');
    }

    // ============================================
    // SYNC TIMER
    // ============================================

    startSyncTimer() {
        this.syncTimer = setInterval(() => {
            if (this.pendingChanges.length > 0) {
                this.processSyncQueue();
            }
        }, DeviceSyncConfig.syncInterval);
    }

    stopSyncTimer() {
        if (this.syncTimer) {
            clearInterval(this.syncTimer);
            this.syncTimer = null;
        }
    }

    // ============================================
    // EVENT LISTENERS
    // ============================================

    setupEventListeners() {
        window.addEventListener('online', () => {
            DeviceSyncConfig.debug && console.log('[DeviceSync] Online, processing queue');
            this.processSyncQueue();
            this.processOfflineQueue();
        });
        
        window.addEventListener('beforeunload', () => {
            this.saveSyncState();
        });
    }

    // ============================================
    // UTILITY METHODS
    // ============================================

    getClientId() {
        let clientId = localStorage.getItem('estif_sync_client_id');
        if (!clientId) {
            clientId = `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            localStorage.setItem('estif_sync_client_id', clientId);
        }
        return clientId;
    }

    cleanupSyncedChanges() {
        const cutoff = Date.now() - 24 * 60 * 60 * 1000; // 24 hours
        this.pendingChanges = this.pendingChanges.filter(c => 
            !c.synced || c.timestamp < cutoff
        );
    }

    recordSyncHistory(change, success, error = null) {
        this.syncHistory.unshift({
            changeId: change.id,
            deviceId: change.deviceId,
            field: change.field,
            success,
            error,
            timestamp: Date.now()
        });
        
        if (this.syncHistory.length > DeviceSyncConfig.syncHistorySize) {
            this.syncHistory.pop();
        }
    }

    getSyncStatus(deviceId = null) {
        if (deviceId) {
            const state = this.syncStates.get(deviceId);
            return state ? {
                deviceId,
                localVersion: state.localVersion,
                remoteVersion: state.remoteVersion,
                pendingChanges: state.pendingChanges.length,
                hasConflict: state.hasConflict(),
                lastSync: state.lastSync
            } : null;
        }
        
        return {
            totalDevices: this.syncStates.size,
            pendingChanges: this.pendingChanges.length,
            queueSize: this.syncQueue.length,
            offlineQueueSize: this.offlineQueue.length,
            isSyncing: this.isSyncing
        };
    }

    getPendingChanges(deviceId = null) {
        if (deviceId) {
            return this.pendingChanges.filter(c => c.deviceId === deviceId);
        }
        return [...this.pendingChanges];
    }

    getSyncHistory(limit = 20) {
        return this.syncHistory.slice(0, limit);
    }

    forceSync() {
        this.processSyncQueue();
    }

    reset(deviceId = null) {
        if (deviceId) {
            this.syncStates.delete(deviceId);
            this.pendingChanges = this.pendingChanges.filter(c => c.deviceId !== deviceId);
            this.syncQueue = this.syncQueue.filter(c => c.deviceId !== deviceId);
        } else {
            this.syncStates.clear();
            this.pendingChanges = [];
            this.syncQueue = [];
            this.offlineQueue = [];
        }
        this.saveSyncState();
        this.notifyListeners('sync_reset', { deviceId });
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
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
// DEVICE SYNC UI COMPONENT
// ============================================

class DeviceSyncUI {
    constructor(manager) {
        this.manager = manager;
        this.init();
    }

    init() {
        this.createUI();
        this.bindEvents();
        this.startUpdates();
        DeviceSyncConfig.debug && console.log('[DeviceSyncUI] Initialized');
    }

    createUI() {
        const container = document.getElementById('device-sync-container');
        if (!container) return;

        container.innerHTML = `
            <div class="device-sync-panel">
                <div class="sync-header">
                    <i class="fas fa-sync-alt"></i>
                    <h3>Device Sync Status</h3>
                    <button id="force-sync-btn" class="btn btn-sm btn-primary">
                        <i class="fas fa-sync-alt"></i> Sync Now
                    </button>
                </div>
                
                <div class="sync-stats" id="sync-stats"></div>
                
                <div class="sync-pending" id="sync-pending">
                    <h4>Pending Changes</h4>
                    <div class="pending-list"></div>
                </div>
                
                <div class="sync-history">
                    <h4>Sync History</h4>
                    <div class="history-list"></div>
                </div>
            </div>
        `;

        this.cacheElements();
        this.bindUIEvents();
    }

    cacheElements() {
        this.statsContainer = document.getElementById('sync-stats');
        this.pendingList = document.querySelector('.pending-list');
        this.historyList = document.querySelector('.history-list');
        this.forceSyncBtn = document.getElementById('force-sync-btn');
    }

    bindUIEvents() {
        if (this.forceSyncBtn) {
            this.forceSyncBtn.addEventListener('click', () => this.forceSync());
        }
    }

    bindEvents() {
        this.manager.addEventListener('change_tracked', () => this.updateUI());
        this.manager.addEventListener('change_synced', () => this.updateUI());
        this.manager.addEventListener('change_sync_failed', () => this.updateUI());
        this.manager.addEventListener('conflict_detected', (data) => this.showConflictDialog(data));
    }

    startUpdates() {
        setInterval(() => this.updateUI(), 1000);
    }

    updateUI() {
        this.updateStats();
        this.updatePendingList();
        this.updateHistory();
    }

    updateStats() {
        const stats = this.manager.getSyncStatus();
        
        this.statsContainer.innerHTML = `
            <div class="stat-card">
                <div class="stat-value">${stats.totalDevices}</div>
                <div class="stat-label">Devices</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${stats.pendingChanges}</div>
                <div class="stat-label">Pending Changes</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${stats.isSyncing ? 'Yes' : 'No'}</div>
                <div class="stat-label">Syncing</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${stats.offlineQueueSize}</div>
                <div class="stat-label">Offline Queue</div>
            </div>
        `;
    }

    updatePendingList() {
        const changes = this.manager.getPendingChanges();
        
        if (changes.length === 0) {
            this.pendingList.innerHTML = '<p class="no-data">No pending changes</p>';
            return;
        }
        
        this.pendingList.innerHTML = changes.slice(0, 20).map(change => `
            <div class="pending-item">
                <div class="change-info">
                    <span class="change-device">${change.deviceId.substring(0, 12)}...</span>
                    <span class="change-field">${change.field}</span>
                    <span class="change-values">${JSON.stringify(change.oldValue)} → ${JSON.stringify(change.newValue)}</span>
                </div>
                <div class="change-status">
                    <span class="status ${change.synced ? 'synced' : 'pending'}">
                        ${change.synced ? 'Synced' : 'Pending'}
                    </span>
                </div>
            </div>
        `).join('');
    }

    updateHistory() {
        const history = this.manager.getSyncHistory();
        
        if (history.length === 0) {
            this.historyList.innerHTML = '<p class="no-data">No sync history</p>';
            return;
        }
        
        this.historyList.innerHTML = history.map(record => `
            <div class="history-item ${record.success ? 'success' : 'failed'}">
                <div class="history-time">${new Date(record.timestamp).toLocaleTimeString()}</div>
                <div class="history-device">${record.deviceId.substring(0, 12)}...</div>
                <div class="history-field">${record.field}</div>
                <div class="history-status">${record.success ? '✓' : '✗'}</div>
            </div>
        `).join('');
    }

    showConflictDialog(data) {
        const { change, remoteChange, resolve } = data;
        
        const userChoice = confirm(
            `Conflict detected for device ${change.deviceId}\n` +
            `Local change: ${change.field} = ${JSON.stringify(change.newValue)}\n` +
            `Remote change: ${remoteChange.field} = ${JSON.stringify(remoteChange.newValue)}\n\n` +
            `Click OK to use local version, Cancel to use remote version.`
        );
        
        resolve(userChoice ? 'local' : 'remote');
    }

    forceSync() {
        this.manager.forceSync();
        this.showToast('Sync initiated', 'info');
    }

    showToast(message, type) {
        if (window.showToast) {
            window.showToast(message, type);
        } else {
            console.log(`[Toast] ${type}: ${message}`);
        }
    }
}

// ============================================
// CSS STYLES (Auto-injected)
// ============================================

const deviceSyncStyles = `
    .device-sync-panel {
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
    
    .sync-stats {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 12px;
        margin-bottom: 20px;
    }
    
    .stat-card {
        background: var(--bg-secondary);
        border-radius: 8px;
        padding: 12px;
        text-align: center;
    }
    
    .stat-value {
        font-size: 20px;
        font-weight: 600;
        color: var(--primary);
    }
    
    .stat-label {
        font-size: 11px;
        color: var(--text-muted);
        margin-top: 4px;
    }
    
    .sync-pending, .sync-history {
        margin-top: 20px;
    }
    
    .sync-pending h4, .sync-history h4 {
        margin-bottom: 12px;
    }
    
    .pending-list, .history-list {
        max-height: 200px;
        overflow-y: auto;
    }
    
    .pending-item, .history-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 8px 12px;
        background: var(--bg-secondary);
        border-radius: 6px;
        margin-bottom: 8px;
        font-size: 12px;
    }
    
    .change-info {
        display: flex;
        gap: 12px;
        flex-wrap: wrap;
    }
    
    .change-device {
        font-family: monospace;
        color: var(--primary);
    }
    
    .change-field {
        color: var(--text-secondary);
    }
    
    .change-values {
        color: var(--text-muted);
    }
    
    .status {
        padding: 2px 8px;
        border-radius: 12px;
        font-size: 10px;
    }
    
    .status.pending {
        background: var(--warning-soft);
        color: var(--warning);
    }
    
    .status.synced {
        background: var(--success-soft);
        color: var(--success);
    }
    
    .history-item {
        display: grid;
        grid-template-columns: 80px 100px 80px 30px;
        gap: 8px;
    }
    
    .history-item.success {
        border-left: 3px solid var(--success);
    }
    
    .history-item.failed {
        border-left: 3px solid var(--danger);
    }
    
    .history-time {
        font-size: 10px;
        color: var(--text-muted);
    }
    
    .no-data {
        text-align: center;
        color: var(--text-muted);
        padding: 20px;
    }
`;

// Inject styles
if (typeof document !== 'undefined') {
    const styleSheet = document.createElement('style');
    styleSheet.textContent = deviceSyncStyles;
    document.head.appendChild(styleSheet);
}

// ============================================
// CREATE SINGLETON INSTANCES
// ============================================

const deviceSync = new DeviceSyncManager();
const deviceSyncUI = new DeviceSyncUI(deviceSync);

// ============================================
// EXPORTS
// ============================================

// Expose to window
window.deviceSync = deviceSync;
window.deviceSyncUI = deviceSyncUI;
window.DeviceSyncManager = DeviceSyncManager;
window.DeviceSyncConfig = DeviceSyncConfig;

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        deviceSync,
        deviceSyncUI,
        DeviceSyncManager,
        DeviceSyncConfig
    };
}

// ES modules export
export {
    deviceSync,
    deviceSyncUI,
    DeviceSyncManager,
    DeviceSyncConfig
};