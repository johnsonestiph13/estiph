/**
 * ESTIF HOME ULTIMATE - DEVICE DISCOVERY MODULE
 * Automatic discovery of smart devices on local network via multiple protocols
 * Version: 2.0.0
 * Author: Estifanos Yohannis
 */

// ============================================
// DEVICE DISCOVERY CONFIGURATION
// ============================================

const DeviceDiscoveryConfig = {
    // Discovery methods
    methods: ['mdns', 'upnp', 'ssdp', 'http', 'ble'],
    
    // mDNS configuration
    mdns: {
        serviceTypes: ['_estif._tcp.local', '_esp32._tcp.local', '_http._tcp.local'],
        timeout: 5000,
        queryInterval: 30000
    },
    
    // UPnP/SSDP configuration
    upnp: {
        multicastAddress: '239.255.255.250',
        port: 1900,
        timeout: 3000,
        searchTarget: 'ssdp:all'
    },
    
    // HTTP probe configuration
    http: {
        ports: [80, 8080, 3000, 5000, 8000],
        endpoints: ['/api/info', '/status', '/health', '/'],
        timeout: 2000,
        concurrentRequests: 10
    },
    
    // Bluetooth LE configuration
    ble: {
        serviceUUIDs: ['12345678-1234-1234-1234-123456789abc'],
        deviceNamePrefixes: ['ESP32', 'Estif', 'SmartDevice'],
        timeout: 10000
    },
    
    // Network scan configuration
    network: {
        enabled: true,
        scanRange: 254,
        pingTimeout: 1000,
        concurrentPings: 20
    },
    
    // Discovery settings
    backgroundDiscovery: true,
    discoveryInterval: 60000, // 1 minute
    deviceTTL: 300000, // 5 minutes
    maxDevices: 50,
    
    // Auto-registration
    autoRegister: true,
    registerEndpoint: '/api/devices/discover',
    
    // Debug
    debug: false
};

// ============================================
// NETWORK UTILITIES
// ============================================

class NetworkUtils {
    static async getLocalIP() {
        return new Promise((resolve) => {
            const pc = new RTCPeerConnection({ iceServers: [] });
            pc.createDataChannel('');
            pc.createOffer().then(offer => pc.setLocalDescription(offer));
            
            pc.onicecandidate = (event) => {
                if (event && event.candidate && event.candidate.candidate) {
                    const ipMatch = event.candidate.candidate.match(/([0-9]{1,3}\.){3}[0-9]{1,3}/);
                    if (ipMatch) {
                        const ip = ipMatch[0];
                        pc.close();
                        resolve(ip);
                    }
                }
            };
            
            setTimeout(() => {
                pc.close();
                resolve('127.0.0.1');
            }, 3000);
        });
    }

    static getSubnet(ip, mask = '255.255.255.0') {
        const ipParts = ip.split('.');
        const maskParts = mask.split('.');
        const subnet = [];
        
        for (let i = 0; i < 4; i++) {
            subnet.push(parseInt(ipParts[i]) & parseInt(maskParts[i]));
        }
        
        return subnet.join('.');
    }

    static generateIPRange(subnet) {
        const ips = [];
        const parts = subnet.split('.');
        
        for (let i = 1; i <= 254; i++) {
            ips.push(`${parts[0]}.${parts[1]}.${parts[2]}.${i}`);
        }
        
        return ips;
    }

    static async ping(ip, timeout = DeviceDiscoveryConfig.network.pingTimeout) {
        const start = Date.now();
        
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeout);
            
            const response = await fetch(`http://${ip}`, {
                method: 'HEAD',
                mode: 'no-cors',
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            return { ip, success: true, time: Date.now() - start };
        } catch (error) {
            return { ip, success: false };
        }
    }
}

// ============================================
// MDNS DISCOVERY
// ============================================

