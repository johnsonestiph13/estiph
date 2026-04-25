/**
 * ESTIF HOME ULTIMATE - DEVICE GROUPS MODULE
 * Group devices for batch control, scenes, and automation
 * Version: 2.0.0
 * Author: Estifanos Yohannis
 */

// ============================================
// DEVICE GROUPS CONFIGURATION
// ============================================

const DeviceGroupsConfig = {
    // Storage
    storageKey: 'estif_device_groups',
    maxGroups: 50,
    
    // Group types
    groupTypes: {
        ROOM: 'room',
        CUSTOM: 'custom',
        SCENE: 'scene',
        AUTOMATION: 'automation'
    },
    
    // Scene settings
    maxScenes: 20,
    sceneTransitionTime: 500, // ms
    
    // Default icons
    defaultIcons: {
        room: '🏠',
        custom: '📁',
        scene: '🎬',
        automation: '🤖'
    },
    
    // Debug
    debug: false
};

// ============================================
// DEVICE GROUP CLASS
// ============================================

class DeviceGroup {
    constructor(data) {
        this.id = data.id || this.generateId();
        this.name = data.name;
        this.type = data.type || DeviceGroupsConfig.groupTypes.CUSTOM;
        this.icon = data.icon || DeviceGroupsConfig.defaultIcons[this.type];
        this.devices = data.devices || [];
        this.sceneData = data.sceneData || null;
        this.createdAt = data.createdAt || Date.now();
        this.updatedAt = Date.now();
        this.color = data.color || this.getRandomColor();
        this.order = data.order || 0;
        this.isExpanded = data.isExpanded || false;
    }

