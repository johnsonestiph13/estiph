/**
 * ESTIF HOME ULTIMATE - PARTY MODE MODULE
 * Create vibrant party atmosphere with dynamic lighting and music
 * Version: 2.0.0
 * Author: Estifanos Yohannis
 */

// ============================================
// PARTY MODE CONFIGURATION
// ============================================

const PartyModeConfig = {
    // Default settings
    defaultMusicVolume: 60,
    defaultLightingEffect: 'color_cycle',
    defaultLightingSpeed: 'medium',
    
    // Lighting effects
    lightingEffects: {
        color_cycle: { name: 'Color Cycle', colors: ['red', 'green', 'blue', 'yellow', 'purple'] },
        disco: { name: 'Disco', colors: ['red', 'blue', 'green'], interval: 500 },
        pulse: { name: 'Pulse', colors: ['white'], interval: 1000 },
        rainbow: { name: 'Rainbow', colors: ['rainbow'], interval: 2000 },
        strobe: { name: 'Strobe', colors: ['white'], interval: 100 }
    },
    
    // Music settings
    music: {
        autoPlay: true,
        playlist: ['party_mix_1', 'party_mix_2', 'dance_hits'],
        volume: 60
    },
    
    // Storage
    storageKey: 'estif_party_mode_settings',
    
    // Debug
    debug: false
};

// ============================================
// PARTY MODE MANAGER
// ============================================

class PartyModeManager {
    constructor(deviceController, deviceRegistry) {
        this.deviceController = deviceController;
        this.deviceRegistry = deviceRegistry;
        this.isActive = false;
        this.effectInterval = null;
        this.currentEffect = null;
        this.savedStates = {};
        this.listeners = [];
        
        this.init();
    }

    init() {
        this.loadSettings();
        PartyModeConfig.debug && console.log('[PartyMode] Manager initialized');
    }

    loadSettings() {
        try {
            const saved = localStorage.getItem(PartyModeConfig.storageKey);
            if (saved) {
                this.settings = JSON.parse(saved);
            }
        } catch (error) {
            console.error('[PartyMode] Failed to load settings:', error);
        }
    }

    saveSettings() {
        try {
            localStorage.setItem(PartyModeConfig.storageKey, JSON.stringify(this.settings));
        } catch (error) {
            console.error('[PartyMode] Failed to save settings:', error);
        }
    }

    // ============================================
    // MODE ACTIVATION
    // ============================================

    async activate(options = {}) {
        if (this.isActive) return false;
        
        await this.saveCurrentStates();
        
        // Setup environment
        await this.setupLighting(options);
        await this.setupMusic(options);
        await this.setupDecorations(options);
        
        // Start lighting effects
        this.startLightingEffect(options.effect || this.settings?.lightingEffect || PartyModeConfig.defaultLightingEffect);
        
        this.isActive = true;
        this.activatedAt = Date.now();
        
        this.notifyListeners('activated', { timestamp: Date.now() });
        PartyModeConfig.debug && console.log('[PartyMode] Activated');
        return true;
    }

    async deactivate() {
        if (!this.isActive) return false;
        
        this.stopLightingEffect();
        await this.restoreStates();
        
        this.isActive = false;
        this.deactivatedAt = Date.now();
        
        this.notifyListeners('deactivated', { timestamp: Date.now() });
        PartyModeConfig.debug && console.log('[PartyMode] Deactivated');
        return true;
    }

    async saveCurrentStates() {
        const devices = this.deviceRegistry.getAllDevices();
        
        this.savedStates = {
            lights: {},
            music: null,
            decorative: {}
        };
        
        for (const device of devices) {
            if (device.type === 'light') {
                this.savedStates.lights[device.id] = {
                    state: device.state,
                    brightness: device.brightness,
                    color: device.color
                };
            } else if (device.type === 'speaker') {
                this.savedStates.music = {
                    state: device.state,
                    volume: device.volume,
                    playing: device.playing
                };
            } else if (device.type === 'decorative_light') {
                this.savedStates.decorative[device.id] = device.state;
            }
        }
    }

