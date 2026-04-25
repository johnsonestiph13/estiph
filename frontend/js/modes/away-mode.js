/**
 * ESTIF HOME ULTIMATE - AWAY MODE MODULE
 * Simulate presence, secure home when residents are away
 * Version: 2.0.0
 * Author: Estifanos Yohannis
 */

// ============================================
// AWAY MODE CONFIGURATION
// ============================================

const AwayModeConfig = {
    // Default settings
    defaultDuration: 3600000, // 1 hour
    randomDelay: 300000, // 5 minutes
    scheduleCheckInterval: 60000, // 1 minute
    
    // Device actions
    actions: {
        lights: {
            randomOn: true,
            minOnTime: 300000, // 5 minutes
            maxOnTime: 1800000 // 30 minutes
        },
        tv: {
            simulate: true,
            randomChannel: true
        },
        blinds: {
            closeAtNight: true,
            openAtMorning: true
        }
    },
    
    // Security settings
    security: {
        enableNotifications: true,
        alertOnMotion: true,
        alertOnDoorOpen: true,
        autoArmDelay: 300000 // 5 minutes
    },
    
    // Storage
    storageKey: 'estif_away_mode_settings',
    historyKey: 'estif_away_mode_history',
    
    // Debug
    debug: false
};

// ============================================
// AWAY MODE MANAGER
// ============================================

class AwayModeManager {
    constructor(deviceController, deviceRegistry) {
        this.deviceController = deviceController;
        this.deviceRegistry = deviceRegistry;
        this.isActive = false;
        this.isArming = false;
        this.scheduleTimer = null;
        this.presenceSimulator = null;
        this.history = [];
        this.listeners = [];
        
        this.init();
    }

    init() {
        this.loadSettings();
        this.loadHistory();
        AwayModeConfig.debug && console.log('[AwayMode] Manager initialized');
    }

    loadSettings() {
        try {
            const saved = localStorage.getItem(AwayModeConfig.storageKey);
            if (saved) {
                const settings = JSON.parse(saved);
                this.settings = settings;
            }
        } catch (error) {
            console.error('[AwayMode] Failed to load settings:', error);
        }
    }

    saveSettings() {
        try {
            localStorage.setItem(AwayModeConfig.storageKey, JSON.stringify(this.settings));
        } catch (error) {
            console.error('[AwayMode] Failed to save settings:', error);
        }
    }

    loadHistory() {
        try {
            const saved = localStorage.getItem(AwayModeConfig.historyKey);
            if (saved) {
                this.history = JSON.parse(saved);
            }
        } catch (error) {
            console.error('[AwayMode] Failed to load history:', error);
        }
    }

    saveHistory() {
        try {
            if (this.history.length > 100) {
                this.history = this.history.slice(0, 100);
            }
            localStorage.setItem(AwayModeConfig.historyKey, JSON.stringify(this.history));
        } catch (error) {
            console.error('[AwayMode] Failed to save history:', error);
        }
    }

    // ============================================
    // MODE ACTIVATION
    // ============================================

    async activate(options = {}) {
        if (this.isActive) return false;
        
        this.isArming = true;
        this.notifyListeners('arming', { delay: AwayModeConfig.security.autoArmDelay });
        
        // Auto-arm delay
        if (options.delay !== false) {
            await this.delay(AwayModeConfig.security.autoArmDelay);
        }
        
        // Save current states
        this.savedStates = await this.saveCurrentStates();
        
        // Turn off all non-essential devices
        await this.prepareHome();
        
        // Start presence simulation
        if (options.simulatePresence !== false) {
            this.startPresenceSimulation();
        }
        
        this.isActive = true;
        this.isArming = false;
        this.activatedAt = Date.now();
        
        this.recordHistory('activated', { options });
        this.notifyListeners('activated', { timestamp: Date.now() });
        
        AwayModeConfig.debug && console.log('[AwayMode] Activated');
        return true;
    }

    async deactivate() {
        if (!this.isActive) return false;
        
        // Stop presence simulation
        this.stopPresenceSimulation();
        
        // Restore saved states
        await this.restoreStates();
        
        this.isActive = false;
        this.deactivatedAt = Date.now();
        
        this.recordHistory('deactivated', { duration: this.deactivatedAt - this.activatedAt });
        this.notifyListeners('deactivated', { timestamp: Date.now() });
        
        AwayModeConfig.debug && console.log('[AwayMode] Deactivated');
        return true;
    }

    async prepareHome() {
        const devices = this.deviceRegistry.getAllDevices();
        
        // Turn off lights
        const lights = devices.filter(d => d.type === 'light');
        for (const light of lights) {
            if (light.state) {
                await this.deviceController.setDeviceState(light.id, false);
            }
        }
        
        // Turn off TV
        const tv = devices.find(d => d.type === 'tv');
        if (tv && tv.state) {
            await this.deviceController.setDeviceState(tv.id, false);
        }
        
        // Close blinds if configured
        if (AwayModeConfig.actions.blinds.closeAtNight) {
            const blinds = devices.filter(d => d.type === 'blind');
            for (const blind of blinds) {
                if (blind.state) {
                    await this.deviceController.setDeviceState(blind.id, false);
                }
            }
        }
        
        // Arm security devices
        await this.armSecurity();
    }

