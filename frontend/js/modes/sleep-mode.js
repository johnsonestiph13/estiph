/**
 * ESTIF HOME ULTIMATE - SLEEP MODE MODULE
 * Create optimal sleeping environment with gradual transitions
 * Version: 2.0.0
 * Author: Estifanos Yohannis
 */

// ============================================
// SLEEP MODE CONFIGURATION
// ============================================

const SleepModeConfig = {
    // Default settings
    defaultBedtime: "22:00",
    defaultWakeTime: "06:30",
    defaultWindDownMinutes: 30,
    
    // Device actions
    actions: {
        lights: {
            off: true,
            gradualDim: true,
            dimDuration: 300000 // 5 minutes
        },
        blinds: {
            close: true
        },
        ac: {
            setTemperature: 20,
            fanSpeed: 'low'
        },
        music: {
            playSleepSounds: true,
            volume: 20,
            fadeOut: true
        }
    },
    
    // Sleep sounds
    sleepSounds: ['white_noise', 'rain', 'ocean_waves', 'forest', 'meditation'],
    
    // Storage
    storageKey: 'estif_sleep_mode_settings',
    
    // Debug
    debug: false
};

// ============================================
// SLEEP MODE MANAGER
// ============================================

class SleepModeManager {
    constructor(deviceController, deviceRegistry) {
        this.deviceController = deviceController;
        this.deviceRegistry = deviceRegistry;
        this.isActive = false;
        this.isScheduled = false;
        this.windDownTimer = null;
        this.wakeUpTimer = null;
        this.savedStates = {};
        this.listeners = [];
        
        this.init();
    }

    init() {
        this.loadSettings();
        this.setupSchedule();
        SleepModeConfig.debug && console.log('[SleepMode] Manager initialized');
    }

    loadSettings() {
        try {
            const saved = localStorage.getItem(SleepModeConfig.storageKey);
            if (saved) {
                this.settings = JSON.parse(saved);
            }
        } catch (error) {
            console.error('[SleepMode] Failed to load settings:', error);
        }
    }

    saveSettings() {
        try {
            localStorage.setItem(SleepModeConfig.storageKey, JSON.stringify(this.settings));
        } catch (error) {
            console.error('[SleepMode] Failed to save settings:', error);
        }
    }

    // ============================================
    // MODE ACTIVATION
    // ============================================

    async activate() {
        if (this.isActive) return false;
        
        await this.saveCurrentStates();
        
        // Start wind-down period
        await this.startWindDown();
        
        this.isActive = true;
        this.activatedAt = Date.now();
        
        this.recordHistory('activated');
        this.notifyListeners('activated', { timestamp: Date.now() });
        
        SleepModeConfig.debug && console.log('[SleepMode] Activated');
        return true;
    }

    async deactivate() {
        if (!this.isActive) return false;
        
        this.cancelWindDown();
        await this.restoreStates();
        
        this.isActive = false;
        this.deactivatedAt = Date.now();
        
        this.recordHistory('deactivated');
        this.notifyListeners('deactivated', { timestamp: Date.now() });
        
        SleepModeConfig.debug && console.log('[SleepMode] Deactivated');
        return true;
    }

    async startWindDown() {
        const duration = this.settings?.windDownMinutes || SleepModeConfig.defaultWindDownMinutes;
        
        // Gradual actions
        await this.gradualDimLights(duration);
        await this.closeBlinds();
        await this.setSleepTemperature();
        await this.playSleepSounds();
        
        // Final actions after wind-down
        this.windDownTimer = setTimeout(async () => {
            await this.turnOffLights();
            await this.fadeOutMusic();
        }, duration * 60 * 1000);
    }

    async gradualDimLights(duration) {
        const lights = this.deviceRegistry.getAllDevices().filter(d => d.type === 'light');
        const interval = (duration * 60 * 1000) / 10; // 10 steps
        
        for (let step = 0; step < 10; step++) {
            const brightness = 100 - (step * 10);
            for (const light of lights) {
                if (light.state && light.brightness) {
                    await this.deviceController.setDeviceBrightness(light.id, brightness);
                }
            }
            await this.delay(interval);
        }
    }