    generateId() {
        return `group_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    getRandomColor() {
        const colors = ['#4361ee', '#06d6a0', '#ef476f', '#ffd166', '#4cc9f0', '#7209b7'];
        return colors[Math.floor(Math.random() * colors.length)];
    }

    addDevice(deviceId) {
        if (!this.devices.includes(deviceId)) {
            this.devices.push(deviceId);
            this.updatedAt = Date.now();
            return true;
        }
        return false;
    }

    removeDevice(deviceId) {
        const index = this.devices.indexOf(deviceId);
        if (index !== -1) {
            this.devices.splice(index, 1);
            this.updatedAt = Date.now();
            return true;
        }
        return false;
    }

    hasDevice(deviceId) {
        return this.devices.includes(deviceId);
    }

    getDeviceCount() {
        return this.devices.length;
    }

    update(data) {
        if (data.name !== undefined) this.name = data.name;
        if (data.icon !== undefined) this.icon = data.icon;
        if (data.color !== undefined) this.color = data.color;
        if (data.order !== undefined) this.order = data.order;
        if (data.isExpanded !== undefined) this.isExpanded = data.isExpanded;
        this.updatedAt = Date.now();
    }

    toJSON() {
        return {
            id: this.id,
            name: this.name,
            type: this.type,
            icon: this.icon,
            devices: this.devices,
            sceneData: this.sceneData,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
            color: this.color,
            order: this.order,
            isExpanded: this.isExpanded
        };
    }
}

// ============================================
// SCENE CLASS
// ============================================

class Scene extends DeviceGroup {
    constructor(data) {
        super({ ...data, type: DeviceGroupsConfig.groupTypes.SCENE });
        this.transitionTime = data.transitionTime || DeviceGroupsConfig.sceneTransitionTime;
        this.deviceStates = data.deviceStates || {};
    }

    captureCurrentStates(devices) {
        this.deviceStates = {};
        for (const deviceId of this.devices) {
            const device = devices.find(d => d.id === deviceId);
            if (device) {
                this.deviceStates[deviceId] = {
                    state: device.state,
                    autoMode: device.autoMode,
                    brightness: device.brightness,
                    temperature: device.temperature
                };
            }
        }
        this.updatedAt = Date.now();
    }

    getDeviceState(deviceId) {
        return this.deviceStates[deviceId] || null;
    }

    toJSON() {
        return {
            ...super.toJSON(),
            transitionTime: this.transitionTime,
            deviceStates: this.deviceStates
        };
    }
}

// ============================================
// DEVICE GROUPS MANAGER
// ============================================

class DeviceGroupsManager {
    constructor() {
        this.groups = new Map();
        this.scenes = new Map();
        this.listeners = [];
        this.currentScene = null;
        
        this.init();
    }

    init() {
        this.loadGroups();
        DeviceGroupsConfig.debug && console.log('[DeviceGroups] Manager initialized');
    }

    loadGroups() {
        try {
            const saved = localStorage.getItem(DeviceGroupsConfig.storageKey);
            if (saved) {
                const data = JSON.parse(saved);
                
                // Load regular groups
                if (data.groups) {
                    for (const groupData of data.groups) {
                        const group = new DeviceGroup(groupData);
                        this.groups.set(group.id, group);
                    }
                }
                
                // Load scenes
                if (data.scenes) {
                    for (const sceneData of data.scenes) {
                        const scene = new Scene(sceneData);
                        this.scenes.set(scene.id, scene);
                    }
                }
                
                DeviceGroupsConfig.debug && console.log('[DeviceGroups] Loaded:', this.groups.size, 'groups,', this.scenes.size, 'scenes');
            }
        } catch (error) {
            console.error('[DeviceGroups] Failed to load groups:', error);
        }
        
        // Load default groups if none exist
        if (this.groups.size === 0 && this.scenes.size === 0) {
            this.createDefaultGroups();
        }
    }

    saveGroups() {
        try {
            const data = {
                groups: Array.from(this.groups.values()).map(g => g.toJSON()),
                scenes: Array.from(this.scenes.values()).map(s => s.toJSON()),
                lastSaved: Date.now()
            };
            localStorage.setItem(DeviceGroupsConfig.storageKey, JSON.stringify(data));
            DeviceGroupsConfig.debug && console.log('[DeviceGroups] Saved');
        } catch (error) {
            console.error('[DeviceGroups] Failed to save groups:', error);
        }
    }

    createDefaultGroups() {
        // Create default room groups
        const defaultRooms = ['Living Room', 'Bedroom', 'Kitchen', 'Bathroom', 'Office'];
        
        for (const room of defaultRooms) {
            const group = new DeviceGroup({
                name: room,
                type: DeviceGroupsConfig.groupTypes.ROOM,
                icon: this.getRoomIcon(room)
            });
            this.groups.set(group.id, group);
        }
        
        this.saveGroups();
        this.notifyListeners('groups_updated');
    }

    getRoomIcon(room) {
        const icons = {
            'Living Room': '🛋️',
            'Bedroom': '🛏️',
            'Kitchen': '🍳',
            'Bathroom': '🚿',
            'Office': '💼'
        };
        return icons[room] || '🏠';
    }

    // ============================================
    // GROUP MANAGEMENT
    // ============================================

    createGroup(name, type = DeviceGroupsConfig.groupTypes.CUSTOM, options = {}) {
        if (this.groups.size >= DeviceGroupsConfig.maxGroups) {
            throw new Error('Maximum number of groups reached');
        }
        
        const group = new DeviceGroup({
            name,
            type,
            icon: options.icon,
            color: options.color,
            order: this.groups.size
        });
        
        this.groups.set(group.id, group);
        this.saveGroups();
        this.notifyListeners('group_created', group);
        
        return group;
    }

    updateGroup(groupId, updates) {
        const group = this.groups.get(groupId);
        if (!group) return null;
        
        group.update(updates);
        this.saveGroups();
        this.notifyListeners('group_updated', group);
        
        return group;
    }

    deleteGroup(groupId) {
        const group = this.groups.get(groupId);
        if (!group) return false;
        
        this.groups.delete(groupId);
        this.saveGroups();
        this.notifyListeners('group_deleted', group);
        
        return true;
    }

    getGroup(groupId) {
        return this.groups.get(groupId);
    }

    getAllGroups() {
        return Array.from(this.groups.values()).sort((a, b) => a.order - b.order);
    }

    getGroupsByType(type) {
        return this.getAllGroups().filter(g => g.type === type);
    }

    // ============================================
    // SCENE MANAGEMENT
    // ============================================

    createScene(name, options = {}) {
        if (this.scenes.size >= DeviceGroupsConfig.maxScenes) {
            throw new Error('Maximum number of scenes reached');
        }
        
        const scene = new Scene({
            name,
            icon: options.icon || '🎬',
            color: options.color,
            transitionTime: options.transitionTime,
            order: this.scenes.size
        });
        
        this.scenes.set(scene.id, scene);
        this.saveGroups();
        this.notifyListeners('scene_created', scene);
        
        return scene;
    }

    updateScene(sceneId, updates) {
        const scene = this.scenes.get(sceneId);
        if (!scene) return null;
        
        scene.update(updates);
        this.saveGroups();
        this.notifyListeners('scene_updated', scene);
        
        return scene;
    }

    deleteScene(sceneId) {
        const scene = this.scenes.get(sceneId);
        if (!scene) return false;
        
        this.scenes.delete(sceneId);
        this.saveGroups();
        this.notifyListeners('scene_deleted', scene);
        
        return true;
    }

    getScene(sceneId) {
        return this.scenes.get(sceneId);
    }

    getAllScenes() {
        return Array.from(this.scenes.values()).sort((a, b) => a.order - b.order);
    }

    captureScene(sceneId, devices) {
        const scene = this.scenes.get(sceneId);
        if (!scene) return false;
        
        scene.captureCurrentStates(devices);
        this.saveGroups();
        this.notifyListeners('scene_captured', scene);
        
        return true;
    }

    async activateScene(sceneId, deviceController) {
        const scene = this.scenes.get(sceneId);
        if (!scene) return false;
        
        this.currentScene = sceneId;
        
        for (const deviceId of scene.devices) {
            const deviceState = scene.getDeviceState(deviceId);
            if (deviceState) {
                await deviceController.setDeviceState(deviceId, deviceState.state);
                if (deviceState.autoMode !== undefined) {
                    await deviceController.setAutoMode(deviceId, deviceState.autoMode);
                }
            }
        }
        
        this.notifyListeners('scene_activated', scene);
        return true;
    }

    // ============================================
    // DEVICE ASSIGNMENT
    // ============================================

    addDeviceToGroup(groupId, deviceId) {
        const group = this.groups.get(groupId);
        if (!group) return false;
        
        const result = group.addDevice(deviceId);
        if (result) {
            this.saveGroups();
            this.notifyListeners('device_added_to_group', { groupId, deviceId });
        }
        return result;
    }

    removeDeviceFromGroup(groupId, deviceId) {
        const group = this.groups.get(groupId);
        if (!group) return false;
        
        const result = group.removeDevice(deviceId);
        if (result) {
            this.saveGroups();
            this.notifyListeners('device_removed_from_group', { groupId, deviceId });
        }
        return result;
    }

    addDeviceToScene(sceneId, deviceId) {
        const scene = this.scenes.get(sceneId);
        if (!scene) return false;
        
        const result = scene.addDevice(deviceId);
        if (result) {
            this.saveGroups();
            this.notifyListeners('device_added_to_scene', { sceneId, deviceId });
        }
        return result;
    }

    removeDeviceFromScene(sceneId, deviceId) {
        const scene = this.scenes.get(sceneId);
        if (!scene) return false;
        
        const result = scene.removeDevice(deviceId);
        if (result) {
            this.saveGroups();
            this.notifyListeners('device_removed_from_scene', { sceneId, deviceId });
        }
        return result;
    }

    getGroupsForDevice(deviceId) {
        return this.getAllGroups().filter(group => group.hasDevice(deviceId));
    }

    getScenesForDevice(deviceId) {
        return this.getAllScenes().filter(scene => scene.hasDevice(deviceId));
    }

    // ============================================
    // BATCH CONTROL
    // ============================================

    async controlGroup(groupId, action, value, deviceController) {
        const group = this.groups.get(groupId);
        if (!group) return { success: false, error: 'Group not found' };
        
        const results = [];
        
        for (const deviceId of group.devices) {
            try {
                let result;
                switch (action) {
                    case 'toggle':
                        result = await deviceController.toggleDevice(deviceId);
                        break;
                    case 'on':
                        result = await deviceController.setDeviceState(deviceId, true);
                        break;
                    case 'off':
                        result = await deviceController.setDeviceState(deviceId, false);
                        break;
                    case 'auto':
                        result = await deviceController.setAutoMode(deviceId, value);
                        break;
                    default:
                        result = { success: false, error: 'Unknown action' };
                }
                results.push({ deviceId, success: result.success, error: result.error });
            } catch (error) {
                results.push({ deviceId, success: false, error: error.message });
            }
        }
        
        this.notifyListeners('group_controlled', { groupId, action, results });
        return { success: true, results };
    }

    async controlScene(sceneId, deviceController) {
        return this.activateScene(sceneId, deviceController);
    }

    // ============================================
    // GROUP ORGANIZATION
    // ============================================

    reorderGroups(groupIds) {
        for (let i = 0; i < groupIds.length; i++) {
            const group = this.groups.get(groupIds[i]);
            if (group) {
                group.order = i;
            }
        }
        this.saveGroups();
        this.notifyListeners('groups_reordered');
    }

    reorderScenes(sceneIds) {
        for (let i = 0; i < sceneIds.length; i++) {
            const scene = this.scenes.get(sceneIds[i]);
            if (scene) {
                scene.order = i;
            }
        }
        this.saveGroups();
        this.notifyListeners('scenes_reordered');
    }

    // ============================================
    // UTILITY METHODS
    // ============================================

    getGroupStats() {
        return {
            totalGroups: this.groups.size,
            totalScenes: this.scenes.size,
            totalDevicesInGroups: Array.from(this.groups.values()).reduce((sum, g) => sum + g.getDeviceCount(), 0),
            groupsByType: {
                room: this.getGroupsByType(DeviceGroupsConfig.groupTypes.ROOM).length,
                custom: this.getGroupsByType(DeviceGroupsConfig.groupTypes.CUSTOM).length,
                scene: this.scenes.size
            }
        };
    }

    exportGroups() {
        return {
            version: '1.0',
            exportedAt: Date.now(),
            groups: Array.from(this.groups.values()).map(g => g.toJSON()),
            scenes: Array.from(this.scenes.values()).map(s => s.toJSON())
        };
    }

    importGroups(data) {
        try {
            // Clear existing
            this.groups.clear();
            this.scenes.clear();
            
            // Import groups
            for (const groupData of data.groups) {
                const group = new DeviceGroup(groupData);
                this.groups.set(group.id, group);
            }
            
            // Import scenes
            for (const sceneData of data.scenes) {
                const scene = new Scene(sceneData);
                this.scenes.set(scene.id, scene);
            }
            
            this.saveGroups();
            this.notifyListeners('groups_imported');
            return true;
        } catch (error) {
            console.error('[DeviceGroups] Import failed:', error);
            return false;
        }
    }

    reset() {
        this.groups.clear();
        this.scenes.clear();
        this.createDefaultGroups();
        this.saveGroups();
        this.notifyListeners('groups_reset');
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
// DEVICE GROUPS UI COMPONENT
// ============================================

class DeviceGroupsUI {
    constructor(manager) {
        this.manager = manager;
        this.init();
    }

    init() {
        this.createUI();
        this.bindEvents();
        this.render();
        DeviceGroupsConfig.debug && console.log('[DeviceGroupsUI] Initialized');
    }

    createUI() {
        const container = document.getElementById('device-groups-container');
        if (!container) return;

        container.innerHTML = `
            <div class="device-groups-panel">
                <div class="groups-header">
                    <i class="fas fa-layer-group"></i>
                    <h3>Device Groups & Scenes</h3>
                    <button id="add-group-btn" class="btn btn-sm btn-primary">
                        <i class="fas fa-plus"></i> Add Group
                    </button>
                </div>
                
                <div class="groups-tabs">
                    <button class="tab-btn active" data-tab="groups">Groups</button>
                    <button class="tab-btn" data-tab="scenes">Scenes</button>
                </div>
                
                <div class="groups-content" id="groups-content"></div>
                <div class="scenes-content" id="scenes-content" style="display: none;"></div>
            </div>
        `;

        this.cacheElements();
        this.bindUIEvents();
    }

    cacheElements() {
        this.groupsContent = document.getElementById('groups-content');
        this.scenesContent = document.getElementById('scenes-content');
        this.addGroupBtn = document.getElementById('add-group-btn');
    }

    bindUIEvents() {
        if (this.addGroupBtn) {
            this.addGroupBtn.addEventListener('click', () => this.showCreateGroupDialog());
        }
        
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tab = btn.dataset.tab;
                this.switchTab(tab);
            });
        });
    }

    bindEvents() {
        this.manager.addEventListener('groups_updated', () => this.render());
        this.manager.addEventListener('scenes_updated', () => this.render());
    }

    switchTab(tab) {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.tab === tab) btn.classList.add('active');
        });
        
        if (tab === 'groups') {
            this.groupsContent.style.display = 'block';
            this.scenesContent.style.display = 'none';
            this.renderGroups();
        } else {
            this.groupsContent.style.display = 'none';
            this.scenesContent.style.display = 'block';
            this.renderScenes();
        }
    }

    render() {
        this.renderGroups();
        this.renderScenes();
    }

    renderGroups() {
        if (!this.groupsContent) return;
        
        const groups = this.manager.getAllGroups();
        
        if (groups.length === 0) {
            this.groupsContent.innerHTML = '<p class="no-data">No groups yet. Click "Add Group" to create one.</p>';
            return;
        }
        
        this.groupsContent.innerHTML = groups.map(group => `
            <div class="group-card" data-group-id="${group.id}">
                <div class="group-header">
                    <div class="group-info">
                        <span class="group-icon">${group.icon}</span>
                        <span class="group-name">${this.escapeHtml(group.name)}</span>
                        <span class="group-count">${group.getDeviceCount()} devices</span>
                    </div>
                    <div class="group-actions">
                        <button class="group-control-btn" data-action="toggle" title="Toggle All">
                            <i class="fas fa-power-off"></i>
                        </button>
                        <button class="group-control-btn" data-action="on" title="Turn On">
                            <i class="fas fa-play"></i>
                        </button>
                        <button class="group-control-btn" data-action="off" title="Turn Off">
                            <i class="fas fa-stop"></i>
                        </button>
                        <button class="group-control-btn" data-action="edit" title="Edit">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="group-control-btn danger" data-action="delete" title="Delete">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
                <div class="group-devices">
                    ${group.devices.map(deviceId => `<span class="device-chip" data-device="${deviceId}">${deviceId.substring(0, 8)}...</span>`).join('')}
                </div>
            </div>
        `).join('');
        
        // Bind group actions
        document.querySelectorAll('.group-card').forEach(card => {
            const groupId = card.dataset.groupId;
            
            card.querySelectorAll('.group-control-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const action = btn.dataset.action;
                    this.handleGroupAction(groupId, action);
                });
            });
        });
    }

    renderScenes() {
        if (!this.scenesContent) return;
        
        const scenes = this.manager.getAllScenes();
        
        if (scenes.length === 0) {
            this.scenesContent.innerHTML = '<p class="no-data">No scenes yet. Create a scene to save device states.</p>';
            return;
        }
        
        this.scenesContent.innerHTML = scenes.map(scene => `
            <div class="scene-card" data-scene-id="${scene.id}">
                <div class="scene-header">
                    <div class="scene-info">
                        <span class="scene-icon">${scene.icon}</span>
                        <span class="scene-name">${this.escapeHtml(scene.name)}</span>
                        <span class="scene-count">${scene.getDeviceCount()} devices</span>
                    </div>
                    <div class="scene-actions">
                        <button class="scene-control-btn" data-action="activate" title="Activate Scene">
                            <i class="fas fa-play-circle"></i> Activate
                        </button>
                        <button class="scene-control-btn" data-action="capture" title="Capture Current State">
                            <i class="fas fa-camera"></i>
                        </button>
                        <button class="scene-control-btn" data-action="edit" title="Edit">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="scene-control-btn danger" data-action="delete" title="Delete">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
                <div class="scene-devices">
                    ${scene.devices.map(deviceId => `<span class="device-chip" data-device="${deviceId}">${deviceId.substring(0, 8)}...</span>`).join('')}
                </div>
            </div>
        `).join('');
        
        // Bind scene actions
        document.querySelectorAll('.scene-card').forEach(card => {
            const sceneId = card.dataset.sceneId;
            
            card.querySelectorAll('.scene-control-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const action = btn.dataset.action;
                    this.handleSceneAction(sceneId, action);
                });
            });
        });
    }

    async handleGroupAction(groupId, action) {
        const deviceController = window.deviceController;
        if (!deviceController) {
            console.error('Device controller not available');
            return;
        }
        
        switch (action) {
            case 'toggle':
                await this.manager.controlGroup(groupId, 'toggle', null, deviceController);
                break;
            case 'on':
                await this.manager.controlGroup(groupId, 'on', null, deviceController);
                break;
            case 'off':
                await this.manager.controlGroup(groupId, 'off', null, deviceController);
                break;
            case 'edit':
                this.editGroup(groupId);
                break;
            case 'delete':
                this.deleteGroup(groupId);
                break;
        }
    }

    async handleSceneAction(sceneId, action) {
        const deviceController = window.deviceController;
        if (!deviceController) {
            console.error('Device controller not available');
            return;
        }
        
        switch (action) {
            case 'activate':
                await this.manager.controlScene(sceneId, deviceController);
                break;
            case 'capture':
                await this.captureScene(sceneId);
                break;
            case 'edit':
                this.editScene(sceneId);
                break;
            case 'delete':
                this.deleteScene(sceneId);
                break;
        }
    }

    showCreateGroupDialog() {
        const name = prompt('Enter group name:');
        if (name) {
            this.manager.createGroup(name);
        }
    }

    editGroup(groupId) {
        const group = this.manager.getGroup(groupId);
        if (!group) return;
        
        const newName = prompt('Enter new group name:', group.name);
        if (newName && newName !== group.name) {
            this.manager.updateGroup(groupId, { name: newName });
        }
    }

    deleteGroup(groupId) {
        if (confirm('Are you sure you want to delete this group?')) {
            this.manager.deleteGroup(groupId);
        }
    }

    async captureScene(sceneId) {
        const deviceController = window.deviceController;
        if (!deviceController) return;
        
        const devices = deviceController.getAllDevices();
        const success = this.manager.captureScene(sceneId, devices);
        
        if (success) {
            this.showToast('Scene captured successfully!', 'success');
        } else {
            this.showToast('Failed to capture scene', 'error');
        }
    }

    editScene(sceneId) {
        const scene = this.manager.getScene(sceneId);
        if (!scene) return;
        
        const newName = prompt('Enter new scene name:', scene.name);
        if (newName && newName !== scene.name) {
            this.manager.updateScene(sceneId, { name: newName });
        }
    }

    deleteScene(sceneId) {
        if (confirm('Are you sure you want to delete this scene?')) {
            this.manager.deleteScene(sceneId);
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

const deviceGroupsStyles = `
    .device-groups-panel {
        background: var(--bg-card);
        border-radius: 12px;
        padding: 20px;
        border: 1px solid var(--border-color);
    }
    
    .groups-header {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 20px;
        padding-bottom: 12px;
        border-bottom: 1px solid var(--border-color);
    }
    
    .groups-header i {
        font-size: 20px;
        color: var(--primary);
    }
    
    .groups-header h3 {
        flex: 1;
        margin: 0;
    }
    
    .groups-tabs {
        display: flex;
        gap: 8px;
        margin-bottom: 20px;
        border-bottom: 1px solid var(--border-color);
    }
    
    .tab-btn {
        padding: 8px 16px;
        background: none;
        border: none;
        cursor: pointer;
        color: var(--text-secondary);
        transition: all 0.2s ease;
    }
    
    .tab-btn.active {
        color: var(--primary);
        border-bottom: 2px solid var(--primary);
    }
    
    .group-card, .scene-card {
        background: var(--bg-secondary);
        border-radius: 10px;
        padding: 16px;
        margin-bottom: 12px;
        transition: all 0.2s ease;
    }
    
    .group-card:hover, .scene-card:hover {
        transform: translateX(4px);
    }
    
    .group-header, .scene-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-wrap: wrap;
        gap: 12px;
        margin-bottom: 12px;
    }
    
