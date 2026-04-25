/**
 * ESTIF HOME ULTIMATE - DEVICE CONTROLLER MODULE
 * Centralized device management with real-time control, state synchronization, and batch operations
 * Version: 2.0.0
 * Author: Estifanos Yohannis
 */

// ============================================
// DEVICE CONTROLLER CONFIGURATION
// ============================================

const DeviceControllerConfig = {
    // Operation settings
    debounceDelay: 300, // ms
    batchDelay: 100, // ms
    maxBatchSize: 10,
    
    // Retry settings
    maxRetries: 3,
    retryDelay: 1000,
    
    // Sync settings
    syncInterval: 5000, // ms
    syncOnConnect: true,
    
    // State settings
    optimisticUpdates: true,
    stateCacheTTL: 30000, // ms
    
    // Debug
    debug: false
};

// ============================================
// DEVICE CONTROLLER
// ============================================

class DeviceController {
    constructor() {
        this.devices = new Map();
        this.pendingOperations = new Map();
        this.operationQueue = [];
        this.isProcessing = false;
        this.syncTimer = null;
        this.eventHandlers = new Map();
        this.retryQueues = new Map();
        
        this.init();
    }

    init() {
        this.loadDevices();
        this.startSync();
        this.setupEventListeners();
        DeviceControllerConfig.debug && console.log('[DeviceController] Initialized');
    }

    // ============================================
    // DEVICE MANAGEMENT
    // ============================================

    loadDevices() {
        try {
            const saved = localStorage.getItem('estif_devices');
            if (saved) {
                const devices = JSON.parse(saved);
                devices.forEach(device => {
                    this.devices.set(device.id, device);
                });
                DeviceControllerConfig.debug && console.log('[DeviceController] Loaded devices:', this.devices.size);
            }
        } catch (error) {
            console.error('[DeviceController] Failed to load devices:', error);
        }
    }

    saveDevices() {
        try {
            const devices = Array.from(this.devices.values());
            localStorage.setItem('estif_devices', JSON.stringify(devices));
        } catch (error) {
            console.error('[DeviceController] Failed to save devices:', error);
        }
    }

    addDevice(device) {
        if (this.devices.has(device.id)) {
            return this.updateDevice(device.id, device);
        }
        
        this.devices.set(device.id, {
            ...device,
            lastUpdated: Date.now(),
            lastStateChange: Date.now(),
            errorCount: 0
        });
        
        this.saveDevices();
        this.emit('deviceAdded', device);
        
        return device;
    }

    updateDevice(deviceId, updates) {
        const device = this.devices.get(deviceId);
        if (!device) return null;
        
        const updatedDevice = {
            ...device,
            ...updates,
            lastUpdated: Date.now()
        };
        
        this.devices.set(deviceId, updatedDevice);
        this.saveDevices();
        this.emit('deviceUpdated', updatedDevice);
        
        return updatedDevice;
    }

    removeDevice(deviceId) {
        const device = this.devices.get(deviceId);
        if (!device) return false;
        
        this.devices.delete(deviceId);
        this.saveDevices();
        this.emit('deviceRemoved', device);
        
        return true;
    }

    getDevice(deviceId) {
        return this.devices.get(deviceId) || null;
    }

    getAllDevices() {
        return Array.from(this.devices.values());
    }

    getDevicesByRoom(room) {
        return Array.from(this.devices.values()).filter(device => device.room === room);
    }

    getDevicesByType(type) {
        return Array.from(this.devices.values()).filter(device => device.type === type);
    }

    getActiveDevices() {
        return Array.from(this.devices.values()).filter(device => device.state === true);
    }

    getDevicesInAutoMode() {
        return Array.from(this.devices.values()).filter(device => device.autoMode === true);
    }

    // ============================================
    // DEVICE CONTROL
    // ============================================

    async toggleDevice(deviceId, options = {}) {
        const device = this.devices.get(deviceId);
        if (!device) {
            throw new Error(`Device ${deviceId} not found`);
        }
        
        if (device.autoMode && !options.force) {
            throw new Error('Device is in AUTO mode. Disable auto mode first.');
        }
        
        const newState = !device.state;
        
        if (DeviceControllerConfig.optimisticUpdates) {
            this.updateDeviceState(deviceId, newState);
        }
        
        const operationId = this.queueOperation({
            type: 'toggle',
            deviceId,
            state: newState,
            timestamp: Date.now(),
            retryCount: 0,
            options
        });
        
        try {
            const result = await this.executeOperation(operationId);
            return result;
        } catch (error) {
            if (DeviceControllerConfig.optimisticUpdates) {
                this.updateDeviceState(deviceId, device.state);
            }
            throw error;
        }
    }

