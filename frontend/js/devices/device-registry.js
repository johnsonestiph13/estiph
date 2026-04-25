/**
 * ESTIF HOME ULTIMATE - DEVICE REGISTRY MODULE
 * Central registry for all devices with real-time status tracking and synchronization
 * Version: 2.0.0
 * Author: Estifanos Yohannis
 */

// ============================================
// DEVICE REGISTRY CONFIGURATION
// ============================================

const DeviceRegistryConfig = {
    // Storage
    storageKey: 'estif_device_registry',
    maxDevices: 100,
    
    // Device types
    deviceTypes: {
        LIGHT: { id: 'light', name: 'Light', icon: '💡', category: 'lighting' },
        FAN: { id: 'fan', name: 'Fan', icon: '🌀', category: 'hvac' },
        AC: { id: 'ac', name: 'Air Conditioner', icon: '❄️', category: 'hvac' },
        TV: { id: 'tv', name: 'Television', icon: '📺', category: 'entertainment' },
        HEATER: { id: 'heater', name: 'Heater', icon: '🔥', category: 'hvac' },
        PUMP: { id: 'pump', name: 'Pump', icon: '💧', category: 'appliance' },
        SENSOR: { id: 'sensor', name: 'Sensor', icon: '📡', category: 'sensor' },
        CAMERA: { id: 'camera', name: 'Camera', icon: '📷', category: 'security' },
        LOCK: { id: 'lock', name: 'Lock', icon: '🔒', category: 'security' }
    },
    
    // Status polling
    pollInterval: 5000,
    statusTimeout: 30000,
    
    // Sync settings
    syncOnStart: true,
    syncInterval: 60000,
    
    // Debug
    debug: false
};

// ============================================
// DEVICE CLASS
// ============================================

class RegisteredDevice {
    constructor(data) {
        this.id = data.id || this.generateId();
        this.name = data.name;
        this.nameAm = data.nameAm || data.name;
        this.type = data.type;
        this.typeInfo = DeviceRegistryConfig.deviceTypes[data.type.toUpperCase()] || null;
        this.room = data.room;
        this.roomAm = data.roomAm || data.room;
        this.gpio = data.gpio || null;
        this.power = data.power || 0;
        this.state = data.state || false;
        this.autoMode = data.autoMode || false;
        this.online = data.online !== undefined ? data.online : true;
        this.ip = data.ip || null;
        this.mac = data.mac || null;
        this.firmwareVersion = data.firmwareVersion || '1.0.0';
        this.lastSeen = data.lastSeen || Date.now();
        this.lastStateChange = data.lastStateChange || Date.now();
        this.createdAt = data.createdAt || Date.now();
        this.updatedAt = Date.now();
        this.metadata = data.metadata || {};
        this.tags = data.tags || [];
        this.homeId = data.homeId || null;
        this.ownerId = data.ownerId || null;
    }

