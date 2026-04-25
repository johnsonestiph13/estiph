/**
 * ESTIF HOME ULTIMATE - LAN DISCOVERY MODULE
 * Automatic discovery of ESP32 devices on local network using UDP, MDNS, and HTTP probes
 * Version: 2.0.0
 * Author: Estifanos Yohannis
 */

// ============================================
// LAN DISCOVERY CONFIGURATION
// ============================================

const LanDiscoveryConfig = {
    // Discovery methods
    methods: ['mdns', 'udp', 'http', 'arp'],
    
    // MDNS configuration
    mdns: {
        serviceType: '_estif._tcp.local',
        timeout: 5000,
        queryInterval: 30000
    },
    
    // UDP broadcast configuration
    udp: {
        broadcastAddress: '255.255.255.255',
        port: 12345,
        message: 'ESTIF_DISCOVERY',
        responseTimeout: 3000,
        retryCount: 3
    },
    
    // HTTP probe configuration
    http: {
        ports: [80, 8080, 3000, 5000],
        endpoints: ['/api/health', '/status', '/info', '/'],
        timeout: 2000,
        concurrentRequests: 5
    },
    
    // ARP scan configuration
    arp: {
        timeout: 5000,
        retryCount: 2
    },
    
    // Network configuration
    network: {
        subnetScan: true,
        subnetMask: '255.255.255.0',
        scanRange: 254,
        pingTimeout: 1000
    },
    
    // Device registration
    autoRegister: true,
    deviceTTL: 300000, // 5 minutes
    maxDevices: 50,
    
    // Background discovery
    backgroundDiscovery: true,
    discoveryInterval: 60000, // 1 minute
    
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

    static getSubnet(ip, mask = LanDiscoveryConfig.network.subnetMask) {
        const ipParts = ip.split('.');
        const maskParts = mask.split('.');
        const subnet = [];
        
        for (let i = 0; i < 4; i++) {
            subnet.push(parseInt(ipParts[i]) & parseInt(maskParts[i]));
        }
        
        return subnet.join('.');
    }

    static getNetworkRange(subnet, mask = LanDiscoveryConfig.network.subnetMask) {
        const subnetParts = subnet.split('.');
        const maskParts = mask.split('.');
        let hostBits = 0;
        
        for (const part of maskParts) {
            hostBits += 8 - part.toString(2).length;
        }
        
        const startIP = [...subnetParts];
        startIP[3] = '1';
        
        const endIP = [...subnetParts];
        endIP[3] = (Math.pow(2, hostBits) - 2).toString();
        
        return { start: startIP.join('.'), end: endIP.join('.') };
    }

    static generateIPRange(startIP, endIP) {
        const start = startIP.split('.').map(Number);
        const end = endIP.split('.').map(Number);
        const ips = [];
        
        for (let a = start[0]; a <= end[0]; a++) {
            for (let b = start[1]; b <= end[1]; b++) {
                for (let c = start[2]; c <= end[2]; c++) {
                    for (let d = start[3]; d <= end[3]; d++) {
                        ips.push(`${a}.${b}.${c}.${d}`);
                    }
                }
            }
        }
        
        return ips;
    }

    static async ping(ip, timeout = 1000) {
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
            return { ip, success: false, error: error.message };
        }
    }

    static async pingAll(ips, concurrency = 10) {
        const results = [];
        const chunks = [];
        
        for (let i = 0; i < ips.length; i += concurrency) {
            chunks.push(ips.slice(i, i + concurrency));
        }
        
        for (const chunk of chunks) {
            const chunkResults = await Promise.all(chunk.map(ip => this.ping(ip)));
            results.push(...chunkResults);
        }
        
        return results;
    }
}

// ============================================
// MDNS DISCOVERY
// ============================================

class MDNSDiscovery {
    constructor() {
        this.services = [];
    }

