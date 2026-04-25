/**
 * ESTIF HOME ULTIMATE - BLUETOOTH MODULE
 * Web Bluetooth API for device discovery, connection, and control
 * Version: 2.0.0
 * Author: Estifanos Yohannis
 */

// ============================================
// BLUETOOTH CONFIGURATION
// ============================================

const BluetoothConfig = {
    // Service UUIDs
    services: {
        battery: '0000180f-0000-1000-8000-00805f9b34fb',
        deviceInfo: '0000180a-0000-1000-8000-00805f9b34fb',
        estifHome: '12345678-1234-1234-1234-123456789abc'
    },
    
    // Characteristic UUIDs
    characteristics: {
        batteryLevel: '00002a19-0000-1000-8000-00805f9b34fb',
        manufacturerName: '00002a29-0000-1000-8000-00805f9b34fb',
        deviceControl: '12345678-1234-1234-1234-123456789abd',
        deviceStatus: '12345678-1234-1234-1234-123456789abe',
        deviceConfig: '12345678-1234-1234-1234-123456789abf'
    },
    
    // Device filters
    filters: [
        { namePrefix: 'ESP32' },
        { namePrefix: 'Estif' },
        { services: ['12345678-1234-1234-1234-123456789abc'] }
    ],
    
    // Scan settings
    scanTimeout: 10000,
    acceptAllDevices: false,
    optionalServices: ['0000180f-0000-1000-8000-00805f9b34fb', '0000180a-0000-1000-8000-00805f9b34fb'],
    
    // Connection settings
    reconnectAttempts: 3,
    reconnectDelay: 2000,
    connectionTimeout: 15000,
    
    // Data settings
    notificationBufferSize: 1024,
    sendChunkSize: 20,
    
    // Debug
    debug: false
};

// ============================================
// BLUETOOTH MANAGER
// ============================================

class BluetoothManager {
    constructor() {
        this.device = null;
        this.server = null;
        this.services = new Map();
        this.characteristics = new Map();
        this.isConnected = false;
        this.isConnecting = false;
        this.discoveredDevices = new Map();
        this.reconnectAttempt = 0;
        this.listeners = [];
        this.notificationStreams = new Map();
        
        this.init();
    }

    init() {
        this.checkAvailability();
        this.setupEventListeners();
        BluetoothConfig.debug && console.log('[Bluetooth] Manager initialized');
    }

    // ============================================
    // AVAILABILITY CHECK
    // ============================================

    checkAvailability() {
        this.isAvailable = 'bluetooth' in navigator;
        if (!this.isAvailable) {
            console.warn('[Bluetooth] Web Bluetooth API not supported');
        }
        return this.isAvailable;
    }

    getAvailabilityStatus() {
        return {
            available: this.isAvailable,
            connected: this.isConnected,
            connecting: this.isConnecting,
            deviceName: this.device?.name || null
        };
    }

    // ============================================
    // DEVICE DISCOVERY
    // ============================================

    async requestDevice(options = {}) {
        if (!this.isAvailable) {
            throw new Error('Bluetooth not supported');
        }

        try {
            const requestOptions = {
                filters: options.filters || BluetoothConfig.filters,
                optionalServices: [...BluetoothConfig.optionalServices, ...(options.optionalServices || [])],
                acceptAllDevices: options.acceptAllDevices || BluetoothConfig.acceptAllDevices
            };

            this.device = await navigator.bluetooth.requestDevice(requestOptions);
            
            this.device.addEventListener('gattserverdisconnected', () => {
                this.handleDisconnect();
            });

            BluetoothConfig.debug && console.log('[Bluetooth] Device selected:', this.device.name);
            this.notifyListeners('device_selected', { device: this.device });
            
            return {
                success: true,
                device: {
                    id: this.device.id,
                    name: this.device.name,
                    connected: this.device.gatt.connected
                }
            };
        } catch (error) {
            console.error('[Bluetooth] Request device error:', error);
            return { success: false, error: error.message };
        }
    }

