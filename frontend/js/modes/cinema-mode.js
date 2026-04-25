/**
 * ESTIF HOME ULTIMATE - CINEMA MODE MODULE
 * Create perfect movie watching environment with lighting and audio
 * Version: 2.0.0
 * Author: Estifanos Yohannis
 */

// ============================================
// CINEMA MODE CONFIGURATION
// ============================================

const CinemaModeConfig = {
    // Default settings
    defaultLightsDim: 10, // percentage
    defaultTransitionTime: 500, // ms
    defaultTVInput: 'HDMI 1',
    defaultVolume: 40,
    
    // Device actions
    actions: {
        lights: {
            dim: true,
            dimLevel: 10,
            off: false
        },
        blinds: {
            close: true
        },
        tv: {
            on: true,
            input: 'HDMI 1'
        },
        audio: {
            surround: true,
            volume: 40
        }
    },
    
    // Storage
    storageKey: 'estif_cinema_mode_settings',
    
    // Debug
    debug: false
};

// ============================================
// CINEMA MODE MANAGER
// ============================================

class CinemaModeManager {
    constructor(deviceController, deviceRegistry) {
        this.deviceController = deviceController;
        this.deviceRegistry = deviceRegistry;
        this.isActive = false;
        this.savedStates = {};
        this.listeners = [];
        
        this.init();
    }

    init() {
        this.loadSettings();
        CinemaModeConfig.debug && console.log('[CinemaMode] Manager initialized');
    }

    loadSettings() {
        try {
            const saved = localStorage.getItem(CinemaModeConfig.storageKey);
            if (saved) {
                this.settings = JSON.parse(saved);
            }
        } catch (error) {
            console.error('[CinemaMode] Failed to load settings:', error);
        }
    }

    saveSettings() {
        try {
            localStorage.setItem(CinemaModeConfig.storageKey, JSON.stringify(this.settings));
        } catch (error) {
            console.error('[CinemaMode] Failed to save settings:', error);
        }
    }

    // ============================================
    // MODE ACTIVATION
    // ============================================

    async activate(options = {}) {
        if (this.isActive) return false;
        
        await this.saveCurrentStates();
        
        // Prepare environment
        await this.setupLighting(options);
        await this.setupBlinds(options);
        await this.setupTV(options);
        await this.setupAudio(options);
        
        this.isActive = true;
        this.activatedAt = Date.now();
        
        this.notifyListeners('activated', { timestamp: Date.now() });
        CinemaModeConfig.debug && console.log('[CinemaMode] Activated');
        return true;
    }

    async deactivate() {
        if (!this.isActive) return false;
        
        await this.restoreStates();
        
        this.isActive = false;
        this.deactivatedAt = Date.now();
        
        this.notifyListeners('deactivated', { timestamp: Date.now() });
        CinemaModeConfig.debug && console.log('[CinemaMode] Deactivated');
        return true;
    }

    async saveCurrentStates() {
        const devices = this.deviceRegistry.getAllDevices();
        
        this.savedStates = {
            lights: {},
            tv: null,
            blinds: {},
            audio: null
        };
        
        for (const device of devices) {
            if (device.type === 'light') {
                this.savedStates.lights[device.id] = {
                    state: device.state,
                    brightness: device.brightness
                };
            } else if (device.type === 'tv') {
                this.savedStates.tv = {
                    state: device.state,
                    input: device.input
                };
            } else if (device.type === 'blind') {
                this.savedStates.blinds[device.id] = device.state;
            } else if (device.type === 'speaker') {
                this.savedStates.audio = {
                    state: device.state,
                    volume: device.volume
                };
            }
        }
    }