    async discover() {
        if (typeof window === 'undefined' || !window.MDNS) {
            LanDiscoveryConfig.debug && console.log('[MDNS] Not supported');
            return [];
        }

        try {
            const mdns = new window.MDNS();
            const services = await mdns.query({
                serviceType: LanDiscoveryConfig.mdns.serviceType,
                timeout: LanDiscoveryConfig.mdns.timeout
            });
            
            this.services = services.map(s => ({
                type: 'mdns',
                name: s.name,
                hostname: s.hostname,
                ip: s.addresses[0],
                port: s.port,
                txt: s.txt
            }));
            
            return this.services;
        } catch (error) {
            LanDiscoveryConfig.debug && console.log('[MDNS] Discovery failed:', error);
            return [];
        }
    }
}

// ============================================
// UDP DISCOVERY
// ============================================

class UDPDiscovery {
    constructor() {
        this.socket = null;
        this.devices = new Map();
    }

    async discover() {
        if (typeof window === 'undefined' || !window.WebSocket) {
            LanDiscoveryConfig.debug && console.log('[UDP] Not supported in browser');
            return [];
        }

        // Note: Raw UDP is not available in browsers
        // This is a simulated UDP discovery using WebSocket proxy
        return await this.simulateUDPDiscovery();
    }

    async simulateUDPDiscovery() {
        const discovered = [];
        const subnet = await NetworkUtils.getLocalIP().then(ip => NetworkUtils.getSubnet(ip));
        const range = NetworkUtils.getNetworkRange(subnet);
        const ips = NetworkUtils.generateIPRange(range.start, range.end);
        
        const probePromises = ips.map(async (ip) => {
            for (const port of [80, 8080, 3000]) {
                try {
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 1000);
                    
                    const response = await fetch(`http://${ip}:${port}/api/health`, {
                        signal: controller.signal
                    });
                    
                    clearTimeout(timeoutId);
                    
                    if (response.ok) {
                        const data = await response.json();
                        if (data.device === 'estif-esp32') {
                            discovered.push({
                                type: 'udp',
                                ip,
                                port,
                                data
                            });
                        }
                    }
                } catch (error) {
                    // Ignore connection errors
                }
            }
        });
        
        await Promise.allSettled(probePromises);
        return discovered;
    }
}

// ============================================
// HTTP PROBE DISCOVERY
// ============================================

class HTTPProbeDiscovery {
    constructor() {
        this.devices = [];
    }

    async discover(ip, port) {
        const devices = [];
        
        for (const endpoint of LanDiscoveryConfig.http.endpoints) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), LanDiscoveryConfig.http.timeout);
                
                const response = await fetch(`http://${ip}:${port}${endpoint}`, {
                    signal: controller.signal,
                    headers: { 'Accept': 'application/json' }
                });
                
                clearTimeout(timeoutId);
                
                if (response.ok) {
                    const contentType = response.headers.get('content-type');
                    if (contentType && contentType.includes('application/json')) {
                        const data = await response.json();
                        
                        if (this.isESP32Device(data)) {
                            devices.push({
                                type: 'http',
                                ip,
                                port,
                                endpoint,
                                data
                            });
                        }
                    }
                }
            } catch (error) {
                // Ignore connection errors
            }
        }
        
        return devices;
    }

    isESP32Device(data) {
        return data.device === 'esp32' ||
               data.model === 'ESP32' ||
               data.deviceType === 'estif-home' ||
               data.firmware?.includes('ESP32');
    }

    async discoverNetwork(ips) {
        const allDevices = [];
        const ports = LanDiscoveryConfig.http.ports;
        
        // Limit concurrent requests
        const chunks = [];
        for (let i = 0; i < ips.length; i += LanDiscoveryConfig.http.concurrentRequests) {
            chunks.push(ips.slice(i, i + LanDiscoveryConfig.http.concurrentRequests));
        }
        
        for (const chunk of chunks) {
            const chunkPromises = chunk.flatMap(ip => 
                ports.map(port => this.discover(ip, port))
            );
            
            const results = await Promise.allSettled(chunkPromises);
            for (const result of results) {
                if (result.status === 'fulfilled' && result.value.length > 0) {
                    allDevices.push(...result.value);
                }
            }
        }
        
        return allDevices;
    }
}

// ============================================
// LAN DISCOVERY MANAGER
// ============================================