    async scanDevices(timeout = BluetoothConfig.scanTimeout) {
        if (!this.isAvailable) {
            throw new Error('Bluetooth not supported');
        }

        this.discoveredDevices.clear();
        
        const options = {
            filters: BluetoothConfig.filters,
            optionalServices: BluetoothConfig.optionalServices,
            acceptAllDevices: false
        };

        try {
            const device = await navigator.bluetooth.requestDevice(options);
            this.discoveredDevices.set(device.id, {
                id: device.id,
                name: device.name,
                rssi: null,
                device: device
            });
            
            return Array.from(this.discoveredDevices.values());
        } catch (error) {
            BluetoothConfig.debug && console.log('[Bluetooth] Scan cancelled or failed:', error);
            return Array.from(this.discoveredDevices.values());
        }
    }

    async startDiscovery() {
        if (this.discoveryActive) return;
        
        this.discoveryActive = true;
        this.discoveredDevices.clear();
        
        const onDeviceFound = (event) => {
            const device = event.device;
            if (!this.discoveredDevices.has(device.id)) {
                this.discoveredDevices.set(device.id, {
                    id: device.id,
                    name: device.name,
                    rssi: event.rssi,
                    device: device
                });
                this.notifyListeners('device_found', { device: this.discoveredDevices.get(device.id) });
            }
        };

        try {
            const options = {
                filters: BluetoothConfig.filters,
                optionalServices: BluetoothConfig.optionalServices,
                acceptAllDevices: false
            };
            
            this.discoveryDevice = await navigator.bluetooth.requestDevice(options);
            this.discoveryDevice.addEventListener('advertisementreceived', onDeviceFound);
            
            await this.discoveryDevice.watchAdvertisements();
            
            BluetoothConfig.debug && console.log('[Bluetooth] Discovery started');
            return true;
        } catch (error) {
            console.error('[Bluetooth] Discovery error:', error);
            this.discoveryActive = false;
            return false;
        }
    }

    stopDiscovery() {
        if (this.discoveryDevice) {
            this.discoveryDevice.removeEventListener('advertisementreceived');
            this.discoveryDevice = null;
        }
        this.discoveryActive = false;
        BluetoothConfig.debug && console.log('[Bluetooth] Discovery stopped');
    }

    // ============================================
    // CONNECTION MANAGEMENT
    // ============================================

    async connect(device = null, options = {}) {
        if (this.isConnected) {
            BluetoothConfig.debug && console.log('[Bluetooth] Already connected');
            return { success: true, alreadyConnected: true };
        }

        if (this.isConnecting) {
            BluetoothConfig.debug && console.log('[Bluetooth] Connection in progress');
            return { success: false, error: 'Connection already in progress' };
        }

        this.isConnecting = true;
        const targetDevice = device || this.device;

        if (!targetDevice) {
            this.isConnecting = false;
            return { success: false, error: 'No device selected' };
        }

        try {
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Connection timeout')), BluetoothConfig.connectionTimeout);
            });

            const connectPromise = targetDevice.gatt.connect();
            this.server = await Promise.race([connectPromise, timeoutPromise]);
            
            this.isConnected = true;
            this.isConnecting = false;
            this.reconnectAttempt = 0;
            
            BluetoothConfig.debug && console.log('[Bluetooth] Connected to device:', targetDevice.name);
            this.notifyListeners('connected', { device: targetDevice });
            
