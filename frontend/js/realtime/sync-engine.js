/**
 * ESTIF HOME ULTIMATE - SYNC ENGINE MODULE
 * Real-time data synchronization across multiple clients with conflict resolution
 * Version: 2.0.0
 * Author: Estifanos Yohannis
 */

// ============================================
// SYNC ENGINE CONFIGURATION
// ============================================

const SyncEngineConfig = {
    // Sync settings
    syncInterval: 1000, // ms between sync checks
    batchSize: 50,
    maxRetries: 3,
    retryDelay: 1000,
    
    // Conflict resolution
    conflictStrategy: 'last_write_wins', // 'last_write_wins', 'client_wins', 'server_wins', 'manual'
    
    // Storage
    storageKey: 'estif_sync_state',
    pendingOpsKey: 'estif_pending_ops',
    
    // Debug
    debug: false
};

// ============================================
// SYNC OPERATION CLASS
// ============================================

class SyncOperation {
    constructor(data) {
        this.id = data.id || this.generateId();
        this.type = data.type; // 'device_update', 'setting_change', 'member_add', etc.
        this.entityId = data.entityId;
        this.entityType = data.entityType;
        this.operation = data.operation; // 'create', 'update', 'delete'
        this.data = data.data;
        this.timestamp = data.timestamp || Date.now();
        this.clientId = data.clientId || this.getClientId();
        this.version = data.version || 0;
        this.retryCount = 0;
        this.synced = false;
        this.conflict = false;
    }

    generateId() {
        return `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    getClientId() {
        let clientId = localStorage.getItem('estif_client_id');
        if (!clientId) {
            clientId = `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            localStorage.setItem('estif_client_id', clientId);
        }
        return clientId;
    }

    toJSON() {
        return {
            id: this.id,
            type: this.type,
            entityId: this.entityId,
            entityType: this.entityType,
            operation: this.operation,
            data: this.data,
            timestamp: this.timestamp,
            clientId: this.clientId,
            version: this.version,
            retryCount: this.retryCount,
            synced: this.synced,
            conflict: this.conflict
        };
    }
}

// ============================================
// SYNC ENGINE
// ============================================

class SyncEngine {
    constructor(wsClient, store) {
        this.wsClient = wsClient;
        this.store = store;
        this.pendingOperations = [];
        this.syncInterval = null;
        this.isSyncing = false;
        this.versionMap = new Map(); // entityType:entityId -> version
        this.conflictHandlers = new Map();
        this.listeners = [];
        
        this.init();
    }

    init() {
        this.loadPendingOperations();
        this.loadVersionMap();
        this.startSync();
        this.setupWebSocketHandlers();
        SyncEngineConfig.debug && console.log('[SyncEngine] Initialized');
    }

    loadPendingOperations() {
        try {
            const saved = localStorage.getItem(SyncEngineConfig.pendingOpsKey);
            if (saved) {
                const ops = JSON.parse(saved);
                this.pendingOperations = ops.map(op => Object.assign(new SyncOperation(op), op));
                SyncEngineConfig.debug && console.log('[SyncEngine] Loaded', this.pendingOperations.length, 'pending operations');
            }
        } catch (error) {
            console.error('[SyncEngine] Failed to load pending operations:', error);
        }
    }

    savePendingOperations() {
        try {
            localStorage.setItem(SyncEngineConfig.pendingOpsKey, JSON.stringify(this.pendingOperations));
        } catch (error) {
            console.error('[SyncEngine] Failed to save pending operations:', error);
        }
    }

    loadVersionMap() {
        try {
            const saved = localStorage.getItem(SyncEngineConfig.storageKey);
            if (saved) {
                const versionMap = JSON.parse(saved);
                for (const [key, version] of Object.entries(versionMap)) {
                    this.versionMap.set(key, version);
                }
            }
        } catch (error) {
            console.error('[SyncEngine] Failed to load version map:', error);
        }
    }

    saveVersionMap() {
        try {
            const versionMap = Object.fromEntries(this.versionMap);
            localStorage.setItem(SyncEngineConfig.storageKey, JSON.stringify(versionMap));
        } catch (error) {
            console.error('[SyncEngine] Failed to save version map:', error);
        }
    }

    // ============================================
    // OPERATION QUEUE
    // ============================================

    queueOperation(operationData) {
        const operation = new SyncOperation(operationData);
        this.pendingOperations.push(operation);
        this.savePendingOperations();
        this.notifyListeners('operation_queued', operation);
        
        if (this.wsClient.isConnected()) {
            this.processQueue();
        }
        
        return operation;
    }

    async processQueue() {
        if (this.isSyncing || this.pendingOperations.length === 0) return;
        
        this.isSyncing = true;
        
        const batch = this.pendingOperations.splice(0, SyncEngineConfig.batchSize);
        
        for (const operation of batch) {
            try {
                const success = await this.sendOperation(operation);
                if (success) {
                    this.markSynced(operation);
                } else {
                    this.handleFailedOperation(operation);
                }
            } catch (error) {
                console.error('[SyncEngine] Failed to sync operation:', error);
                this.handleFailedOperation(operation);
            }
        }
        
        this.isSyncing = false;
        this.savePendingOperations();
        
        if (this.pendingOperations.length > 0) {
            setTimeout(() => this.processQueue(), SyncEngineConfig.retryDelay);
        }
    }

    async sendOperation(operation) {
        return new Promise((resolve) => {
            this.wsClient.request('sync_operation', operation.toJSON(), 5000)
                .then((response) => {
                    if (response.conflict) {
                        this.handleConflict(operation, response);
                        resolve(false);
                    } else {
                        resolve(true);
                    }
                })
                .catch(() => resolve(false));
        });
    }