class LanDiscoveryManager {
    constructor() {
        this.devices = new Map();
        this.discoveryMethods = [];
        this.isDiscovering = false;
        this.discoveryInterval = null;
        this.listeners = [];
        
        this.init();
    }

    init() {
        this.initDiscoveryMethods();
        this.startBackgroundDiscovery();
        LanDiscoveryConfig.debug && console.log('[LAN] Discovery manager initialized');
    }

    initDiscoveryMethods() {
        if (LanDiscoveryConfig.methods.includes('mdns')) {
            this.discoveryMethods.push(new MDNSDiscovery());
        }
        if (LanDiscoveryConfig.methods.includes('udp')) {
            this.discoveryMethods.push(new UDPDiscovery());
        }
        if (LanDiscoveryConfig.methods.includes('http')) {
            this.discoveryMethods.push(new HTTPProbeDiscovery());
        }
    }

    // ============================================
    // DISCOVERY METHODS
    // ============================================

    async discoverDevices(options = {}) {
        if (this.isDiscovering) {
            LanDiscoveryConfig.debug && console.log('[LAN] Discovery already in progress');
            return [];
        }

        this.isDiscovering = true;
        const discoveredDevices = [];
        
        try {
            // Get network range
            const localIP = await NetworkUtils.getLocalIP();
            const subnet = NetworkUtils.getSubnet(localIP);
            const range = NetworkUtils.getNetworkRange(subnet);
            const ips = NetworkUtils.generateIPRange(range.start, range.end);
            
            LanDiscoveryConfig.debug && console.log(`[LAN] Scanning ${ips.length} IP addresses`);
            
            // Try each discovery method
            for (const method of this.discoveryMethods) {
                const devices = await method.discover(ips);
                discoveredDevices.push(...devices);
            }
            
            // Deduplicate devices by IP
            const uniqueDevices = this.deduplicateDevices(discoveredDevices);
            
            // Register devices
            for (const device of uniqueDevices) {
                this.registerDevice(device);
            }
            
            LanDiscoveryConfig.debug && console.log(`[LAN] Discovered ${uniqueDevices.length} devices`);
            this.notifyListeners('devices_discovered', uniqueDevices);
            
            return uniqueDevices;
        } catch (error) {
            console.error('[LAN] Discovery error:', error);
            return [];
        } finally {
            this.isDiscovering = false;
        }
    }

    async discoverSingleIP(ip) {
        const devices = [];
        const httpProbe = new HTTPProbeDiscovery();
        
        for (const port of LanDiscoveryConfig.http.ports) {
            const portDevices = await httpProbe.discover(ip, port);
            devices.push(...portDevices);
        }
        
        return this.deduplicateDevices(devices);
    }

    deduplicateDevices(devices) {
        const unique = new Map();
        
        for (const device of devices) {
            const key = device.ip;
            if (!unique.has(key) || unique.get(key).timestamp < device.timestamp) {
                unique.set(key, device);
            }
        }
        
        return Array.from(unique.values());
    }

    // ============================================
    // DEVICE REGISTRATION
    // ============================================

    registerDevice(device) {
        const deviceId = `${device.ip}:${device.port}`;
        const now = Date.now();
        
        if (this.devices.has(deviceId)) {
            const existing = this.devices.get(deviceId);
            existing.lastSeen = now;
            existing.data = device.data;
        } else {
            device.id = deviceId;
            device.firstSeen = now;
            device.lastSeen = now;
            this.devices.set(deviceId, device);
            
            this.notifyListeners('device_found', device);
        }
        
        // Clean up old devices
        this.cleanupDevices();
    }

    cleanupDevices() {
        const now = Date.now();
        let removed = false;
        
        for (const [id, device] of this.devices.entries()) {
            if (now - device.lastSeen > LanDiscoveryConfig.deviceTTL) {
                this.devices.delete(id);
                removed = true;
            }
        }
        
        if (removed) {
            this.notifyListeners('devices_updated', Array.from(this.devices.values()));
        }
    }

    getDevices() {
        return Array.from(this.devices.values());
    }