            return { success: true };
        } catch (error) {
            console.error('[Bluetooth] Connection error:', error);
            this.isConnected = false;
            this.isConnecting = false;
            
            if (options.autoReconnect && this.reconnectAttempt < BluetoothConfig.reconnectAttempts) {
                this.reconnectAttempt++;
                BluetoothConfig.debug && console.log(`[Bluetooth] Reconnecting attempt ${this.reconnectAttempt}`);
                
                setTimeout(() => {
                    this.connect(device, options);
                }, BluetoothConfig.reconnectDelay);
            }
            
            return { success: false, error: error.message };
        }
    }

    async disconnect() {
        if (!this.isConnected || !this.device) {
            return { success: true, alreadyDisconnected: true };
        }

        try {
            if (this.device.gatt.connected) {
                this.device.gatt.disconnect();
            }
            this.isConnected = false;
            this.server = null;
            this.services.clear();
            this.characteristics.clear();
            
            BluetoothConfig.debug && console.log('[Bluetooth] Disconnected');
            this.notifyListeners('disconnected');
            
            return { success: true };
        } catch (error) {
            console.error('[Bluetooth] Disconnect error:', error);
            return { success: false, error: error.message };
        }
    }

    handleDisconnect() {
        this.isConnected = false;
        this.server = null;
        this.services.clear();
        this.characteristics.clear();
        
        BluetoothConfig.debug && console.log('[Bluetooth] Device disconnected');
        this.notifyListeners('disconnected');
        
        // Auto reconnect
        if (this.reconnectAttempt < BluetoothConfig.reconnectAttempts) {
            this.reconnectAttempt++;
            setTimeout(() => {
                BluetoothConfig.debug && console.log(`[Bluetooth] Auto-reconnecting (${this.reconnectAttempt})`);
                this.connect();
            }, BluetoothConfig.reconnectDelay);
        }
    }

    // ============================================
    // SERVICE & CHARACTERISTIC METHODS
    // ============================================

    async getService(serviceUUID) {
        if (!this.isConnected || !this.server) {
            throw new Error('Not connected to device');
        }

        if (this.services.has(serviceUUID)) {
            return this.services.get(serviceUUID);
        }

        try {
            const service = await this.server.getPrimaryService(serviceUUID);
            this.services.set(serviceUUID, service);
            return service;
        } catch (error) {
            console.error(`[Bluetooth] Service ${serviceUUID} not found:`, error);
            throw error;
        }
    }

    async getCharacteristic(serviceUUID, characteristicUUID) {
        const cacheKey = `${serviceUUID}:${characteristicUUID}`;
        
        if (this.characteristics.has(cacheKey)) {
            return this.characteristics.get(cacheKey);
        }

        try {
            const service = await this.getService(serviceUUID);
            const characteristic = await service.getCharacteristic(characteristicUUID);
            this.characteristics.set(cacheKey, characteristic);
            return characteristic;
        } catch (error) {
            console.error(`[Bluetooth] Characteristic ${characteristicUUID} not found:`, error);
            throw error;
        }
    }

    // ============================================
    // READ/WRITE/NOTIFY OPERATIONS
    // ============================================

    async readValue(serviceUUID, characteristicUUID) {
        try {
            const characteristic = await this.getCharacteristic(serviceUUID, characteristicUUID);
            const value = await characteristic.readValue();
            return this.decodeValue(value);
        } catch (error) {
            console.error('[Bluetooth] Read error:', error);
            throw error;
        }
    }

    async writeValue(serviceUUID, characteristicUUID, value, withoutResponse = false) {
        try {
            const characteristic = await this.getCharacteristic(serviceUUID, characteristicUUID);
            const encodedValue = this.encodeValue(value);
            
            if (withoutResponse) {
                await characteristic.writeValueWithoutResponse(encodedValue);
            } else {
                await characteristic.writeValue(encodedValue);
            }
            
            return { success: true };
        } catch (error) {
            console.error('[Bluetooth] Write error:', error);
            throw error;
        }
    }

    async startNotifications(serviceUUID, characteristicUUID, callback) {
        try {
            const characteristic = await this.getCharacteristic(serviceUUID, characteristicUUID);
            
            const handleNotification = (event) => {
                const value = this.decodeValue(event.target.value);
                callback(value);
            };
            
            await characteristic.startNotifications();
            characteristic.addEventListener('characteristicvaluechanged', handleNotification);
            
            const streamKey = `${serviceUUID}:${characteristicUUID}`;
            this.notificationStreams.set(streamKey, { characteristic, callback: handleNotification });
            
            return { success: true };
        } catch (error) {
            console.error('[Bluetooth] Start notifications error:', error);
            throw error;
        }
    }

    async stopNotifications(serviceUUID, characteristicUUID) {
        try {
            const streamKey = `${serviceUUID}:${characteristicUUID}`;
            const stream = this.notificationStreams.get(streamKey);
            
            if (stream) {
                const characteristic = await this.getCharacteristic(serviceUUID, characteristicUUID);
                await characteristic.stopNotifications();
                characteristic.removeEventListener('characteristicvaluechanged', stream.callback);
                this.notificationStreams.delete(streamKey);
            }
            
            return { success: true };
        } catch (error) {
            console.error('[Bluetooth] Stop notifications error:', error);
            throw error;
        }
    }

    // ============================================
    // DEVICE CONTROL METHODS
    // ============================================

    async getBatteryLevel() {
        try {
            const value = await this.readValue(
                BluetoothConfig.services.battery,
                BluetoothConfig.characteristics.batteryLevel
            );
            return { level: value, success: true };
        } catch (error) {
            return { level: null, success: false, error: error.message };
        }
    }

    async getDeviceInfo() {
        try {
            const manufacturer = await this.readValue(
                BluetoothConfig.services.deviceInfo,
                BluetoothConfig.characteristics.manufacturerName
            );
            return { manufacturer, success: true };
        } catch (error) {
            return { manufacturer: null, success: false, error: error.message };
        }
    }

    async sendDeviceCommand(command, params = {}) {
        try {
            const message = JSON.stringify({ command, ...params, timestamp: Date.now() });
            
            // Split message into chunks if needed
            const chunks = this.chunkMessage(message);
            for (const chunk of chunks) {
                await this.writeValue(
                    BluetoothConfig.services.estifHome,
                    BluetoothConfig.characteristics.deviceControl,
                    chunk
                );
            }
            
            BluetoothConfig.debug && console.log('[Bluetooth] Command sent:', command);
            return { success: true };
        } catch (error) {
            console.error('[Bluetooth] Send command error:', error);
            return { success: false, error: error.message };
        }
    }

    async getDeviceStatus() {
        try {
            const status = await this.readValue(
                BluetoothConfig.services.estifHome,
                BluetoothConfig.characteristics.deviceStatus
            );
            return { status: JSON.parse(status), success: true };
        } catch (error) {
            return { status: null, success: false, error: error.message };
        }
    }

    async configureDevice(config) {
        try {
            await this.writeValue(
                BluetoothConfig.services.estifHome,
                BluetoothConfig.characteristics.deviceConfig,
                JSON.stringify(config)
            );
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // ============================================
    // UTILITY METHODS
    // ============================================

    encodeValue(value) {
        let data;
        
        if (typeof value === 'string') {
            data = new TextEncoder().encode(value);
        } else if (typeof value === 'number') {
            const buffer = new ArrayBuffer(4);
            const view = new DataView(buffer);
            view.setUint32(0, value, true);
            data = new Uint8Array(buffer);
        } else if (value instanceof Uint8Array) {
            data = value;
        } else if (value instanceof ArrayBuffer) {
            data = new Uint8Array(value);
        } else {
            data = new TextEncoder().encode(JSON.stringify(value));
        }
        
        return data;
    }

    decodeValue(value) {
        const decoder = new TextDecoder();
        const string = decoder.decode(value);
        
        // Try to parse as JSON
        try {
            return JSON.parse(string);
        } catch {
            // Try as number
            if (/^\d+$/.test(string)) {
                return parseInt(string, 10);
            }
            return string;
        }
    }

    chunkMessage(message) {
        const chunks = [];
        for (let i = 0; i < message.length; i += BluetoothConfig.sendChunkSize) {
            chunks.push(message.slice(i, i + BluetoothConfig.sendChunkSize));
        }
        return chunks;
    }

    // ============================================
    // ESP32 SPECIFIC METHODS
    // ============================================

    async discoverESP32Devices() {
        const devices = await this.scanDevices();
        return devices.filter(d => 
            d.name && (d.name.startsWith('ESP32') || d.name.startsWith('Estif'))
        );
    }

    async controlESP32Device(deviceId, command, value) {
        const device = this.discoveredDevices.get(deviceId);
        if (!device) {
            return { success: false, error: 'Device not found' };
        }

        await this.connect(device.device);
        
        const result = await this.sendDeviceCommand(command, { value });
        
        if (!result.success) {
            return result;
        }
        
        // Don't disconnect automatically - keep connection for subsequent commands
        return { success: true };
    }

    async syncESP32Devices() {
        const esp32Devices = await this.discoverESP32Devices();
        
        for (const device of esp32Devices) {
            await this.connect(device.device);
            const status = await this.getDeviceStatus();
            
            if (status.success) {
                this.notifyListeners('device_status_update', {
                    deviceId: device.id,
                    name: device.name,
                    status: status.status
                });
            }
        }
        
        return { success: true, devices: esp32Devices };
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

    setupEventListeners() {
        window.addEventListener('beforeunload', () => {
            if (this.isConnected) {
                this.disconnect();
            }
        });
    }

    // ============================================
    // HELPER METHODS
    // ============================================

    getConnectedDevice() {
        return this.device ? {
            id: this.device.id,
            name: this.device.name,
            connected: this.isConnected
        } : null;
    }

    getDiscoveredDevices() {
        return Array.from(this.discoveredDevices.values());
    }

    async pairDevice(deviceId) {
        const device = this.discoveredDevices.get(deviceId);
        if (!device) {
            return { success: false, error: 'Device not found' };
        }
        
        return await this.connect(device.device);
    }

    async unpairDevice(deviceId) {
        const device = this.discoveredDevices.get(deviceId);
        if (device && device.device.gatt.connected) {
            device.device.gatt.disconnect();
        }
        this.discoveredDevices.delete(deviceId);
        
        return { success: true };
    }
}

// ============================================
// BLUETOOTH UI COMPONENT
// ============================================

class BluetoothUI {
    constructor(bluetoothManager) {
        this.manager = bluetoothManager;
        this.init();
    }

    init() {
        this.createUI();
        this.bindEvents();
        BluetoothConfig.debug && console.log('[BluetoothUI] Initialized');
    }

    createUI() {
        const container = document.getElementById('bluetooth-container');
        if (!container) return;

        container.innerHTML = `
            <div class="bluetooth-panel">
                <div class="bluetooth-header">
                    <i class="fas fa-bluetooth"></i>
                    <h3>Bluetooth Devices</h3>
                    <span class="bluetooth-status" id="bt-status">${this.manager.isConnected ? 'Connected' : 'Disconnected'}</span>
                </div>
                
                <div class="bluetooth-controls">
                    <button id="bt-scan-btn" class="btn btn-primary">
                        <i class="fas fa-search"></i> Scan Devices
                    </button>
                    <button id="bt-connect-btn" class="btn btn-secondary" disabled>
                        <i class="fas fa-plug"></i> Connect
                    </button>
                </div>
                
                <div class="bluetooth-devices" id="bt-devices-list">
                    <p class="no-devices">No devices found. Click Scan to discover devices.</p>
                </div>
                
                <div class="bluetooth-device-controls" id="bt-device-controls" style="display: none;">
                    <h4>Device Controls</h4>
                    <div id="bt-device-commands"></div>
                </div>
            </div>
        `;

        this.cacheElements();
    }

    cacheElements() {
        this.scanBtn = document.getElementById('bt-scan-btn');
        this.connectBtn = document.getElementById('bt-connect-btn');
        this.devicesList = document.getElementById('bt-devices-list');
        this.deviceControls = document.getElementById('bt-device-controls');
        this.statusSpan = document.getElementById('bt-status');
    }

    bindEvents() {
        if (this.scanBtn) {
            this.scanBtn.addEventListener('click', () => this.scanDevices());
        }
        
        if (this.connectBtn) {
            this.connectBtn.addEventListener('click', () => this.connectToSelectedDevice());
        }
        
        this.manager.addEventListener('device_found', (data) => {
            this.addDeviceToList(data.device);
        });
        
        this.manager.addEventListener('connected', () => {
            this.updateStatus('Connected');
            this.showDeviceControls();
        });
        
        this.manager.addEventListener('disconnected', () => {
            this.updateStatus('Disconnected');
            this.hideDeviceControls();
        });
    }

    async scanDevices() {
        this.setLoading(true);
        this.clearDevicesList();
        
        const devices = await this.manager.scanDevices();
        
        if (devices.length === 0) {
            this.devicesList.innerHTML = '<p class="no-devices">No devices found. Make sure your device is discoverable.</p>';
        } else {
            devices.forEach(device => this.addDeviceToList(device));
        }
        
        this.setLoading(false);
    }

    addDeviceToList(device) {
        const deviceItem = document.createElement('div');
        deviceItem.className = 'bluetooth-device';
        deviceItem.dataset.deviceId = device.id;
        deviceItem.innerHTML = `
            <div class="device-info">
                <i class="fas fa-microchip"></i>
                <div>
                    <div class="device-name">${device.name || 'Unknown Device'}</div>
                    <div class="device-id">${device.id.substring(0, 16)}...</div>
                </div>
            </div>
            <div class="device-signal">
                <i class="fas fa-signal"></i> ${device.rssi || 'N/A'} dBm
            </div>
            <button class="select-device" data-id="${device.id}">
                <i class="fas fa-check"></i>
            </button>
        `;
        
        deviceItem.querySelector('.select-device').addEventListener('click', () => {
            this.selectDevice(device);
        });
        
        this.devicesList.appendChild(deviceItem);
    }

    selectDevice(device) {
        this.selectedDevice = device;
        this.connectBtn.disabled = false;
        
        // Highlight selected device
        document.querySelectorAll('.bluetooth-device').forEach(el => {
            el.classList.remove('selected');
        });
        event.target.closest('.bluetooth-device').classList.add('selected');
    }

    async connectToSelectedDevice() {
        if (!this.selectedDevice) return;
        
        this.setLoading(true);
        const result = await this.manager.connect(this.selectedDevice.device);
        this.setLoading(false);
        
        if (result.success) {
            this.updateStatus('Connected');
            this.showDeviceControls();
        } else {
            alert('Failed to connect: ' + result.error);
        }
    }

    showDeviceControls() {
        if (!this.deviceControls) return;
        
        this.deviceControls.style.display = 'block';
        
        const commandsContainer = document.getElementById('bt-device-commands');
        if (commandsContainer) {
            commandsContainer.innerHTML = `
                <button class="cmd-btn" data-cmd="toggle" data-device="light">
                    <i class="fas fa-lightbulb"></i> Toggle Light
                </button>
                <button class="cmd-btn" data-cmd="toggle" data-device="fan">
                    <i class="fas fa-fan"></i> Toggle Fan
                </button>
                <button class="cmd-btn" data-cmd="toggle" data-device="ac">
                    <i class="fas fa-wind"></i> Toggle AC
                </button>
                <button class="cmd-btn" data-cmd="status">
                    <i class="fas fa-chart-line"></i> Get Status
                </button>
            `;
            
            commandsContainer.querySelectorAll('.cmd-btn').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const cmd = btn.dataset.cmd;
                    const device = btn.dataset.device;
                    
                    if (cmd === 'toggle') {
                        await this.manager.sendDeviceCommand(cmd, { device });
                    } else if (cmd === 'status') {
                        const status = await this.manager.getDeviceStatus();
                        console.log('Device status:', status);
                    }
                });
            });
        }
    }

    hideDeviceControls() {
        if (this.deviceControls) {
            this.deviceControls.style.display = 'none';
        }
    }

    clearDevicesList() {
        if (this.devicesList) {
            this.devicesList.innerHTML = '<div class="loading">Scanning for devices...</div>';
        }
    }

    updateStatus(status) {
        if (this.statusSpan) {
            this.statusSpan.textContent = status;
            this.statusSpan.className = `bluetooth-status ${status.toLowerCase()}`;
        }
    }

    setLoading(loading) {
        if (this.scanBtn) {
            this.scanBtn.disabled = loading;
            this.scanBtn.innerHTML = loading ? 
                '<i class="fas fa-spinner fa-spin"></i> Scanning...' : 
                '<i class="fas fa-search"></i> Scan Devices';
        }
    }
}

