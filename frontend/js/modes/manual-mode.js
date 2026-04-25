/**
 * ESTIF HOME ULTIMATE - MANUAL MODE MODULE
 * Manual device control with immediate response, bypassing automation rules
 * Version: 2.0.0
 * Author: Estifanos Yohannis
 */

// ============================================
// MANUAL MODE CONFIGURATION
// ============================================

const ManualModeConfig = {
    // Security settings
    requireConfirmation: false,
    requirePinForCritical: true,
    criticalDevices: ['heater', 'oven', 'pump'],
    
    // UI settings
    showConfirmDialog: true,
    showFeedback: true,
    feedbackDuration: 3000,
    
    // Cooldown settings
    cooldownEnabled: true,
    cooldownDuration: 500, // ms between rapid toggles
    
    // History
    saveHistory: true,
    maxHistoryEntries: 100,
    
    // Storage
    storageKey: 'estif_manual_mode_history',
    
    // Debug
    debug: false
};

// ============================================
// MANUAL MODE MANAGER
// ============================================

class ManualModeManager {
    constructor(deviceController, deviceRegistry) {
        this.deviceController = deviceController;
        this.deviceRegistry = deviceRegistry;
        this.activeManualControls = new Map();
        this.lastControlTime = new Map();
        this.history = [];
        this.listeners = [];
        
        this.init();
    }

    init() {
        this.loadHistory();
        ManualModeConfig.debug && console.log('[ManualMode] Manager initialized');
    }

    loadHistory() {
        try {
            const saved = localStorage.getItem(ManualModeConfig.storageKey);
            if (saved) {
                this.history = JSON.parse(saved);
                ManualModeConfig.debug && console.log('[ManualMode] Loaded', this.history.length, 'history entries');
            }
        } catch (error) {
            console.error('[ManualMode] Failed to load history:', error);
        }
    }

    saveHistory() {
        if (!ManualModeConfig.saveHistory) return;
        
        try {
            // Limit history size
            if (this.history.length > ManualModeConfig.maxHistoryEntries) {
                this.history = this.history.slice(0, ManualModeConfig.maxHistoryEntries);
            }
            localStorage.setItem(ManualModeConfig.storageKey, JSON.stringify(this.history));
        } catch (error) {
            console.error('[ManualMode] Failed to save history:', error);
        }
    }

    // ============================================
    // MANUAL CONTROL
    // ============================================

    async controlDevice(deviceId, action, value = null, options = {}) {
        const device = this.deviceRegistry.getDevice(deviceId);
        if (!device) {
            throw new Error(`Device ${deviceId} not found`);
        }
        
        // Check cooldown
        if (ManualModeConfig.cooldownEnabled && !options.skipCooldown) {
            const lastTime = this.lastControlTime.get(deviceId) || 0;
            const timeSince = Date.now() - lastTime;
            if (timeSince < ManualModeConfig.cooldownDuration) {
                throw new Error(`Please wait ${Math.ceil((ManualModeConfig.cooldownDuration - timeSince) / 1000)} seconds before controlling again`);
            }
        }
        
        // Check for critical device confirmation
        if (ManualModeConfig.requirePinForCritical && this.isCriticalDevice(device)) {
            if (!options.pinVerified && !await this.verifyPin()) {
                throw new Error('PIN verification required for critical device');
            }
        }
        
        // Get current mode before control
        const wasAutoMode = device.autoMode;
        
        // If device is in auto mode, temporarily disable it
        if (wasAutoMode && !options.keepAutoMode) {
            await this.deviceController.setAutoMode(deviceId, false);
            this.activeManualControls.set(deviceId, {
                deviceId,
                previousAutoMode: true,
                timestamp: Date.now(),
                action
            });
        }
        
        // Execute action
        let result;
        switch (action) {
            case 'toggle':
                result = await this.deviceController.toggleDevice(deviceId);
                break;
            case 'on':
                result = await this.deviceController.setDeviceState(deviceId, true);
                break;
            case 'off':
                result = await this.deviceController.setDeviceState(deviceId, false);
                break;
            case 'set':
                result = await this.deviceController.setDeviceState(deviceId, value);
                break;
            default:
                throw new Error(`Unknown action: ${action}`);
        }
        
        // Update last control time
        this.lastControlTime.set(deviceId, Date.now());
        
        // Record history
        this.recordHistory(deviceId, action, value, wasAutoMode);
        
        // Notify listeners
        this.notifyListeners('manual_control', {
            deviceId,
            deviceName: device.name,
            action,
            value,
            wasAutoMode,
            timestamp: Date.now()
        });
        
        return result;
    }

