/**
 * ESTIF HOME ULTIMATE - SYNC WORKER
 * Background synchronization worker for offline data sync
 * Version: 2.0.0
 * Author: Estifanos Yohannis
 */

// Self-executing worker function
(function() {
    'use strict';

    // ============================================
    // CONFIGURATION
    // ============================================
    
    const SyncWorkerConfig = {
        syncInterval: 30000, // 30 seconds
        maxRetries: 3,
        retryDelay: 5000,
        batchSize: 10,
        debug: false
    };

    let syncTimer = null;
    let pendingOperations = [];
    let isSyncing = false;
    let retryCounts = new Map();

    // ============================================
    // INITIALIZATION
    // ============================================
    
    self.addEventListener('message', (event) => {
        const { type, data } = event.data;
        
        switch (type) {
            case 'init':
                initialize();
                break;
            case 'sync':
                startSync();
                break;
            case 'stop':
                stopSync();
                break;
            case 'queue':
                queueOperation(data);
                break;
            case 'clear':
                clearQueue();
                break;
            case 'status':
                sendStatus();
                break;
        }
    });

    function initialize() {
        loadPendingOperations();
        startSyncTimer();
        log('Sync worker initialized');
        self.postMessage({ type: 'ready', data: { pendingCount: pendingOperations.length } });
    }

    function startSyncTimer() {
        if (syncTimer) clearInterval(syncTimer);
        syncTimer = setInterval(() => {
            if (pendingOperations.length > 0 && !isSyncing) {
                startSync();
            }
        }, SyncWorkerConfig.syncInterval);
    }

    function stopSync() {
        if (syncTimer) {
            clearInterval(syncTimer);
            syncTimer = null;
        }
        log('Sync stopped');
    }

    // ============================================
    // OPERATION QUEUE
    // ============================================
    
    function loadPendingOperations() {
        try {
            const saved = localStorage.getItem('estif_pending_sync');
            if (saved) {
                pendingOperations = JSON.parse(saved);
                log(`Loaded ${pendingOperations.length} pending operations`);
            }
        } catch (error) {
            console.error('[SyncWorker] Failed to load pending operations:', error);
        }
    }

    function savePendingOperations() {
        try {
            localStorage.setItem('estif_pending_sync', JSON.stringify(pendingOperations));
        } catch (error) {
            console.error('[SyncWorker] Failed to save pending operations:', error);
        }
    }

    function queueOperation(operation) {
        operation.id = Date.now() + '_' + Math.random().toString(36).substr(2, 8);
        operation.queuedAt = Date.now();
        operation.retryCount = 0;
        pendingOperations.push(operation);
        savePendingOperations();
        
        self.postMessage({ 
            type: 'queued', 
            data: { operationId: operation.id, queueSize: pendingOperations.length } 
        });
        
        log(`Operation queued: ${operation.type} (${operation.id})`);
        
        if (!isSyncing) {
            startSync();
        }
    }

    function clearQueue() {
        pendingOperations = [];
        savePendingOperations();
        self.postMessage({ type: 'queue_cleared' });
        log('Queue cleared');
    }

    // ============================================
    // SYNC PROCESSING
    // ============================================
    
    async function startSync() {
        if (isSyncing || pendingOperations.length === 0) return;
        
        isSyncing = true;
        self.postMessage({ type: 'sync_started', data: { total: pendingOperations.length } });
        
        while (pendingOperations.length > 0) {
            const batch = pendingOperations.splice(0, SyncWorkerConfig.batchSize);
            
            for (const operation of batch) {
                try {
                    const success = await processOperation(operation);
                    
                    if (success) {
                        retryCounts.delete(operation.id);
                        self.postMessage({ 
                            type: 'operation_completed', 
                            data: { operationId: operation.id, success: true } 
                        });
                    } else {
                        await handleFailedOperation(operation);
                    }
                } catch (error) {
                    console.error(`[SyncWorker] Error processing operation ${operation.id}:`, error);
                    await handleFailedOperation(operation);
                }
                
                // Small delay between operations
                await delay(100);
            }
            
            savePendingOperations();
            self.postMessage({ 
                type: 'progress', 
                data: { remaining: pendingOperations.length } 
            });
        }
        
        isSyncing = false;
        self.postMessage({ type: 'sync_completed' });
        log('Sync completed');
    }

    async function processOperation(operation) {
        const { type, url, method, body, headers } = operation;
        
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000);
            
            const response = await fetch(url, {
                method: method || 'POST',
                headers: { 'Content-Type': 'application/json', ...headers },
                body: body ? JSON.stringify(body) : undefined,
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (response.ok) {
                const data = await response.json();
                self.postMessage({ 
                    type: 'operation_success', 
                    data: { operationId: operation.id, response: data } 
                });
                return true;
            } else {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
        } catch (error) {
            self.postMessage({ 
                type: 'operation_failed', 
                data: { operationId: operation.id, error: error.message } 
            });
            return false;
        }
    }

    async function handleFailedOperation(operation) {
        const retryCount = (retryCounts.get(operation.id) || 0) + 1;
        retryCounts.set(operation.id, retryCount);
        
        if (retryCount <= SyncWorkerConfig.maxRetries) {
            // Requeue with delay
            await delay(SyncWorkerConfig.retryDelay * retryCount);
            operation.retryCount = retryCount;
            pendingOperations.unshift(operation);
            self.postMessage({ 
                type: 'operation_retry', 
                data: { operationId: operation.id, retryCount } 
            });
        } else {
            self.postMessage({ 
                type: 'operation_failed_permanent', 
                data: { operationId: operation.id } 
            });
            retryCounts.delete(operation.id);
        }
    }

    // ============================================
    // UTILITY
    // ============================================
    
    function sendStatus() {
        self.postMessage({ 
            type: 'status', 
            data: { 
                pending: pendingOperations.length,
                isSyncing: isSyncing,
                retryCounts: Array.from(retryCounts.entries())
            } 
        });
    }

    function delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    function log(message) {
        if (SyncWorkerConfig.debug) {
            console.log(`[SyncWorker] ${message}`);
        }
    }

    // Handle online/offline events
    self.addEventListener('online', () => {
        log('Online detected, starting sync');
        if (pendingOperations.length > 0 && !isSyncing) {
            startSync();
        }
    });
    
    log('Sync worker loaded');
})();