// ============================================
// CSS STYLES (Auto-injected)
// ============================================

const bluetoothStyles = `
    .bluetooth-panel {
        background: var(--bg-card);
        border-radius: 12px;
        padding: 20px;
        border: 1px solid var(--border-color);
    }
    
    .bluetooth-header {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 20px;
        padding-bottom: 12px;
        border-bottom: 1px solid var(--border-color);
    }
    
    .bluetooth-header i {
        font-size: 24px;
        color: var(--primary);
    }
    
    .bluetooth-header h3 {
        flex: 1;
        margin: 0;
    }
    
    .bluetooth-status {
        padding: 4px 12px;
        border-radius: 20px;
        font-size: 12px;
        font-weight: 500;
    }
    
    .bluetooth-status.connected {
        background: var(--success-soft);
        color: var(--success);
    }
    
    .bluetooth-status.disconnected {
        background: var(--danger-soft);
        color: var(--danger);
    }
    
    .bluetooth-controls {
        display: flex;
        gap: 12px;
        margin-bottom: 20px;
    }
    
    .bluetooth-devices {
        max-height: 300px;
        overflow-y: auto;
        margin-bottom: 20px;
    }
    
    .bluetooth-device {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px;
        background: var(--bg-secondary);
        border-radius: 8px;
        margin-bottom: 8px;
        transition: all 0.2s ease;
    }
    
    .bluetooth-device.selected {
        background: var(--primary-soft);
        border: 1px solid var(--primary);
    }
    
    .device-info {
        display: flex;
        align-items: center;
        gap: 12px;
    }
    
    .device-name {
        font-weight: 500;
    }
    
    .device-id {
        font-size: 10px;
        color: var(--text-muted);
    }
    
    .device-signal {
        font-size: 12px;
        color: var(--text-secondary);
    }
    
    .select-device {
        background: var(--primary);
        color: white;
        border: none;
        border-radius: 20px;
        padding: 4px 12px;
        cursor: pointer;
    }
    
    .bluetooth-device-controls {
        margin-top: 20px;
        padding-top: 20px;
        border-top: 1px solid var(--border-color);
    }
    
    .cmd-btn {
        background: var(--bg-tertiary);
        border: 1px solid var(--border-color);
        border-radius: 8px;
        padding: 10px 16px;
        margin: 5px;
        cursor: pointer;
        transition: all 0.2s ease;
    }
    
    .cmd-btn:hover {
        background: var(--primary);
        color: white;
    }
    
    .no-devices {
        text-align: center;
        color: var(--text-muted);
        padding: 20px;
    }
    
    .loading {
        text-align: center;
        color: var(--text-secondary);
        padding: 20px;
    }
`;

// Inject styles
if (typeof document !== 'undefined') {
    const styleSheet = document.createElement('style');
    styleSheet.textContent = bluetoothStyles;
    document.head.appendChild(styleSheet);
}

// ============================================
// CREATE SINGLETON INSTANCES
// ============================================

const bluetoothManager = new BluetoothManager();
const bluetoothUI = new BluetoothUI(bluetoothManager);

// ============================================
// EXPORTS
// ============================================

// Expose to window
window.bluetoothManager = bluetoothManager;
window.bluetoothUI = bluetoothUI;
window.BluetoothManager = BluetoothManager;
window.BluetoothConfig = BluetoothConfig;

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        bluetoothManager,
        bluetoothUI,
        BluetoothManager,
        BluetoothConfig
    };
}

// ES modules export
export {
    bluetoothManager,
    bluetoothUI,
    BluetoothManager,
    BluetoothConfig
};