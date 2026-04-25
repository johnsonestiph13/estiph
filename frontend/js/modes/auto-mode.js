/**
 * ESTIF HOME ULTIMATE - AUTO MODE MODULE
 * Intelligent automatic device control based on sensors, schedules, and conditions
 * Version: 2.0.0
 * Author: Estifanos Yohannis
 */

// ============================================
// AUTO MODE CONFIGURATION
// ============================================

const AutoModeConfig = {
    // Sensor thresholds
    thresholds: {
        temperature: {
            ac_on: 26,
            ac_off: 24,
            heater_on: 18,
            heater_off: 20,
            fan_on: 26,
            fan_off: 24
        },
        humidity: {
            dehumidifier_on: 70,
            dehumidifier_off: 60,
            humidifier_on: 30,
            humidifier_off: 40
        },
        light: {
            morning_on: "06:30",
            morning_off: "08:00",
            evening_on: "18:00",
            evening_off: "22:00",
            night_on: "19:00",
            night_off: "06:00"
        }
    },
    
    // Schedule settings
    schedule: {
        checkInterval: 60000, // 1 minute
        sunriseOffset: -30, // minutes
        sunsetOffset: 30 // minutes
    },
    
    // Automation rules
    defaultRules: [
        {
            id: "temp_ac",
            name: "Temperature Control (AC)",
            nameAm: "የሙቀት መቆጣጠሪያ (ኤሲ)",
            enabled: true,
            condition: { type: "temperature", operator: ">", value: 26 },
            action: { deviceId: 2, command: "on" }
        },
        {
            id: "temp_heater",
            name: "Temperature Control (Heater)",
            nameAm: "የሙቀት መቆጣጠሪያ (ማሞቂያ)",
            enabled: true,
            condition: { type: "temperature", operator: "<", value: 18 },
            action: { deviceId: 4, command: "on" }
        },
        {
            id: "morning_light",
            name: "Morning Light",
            nameAm: "የጠዋት መብራት",
            enabled: true,
            condition: { type: "time", operator: "between", value: { start: "06:30", end: "08:00" } },
            action: { deviceId: 0, command: "on" }
        },
        {
            id: "night_light",
            name: "Night Light",
            nameAm: "የምሽት መብራት",
            enabled: true,
            condition: { type: "time", operator: "between", value: { start: "19:00", end: "22:00" } },
            action: { deviceId: 0, command: "off" }
        }
    ],
    
    // Storage
    storageKey: 'estif_auto_mode_rules',
    historyKey: 'estif_auto_mode_history',
    maxHistoryEntries: 500,
    
    // Debug
    debug: false
};

// ============================================
// AUTO MODE RULE CLASS
// ============================================

class AutoRule {
    constructor(data) {
        this.id = data.id || this.generateId();
        this.name = data.name;
        this.nameAm = data.nameAm || data.name;
        this.enabled = data.enabled !== undefined ? data.enabled : true;
        this.condition = data.condition;
        this.action = data.action;
        this.createdAt = data.createdAt || Date.now();
        this.updatedAt = Date.now();
        this.lastTriggered = data.lastTriggered || null;
        this.triggerCount = data.triggerCount || 0;
        this.metadata = data.metadata || {};
    }