    async setDeviceState(deviceId, state, options = {}) {
        const device = this.devices.get(deviceId);
        if (!device) {
            throw new Error(`Device ${deviceId} not found`);
        }
        
        if (device.autoMode && !options.force) {
            throw new Error('Device is in AUTO mode. Disable auto mode first.');
        }
        
        if (device.state === state) {
            return { success: true, alreadyInState: true };
        }
        
        if (DeviceControllerConfig.optimisticUpdates) {
            this.updateDeviceState(deviceId, state);
        }
        
        const operationId = this.queueOperation({
            type: 'setState',
            deviceId,
            state,
            timestamp: Date.now(),
            retryCount: 0,
            options
        });
        
        try {
            const result = await this.executeOperation(operationId);
            return result;
        } catch (error) {
            if (DeviceControllerConfig.optimisticUpdates) {
                this.updateDeviceState(deviceId, device.state);
            }
            throw error;
        }
    }

    async setAutoMode(deviceId, enabled, options = {}) {
        const device = this.devices.get(deviceId);
        if (!device) {
            throw new Error(`Device ${deviceId} not found`);
        }
        
        if (device.autoMode === enabled) {
            return { success: true, alreadySet: true };
        }
        
        const operationId = this.queueOperation({
            type: 'setAutoMode',
            deviceId,
            enabled,
            timestamp: Date.now(),
            retryCount: 0,
            options
        });
        
        const result = await this.executeOperation(operationId);
        
        if (result.success) {
            this.updateDevice(deviceId, { autoMode: enabled });
        }
        
        return result;
    }

    async masterControl(state, options = {}) {
        const devicesToControl = Array.from(this.devices.values()).filter(
            device => !device.autoMode || options.force
        );
        
        const operationId = this.queueOperation({
            type: 'masterControl',
            state,
            deviceIds: devicesToControl.map(d => d.id),
            timestamp: Date.now(),
            retryCount: 0,
            options
        });
        
        if (DeviceControllerConfig.optimisticUpdates) {
            devicesToControl.forEach(device => {
                this.updateDevice(device.id, { state });
            });
        }
        
        try {
            const result = await this.executeOperation(operationId);
            return result;
        } catch (error) {
            if (DeviceControllerConfig.optimisticUpdates) {
                devicesToControl.forEach(device => {
                    this.updateDevice(device.id, { state: device.state });
                });
            }
            throw error;
        }
    }

    async batchControl(operations) {
        const results = [];
        
        for (const op of operations) {
            try {
                let result;
                switch (op.type) {
                    case 'toggle':
                        result = await this.toggleDevice(op.deviceId, op.options);
                        break;
                    case 'setState':
                        result = await this.setDeviceState(op.deviceId, op.state, op.options);
                        break;
                    case 'setAutoMode':
                        result = await this.setAutoMode(op.deviceId, op.enabled, op.options);
                        break;
                    default:
                        result = { success: false, error: 'Unknown operation type' };
                }
                results.push({ ...op, result });
            } catch (error) {
                results.push({ ...op, result: { success: false, error: error.message } });
            }
        }
        
        return results;
    }

    // ============================================
    // OPERATION QUEUE
    // ============================================

    queueOperation(operation) {
        const id = this.generateOperationId();
        this.operationQueue.push({ ...operation, id });
        
        if (!this.isProcessing) {
            this.processQueue();
        }
        
        return id;
    }

    async processQueue() {
        if (this.isProcessing || this.operationQueue.length === 0) return;
        
        this.isProcessing = true;
        
        while (this.operationQueue.length > 0) {
            const batch = this.operationQueue.splice(0, DeviceControllerConfig.maxBatchSize);
            
            const results = await Promise.allSettled(
                batch.map(op => this.executeOperation(op.id))
            );
            
            results.forEach((result, index) => {
                const operation = batch[index];
                if (result.status === 'rejected') {
                    this.handleFailedOperation(operation, result.reason);
                }
            });
            
            if (batch.length === DeviceControllerConfig.maxBatchSize) {
                await this.delay(DeviceControllerConfig.batchDelay);
            }
        }
        
        this.isProcessing = false;
    }

    async executeOperation(operationId) {
        const operation = this.findOperation(operationId);
        if (!operation) {
            throw new Error(`Operation ${operationId} not found`);
        }
        
        try {
            let response;
            
            switch (operation.type) {
                case 'toggle':
                    response = await this.callToggleAPI(operation.deviceId, operation.state);
                    break;
                case 'setState':
                    response = await this.callSetStateAPI(operation.deviceId, operation.state);
                    break;
                case 'setAutoMode':
                    response = await this.callSetAutoModeAPI(operation.deviceId, operation.enabled);
                    break;
                case 'masterControl':
                    response = await this.callMasterControlAPI(operation.state);
                    break;
                default:
                    throw new Error(`Unknown operation type: ${operation.type}`);
            }
            
            this.emit('operationSuccess', { operationId, response });
            return { success: true, response };
        } catch (error) {
            this.emit('operationFailed', { operationId, error: error.message });
            throw error;
        } finally {
            this.pendingOperations.delete(operationId);
        }
    }

