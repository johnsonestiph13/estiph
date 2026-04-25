/**
 * ESTIF HOME ULTIMATE - DEVICE FIRMWARE MODULE
 * OTA firmware updates, version management, and device configuration
 * Version: 2.0.0
 * Author: Estifanos Yohannis
 */

// ============================================
// FIRMWARE CONFIGURATION
// ============================================

const FirmwareConfig = {
    // Firmware endpoints
    apiEndpoint: '/api/firmware',
    firmwareListEndpoint: '/api/firmware/list',
    checkUpdatesEndpoint: '/api/firmware/check',
    uploadEndpoint: '/api/firmware/upload',
    
    // Update settings
    updateTimeout: 120000, // 2 minutes
    maxRetries: 3,
    retryDelay: 5000,
    concurrentUpdates: 2,
    
    // Storage
    storageKey: 'estif_firmware_cache',
    maxHistorySize: 50,
    
    // Security
    verifyChecksum: true,
    requireConfirmation: true,
    
    // Debug
    debug: false
};

// ============================================
// FIRMWARE VERSION CLASS
// ============================================

class FirmwareVersion {
    constructor(version) {
        this.version = version;
        this.parts = this.parseVersion(version);
    }

    parseVersion(version) {
        const parts = version.toString().split('.');
        return {
            major: parseInt(parts[0]) || 0,
            minor: parseInt(parts[1]) || 0,
            patch: parseInt(parts[2]) || 0,
            build: parseInt(parts[3]) || 0
        };
    }

    compare(other) {
        const otherParts = other instanceof FirmwareVersion ? other.parts : other;
        
        if (this.parts.major !== otherParts.major) {
            return this.parts.major - otherParts.major;
        }
        if (this.parts.minor !== otherParts.minor) {
            return this.parts.minor - otherParts.minor;
        }
        if (this.parts.patch !== otherParts.patch) {
            return this.parts.patch - otherParts.patch;
        }
        return this.parts.build - otherParts.build;
    }

    isGreaterThan(other) {
        return this.compare(other) > 0;
    }

    isLessThan(other) {
        return this.compare(other) < 0;
    }

    isEqualTo(other) {
        return this.compare(other) === 0;
    }

    toString() {
        return `${this.parts.major}.${this.parts.minor}.${this.parts.patch}.${this.parts.build}`;
    }
}

// ============================================
// FIRMWARE MANAGER
// ============================================

class FirmwareManager {
    constructor() {
        this.firmwareList = [];
        this.updateQueue = [];
        self.activeUpdates = new Map();
        self.updateHistory = [];
        self.listeners = [];
        
        this.init();
    }

    init() {
        this.loadCache();
        this.fetchFirmwareList();
        FirmwareConfig.debug && console.log('[FirmwareManager] Initialized');
    }

    loadCache() {
        try {
            const cached = localStorage.getItem(FirmwareConfig.storageKey);
            if (cached) {
                const data = JSON.parse(cached);
                this.firmwareList = data.firmwareList || [];
                this.updateHistory = data.updateHistory || [];
                FirmwareConfig.debug && console.log('[FirmwareManager] Cache loaded');
            }
        } catch (error) {
            console.error('[FirmwareManager] Failed to load cache:', error);
        }
    }

    saveCache() {
        try {
            const data = {
                firmwareList: this.firmwareList,
                updateHistory: this.updateHistory,
                lastUpdated: Date.now()
            };
            localStorage.setItem(FirmwareConfig.storageKey, JSON.stringify(data));
        } catch (error) {
            console.error('[FirmwareManager] Failed to save cache:', error);
        }
    }

    // ============================================
    // FIRMWARE LIST MANAGEMENT
    // ============================================

    async fetchFirmwareList() {
        try {
            const response = await fetch(FirmwareConfig.firmwareListEndpoint);
            if (response.ok) {
                this.firmwareList = await response.json();
                this.saveCache();
                this.notifyListeners('firmware_list_updated', this.firmwareList);
                return this.firmwareList;
            }
        } catch (error) {
            console.error('[FirmwareManager] Failed to fetch firmware list:', error);
        }
        return this.firmwareList;
    }