    async turnOffLights() {
        const lights = this.deviceRegistry.getAllDevices().filter(d => d.type === 'light');
        
        for (const light of lights) {
            if (light.state) {
                await this.deviceController.setDeviceState(light.id, false);
            }
        }
    }

    async closeBlinds() {
        const blinds = this.deviceRegistry.getAllDevices().filter(d => d.type === 'blind');
        
        for (const blind of blinds) {
            if (blind.state) {
                await this.deviceController.setDeviceState(blind.id, false);
            }
        }
    }

    async setSleepTemperature() {
        const ac = this.deviceRegistry.getDevice(2);
        if (ac && SleepModeConfig.actions.ac.setTemperature) {
            await this.deviceController.setTemperature(ac.id, SleepModeConfig.actions.ac.setTemperature);
            await this.deviceController.setFanSpeed(ac.id, SleepModeConfig.actions.ac.fanSpeed);
        }
    }

    async playSleepSounds() {
        const speaker = this.deviceRegistry.getDevice(6);
        if (speaker && SleepModeConfig.actions.music.playSleepSounds) {
            if (!speaker.state) {
                await this.deviceController.setDeviceState(6, true);
            }
            await this.deviceController.setVolume(6, SleepModeConfig.actions.music.volume);
            const sound = this.settings?.sleepSound || SleepModeConfig.sleepSounds[0];
            await this.deviceController.playMusic(6, sound);
        }
    }

    async fadeOutMusic() {
        const speaker = this.deviceRegistry.getDevice(6);
        if (speaker && SleepModeConfig.actions.music.fadeOut) {
            const steps = 10;
            const currentVolume = speaker.volume || SleepModeConfig.actions.music.volume;
            
            for (let i = 0; i < steps; i++) {
                const volume = currentVolume - (currentVolume / steps);
                await this.deviceController.setVolume(6, volume);
                await this.delay(1000);
            }
            
            await this.deviceController.setDeviceState(6, false);
        }
    }