    async restoreStates() {
        // Restore lights
        for (const [deviceId, state] of Object.entries(this.savedStates.lights)) {
            const device = this.deviceRegistry.getDevice(parseInt(deviceId));
            if (device && device.state !== state.state) {
                await this.deviceController.setDeviceState(parseInt(deviceId), state.state);
            }
        }
        
        // Restore music
        if (this.savedStates.music) {
            const speaker = this.deviceRegistry.getDevice(6);
            if (speaker) {
                if (speaker.state !== this.savedStates.music.state) {
                    await this.deviceController.setDeviceState(6, this.savedStates.music.state);
                }
                if (this.savedStates.music.volume !== undefined) {
                    await this.deviceController.setVolume(6, this.savedStates.music.volume);
                }
            }
        }
    }

    async setupLighting(options) {
        const lights = this.deviceRegistry.getAllDevices().filter(d => d.type === 'light');
        const effect = options.effect || this.settings?.lightingEffect || PartyModeConfig.defaultLightingEffect;
        
        // Turn on all lights
        for (const light of lights) {
            if (!light.state) {
                await this.deviceController.setDeviceState(light.id, true);
            }
            // Set full brightness
            await this.deviceController.setDeviceBrightness(light.id, 100);
        }
        
        this.currentEffect = effect;
    }

    startLightingEffect(effectName) {
        const effect = PartyModeConfig.lightingEffects[effectName];
        if (!effect) return;
        
        this.stopLightingEffect();
        
        this.effectInterval = setInterval(() => {
            this.applyLightingEffect(effect);
        }, effect.interval || 1000);
        
        this.currentEffect = effectName;
        this.notifyListeners('effect_changed', { effect: effectName });
    }

    stopLightingEffect() {
        if (this.effectInterval) {
            clearInterval(this.effectInterval);
            this.effectInterval = null;
        }
    }

    async applyLightingEffect(effect) {
        const lights = this.deviceRegistry.getAllDevices().filter(d => d.type === 'light');
        
        for (let i = 0; i < lights.length; i++) {
            const color = effect.colors[i % effect.colors.length];
            if (color === 'rainbow') {
                const hue = (Date.now() / 100) % 360;
                await this.deviceController.setDeviceColor(lights[i].id, `hsl(${hue}, 100%, 50%)`);
            } else {
                await this.deviceController.setDeviceColor(lights[i].id, color);
            }
        }
    }

    async setupMusic(options) {
        const volume = options.volume || PartyModeConfig.music.volume;
        const speaker = this.deviceRegistry.getDevice(6);
        
        if (speaker && PartyModeConfig.music.autoPlay) {
            if (!speaker.state) {
                await this.deviceController.setDeviceState(6, true);
            }
            await this.deviceController.setVolume(6, volume);
            await this.deviceController.playMusic(6, PartyModeConfig.music.playlist[0]);
        }
    }

    async setupDecorations(options) {
        const decorativeLights = this.deviceRegistry.getAllDevices().filter(d => d.type === 'decorative_light');
        
        for (const light of decorativeLights) {
            if (!light.state) {
                await this.deviceController.setDeviceState(light.id, true);
            }
        }
    }

    // ============================================
    // EFFECT CONTROL
    // ============================================

    changeEffect(effectName) {
        if (!this.isActive) return;
        
        this.startLightingEffect(effectName);
        this.notifyListeners('effect_changed', { effect: effectName });
    }

    setMusicVolume(volume) {
        const speaker = this.deviceRegistry.getDevice(6);
        if (speaker && this.isActive) {
            this.deviceController.setVolume(6, volume);
        }
    }

    nextTrack() {
        const speaker = this.deviceRegistry.getDevice(6);
        if (speaker && this.isActive) {
            this.deviceController.nextTrack(6);
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
        return this.settings || PartyModeConfig;
    }

    getAvailableEffects() {
        return Object.keys(PartyModeConfig.lightingEffects);
    }

    // ============================================
    // STATUS
    // ============================================

    getStatus() {
        return {
            isActive: this.isActive,
            currentEffect: this.currentEffect,
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

let partyModeManager = null;

const initPartyMode = (deviceController, deviceRegistry) => {
    partyModeManager = new PartyModeManager(deviceController, deviceRegistry);
    return partyModeManager;
};

// Exports
window.PartyModeManager = PartyModeManager;
window.initPartyMode = initPartyMode;

export { partyModeManager, PartyModeManager, PartyModeConfig, initPartyMode };