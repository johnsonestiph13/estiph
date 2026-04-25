/**
 * ESTIF HOME ULTIMATE - EVENT BUS MODULE
 * Centralized event system for component communication
 * Version: 2.0.0
 * Author: Estifanos Yohannis
 */

// ============================================
// EVENT BUS CONFIGURATION
// ============================================

const EventBusConfig = {
    debug: false,
    maxListeners: 100,
    asyncEvents: true,
    errorHandler: null,
    eventHistorySize: 100
};

// ============================================
// EVENT BUS CLASS
// ============================================

class EventBus {
    constructor(config = {}) {
        this.events = new Map();
        this.onceEvents = new Map();
        this.eventHistory = [];
        this.config = { ...EventBusConfig, ...config };
        this.listeners = [];
        this.globalListeners = [];
        this.errorHandlers = [];
        
        this.init();
    }

    init() {
        this.setupErrorHandler();
        this.config.debug && console.log('[EventBus] Initialized');
    }

    setupErrorHandler() {
        window.addEventListener('error', (error) => {
            this.emit('system:error', { error: error.message, stack: error.stack });
        });
        
        window.addEventListener('unhandledrejection', (event) => {
            this.emit('system:unhandled_rejection', { reason: event.reason });
        });
    }

    // ============================================
    // EVENT EMISSION
    // ============================================

    emit(event, data = null) {
        const startTime = performance.now();
        
        // Record event history
        this.recordEventHistory(event, data);
        
        // Notify global listeners
        this.globalListeners.forEach(listener => {
            try {
                listener({ event, data, timestamp: Date.now() });
            } catch (error) {
                this.handleError(error, { event, data });
            }
        });
        
        // Get event handlers
        const handlers = this.events.get(event);
        const onceHandlers = this.onceEvents.get(event);
        
        if (!handlers && !onceHandlers) {
            this.config.debug && console.log(`[EventBus] No handlers for event: ${event}`);
            return;
        }
        
        const allHandlers = [
            ...(handlers || []),
            ...(onceHandlers || [])
        ];
        
        // Clear once handlers
        if (onceHandlers) {
            this.onceEvents.delete(event);
        }
        
        // Execute handlers
        const execution = this.config.asyncEvents 
            ? Promise.all(allHandlers.map(handler => this.executeHandler(handler, data)))
            : allHandlers.forEach(handler => this.executeHandler(handler, data));
        
        const endTime = performance.now();
        this.config.debug && console.log(`[EventBus] Emitted: ${event} (${(endTime - startTime).toFixed(2)}ms)`);
        
        return execution;
    }

    async executeHandler(handler, data) {
        if (!handler) return;
        
        try {
            if (this.config.asyncEvents && handler.isAsync) {
                await handler.callback(data);
            } else {
                handler.callback(data);
            }
        } catch (error) {
            this.handleError(error, { handler, data });
        }
    }

    // ============================================
    // EVENT SUBSCRIPTION
    // ============================================

    on(event, callback, options = {}) {
        if (!this.events.has(event)) {
            this.events.set(event, []);
        }
        
        const handler = {
            callback,
            id: this.generateHandlerId(),
            isAsync: callback.constructor.name === 'AsyncFunction',
            once: false,
            priority: options.priority || 0,
            context: options.context || null
        };
        
        const handlers = this.events.get(event);
        handlers.push(handler);
        
        // Sort by priority (higher priority first)
        handlers.sort((a, b) => b.priority - a.priority);
        
        // Check max listeners
        if (handlers.length > this.config.maxListeners) {
            console.warn(`[EventBus] Max listeners (${this.config.maxListeners}) exceeded for event: ${event}`);
        }
        
        this.config.debug && console.log(`[EventBus] Added listener for: ${event}`);
        
        // Return unsubscribe function
        return () => this.off(event, callback);
    }

