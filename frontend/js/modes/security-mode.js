/**
 * ESTIF HOME ULTIMATE - SECURITY MODE MODULE
 * Enhanced security monitoring, alerts, and automated responses
 * Version: 2.0.0
 * Author: Estifanos Yohannis
 */

// ============================================
// SECURITY MODE CONFIGURATION
// ============================================

const SecurityModeConfig = {
    // Security levels
    levels: {
        disarmed: { name: 'Disarmed', nameAm: 'ተበታትኗል', color: '#6c757d' },
        armed_stay: { name: 'Armed (Stay)', nameAm: 'የታጠቀ (ቆይ)', color: '#ffd166' },
        armed_away: { name: 'Armed (Away)', nameAm: 'የታጠቀ (ርቀት)', color: '#ef476f' },
        armed_night: { name: 'Armed (Night)', nameAm: 'የታጠቀ (ሌሊት)', color: '#4cc9f0' }
    },
    
    // Entry/exit delays
    delays: {
        entry: 30000, // 30 seconds
        exit: 60000, // 60 seconds
        alarm: 0 // Instant
    },
    
    // Sensor types
    sensors: {
        door: { priority: 'high', response: 'alarm' },
        window: { priority: 'high', response: 'alarm' },
        motion: { priority: 'medium', response: 'alert' },
        glass_break: { priority: 'high', response: 'alarm' },
        smoke: { priority: 'critical', response: 'emergency' },
        water_leak: { priority: 'critical', response: 'alert' }
    },
    
    // Alert settings
    alerts: {
        push: true,
        email: true,
        sms: true,
        siren: true
    },
    
    // Storage
    storageKey: 'estif_security_settings',
    historyKey: 'estif_security_events',
    
    // Debug
    debug: false
};

// ============================================
// SECURITY EVENT CLASS
// ============================================

class SecurityEvent {
    constructor(data) {
        this.id = Date.now();
        this.type = data.type;
        this.sensorId = data.sensorId;
        this.sensorName = data.sensorName;
        this.severity = data.severity;
        this.message = data.message;
        this.timestamp = Date.now();
        this.acknowledged = false;
        this.resolved = false;
    }

    acknowledge() {
        this.acknowledged = true;
        this.acknowledgedAt = Date.now();
    }

    resolve() {
        this.resolved = true;
        this.resolvedAt = Date.now();
    }
}

// ============================================
// SECURITY MODE MANAGER
// ============================================

class SecurityModeManager {
    constructor(deviceController, deviceRegistry) {
        this.deviceController = deviceController;
        this.deviceRegistry = deviceRegistry;
        this.currentLevel = 'disarmed';
        this.events = [];
        this.isArming = false;
        this.exitTimer = null;
        this.entryTimer = null;
        this.listeners = [];
        
        this.init();
    }

    init() {
        this.loadSettings();
        this.loadEvents();
        this.setupSensorMonitoring();
        SecurityModeConfig.debug && console.log('[SecurityMode] Manager initialized');
    }

    loadSettings() {
        try {
            const saved = localStorage.getItem(SecurityModeConfig.storageKey);
            if (saved) {
                this.settings = JSON.parse(saved);
            }
        } catch (error) {
            console.error('[SecurityMode] Failed to load settings:', error);
        }
    }

    saveSettings() {
        try {
            localStorage.setItem(SecurityModeConfig.storageKey, JSON.stringify(this.settings));
        } catch (error) {
            console.error('[SecurityMode] Failed to save settings:', error);
        }
    }

    loadEvents() {
        try {
            const saved = localStorage.getItem(SecurityModeConfig.historyKey);
            if (saved) {
                this.events = JSON.parse(saved);
            }
        } catch (error) {
            console.error('[SecurityMode] Failed to load events:', error);
        }
    }

    saveEvents() {
        try {
            if (this.events.length > 500) {
                this.events = this.events.slice(0, 500);
            }
            localStorage.setItem(SecurityModeConfig.historyKey, JSON.stringify(this.events));
        } catch (error) {
            console.error('[SecurityMode] Failed to save events:', error);
        }
    }

    // ============================================
    // ARMING/DISARMING
    // ============================================

