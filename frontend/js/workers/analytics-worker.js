/**
 * ESTIF HOME ULTIMATE - ANALYTICS WORKER
 * Background analytics processing and reporting
 * Version: 2.0.0
 * Author: Estifanos Yohannis
 */

(function() {
    'use strict';

    // ============================================
    // CONFIGURATION
    // ============================================
    
    const AnalyticsWorkerConfig = {
        batchSize: 50,
        flushInterval: 60000, // 1 minute
        maxStorageSize: 10000,
        debug: false
    };

    let eventQueue = [];
    let flushTimer = null;
    let sessionId = null;
    let userId = null;

    // ============================================
    // INITIALIZATION
    // ============================================
    
    self.addEventListener('message', async (event) => {
        const { type, data } = event.data;
        
        switch (type) {
            case 'init':
                initialize(data);
                break;
            case 'track':
                trackEvent(data);
                break;
            case 'flush':
                flushEvents();
                break;
            case 'clear':
                clearEvents();
                break;
            case 'stats':
                sendStats();
                break;
        }
    });

    function initialize(data) {
        sessionId = data.sessionId || generateSessionId();
        userId = data.userId;
        loadStoredEvents();
        startFlushTimer();
        log('Analytics worker initialized');
        self.postMessage({ type: 'ready', data: { sessionId, queueSize: eventQueue.length } });
    }

    function generateSessionId() {
        return 'sess_' + Date.now() + '_' + Math.random().toString(36).substr(2, 8);
    }

    function loadStoredEvents() {
        try {
            const stored = localStorage.getItem('estif_analytics_queue');
            if (stored) {
                eventQueue = JSON.parse(stored);
                log(`Loaded ${eventQueue.length} stored events`);
            }
        } catch (error) {
            console.error('[AnalyticsWorker] Failed to load stored events:', error);
        }
    }

    function saveStoredEvents() {
        try {
            if (eventQueue.length > AnalyticsWorkerConfig.maxStorageSize) {
                eventQueue = eventQueue.slice(-AnalyticsWorkerConfig.maxStorageSize);
            }
            localStorage.setItem('estif_analytics_queue', JSON.stringify(eventQueue));
        } catch (error) {
            console.error('[AnalyticsWorker] Failed to save stored events:', error);
        }
    }

    // ============================================
    // EVENT TRACKING
    // ============================================
    
    function trackEvent(event) {
        const enrichedEvent = {
            ...event,
            sessionId,
            userId,
            timestamp: Date.now(),
            userAgent: navigator.userAgent,
            url: window.location.href
        };
        
        eventQueue.push(enrichedEvent);
        saveStoredEvents();
        
        self.postMessage({ 
            type: 'event_tracked', 
            data: { queueSize: eventQueue.length } 
        });
        
        log(`Event tracked: ${event.category}.${event.action}`);
        
        // Flush if batch size reached
        if (eventQueue.length >= AnalyticsWorkerConfig.batchSize) {
            flushEvents();
        }
    }

    // ============================================
    // FLUSHING
    // ============================================
    
    function startFlushTimer() {
        if (flushTimer) clearInterval(flushTimer);
        flushTimer = setInterval(() => {
            if (eventQueue.length > 0) {
                flushEvents();
            }
        }, AnalyticsWorkerConfig.flushInterval);
    }

    async function flushEvents() {
        if (eventQueue.length === 0) return;
        
        const batch = [...eventQueue];
        eventQueue = [];
        saveStoredEvents();
        
        self.postMessage({ 
            type: 'flushing', 
            data: { batchSize: batch.length } 
        });
        
        try {
            const response = await fetch('/api/analytics/track', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ events: batch, sessionId, userId })
            });
            
            if (response.ok) {
                self.postMessage({ 
                    type: 'flush_success', 
                    data: { count: batch.length } 
                });
                log(`Flushed ${batch.length} events`);
            } else {
                // Re-queue on failure
                eventQueue = [...batch, ...eventQueue];
                saveStoredEvents();
                throw new Error(`HTTP ${response.status}`);
            }
        } catch (error) {
            console.error('[AnalyticsWorker] Flush failed:', error);
            eventQueue = [...batch, ...eventQueue];
            saveStoredEvents();
            self.postMessage({ type: 'flush_error', data: { error: error.message } });
        }
    }

    function clearEvents() {
        eventQueue = [];
        saveStoredEvents();
        self.postMessage({ type: 'cleared' });
        log('Events cleared');
    }

    function sendStats() {
        self.postMessage({ 
            type: 'stats', 
            data: { 
                queueSize: eventQueue.length,
                sessionId,
                userId
            } 
        });
    }

    // ============================================
    // UTILITY
    // ============================================
    
    function log(message) {
        if (AnalyticsWorkerConfig.debug) {
            console.log(`[AnalyticsWorker] ${message}`);
        }
    }

    // Handle page unload
    self.addEventListener('beforeunload', () => {
        if (eventQueue.length > 0) {
            flushEvents();
        }
    });
    
    log('Analytics worker loaded');
})();