    once(event, callback, options = {}) {
        if (!this.onceEvents.has(event)) {
            this.onceEvents.set(event, []);
        }
        
        const handler = {
            callback,
            id: this.generateHandlerId(),
            isAsync: callback.constructor.name === 'AsyncFunction',
            once: true,
            priority: options.priority || 0,
            context: options.context || null
        };
        
        const handlers = this.onceEvents.get(event);
        handlers.push(handler);
        
        handlers.sort((a, b) => b.priority - a.priority);
        
        return () => this.off(event, callback);
    }

    off(event, callback) {
        let removed = false;
        
        // Remove from regular events
        if (this.events.has(event)) {
            const handlers = this.events.get(event);
            const initialLength = handlers.length;
            this.events.set(event, handlers.filter(h => h.callback !== callback));
            removed = removed || (handlers.length !== initialLength);
        }
        
        // Remove from once events
        if (this.onceEvents.has(event)) {
            const handlers = this.onceEvents.get(event);
            const initialLength = handlers.length;
            this.onceEvents.set(event, handlers.filter(h => h.callback !== callback));
            removed = removed || (handlers.length !== initialLength);
        }
        
        if (removed) {
            this.config.debug && console.log(`[EventBus] Removed listener for: ${event}`);
        }
        
        return removed;
    }

    offAll(event = null) {
        if (event) {
            this.events.delete(event);
            this.onceEvents.delete(event);
            this.config.debug && console.log(`[EventBus] Removed all listeners for: ${event}`);
        } else {
            this.events.clear();
            this.onceEvents.clear();
            this.config.debug && console.log('[EventBus] Removed all listeners');
        }
    }

    // ============================================
    // GLOBAL LISTENERS
    // ============================================

    onGlobal(callback) {
        this.globalListeners.push(callback);
        return () => {
            const index = this.globalListeners.indexOf(callback);
            if (index !== -1) this.globalListeners.splice(index, 1);
        };
    }

    offGlobal(callback) {
        const index = this.globalListeners.indexOf(callback);
        if (index !== -1) this.globalListeners.splice(index, 1);
    }

    // ============================================
    // EVENT HISTORY
    // ============================================

    recordEventHistory(event, data) {
        this.eventHistory.unshift({
            event,
            data: this.sanitizeData(data),
            timestamp: Date.now(),
            stack: new Error().stack
        });
        
        if (this.eventHistory.length > this.config.eventHistorySize) {
            this.eventHistory.pop();
        }
    }

    sanitizeData(data) {
        // Deep clone and remove circular references
        try {
            return JSON.parse(JSON.stringify(data));
        } catch {
            return String(data);
        }
    }

    getEventHistory(event = null) {
        if (event) {
            return this.eventHistory.filter(h => h.event === event);
        }
        return [...this.eventHistory];
    }

    clearEventHistory() {
        this.eventHistory = [];
        this.config.debug && console.log('[EventBus] Event history cleared');
    }

    // ============================================
    // EVENT STATISTICS
    // ============================================

    getStats() {
        const stats = {
            totalEvents: this.events.size,
            totalOnceEvents: this.onceEvents.size,
            totalListeners: 0,
            totalOnceListeners: 0,
            events: {}
        };
        
        for (const [event, handlers] of this.events.entries()) {
            stats.events[event] = { listeners: handlers.length, once: false };
            stats.totalListeners += handlers.length;
        }
        
        for (const [event, handlers] of this.onceEvents.entries()) {
            if (stats.events[event]) {
                stats.events[event].onceListeners = handlers.length;
            } else {
                stats.events[event] = { listeners: 0, onceListeners: handlers.length };
            }
            stats.totalOnceListeners += handlers.length;
        }
        
        return stats;
    }

    hasListeners(event) {
        return this.events.has(event) || this.onceEvents.has(event);
    }

    getListenerCount(event) {
        let count = 0;
        if (this.events.has(event)) count += this.events.get(event).length;
        if (this.onceEvents.has(event)) count += this.onceEvents.get(event).length;
        return count;
    }