    async restoreStates() {
        // Restore lights
        for (const [deviceId, state] of Object.entries(this.savedStates.lights)) {
            const device = this.deviceRegistry.getDevice(parseInt(deviceId));
            if (device && device.state !== state.state) {
                await this.deviceController.setDeviceState(parseInt(deviceId), state.state);
                if (state.brightness !== undefined) {
                    await this.deviceController.setDeviceBrightness(parseInt(deviceId), state.brightness);
                }
            }
        }
        
        // Restore TV
        if (this.savedStates.tv) {
            const tv = this.deviceRegistry.getDevice(3);
            if (tv && tv.state !== this.savedStates.tv.state) {
                await this.deviceController.setDeviceState(3, this.savedStates.tv.state);
                if (this.savedStates.tv.input) {
                    await this.deviceController.setTVInput(3, this.savedStates.tv.input);
                }
            }
        }
        
        // Restore blinds
        for (const [deviceId, state] of Object.entries(this.savedStates.blinds)) {
            const blind = this.deviceRegistry.getDevice(parseInt(deviceId));
            if (blind && blind.state !== state) {
                await this.deviceController.setDeviceState(parseInt(deviceId), state);
            }
        }
        
        // Restore audio
        if (this.savedStates.audio) {
            const speaker = this.deviceRegistry.getDevice(6);
            if (speaker) {
                if (speaker.state !== this.savedStates.audio.state) {
                    await this.deviceController.setDeviceState(6, this.savedStates.audio.state);
                }
                if (this.savedStates.audio.volume !== undefined) {
                    await this.deviceController.setVolume(6, this.savedStates.audio.volume);
                }
            }
        }
    }

    async setupLighting(options) {
        const dimLevel = options.dimLevel || CinemaModeConfig.actions.lights.dimLevel;
        const lights = this.deviceRegistry.getAllDevices().filter(d => d.type === 'light');
        
        for (const light of lights) {
            if (light.state) {
                await this.deviceController.setDeviceState(light.id, false);
            }
            if (CinemaModeConfig.actions.lights.dim) {
                await this.deviceController.setDeviceBrightness(light.id, dimLevel);
            }
        }
        
        // Turn on ambient light if available
        const ambientLight = lights.find(l => l.name === 'Ambient Light');
        if (ambientLight) {
            await this.deviceController.setDeviceState(ambientLight.id, true);
            await this.deviceController.setDeviceBrightness(ambientLight.id, dimLevel);
        }
    }

    async setupBlinds(options) {
        if (options.closeBlinds !== false && CinemaModeConfig.actions.blinds.close) {
            const blinds = this.deviceRegistry.getAllDevices().filter(d => d.type === 'blind');
            for (const blind of blinds) {
                if (blind.state) {
                    await this.deviceController.setDeviceState(blind.id, false);
                }
            }
        }
    }

    async setupTV(options) {
        const tvInput = options.tvInput || CinemaModeConfig.actions.tv.input;
        const tv = this.deviceRegistry.getDevice(3);
        
        if (tv) {
            if (!tv.state) {
                await this.deviceController.setDeviceState(3, true);
            }
            await this.deviceController.setTVInput(3, tvInput);
        }
    }

    async setupAudio(options) {
        const volume = options.volume || CinemaModeConfig.actions.audio.volume;
        const speaker = this.deviceRegistry.getDevice(6);
        
        if (speaker && CinemaModeConfig.actions.audio.surround) {
            if (!speaker.state) {
                await this.deviceController.setDeviceState(6, true);
            }
            await this.deviceController.setVolume(6, volume);
        }
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
        return this.settings || CinemaModeConfig.actions;
    }

    // ============================================
    // STATUS
    // ============================================

    getStatus() {
        return {
            isActive: this.isActive,
            activatedAt: this.activatedAt,
            deactivatedAt: this.deactivatedAt
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

let cinemaModeManager = null;

const initCinemaMode = (deviceController, deviceRegistry) => {
    cinemaModeManager = new CinemaModeManager(deviceController, deviceRegistry);
    return cinemaModeManager;
};

// Exports
window.CinemaModeManager = CinemaModeManager;
window.initCinemaMode = initCinemaMode;

export { cinemaModeManager, CinemaModeManager, CinemaModeConfig, initCinemaMode };