    generateId() {
        return `auto_rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    evaluate(condition, context) {
        const { type, operator, value } = condition;
        let actualValue;

        switch (type) {
            case 'temperature':
                actualValue = context.temperature;
                break;
            case 'humidity':
                actualValue = context.humidity;
                break;
            case 'time':
                actualValue = context.currentTime;
                break;
            case 'device_state':
                const device = context.devices?.find(d => d.id === value.deviceId);
                actualValue = device?.state;
                break;
            case 'schedule':
                actualValue = context.schedule;
                break;
            default:
                return false;
        }

        return this.compare(actualValue, operator, value);
    }

    compare(actual, operator, expected) {
        switch (operator) {
            case '>': return actual > expected;
            case '<': return actual < expected;
            case '>=': return actual >= expected;
            case '<=': return actual <= expected;
            case '==': return actual == expected;
            case '!=': return actual != expected;
            case 'between':
                return actual >= expected.start && actual <= expected.end;
            case 'in':
                return expected.values.includes(actual);
            default:
                return false;
        }
    }

    execute(action, context) {
        const { deviceId, command, value } = action;
        const device = context.devices?.find(d => d.id === deviceId);
        
        if (!device) return false;
        
        // Don't execute if device is in manual mode
        if (!device.autoMode) return false;
        
        switch (command) {
            case 'on':
                if (!device.state) {
                    context.deviceController?.setDeviceState(deviceId, true);
                    this.recordTrigger();
                    return true;
                }
                break;
            case 'off':
                if (device.state) {
                    context.deviceController?.setDeviceState(deviceId, false);
                    this.recordTrigger();
                    return true;
                }
                break;
            case 'toggle':
                context.deviceController?.toggleDevice(deviceId);
                this.recordTrigger();
                return true;
            case 'set':
                context.deviceController?.setDeviceValue(deviceId, value);
                this.recordTrigger();
                return true;
        }
        
        return false;
    }

    recordTrigger() {
        this.lastTriggered = Date.now();
        this.triggerCount++;
        this.updatedAt = Date.now();
    }

    update(data) {
        if (data.name !== undefined) this.name = data.name;
        if (data.nameAm !== undefined) this.nameAm = data.nameAm;
        if (data.enabled !== undefined) this.enabled = data.enabled;
        if (data.condition !== undefined) this.condition = data.condition;
        if (data.action !== undefined) this.action = data.action;
        this.updatedAt = Date.now();
    }

    toJSON() {
        return {
            id: this.id,
            name: this.name,
            nameAm: this.nameAm,
            enabled: this.enabled,
            condition: this.condition,
            action: this.action,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
            lastTriggered: this.lastTriggered,
            triggerCount: this.triggerCount,
            metadata: this.metadata
        };
    }
}

// ============================================
// AUTO MODE MANAGER
// ============================================

class AutoModeManager {
    constructor(deviceController, deviceRegistry) {
        this.deviceController = deviceController;
        this.deviceRegistry = deviceRegistry;
        this.rules = new Map();
        this.history = [];
        this.checkInterval = null;
        this.listeners = [];
        
        this.init();
    }

    init() {
        this.loadRules();
        this.loadHistory();
        this.startMonitoring();
        AutoModeConfig.debug && console.log('[AutoMode] Manager initialized with', this.rules.size, 'rules');
    }

    loadRules() {
        try {
            const saved = localStorage.getItem(AutoModeConfig.storageKey);
            if (saved) {
                const rules = JSON.parse(saved);
                for (const ruleData of rules) {
                    const rule = new AutoRule(ruleData);
                    this.rules.set(rule.id, rule);
                }
                AutoModeConfig.debug && console.log('[AutoMode] Loaded', this.rules.size, 'rules');
            }
        } catch (error) {
            console.error('[AutoMode] Failed to load rules:', error);
        }
        
        // Create default rules if none exist
        if (this.rules.size === 0) {
            this.createDefaultRules();
        }
    }

    saveRules() {
        try {
            const rules = Array.from(this.rules.values()).map(r => r.toJSON());
            localStorage.setItem(AutoModeConfig.storageKey, JSON.stringify(rules));
            AutoModeConfig.debug && console.log('[AutoMode] Saved', rules.length, 'rules');
        } catch (error) {
            console.error('[AutoMode] Failed to save rules:', error);
        }
    }

    loadHistory() {
        try {
            const saved = localStorage.getItem(AutoModeConfig.historyKey);
            if (saved) {
                this.history = JSON.parse(saved);
                AutoModeConfig.debug && console.log('[AutoMode] Loaded', this.history.length, 'history entries');
            }
        } catch (error) {
            console.error('[AutoMode] Failed to load history:', error);
        }
    }

    saveHistory() {
        try {
            if (this.history.length > AutoModeConfig.maxHistoryEntries) {
                this.history = this.history.slice(0, AutoModeConfig.maxHistoryEntries);
            }
            localStorage.setItem(AutoModeConfig.historyKey, JSON.stringify(this.history));
        } catch (error) {
            console.error('[AutoMode] Failed to save history:', error);
        }
    }

    createDefaultRules() {
        for (const ruleData of AutoModeConfig.defaultRules) {
            const rule = new AutoRule(ruleData);
            this.rules.set(rule.id, rule);
        }
        this.saveRules();
        this.notifyListeners('default_rules_created');
    }

    // ============================================
    // RULE MANAGEMENT
    // ============================================

    addRule(ruleData) {
        const rule = new AutoRule(ruleData);
        this.rules.set(rule.id, rule);
        this.saveRules();
        this.notifyListeners('rule_added', rule);
        return rule;
    }

    updateRule(ruleId, updates) {
        const rule = this.rules.get(ruleId);
        if (!rule) return null;
        
        rule.update(updates);
        this.saveRules();
        this.notifyListeners('rule_updated', rule);
        return rule;
    }

    deleteRule(ruleId) {
        const rule = this.rules.get(ruleId);
        if (!rule) return false;
        
        this.rules.delete(ruleId);
        this.saveRules();
        this.notifyListeners('rule_deleted', rule);
        return true;
    }

    toggleRule(ruleId, enabled) {
        const rule = this.rules.get(ruleId);
        if (!rule) return null;
        
        rule.enabled = enabled;
        this.saveRules();
        this.notifyListeners('rule_toggled', { ruleId, enabled });
        return rule;
    }

    getRule(ruleId) {
        return this.rules.get(ruleId);
    }

    getAllRules() {
        return Array.from(this.rules.values());
    }

    getEnabledRules() {
        return this.getAllRules().filter(r => r.enabled);
    }

    // ============================================
    // MONITORING & EVALUATION
    // ============================================

    startMonitoring() {
        this.checkInterval = setInterval(() => {
            this.evaluateRules();
        }, AutoModeConfig.schedule.checkInterval);
        
        AutoModeConfig.debug && console.log('[AutoMode] Monitoring started');
    }

    stopMonitoring() {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
            AutoModeConfig.debug && console.log('[AutoMode] Monitoring stopped');
        }
    }

    async evaluateRules() {
        const context = await this.buildContext();
        const triggeredRules = [];
        
        for (const rule of this.getEnabledRules()) {
            try {
                const conditionMet = rule.evaluate(rule.condition, context);
                
                if (conditionMet) {
                    const executed = rule.execute(rule.action, context);
                    if (executed) {
                        triggeredRules.push(rule);
                        this.recordHistory(rule, context);
                        this.notifyListeners('rule_triggered', rule);
                    }
                }
            } catch (error) {
                console.error(`[AutoMode] Error evaluating rule ${rule.id}:`, error);
            }
        }
        
        if (triggeredRules.length > 0) {
            this.saveHistory();
            this.notifyListeners('rules_evaluated', { triggered: triggeredRules.length });
        }
    }

    async buildContext() {
        const devices = this.deviceRegistry.getAllDevices();
        const sensors = await this.getSensorData();
        
        return {
            temperature: sensors.temperature,
            humidity: sensors.humidity,
            currentTime: this.getCurrentTime(),
            devices,
            deviceController: this.deviceController,
            schedule: this.getScheduleContext()
        };
    }

    async getSensorData() {
        // In production, fetch from actual sensors
        // For demo, return simulated data
        return {
            temperature: Math.floor(Math.random() * 15) + 18, // 18-33°C
            humidity: Math.floor(Math.random() * 40) + 40 // 40-80%
        };
    }

    getCurrentTime() {
        const now = new Date();
        return {
            hour: now.getHours(),
            minute: now.getMinutes(),
            second: now.getSeconds(),
            day: now.getDay(),
            date: now.getDate(),
            month: now.getMonth(),
            year: now.getFullYear(),
            timestamp: now.getTime(),
            timeString: `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`,
            isWeekend: now.getDay() === 0 || now.getDay() === 6,
            isWeekday: now.getDay() >= 1 && now.getDay() <= 5
        };
    }

    getScheduleContext() {
        const now = new Date();
        const timeString = this.getCurrentTime().timeString;
        
        return {
            isMorning: timeString >= "06:00" && timeString <= "12:00",
            isAfternoon: timeString > "12:00" && timeString <= "18:00",
            isEvening: timeString > "18:00" && timeString <= "22:00",
            isNight: timeString > "22:00" || timeString <= "06:00",
            isSunrise: this.isSunrise(),
            isSunset: this.isSunset()
        };
    }

    isSunrise() {
        // Simplified sunrise detection
        const now = new Date();
        const sunriseHour = 6;
        const sunriseMinute = 30;
        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();
        
        return currentHour === sunriseHour && 
               Math.abs(currentMinute - sunriseMinute) <= 15;
    }

    isSunset() {
        // Simplified sunset detection
        const now = new Date();
        const sunsetHour = 18;
        const sunsetMinute = 30;
        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();
        
        return currentHour === sunsetHour && 
               Math.abs(currentMinute - sunsetMinute) <= 15;
    }

    // ============================================
    // HISTORY
    // ============================================

    recordHistory(rule, context) {
        const entry = {
            id: Date.now(),
            ruleId: rule.id,
            ruleName: rule.name,
            condition: rule.condition,
            action: rule.action,
            context: {
                temperature: context.temperature,
                humidity: context.humidity,
                time: context.currentTime.timeString
            },
            timestamp: Date.now()
        };
        
        this.history.unshift(entry);
        this.saveHistory();
        this.notifyListeners('history_added', entry);
    }

    getHistory(limit = 20) {
        return this.history.slice(0, limit);
    }

    getRuleHistory(ruleId, limit = 20) {
        return this.history.filter(h => h.ruleId === ruleId).slice(0, limit);
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
        const rules = this.getAllRules();
        const totalTriggers = rules.reduce((sum, r) => sum + r.triggerCount, 0);
        
        return {
            totalRules: rules.length,
            enabledRules: rules.filter(r => r.enabled).length,
            totalTriggers,
            lastTrigger: this.history[0]?.timestamp || null,
            mostActiveRule: rules.sort((a, b) => b.triggerCount - a.triggerCount)[0] || null,
            byCondition: {
                temperature: rules.filter(r => r.condition.type === 'temperature').length,
                time: rules.filter(r => r.condition.type === 'time').length,
                device_state: rules.filter(r => r.condition.type === 'device_state').length
            }
        };
    }

    // ============================================
    // UTILITY
    // ============================================

    getDeviceAutoStatus(deviceId) {
        const device = this.deviceRegistry.getDevice(deviceId);
        if (!device) return null;
        
        const affectingRules = this.getAllRules().filter(rule => 
            rule.action.deviceId === deviceId && rule.enabled
        );
        
        return {
            deviceId,
            deviceName: device.name,
            autoMode: device.autoMode,
            affectingRules: affectingRules.map(r => ({
                id: r.id,
                name: r.name,
                condition: r.condition,
                lastTriggered: r.lastTriggered
            })),
            lastManualOverride: null // In production, track manual overrides
        };
    }

    setDeviceAutoMode(deviceId, enabled) {
        const device = this.deviceRegistry.getDevice(deviceId);
        if (!device) return false;
        
        device.autoMode = enabled;
        this.deviceRegistry.saveDevices();
        this.notifyListeners('device_auto_mode_changed', { deviceId, enabled });
        return true;
    }

    // ============================================
    // IMPORT/EXPORT
    // ============================================

    exportRules() {
        return {
            version: '1.0',
            exportedAt: Date.now(),
            rules: this.getAllRules().map(r => r.toJSON())
        };
    }

    importRules(data) {
        try {
            for (const ruleData of data.rules) {
                if (!this.rules.has(ruleData.id)) {
                    const rule = new AutoRule(ruleData);
                    this.rules.set(rule.id, rule);
                }
            }
            this.saveRules();
            this.notifyListeners('rules_imported');
            return true;
        } catch (error) {
            console.error('[AutoMode] Import failed:', error);
            return false;
        }
    }

    reset() {
        this.rules.clear();
        this.createDefaultRules();
        this.history = [];
        this.saveHistory();
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
// AUTO MODE UI COMPONENT
// ============================================

class AutoModeUI {
    constructor(autoModeManager) {
        this.autoModeManager = autoModeManager;
        this.currentRuleId = null;
        
        this.init();
    }

    init() {
        this.createUI();
        this.bindEvents();
        this.render();
        AutoModeConfig.debug && console.log('[AutoModeUI] Initialized');
    }

    createUI() {
        const container = document.getElementById('auto-mode-container');
        if (!container) return;

        container.innerHTML = `
            <div class="auto-mode-panel">
                <div class="auto-header">
                    <i class="fas fa-robot"></i>
                    <h3>Auto Mode Rules</h3>
                    <button id="add-rule-btn" class="btn btn-sm btn-primary">
                        <i class="fas fa-plus"></i> Add Rule
                    </button>
                </div>
                
                <div class="auto-stats" id="auto-stats"></div>
                
                <div class="rules-list" id="rules-list"></div>
                
                <!-- Add/Edit Rule Modal -->
                <div id="rule-modal" class="modal-overlay" style="display: none;">
                    <div class="modal">
                        <div class="modal-header">
                            <h3 id="rule-modal-title">Add Auto Rule</h3>
                            <button class="modal-close">&times;</button>
                        </div>
                        <div class="modal-body">
                            <form id="rule-form">
                                <div class="form-group">
                                    <label>Rule Name</label>
                                    <input type="text" id="rule-name" class="form-input" required>
                                </div>
                                <div class="form-group">
                                    <label>Condition Type</label>
                                    <select id="condition-type" class="form-select">
                                        <option value="temperature">Temperature</option>
                                        <option value="time">Time</option>
                                        <option value="device_state">Device State</option>
                                    </select>
                                </div>
                                <div id="condition-config"></div>
                                <div class="form-group">
                                    <label>Action</label>
                                    <select id="action-device" class="form-select">
                                        <option value="">Select Device</option>
                                    </select>
                                    <select id="action-command" class="form-select" style="margin-top: 8px;">
                                        <option value="on">Turn ON</option>
                                        <option value="off">Turn OFF</option>
                                        <option value="toggle">Toggle</option>
                                    </select>
                                </div>
                            </form>
                        </div>
                        <div class="modal-footer">
                            <button id="cancel-rule" class="btn btn-secondary">Cancel</button>
                            <button id="save-rule" class="btn btn-primary">Save Rule</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        this.cacheElements();
        this.bindUIEvents();
    }

