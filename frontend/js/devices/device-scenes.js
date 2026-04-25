/**
 * ESTIF HOME ULTIMATE - DEVICE SCENES MODULE
 * Create, manage, and activate scenes for smart home automation
 * Version: 2.0.0
 * Author: Estifanos Yohannis
 */

// ============================================
// DEVICE SCENES CONFIGURATION
// ============================================

const DeviceScenesConfig = {
    // Storage
    storageKey: 'estif_device_scenes',
    maxScenes: 50,
    
    // Scene settings
    defaultTransitionTime: 500, // ms
    maxTransitionTime: 5000,
    
    // Scene types
    sceneTypes: {
        CUSTOM: 'custom',
        MORNING: 'morning',
        EVENING: 'evening',
        NIGHT: 'night',
        AWAY: 'away',
        VACATION: 'vacation',
        CINEMA: 'cinema',
        PARTY: 'party',
        ROMANTIC: 'romantic',
        READING: 'reading'
    },
    
    // Default scenes
    defaultScenes: [
        {
            name: 'Good Morning',
            nameAm: 'እንደምን አደሩ',
            type: 'morning',
            icon: '🌅',
            description: 'Start your day with morning routine'
        },
        {
            name: 'Good Night',
            nameAm: 'መልካም ሌሊት',
            type: 'night',
            icon: '🌙',
            description: 'Prepare for sleep'
        },
        {
            name: 'Movie Time',
            nameAm: 'ፊልም ሰዓት',
            type: 'cinema',
            icon: '🎬',
            description: 'Dim lights for cinema experience'
        },
        {
            name: 'Party Mode',
            nameAm: 'የፓርቲ ሁነታ',
            type: 'party',
            icon: '🎉',
            description: 'Colorful lighting for parties'
        },
        {
            name: 'Away Mode',
            nameAm: 'የሩቅ ሁነታ',
            type: 'away',
            icon: '🚪',
            description: 'Simulate presence while away'
        },
        {
            name: 'Reading Mode',
            nameAm: 'የማንበብ ሁነታ',
            type: 'reading',
            icon: '📚',
            description: 'Optimal lighting for reading'
        }
    ],
    
    // Debug
    debug: false
};

// ============================================
// SCENE CLASS
// ============================================

class Scene {
    constructor(data) {
        this.id = data.id || this.generateId();
        this.name = data.name;
        this.nameAm = data.nameAm || data.name;
        this.type = data.type || DeviceScenesConfig.sceneTypes.CUSTOM;
        this.icon = data.icon || this.getDefaultIcon();
        this.description = data.description || '';
        this.deviceStates = data.deviceStates || {};
        this.transitionTime = data.transitionTime || DeviceScenesConfig.defaultTransitionTime;
        this.createdAt = data.createdAt || Date.now();
        this.updatedAt = Date.now();
        this.isActive = data.isActive || false;
        this.schedule = data.schedule || null;
        this.order = data.order || 0;
        this.color = data.color || this.getRandomColor();
        this.tags = data.tags || [];
        this.metadata = data.metadata || {};
    }