    async arm(level = 'armed_away') {
        if (this.currentLevel !== 'disarmed') return false;
        
        this.isArming = true;
        this.notifyListeners('arming', { level, delay: SecurityModeConfig.delays.exit });
        
        // Check if all sensors are closed
        const openSensors = await this.checkOpenSensors();
        if (openSensors.length > 0) {
            this.notifyListeners('sensors_open', { sensors: openSensors });
            this.isArming = false;
            return false;
        }
        
        // Start exit delay
        this.exitTimer = setTimeout(() => {
            this.completeArming(level);
        }, SecurityModeConfig.delays.exit);
        
        this.notifyListeners('exit_delay_started', { delay: SecurityModeConfig.delays.exit });
        
        return true;
    }

    async completeArming(level) {
        this.currentLevel = level;
        this.isArming = false;
        this.armedAt = Date.now();
        
        // Activate security devices
        await this.activateSecurityDevices();
        
        this.notifyListeners('armed', { level, timestamp: Date.now() });
        this.recordEvent('system_armed', { level });
        
        SecurityModeConfig.debug && console.log('[SecurityMode] Armed:', level);
    }

    async disarm() {
        if (this.currentLevel === 'disarmed') return false;
        
        // Start entry delay
        this.entryTimer = setTimeout(() => {
            this.completeDisarming();
        }, SecurityModeConfig.delays.entry);
        
        this.notifyListeners('entry_delay_started', { delay: SecurityModeConfig.delays.entry });
        
        return true;
    }

    async completeDisarming() {
        // Deactivate security devices
        await this.deactivateSecurityDevices();
        
        this.currentLevel = 'disarmed';
        this.disarmedAt = Date.now();
        
        this.notifyListeners('disarmed', { timestamp: Date.now() });
        this.recordEvent('system_disarmed');
        
        SecurityModeConfig.debug && console.log('[SecurityMode] Disarmed');
    }

    async checkOpenSensors() {
        const sensors = this.deviceRegistry.getAllDevices().filter(d => 
            d.type === 'door_sensor' || d.type === 'window_sensor'
        );
        
        const openSensors = sensors.filter(s => s.state === true);
        return openSensors;
    }

    async activateSecurityDevices() {
        const devices = this.deviceRegistry.getAllDevices().filter(d => 
            d.type === 'camera' || d.type === 'siren'
        );
        
        for (const device of devices) {
            if (!device.state) {
                await this.deviceController.setDeviceState(device.id, true);
            }
        }
    }

    async deactivateSecurityDevices() {
        const devices = this.deviceRegistry.getAllDevices().filter(d => 
            d.type === 'camera' || d.type === 'siren'
        );
        
        for (const device of devices) {
            if (device.state) {
                await this.deviceController.setDeviceState(device.id, false);
            }
        }
    }

    // ============================================
    // SENSOR MONITORING
    // ============================================

    setupSensorMonitoring() {
        // In production, subscribe to sensor state changes
        // For demo, simulate periodic checks
        setInterval(() => {
            this.checkSensors();
        }, 1000);
    }

    async checkSensors() {
        if (this.currentLevel === 'disarmed') return;
        
        const sensors = this.deviceRegistry.getAllDevices().filter(d => 
            d.type === 'door_sensor' || 
            d.type === 'window_sensor' || 
            d.type === 'motion_sensor' ||
            d.type === 'glass_break' ||
            d.type === 'smoke' ||
            d.type === 'water_leak'
        );
        
        for (const sensor of sensors) {
            if (sensor.state && !sensor.triggered) {
                await this.handleSensorTrigger(sensor);
                sensor.triggered = true;
            } else if (!sensor.state) {
                sensor.triggered = false;
            }
        }
    }

    async handleSensorTrigger(sensor) {
        const sensorType = SecurityModeConfig.sensors[sensor.type] || SecurityModeConfig.sensors.motion;
        const event = new SecurityEvent({
            type: sensor.type,
            sensorId: sensor.id,
            sensorName: sensor.name,
            severity: sensorType.priority,
            message: `${sensor.name} triggered!`
        });
        
        this.events.unshift(event);
        this.saveEvents();
        
        // Send alerts
        await this.sendAlert(event);
        
        // Trigger response
        await this.executeResponse(sensorType.response);
        
        this.notifyListeners('sensor_triggered', event);
        SecurityModeConfig.debug && console.log('[SecurityMode] Sensor triggered:', sensor.name);
    }