class MDNSDiscovery {
    async discover() {
        const devices = [];
        
        for (const serviceType of DeviceDiscoveryConfig.mdns.serviceTypes) {
            try {
                const discovered = await this.queryMDNS(serviceType);
                devices.push(...discovered);
            } catch (error) {
                DeviceDiscoveryConfig.debug && console.log(`[MDNS] Failed for ${serviceType}:`, error);
            }
        }
        
        return devices;
    }

    async queryMDNS(serviceType) {
        // mDNS is not directly available in browsers
        // This simulates mDNS discovery via DNS lookup
        return [];
    }
}

// ============================================
// UPnP/SSDP DISCOVERY
// ============================================

class UPnPDiscovery {
    async discover() {
        const devices = [];
        
        try {
            const response = await this.sendSSDPRequest();
            const discovered = this.parseSSDPResponse(response);
            devices.push(...discovered);
        } catch (error) {
            DeviceDiscoveryConfig.debug && console.log('[UPnP] Discovery failed:', error);
        }
        
        return devices;
    }

    async sendSSDPRequest() {
        // SSDP is not directly available in browsers
        // This is a placeholder for future implementation
        return [];
    }

    parseSSDPResponse(response) {
        return [];
    }
}

// ============================================
// HTTP PROBE DISCOVERY
// ============================================

class HTTPProbeDiscovery {
    async discover(ipList = null) {
        if (!ipList) {
            const localIP = await NetworkUtils.getLocalIP();
            const subnet = NetworkUtils.getSubnet(localIP);
            ipList = NetworkUtils.generateIPRange(subnet);
        }
        
        const devices = [];
        const chunks = this.chunkArray(ipList, DeviceDiscoveryConfig.http.concurrentRequests);
        
        for (const chunk of chunks) {
            const chunkResults = await Promise.allSettled(
                chunk.map(ip => this.probeIP(ip))
            );
            
            for (const result of chunkResults) {
                if (result.status === 'fulfilled' && result.value) {
                    devices.push(result.value);
                }
            }
        }
        
        return devices;
    }

    async probeIP(ip) {
        for (const port of DeviceDiscoveryConfig.http.ports) {
            for (const endpoint of DeviceDiscoveryConfig.http.endpoints) {
                try {
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), DeviceDiscoveryConfig.http.timeout);
                    
                    const response = await fetch(`http://${ip}:${port}${endpoint}`, {
                        signal: controller.signal,
                        headers: { 'Accept': 'application/json' }
                    });
                    
                    clearTimeout(timeoutId);
                    
                    if (response.ok) {
                        const contentType = response.headers.get('content-type');
                        if (contentType && contentType.includes('application/json')) {
                            const data = await response.json();
                            
                            if (this.isSmartDevice(data)) {
                                return {
                                    type: 'http',
                                    ip,
                                    port,
                                    endpoint,
                                    data,
                                    timestamp: Date.now()
                                };
                            }
                        }
                    }
                } catch (error) {
                    // Ignore connection errors
                }
            }
        }
        
        return null;
    }

    isSmartDevice(data) {
        const indicators = [
            data.device === 'esp32',
            data.device === 'estif-home',
            data.model === 'ESP32',
            data.type === 'smart-device',
            data.firmware?.includes('ESP'),
            data.manufacturer?.includes('Estif')
        ];
        
        return indicators.some(i => i === true);
    }

    chunkArray(array, size) {
        const chunks = [];
        for (let i = 0; i < array.length; i += size) {
            chunks.push(array.slice(i, i + size));
        }
        return chunks;
    }
}

// ============================================
// BLUETOOTH LE DISCOVERY
// ============================================

class BLEDiscovery {
    async discover() {
        if (!('bluetooth' in navigator)) {
            DeviceDiscoveryConfig.debug && console.log('[BLE] Not supported');
            return [];
        }
        
        const devices = [];
        
        try {
            const device = await navigator.bluetooth.requestDevice({
                filters: this.getFilters(),
                optionalServices: DeviceDiscoveryConfig.ble.serviceUUIDs
            });
            
            devices.push({
                type: 'ble',
                id: device.id,
                name: device.name,
                device: device,
                timestamp: Date.now()
            });
        } catch (error) {
            DeviceDiscoveryConfig.debug && console.log('[BLE] Discovery cancelled or failed:', error);
        }
        
        return devices;
    }

