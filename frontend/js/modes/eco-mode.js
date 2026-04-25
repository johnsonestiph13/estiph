/**
 * ESTIF HOME ULTIMATE - ECO MODE MODULE
 * Energy-saving mode that optimizes device usage for minimal consumption
 * Version: 2.0.0
 * Author: Estifanos Yohannis
 */

// ============================================
// ECO MODE CONFIGURATION
// ============================================

const EcoModeConfig = {
    // Energy thresholds
    thresholds: {
        maxTotalPower: 500, // Watts
        maxDevicePower: 100, // Watts per device
        autoOffAfter: 3600000 // 1 hour inactivity
    },
    
    // Optimization settings
    optimization: {
        reduceBrightness: true,
        reduceSpeed: true,
        autoOffIdle: true,
        optimizeHVAC: true
    },
    
    // Target savings
    targetSavings: 20, // percentage
    
    // Storage
    storageKey: 'estif_eco_mode_settings',
    historyKey: 'estif_eco_mode_history',
    
    // Debug
    debug: false
};

// ============================================
// ECO MODE MANAGER
// ============================================

class EcoModeManager {
    constructor(deviceController, deviceRegistry) {
        this.deviceController = deviceController;
        this.deviceRegistry = deviceRegistry;
        this.isActive = false;
        this.originalStates = {};
        this.energySavings = 0;
        this.history = [];
        this.listeners = [];
        
        this.init();
    }

    init() {
        this.loadSettings();
        this.loadHistory();
        EcoModeConfig.debug && console.log('[EcoMode] Manager initialized');
    }

    loadSettings() {
        try {
            const saved = localStorage.getItem(EcoModeConfig.storageKey);
            if (saved) {
                this.settings = JSON.parse(saved);
            }
        } catch (error) {
            console.error('[EcoMode] Failed to load settings:', error);
        }
    }

    saveSettings() {
        try {
            localStorage.setItem(EcoModeConfig.storageKey, JSON.stringify(this.settings));
        } catch (error) {
            console.error('[EcoMode] Failed to save settings:', error);
        }
    }

    loadHistory() {
        try {
            const saved = localStorage.getItem(EcoModeConfig.historyKey);
            if (saved) {
                this.history = JSON.parse(saved);
            }
        } catch (error) {
            console.error('[EcoMode] Failed to load history:', error);
        }
    }

    saveHistory() {
        try {
            if (this.history.length > 100) {
                this.history = this.history.slice(0, 100);
            }
            localStorage.setItem(EcoModeConfig.historyKey, JSON.stringify(this.history));
        } catch (error) {
            console.error('[EcoMode] Failed to save history:', error);
        }
    }

    // ============================================
    // MODE ACTIVATION
    // ============================================

    async activate(options = {}) {
        if (this.isActive) return false;
        
        await this.saveCurrentStates();
        await this.optimizeDevices();
        
        this.isActive = true;
        this.activatedAt = Date.now();
        this.startMonitoring();
        
        this.recordHistory('activated');
        this.notifyListeners('activated', { timestamp: Date.now() });
        
        EcoModeConfig.debug && console.log('[EcoMode] Activated');
        return true;
    }

    async deactivate() {
        if (!this.isActive) return false;
        
        this.stopMonitoring();
        await this.restoreStates();
        
        const duration = Date.now() - this.activatedAt;
        const savings = this.calculateSavings();
        
        this.isActive = false;
        this.deactivatedAt = Date.now();
        
        this.recordHistory('deactivated', { duration, savings });
        this.notifyListeners('deactivated', { timestamp: Date.now(), savings });
        
        EcoModeConfig.debug && console.log('[EcoMode] Deactivated, savings:', savings);
        return true;
    }

    async saveCurrentStates() {
        const devices = this.deviceRegistry.getAllDevices();
        
        this.originalStates = {
            devices: {},
            energyUsage: this.getCurrentEnergyUsage()
        };
        
        for (const device of devices) {
            this.originalStates.devices[device.id] = {
                state: device.state,
                autoMode: device.autoMode,
                brightness: device.brightness,
                speed: device.speed,
                temperature: device.temperature
            };
        }
    }

    async restoreStates() {
        for (const [deviceId, state] of Object.entries(this.originalStates.devices)) {
            const device = this.deviceRegistry.getDevice(parseInt(deviceId));
            if (!device) continue;
            
            if (device.state !== state.state) {
                await this.deviceController.setDeviceState(parseInt(deviceId), state.state);
            }
            if (state.brightness !== undefined && device.brightness !== state.brightness) {
                await this.deviceController.setDeviceBrightness(parseInt(deviceId), state.brightness);
            }
            if (state.speed !== undefined && device.speed !== state.speed) {
                await this.deviceController.setDeviceSpeed(parseInt(deviceId), state.speed);
            }
        }
    }