    getDevice(ip, port = null) {
        if (port) {
            return this.devices.get(`${ip}:${port}`);
        }
        
        for (const device of this.devices.values()) {
            if (device.ip === ip) {
                return device;
            }
        }
        
        return null;
    }

    removeDevice(ip, port = null) {
        const deviceId = port ? `${ip}:${port}` : ip;
        this.devices.delete(deviceId);
        this.notifyListeners('device_removed', { ip, port });
    }

    // ============================================
    // BACKGROUND DISCOVERY
    // ============================================

    startBackgroundDiscovery() {
        if (!LanDiscoveryConfig.backgroundDiscovery) return;
        
        this.discoveryInterval = setInterval(() => {
            this.discoverDevices().catch(error => {
                LanDiscoveryConfig.debug && console.log('[LAN] Background discovery error:', error);
            });
        }, LanDiscoveryConfig.discoveryInterval);
    }

    stopBackgroundDiscovery() {
        if (this.discoveryInterval) {
            clearInterval(this.discoveryInterval);
            this.discoveryInterval = null;
        }
    }

    // ============================================
    // ESP32 SPECIFIC METHODS
    // ============================================

    async findESP32Devices() {
        const devices = await this.discoverDevices();
        return devices.filter(d => 
            d.data?.device === 'esp32' ||
            d.data?.model === 'ESP32' ||
            d.name?.includes('ESP32')
        );
    }

    async getESP32Status(ip, port = 80) {
        try {
            const response = await fetch(`http://${ip}:${port}/api/status`);
            if (response.ok) {
                return await response.json();
            }
        } catch (error) {
            LanDiscoveryConfig.debug && console.log(`[LAN] Failed to get status from ${ip}`);
        }
        return null;
    }