    markSynced(operation) {
        operation.synced = true;
        this.updateVersion(operation);
        this.notifyListeners('operation_synced', operation);
    }

    handleFailedOperation(operation) {
        if (operation.retryCount < SyncEngineConfig.maxRetries) {
            operation.retryCount++;
            this.pendingOperations.unshift(operation);
            this.notifyListeners('operation_retry', operation);
        } else {
            this.notifyListeners('operation_failed', operation);
        }
    }

    updateVersion(operation) {
        const key = `${operation.entityType}:${operation.entityId}`;
        this.versionMap.set(key, operation.version);
        this.saveVersionMap();
    }

    // ============================================
    // CONFLICT HANDLING
    // ============================================

    handleConflict(operation, serverState) {
        operation.conflict = true;
        
        const strategy = this.conflictHandlers.get(operation.type) || SyncEngineConfig.conflictStrategy;
        
        let resolution;
        switch (strategy) {
            case 'last_write_wins':
                resolution = operation.timestamp > serverState.timestamp ? operation : serverState;
                break;
            case 'client_wins':
                resolution = operation;
                break;
            case 'server_wins':
                resolution = serverState;
                break;
            case 'manual':
                this.emitConflictResolution(operation, serverState);
                return;
            default:
                resolution = serverState;
        }
        
        this.applyResolution(resolution, operation, serverState);
    }

    emitConflictResolution(operation, serverState) {
        this.notifyListeners('conflict_detected', {
            operation,
            serverState,
            resolve: (resolution) => this.applyResolution(resolution, operation, serverState)
        });
    }

    applyResolution(resolution, operation, serverState) {
        if (resolution === operation) {
            // Client wins - resync with updated version
            operation.version = serverState.version + 1;
            operation.conflict = false;
            this.pendingOperations.unshift(operation);
        } else {
            // Server wins - discard local operation
            const index = this.pendingOperations.indexOf(operation);
            if (index !== -1) this.pendingOperations.splice(index, 1);
            this.applyServerState(serverState);
        }
        
        this.savePendingOperations();
        this.notifyListeners('conflict_resolved', { operation, resolution });
    }

    applyServerState(serverState) {
        // Update local store with server state
        if (this.store) {
            this.store.dispatch('sync/applyServerState', serverState);
        }
        this.updateVersion({ entityType: serverState.entityType, entityId: serverState.entityId, version: serverState.version });
    }

    // ============================================
    // WEB SOCKET HANDLERS
    // ============================================

    setupWebSocketHandlers() {
        if (!this.wsClient) return;
        
        this.wsClient.on('sync_operation', (data) => {
            this.handleIncomingOperation(data);
        });
        
        this.wsClient.on('sync_batch', (batch) => {
            batch.forEach(op => this.handleIncomingOperation(op));
        });
        
        this.wsClient.on('sync_complete', () => {
            this.notifyListeners('sync_complete');
        });
    }

    handleIncomingOperation(operationData) {
        const key = `${operationData.entityType}:${operationData.entityId}`;
        const currentVersion = this.versionMap.get(key) || 0;
        
        if (operationData.version > currentVersion) {
            // Newer version, apply to local store
            this.applyRemoteOperation(operationData);
            this.updateVersion({ entityType: operationData.entityType, entityId: operationData.entityId, version: operationData.version });
            this.notifyListeners('remote_operation_applied', operationData);
        } else if (operationData.version < currentVersion) {
            // Older version, send current state back
            this.sendCurrentState(operationData);
        }
    }

    applyRemoteOperation(operationData) {
        if (!this.store) return;
        
        switch (operationData.operation) {
            case 'create':
                this.store.dispatch('sync/createEntity', operationData);
                break;
            case 'update':
                this.store.dispatch('sync/updateEntity', operationData);
                break;
            case 'delete':
                this.store.dispatch('sync/deleteEntity', operationData);
                break;
        }
    }

    sendCurrentState(operationData) {
        if (!this.store) return;
        
        const state = this.store.getState();
        const entity = state[operationData.entityType]?.find(e => e.id === operationData.entityId);
        
        if (entity) {
            const syncOp = new SyncOperation({
                type: operationData.type,
                entityId: operationData.entityId,
                entityType: operationData.entityType,
                operation: 'update',
                data: entity,
                version: this.versionMap.get(`${operationData.entityType}:${operationData.entityId}`)
            });
            this.wsClient.send('sync_operation', syncOp.toJSON());
        }
    }

    // ============================================
    // SYNC CONTROL
    // ============================================

    startSync() {
        this.syncInterval = setInterval(() => {
            if (this.wsClient.isConnected() && this.pendingOperations.length > 0) {
                this.processQueue();
            }
        }, SyncEngineConfig.syncInterval);
    }

    stopSync() {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
            this.syncInterval = null;
        }
    }

    forceSync() {
        this.processQueue();
    }

    // ============================================
    // CONFLICT RESOLUTION STRATEGIES
    // ============================================

    setConflictStrategy(operationType, strategy) {
        this.conflictHandlers.set(operationType, strategy);
    }

    // ============================================
    // UTILITY
    // ============================================

    getPendingCount() {
        return this.pendingOperations.length;
    }

    getVersion(entityType, entityId) {
        return this.versionMap.get(`${entityType}:${entityId}`) || 0;
    }

    clearPending() {
        this.pendingOperations = [];
        this.savePendingOperations();
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
// CREATE SINGLETON INSTANCE
// ============================================

let syncEngine = null;

const initSyncEngine = (wsClient, store) => {
    syncEngine = new SyncEngine(wsClient, store);
    return syncEngine;
};

// Exports
window.SyncEngine = SyncEngine;
window.initSyncEngine = initSyncEngine;

export { syncEngine, SyncEngine, SyncEngineConfig, initSyncEngine };