    generateId() {
        return `scene_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    getDefaultIcon() {
        const icons = {
            morning: '🌅',
            night: '🌙',
            cinema: '🎬',
            party: '🎉',
            away: '🚪',
            reading: '📚',
            vacation: '🏖️',
            romantic: '💕',
            custom: '✨'
        };
        return icons[this.type] || '✨';
    }

    getRandomColor() {
        const colors = ['#4361ee', '#06d6a0', '#ef476f', '#ffd166', '#4cc9f0', '#7209b7'];
        return colors[Math.floor(Math.random() * colors.length)];
    }

    addDeviceState(deviceId, state) {
        this.deviceStates[deviceId] = {
            state: state.state !== undefined ? state.state : null,
            autoMode: state.autoMode !== undefined ? state.autoMode : null,
            brightness: state.brightness || null,
            temperature: state.temperature || null,
            color: state.color || null,
            speed: state.speed || null
        };
        this.updatedAt = Date.now();
    }

    removeDeviceState(deviceId) {
        delete this.deviceStates[deviceId];
        this.updatedAt = Date.now();
    }

    getDeviceState(deviceId) {
        return this.deviceStates[deviceId] || null;
    }

    hasDevice(deviceId) {
        return this.deviceStates.hasOwnProperty(deviceId);
    }

    getDeviceCount() {
        return Object.keys(this.deviceStates).length;
    }

    update(data) {
        if (data.name !== undefined) this.name = data.name;
        if (data.nameAm !== undefined) this.nameAm = data.nameAm;
        if (data.icon !== undefined) this.icon = data.icon;
        if (data.description !== undefined) this.description = data.description;
        if (data.transitionTime !== undefined) this.transitionTime = Math.min(data.transitionTime, DeviceScenesConfig.maxTransitionTime);
        if (data.order !== undefined) this.order = data.order;
        if (data.color !== undefined) this.color = data.color;
        if (data.tags !== undefined) this.tags = data.tags;
        if (data.schedule !== undefined) this.schedule = data.schedule;
        this.updatedAt = Date.now();
    }

    captureCurrentStates(devices) {
        this.deviceStates = {};
        for (const device of devices) {
            this.deviceStates[device.id] = {
                state: device.state,
                autoMode: device.autoMode,
                brightness: device.brightness,
                temperature: device.temperature
            };
        }
        this.updatedAt = Date.now();
    }

    toJSON() {
        return {
            id: this.id,
            name: this.name,
            nameAm: this.nameAm,
            type: this.type,
            icon: this.icon,
            description: this.description,
            deviceStates: this.deviceStates,
            transitionTime: this.transitionTime,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
            isActive: this.isActive,
            schedule: this.schedule,
            order: this.order,
            color: this.color,
            tags: this.tags,
            metadata: this.metadata
        };
    }

    getDisplayName(lang = 'en') {
        return lang === 'am' && this.nameAm ? this.nameAm : this.name;
    }
}

// ============================================
// DEVICE SCENES MANAGER
// ============================================

class DeviceScenesManager {
    constructor() {
        this.scenes = new Map();
        this.activeScene = null;
        this.listeners = [];
        this.scheduleTimers = new Map();
        
        this.init();
    }

    init() {
        this.loadScenes();
        this.startScheduledScenes();
        DeviceScenesConfig.debug && console.log('[DeviceScenes] Manager initialized with', this.scenes.size, 'scenes');
    }

    loadScenes() {
        try {
            const saved = localStorage.getItem(DeviceScenesConfig.storageKey);
            if (saved) {
                const scenes = JSON.parse(saved);
                for (const sceneData of scenes) {
                    const scene = new Scene(sceneData);
                    this.scenes.set(scene.id, scene);
                }
                DeviceScenesConfig.debug && console.log('[DeviceScenes] Loaded', this.scenes.size, 'scenes');
            }
        } catch (error) {
            console.error('[DeviceScenes] Failed to load scenes:', error);
        }
        
        // Create default scenes if none exist
        if (this.scenes.size === 0) {
            this.createDefaultScenes();
        }
    }

    saveScenes() {
        try {
            const scenes = Array.from(this.scenes.values()).map(s => s.toJSON());
            localStorage.setItem(DeviceScenesConfig.storageKey, JSON.stringify(scenes));
            DeviceScenesConfig.debug && console.log('[DeviceScenes] Saved', scenes.length, 'scenes');
        } catch (error) {
            console.error('[DeviceScenes] Failed to save scenes:', error);
        }
    }

    createDefaultScenes() {
        for (const sceneData of DeviceScenesConfig.defaultScenes) {
            const scene = new Scene(sceneData);
            this.scenes.set(scene.id, scene);
        }
        this.saveScenes();
        this.notifyListeners('scenes_created', Array.from(this.scenes.values()));
    }

    // ============================================
    // SCENE MANAGEMENT
    // ============================================

    createScene(data) {
        if (this.scenes.size >= DeviceScenesConfig.maxScenes) {
            throw new Error('Maximum number of scenes reached');
        }
        
        const scene = new Scene({
            ...data,
            order: this.scenes.size
        });
        
        this.scenes.set(scene.id, scene);
        this.saveScenes();
        this.notifyListeners('scene_created', scene);
        
        return scene;
    }

    updateScene(sceneId, updates) {
        const scene = this.scenes.get(sceneId);
        if (!scene) return null;
        
        scene.update(updates);
        this.saveScenes();
        this.notifyListeners('scene_updated', scene);
        
        return scene;
    }

    deleteScene(sceneId) {
        const scene = this.scenes.get(sceneId);
        if (!scene) return false;
        
        this.scenes.delete(sceneId);
        this.saveScenes();
        this.notifyListeners('scene_deleted', scene);
        
        return true;
    }

    getScene(sceneId) {
        return this.scenes.get(sceneId) || null;
    }

    getAllScenes() {
        return Array.from(this.scenes.values()).sort((a, b) => a.order - b.order);
    }

    getScenesByType(type) {
        return this.getAllScenes().filter(s => s.type === type);
    }

    getScenesByTag(tag) {
        return this.getAllScenes().filter(s => s.tags.includes(tag));
    }

    // ============================================
    // SCENE ACTIVATION
    // ============================================

    async activateScene(sceneId, deviceController, options = {}) {
        const scene = this.scenes.get(sceneId);
        if (!scene) {
            throw new Error(`Scene ${sceneId} not found`);
        }
        
        const transitionTime = options.transitionTime || scene.transitionTime;
        
        this.notifyListeners('scene_activation_started', { scene, transitionTime });
        
        // Deactivate current active scene
        if (this.activeScene && this.activeScene !== sceneId) {
            await this.deactivateCurrentScene(deviceController);
        }
        
        // Apply device states
        const results = [];
        for (const [deviceId, state] of Object.entries(scene.deviceStates)) {
            try {
                if (state.state !== undefined) {
                    await deviceController.setDeviceState(deviceId, state.state);
                }
                if (state.autoMode !== undefined) {
                    await deviceController.setAutoMode(deviceId, state.autoMode);
                }
                results.push({ deviceId, success: true });
            } catch (error) {
                results.push({ deviceId, success: false, error: error.message });
            }
        }
        
        // Wait for transition
        await this.delay(transitionTime);
        
        this.activeScene = sceneId;
        scene.isActive = true;
        this.saveScenes();
        
        this.notifyListeners('scene_activated', { scene, results });
        
        return { success: true, results };
    }

    async deactivateCurrentScene(deviceController) {
        if (!this.activeScene) return;
        
        const scene = this.scenes.get(this.activeScene);
        if (!scene) return;
        
        scene.isActive = false;
        this.saveScenes();
        
        this.notifyListeners('scene_deactivated', { scene });
        this.activeScene = null;
    }

    async captureScene(sceneId, devices) {
        const scene = this.scenes.get(sceneId);
        if (!scene) return false;
        
        scene.captureCurrentStates(devices);
        this.saveScenes();
        this.notifyListeners('scene_captured', scene);
        
        return true;
    }

    // ============================================
    // SCENE SCHEDULING
    // ============================================

    scheduleScene(sceneId, schedule) {
        const scene = this.scenes.get(sceneId);
        if (!scene) return false;
        
        scene.schedule = schedule;
        this.saveScenes();
        
        // Clear existing timer
        if (this.scheduleTimers.has(sceneId)) {
            clearTimeout(this.scheduleTimers.get(sceneId));
            this.scheduleTimers.delete(sceneId);
        }
        
        // Set up new schedule
        this.setupSceneSchedule(scene);
        
        return true;
    }

    setupSceneSchedule(scene) {
        if (!scene.schedule) return;
        
        const { time, days, enabled } = scene.schedule;
        if (!enabled) return;
        
        const now = new Date();
        const scheduleTime = this.parseTime(time);
        const scheduledDate = new Date(now);
        scheduledDate.setHours(scheduleTime.hours, scheduleTime.minutes, 0, 0);
        
        if (scheduledDate <= now) {
            scheduledDate.setDate(scheduledDate.getDate() + 1);
        }
        
        const delay = scheduledDate.getTime() - now.getTime();
        
        const timer = setTimeout(() => {
            this.checkAndActivateScheduledScene(scene);
        }, delay);
        
        this.scheduleTimers.set(scene.id, timer);
    }

    parseTime(timeString) {
        const [hours, minutes] = timeString.split(':');
        return { hours: parseInt(hours), minutes: parseInt(minutes) };
    }

    checkAndActivateScheduledScene(scene) {
        const now = new Date();
        const currentDay = now.getDay();
        
        // Check if scene should run today
        if (scene.schedule.days && !scene.schedule.days.includes(currentDay)) {
            // Reschedule for next day
            this.setupSceneSchedule(scene);
            return;
        }
        
        // Activate the scene (requires deviceController)
        this.notifyListeners('scheduled_scene_ready', scene);
    }

    startScheduledScenes() {
        for (const scene of this.scenes.values()) {
            if (scene.schedule && scene.schedule.enabled) {
                this.setupSceneSchedule(scene);
            }
        }
    }

    stopScheduledScenes() {
        for (const timer of this.scheduleTimers.values()) {
            clearTimeout(timer);
        }
        this.scheduleTimers.clear();
    }

    // ============================================
    // SCENE PREVIEW
    // ============================================

    async previewScene(sceneId, deviceController) {
        const scene = this.scenes.get(sceneId);
        if (!scene) return false;
        
        // Save current states
        const savedStates = {};
        for (const [deviceId] of Object.entries(scene.deviceStates)) {
            const device = deviceController.getDevice(deviceId);
            if (device) {
                savedStates[deviceId] = {
                    state: device.state,
                    autoMode: device.autoMode
                };
            }
        }
        
        // Activate scene temporarily
        await this.activateScene(sceneId, deviceController);
        
        // Revert after 5 seconds
        setTimeout(async () => {
            for (const [deviceId, state] of Object.entries(savedStates)) {
                await deviceController.setDeviceState(deviceId, state.state);
                await deviceController.setAutoMode(deviceId, state.autoMode);
            }
        }, 5000);
        
        return true;
    }

    // ============================================
    // SCENE UTILITIES
    // ============================================

    duplicateScene(sceneId, newName) {
        const original = this.scenes.get(sceneId);
        if (!original) return null;
        
        const newScene = new Scene({
            ...original.toJSON(),
            id: undefined,
            name: newName || `${original.name} (Copy)`,
            nameAm: original.nameAm ? `${original.nameAm} (ቅጂ)` : undefined,
            createdAt: Date.now(),
            order: this.scenes.size
        });
        
        this.scenes.set(newScene.id, newScene);
        this.saveScenes();
        this.notifyListeners('scene_created', newScene);
        
        return newScene;
    }

    exportScenes() {
        return {
            version: '1.0',
            exportedAt: Date.now(),
            scenes: this.getAllScenes().map(s => s.toJSON())
        };
    }

    importScenes(data) {
        try {
            for (const sceneData of data.scenes) {
                if (!this.scenes.has(sceneData.id)) {
                    const scene = new Scene(sceneData);
                    this.scenes.set(scene.id, scene);
                }
            }
            this.saveScenes();
            this.notifyListeners('scenes_imported', this.getAllScenes());
            return true;
        } catch (error) {
            console.error('[DeviceScenes] Import failed:', error);
            return false;
        }
    }

    reset() {
        this.scenes.clear();
        this.createDefaultScenes();
        this.saveScenes();
        this.notifyListeners('scenes_reset', this.getAllScenes());
    }

    getSceneStats() {
        return {
            total: this.scenes.size,
            byType: {},
            totalDevicesInScenes: Array.from(this.scenes.values()).reduce((sum, s) => sum + s.getDeviceCount(), 0),
            activeScene: this.activeScene
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
// DEVICE SCENES UI COMPONENT
// ============================================

class DeviceScenesUI {
    constructor(manager) {
        this.manager = manager;
        this.init();
    }

    init() {
        this.createUI();
        this.bindEvents();
        this.render();
        DeviceScenesConfig.debug && console.log('[DeviceScenesUI] Initialized');
    }

    createUI() {
        const container = document.getElementById('device-scenes-container');
        if (!container) return;

        container.innerHTML = `
            <div class="device-scenes-panel">
                <div class="scenes-header">
                    <i class="fas fa-magic"></i>
                    <h3>Smart Scenes</h3>
                    <button id="create-scene-btn" class="btn btn-sm btn-primary">
                        <i class="fas fa-plus"></i> Create Scene
                    </button>
                </div>
                
                <div class="scenes-stats" id="scenes-stats"></div>
                
                <div class="scenes-search">
                    <input type="text" id="scene-search" placeholder="Search scenes..." class="search-input">
                </div>
                
                <div class="scenes-grid" id="scenes-grid"></div>
            </div>
        `;

        this.cacheElements();
        this.bindUIEvents();
    }

    cacheElements() {
        this.statsContainer = document.getElementById('scenes-stats');
        this.scenesGrid = document.getElementById('scenes-grid');
        this.searchInput = document.getElementById('scene-search');
        this.createBtn = document.getElementById('create-scene-btn');
    }

    bindUIEvents() {
        if (this.createBtn) {
            this.createBtn.addEventListener('click', () => this.showCreateSceneDialog());
        }
        
        if (this.searchInput) {
            this.searchInput.addEventListener('input', () => this.render());
        }
    }

    bindEvents() {
        this.manager.addEventListener('scene_created', () => this.render());
        this.manager.addEventListener('scene_updated', () => this.render());
        this.manager.addEventListener('scene_deleted', () => this.render());
        this.manager.addEventListener('scene_activated', () => this.render());
    }

    render() {
        this.renderStats();
        this.renderScenes();
    }

    renderStats() {
        const stats = this.manager.getSceneStats();
        
        this.statsContainer.innerHTML = `
            <div class="stat-card">
                <div class="stat-value">${stats.total}</div>
                <div class="stat-label">Total Scenes</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${stats.totalDevicesInScenes}</div>
                <div class="stat-label">Devices Controlled</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${stats.activeScene ? 'Active' : 'None'}</div>
                <div class="stat-label">Active Scene</div>
            </div>
        `;
    }

    renderScenes() {
        let scenes = this.manager.getAllScenes();
        
        // Apply search
        const searchTerm = this.searchInput?.value.toLowerCase();
        if (searchTerm) {
            scenes = scenes.filter(s => 
                s.name.toLowerCase().includes(searchTerm) ||
                (s.nameAm && s.nameAm.toLowerCase().includes(searchTerm))
            );
        }
        
        if (scenes.length === 0) {
            this.scenesGrid.innerHTML = '<p class="no-scenes">No scenes found. Create a scene to get started.</p>';
            return;
        }
        
        this.scenesGrid.innerHTML = scenes.map(scene => `
            <div class="scene-card ${scene.isActive ? 'active' : ''}" data-scene-id="${scene.id}" style="border-top-color: ${scene.color}">
                <div class="scene-header">
                    <div class="scene-icon">${scene.icon}</div>
                    <div class="scene-info">
                        <div class="scene-name">${this.escapeHtml(scene.getDisplayName())}</div>
                        <div class="scene-description">${this.escapeHtml(scene.description)}</div>
                    </div>
                </div>
                <div class="scene-stats">
                    <span class="scene-device-count">${scene.getDeviceCount()} devices</span>
                </div>
                <div class="scene-actions">
                    <button class="scene-action activate-btn" data-scene-id="${scene.id}" title="Activate">
                        <i class="fas fa-play"></i> Activate
                    </button>
                    <button class="scene-action capture-btn" data-scene-id="${scene.id}" title="Capture Current State">
                        <i class="fas fa-camera"></i>
                    </button>
                    <button class="scene-action edit-btn" data-scene-id="${scene.id}" title="Edit">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="scene-action delete-btn" data-scene-id="${scene.id}" title="Delete">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `).join('');
        
        // Bind actions
        document.querySelectorAll('.activate-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const sceneId = btn.dataset.sceneId;
                await this.activateScene(sceneId);
            });
        });
        
        document.querySelectorAll('.capture-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const sceneId = btn.dataset.sceneId;
                await this.captureScene(sceneId);
            });
        });
        
        document.querySelectorAll('.edit-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const sceneId = btn.dataset.sceneId;
                this.editScene(sceneId);
            });
        });
        
        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const sceneId = btn.dataset.sceneId;
                this.deleteScene(sceneId);
            });
        });
    }

    async activateScene(sceneId) {
        const deviceController = window.deviceController;
        if (!deviceController) {
            this.showToast('Device controller not available', 'error');
            return;
        }
        
        try {
            await this.manager.activateScene(sceneId, deviceController);
            this.showToast('Scene activated successfully!', 'success');
        } catch (error) {
            this.showToast(`Failed to activate scene: ${error.message}`, 'error');
        }
    }

    async captureScene(sceneId) {
        const deviceController = window.deviceController;
        if (!deviceController) {
            this.showToast('Device controller not available', 'error');
            return;
        }
        
        const devices = deviceController.getAllDevices();
        const success = await this.manager.captureScene(sceneId, devices);
        
        if (success) {
            this.showToast('Scene captured successfully!', 'success');
            this.render();
        } else {
            this.showToast('Failed to capture scene', 'error');
        }
    }

    showCreateSceneDialog() {
        const name = prompt('Enter scene name:');
        if (!name) return;
        
        const description = prompt('Enter scene description (optional):');
        
        const scene = this.manager.createScene({
            name,
            description: description || ''
        });
        
        // Ask to capture current states
        if (confirm('Would you like to capture current device states for this scene?')) {
            const deviceController = window.deviceController;
            if (deviceController) {
                const devices = deviceController.getAllDevices();
                this.manager.captureScene(scene.id, devices);
            }
        }
        
        this.showToast('Scene created successfully!', 'success');
    }

    editScene(sceneId) {
        const scene = this.manager.getScene(sceneId);
        if (!scene) return;
        
        const newName = prompt('Enter new scene name:', scene.name);
        if (newName && newName !== scene.name) {
            this.manager.updateScene(sceneId, { name: newName });
        }
        
        const newDescription = prompt('Enter new description:', scene.description);
        if (newDescription !== null && newDescription !== scene.description) {
            this.manager.updateScene(sceneId, { description: newDescription });
        }
    }

    deleteScene(sceneId) {
        if (confirm('Are you sure you want to delete this scene?')) {
            this.manager.deleteScene(sceneId);
            this.showToast('Scene deleted successfully!', 'success');
        }
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

const deviceScenesStyles = `
    .device-scenes-panel {
        background: var(--bg-card);
        border-radius: 12px;
        padding: 20px;
        border: 1px solid var(--border-color);
    }
    
    .scenes-header {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 20px;
        padding-bottom: 12px;
        border-bottom: 1px solid var(--border-color);
    }
    
    .scenes-header i {
        font-size: 20px;
        color: var(--primary);
    }
    
    .scenes-header h3 {
        flex: 1;
        margin: 0;
    }
    
    .scenes-stats {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
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
    
    .scenes-search {
        margin-bottom: 16px;
    }
    
    .search-input {
        width: 100%;
        padding: 10px 12px;
        border: 1px solid var(--border-color);
        border-radius: 8px;
        background: var(--bg-primary);
        color: var(--text-primary);
    }
    
    .scenes-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
        gap: 16px;
        max-height: 500px;
        overflow-y: auto;
    }
    
    .scene-card {
        background: var(--bg-secondary);
        border-radius: 10px;
        padding: 16px;
        border-top: 3px solid;
        transition: all 0.2s ease;
        cursor: pointer;
    }
    
    .scene-card:hover {
        transform: translateY(-2px);
        box-shadow: var(--shadow-md);
    }
    
    .scene-card.active {
        background: linear-gradient(135deg, var(--bg-secondary), var(--primary-soft));
    }
    
    .scene-header {
        display: flex;
        gap: 12px;
        margin-bottom: 12px;
    }
    
    .scene-icon {
        font-size: 32px;
    }
    
    .scene-info {
        flex: 1;
    }
    
    .scene-name {
        font-weight: 500;
        margin-bottom: 4px;
    }
    
    .scene-description {
        font-size: 11px;
        color: var(--text-muted);
    }
    
    .scene-stats {
        margin-bottom: 12px;
        padding-bottom: 12px;
        border-bottom: 1px solid var(--border-light);
    }
    
    .scene-device-count {
        font-size: 11px;
        color: var(--text-secondary);
    }
    
    .scene-actions {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
    }
    
    .scene-action {
        flex: 1;
        background: var(--bg-tertiary);
        border: none;
        border-radius: 6px;
        padding: 6px 10px;
        cursor: pointer;
        transition: all 0.2s ease;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 4px;
        font-size: 12px;
    }
    
    .scene-action:hover {
        background: var(--primary);
        color: white;
    }
    
    .scene-action.delete-btn:hover {
        background: var(--danger);
    }
    
    .no-scenes {
        text-align: center;
        color: var(--text-muted);
        padding: 40px;
        grid-column: 1 / -1;
    }
`;

// Inject styles
if (typeof document !== 'undefined') {
    const styleSheet = document.createElement('style');
    styleSheet.textContent = deviceScenesStyles;
    document.head.appendChild(styleSheet);
}

// ============================================
// CREATE SINGLETON INSTANCES
// ============================================

const deviceScenes = new DeviceScenesManager();
const deviceScenesUI = new DeviceScenesUI(deviceScenes);

// ============================================
// EXPORTS
// ============================================

// Expose to window
window.deviceScenes = deviceScenes;
window.deviceScenesUI = deviceScenesUI;
window.DeviceScenesManager = DeviceScenesManager;
window.DeviceScenesConfig = DeviceScenesConfig;

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        deviceScenes,
        deviceScenesUI,
        DeviceScenesManager,
        DeviceScenesConfig
    };
}

// ES modules export
export {
    deviceScenes,
    deviceScenesUI,
    DeviceScenesManager,
    DeviceScenesConfig
};