    async configureESP32(ip, config, port = 80) {
        try {
            const response = await fetch(`http://${ip}:${port}/api/config`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(config)
            });
            
            return response.ok;
        } catch (error) {
            console.error(`[LAN] Failed to configure ${ip}:`, error);
            return false;
        }
    }

    async syncESP32Devices() {
        const esp32Devices = await this.findESP32Devices();
        const results = [];
        
        for (const device of esp32Devices) {
            const status = await this.getESP32Status(device.ip, device.port);
            if (status) {
                device.status = status;
                this.registerDevice(device);
                results.push(device);
            }
        }
        
        return results;
    }

    // ============================================
    // NETWORK SCANNING
    // ============================================

    async scanNetwork() {
        const localIP = await NetworkUtils.getLocalIP();
        const subnet = NetworkUtils.getSubnet(localIP);
        const range = NetworkUtils.getNetworkRange(subnet);
        const ips = NetworkUtils.generateIPRange(range.start, range.end);
        
        LanDiscoveryConfig.debug && console.log(`[LAN] Scanning ${ips.length} hosts...`);
        
        const pingResults = await NetworkUtils.pingAll(ips, 20);
        const activeHosts = pingResults.filter(r => r.success);
        
        LanDiscoveryConfig.debug && console.log(`[LAN] Found ${activeHosts.length} active hosts`);
        
        return activeHosts;
    }

    // ============================================
    // DEVICE COMMANDS
    // ============================================

    async sendCommand(ip, command, params = {}, port = 80) {
        try {
            const response = await fetch(`http://${ip}:${port}/api/command`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ command, ...params })
            });
            
            if (response.ok) {
                return await response.json();
            }
        } catch (error) {
            console.error(`[LAN] Failed to send command to ${ip}:`, error);
        }
        
        return null;
    }

    async rebootESP32(ip, port = 80) {
        return this.sendCommand(ip, 'reboot', {}, port);
    }

    async updateFirmware(ip, firmwareUrl, port = 80) {
        return this.sendCommand(ip, 'update', { url: firmwareUrl }, port);
    }

    // ============================================
    // UTILITY METHODS
    // ============================================

    getNetworkInfo() {
        return {
            localIP: null,
            subnet: null,
            gateway: null,
            dns: null
        };
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
// LAN DISCOVERY UI COMPONENT
// ============================================

class LanDiscoveryUI {
    constructor(manager) {
        this.manager = manager;
        this.init();
    }

    init() {
        this.createUI();
        this.bindEvents();
        LanDiscoveryConfig.debug && console.log('[LAN UI] Initialized');
    }

    createUI() {
        const container = document.getElementById('lan-discovery-container');
        if (!container) return;

        container.innerHTML = `
            <div class="lan-discovery-panel">
                <div class="lan-header">
                    <i class="fas fa-network-wired"></i>
                    <h3>Local Network Devices</h3>
                    <button id="lan-scan-btn" class="btn btn-sm btn-primary">
                        <i class="fas fa-sync-alt"></i> Scan
                    </button>
                </div>
                
                <div class="lan-devices-list" id="lan-devices-list">
                    <p class="no-devices">Click Scan to discover devices on your network.</p>
                </div>
                
                <div class="lan-status">
                    <span id="lan-status-text">Ready</span>
                </div>
            </div>
        `;

        this.cacheElements();
    }

    cacheElements() {
        this.scanBtn = document.getElementById('lan-scan-btn');
        this.devicesList = document.getElementById('lan-devices-list');
        this.statusText = document.getElementById('lan-status-text');
    }

    bindEvents() {
        if (this.scanBtn) {
            this.scanBtn.addEventListener('click', () => this.scanNetwork());
        }
        
        this.manager.addEventListener('devices_discovered', (devices) => {
            this.renderDevices(devices);
        });
        
        this.manager.addEventListener('device_found', (device) => {
            this.addDeviceToList(device);
        });
        
        this.manager.addEventListener('devices_updated', (devices) => {
            this.renderDevices(devices);
        });
    }

    async scanNetwork() {
        this.setLoading(true);
        this.clearDevicesList();
        
        const devices = await this.manager.discoverDevices();
        this.renderDevices(devices);
        
        this.setLoading(false);
    }

    renderDevices(devices) {
        if (!this.devicesList) return;
        
        if (devices.length === 0) {
            this.devicesList.innerHTML = '<p class="no-devices">No devices found on your network.</p>';
            return;
        }
        
        this.devicesList.innerHTML = devices.map(device => `
            <div class="lan-device" data-ip="${device.ip}" data-port="${device.port}">
                <div class="device-icon">
                    <i class="fas fa-microchip"></i>
                </div>
                <div class="device-details">
                    <div class="device-name">${device.name || 'ESP32 Device'}</div>
                    <div class="device-ip">${device.ip}:${device.port}</div>
                    <div class="device-type">${device.data?.device || 'Unknown'}</div>
                </div>
                <div class="device-actions">
                    <button class="device-control" data-cmd="status">
                        <i class="fas fa-chart-line"></i>
                    </button>
                    <button class="device-control" data-cmd="reboot">
                        <i class="fas fa-power-off"></i>
                    </button>
                </div>
            </div>
        `).join('');
        
        // Bind control buttons
        document.querySelectorAll('.device-control').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const deviceDiv = btn.closest('.lan-device');
                const ip = deviceDiv.dataset.ip;
                const port = parseInt(deviceDiv.dataset.port);
                const cmd = btn.dataset.cmd;
                
                if (cmd === 'status') {
                    const status = await this.manager.getESP32Status(ip, port);
                    console.log('Device status:', status);
                    alert(JSON.stringify(status, null, 2));
                } else if (cmd === 'reboot') {
                    if (confirm('Reboot this device?')) {
                        await this.manager.rebootESP32(ip, port);
                        alert('Reboot command sent');
                    }
                }
            });
        });
    }

    addDeviceToList(device) {
        if (!this.devicesList) return;
        
        // Check if already exists
        if (document.querySelector(`.lan-device[data-ip="${device.ip}"]`)) {
            return;
        }
        
        const deviceElement = document.createElement('div');
        deviceElement.className = 'lan-device';
        deviceElement.dataset.ip = device.ip;
        deviceElement.dataset.port = device.port;
        deviceElement.innerHTML = `
            <div class="device-icon">
                <i class="fas fa-microchip"></i>
            </div>
            <div class="device-details">
                <div class="device-name">${device.name || 'ESP32 Device'}</div>
                <div class="device-ip">${device.ip}:${device.port}</div>
                <div class="device-type">${device.data?.device || 'Unknown'}</div>
            </div>
            <div class="device-actions">
                <button class="device-control" data-cmd="status">
                    <i class="fas fa-chart-line"></i>
                </button>
                <button class="device-control" data-cmd="reboot">
                    <i class="fas fa-power-off"></i>
                </button>
            </div>
        `;
        
        this.devicesList.appendChild(deviceElement);
    }

    clearDevicesList() {
        if (this.devicesList) {
            this.devicesList.innerHTML = '<div class="loading">Scanning network...</div>';
        }
    }

    setLoading(loading) {
        if (this.scanBtn) {
            this.scanBtn.disabled = loading;
            this.scanBtn.innerHTML = loading ? 
                '<i class="fas fa-spinner fa-spin"></i> Scanning...' : 
                '<i class="fas fa-sync-alt"></i> Scan';
        }
        
        if (this.statusText) {
            this.statusText.textContent = loading ? 'Scanning...' : 'Ready';
        }
    }
}