    async saveCurrentStates() {
        const devices = this.deviceRegistry.getAllDevices();
        
        this.savedStates = {
            lights: {},
            blinds: {},
            ac: null,
            music: null
        };
        
        for (const device of devices) {
            if (device.type === 'light') {
                this.savedStates.lights[device.id] = {
                    state: device.state,
                    brightness: device.brightness
                };
            } else if (device.type === 'blind') {
                this.savedStates.blinds[device.id] = device.state;
            } else if (device.type === 'ac') {
                this.savedStates.ac = {
                    state: device.state,
                    temperature: device.temperature,
                    fanSpeed: device.fanSpeed
                };
            } else if (device.type === 'speaker') {
                this.savedStates.music = {
                    state: device.state,
                    volume: device.volume,
                    playing: device.playing
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
        
        // Restore blinds
        for (const [deviceId, state] of Object.entries(this.savedStates.blinds)) {
            const blind = this.deviceRegistry.getDevice(parseInt(deviceId));
            if (blind && blind.state !== state) {
                await this.deviceController.setDeviceState(parseInt(deviceId), state);
            }
        }
        
        // Restore AC
        if (this.savedStates.ac) {
            const ac = this.deviceRegistry.getDevice(2);
            if (ac) {
                if (ac.state !== this.savedStates.ac.state) {
                    await this.deviceController.setDeviceState(2, this.savedStates.ac.state);
                }
                if (this.savedStates.ac.temperature) {
                    await this.deviceController.setTemperature(2, this.savedStates.ac.temperature);
                }
            }
        }
        
        // Restore music
        if (this.savedStates.music) {
            const speaker = this.deviceRegistry.getDevice(6);
            if (speaker && speaker.state !== this.savedStates.music.state) {
                await this.deviceController.setDeviceState(6, this.savedStates.music.state);
            }
        }
    }

    // ============================================
    // WAKE UP FUNCTIONALITY
    // ============================================

    async wakeUp() {
        await this.deactivate();
        await this.gradualWakeUp();
    }

    async gradualWakeUp() {
        // Gradually increase lights
        await this.gradualIncreaseLights();
        
        // Open blinds
        await this.openBlinds();
        
        // Restore normal temperature
        await this.restoreTemperature();
        
        // Play morning music
        await this.playMorningMusic();
        
        this.recordHistory('woke_up');
        this.notifyListeners('woke_up', { timestamp: Date.now() });
    }

    async gradualIncreaseLights() {
        const lights = this.deviceRegistry.getAllDevices().filter(d => d.type === 'light');
        const steps = 10;
        
        for (let step = 0; step < steps; step++) {
            const brightness = step * 10;
            for (const light of lights) {
                if (light.state) {
                    await this.deviceController.setDeviceBrightness(light.id, brightness);
                }
            }
            await this.delay(30000); // 30 seconds per step = 5 minutes total
        }
    }

    async openBlinds() {
        const blinds = this.deviceRegistry.getAllDevices().filter(d => d.type === 'blind');
        
        for (const blind of blinds) {
            if (!blind.state) {
                await this.deviceController.setDeviceState(blind.id, true);
            }
        }
    }

    async restoreTemperature() {
        const ac = this.deviceRegistry.getDevice(2);
        if (ac && this.savedStates.ac) {
            await this.deviceController.setTemperature(2, this.savedStates.ac.temperature);
        }
    }

    async playMorningMusic() {
        const speaker = this.deviceRegistry.getDevice(6);
        if (speaker) {
            await this.deviceController.setVolume(6, 30);
            await this.deviceController.playMusic(6, 'morning_playlist');
        }
    }

    // ============================================
    // SCHEDULING
    // ============================================

    setupSchedule() {
        const bedtime = this.settings?.bedtime || SleepModeConfig.defaultBedtime;
        const wakeTime = this.settings?.wakeTime || SleepModeConfig.defaultWakeTime;
        
        this.scheduleBedtime(bedtime);
        this.scheduleWakeTime(wakeTime);
    }

    scheduleBedtime(time) {
        const [hours, minutes] = time.split(':');
        const now = new Date();
        const bedtime = new Date();
        bedtime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
        
        if (bedtime <= now) {
            bedtime.setDate(bedtime.getDate() + 1);
        }
        
        const delay = bedtime.getTime() - now.getTime();
        
        setTimeout(() => {
            this.activate();
        }, delay);
        
        this.isScheduled = true;
    }

    scheduleWakeTime(time) {
        const [hours, minutes] = time.split(':');
        const now = new Date();
        const wakeTime = new Date();
        wakeTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
        
        if (wakeTime <= now) {
            wakeTime.setDate(wakeTime.getDate() + 1);
        }
        
        const delay = wakeTime.getTime() - now.getTime();
        
        this.wakeUpTimer = setTimeout(() => {
            this.wakeUp();
        }, delay);
    }

    // ============================================
    // UTILITY
    // ============================================

    cancelWindDown() {
        if (this.windDownTimer) {
            clearTimeout(this.windDownTimer);
            this.windDownTimer = null;
        }
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    recordHistory(action, data = {}) {
        const history = this.getHistory();
        history.unshift({ action, data, timestamp: Date.now() });
        localStorage.setItem('estif_sleep_mode_history', JSON.stringify(history.slice(0, 100)));
    }

    getHistory() {
        try {
            return JSON.parse(localStorage.getItem('estif_sleep_mode_history') || '[]');
        } catch {
            return [];
        }
    }

    // ============================================
    // SETTINGS    // ============================================

    updateSettings(updates) {
        this.settings = { ...this.settings, ...updates };
        this.saveSettings();
        this.setupSchedule();
        this.notifyListeners('settings_updated', this.settings);
    }

    getSettings() {
        return this.settings || SleepModeConfig;
    }

    getStatus() {
        return {
            isActive: this.isActive,
            isScheduled: this.isScheduled,
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

let sleepModeManager = null;

const initSleepMode = (deviceController, deviceRegistry) => {
    sleepModeManager = new SleepModeManager(deviceController, deviceRegistry);
    return sleepModeManager;
};

// Exports
window.SleepModeManager = SleepModeManager;
window.initSleepMode = initSleepMode;

export { sleepModeManager, SleepModeManager, SleepModeConfig, initSleepMode };