    .group-info, .scene-info {
        display: flex;
        align-items: center;
        gap: 8px;
    }
    
    .group-icon, .scene-icon {
        font-size: 24px;
    }
    
    .group-name, .scene-name {
        font-weight: 500;
    }
    
    .group-count, .scene-count {
        font-size: 11px;
        color: var(--text-muted);
        background: var(--bg-tertiary);
        padding: 2px 8px;
        border-radius: 12px;
    }
    
    .group-actions, .scene-actions {
        display: flex;
        gap: 8px;
    }
    
    .group-control-btn, .scene-control-btn {
        background: var(--bg-tertiary);
        border: none;
        border-radius: 6px;
        padding: 6px 10px;
        cursor: pointer;
        transition: all 0.2s ease;
    }
    
    .group-control-btn:hover, .scene-control-btn:hover {
        background: var(--primary);
        color: white;
    }
    
    .group-control-btn.danger:hover, .scene-control-btn.danger:hover {
        background: var(--danger);
    }
    
    .group-devices, .scene-devices {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-top: 12px;
        padding-top: 12px;
        border-top: 1px solid var(--border-light);
    }
    
    .device-chip {
        background: var(--bg-tertiary);
        padding: 4px 8px;
        border-radius: 6px;
        font-size: 10px;
        font-family: monospace;
        color: var(--text-secondary);
    }
    
    .no-data {
        text-align: center;
        color: var(--text-muted);
        padding: 40px;
    }
`;

// Inject styles
if (typeof document !== 'undefined') {
    const styleSheet = document.createElement('style');
    styleSheet.textContent = deviceGroupsStyles;
    document.head.appendChild(styleSheet);
}

// ============================================
// CREATE SINGLETON INSTANCES
// ============================================

const deviceGroups = new DeviceGroupsManager();
const deviceGroupsUI = new DeviceGroupsUI(deviceGroups);

// ============================================
// EXPORTS
// ============================================

// Expose to window
window.deviceGroups = deviceGroups;
window.deviceGroupsUI = deviceGroupsUI;
window.DeviceGroupsManager = DeviceGroupsManager;
window.DeviceGroupsConfig = DeviceGroupsConfig;

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        deviceGroups,
        deviceGroupsUI,
        DeviceGroupsManager,
        DeviceGroupsConfig
    };
}

// ES modules export
export {
    deviceGroups,
    deviceGroupsUI,
    DeviceGroupsManager,
    DeviceGroupsConfig
};