    getFilters() {
        const filters = [];
        
        for (const prefix of DeviceDiscoveryConfig.ble.deviceNamePrefixes) {
            filters.push({ namePrefix: prefix });
        }
        
        for (const uuid of DeviceDiscoveryConfig.ble.serviceUUIDs) {
            filters.push({ services: [uuid] });
        }
        
        return filters;
    }

    async scan(timeout = DeviceDiscoveryConfig.ble.timeout) {
        const devices = [];
        const startTime = Date.now();
        
        while (Date.now() - startTime < timeout) {
            const discovered = await this.discover();
            devices.push(...discovered);
            await this.delay(1000);
        }
        
        return this.deduplicate(devices);
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    deduplicate(devices) {
        const seen = new Set();
        return devices.filter(device => {
            if (seen.has(device.id)) return false;
            seen.add(device.id);
            return true;
        });
    }
}

// ============================================
// DEVICE DISCOVERY MANAGER
// ============================================

class DeviceDiscoveryManager {
    constructor() {
        this.discoveredDevices = new Map();
        this.discoveryMethods = [];
        this.isDiscovering = false;
        this.discoveryTimer = null;
        this.listeners = [];
        
        this.init();
    }

    init() {
        this.initDiscoveryMethods();
        this.startBackgroundDiscovery();
        DeviceDiscoveryConfig.debug && console.log('[DeviceDiscovery] Manager initialized');
    }

    initDiscoveryMethods() {
        if (DeviceDiscoveryConfig.methods.includes('mdns')) {
            this.discoveryMethods.push(new MDNSDiscovery());
        }
        if (DeviceDiscoveryConfig.methods.includes('upnp')) {
            this.discoveryMethods.push(new UPnPDiscovery());
        }
        if (DeviceDiscoveryConfig.methods.includes('http')) {
            this.discoveryMethods.push(new HTTPProbeDiscovery());
        }
        if (DeviceDiscoveryConfig.methods.includes('ble')) {
            this.discoveryMethods.push(new BLEDiscovery());
        }
    }

    async discoverDevices(options = {}) {
        if (this.isDiscovering) {
            DeviceDiscoveryConfig.debug && console.log('[DeviceDiscovery] Already in progress');
            return [];
        }

        this.isDiscovering = true;
        const allDevices = [];
        
        try {
            this.notifyListeners('discovery_started');
            
            for (const method of this.discoveryMethods) {
                const devices = await method.discover();
                allDevices.push(...devices);
            }
            
            const uniqueDevices = this.deduplicateDevices(allDevices);
            
            for (const device of uniqueDevices) {
                this.registerDevice(device);
            }
            
            if (DeviceDiscoveryConfig.autoRegister) {
                await this.autoRegisterDevices(uniqueDevices);
            }
            
            this.notifyListeners('discovery_completed', uniqueDevices);
            
            return uniqueDevices;
        } catch (error) {
            console.error('[DeviceDiscovery] Discovery error:', error);
            this.notifyListeners('discovery_error', error);
            return [];
        } finally {
            this.isDiscovering = false;
        }
    }

    registerDevice(device) {
        const key = `${device.type}:${device.ip || device.id}`;
        const existing = this.discoveredDevices.get(key);
        
        if (!existing || device.timestamp > existing.timestamp) {
            device.firstSeen = existing ? existing.firstSeen : Date.now();
            device.lastSeen = Date.now();
            this.discoveredDevices.set(key, device);
            
            if (!existing) {
                this.notifyListeners('device_found', device);
            } else {
                this.notifyListeners('device_updated', device);
            }
        }
    }