    handleFailedOperation(operation, error) {
        if (operation.retryCount < DeviceControllerConfig.maxRetries) {
            operation.retryCount++;
            operation.timestamp = Date.now();
            
            setTimeout(() => {
                this.operationQueue.unshift(operation);
                this.processQueue();
            }, DeviceControllerConfig.retryDelay * Math.pow(2, operation.retryCount));
        } else {
            this.emit('operationFailedPermanently', { operation, error });
        }
    }

    findOperation(operationId) {
        // Check pending operations
        if (this.pendingOperations.has(operationId)) {
            return this.pendingOperations.get(operationId);
        }
        
        // Check queue
        return this.operationQueue.find(op => op.id === operationId);
    }

    // ============================================
    // API CALLS (Replace with actual API)
    // ============================================

    async callToggleAPI(deviceId, state) {
        // Simulate API call
        await this.delay(200);
        
        // In production, replace with actual fetch
        // const response = await fetch(`/api/devices/${deviceId}/toggle`, {
        //     method: 'POST',
        //     headers: { 'Content-Type': 'application/json' },
        //     body: JSON.stringify({ state })
        // });
        // return response.json();
        
        return { success: true };
    }

    async callSetStateAPI(deviceId, state) {
        await this.delay(200);
        return { success: true };
    }

    async callSetAutoModeAPI(deviceId, enabled) {
        await this.delay(200);
        return { success: true };
    }

    async callMasterControlAPI(state) {
        await this.delay(300);
        return { success: true };
    }

    // ============================================
    // STATE SYNCHRONIZATION
    // ============================================

    startSync() {
        this.syncTimer = setInterval(() => {
            this.syncDevices();
        }, DeviceControllerConfig.syncInterval);
    }

    stopSync() {
        if (this.syncTimer) {
            clearInterval(this.syncTimer);
            this.syncTimer = null;
        }
    }

    async syncDevices() {
        try {
            const response = await fetch('/api/devices');
            if (response.ok) {
                const serverDevices = await response.json();
                this.mergeDevices(serverDevices);
            }
        } catch (error) {
            DeviceControllerConfig.debug && console.log('[DeviceController] Sync failed:', error);
        }
    }

    mergeDevices(serverDevices) {
        for (const serverDevice of serverDevices) {
            const localDevice = this.devices.get(serverDevice.id);
            
            if (!localDevice || serverDevice.lastUpdated > localDevice.lastUpdated) {
                this.devices.set(serverDevice.id, serverDevice);
                this.emit('deviceSynced', serverDevice);
            }
        }
        
        this.saveDevices();
    }

    updateDeviceState(deviceId, state) {
        const device = this.devices.get(deviceId);
        if (device) {
            const oldState = device.state;
            device.state = state;
            device.lastStateChange = Date.now();
            device.lastUpdated = Date.now();
            
            this.saveDevices();
            this.emit('deviceStateChanged', { deviceId, oldState, newState: state });
        }
    }

    // ============================================
    // UTILITY METHODS
    // ============================================

    generateOperationId() {
        return `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    setupEventListeners() {
        window.addEventListener('online', () => {
            if (DeviceControllerConfig.syncOnConnect) {
                this.syncDevices();
                this.processQueue();
            }
        });
        
        window.addEventListener('offline', () => {
            DeviceControllerConfig.debug && console.log('[DeviceController] Offline - operations will be queued');
        });
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

    emit(event, data) {
        if (this.eventHandlers.has(event)) {
            this.eventHandlers.get(event).forEach(handler => handler(data));
        }
    }

    // ============================================
    // STATISTICS
    // ============================================

    getStats() {
        const devices = Array.from(this.devices.values());
        
        return {
            totalDevices: devices.length,
            activeDevices: devices.filter(d => d.state).length,
            autoModeDevices: devices.filter(d => d.autoMode).length,
            totalPower: devices.reduce((sum, d) => sum + (d.state ? d.power : 0), 0),
            pendingOperations: this.operationQueue.length,
            queueProcessing: this.isProcessing
        };
    }

    reset() {
        this.devices.clear();
        this.pendingOperations.clear();
        this.operationQueue = [];
        this.retryQueues.clear();
        this.saveDevices();
        this.emit('reset');
    }
}

// ============================================
// CREATE SINGLETON INSTANCE
// ============================================

const deviceController = new DeviceController();

// ============================================
// EXPORTS
// ============================================

// Expose to window
window.deviceController = deviceController;
window.DeviceController = DeviceController;
window.DeviceControllerConfig = DeviceControllerConfig;

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        deviceController,
        DeviceController,
        DeviceControllerConfig
    };
}

// ES modules export
export {
    deviceController,
    DeviceController,
    DeviceControllerConfig
};