    async saveCurrentStates() {
        const devices = this.deviceRegistry.getAllDevices();
        const states = {};
        
        for (const device of devices) {
            states[device.id] = {
                state: device.state,
                autoMode: device.autoMode,
                brightness: device.brightness
            };
        }
        
        return states;
    }

    async restoreStates() {
        for (const [deviceId, state] of Object.entries(this.savedStates)) {
            const device = this.deviceRegistry.getDevice(parseInt(deviceId));
            if (device && device.state !== state.state) {
                await this.deviceController.setDeviceState(parseInt(deviceId), state.state);
            }
        }
        
        // Disarm security
        await this.disarmSecurity();
    }

    // ============================================
    // PRESENCE SIMULATION
    // ============================================

    startPresenceSimulation() {
        this.presenceSimulator = setInterval(() => {
            this.simulateRandomActivity();
        }, AwayModeConfig.randomDelay);
        
        AwayModeConfig.debug && console.log('[AwayMode] Presence simulation started');
    }

    stopPresenceSimulation() {
        if (this.presenceSimulator) {
            clearInterval(this.presenceSimulator);
            this.presenceSimulator = null;
        }
        
        AwayModeConfig.debug && console.log('[AwayMode] Presence simulation stopped');
    }

    async simulateRandomActivity() {
        const devices = this.deviceRegistry.getAllDevices();
        const lights = devices.filter(d => d.type === 'light');
        
        if (lights.length === 0) return;
        
        // Randomly select a light
        const randomLight = lights[Math.floor(Math.random() * lights.length)];
        
        // Randomly turn on/off
        const shouldTurnOn = Math.random() > 0.5;
        
        if (shouldTurnOn) {
            await this.deviceController.setDeviceState(randomLight.id, true);
            
            // Schedule turn off after random duration
            const duration = Math.random() * (AwayModeConfig.actions.lights.maxOnTime - AwayModeConfig.actions.lights.minOnTime) + AwayModeConfig.actions.lights.minOnTime;
            setTimeout(() => {
                if (this.isActive) {
                    this.deviceController.setDeviceState(randomLight.id, false);
                }
            }, duration);
        }
        
        this.recordHistory('presence_simulated', { device: randomLight.name, action: shouldTurnOn ? 'on' : 'off' });
    }

    // ============================================
    // SECURITY
    // ============================================

    async armSecurity() {
        const devices = this.deviceRegistry.getAllDevices();
        const securityDevices = devices.filter(d => d.type === 'camera' || d.type === 'door_sensor' || d.type === 'motion_sensor');
        
        for (const device of securityDevices) {
            await this.deviceController.setDeviceState(device.id, true);
        }
        
        this.notifyListeners('security_armed');
    }

    async disarmSecurity() {
        const devices = this.deviceRegistry.getAllDevices();
        const securityDevices = devices.filter(d => d.type === 'camera' || d.type === 'door_sensor' || d.type === 'motion_sensor');
        
        for (const device of securityDevices) {
            await this.deviceController.setDeviceState(device.id, false);
        }
        
        this.notifyListeners('security_disarmed');
    }

    // ============================================
    // SCHEDULING
    // ============================================

    scheduleActivation(time, duration = AwayModeConfig.defaultDuration) {
        const activationTime = new Date(time).getTime();
        const now = Date.now();
        
        if (activationTime <= now) {
            this.activate();
            return;
        }
        
        const delay = activationTime - now;
        
        setTimeout(() => {
            this.activate({ duration });
        }, delay);
        
        this.notifyListeners('scheduled', { activationTime, duration });
    }

    // ============================================
    // HISTORY
    // ============================================

    recordHistory(action, data) {
        const entry = {
            id: Date.now(),
            action,
            data,
            timestamp: Date.now()
        };
        
        this.history.unshift(entry);
        this.saveHistory();
        this.notifyListeners('history_added', entry);
    }

    getHistory(limit = 20) {
        return this.history.slice(0, limit);
    }

    // ============================================
    // UTILITY
    // ============================================

    getStatus() {
        return {
            isActive: this.isActive,
            isArming: this.isArming,
            activatedAt: this.activatedAt,
            deactivatedAt: this.deactivatedAt,
            duration: this.activatedAt ? (Date.now() - this.activatedAt) : 0
        };
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
// CREATE SINGLETON INSTANCE
// ============================================

let awayModeManager = null;

const initAwayMode = (deviceController, deviceRegistry) => {
    awayModeManager = new AwayModeManager(deviceController, deviceRegistry);
    return awayModeManager;
};

// Exports
window.AwayModeManager = AwayModeManager;
window.initAwayMode = initAwayMode;

export { awayModeManager, AwayModeManager, AwayModeConfig, initAwayMode };