    async sendAlert(event) {
        const alerts = [];
        
        if (SecurityModeConfig.alerts.push) {
            this.showNotification(event.message);
        }
        
        if (SecurityModeConfig.alerts.siren && this.currentLevel !== 'disarmed') {
            const siren = this.deviceRegistry.getDevice(7);
            if (siren) {
                await this.deviceController.setDeviceState(7, true);
                setTimeout(() => {
                    this.deviceController.setDeviceState(7, false);
                }, 30000);
            }
        }
        
        // In production, send email/SMS via API
        if (SecurityModeConfig.alerts.email) {
            alerts.push('email');
        }
        if (SecurityModeConfig.alerts.sms) {
            alerts.push('sms');
        }
        
        this.recordEvent('alert_sent', { eventId: event.id, methods: alerts });
    }

    async executeResponse(responseType) {
        switch (responseType) {
            case 'alarm':
                // Trigger full alarm
                await this.triggerAlarm();
                break;
            case 'alert':
                // Send notification only
                break;
            case 'emergency':
                // Emergency response
                await this.triggerEmergency();
                break;
        }
    }

    async triggerAlarm() {
        const siren = this.deviceRegistry.getDevice(7);
        const lights = this.deviceRegistry.getAllDevices().filter(d => d.type === 'light');
        
        if (siren) {
            await this.deviceController.setDeviceState(7, true);
        }
        
        // Flash lights
        for (const light of lights) {
            await this.deviceController.toggleDevice(light.id);
        }
        
        this.recordEvent('alarm_triggered');
        this.notifyListeners('alarm_triggered');
    }

    async triggerEmergency() {
        // Call emergency services
        if (window.makeEmergencyCall) {
            window.makeEmergencyCall();
        }
        
        this.recordEvent('emergency_triggered');
        this.notifyListeners('emergency_triggered');
    }

    // ============================================
    // EVENT MANAGEMENT
    // ============================================

    recordEvent(type, data = {}) {
        const event = {
            id: Date.now(),
            type,
            data,
            timestamp: Date.now()
        };
        
        this.events.unshift(event);
        this.saveEvents();
    }

    getEvents(limit = 50) {
        return this.events.slice(0, limit);
    }

    getUnacknowledgedEvents() {
        return this.events.filter(e => e.acknowledged === false && e.resolved === false);
    }

    acknowledgeEvent(eventId) {
        const event = this.events.find(e => e.id === eventId);
        if (event) {
            event.acknowledge();
            this.saveEvents();
            this.notifyListeners('event_acknowledged', event);
        }
    }

    resolveEvent(eventId) {
        const event = this.events.find(e => e.id === eventId);
        if (event) {
            event.resolve();
            this.saveEvents();
            this.notifyListeners('event_resolved', event);
        }
    }

    // ============================================
    // NOTIFICATIONS
    // ============================================

    showNotification(message) {
        if (window.showToast) {
            window.showToast(message, 'warning');
        }
        
        // Browser notification
        if (Notification.permission === 'granted') {
            new Notification('Security Alert', { body: message });
        }
    }

    // ============================================
    // STATUS
    // ============================================

    getStatus() {
        return {
            level: this.currentLevel,
            levelInfo: SecurityModeConfig.levels[this.currentLevel],
            isArming: this.isArming,
            armedAt: this.armedAt,
            disarmedAt: this.disarmedAt,
            eventCount: this.events.length,
            unacknowledgedEvents: this.getUnacknowledgedEvents().length
        };
    }

    // ============================================
    // SETTINGS
    // ============================================

    updateSettings(updates) {
        this.settings = { ...this.settings, ...updates };
        this.saveSettings();
        this.notifyListeners('settings_updated', this.settings);
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
// CREATE SINGLETON INSTANCE
// ============================================

let securityModeManager = null;

const initSecurityMode = (deviceController, deviceRegistry) => {
    securityModeManager = new SecurityModeManager(deviceController, deviceRegistry);
    return securityModeManager;
};

// Exports
window.SecurityModeManager = SecurityModeManager;
window.initSecurityMode = initSecurityMode;

export { securityModeManager, SecurityModeManager, SecurityModeConfig, initSecurityMode };