    generateId() {
        return `dev_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    update(data) {
        const oldState = this.state;
        const oldAutoMode = this.autoMode;
        
        if (data.name !== undefined) this.name = data.name;
        if (data.nameAm !== undefined) this.nameAm = data.nameAm;
        if (data.room !== undefined) this.room = data.room;
        if (data.roomAm !== undefined) this.roomAm = data.roomAm;
        if (data.state !== undefined) {
            this.state = data.state;
            if (oldState !== data.state) {
                this.lastStateChange = Date.now();
            }
        }
        if (data.autoMode !== undefined) this.autoMode = data.autoMode;
        if (data.online !== undefined) this.online = data.online;
        if (data.ip !== undefined) this.ip = data.ip;
        if (data.power !== undefined) this.power = data.power;
        if (data.firmwareVersion !== undefined) this.firmwareVersion = data.firmwareVersion;
        if (data.metadata !== undefined) this.metadata = { ...this.metadata, ...data.metadata };
        if (data.tags !== undefined) this.tags = data.tags;
        
        this.lastSeen = Date.now();
        this.updatedAt = Date.now();
        
        return {
            stateChanged: oldState !== this.state,
            autoModeChanged: oldAutoMode !== this.autoMode
        };
    }

    setOnline(online) {
        if (this.online !== online) {
            this.online = online;
            this.lastSeen = Date.now();
            this.updatedAt = Date.now();
            return true;
        }
        return false;
    }

    toJSON() {
        return {
            id: this.id,
            name: this.name,
            nameAm: this.nameAm,
            type: this.type,
            room: this.room,
            roomAm: this.roomAm,
            gpio: this.gpio,
            power: this.power,
            state: this.state,
            autoMode: this.autoMode,
            online: this.online,
            ip: this.ip,
            mac: this.mac,
            firmwareVersion: this.firmwareVersion,
            lastSeen: this.lastSeen,
            lastStateChange: this.lastStateChange,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
            metadata: this.metadata,
            tags: this.tags,
            homeId: this.homeId,
            ownerId: this.ownerId
        };
    }

    getDisplayName(lang = 'en') {
        return lang === 'am' && this.nameAm ? this.nameAm : this.name;
    }

    getRoomName(lang = 'en') {
        return lang === 'am' && this.roomAm ? this.roomAm : this.room;
    }

    getIcon() {
        return this.typeInfo ? this.typeInfo.icon : '🔌';
    }

    getCategory() {
        return this.typeInfo ? this.typeInfo.category : 'other';
    }
}

// ============================================
// DEVICE REGISTRY MANAGER
// ============================================

class DeviceRegistry {
    constructor() {
        this.devices = new Map();
        this.listeners = [];
        this.pollInterval = null;
        this.syncInterval = null;
        this.isSyncing = false;
        
        this.init();
    }

    init() {
        this.loadDevices();
        this.startPolling();
        this.startSync();
        DeviceRegistryConfig.debug && console.log('[DeviceRegistry] Initialized with', this.devices.size, 'devices');
    }

    loadDevices() {
        try {
            const saved = localStorage.getItem(DeviceRegistryConfig.storageKey);
            if (saved) {
                const devices = JSON.parse(saved);
                for (const deviceData of devices) {
                    const device = new RegisteredDevice(deviceData);
                    this.devices.set(device.id, device);
                }
                DeviceRegistryConfig.debug && console.log('[DeviceRegistry] Loaded', this.devices.size, 'devices');
            }
        } catch (error) {
            console.error('[DeviceRegistry] Failed to load devices:', error);
        }
        
        // Load default devices if none exist
        if (this.devices.size === 0) {
            this.createDefaultDevices();
        }
    }

    saveDevices() {
        try {
            const devices = Array.from(this.devices.values()).map(d => d.toJSON());
            localStorage.setItem(DeviceRegistryConfig.storageKey, JSON.stringify(devices));
            DeviceRegistryConfig.debug && console.log('[DeviceRegistry] Saved', devices.length, 'devices');
        } catch (error) {
            console.error('[DeviceRegistry] Failed to save devices:', error);
        }
    }

    createDefaultDevices() {
        const defaultDevices = [
            { name: 'Light', nameAm: 'መብራት', type: 'light', room: 'Living Room', roomAm: 'ሳሎን', gpio: 23, power: 10, state: false, autoMode: false },
            { name: 'Fan', nameAm: 'ማራገቢያ', type: 'fan', room: 'Bedroom', roomAm: 'መኝታ', gpio: 22, power: 40, state: false, autoMode: true },
            { name: 'AC', nameAm: 'አየር ማቀዝቀዣ', type: 'ac', room: 'Master', roomAm: 'ዋና', gpio: 21, power: 120, state: false, autoMode: true },
            { name: 'TV', nameAm: 'ቴሌቪዥን', type: 'tv', room: 'Entertainment', roomAm: 'መዝናኛ', gpio: 19, power: 80, state: false, autoMode: false },
            { name: 'Heater', nameAm: 'ማሞቂያ', type: 'heater', room: 'Bathroom', roomAm: 'መታጠቢያ', gpio: 18, power: 1500, state: false, autoMode: true },
            { name: 'Pump', nameAm: 'ፓምፕ', type: 'pump', room: 'Garden', roomAm: 'አትክልት', gpio: 5, power: 250, state: false, autoMode: false }
        ];
        
        for (const deviceData of defaultDevices) {
            const device = new RegisteredDevice(deviceData);
            this.devices.set(device.id, device);
        }
        
        this.saveDevices();
        this.notifyListeners('devices_loaded', Array.from(this.devices.values()));
    }

    // ============================================
    // DEVICE MANAGEMENT
    // ============================================

    addDevice(deviceData) {
        if (this.devices.size >= DeviceRegistryConfig.maxDevices) {
            throw new Error('Maximum number of devices reached');
        }
        
        const device = new RegisteredDevice(deviceData);
        this.devices.set(device.id, device);
        this.saveDevices();
        this.notifyListeners('device_added', device);
        
        return device;
    }

    updateDevice(deviceId, updates) {
        const device = this.devices.get(deviceId);
        if (!device) return null;
        
        const changes = device.update(updates);
        this.saveDevices();
        this.notifyListeners('device_updated', { device, changes });
        
        return { device, changes };
    }

    deleteDevice(deviceId) {
        const device = this.devices.get(deviceId);
        if (!device) return false;
        
        this.devices.delete(deviceId);
        this.saveDevices();
        this.notifyListeners('device_deleted', device);
        
        return true;
    }

    getDevice(deviceId) {
        return this.devices.get(deviceId) || null;
    }

    getAllDevices() {
        return Array.from(this.devices.values());
    }

    getDevicesByRoom(room) {
        return this.getAllDevices().filter(d => d.room === room);
    }

    getDevicesByType(type) {
        return this.getAllDevices().filter(d => d.type === type);
    }

    getDevicesByCategory(category) {
        return this.getAllDevices().filter(d => d.getCategory() === category);
    }

    getActiveDevices() {
        return this.getAllDevices().filter(d => d.state === true);
    }

    getOnlineDevices() {
        return this.getAllDevices().filter(d => d.online === true);
    }

    getDevicesInAutoMode() {
        return this.getAllDevices().filter(d => d.autoMode === true);
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
        return this.setDeviceState(deviceId, newState, options);
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
        
        // Optimistic update
        const oldState = device.state;
        device.update({ state });
        this.saveDevices();
        this.notifyListeners('device_state_changed', { device, oldState, newState: state });
        
        // Send to backend
        try {
            await this.sendDeviceCommand(deviceId, 'toggle', { state });
            return { success: true };
        } catch (error) {
            // Rollback on failure
            device.update({ state: oldState });
            this.saveDevices();
            this.notifyListeners('device_state_rollback', { device, oldState });
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
        
        const oldAutoMode = device.autoMode;
        device.update({ autoMode: enabled });
        this.saveDevices();
        this.notifyListeners('device_auto_mode_changed', { device, oldAutoMode, newAutoMode: enabled });
        
        try {
            await this.sendDeviceCommand(deviceId, 'auto', { enabled });
            return { success: true };
        } catch (error) {
            device.update({ autoMode: oldAutoMode });
            this.saveDevices();
            throw error;
        }
    }

    async sendDeviceCommand(deviceId, command, params) {
        // In production, send via WebSocket or API
        DeviceRegistryConfig.debug && console.log('[DeviceRegistry] Sending command:', deviceId, command, params);
        await this.delay(100);
        return { success: true };
    }

    // ============================================
    // STATUS POLLING & SYNC
    // ============================================

    startPolling() {
        this.pollInterval = setInterval(() => {
            this.pollDeviceStatuses();
        }, DeviceRegistryConfig.pollInterval);
    }

    stopPolling() {
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
            this.pollInterval = null;
        }
    }

    async pollDeviceStatuses() {
        const promises = this.getAllDevices().map(device => this.pollDeviceStatus(device));
        await Promise.allSettled(promises);
    }

    async pollDeviceStatus(device) {
        try {
            // Simulate device status check
            // In production, make actual API call
            const isOnline = Math.random() > 0.1; // 90% online rate
            const changed = device.setOnline(isOnline);
            
            if (changed) {
                this.saveDevices();
                this.notifyListeners('device_online_status_changed', { device, online: isOnline });
            }
        } catch (error) {
            DeviceRegistryConfig.debug && console.log(`[DeviceRegistry] Poll failed for ${device.id}:`, error);
        }
    }

    startSync() {
        this.syncInterval = setInterval(() => {
            this.syncWithServer();
        }, DeviceRegistryConfig.syncInterval);
    }

    stopSync() {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
            this.syncInterval = null;
        }
    }

    async syncWithServer() {
        if (this.isSyncing) return;
        
        this.isSyncing = true;
        
        try {
            const response = await fetch('/api/devices/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    devices: this.getAllDevices().map(d => d.toJSON()),
                    lastSync: this.lastSync || 0
                })
            });
            
            if (response.ok) {
                const serverDevices = await response.json();
                this.mergeServerDevices(serverDevices);
                this.lastSync = Date.now();
                this.notifyListeners('sync_completed', serverDevices);
            }
        } catch (error) {
            DeviceRegistryConfig.debug && console.log('[DeviceRegistry] Sync failed:', error);
        } finally {
            this.isSyncing = false;
        }
    }

    mergeServerDevices(serverDevices) {
        for (const serverDevice of serverDevices) {
            const localDevice = this.devices.get(serverDevice.id);
            
            if (!localDevice) {
                // New device from server
                const device = new RegisteredDevice(serverDevice);
                this.devices.set(device.id, device);
                this.notifyListeners('device_added', device);
            } else if (serverDevice.updatedAt > localDevice.updatedAt) {
                // Server has newer version
                const changes = localDevice.update(serverDevice);
                this.notifyListeners('device_updated', { device: localDevice, changes });
            }
        }
        
        this.saveDevices();
    }

    // ============================================
    // UTILITY METHODS
    // ============================================

    getDeviceStats() {
        const devices = this.getAllDevices();
        
        return {
            total: devices.length,
            active: devices.filter(d => d.state).length,
            online: devices.filter(d => d.online).length,
            autoMode: devices.filter(d => d.autoMode).length,
            byType: {},
            byRoom: {},
            totalPower: devices.reduce((sum, d) => sum + (d.state ? d.power : 0), 0)
        };
    }

    getDeviceTypes() {
        return DeviceRegistryConfig.deviceTypes;
    }

    searchDevices(query) {
        const lowerQuery = query.toLowerCase();
        return this.getAllDevices().filter(device => 
            device.name.toLowerCase().includes(lowerQuery) ||
            (device.nameAm && device.nameAm.toLowerCase().includes(lowerQuery)) ||
            device.room.toLowerCase().includes(lowerQuery) ||
            device.type.toLowerCase().includes(lowerQuery)
        );
    }

    reset() {
        this.devices.clear();
        this.createDefaultDevices();
        this.saveDevices();
        this.notifyListeners('devices_reset', this.getAllDevices());
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
// DEVICE REGISTRY UI COMPONENT
// ============================================

class DeviceRegistryUI {
    constructor(registry) {
        this.registry = registry;
        this.init();
    }

    init() {
        this.createUI();
        this.bindEvents();
        this.render();
        DeviceRegistryConfig.debug && console.log('[DeviceRegistryUI] Initialized');
    }

    createUI() {
        const container = document.getElementById('device-registry-container');
        if (!container) return;

        container.innerHTML = `
            <div class="device-registry-panel">
                <div class="registry-header">
                    <i class="fas fa-microchip"></i>
                    <h3>Device Registry</h3>
                    <button id="refresh-devices" class="btn btn-sm btn-primary">
                        <i class="fas fa-sync-alt"></i> Refresh
                    </button>
                </div>
                
                <div class="registry-stats" id="registry-stats"></div>
                
                <div class="registry-search">
                    <input type="text" id="device-search" placeholder="Search devices..." class="search-input">
                </div>
                
                <div class="registry-filters">
                    <button class="filter-btn active" data-filter="all">All</button>
                    <button class="filter-btn" data-filter="active">Active</button>
                    <button class="filter-btn" data-filter="online">Online</button>
                    <button class="filter-btn" data-filter="auto">Auto Mode</button>
                </div>
                
                <div class="devices-list" id="devices-list"></div>
            </div>
        `;

        this.cacheElements();
        this.bindUIEvents();
    }

    cacheElements() {
        this.statsContainer = document.getElementById('registry-stats');
        this.devicesList = document.getElementById('devices-list');
        this.searchInput = document.getElementById('device-search');
        this.refreshBtn = document.getElementById('refresh-devices');
    }

    bindUIEvents() {
        if (this.refreshBtn) {
            this.refreshBtn.addEventListener('click', () => this.refresh());
        }
        
        if (this.searchInput) {
            this.searchInput.addEventListener('input', () => this.render());
        }
        
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.currentFilter = btn.dataset.filter;
                this.render();
            });
        });
    }

    bindEvents() {
        this.registry.addEventListener('device_added', () => this.render());
        this.registry.addEventListener('device_updated', () => this.render());
        this.registry.addEventListener('device_deleted', () => this.render());
        this.registry.addEventListener('devices_reset', () => this.render());
    }

    render() {
        this.renderStats();
        this.renderDevices();
    }

    renderStats() {
        const stats = this.registry.getDeviceStats();
        
        this.statsContainer.innerHTML = `
            <div class="stat-card">
                <div class="stat-value">${stats.total}</div>
                <div class="stat-label">Total Devices</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${stats.active}</div>
                <div class="stat-label">Active</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${stats.online}</div>
                <div class="stat-label">Online</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${stats.autoMode}</div>
                <div class="stat-label">Auto Mode</div>
            </div>
        `;
    }

    renderDevices() {
        let devices = this.registry.getAllDevices();
        
        // Apply filter
        if (this.currentFilter === 'active') {
            devices = devices.filter(d => d.state);
        } else if (this.currentFilter === 'online') {
            devices = devices.filter(d => d.online);
        } else if (this.currentFilter === 'auto') {
            devices = devices.filter(d => d.autoMode);
        }
        
        // Apply search
        const searchTerm = this.searchInput?.value.toLowerCase();
        if (searchTerm) {
            devices = devices.filter(d => 
                d.name.toLowerCase().includes(searchTerm) ||
                (d.nameAm && d.nameAm.toLowerCase().includes(searchTerm))
            );
        }
        
        if (devices.length === 0) {
            this.devicesList.innerHTML = '<p class="no-devices">No devices found</p>';
            return;
        }
        
        this.devicesList.innerHTML = devices.map(device => `
            <div class="device-registry-item" data-device-id="${device.id}">
                <div class="device-status-dot ${device.online ? 'online' : 'offline'}"></div>
                <div class="device-icon">${device.getIcon()}</div>
                <div class="device-info">
                    <div class="device-name">${this.escapeHtml(device.name)}</div>
                    <div class="device-details">
                        <span class="device-room">${this.escapeHtml(device.room)}</span>
                        <span class="device-power">${device.power}W</span>
                    </div>
                </div>
                <div class="device-state">
                    <span class="state-badge ${device.state ? 'on' : 'off'}">
                        ${device.state ? 'ON' : 'OFF'}
                    </span>
                </div>
                <div class="device-mode">
                    <span class="mode-badge ${device.autoMode ? 'auto' : 'manual'}">
                        ${device.autoMode ? 'AUTO' : 'MANUAL'}
                    </span>
                </div>
                <div class="device-actions">
                    <button class="device-action toggle-btn" data-device-id="${device.id}" title="Toggle">
                        <i class="fas fa-power-off"></i>
                    </button>
                    <button class="device-action auto-btn" data-device-id="${device.id}" title="Auto Mode">
                        <i class="fas fa-robot"></i>
                    </button>
                </div>
            </div>
        `).join('');
        
        // Bind actions
        document.querySelectorAll('.toggle-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const deviceId = btn.dataset.deviceId;
                await this.registry.toggleDevice(deviceId);
            });
        });
        
        document.querySelectorAll('.auto-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const deviceId = btn.dataset.deviceId;
                const device = this.registry.getDevice(deviceId);
                if (device) {
                    await this.registry.setAutoMode(deviceId, !device.autoMode);
                }
            });
        });
    }

    async refresh() {
        await this.registry.syncWithServer();
        this.render();
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// ============================================
// CSS STYLES (Auto-injected)
// ============================================

const deviceRegistryStyles = `
    .device-registry-panel {
        background: var(--bg-card);
        border-radius: 12px;
        padding: 20px;
        border: 1px solid var(--border-color);
    }
    
    .registry-header {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 20px;
        padding-bottom: 12px;
        border-bottom: 1px solid var(--border-color);
    }
    
    .registry-header i {
        font-size: 20px;
        color: var(--primary);
    }
    
    .registry-header h3 {
        flex: 1;
        margin: 0;
    }
    
    .registry-stats {
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
        font-size: 24px;
        font-weight: 600;
        color: var(--primary);
    }
    
    .stat-label {
        font-size: 11px;
        color: var(--text-muted);
        margin-top: 4px;
    }
    
    .registry-search {
        margin-bottom: 12px;
    }
    
    .search-input {
        width: 100%;
        padding: 10px 12px;
        border: 1px solid var(--border-color);
        border-radius: 8px;
        background: var(--bg-primary);
        color: var(--text-primary);
    }
    
    .registry-filters {
        display: flex;
        gap: 8px;
        margin-bottom: 16px;
        flex-wrap: wrap;
    }
    
    .filter-btn {
        padding: 6px 12px;
        background: var(--bg-tertiary);
        border: none;
        border-radius: 20px;
        cursor: pointer;
        transition: all 0.2s ease;
    }
    
    .filter-btn.active {
        background: var(--primary);
        color: white;
    }
    
    .devices-list {
        max-height: 500px;
        overflow-y: auto;
    }
    
    .device-registry-item {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px;
        background: var(--bg-secondary);
        border-radius: 8px;
        margin-bottom: 8px;
        transition: all 0.2s ease;
    }
    
    .device-registry-item:hover {
        transform: translateX(4px);
    }
    
    .device-status-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
    }
    