    async toggleDevice(deviceId, options = {}) {
        return this.controlDevice(deviceId, 'toggle', null, options);
    }

    async turnOn(deviceId, options = {}) {
        return this.controlDevice(deviceId, 'on', null, options);
    }

    async turnOff(deviceId, options = {}) {
        return this.controlDevice(deviceId, 'off', null, options);
    }

    // ============================================
    // BATCH CONTROL
    // ============================================

    async controlMultiple(controls, options = {}) {
        const results = [];
        
        for (const control of controls) {
            try {
                const result = await this.controlDevice(
                    control.deviceId,
                    control.action,
                    control.value,
                    { ...options, skipCooldown: true }
                );
                results.push({ ...control, success: true, result });
            } catch (error) {
                results.push({ ...control, success: false, error: error.message });
            }
        }
        
        this.notifyListeners('batch_control_completed', { controls: results });
        return results;
    }

    async masterControl(state, options = {}) {
        const devices = this.deviceRegistry.getAllDevices();
        const controls = devices.map(device => ({
            deviceId: device.id,
            action: state ? 'on' : 'off'
        }));
        
        return this.controlMultiple(controls, options);
    }

    // ============================================
    // AUTO MODE OVERRIDE
    // ============================================

    temporarilyDisableAutoMode(deviceId, duration = 300000) { // 5 minutes default
        const device = this.deviceRegistry.getDevice(deviceId);
        if (!device) return false;
        
        if (!this.activeManualControls.has(deviceId)) {
            this.deviceController.setAutoMode(deviceId, false);
            this.activeManualControls.set(deviceId, {
                deviceId,
                previousAutoMode: true,
                timestamp: Date.now(),
                duration
            });
            
            // Auto-re-enable after duration
            setTimeout(() => {
                this.restoreAutoMode(deviceId);
            }, duration);
            
            return true;
        }
        return false;
    }

    restoreAutoMode(deviceId) {
        const control = this.activeManualControls.get(deviceId);
        if (control && control.previousAutoMode) {
            this.deviceController.setAutoMode(deviceId, true);
            this.activeManualControls.delete(deviceId);
            this.notifyListeners('auto_mode_restored', { deviceId });
        }
    }

    restoreAllAutoModes() {
        for (const [deviceId, control] of this.activeManualControls) {
            if (control.previousAutoMode) {
                this.deviceController.setAutoMode(deviceId, true);
            }
        }
        this.activeManualControls.clear();
        this.notifyListeners('all_auto_modes_restored');
    }

    // ============================================
    // HISTORY
    // ============================================

    recordHistory(deviceId, action, value, wasAutoMode) {
        const device = this.deviceRegistry.getDevice(deviceId);
        
        const entry = {
            id: Date.now(),
            deviceId,
            deviceName: device?.name || deviceId,
            action,
            value,
            wasAutoMode,
            timestamp: Date.now(),
            user: this.getCurrentUser()
        };
        
        this.history.unshift(entry);
        this.saveHistory();
        this.notifyListeners('history_added', entry);
    }

    getHistory(limit = 20) {
        return this.history.slice(0, limit);
    }

    getDeviceHistory(deviceId, limit = 20) {
        return this.history.filter(h => h.deviceId === deviceId).slice(0, limit);
    }

    clearHistory() {
        this.history = [];
        this.saveHistory();
        this.notifyListeners('history_cleared');
    }

    // ============================================
    // STATISTICS
    // ============================================

    getStatistics() {
        const totalControls = this.history.length;
        const byAction = {
            toggle: this.history.filter(h => h.action === 'toggle').length,
            on: this.history.filter(h => h.action === 'on').length,
            off: this.history.filter(h => h.action === 'off').length
        };
        
        const byDevice = new Map();
        for (const entry of this.history) {
            byDevice.set(entry.deviceId, (byDevice.get(entry.deviceId) || 0) + 1);
        }
        
        const mostControlled = Array.from(byDevice.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([deviceId, count]) => ({
                deviceId,
                deviceName: this.deviceRegistry.getDevice(deviceId)?.name || deviceId,
                count
            }));
        
        return {
            totalControls,
            byAction,
            mostControlled,
            activeOverrides: this.activeManualControls.size,
            lastControl: this.history[0] || null
        };
    }

    // ============================================
    // UTILITY
    // ============================================

    isCriticalDevice(device) {
        return ManualModeConfig.criticalDevices.some(critical => 
            device.type === critical || device.name.toLowerCase().includes(critical)
        );
    }