    getFirmwareList(deviceType = null) {
        if (deviceType) {
            return this.firmwareList.filter(fw => fw.deviceType === deviceType);
        }
        return this.firmwareList;
    }

    getLatestFirmware(deviceType) {
        const firmwares = this.firmwareList.filter(fw => fw.deviceType === deviceType);
        if (firmwares.length === 0) return null;
        
        return firmwares.reduce((latest, current) => {
            const latestVersion = new FirmwareVersion(latest.version);
            const currentVersion = new FirmwareVersion(current.version);
            return latestVersion.isGreaterThan(currentVersion) ? latest : current;
        });
    }

    getFirmwareVersion(deviceType, version) {
        return this.firmwareList.find(fw => 
            fw.deviceType === deviceType && fw.version === version
        );
    }

    // ============================================
    // UPDATE CHECKING
    // ============================================

    async checkForUpdates(deviceId, currentVersion, deviceType) {
        try {
            const response = await fetch(FirmwareConfig.checkUpdatesEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    deviceId,
                    currentVersion,
                    deviceType
                })
            });
            
            if (response.ok) {
                const data = await response.json();
                const hasUpdate = data.hasUpdate;
                const latestVersion = data.latestVersion;
                
                this.notifyListeners('update_check_complete', {
                    deviceId,
                    hasUpdate,
                    currentVersion,
                    latestVersion
                });
                
                return { hasUpdate, latestVersion };
            }
        } catch (error) {
            console.error('[FirmwareManager] Update check failed:', error);
        }
        
        return { hasUpdate: false };
    }

    async checkAllDevices(devices) {
        const results = [];
        
        for (const device of devices) {
            const result = await this.checkForUpdates(
                device.id,
                device.firmwareVersion,
                device.type
            );
            results.push({ deviceId: device.id, ...result });
        }
        
        return results;
    }

    // ============================================
    // FIRMWARE UPLOAD (Admin)
    // ============================================

    async uploadFirmware(file, deviceType, version, releaseNotes) {
        const formData = new FormData();
        formData.append('firmware', file);
        formData.append('deviceType', deviceType);
        formData.append('version', version);
        formData.append('releaseNotes', releaseNotes);
        
        try {
            const response = await fetch(FirmwareConfig.uploadEndpoint, {
                method: 'POST',
                body: formData
            });
            
            if (response.ok) {
                const data = await response.json();
                await this.fetchFirmwareList();
                this.notifyListeners('firmware_uploaded', data);
                return { success: true, data };
            } else {
                const error = await response.text();
                return { success: false, error };
            }
        } catch (error) {
            console.error('[FirmwareManager] Upload failed:', error);
            return { success: false, error: error.message };
        }
    }

    // ============================================
    // OTA UPDATE EXECUTION
    // ============================================

    async performUpdate(deviceId, firmwareVersion, options = {}) {
        // Check if device is already updating
        if (this.activeUpdates.has(deviceId)) {
            return { success: false, error: 'Update already in progress' };
        }
        
        // Get firmware details
        const device = this.getDevice(deviceId);
        if (!device) {
            return { success: false, error: 'Device not found' };
        }
        
        const firmware = this.getFirmwareVersion(device.type, firmwareVersion);
        if (!firmware) {
            return { success: false, error: 'Firmware version not found' };
        }
        
        // Queue the update
        const updateId = this.queueUpdate({
            deviceId,
            firmware,
            options,
            timestamp: Date.now()
        });
        
        // Process queue
        this.processUpdateQueue();
        
        return { success: true, updateId };
    }

    queueUpdate(update) {
        const updateId = this.generateUpdateId();
        this.updateQueue.push({
            ...update,
            id: updateId,
            status: 'queued',
            retryCount: 0
        });
        
        this.notifyListeners('update_queued', { updateId, deviceId: update.deviceId });
        return updateId;
    }

    async processUpdateQueue() {
        while (this.updateQueue.length > 0 && this.activeUpdates.size < FirmwareConfig.concurrentUpdates) {
            const update = this.updateQueue.shift();
            this.executeUpdate(update);
        }
    }

    async executeUpdate(update) {
        const { deviceId, firmware, id, options } = update;
        
        this.activeUpdates.set(deviceId, { id, startTime: Date.now() });
        this.updateStatus(update, 'downloading');
        
        try {
            // Download firmware
            const firmwareBlob = await this.downloadFirmware(firmware.url);
            this.updateStatus(update, 'validating');
            
            // Verify checksum
            if (FirmwareConfig.verifyChecksum) {
                const isValid = await this.verifyChecksum(firmwareBlob, firmware.checksum);
                if (!isValid) {
                    throw new Error('Checksum verification failed');
                }
            }
            
            this.updateStatus(update, 'installing');
            
            // Send update to device
            const result = await this.sendUpdateToDevice(deviceId, firmwareBlob, firmware);
            
            if (result.success) {
                this.updateStatus(update, 'completed');
                this.recordUpdate(update, true);
                this.notifyListeners('update_completed', { updateId: id, deviceId, success: true });
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            console.error(`[FirmwareManager] Update failed for ${deviceId}:`, error);
            
            if (update.retryCount < FirmwareConfig.maxRetries) {
                update.retryCount++;
                update.status = 'retrying';
                this.notifyListeners('update_retrying', { updateId: id, retryCount: update.retryCount });
                
                setTimeout(() => {
                    this.updateQueue.unshift(update);
                    this.processUpdateQueue();
                }, FirmwareConfig.retryDelay);
            } else {
                this.updateStatus(update, 'failed');
                this.recordUpdate(update, false, error.message);
                this.notifyListeners('update_failed', { updateId: id, deviceId, error: error.message });
            }
        } finally {
            this.activeUpdates.delete(deviceId);
            this.processUpdateQueue();
        }
    }

    updateStatus(update, status) {
        update.status = status;
        update.lastUpdated = Date.now();
        this.notifyListeners('update_status_changed', {
            updateId: update.id,
            deviceId: update.deviceId,
            status
        });
    }

    async downloadFirmware(url) {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to download firmware: ${response.statusText}`);
        }
        return await response.blob();
    }

    async verifyChecksum(blob, expectedChecksum) {
        const buffer = await blob.arrayBuffer();
        const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const actualChecksum = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        return actualChecksum === expectedChecksum;
    }

    async sendUpdateToDevice(deviceId, firmwareBlob, firmware) {
        // In production, send to device via WebSocket or HTTP
        // This is a simulation
        await this.delay(5000);
        
        // Simulate success/failure
        const success = Math.random() > 0.1; // 90% success rate
        
        if (success) {
            // Update device firmware version
            this.updateDeviceFirmware(deviceId, firmware.version);
            return { success: true };
        } else {
            return { success: false, error: 'Device rejected update' };
        }
    }

    updateDeviceFirmware(deviceId, version) {
        // Update device firmware version in device object
        const device = this.getDevice(deviceId);
        if (device) {
            device.firmwareVersion = version;
            device.lastFirmwareUpdate = Date.now();
            this.saveDevice(device);
        }
    }

    recordUpdate(update, success, error = null) {
        const record = {
            id: update.id,
            deviceId: update.deviceId,
            fromVersion: this.getDevice(update.deviceId)?.firmwareVersion,
            toVersion: update.firmware.version,
            status: update.status,
            success,
            error,
            startedAt: update.timestamp,
            completedAt: Date.now(),
            retryCount: update.retryCount
        };
        
        this.updateHistory.unshift(record);
        
        if (this.updateHistory.length > FirmwareConfig.maxHistorySize) {
            this.updateHistory.pop();
        }
        
        this.saveCache();
    }

    // ============================================
    // UPDATE MANAGEMENT
    // ============================================

    getUpdateStatus(updateId) {
        // Check active updates
        for (const [deviceId, update] of this.activeUpdates.entries()) {
            if (update.id === updateId) {
                return { status: 'in_progress', ...update };
            }
        }
        
        // Check queue
        const queued = this.updateQueue.find(u => u.id === updateId);
        if (queued) {
            return { status: queued.status, ...queued };
        }
        
        // Check history
        const history = this.updateHistory.find(h => h.id === updateId);
        if (history) {
            return history;
        }
        
        return null;
    }

    cancelUpdate(updateId) {
        const index = this.updateQueue.findIndex(u => u.id === updateId);
        if (index !== -1) {
            this.updateQueue.splice(index, 1);
            this.notifyListeners('update_cancelled', { updateId });
            return true;
        }
        
        // Check if active
        for (const [deviceId, update] of this.activeUpdates.entries()) {
            if (update.id === updateId) {
                // Cannot cancel active update
                return false;
            }
        }
        
        return false;
    }

    getPendingUpdates() {
        return this.updateQueue.filter(u => u.status === 'queued');
    }

    getActiveUpdates() {
        return Array.from(this.activeUpdates.entries()).map(([deviceId, update]) => ({
            deviceId,
            ...update
        }));
    }

    getUpdateHistory(limit = 20) {
        return this.updateHistory.slice(0, limit);
    }

    // ============================================
    // DEVICE HELPERS (Replace with actual device access)
    // ============================================

    getDevice(deviceId) {
        // This should be replaced with actual device lookup
        return null;
    }

    saveDevice(device) {
        // This should be replaced with actual device save
    }

    // ============================================
    // UTILITY METHODS
    // ============================================

    generateUpdateId() {
        return `update_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
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
// FIRMWARE UPDATE UI COMPONENT
// ============================================

class FirmwareUpdateUI {
    constructor(manager) {
        this.manager = manager;
        this.init();
    }

    init() {
        this.createUI();
        this.bindEvents();
        FirmwareConfig.debug && console.log('[FirmwareUpdateUI] Initialized');
    }

    createUI() {
        const container = document.getElementById('firmware-container');
        if (!container) return;

        container.innerHTML = `
            <div class="firmware-panel">
                <div class="firmware-header">
                    <i class="fas fa-microchip"></i>
                    <h3>Firmware Updates</h3>
                </div>
                
                <div class="firmware-devices" id="firmware-devices">
                    <p class="loading">Loading devices...</p>
                </div>
                
                <div class="firmware-history">
                    <h4>Update History</h4>
                    <div class="history-list" id="update-history"></div>
                </div>
            </div>
        `;

        this.cacheElements();
        this.loadDevices();
    }

    cacheElements() {
        this.devicesContainer = document.getElementById('firmware-devices');
        this.historyContainer = document.getElementById('update-history');
    }

    bindEvents() {
        this.manager.addEventListener('firmware_list_updated', () => this.loadDevices());
        this.manager.addEventListener('update_status_changed', (data) => this.updateDeviceStatus(data));
        this.manager.addEventListener('update_completed', (data) => this.onUpdateComplete(data));
        this.manager.addEventListener('update_failed', (data) => this.onUpdateFailed(data));
    }

    async loadDevices() {
        // In production, get actual devices
        const devices = [
            { id: 'esp32-001', name: 'ESP32 Living Room', firmwareVersion: '1.0.0', type: 'esp32' },
            { id: 'esp32-002', name: 'ESP32 Bedroom', firmwareVersion: '1.0.0', type: 'esp32' },
            { id: 'esp32-003', name: 'ESP32 Kitchen', firmwareVersion: '1.0.0', type: 'esp32' }
        ];
        
        this.renderDevices(devices);
        this.renderHistory();
    }

    async renderDevices(devices) {
        if (!this.devicesContainer) return;
        
        const devicesHtml = [];
        
        for (const device of devices) {
            const updateCheck = await this.manager.checkForUpdates(
                device.id,
                device.firmwareVersion,
                device.type
            );
            
            devicesHtml.push(`
                <div class="firmware-device" data-device-id="${device.id}">
                    <div class="device-info">
                        <div class="device-name">${device.name}</div>
                        <div class="device-version">
                            Current: v${device.firmwareVersion}
                            ${updateCheck.hasUpdate ? `<span class="update-badge">Update Available: v${updateCheck.latestVersion}</span>` : ''}
                        </div>
                    </div>
                    <div class="device-actions">
                        ${updateCheck.hasUpdate ? `
                            <button class="update-btn" data-device-id="${device.id}" data-version="${updateCheck.latestVersion}">
                                <i class="fas fa-download"></i> Update
                            </button>
                        ` : '<span class="uptodate">Up to date</span>'}
                    </div>
                    <div class="update-progress" id="progress-${device.id}" style="display: none;">
                        <div class="progress-bar"></div>
                        <span class="progress-status"></span>
                    </div>
                </div>
            `);
        }
        
        this.devicesContainer.innerHTML = devicesHtml.join('');
        
        // Bind update buttons
        document.querySelectorAll('.update-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const deviceId = btn.dataset.deviceId;
                const version = btn.dataset.version;
                this.startUpdate(deviceId, version);
            });
        });
    }

    renderHistory() {
        if (!this.historyContainer) return;
        
        const history = this.manager.getUpdateHistory();
        
        if (history.length === 0) {
            this.historyContainer.innerHTML = '<p class="no-history">No update history</p>';
            return;
        }
        
        this.historyContainer.innerHTML = history.map(record => `
            <div class="history-item ${record.success ? 'success' : 'failed'}">
                <div class="history-device">Device: ${record.deviceId}</div>
                <div class="history-version">
                    ${record.fromVersion} → ${record.toVersion}
                </div>
                <div class="history-date">
                    ${new Date(record.completedAt).toLocaleString()}
                </div>
                <div class="history-status">
                    ${record.success ? '✓ Success' : '✗ Failed'}
                </div>
            </div>
        `).join('');
    }

    async startUpdate(deviceId, version) {
        if (!confirm(`Update device to version ${version}? The device will restart during the update.`)) {
            return;
        }
        
        const updateBtn = document.querySelector(`.update-btn[data-device-id="${deviceId}"]`);
        const progressDiv = document.getElementById(`progress-${deviceId}`);
        
        if (updateBtn) {
            updateBtn.disabled = true;
            updateBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Starting...';
        }
        
        if (progressDiv) {
            progressDiv.style.display = 'block';
        }
        
        const result = await this.manager.performUpdate(deviceId, version);
        
        if (result.success) {
            this.monitorUpdate(result.updateId, deviceId);
        } else {
            this.showError(`Failed to start update: ${result.error}`);
            if (updateBtn) {
                updateBtn.disabled = false;
                updateBtn.innerHTML = '<i class="fas fa-download"></i> Retry';
            }
        }
    }

    monitorUpdate(updateId, deviceId) {
        const interval = setInterval(() => {
            const status = this.manager.getUpdateStatus(updateId);
            const progressDiv = document.getElementById(`progress-${deviceId}`);
            
            if (progressDiv) {
                const statusSpan = progressDiv.querySelector('.progress-status');
                const progressBar = progressDiv.querySelector('.progress-bar');
                
                if (statusSpan) {
                    statusSpan.textContent = this.getStatusText(status.status);
                }
                
                if (progressBar) {
                    const progress = this.getStatusProgress(status.status);
                    progressBar.style.width = `${progress}%`;
                }
            }
            
            if (status.status === 'completed' || status.status === 'failed') {
                clearInterval(interval);
                this.loadDevices();
                this.renderHistory();
            }
        }, 1000);
    }

    updateDeviceStatus(data) {
        const progressDiv = document.getElementById(`progress-${data.deviceId}`);
        if (progressDiv) {
            const statusSpan = progressDiv.querySelector('.progress-status');
            if (statusSpan) {
                statusSpan.textContent = this.getStatusText(data.status);
            }
        }
    }

    onUpdateComplete(data) {
        this.showSuccess(`Device ${data.deviceId} updated successfully!`);
    }

    onUpdateFailed(data) {
        this.showError(`Update failed for device ${data.deviceId}: ${data.error}`);
    }

    getStatusText(status) {
        const statusMap = {
            'queued': 'Queued...',
            'downloading': 'Downloading firmware...',
            'validating': 'Validating...',
            'installing': 'Installing update...',
            'completed': 'Update complete!',
            'failed': 'Update failed',
            'retrying': 'Retrying...'
        };
        return statusMap[status] || status;
    }

    getStatusProgress(status) {
        const progressMap = {
            'queued': 0,
            'downloading': 25,
            'validating': 50,
            'installing': 75,
            'completed': 100,
            'failed': 0
        };
        return progressMap[status] || 0;
    }

    showSuccess(message) {
        if (window.showToast) {
            window.showToast(message, 'success');
        } else {
            alert(message);
        }
    }

    showError(message) {
        if (window.showToast) {
            window.showToast(message, 'error');
        } else {
            alert(message);
        }
    }
}