    deduplicateDevices(devices) {
        const seen = new Map();
        
        for (const device of devices) {
            const key = device.ip || device.id;
            if (!seen.has(key) || seen.get(key).timestamp < device.timestamp) {
                seen.set(key, device);
            }
        }
        
        return Array.from(seen.values());
    }

    async autoRegisterDevices(devices) {
        for (const device of devices) {
            try {
                const response = await fetch(DeviceDiscoveryConfig.registerEndpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(device)
                });
                
                if (response.ok) {
                    const registered = await response.json();
                    this.notifyListeners('device_registered', registered);
                }
            } catch (error) {
                DeviceDiscoveryConfig.debug && console.log('[DeviceDiscovery] Auto-registration failed:', device.ip);
            }
        }
    }

    getDiscoveredDevices() {
        return Array.from(this.discoveredDevices.values());
    }

    getDevice(ip) {
        for (const device of this.discoveredDevices.values()) {
            if (device.ip === ip) return device;
        }
        return null;
    }

    removeDevice(ip) {
        for (const [key, device] of this.discoveredDevices.entries()) {
            if (device.ip === ip) {
                this.discoveredDevices.delete(key);
                this.notifyListeners('device_removed', device);
                return true;
            }
        }
        return false;
    }

    cleanOldDevices() {
        const now = Date.now();
        let removed = false;
        
        for (const [key, device] of this.discoveredDevices.entries()) {
            if (now - device.lastSeen > DeviceDiscoveryConfig.deviceTTL) {
                this.discoveredDevices.delete(key);
                removed = true;
            }
        }
        
        if (removed) {
            this.notifyListeners('devices_cleaned');
        }
    }

    startBackgroundDiscovery() {
        if (!DeviceDiscoveryConfig.backgroundDiscovery) return;
        
        this.discoveryTimer = setInterval(() => {
            this.discoverDevices();
            this.cleanOldDevices();
        }, DeviceDiscoveryConfig.discoveryInterval);
    }

    stopBackgroundDiscovery() {
        if (this.discoveryTimer) {
            clearInterval(this.discoveryTimer);
            this.discoveryTimer = null;
        }
    }

    async scanNetwork() {
        const httpProbe = new HTTPProbeDiscovery();
        const devices = await httpProbe.discover();
        return devices;
    }

    // ============================================
    // ESP32 SPECIFIC METHODS
    // ============================================

    async findESP32Devices() {
        const allDevices = await this.discoverDevices();
        return allDevices.filter(device => 
            device.data?.device === 'esp32' ||
            device.data?.model === 'ESP32' ||
            device.name?.includes('ESP32')
        );
    }

    async getESP32Info(ip, port = 80) {
        try {
            const response = await fetch(`http://${ip}:${port}/api/info`);
            if (response.ok) {
                return await response.json();
            }
        } catch (error) {
            DeviceDiscoveryConfig.debug && console.log(`[DeviceDiscovery] Failed to get info from ${ip}`);
        }
        return null;
    }

    // ============================================
    // UTILITY METHODS
    // ============================================

    getDiscoveryStats() {
        return {
            discoveredDevices: this.discoveredDevices.size,
            isDiscovering: this.isDiscovering,
            backgroundEnabled: DeviceDiscoveryConfig.backgroundDiscovery,
            methods: DeviceDiscoveryConfig.methods
        };
    }

