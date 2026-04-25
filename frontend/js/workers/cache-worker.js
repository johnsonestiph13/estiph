/**
 * ESTIF HOME ULTIMATE - CACHE WORKER
 * Background caching worker for offline data storage
 * Version: 2.0.0
 * Author: Estifanos Yohannis
 */

(function() {
    'use strict';

    // ============================================
    // CONFIGURATION
    // ============================================
    
    const CacheWorkerConfig = {
        cacheName: 'estif-cache-v1',
        maxCacheSize: 50 * 1024 * 1024, // 50MB
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        debug: false
    };

    let cache = null;
    let cacheStats = {
        size: 0,
        itemCount: 0,
        lastCleanup: Date.now()
    };

    // ============================================
    // INITIALIZATION
    // ============================================
    
    self.addEventListener('message', async (event) => {
        const { type, data } = event.data;
        
        switch (type) {
            case 'init':
                await initialize();
                break;
            case 'set':
                await setCache(data.key, data.value, data.ttl);
                break;
            case 'get':
                await getCache(data.key);
                break;
            case 'delete':
                await deleteCache(data.key);
                break;
            case 'clear':
                await clearCache();
                break;
            case 'stats':
                await sendStats();
                break;
            case 'cleanup':
                await cleanup();
                break;
        }
    });

    async function initialize() {
        cache = await caches.open(CacheWorkerConfig.cacheName);
        await updateStats();
        await cleanup();
        log('Cache worker initialized');
        self.postMessage({ type: 'ready', data: cacheStats });
    }

    // ============================================
    // CACHE OPERATIONS
    // ============================================
    
    async function setCache(key, value, ttl = CacheWorkerConfig.maxAge) {
        try {
            const cacheItem = {
                key,
                value,
                timestamp: Date.now(),
                expiresAt: Date.now() + ttl
            };
            
            const response = new Response(JSON.stringify(cacheItem), {
                headers: { 'Content-Type': 'application/json' }
            });
            
            await cache.put(key, response);
            await updateStats();
            
            self.postMessage({ 
                type: 'set_success', 
                data: { key, size: JSON.stringify(cacheItem).length } 
            });
            
            log(`Cached: ${key}`);
        } catch (error) {
            console.error('[CacheWorker] Set failed:', error);
            self.postMessage({ type: 'set_error', data: { key, error: error.message } });
        }
    }

    async function getCache(key) {
        try {
            const response = await cache.match(key);
            
            if (!response) {
                self.postMessage({ type: 'get_miss', data: { key } });
                return;
            }
            
            const cacheItem = await response.json();
            
            if (Date.now() > cacheItem.expiresAt) {
                await cache.delete(key);
                self.postMessage({ type: 'get_expired', data: { key } });
                return;
            }
            
            self.postMessage({ 
                type: 'get_success', 
                data: { key, value: cacheItem.value } 
            });
            
            log(`Cache hit: ${key}`);
        } catch (error) {
            console.error('[CacheWorker] Get failed:', error);
            self.postMessage({ type: 'get_error', data: { key, error: error.message } });
        }
    }

    async function deleteCache(key) {
        try {
            await cache.delete(key);
            await updateStats();
            self.postMessage({ type: 'delete_success', data: { key } });
            log(`Deleted: ${key}`);
        } catch (error) {
            console.error('[CacheWorker] Delete failed:', error);
            self.postMessage({ type: 'delete_error', data: { key, error: error.message } });
        }
    }

    async function clearCache() {
        try {
            const keys = await cache.keys();
            for (const request of keys) {
                await cache.delete(request);
            }
            await updateStats();
            self.postMessage({ type: 'clear_success' });
            log('Cache cleared');
        } catch (error) {
            console.error('[CacheWorker] Clear failed:', error);
            self.postMessage({ type: 'clear_error', data: { error: error.message } });
        }
    }

    // ============================================
    // MAINTENANCE
    // ============================================
    
    async function cleanup() {
        const now = Date.now();
        let cleaned = 0;
        
        try {
            const keys = await cache.keys();
            
            for (const request of keys) {
                const response = await cache.match(request);
                if (response) {
                    const cacheItem = await response.clone().json();
                    if (now > cacheItem.expiresAt) {
                        await cache.delete(request);
                        cleaned++;
                    }
                }
            }
            
            await updateStats();
            
            if (cleaned > 0) {
                log(`Cleaned ${cleaned} expired items`);
                self.postMessage({ type: 'cleanup_completed', data: { cleaned } });
            }
        } catch (error) {
            console.error('[CacheWorker] Cleanup failed:', error);
        }
    }

    async function updateStats() {
        try {
            const keys = await cache.keys();
            let totalSize = 0;
            
            for (const request of keys) {
                const response = await cache.match(request);
                if (response) {
                    const blob = await response.blob();
                    totalSize += blob.size;
                }
            }
            
            cacheStats = {
                size: totalSize,
                itemCount: keys.length,
                lastCleanup: Date.now()
            };
            
            log(`Stats updated: ${cacheStats.itemCount} items, ${(cacheStats.size / 1024 / 1024).toFixed(2)} MB`);
        } catch (error) {
            console.error('[CacheWorker] Stats update failed:', error);
        }
    }

    async function sendStats() {
        await updateStats();
        self.postMessage({ type: 'stats', data: cacheStats });
    }

    function log(message) {
        if (CacheWorkerConfig.debug) {
            console.log(`[CacheWorker] ${message}`);
        }
    }

    // Periodic cleanup (every hour)
    setInterval(() => {
        cleanup();
    }, 60 * 60 * 1000);
    
    log('Cache worker loaded');
})();