    cacheElements() {
        this.statsContainer = document.getElementById('auto-stats');
        this.rulesList = document.getElementById('rules-list');
        this.addBtn = document.getElementById('add-rule-btn');
        this.ruleModal = document.getElementById('rule-modal');
        this.ruleModalTitle = document.getElementById('rule-modal-title');
        this.ruleForm = document.getElementById('rule-form');
        this.conditionType = document.getElementById('condition-type');
        this.conditionConfig = document.getElementById('condition-config');
        this.actionDevice = document.getElementById('action-device');
        this.populateDeviceSelect();
    }

    bindUIEvents() {
        if (this.addBtn) {
            this.addBtn.addEventListener('click', () => this.showAddRuleModal());
        }
        
        if (this.conditionType) {
            this.conditionType.addEventListener('change', () => this.renderConditionConfig());
        }
        
        document.getElementById('cancel-rule')?.addEventListener('click', () => this.closeRuleModal());
        document.getElementById('save-rule')?.addEventListener('click', () => this.saveRule());
        document.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', () => this.closeRuleModal());
        });
    }

    bindEvents() {
        this.autoModeManager.addEventListener('rule_added', () => this.render());
        this.autoModeManager.addEventListener('rule_updated', () => this.render());
        this.autoModeManager.addEventListener('rule_deleted', () => this.render());
        this.autoModeManager.addEventListener('rule_toggled', () => this.render());
        this.autoModeManager.addEventListener('rule_triggered', () => this.render());
    }

    populateDeviceSelect() {
        const devices = this.autoModeManager.deviceRegistry?.getAllDevices() || [];
        this.actionDevice.innerHTML = '<option value="">Select Device</option>' +
            devices.map(device => `
                <option value="${device.id}">${device.icon} ${device.name}</option>
            `).join('');
    }

    renderConditionConfig() {
        const type = this.conditionType.value;
        
        switch (type) {
            case 'temperature':
                this.conditionConfig.innerHTML = `
                    <div class="form-group">
                        <label>Operator</label>
                        <select id="cond-operator" class="form-select">
                            <option value=">">Greater than</option>
                            <option value="<">Less than</option>
                            <option value=">=">Greater or equal</option>
                            <option value="<=">Less or equal</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Value (°C)</label>
                        <input type="number" id="cond-value" class="form-input" step="0.5" placeholder="e.g., 26">
                    </div>
                `;
                break;
            case 'time':
                this.conditionConfig.innerHTML = `
                    <div class="form-group">
                        <label>Time Range</label>
                        <div style="display: flex; gap: 8px;">
                            <input type="time" id="cond-start" class="form-input" placeholder="Start">
                            <span>to</span>
                            <input type="time" id="cond-end" class="form-input" placeholder="End">
                        </div>
                    </div>
                `;
                break;
            case 'device_state':
                this.conditionConfig.innerHTML = `
                    <div class="form-group">
                        <label>Device</label>
                        <select id="cond-device" class="form-select">
                            ${this.populateDeviceSelectOptions()}
                        </select>
                    </div>
                    <div class="form-group">
                        <label>State</label>
                        <select id="cond-state" class="form-select">
                            <option value="true">ON</option>
                            <option value="false">OFF</option>
                        </select>
                    </div>
                `;
                break;
        }
    }

    populateDeviceSelectOptions() {
        const devices = this.autoModeManager.deviceRegistry?.getAllDevices() || [];
        return devices.map(device => `<option value="${device.id}">${device.name}</option>`).join('');
    }

    render() {
        this.renderStats();
        this.renderRules();
    }

    renderStats() {
        const stats = this.autoModeManager.getStatistics();
        
        this.statsContainer.innerHTML = `
            <div class="stat-card">
                <div class="stat-value">${stats.totalRules}</div>
                <div class="stat-label">Total Rules</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${stats.enabledRules}</div>
                <div class="stat-label">Active Rules</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${stats.totalTriggers}</div>
                <div class="stat-label">Total Triggers</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${stats.mostActiveRule?.name || 'N/A'}</div>
                <div class="stat-label">Most Active</div>
            </div>
        `;
    }

    renderRules() {
        const rules = this.autoModeManager.getAllRules();
        
        if (rules.length === 0) {
            this.rulesList.innerHTML = '<div class="no-rules">No auto rules configured</div>';
            return;
        }
        
        this.rulesList.innerHTML = rules.map(rule => `
            <div class="rule-card ${rule.enabled ? 'enabled' : 'disabled'}" data-rule-id="${rule.id}">
                <div class="rule-header">
                    <div class="rule-info">
                        <div class="rule-name">${this.escapeHtml(rule.name)}</div>
                        <div class="rule-condition">${this.formatCondition(rule.condition)}</div>
                    </div>
                    <div class="rule-stats">
                        <span class="rule-triggers">${rule.triggerCount} triggers</span>
                        <label class="switch">
                            <input type="checkbox" class="rule-toggle" ${rule.enabled ? 'checked' : ''} data-rule-id="${rule.id}">
                            <span class="slider"></span>
                        </label>
                    </div>
                </div>
                <div class="rule-body">
                    <div class="rule-action">→ ${this.formatAction(rule.action)}</div>
                    ${rule.lastTriggered ? `<div class="rule-last">Last triggered: ${new Date(rule.lastTriggered).toLocaleString()}</div>` : ''}
                </div>
                <div class="rule-footer">
                    <button class="edit-rule" data-rule-id="${rule.id}">Edit</button>
                    <button class="delete-rule" data-rule-id="${rule.id}">Delete</button>
                </div>
            </div>
        `).join('');
        
        // Bind toggle events
        document.querySelectorAll('.rule-toggle').forEach(toggle => {
            toggle.addEventListener('change', (e) => {
                const ruleId = toggle.dataset.ruleId;
                this.autoModeManager.toggleRule(ruleId, toggle.checked);
            });
        });
        
        // Bind edit buttons
        document.querySelectorAll('.edit-rule').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const ruleId = btn.dataset.ruleId;
                this.editRule(ruleId);
            });
        });
        
        // Bind delete buttons
        document.querySelectorAll('.delete-rule').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const ruleId = btn.dataset.ruleId;
                this.deleteRule(ruleId);
            });
        });
    }

    formatCondition(condition) {
        const { type, operator, value } = condition;
        
        switch (type) {
            case 'temperature':
                return `Temperature ${operator} ${value}°C`;
            case 'time':
                return `Time between ${value.start} and ${value.end}`;
            case 'device_state':
                return `Device ${value.deviceId} is ${value.state === 'true' ? 'ON' : 'OFF'}`;
            default:
                return `${type} ${operator} ${JSON.stringify(value)}`;
        }
    }

    formatAction(action) {
        const { deviceId, command } = action;
        const device = this.autoModeManager.deviceRegistry?.getDevice(deviceId);
        const deviceName = device?.name || deviceId;
        
        switch (command) {
            case 'on': return `Turn ${deviceName} ON`;
            case 'off': return `Turn ${deviceName} OFF`;
            case 'toggle': return `Toggle ${deviceName}`;
            default: return `${command} ${deviceName}`;
        }
    }

    showAddRuleModal() {
        this.ruleModalTitle.textContent = 'Add Auto Rule';
        this.currentRuleId = null;
        this.ruleForm.reset();
        this.renderConditionConfig();
        this.ruleModal.style.display = 'flex';
    }

    editRule(ruleId) {
        const rule = this.autoModeManager.getRule(ruleId);
        if (!rule) return;
        
        this.ruleModalTitle.textContent = 'Edit Auto Rule';
        this.currentRuleId = ruleId;
        
        document.getElementById('rule-name').value = rule.name;
        this.conditionType.value = rule.condition.type;
        this.renderConditionConfig();
        
        // Populate condition values
        setTimeout(() => {
            const { condition } = rule;
            switch (condition.type) {
                case 'temperature':
                    document.getElementById('cond-operator').value = condition.operator;
                    document.getElementById('cond-value').value = condition.value;
                    break;
                case 'time':
                    document.getElementById('cond-start').value = condition.value.start;
                    document.getElementById('cond-end').value = condition.value.end;
                    break;
                case 'device_state':
                    document.getElementById('cond-device').value = condition.value.deviceId;
                    document.getElementById('cond-state').value = condition.value.state;
                    break;
            }
            this.actionDevice.value = rule.action.deviceId;
            this.actionCommand.value = rule.action.command;
        }, 100);
        
        this.ruleModal.style.display = 'flex';
    }

    saveRule() {
        const name = document.getElementById('rule-name').value;
        if (!name) {
            this.showToast('Please enter a rule name', 'error');
            return;
        }
        
        const condition = this.buildCondition();
        const action = {
            deviceId: parseInt(this.actionDevice.value),
            command: document.getElementById('action-command').value
        };
        
        if (!action.deviceId) {
            this.showToast('Please select a device', 'error');
            return;
        }
        
        const ruleData = { name, condition, action };
        
        if (this.currentRuleId) {
            this.autoModeManager.updateRule(this.currentRuleId, ruleData);
            this.showToast('Rule updated successfully', 'success');
        } else {
            this.autoModeManager.addRule(ruleData);
            this.showToast('Rule added successfully', 'success');
        }
        
        this.closeRuleModal();
        this.render();
    }

    buildCondition() {
        const type = this.conditionType.value;
        
        switch (type) {
            case 'temperature':
                return {
                    type,
                    operator: document.getElementById('cond-operator').value,
                    value: parseFloat(document.getElementById('cond-value').value)
                };
            case 'time':
                return {
                    type,
                    operator: 'between',
                    value: {
                        start: document.getElementById('cond-start').value,
                        end: document.getElementById('cond-end').value
                    }
                };
            case 'device_state':
                return {
                    type,
                    operator: '==',
                    value: {
                        deviceId: parseInt(document.getElementById('cond-device').value),
                        state: document.getElementById('cond-state').value
                    }
                };
            default:
                return { type, operator: '==', value: null };
        }
    }

    deleteRule(ruleId) {
        if (confirm('Are you sure you want to delete this rule?')) {
            this.autoModeManager.deleteRule(ruleId);
            this.showToast('Rule deleted successfully', 'success');
            this.render();
        }
    }

    closeRuleModal() {
        this.ruleModal.style.display = 'none';
        this.currentRuleId = null;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    showToast(message, type) {
        if (window.showToast) {
            window.showToast(message, type);
        } else {
            alert(message);
        }
    }
}