    reset() {
        this.discoveredDevices.clear();
        this.notifyListeners('reset');
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
// DEVICE DISCOVERY UI COMPONENT
// ============================================

class DeviceDiscoveryUI {
    constructor(manager) {
        this.manager = manager;
        this.init();
    }

    init() {
        this.createUI();
        this.bindEvents();
        DeviceDiscoveryConfig.debug && console.log('[DeviceDiscoveryUI] Initialized');
    }

    createUI() {
        const container = document.getElementById('device-discovery-container');
        if (!container) return;

        container.innerHTML = `
            <div class="discovery-panel">
                <div class="discovery-header">
                    <i class="fas fa-search"></i>
                    <h3>Device Discovery</h3>
                    <button id="scan-btn" class="btn btn-sm btn-primary">
                        <i class="fas fa-sync-alt"></i> Scan
                    </button>
                </div>
                
                <div class="discovery-stats">
                    <div class="stat">
                        <span class="stat-label">Discovered</span>
                        <span class="stat-value" id="device-count">0</span>
                    </div>
                    <div class="stat">
                        <span class="stat-label">Status</span>
                        <span class="stat-value" id="discovery-status">Idle</span>
                    </div>
                </div>
                
                <div class="discovered-devices" id="discovered-devices">
                    <p class="no-devices">No devices discovered yet. Click Scan to start.</p>
                </div>
            </div>
        `;

        this.cacheElements();
    }

    cacheElements() {
        this.scanBtn = document.getElementById('scan-btn');
        this.deviceCountSpan = document.getElementById('device-count');
        this.statusSpan = document.getElementById('discovery-status');
        this.devicesContainer = document.getElementById('discovered-devices');
    }

    bindEvents() {
        if (this.scanBtn) {
            this.scanBtn.addEventListener('click', () => this.startDiscovery());
        }
        
        this.manager.addEventListener('discovery_started', () => this.setDiscovering(true));
        this.manager.addEventListener('discovery_completed', (devices) => this.onDiscoveryComplete(devices));
        this.manager.addEventListener('device_found', (device) => this.addDevice(device));
        this.manager.addEventListener('devices_cleaned', () => this.renderDevices());
    }

    async startDiscovery() {
        this.setDiscovering(true);
        await this.manager.discoverDevices();
        this.setDiscovering(false);
    }

    onDiscoveryComplete(devices) {
        this.renderDevices(devices);
        this.updateDeviceCount(devices.length);
    }

    renderDevices(devices = null) {
        const deviceList = devices || this.manager.getDiscoveredDevices();
        
        if (!this.devicesContainer) return;
        
        if (deviceList.length === 0) {
            this.devicesContainer.innerHTML = '<p class="no-devices">No devices discovered.</p>';
            return;
        }
        
        this.devicesContainer.innerHTML = deviceList.map(device => `
            <div class="discovered-device" data-ip="${device.ip || ''}">
                <div class="device-icon">
                    <i class="fas fa-microchip"></i>
                </div>
                <div class="device-info">
                    <div class="device-name">${device.name || device.data?.name || 'Unknown Device'}</div>
                    <div class="device-details">
                        ${device.ip ? `<span class="device-ip">${device.ip}:${device.port}</span>` : ''}
                        ${device.type ? `<span class="device-type">${device.type.toUpperCase()}</span>` : ''}
                    </div>
                </div>
                <div class="device-actions">
                    <button class="add-device" data-device='${JSON.stringify(device)}'>
                        <i class="fas fa-plus"></i> Add
                    </button>
                </div>
            </div>
        `).join('');
        
        // Bind add buttons
        document.querySelectorAll('.add-device').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const device = JSON.parse(btn.dataset.device);
                this.addDeviceToSystem(device);
            });
        });
    }

    addDevice(device) {
        if (!this.devicesContainer) return;
        
        // Check if already exists
        if (document.querySelector(`.discovered-device[data-ip="${device.ip}"]`)) {
            return;
        }
        
        const deviceElement = document.createElement('div');
        deviceElement.className = 'discovered-device';
        deviceElement.dataset.ip = device.ip || '';
        deviceElement.innerHTML = `
            <div class="device-icon">
                <i class="fas fa-microchip"></i>
            </div>
            <div class="device-info">
                <div class="device-name">${device.name || device.data?.name || 'Unknown Device'}</div>
                <div class="device-details">
                    ${device.ip ? `<span class="device-ip">${device.ip}:${device.port}</span>` : ''}
                    ${device.type ? `<span class="device-type">${device.type.toUpperCase()}</span>` : ''}
                </div>
            </div>
            <div class="device-actions">
                <button class="add-device" data-device='${JSON.stringify(device)}'>
                    <i class="fas fa-plus"></i> Add
                </button>
            </div>
        `;
        
        this.devicesContainer.appendChild(deviceElement);
        this.updateDeviceCount(this.manager.getDiscoveredDevices().length);
    }

    async addDeviceToSystem(device) {
        // Implement device addition logic
        console.log('Adding device:', device);
        alert(`Device ${device.name || 'Unknown'} added to system`);
    }

    setDiscovering(discovering) {
        if (this.scanBtn) {
            this.scanBtn.disabled = discovering;
            this.scanBtn.innerHTML = discovering ? 
                '<i class="fas fa-spinner fa-spin"></i> Scanning...' : 
                '<i class="fas fa-sync-alt"></i> Scan';
        }
        
        if (this.statusSpan) {
            this.statusSpan.textContent = discovering ? 'Scanning...' : 'Idle';
        }
    }

    updateDeviceCount(count) {
        if (this.deviceCountSpan) {
            this.deviceCountSpan.textContent = count;
        }
    }
}

