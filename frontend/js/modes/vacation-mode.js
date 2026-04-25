/**
 * ESTIF HOME ULTIMATE - VACATION MODE MODULE
 * Extended absence management with scheduling, random activity simulation, and security
 * Version: 2.0.0
 * Author: Estifanos Yohannis
 */

// ============================================
// VACATION MODE CONFIGURATION
// ============================================

const VacationModeConfig = {
    // Default settings
    defaultDuration: 7, // days
    minDuration: 1,
    maxDuration: 90,
    
    // Activity simulation
    simulation: {
        enabled: true,
        intensity: 'medium', // low, medium, high
        randomDelayRange: { min: 300000, max: 1800000 }, // 5-30 minutes
        devices: ['lights', 'tv', 'blinds']
    },
    
    // Security
    security: {
        autoArm: true,
        level: 'armed_away',
        notificationFrequency: 'daily' // daily, weekly, never
    },
    
    // Energy saving
    energySaving: {
        enabled: true,
        setpointTemps: {
            ac: 26,
            heater: 16
        },
        turnOffDevices: true
    },
    
    // Storage
    storageKey: 'estif_vacation_mode_settings',
    historyKey: 'estif_vacation_mode_history',
    
    // Debug
    debug: false
};

// ============================================
// VACATION MODE MANAGER
// ============================================

class VacationModeManager {
    constructor(deviceController, deviceRegistry, securityManager) {
        this.deviceController = deviceController;
        this.deviceRegistry = deviceRegistry;
        this.securityManager = securityManager;
        this.isActive = false;
        this.simulationInterval = null;
        this.savedStates = {};
        this.currentVacation = null;
        this.listeners = [];
        
        this.init();
    }

    init() {
        this.loadSettings();
        this.loadHistory();
        this.checkForActiveVacation();
        VacationModeConfig.debug && console.log('[VacationMode] Manager initialized');
    }

    loadSettings() {
        try {
            const saved = localStorage.getItem(VacationModeConfig.storageKey);
            if (saved) {
                this.settings = JSON.parse(saved);
            }
        } catch (error) {
            console.error('[VacationMode] Failed to load settings:', error);
        }
    }

    saveSettings() {
        try {
            localStorage.setItem(VacationModeConfig.storageKey, JSON.stringify(this.settings));
        } catch (error) {
            console.error('[VacationMode] Failed to save settings:', error);
        }
    }

    loadHistory() {
        try {
            const saved = localStorage.getItem(VacationModeConfig.historyKey);
            if (saved) {
                this.history = JSON.parse(saved);
            }
        } catch (error) {
            console.error('[VacationMode] Failed to load history:', error);
        }
    }

    saveHistory() {
        try {
            if (this.history.length > 50) {
                this.history = this.history.slice(0, 50);
            }
            localStorage.setItem(VacationModeConfig.historyKey, JSON.stringify(this.history));
        } catch (error) {
            console.error('[VacationMode] Failed to save history:', error);
        }
    }

    // ============================================
    // VACATION MANAGEMENT
    // ============================================

    async startVacation(options = {}) {
        if (this.isActive) return false;
        
        const duration = options.duration || VacationModeConfig.defaultDuration;
        const startDate = options.startDate || new Date();
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + duration);
        
        this.currentVacation = {
            id: Date.now(),
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
            duration,
            options
        };
        
        await this.saveCurrentStates();
        await this.prepareHomeForVacation(options);
        
        // Start activity simulation
        if (VacationModeConfig.simulation.enabled && options.simulate !== false) {
            this.startActivitySimulation();
        }
        
        // Arm security
        if (VacationModeConfig.security.autoArm && this.securityManager) {
            await this.securityManager.arm(VacationModeConfig.security.level);
        }
        
        this.isActive = true;
        this.activatedAt = Date.now();
        
        // Schedule auto-return
        this.scheduleReturn(endDate);
        
        this.recordHistory('vacation_started', { duration, startDate });
        this.notifyListeners('vacation_started', { startDate, endDate });
        