    async optimizeDevices() {
        const devices = this.deviceRegistry.getAllDevices();
        
        for (const device of devices) {
            // Turn off high-power devices
            if (device.power > EcoModeConfig.thresholds.maxDevicePower) {
                if (device.state) {
                    await this.deviceController.setDeviceState(device.id, false);
                }
                continue;
            }
            
            // Reduce brightness for lights
            if (device.type === 'light' && EcoModeConfig.optimization.reduceBrightness) {
                if (device.brightness > 30) {
                    await this.deviceController.setDeviceBrightness(device.id, 30);
                }
            }
            
            // Reduce speed for fans
            if (device.type === 'fan' && EcoModeConfig.optimization.reduceSpeed) {
                if (device.speed > 2) {
                    await this.deviceController.setDeviceSpeed(device.id, 2);
                }
            }
            
            // Optimize HVAC
            if ((device.type === 'ac' || device.type === 'heater') && EcoModeConfig.optimization.optimizeHVAC) {
                const optimalTemp = device.type === 'ac' ? 24 : 20;
                if (Math.abs(device.temperature - optimalTemp) > 2) {
                    await this.deviceController.setTemperature(device.id, optimalTemp);
                }
            }
        }
        
        // Enforce total power limit
        await this.enforcePowerLimit();
    }

    async enforcePowerLimit() {
        let totalPower = this.getCurrentEnergyUsage();
        
        if (totalPower > EcoModeConfig.thresholds.maxTotalPower) {
            const devices = this.deviceRegistry.getAllDevices()
                .filter(d => d.state)
                .sort((a, b) => b.power - a.power);
            
            for (const device of devices) {
                if (totalPower <= EcoModeConfig.thresholds.maxTotalPower) break;
                
                await this.deviceController.setDeviceState(device.id, false);
                totalPower -= device.power;
            }
        }
    }

    startMonitoring() {
        this.monitorInterval = setInterval(() => {
            this.monitorAndOptimize();
        }, 60000); // Check every minute
    }

    stopMonitoring() {
        if (this.monitorInterval) {
            clearInterval(this.monitorInterval);
            this.monitorInterval = null;
        }
    }

    async monitorAndOptimize() {
        if (!this.isActive) return;
        
        // Check for idle devices
        if (EcoModeConfig.optimization.autoOffIdle) {
            await this.turnOffIdleDevices();
        }
        
        // Enforce power limit
        await this.enforcePowerLimit();
        
        // Update savings
        this.updateSavings();
        
        this.notifyListeners('monitored', {
            energyUsage: this.getCurrentEnergyUsage(),
            savings: this.energySavings
        });
    }

    async turnOffIdleDevices() {
        const now = Date.now();
        const devices = this.deviceRegistry.getAllDevices();
        
        for (const device of devices) {
            if (device.state && device.lastActivity) {
                const idleTime = now - device.lastActivity;
                if (idleTime > EcoModeConfig.thresholds.autoOffAfter) {
                    await this.deviceController.setDeviceState(device.id, false);
                    this.recordHistory('auto_off', { device: device.name });
                }
            }
        }
    }

    getCurrentEnergyUsage() {
        const devices = this.deviceRegistry.getAllDevices();
        return devices.reduce((total, device) => {
            return total + (device.state ? device.power : 0);
        }, 0);
    }

    updateSavings() {
        const currentUsage = this.getCurrentEnergyUsage();
        const originalUsage = this.originalStates.energyUsage || currentUsage;
        const savingsPercent = ((originalUsage - currentUsage) / originalUsage) * 100;
        this.energySavings = Math.max(0, savingsPercent);
    }

    calculateSavings() {
        return this.energySavings;
    }

    // ============================================
    // HISTORY
    // ============================================

    recordHistory(action, data = {}) {
        const entry = {
            id: Date.now(),
            action,
            data,
            timestamp: Date.now(),
            energyUsage: this.getCurrentEnergyUsage(),
            savings: this.energySavings
        };
        
        this.history.unshift(entry);
        this.saveHistory();
        this.notifyListeners('history_added', entry);
    }

    getHistory(limit = 20) {
        return this.history.slice(0, limit);
    }

    // ============================================
    // STATISTICS
    // ============================================

    getStatistics() {
        const totalSavings = this.history.reduce((sum, h) => sum + (h.savings || 0), 0);
        const avgSavings = this.history.length > 0 ? totalSavings / this.history.length : 0;
        
        return {
            isActive: this.isActive,
            currentEnergyUsage: this.getCurrentEnergyUsage(),
            currentSavings: this.energySavings,
            totalSavings,
            averageSavings: avgSavings,
            activatedCount: this.history.filter(h => h.action === 'activated').length,
            totalTimeActive: this.calculateTotalActiveTime()
        };
    }

    calculateTotalActiveTime() {
        let total = 0;
        let lastActivation = null;
        
        for (const entry of this.history) {
            if (entry.action === 'activated') {
                lastActivation = entry.timestamp;
            } else if (entry.action === 'deactivated' && lastActivation) {
                total += entry.timestamp - lastActivation;
                lastActivation = null;
            }
        }
        
        if (this.isActive && lastActivation) {
            total += Date.now() - lastActivation;
        }
        
        return total;
    }

    // ============================================
    // UTILITY
    // ============================================

    getStatus() {
        return {
            isActive: this.isActive,
            activatedAt: this.activatedAt,
            deactivatedAt: this.deactivatedAt,
            currentEnergyUsage: this.getCurrentEnergyUsage(),
            savings: this.energySavings
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
// CREATE SINGLETON INSTANCE
// ============================================

let ecoModeManager = null;

const initEcoMode = (deviceController, deviceRegistry) => {
    ecoModeManager = new EcoModeManager(deviceController, deviceRegistry);
    return ecoModeManager;
};

// Exports
window.EcoModeManager = EcoModeManager;
window.initEcoMode = initEcoMode;

export { ecoModeManager, EcoModeManager, EcoModeConfig, initEcoMode };