// ============================================
// CSS STYLES (Auto-injected)
// ============================================

const discoveryStyles = `
    .discovery-panel {
        background: var(--bg-card);
        border-radius: 12px;
        padding: 20px;
        border: 1px solid var(--border-color);
    }
    
    .discovery-header {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 20px;
        padding-bottom: 12px;
        border-bottom: 1px solid var(--border-color);
    }
    
    .discovery-header i {
        font-size: 20px;
        color: var(--primary);
    }
    
    .discovery-header h3 {
        flex: 1;
        margin: 0;
    }
    
    .discovery-stats {
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
    
    .discovered-devices {
        max-height: 400px;
        overflow-y: auto;
    }
    
    .discovered-device {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px;
        background: var(--bg-secondary);
        border-radius: 8px;
        margin-bottom: 8px;
        transition: all 0.2s ease;
    }
    
    .discovered-device:hover {
        background: var(--bg-hover);
        transform: translateX(4px);
    }
    
    .device-icon {
        width: 40px;
        height: 40px;
        background: var(--primary-soft);
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--primary);
    }
    
    .device-info {
        flex: 1;
    }
    
    .device-name {
        font-weight: 500;
        margin-bottom: 4px;
    }
    
    .device-details {
        display: flex;
        gap: 12px;
        font-size: 11px;
        color: var(--text-muted);
    }
    
    .device-ip {
        font-family: monospace;
    }
    
    .device-type {
        text-transform: uppercase;
    }
    
    .add-device {
        background: var(--success);
        border: none;
        border-radius: 6px;
        padding: 6px 12px;
        color: white;
        cursor: pointer;
        transition: all 0.2s ease;
    }
    
    .add-device:hover {
        background: var(--success-dark);
        transform: scale(1.05);
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
    styleSheet.textContent = discoveryStyles;
    document.head.appendChild(styleSheet);
}

// ============================================
// CREATE SINGLETON INSTANCES
// ============================================

const deviceDiscovery = new DeviceDiscoveryManager();
const deviceDiscoveryUI = new DeviceDiscoveryUI(deviceDiscovery);

// ============================================
// EXPORTS
// ============================================

// Expose to window
window.deviceDiscovery = deviceDiscovery;
window.deviceDiscoveryUI = deviceDiscoveryUI;
window.DeviceDiscoveryManager = DeviceDiscoveryManager;
window.DeviceDiscoveryConfig = DeviceDiscoveryConfig;

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        deviceDiscovery,
        deviceDiscoveryUI,
        DeviceDiscoveryManager,
        DeviceDiscoveryConfig
    };
}

// ES modules export
export {
    deviceDiscovery,
    deviceDiscoveryUI,
    DeviceDiscoveryManager,
    DeviceDiscoveryConfig
};