        VacationModeConfig.debug && console.log('[VacationMode] Started for', duration, 'days');
        return true;
    }

    async endVacation() {
        if (!this.isActive) return false;
        
        this.stopActivitySimulation();
        
        // Disarm security
        if (this.securityManager && this.securityManager.currentLevel !== 'disarmed') {
            await this.securityManager.disarm();
        }
        
        await this.restoreStates();
        
        this.isActive = false;
        this.deactivatedAt = Date.now();
        
        if (this.currentVacation) {
            this.currentVacation.endedAt = Date.now();
            this.recordHistory('vacation_ended', { duration: this.deactivatedAt - this.activatedAt });
        }
        
        this.notifyListeners('vacation_ended', { timestamp: Date.now() });
        
        VacationModeConfig.debug && console.log('[VacationMode] Ended');
        return true;
    }

    async saveCurrentStates() {
        const devices = this.deviceRegistry.getAllDevices();
        
        this.savedStates = {};
        
        for (const device of devices) {
            this.savedStates[device.id] = {
                state: device.state,
                autoMode: device.autoMode,
                brightness: device.brightness,
                temperature: device.temperature
            };
        }
    }

    async restoreStates() {
        for (const [deviceId, state] of Object.entries(this.savedStates)) {
            const device = this.deviceRegistry.getDevice(parseInt(deviceId));
            if (device && device.state !== state.state) {
                await this.deviceController.setDeviceState(parseInt(deviceId), state.state);
            }
            if (state.temperature !== undefined && device.temperature !== state.temperature) {
                await this.deviceController.setTemperature(parseInt(deviceId), state.temperature);
            }
        }
    }

    async prepareHomeForVacation(options) {
        const devices = this.deviceRegistry.getAllDevices();
        
        // Turn off all non-essential devices
        if (VacationModeConfig.energySaving.turnOffDevices) {
            for (const device of devices) {
                if (device.type !== 'ac' && device.type !== 'heater' && device.type !== 'security') {
                    if (device.state) {
                        await this.deviceController.setDeviceState(device.id, false);
                    }
                }
            }
        }
        
        // Set energy-saving temperatures
        if (VacationModeConfig.energySaving.enabled) {
            const ac = devices.find(d => d.type === 'ac');
            const heater = devices.find(d => d.type === 'heater');
            
            if (ac) {
                await this.deviceController.setTemperature(ac.id, VacationModeConfig.energySaving.setpointTemps.ac);
            }
            if (heater) {
                await this.deviceController.setTemperature(heater.id, VacationModeConfig.energySaving.setpointTemps.heater);
            }
        }
        
        // Close blinds
        const blinds = devices.filter(d => d.type === 'blind');
        for (const blind of blinds) {
            if (blind.state) {
                await this.deviceController.setDeviceState(blind.id, false);
            }
        }
    }

    // ============================================
    // ACTIVITY SIMULATION
    // ============================================

    startActivitySimulation() {
        const intensity = this.settings?.simulationIntensity || VacationModeConfig.simulation.intensity;
        const delayRange = this.getDelayRange(intensity);
        
        this.simulationInterval = setInterval(() => {
            this.simulateRandomActivity();
        }, this.getRandomDelay(delayRange));
        
        VacationModeConfig.debug && console.log('[VacationMode] Activity simulation started');
    }

    stopActivitySimulation() {
        if (this.simulationInterval) {
            clearInterval(this.simulationInterval);
            this.simulationInterval = null;
        }
        
        VacationModeConfig.debug && console.log('[VacationMode] Activity simulation stopped');
    }

    getDelayRange(intensity) {
        const ranges = {
            low: { min: 1800000, max: 3600000 }, // 30-60 minutes
            medium: { min: 600000, max: 1800000 }, // 10-30 minutes
            high: { min: 300000, max: 900000 } // 5-15 minutes
        };
        return ranges[intensity] || ranges.medium;
    }

    getRandomDelay(range) {
        return Math.random() * (range.max - range.min) + range.min;
    }

    async simulateRandomActivity() {
        const devices = VacationModeConfig.simulation.devices;
        const deviceType = devices[Math.floor(Math.random() * devices.length)];
        
        switch (deviceType) {
            case 'lights':
                await this.simulateLights();
                break;
            case 'tv':
                await this.simulateTV();
                break;
            case 'blinds':
                await this.simulateBlinds();
                break;
        }
        
        this.recordHistory('activity_simulated', { deviceType });
    }

    async simulateLights() {
        const lights = this.deviceRegistry.getAllDevices().filter(d => d.type === 'light');
        if (lights.length === 0) return;
        
        const randomLight = lights[Math.floor(Math.random() * lights.length)];
        const shouldTurnOn = Math.random() > 0.5;
        
        await this.deviceController.setDeviceState(randomLight.id, shouldTurnOn);
        
        // Schedule turn off if turned on
        if (shouldTurnOn) {
            setTimeout(async () => {
                if (this.isActive) {
                    await this.deviceController.setDeviceState(randomLight.id, false);
                }
            }, 1800000); // 30 minutes
        }
    }

    async simulateTV() {
        const tv = this.deviceRegistry.getDevice(3);
        if (!tv) return;
        
        const shouldTurnOn = Math.random() > 0.7;
        
        if (shouldTurnOn !== tv.state) {
            await this.deviceController.setDeviceState(3, shouldTurnOn);
            
            if (shouldTurnOn) {
                setTimeout(async () => {
                    if (this.isActive && Math.random() > 0.5) {
                        await this.deviceController.setDeviceState(3, false);
                    }
                }, 7200000); // 2 hours
            }
        }
    }

    async simulateBlinds() {
        const blinds = this.deviceRegistry.getAllDevices().filter(d => d.type === 'blind');
        if (blinds.length === 0) return;
        
        const randomBlind = blinds[Math.floor(Math.random() * blinds.length)];
        const now = new Date();
        const hour = now.getHours();
        
        // Open in morning, close at night
        const shouldOpen = hour > 8 && hour < 20;
        
        if (randomBlind.state !== shouldOpen) {
            await this.deviceController.setDeviceState(randomBlind.id, shouldOpen);
        }
    }

    // ============================================
    // SCHEDULING
    // ============================================

    scheduleReturn(endDate) {
        const now = Date.now();
        const returnTime = new Date(endDate).getTime();
        const delay = returnTime - now;
        
        if (delay > 0) {
            setTimeout(() => {
                this.endVacation();
            }, delay);
        }
    }

    // ============================================
    // HISTORY
    // ============================================

    recordHistory(action, data = {}) {
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
        return (this.history || []).slice(0, limit);
    }

    // ============================================
    // STATUS
    // ============================================

    getStatus() {
        return {
            isActive: this.isActive,
            currentVacation: this.currentVacation,
            activatedAt: this.activatedAt,
            deactivatedAt: this.deactivatedAt,
            remainingTime: this.currentVacation ? 
                new Date(this.currentVacation.endDate).getTime() - Date.now() : 0
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

    getSettings() {
        return this.settings || VacationModeConfig;
    }

    checkForActiveVacation() {
        const savedVacation = localStorage.getItem('estif_active_vacation');
        if (savedVacation) {
            const vacation = JSON.parse(savedVacation);
            if (new Date(vacation.endDate) > new Date()) {
                this.startVacation(vacation.options);
            }
        }
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

let vacationModeManager = null;

const initVacationMode = (deviceController, deviceRegistry, securityManager = null) => {
    vacationModeManager = new VacationModeManager(deviceController, deviceRegistry, securityManager);
    return vacationModeManager;
};

// Exports
window.VacationModeManager = VacationModeManager;
window.initVacationMode = initVacationMode;

export { vacationModeManager, VacationModeManager, VacationModeConfig, initVacationMode };