    async verifyPin() {
        return new Promise((resolve) => {
            const pin = prompt('Enter PIN to control this critical device:');
            // In production, verify with actual PIN validation
            resolve(pin === '1234'); // Demo only
        });
    }

    getCurrentUser() {
        const user = JSON.parse(localStorage.getItem('estif_user') || '{}');
        return user.name || 'System';
    }

    getActiveOverrides() {
        return Array.from(this.activeManualControls.values());
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
// MANUAL MODE UI COMPONENT
// ============================================

class ManualModeUI {
    constructor(manualModeManager, deviceRegistry) {
        this.manualModeManager = manualModeManager;
        this.deviceRegistry = deviceRegistry;
        this.selectedDeviceId = null;
        
        this.init();
    }

    init() {
        this.createUI();
        this.bindEvents();
        this.render();
        ManualModeConfig.debug && console.log('[ManualModeUI] Initialized');
    }

    createUI() {
        const container = document.getElementById('manual-mode-container');
        if (!container) return;

        container.innerHTML = `
            <div class="manual-mode-panel">
                <div class="manual-header">
                    <i class="fas fa-hand-paper"></i>
                    <h3>Manual Control</h3>
                    <span class="mode-badge">Manual Mode Active</span>
                </div>
                
                <div class="device-selector">
                    <select id="device-select" class="device-select">
                        <option value="">Select a device...</option>
                    </select>
                </div>
                
                <div class="control-panel" id="control-panel" style="display: none;">
                    <div class="device-info" id="device-info"></div>
                    <div class="control-buttons">
                        <button id="btn-on" class="control-btn on">
                            <i class="fas fa-power-off"></i> ON
                        </button>
                        <button id="btn-off" class="control-btn off">
                            <i class="fas fa-stop-circle"></i> OFF
                        </button>
                        <button id="btn-toggle" class="control-btn toggle">
                            <i class="fas fa-sync-alt"></i> Toggle
                        </button>
                    </div>
                    <div class="batch-controls">
                        <button id="master-on" class="batch-btn">
                            <i class="fas fa-play-circle"></i> All ON
                        </button>
                        <button id="master-off" class="batch-btn">
                            <i class="fas fa-stop-circle"></i> All OFF
                        </button>
                    </div>
                </div>
                
                <div class="manual-history" id="manual-history">
                    <h4>Recent Manual Controls</h4>
                    <div class="history-list"></div>
                </div>
                
                <div class="active-overrides" id="active-overrides" style="display: none;">
                    <h4>Active Overrides</h4>
                    <div class="overrides-list"></div>
                </div>
            </div>
        `;

        this.cacheElements();
        this.populateDeviceSelect();
    }

    cacheElements() {
        this.deviceSelect = document.getElementById('device-select');
        this.controlPanel = document.getElementById('control-panel');
        this.deviceInfo = document.getElementById('device-info');
        this.btnOn = document.getElementById('btn-on');
        this.btnOff = document.getElementById('btn-off');
        this.btnToggle = document.getElementById('btn-toggle');
        this.masterOn = document.getElementById('master-on');
        this.masterOff = document.getElementById('master-off');
        this.historyList = document.querySelector('.history-list');
        this.overridesList = document.querySelector('.overrides-list');
        this.activeOverridesDiv = document.getElementById('active-overrides');
    }

    bindEvents() {
        if (this.deviceSelect) {
            this.deviceSelect.addEventListener('change', (e) => {
                this.selectedDeviceId = e.target.value;
                this.showDeviceControls();
            });
        }
        
        if (this.btnOn) {
            this.btnOn.addEventListener('click', () => this.controlDevice('on'));
        }
        
        if (this.btnOff) {
            this.btnOff.addEventListener('click', () => this.controlDevice('off'));
        }
        
        if (this.btnToggle) {
            this.btnToggle.addEventListener('click', () => this.controlDevice('toggle'));
        }
        
        if (this.masterOn) {
            this.masterOn.addEventListener('click', () => this.masterControl(true));
        }
        
        if (this.masterOff) {
            this.masterOff.addEventListener('click', () => this.masterControl(false));
        }
        
        this.manualModeManager.addEventListener('manual_control', () => this.render());
        this.manualModeManager.addEventListener('history_added', () => this.render());
        this.manualModeManager.addEventListener('auto_mode_restored', () => this.render());
    }

    populateDeviceSelect() {
        const devices = this.deviceRegistry.getAllDevices();
        
        this.deviceSelect.innerHTML = '<option value="">Select a device...</option>' +
            devices.map(device => `
                <option value="${device.id}">
                    ${device.icon} ${device.name} (${device.room})
                </option>
            `).join('');
    }

    showDeviceControls() {
        if (!this.selectedDeviceId) {
            this.controlPanel.style.display = 'none';
            return;
        }
        
        const device = this.deviceRegistry.getDevice(this.selectedDeviceId);
        if (!device) return;
        
        this.controlPanel.style.display = 'block';
        this.deviceInfo.innerHTML = `
            <div class="device-card-mini">
                <div class="device-icon">${device.getIcon()}</div>
                <div class="device-details">
                    <div class="device-name">${device.name}</div>
                    <div class="device-room">${device.room}</div>
                    <div class="device-state ${device.state ? 'on' : 'off'}">
                        Current: ${device.state ? 'ON' : 'OFF'}
                    </div>
                    ${device.autoMode ? '<div class="auto-warning">⚠️ Auto Mode Active - Manual control will temporarily override</div>' : ''}
                </div>
            </div>
        `;
    }

    async controlDevice(action) {
        if (!this.selectedDeviceId) return;
        
        const device = this.deviceRegistry.getDevice(this.selectedDeviceId);
        const isCritical = this.manualModeManager.isCriticalDevice(device);
        
        if (isCritical && ManualModeConfig.requirePinForCritical) {
            const pin = prompt('Enter PIN to control this device:');
            if (pin !== '1234') { // Demo validation
                this.showToast('Invalid PIN', 'error');
                return;
            }
        }
        
        try {
            await this.manualModeManager.controlDevice(this.selectedDeviceId, action);
            this.showToast(`${device.name} turned ${action === 'on' ? 'ON' : action === 'off' ? 'OFF' : 'toggled'}`, 'success');
            this.showDeviceControls(); // Refresh device info
        } catch (error) {
            this.showToast(error.message, 'error');
        }
    }

    async masterControl(state) {
        const confirmed = confirm(`Are you sure you want to turn ${state ? 'ON' : 'OFF'} all devices?`);
        if (!confirmed) return;
        
        try {
            await this.manualModeManager.masterControl(state);
            this.showToast(`All devices turned ${state ? 'ON' : 'OFF'}`, 'success');
        } catch (error) {
            this.showToast(error.message, 'error');
        }
    }

    render() {
        this.renderHistory();
        this.renderActiveOverrides();
    }

    renderHistory() {
        const history = this.manualModeManager.getHistory(10);
        
        if (history.length === 0) {
            this.historyList.innerHTML = '<div class="no-history">No manual control history</div>';
            return;
        }
        
        this.historyList.innerHTML = history.map(entry => `
            <div class="history-item">
                <div class="history-time">${new Date(entry.timestamp).toLocaleTimeString()}</div>
                <div class="history-device">${this.escapeHtml(entry.deviceName)}</div>
                <div class="history-action ${entry.action}">${entry.action.toUpperCase()}</div>
                <div class="history-user">${entry.user}</div>
            </div>
        `).join('');
    }

    renderActiveOverrides() {
        const overrides = this.manualModeManager.getActiveOverrides();
        
        if (overrides.length === 0) {
            this.activeOverridesDiv.style.display = 'none';
            return;
        }
        
        this.activeOverridesDiv.style.display = 'block';
        this.overridesList.innerHTML = overrides.map(override => {
            const device = this.deviceRegistry.getDevice(override.deviceId);
            return `
                <div class="override-item">
                    <span class="override-device">${device?.name || override.deviceId}</span>
                    <span class="override-time">${new Date(override.timestamp).toLocaleTimeString()}</span>
                    <button class="restore-auto" data-device-id="${override.deviceId}">Restore Auto</button>
                </div>
            `;
        }).join('');
        
        document.querySelectorAll('.restore-auto').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const deviceId = btn.dataset.deviceId;
                this.manualModeManager.restoreAutoMode(deviceId);
                this.showToast('Auto mode restored', 'info');
                this.render();
            });
        });
    }

    showToast(message, type) {
        if (window.showToast) {
            window.showToast(message, type);
        } else {
            alert(message);
        }
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

const manualModeStyles = `
    .manual-mode-panel {
        background: var(--bg-card);
        border-radius: 12px;
        padding: 20px;
        border: 1px solid var(--border-color);
    }
    
    .manual-header {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 20px;
        padding-bottom: 12px;
        border-bottom: 1px solid var(--border-color);
    }
    
    .manual-header i {
        font-size: 20px;
        color: var(--primary);
    }
    
    .manual-header h3 {
        flex: 1;
        margin: 0;
    }
    
    .mode-badge {
        background: var(--warning);
        color: var(--text-dark);
        padding: 4px 12px;
        border-radius: 20px;
        font-size: 12px;
    }
    
    .device-selector {
        margin-bottom: 20px;
    }
    
    .device-select {
        width: 100%;
        padding: 10px 12px;
        border: 1px solid var(--border-color);
        border-radius: 8px;
        background: var(--bg-primary);
        color: var(--text-primary);
    }
    
    .control-panel {
        background: var(--bg-secondary);
        border-radius: 10px;
        padding: 16px;
        margin-bottom: 20px;
    }
    
    .device-card-mini {
        display: flex;
        align-items: center;
        gap: 16px;
        margin-bottom: 16px;
        padding-bottom: 16px;
        border-bottom: 1px solid var(--border-light);
    }
    
    .device-icon {
        font-size: 32px;
    }
    
    .device-details {
        flex: 1;
    }
    
    .device-name {
        font-weight: 500;
        margin-bottom: 4px;
    }
    
    .device-room {
        font-size: 11px;
        color: var(--text-muted);
    }
    
    .device-state {
        font-size: 12px;
        margin-top: 4px;
    }
    
    .device-state.on {
        color: var(--success);
    }
    
    .device-state.off {
        color: var(--danger);
    }
    
    .auto-warning {
        font-size: 11px;
        color: var(--warning);
        margin-top: 4px;
    }
    
    .control-buttons {
        display: flex;
        gap: 12px;
        margin-bottom: 16px;
    }
    
    .control-btn {
        flex: 1;
        padding: 10px;
        border: none;
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.2s ease;
        font-weight: 500;
    }
    
    .control-btn.on {
        background: var(--success);
        color: white;
    }
    
    .control-btn.off {
        background: var(--danger);
        color: white;
    }
    
    .control-btn.toggle {
        background: var(--info);
        color: white;
    }
    
    .control-btn:hover {
        transform: translateY(-2px);
    }
    
    .batch-controls {
        display: flex;
        gap: 12px;
    }
    
    .batch-btn {
        flex: 1;
        padding: 8px;
        background: var(--bg-tertiary);
        border: 1px solid var(--border-color);
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.2s ease;
    }
    
    .batch-btn:hover {
        background: var(--primary);
        color: white;
    }
    
    .manual-history h4, .active-overrides h4 {
        margin-bottom: 12px;
        font-size: 14px;
    }
    
    .history-list, .overrides-list {
        max-height: 200px;
        overflow-y: auto;
    }
    
    .history-item, .override-item {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 8px 12px;
        background: var(--bg-secondary);
        border-radius: 6px;
        margin-bottom: 6px;
        font-size: 12px;
    }
    
    .history-time {
        width: 70px;
        color: var(--text-muted);
    }
    
    .history-device {
        flex: 1;
    }
    
    .history-action {
        padding: 2px 8px;
        border-radius: 12px;
        font-weight: 500;
    }
    
    .history-action.on {
        background: var(--success-soft);
        color: var(--success);
    }
    
    .history-action.off {
        background: var(--danger-soft);
        color: var(--danger);
    }
    
    .history-action.toggle {
        background: var(--info-soft);
        color: var(--info);
    }
    
    .history-user {
        color: var(--text-muted);
        font-size: 10px;
    }
    
    .override-item {
        justify-content: space-between;
    }
    
    .restore-auto {
        background: var(--primary);
        border: none;
        border-radius: 4px;
        padding: 4px 8px;
        color: white;
        cursor: pointer;
        font-size: 10px;
    }
    
    .no-history {
        text-align: center;
        color: var(--text-muted);
        padding: 20px;
    }
`;

// Inject styles
if (typeof document !== 'undefined') {
    const styleSheet = document.createElement('style');
    styleSheet.textContent = manualModeStyles;
    document.head.appendChild(styleSheet);
}

// ============================================
// CREATE SINGLETON INSTANCES
// ============================================

let manualModeManager = null;
let manualModeUI = null;

const initManualMode = (deviceController, deviceRegistry) => {
    manualModeManager = new ManualModeManager(deviceController, deviceRegistry);
    manualModeUI = new ManualModeUI(manualModeManager, deviceRegistry);
    return { manualModeManager, manualModeUI };
};

// ============================================
// EXPORTS
// ============================================

// Expose to window
window.ManualModeManager = ManualModeManager;
window.ManualModeConfig = ManualModeConfig;
window.initManualMode = initManualMode;

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        manualModeManager,
        manualModeUI,
        ManualModeManager,
        ManualModeConfig,
        initManualMode
    };
}

// ES modules export
export {
    manualModeManager,
    manualModeUI,
    ManualModeManager,
    ManualModeConfig,
    initManualMode
};