// ============================================
// CSS STYLES (Auto-injected)
// ============================================

const lanDiscoveryStyles = `
    .lan-discovery-panel {
        background: var(--bg-card);
        border-radius: 12px;
        padding: 20px;
        border: 1px solid var(--border-color);
    }
    
    .lan-header {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 20px;
        padding-bottom: 12px;
        border-bottom: 1px solid var(--border-color);
    }
    
    .lan-header i {
        font-size: 20px;
        color: var(--primary);
    }
    
    .lan-header h3 {
        flex: 1;
        margin: 0;
    }
    
    .lan-devices-list {
        max-height: 400px;
        overflow-y: auto;
    }
    
    .lan-device {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px;
        background: var(--bg-secondary);
        border-radius: 8px;
        margin-bottom: 8px;
        transition: all 0.2s ease;
    }
    
    .lan-device:hover {
        background: var(--bg-hover);
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
    
    .device-details {
        flex: 1;
    }
    
    .device-name {
        font-weight: 500;
        margin-bottom: 4px;
    }
    
    .device-ip {
        font-size: 11px;
        color: var(--text-muted);
        font-family: monospace;
    }
    
    .device-type {
        font-size: 10px;
        color: var(--text-secondary);
    }
    
    .device-actions {
        display: flex;
        gap: 8px;
    }
    
    .device-control {
        background: var(--bg-tertiary);
        border: none;
        border-radius: 6px;
        padding: 6px 10px;
        cursor: pointer;
        transition: all 0.2s ease;
    }
    
    .device-control:hover {
        background: var(--primary);
        color: white;
    }
    
    .lan-status {
        margin-top: 16px;
        padding-top: 12px;
        border-top: 1px solid var(--border-color);
        font-size: 12px;
        color: var(--text-muted);
        text-align: center;
    }
    
    .no-devices {
        text-align: center;
        color: var(--text-muted);
        padding: 40px;
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
    styleSheet.textContent = lanDiscoveryStyles;
    document.head.appendChild(styleSheet);
}

// ============================================
// CREATE SINGLETON INSTANCES
// ============================================

const lanDiscoveryManager = new LanDiscoveryManager();
const lanDiscoveryUI = new LanDiscoveryUI(lanDiscoveryManager);

// ============================================
// EXPORTS
// ============================================

// Expose to window
window.lanDiscoveryManager = lanDiscoveryManager;
window.lanDiscoveryUI = lanDiscoveryUI;
window.LanDiscoveryManager = LanDiscoveryManager;
window.LanDiscoveryConfig = LanDiscoveryConfig;

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        lanDiscoveryManager,
        lanDiscoveryUI,
        LanDiscoveryManager,
        LanDiscoveryConfig
    };
}

// ES modules export
export {
    lanDiscoveryManager,
    lanDiscoveryUI,
    LanDiscoveryManager,
    LanDiscoveryConfig
};