    // ============================================
    // ERROR HANDLING
    // ============================================

    onError(handler) {
        this.errorHandlers.push(handler);
        return () => {
            const index = this.errorHandlers.indexOf(handler);
            if (index !== -1) this.errorHandlers.splice(index, 1);
        };
    }

    handleError(error, context) {
        console.error('[EventBus] Error:', error);
        
        this.emit('eventbus:error', { error, context });
        
        this.errorHandlers.forEach(handler => {
            try {
                handler(error, context);
            } catch (handlerError) {
                console.error('[EventBus] Error in error handler:', handlerError);
            }
        });
        
        if (this.config.errorHandler) {
            this.config.errorHandler(error, context);
        }
    }

    // ============================================
    // UTILITY METHODS
    // ============================================

    generateHandlerId() {
        return `handler_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    waitFor(event, timeout = 10000) {
        return new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => {
                this.off(event, handler);
                reject(new Error(`Timeout waiting for event: ${event}`));
            }, timeout);
            
            const handler = (data) => {
                clearTimeout(timeoutId);
                resolve(data);
            };
            
            this.once(event, handler);
        });
    }

    async emitAndWait(event, data = null, timeout = 10000) {
        const promise = this.waitFor(`${event}:response`, timeout);
        this.emit(event, data);
        return promise;
    }

    // ============================================
    // BATCH OPERATIONS
    // ============================================

    emitBatch(events) {
        return Promise.all(events.map(({ event, data }) => this.emit(event, data)));
    }

    onBatch(events, callback) {
        const unsubscribes = events.map(event => this.on(event, callback));
        return () => unsubscribes.forEach(unsubscribe => unsubscribe());
    }

    // ============================================
    // EVENT BUFFERING
    // ============================================

    createBuffer(event, bufferTime = 1000) {
        let buffer = [];
        let timeout = null;
        
        const flush = () => {
            if (buffer.length > 0) {
                this.emit(event, [...buffer]);
                buffer = [];
            }
            timeout = null;
        };
        
        return (data) => {
            buffer.push(data);
            if (timeout) clearTimeout(timeout);
            timeout = setTimeout(flush, bufferTime);
        };
    }

    // ============================================
    // EVENT DEBOUNCE/THROTTLE
    // ============================================

    debounce(event, callback, delay = 300) {
        let timeout = null;
        
        const debounced = (...args) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => callback(...args), delay);
        };
        
        this.on(event, debounced);
        
        return () => this.off(event, debounced);
    }

    throttle(event, callback, delay = 300) {
        let lastCall = 0;
        let timeout = null;
        
        const throttled = (...args) => {
            const now = Date.now();
            
            if (now - lastCall >= delay) {
                lastCall = now;
                callback(...args);
            } else if (!timeout) {
                timeout = setTimeout(() => {
                    lastCall = Date.now();
                    callback(...args);
                    timeout = null;
                }, delay - (now - lastCall));
            }
        };
        
        this.on(event, throttled);
        
        return () => this.off(event, throttled);
    }

    // ============================================
    // EVENT NAMESPACES
    // ============================================

    namespace(namespace) {
        return {
            on: (event, callback, options) => this.on(`${namespace}:${event}`, callback, options),
            once: (event, callback, options) => this.once(`${namespace}:${event}`, callback, options),
            emit: (event, data) => this.emit(`${namespace}:${event}`, data),
            off: (event, callback) => this.off(`${namespace}:${event}`, callback),
            offAll: () => this.offAll(`${namespace}:`),
            hasListeners: (event) => this.hasListeners(`${namespace}:${event}`),
            getListenerCount: (event) => this.getListenerCount(`${namespace}:${event}`)
        };
    }

    // ============================================
    // EVENT INSPECTION
    // ============================================

    inspect() {
        const stats = this.getStats();
        console.group('[EventBus] Inspection');
        console.log('Configuration:', this.config);
        console.log('Statistics:', stats);
        console.log('Recent Events:', this.eventHistory.slice(0, 10));
        console.groupEnd();
        return stats;
    }

    // ============================================
    // RESET
    // ============================================

    reset() {
        this.events.clear();
        this.onceEvents.clear();
        this.eventHistory = [];
        this.globalListeners = [];
        this.errorHandlers = [];
        this.config.debug && console.log('[EventBus] Reset');
    }
}

// ============================================
// CREATE SINGLETON INSTANCE
// ============================================

const eventBus = new EventBus();

// ============================================
// DEFAULT EVENT DEFINITIONS
// ============================================

const Events = {
    // App Lifecycle
    APP_START: 'app:start',
    APP_READY: 'app:ready',
    APP_BEFORE_UNLOAD: 'app:before_unload',
    
    // Auth Events
    AUTH_LOGIN: 'auth:login',
    AUTH_LOGIN_SUCCESS: 'auth:login_success',
    AUTH_LOGIN_FAILED: 'auth:login_failed',
    AUTH_LOGOUT: 'auth:logout',
    AUTH_REGISTER: 'auth:register',
    AUTH_REGISTER_SUCCESS: 'auth:register_success',
    AUTH_REGISTER_FAILED: 'auth:register_failed',
    
    // User Events
    USER_UPDATED: 'user:updated',
    USER_PROFILE_CHANGED: 'user:profile_changed',
    USER_SETTINGS_CHANGED: 'user:settings_changed',
    
    // Device Events
    DEVICE_TOGGLED: 'device:toggled',
    DEVICE_UPDATED: 'device:updated',
    DEVICE_ADDED: 'device:added',
    DEVICE_REMOVED: 'device:removed',
    DEVICE_AUTO_MODE_CHANGED: 'device:auto_mode_changed',
    DEVICE_STATE_CHANGED: 'device:state_changed',
    MASTER_CONTROL: 'device:master_control',
    
    // Home Events
    HOME_SWITCHED: 'home:switched',
    HOME_UPDATED: 'home:updated',
    HOME_ADDED: 'home:added',
    HOME_REMOVED: 'home:removed',
    MEMBER_ADDED: 'member:added',
    MEMBER_REMOVED: 'member:removed',
    MEMBER_ROLE_CHANGED: 'member:role_changed',
    
    // Automation Events
    AUTOMATION_TRIGGERED: 'automation:triggered',
    AUTOMATION_UPDATED: 'automation:updated',
    AUTOMATION_ADDED: 'automation:added',
    AUTOMATION_REMOVED: 'automation:removed',
    AUTOMATION_TOGGLED: 'automation:toggled',
    
    // Voice Events
    VOICE_START: 'voice:start',
    VOICE_STOP: 'voice:stop',
    VOICE_COMMAND: 'voice:command',
    VOICE_RESULT: 'voice:result',
    VOICE_ERROR: 'voice:error',
    
    // WebSocket Events
    WS_CONNECT: 'ws:connect',
    WS_DISCONNECT: 'ws:disconnect',
    WS_RECONNECT: 'ws:reconnect',
    WS_MESSAGE: 'ws:message',
    WS_ERROR: 'ws:error',
    
    // Notification Events
    NOTIFICATION_SHOW: 'notification:show',
    NOTIFICATION_CLICK: 'notification:click',
    NOTIFICATION_DISMISS: 'notification:dismiss',
    
    // UI Events
    UI_THEME_CHANGED: 'ui:theme_changed',
    UI_LANGUAGE_CHANGED: 'ui:language_changed',
    UI_SIDEBAR_TOGGLE: 'ui:sidebar_toggle',
    UI_MODAL_OPEN: 'ui:modal_open',
    UI_MODAL_CLOSE: 'ui:modal_close',
    UI_TOAST_SHOW: 'ui:toast_show',
    UI_TOAST_HIDE: 'ui:toast_hide',
    UI_LOADING_START: 'ui:loading_start',
    UI_LOADING_STOP: 'ui:loading_stop',
    
    // System Events
    SYSTEM_ONLINE: 'system:online',
    SYSTEM_OFFLINE: 'system:offline',
    SYSTEM_ERROR: 'system:error',
    SYSTEM_WARNING: 'system:warning',
    SYSTEM_INFO: 'system:info',
    SYSTEM_UNHANDLED_REJECTION: 'system:unhandled_rejection',
    
    // Data Events
    DATA_LOADING: 'data:loading',
    DATA_LOADED: 'data:loaded',
    DATA_ERROR: 'data:error',
    DATA_CACHE_HIT: 'data:cache_hit',
    DATA_CACHE_MISS: 'data:cache_miss',
    DATA_SYNC_START: 'data:sync_start',
    DATA_SYNC_COMPLETE: 'data:sync_complete',
    
    // ESP32 Events
    ESP32_FOUND: 'esp32:found',
    ESP32_CONNECTED: 'esp32:connected',
    ESP32_DISCONNECTED: 'esp32:disconnected',
    ESP32_STATUS_UPDATE: 'esp32:status_update',
    ESP32_COMMAND_SENT: 'esp32:command_sent',
    ESP32_COMMAND_RESPONSE: 'esp32:command_response',
    
    // Sensor Events
    SENSOR_TEMPERATURE: 'sensor:temperature',
    SENSOR_HUMIDITY: 'sensor:humidity',
    SENSOR_MOTION: 'sensor:motion',
    SENSOR_DOOR: 'sensor:door',
    SENSOR_WINDOW: 'sensor:window',
    SENSOR_LEAK: 'sensor:leak',
    SENSOR_SMOKE: 'sensor:smoke',
    
    // Energy Events
    ENERGY_USAGE_UPDATE: 'energy:usage_update',
    ENERGY_COST_UPDATE: 'energy:cost_update',
    ENERGY_ALERT: 'energy:alert',
    ENERGY_SAVING_TIP: 'energy:saving_tip',
    
    // Emergency Events
    EMERGENCY_CALL: 'emergency:call',
    EMERGENCY_ALERT: 'emergency:alert',
    EMERGENCY_CONTACT_UPDATED: 'emergency:contact_updated',
    
    // Settings Events
    SETTINGS_UPDATED: 'settings:updated',
    SETTINGS_RESET: 'settings:reset',
    SETTINGS_EXPORT: 'settings:export',
    SETTINGS_IMPORT: 'settings:import',
    
    // Backup Events
    BACKUP_CREATE: 'backup:create',
    BACKUP_RESTORE: 'backup:restore',
    BACKUP_DELETE: 'backup:delete',
    BACKUP_COMPLETE: 'backup:complete',
    
    // Analytics Events
    ANALYTICS_VIEW: 'analytics:view',
    ANALYTICS_EXPORT: 'analytics:export',
    ANALYTICS_REPORT_GENERATED: 'analytics:report_generated',
    
    // EventBus Internal
    EVENTBUS_ERROR: 'eventbus:error',
    EVENTBUS_STATS: 'eventbus:stats'
};

// ============================================
// REACT HOOK (Optional)
// ============================================

if (typeof React !== 'undefined') {
    const useEvent = (event, callback, deps = []) => {
        React.useEffect(() => {
            const unsubscribe = eventBus.on(event, callback);
            return unsubscribe;
        }, [event, ...deps]);
    };
    
    const useEmit = () => {
        return React.useCallback((event, data) => {
            eventBus.emit(event, data);
        }, []);
    };
    
    window.useEvent = useEvent;
    window.useEmit = useEmit;
}

// ============================================
// EXPORTS
// ============================================

// Expose to window
window.eventBus = eventBus;
window.EventBus = EventBus;
window.Events = Events;

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        eventBus,
        EventBus,
        Events,
        EventBusConfig
    };
}

// ES modules export
export {
    eventBus,
    EventBus,
    Events,
    EventBusConfig
};