// ============================================
// CSS STYLES (Auto-injected)
// ============================================

const autoModeStyles = `
    .auto-mode-panel {
        background: var(--bg-card);
        border-radius: 12px;
        padding: 20px;
        border: 1px solid var(--border-color);
    }
    
    .auto-header {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 20px;
        padding-bottom: 12px;
        border-bottom: 1px solid var(--border-color);
    }
    
    .auto-header i {
        font-size: 20px;
        color: var(--primary);
    }
    
    .auto-header h3 {
        flex: 1;
        margin: 0;
    }
    
    .auto-stats {
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
        font-size: 20px;
        font-weight: 600;
        color: var(--primary);
    }
    
    .stat-label {
        font-size: 11px;
        color: var(--text-muted);
        margin-top: 4px;
    }
    
    .rules-list {
        max-height: 500px;
        overflow-y: auto;
    }
    
    .rule-card {
        background: var(--bg-secondary);
        border-radius: 10px;
        margin-bottom: 12px;
        overflow: hidden;
        transition: all 0.2s ease;
    }
    
    .rule-card.enabled {
        border-left: 3px solid var(--success);
    }
    
    .rule-card.disabled {
        opacity: 0.6;
        border-left: 3px solid var(--danger);
    }
    
    .rule-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px 16px;
        background: var(--bg-tertiary);
    }
    
    .rule-name {
        font-weight: 500;
        margin-bottom: 4px;
    }
    
    .rule-condition {
        font-size: 11px;
        color: var(--text-muted);
    }
    
    .rule-stats {
        display: flex;
        align-items: center;
        gap: 12px;
    }
    
    .rule-triggers {
        font-size: 11px;
        color: var(--text-muted);
    }
    
    .rule-body {
        padding: 12px 16px;
        border-bottom: 1px solid var(--border-light);
    }
    
    .rule-action {
        font-size: 13px;
        color: var(--primary);
        margin-bottom: 4px;
    }
    
    .rule-last {
        font-size: 10px;
        color: var(--text-muted);
    }
    
    .rule-footer {
        padding: 8px 16px;
        display: flex;
        justify-content: flex-end;
        gap: 8px;
    }
    
    .edit-rule, .delete-rule {
        padding: 4px 12px;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 11px;
    }
    
    .edit-rule {
        background: var(--info);
        color: white;
    }
    
    .delete-rule {
        background: var(--danger);
        color: white;
    }
    
    .no-rules {
        text-align: center;
        color: var(--text-muted);
        padding: 40px;
    }
`;

// Inject styles
if (typeof document !== 'undefined') {
    const styleSheet = document.createElement('style');
    styleSheet.textContent = autoModeStyles;
    document.head.appendChild(styleSheet);
}

// ============================================
// CREATE SINGLETON INSTANCES
// ============================================

let autoModeManager = null;
let autoModeUI = null;

const initAutoMode = (deviceController, deviceRegistry) => {
    autoModeManager = new AutoModeManager(deviceController, deviceRegistry);
    autoModeUI = new AutoModeUI(autoModeManager);
    return { autoModeManager, autoModeUI };
};

// ============================================
// EXPORTS
// ============================================

// Expose to window
window.AutoModeManager = AutoModeManager;
window.AutoModeConfig = AutoModeConfig;
window.initAutoMode = initAutoMode;

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        autoModeManager,
        autoModeUI,
        AutoModeManager,
        AutoModeConfig,
        initAutoMode
    };
}

// ES modules export
export {
    autoModeManager,
    autoModeUI,
    AutoModeManager,
    AutoModeConfig,
    initAutoMode
};