// ============================================
// CSS STYLES (Auto-injected)
// ============================================

const firmwareStyles = `
    .firmware-panel {
        background: var(--bg-card);
        border-radius: 12px;
        padding: 20px;
        border: 1px solid var(--border-color);
    }
    
    .firmware-header {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 20px;
        padding-bottom: 12px;
        border-bottom: 1px solid var(--border-color);
    }
    
    .firmware-header i {
        font-size: 20px;
        color: var(--primary);
    }
    
    .firmware-header h3 {
        flex: 1;
        margin: 0;
    }
    
    .firmware-devices {
        margin-bottom: 20px;
    }
    
    .firmware-device {
        background: var(--bg-secondary);
        border-radius: 10px;
        padding: 16px;
        margin-bottom: 12px;
        transition: all 0.2s ease;
    }
    
    .firmware-device:hover {
        transform: translateX(4px);
    }
    
    .device-info {
        margin-bottom: 12px;
    }
    
    .device-name {
        font-weight: 500;
        margin-bottom: 4px;
    }
    
    .device-version {
        font-size: 12px;
        color: var(--text-secondary);
    }
    
    .update-badge {
        background: var(--warning-soft);
        color: var(--warning);
        padding: 2px 8px;
        border-radius: 12px;
        margin-left: 8px;
        font-size: 11px;
    }
    
    .uptodate {
        color: var(--success);
        font-size: 12px;
    }
    
    .update-btn {
        background: var(--primary);
        border: none;
        border-radius: 6px;
        padding: 8px 16px;
        color: white;
        cursor: pointer;
        transition: all 0.2s ease;
    }
    
    .update-btn:hover {
        background: var(--primary-dark);
        transform: translateY(-1px);
    }
    
    .update-btn:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }
    
    .update-progress {
        margin-top: 12px;
    }
    
    .progress-bar {
        height: 4px;
        background: var(--primary);
        border-radius: 2px;
        width: 0%;
        transition: width 0.3s ease;
    }
    
    .progress-status {
        font-size: 11px;
        color: var(--text-muted);
        margin-top: 4px;
        display: block;
    }
    
    .firmware-history {
        margin-top: 20px;
        padding-top: 20px;
        border-top: 1px solid var(--border-color);
    }
    
    .firmware-history h4 {
        margin-bottom: 12px;
    }
    
    .history-list {
        max-height: 200px;
        overflow-y: auto;
    }
    
    .history-item {
        padding: 8px 12px;
        background: var(--bg-secondary);
        border-radius: 6px;
        margin-bottom: 8px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 12px;
    }
    
    .history-item.success {
        border-left: 3px solid var(--success);
    }
    
    .history-item.failed {
        border-left: 3px solid var(--danger);
    }
    
    .no-history {
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
    styleSheet.textContent = firmwareStyles;
    document.head.appendChild(styleSheet);
}

// ============================================
// CREATE SINGLETON INSTANCES
// ============================================

const firmwareManager = new FirmwareManager();
const firmwareUpdateUI = new FirmwareUpdateUI(firmwareManager);

// ============================================
// EXPORTS
// ============================================

// Expose to window
window.firmwareManager = firmwareManager;
window.firmwareUpdateUI = firmwareUpdateUI;
window.FirmwareManager = FirmwareManager;
window.FirmwareConfig = FirmwareConfig;

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        firmwareManager,
        firmwareUpdateUI,
        FirmwareManager,
        FirmwareConfig
    };
}

// ES modules export
export {
    firmwareManager,
    firmwareUpdateUI,
    FirmwareManager,
    FirmwareConfig
};