    .device-status-dot.online {
        background: var(--success);
        box-shadow: 0 0 5px var(--success);
    }
    
    .device-status-dot.offline {
        background: var(--danger);
    }
    
    .device-icon {
        font-size: 24px;
    }
    
    .device-info {
        flex: 1;
    }
    
    .device-name {
        font-weight: 500;
        margin-bottom: 2px;
    }
    
    .device-details {
        display: flex;
        gap: 12px;
        font-size: 11px;
        color: var(--text-muted);
    }
    
    .state-badge, .mode-badge {
        padding: 4px 10px;
        border-radius: 20px;
        font-size: 11px;
        font-weight: 500;
    }
    
    .state-badge.on {
        background: var(--success-soft);
        color: var(--success);
    }
    
    .state-badge.off {
        background: var(--danger-soft);
        color: var(--danger);
    }
    
    .mode-badge.auto {
        background: var(--warning-soft);
        color: var(--warning);
    }
    
    .mode-badge.manual {
        background: var(--info-soft);
        color: var(--info);
    }
    
    .device-actions {
        display: flex;
        gap: 6px;
    }
    
    .device-action {
        background: var(--bg-tertiary);
        border: none;
        border-radius: 6px;
        padding: 6px 10px;
        cursor: pointer;
        transition: all 0.2s ease;
    }
    
    .device-action:hover {
        background: var(--primary);
        color: white;
    }
    
    .no-devices {
        text-align: center;
        color: var(--text-muted);
        padding: 40px;
    }
`;

// Inject styles
if (typeof document !== 'undefined') {
    const styleSheet = document.createElement('style');
    styleSheet.textContent = deviceRegistryStyles;
    document.head.appendChild(styleSheet);
}

// ============================================
// CREATE SINGLETON INSTANCES
// ============================================

const deviceRegistry = new DeviceRegistry();
const deviceRegistryUI = new DeviceRegistryUI(deviceRegistry);

// ============================================
// EXPORTS
// ============================================

// Expose to window
window.deviceRegistry = deviceRegistry;
window.deviceRegistryUI = deviceRegistryUI;
window.DeviceRegistry = DeviceRegistry;
window.DeviceRegistryConfig = DeviceRegistryConfig;

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        deviceRegistry,
        deviceRegistryUI,
        DeviceRegistry,
        DeviceRegistryConfig
    };
}

// ES modules export
export {
    deviceRegistry,
    deviceRegistryUI,
    DeviceRegistry,
    DeviceRegistryConfig
};