/**
 * ESTIF HOME ULTIMATE - HOME MANAGER MODULE
 * Centralized home management with multi-home support, switching, and configuration
 * Version: 2.0.0
 * Author: Estifanos Yohannis
 */

// ============================================
// HOME MANAGER CONFIGURATION
// ============================================

const HomeManagerConfig = {
    // Storage
    storageKey: 'estif_home_manager',
    currentHomeKey: 'estif_current_home',
    
    // Limits
    maxHomesPerUser: 10,
    maxMembersPerHome: 50,
    maxRoomsPerHome: 30,
    
    // Default settings
    defaultSettings: {
        timezone: 'Africa/Addis_Ababa',
        temperatureUnit: 'celsius',
        language: 'en',
        theme: 'light',
        notifications: true,
        energyMonitoring: true,
        autoBackup: true,
        guestAccess: false
    },
    
    // Sync settings
    syncInterval: 60000, // 1 minute
    autoSync: true,
    
    // Debug
    debug: false
};

// ============================================
// HOME CLASS
// ============================================

class ManagedHome {
    constructor(data) {
        this.id = data.id || this.generateId();
        this.name = data.name;
        this.nameAm = data.nameAm || data.name;
        this.description = data.description || '';
        this.address = data.address || '';
        this.city = data.city || '';
        this.country = data.country || 'Ethiopia';
        this.zipCode = data.zipCode || '';
        this.location = data.location || null;
        this.image = data.image || null;
        
        this.rooms = data.rooms || [];
        this.devices = data.devices || [];
        this.members = data.members || [];
        this.scenes = data.scenes || [];
        this.automations = data.automations || [];
        
        this.settings = { ...HomeManagerConfig.defaultSettings, ...data.settings };
        this.metadata = data.metadata || {};
        
        this.ownerId = data.ownerId || null;
        this.createdAt = data.createdAt || Date.now();
        this.updatedAt = Date.now();
        this.lastActive = data.lastActive || Date.now();
        this.isActive = data.isActive !== undefined ? data.isActive : true;
        this.isArchived = data.isArchived || false;
    }

    generateId() {
        return `home_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    update(data) {
        if (data.name !== undefined) this.name = data.name;
        if (data.nameAm !== undefined) this.nameAm = data.nameAm;
        if (data.description !== undefined) this.description = data.description;
        if (data.address !== undefined) this.address = data.address;
        if (data.city !== undefined) this.city = data.city;
        if (data.country !== undefined) this.country = data.country;
        if (data.zipCode !== undefined) this.zipCode = data.zipCode;
        if (data.location !== undefined) this.location = data.location;
        if (data.image !== undefined) this.image = data.image;
        if (data.settings) this.settings = { ...this.settings, ...data.settings };
        if (data.metadata) this.metadata = { ...this.metadata, ...data.metadata };
        if (data.isActive !== undefined) this.isActive = data.isActive;
        if (data.isArchived !== undefined) this.isArchived = data.isArchived;
        
        this.updatedAt = Date.now();
    }

    addRoom(room) {
        if (this.rooms.length >= HomeManagerConfig.maxRoomsPerHome) {
            throw new Error('Maximum number of rooms reached');
        }
        
        const newRoom = {
            id: `room_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
            name: room.name,
            nameAm: room.nameAm || room.name,
            icon: room.icon || '🚪',
            type: room.type || 'custom',
            devices: room.devices || [],
            order: this.rooms.length,
            createdAt: Date.now()
        };
        
        this.rooms.push(newRoom);
        this.updatedAt = Date.now();
        return newRoom;
    }

    updateRoom(roomId, updates) {
        const index = this.rooms.findIndex(r => r.id === roomId);
        if (index === -1) return null;
        
        this.rooms[index] = { ...this.rooms[index], ...updates, updatedAt: Date.now() };
        this.updatedAt = Date.now();
        return this.rooms[index];
    }

    removeRoom(roomId) {
        const index = this.rooms.findIndex(r => r.id === roomId);
        if (index === -1) return false;
        
        this.rooms.splice(index, 1);
        this.updatedAt = Date.now();
        return true;
    }

    addMember(member) {
        if (this.members.length >= HomeManagerConfig.maxMembersPerHome) {
            throw new Error('Maximum number of members reached');
        }
        
        const existing = this.members.find(m => m.userId === member.userId);
        if (existing) return existing;
        
        const newMember = {
            userId: member.userId,
            name: member.name,
            email: member.email,
            role: member.role || 'member',
            joinedAt: Date.now(),
            invitedBy: member.invitedBy || null,
            permissions: member.permissions || []
        };
        
        this.members.push(newMember);
        this.updatedAt = Date.now();
        return newMember;
    }

    updateMember(userId, updates) {
        const index = this.members.findIndex(m => m.userId === userId);
        if (index === -1) return null;
        
        this.members[index] = { ...this.members[index], ...updates, updatedAt: Date.now() };
        this.updatedAt = Date.now();
        return this.members[index];
    }

    removeMember(userId) {
        const index = this.members.findIndex(m => m.userId === userId);
        if (index === -1) return false;
        
        this.members.splice(index, 1);
        this.updatedAt = Date.now();
        return true;
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

    addScene(sceneId) {
        if (!this.scenes.includes(sceneId)) {
            this.scenes.push(sceneId);
            this.updatedAt = Date.now();
            return true;
        }
        return false;
    }

    removeScene(sceneId) {
        const index = this.scenes.indexOf(sceneId);
        if (index !== -1) {
            this.scenes.splice(index, 1);
            this.updatedAt = Date.now();
            return true;
        }
        return false;
    }

    addAutomation(automationId) {
        if (!this.automations.includes(automationId)) {
            this.automations.push(automationId);
            this.updatedAt = Date.now();
            return true;
        }
        return false;
    }

    removeAutomation(automationId) {
        const index = this.automations.indexOf(automationId);
        if (index !== -1) {
            this.automations.splice(index, 1);
            this.updatedAt = Date.now();
            return true;
        }
        return false;
    }

    getStats() {
        return {
            totalRooms: this.rooms.length,
            totalMembers: this.members.length,
            totalDevices: this.devices.length,
            totalScenes: this.scenes.length,
            totalAutomations: this.automations.length,
            activeDevices: 0 // Will be populated by device registry
        };
    }

    toJSON() {
        return {
            id: this.id,
            name: this.name,
            nameAm: this.nameAm,
            description: this.description,
            address: this.address,
            city: this.city,
            country: this.country,
            zipCode: this.zipCode,
            location: this.location,
            image: this.image,
            rooms: this.rooms,
            devices: this.devices,
            members: this.members,
            scenes: this.scenes,
            automations: this.automations,
            settings: this.settings,
            metadata: this.metadata,
            ownerId: this.ownerId,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
            lastActive: this.lastActive,
            isActive: this.isActive,
            isArchived: this.isArchived
        };
    }

    getDisplayName(lang = 'en') {
        return lang === 'am' && this.nameAm ? this.nameAm : this.name;
    }
}

// ============================================
// HOME MANAGER
// ============================================

class HomeManager {
    constructor() {
        this.homes = new Map();
        this.currentHomeId = null;
        this.syncTimer = null;
        this.listeners = [];
        
        this.init();
    }

    init() {
        this.loadHomes();
        this.loadCurrentHome();
        this.startSync();
        HomeManagerConfig.debug && console.log('[HomeManager] Initialized with', this.homes.size, 'homes');
    }

    loadHomes() {
        try {
            const saved = localStorage.getItem(HomeManagerConfig.storageKey);
            if (saved) {
                const homes = JSON.parse(saved);
                for (const homeData of homes) {
                    const home = new ManagedHome(homeData);
                    this.homes.set(home.id, home);
                }
                HomeManagerConfig.debug && console.log('[HomeManager] Loaded', this.homes.size, 'homes');
            }
        } catch (error) {
            console.error('[HomeManager] Failed to load homes:', error);
        }
    }

    saveHomes() {
        try {
            const homes = Array.from(this.homes.values()).map(h => h.toJSON());
            localStorage.setItem(HomeManagerConfig.storageKey, JSON.stringify(homes));
            HomeManagerConfig.debug && console.log('[HomeManager] Saved', homes.length, 'homes');
        } catch (error) {
            console.error('[HomeManager] Failed to save homes:', error);
        }
    }

    loadCurrentHome() {
        try {
            const saved = localStorage.getItem(HomeManagerConfig.currentHomeKey);
            if (saved && this.homes.has(saved)) {
                this.currentHomeId = saved;
            }
        } catch (error) {
            console.error('[HomeManager] Failed to load current home:', error);
        }
    }

    saveCurrentHome() {
        if (this.currentHomeId) {
            localStorage.setItem(HomeManagerConfig.currentHomeKey, this.currentHomeId);
        } else {
            localStorage.removeItem(HomeManagerConfig.currentHomeKey);
        }
    }

    // ============================================
    // HOME MANAGEMENT
    // ============================================

    createHome(data, ownerId) {
        const userHomes = this.getUserHomes(ownerId);
        if (userHomes.length >= HomeManagerConfig.maxHomesPerUser) {
            throw new Error(`Maximum of ${HomeManagerConfig.maxHomesPerUser} homes per user reached`);
        }
        
        const home = new ManagedHome({
            ...data,
            ownerId
        });
        
        // Add owner as member
        home.addMember({
            userId: ownerId,
            name: data.ownerName || 'Owner',
            email: data.ownerEmail || '',
            role: 'owner'
        });
        
        this.homes.set(home.id, home);
        this.saveHomes();
        this.notifyListeners('home_created', home);
        
        return home;
    }

    updateHome(homeId, updates) {
        const home = this.homes.get(homeId);
        if (!home) return null;
        
        home.update(updates);
        this.saveHomes();
        this.notifyListeners('home_updated', home);
        
        return home;
    }

    deleteHome(homeId) {
        const home = this.homes.get(homeId);
        if (!home) return false;
        
        this.homes.delete(homeId);
        this.saveHomes();
        
        if (this.currentHomeId === homeId) {
            this.setCurrentHome(null);
        }
        
        this.notifyListeners('home_deleted', home);
        return true;
    }

    getHome(homeId) {
        return this.homes.get(homeId) || null;
    }

    getAllHomes() {
        return Array.from(this.homes.values()).filter(h => !h.isArchived);
    }

    getArchivedHomes() {
        return Array.from(this.homes.values()).filter(h => h.isArchived);
    }

    getUserHomes(userId) {
        return this.getAllHomes().filter(h => 
            h.ownerId === userId || h.members.some(m => m.userId === userId)
        );
    }

    // ============================================
    // HOME SWITCHING
    // ============================================

    setCurrentHome(homeId) {
        if (!homeId) {
            this.currentHomeId = null;
            this.saveCurrentHome();
            this.notifyListeners('current_home_changed', null);
            return;
        }
        
        const home = this.homes.get(homeId);
        if (!home) throw new Error('Home not found');
        
        this.currentHomeId = homeId;
        home.lastActive = Date.now();
        this.saveHomes();
        this.saveCurrentHome();
        
        this.notifyListeners('current_home_changed', home);
        
        // Load home-specific data
        this.loadHomeData(home);
        
        return home;
    }

    getCurrentHome() {
        return this.currentHomeId ? this.homes.get(this.currentHomeId) : null;
    }

    async switchHome(homeId) {
        const currentHome = this.getCurrentHome();
        if (currentHome && currentHome.id === homeId) {
            return currentHome;
        }
        
        // Save current state before switching
        if (currentHome) {
            await this.saveHomeState(currentHome);
        }
        
        // Switch to new home
        const newHome = this.setCurrentHome(homeId);
        
        // Load new home state
        await this.loadHomeState(newHome);
        
        this.notifyListeners('home_switched', { from: currentHome, to: newHome });
        
        return newHome;
    }

    async saveHomeState(home) {
        // Save current device states, scenes, etc. for this home
        HomeManagerConfig.debug && console.log('[HomeManager] Saving state for home:', home.name);
    }

    async loadHomeState(home) {
        // Load device states, scenes, etc. for this home
        HomeManagerConfig.debug && console.log('[HomeManager] Loading state for home:', home.name);
    }

    async loadHomeData(home) {
        // Load home-specific data from server
        try {
            const response = await fetch(`/api/homes/${home.id}/data`);
            if (response.ok) {
                const data = await response.json();
                this.mergeHomeData(home, data);
            }
        } catch (error) {
            HomeManagerConfig.debug && console.log('[HomeManager] Failed to load home data:', error);
        }
    }

    mergeHomeData(home, data) {
        if (data.devices) home.devices = data.devices;
        if (data.scenes) home.scenes = data.scenes;
        if (data.automations) home.automations = data.automations;
        if (data.settings) home.settings = { ...home.settings, ...data.settings };
        
        this.saveHomes();
    }

    // ============================================
    // SYNC
    // ============================================

    startSync() {
        if (!HomeManagerConfig.autoSync) return;
        
        this.syncTimer = setInterval(() => {
            this.syncWithServer();
        }, HomeManagerConfig.syncInterval);
    }

    stopSync() {
        if (this.syncTimer) {
            clearInterval(this.syncTimer);
            this.syncTimer = null;
        }
    }

    async syncWithServer() {
        try {
            const homes = this.getAllHomes();
            const response = await fetch('/api/homes/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    homes: homes.map(h => h.toJSON()),
                    timestamp: Date.now()
                })
            });
            
            if (response.ok) {
                const serverData = await response.json();
                this.mergeServerData(serverData);
            }
        } catch (error) {
            HomeManagerConfig.debug && console.log('[HomeManager] Sync failed:', error);
        }
    }

    mergeServerData(serverData) {
        for (const homeData of serverData.homes) {
            const localHome = this.homes.get(homeData.id);
            if (!localHome || homeData.updatedAt > localHome.updatedAt) {
                this.homes.set(homeData.id, new ManagedHome(homeData));
            }
        }
        this.saveHomes();
    }

    // ============================================
    // ROOM MANAGEMENT
    // ============================================

    addRoom(homeId, roomData) {
        const home = this.homes.get(homeId);
        if (!home) return null;
        
        const room = home.addRoom(roomData);
        this.saveHomes();
        this.notifyListeners('room_added', { homeId, room });
        
        return room;
    }

    updateRoom(homeId, roomId, updates) {
        const home = this.homes.get(homeId);
        if (!home) return null;
        
        const room = home.updateRoom(roomId, updates);
        if (room) {
            this.saveHomes();
            this.notifyListeners('room_updated', { homeId, room });
        }
        
        return room;
    }

    deleteRoom(homeId, roomId) {
        const home = this.homes.get(homeId);
        if (!home) return false;
        
        const success = home.removeRoom(roomId);
        if (success) {
            this.saveHomes();
            this.notifyListeners('room_deleted', { homeId, roomId });
        }
        
        return success;
    }

    getRooms(homeId) {
        const home = this.homes.get(homeId);
        return home ? home.rooms : [];
    }

    // ============================================
    // MEMBER MANAGEMENT
    // ============================================

    addMember(homeId, memberData) {
        const home = this.homes.get(homeId);
        if (!home) return null;
        
        const member = home.addMember(memberData);
        this.saveHomes();
        this.notifyListeners('member_added', { homeId, member });
        
        return member;
    }

    updateMember(homeId, userId, updates) {
        const home = this.homes.get(homeId);
        if (!home) return null;
        
        const member = home.updateMember(userId, updates);
        if (member) {
            this.saveHomes();
            this.notifyListeners('member_updated', { homeId, member });
        }
        
        return member;
    }

    removeMember(homeId, userId) {
        const home = this.homes.get(homeId);
        if (!home) return false;
        
        const success = home.removeMember(userId);
        if (success) {
            this.saveHomes();
            this.notifyListeners('member_removed', { homeId, userId });
        }
        
        return success;
    }

    getMembers(homeId) {
        const home = this.homes.get(homeId);
        return home ? home.members : [];
    }

    // ============================================
    // DEVICE ASSIGNMENT
    // ============================================

    assignDevice(homeId, deviceId) {
        // Remove from current home first
        for (const home of this.homes.values()) {
            if (home.removeDevice(deviceId)) {
                this.notifyListeners('device_unassigned', { deviceId, homeId: home.id });
            }
        }
        
        const home = this.homes.get(homeId);
        if (!home) return false;
        
        const success = home.addDevice(deviceId);
        if (success) {
            this.saveHomes();
            this.notifyListeners('device_assigned', { deviceId, homeId });
        }
        
        return success;
    }

    unassignDevice(deviceId) {
        for (const home of this.homes.values()) {
            if (home.removeDevice(deviceId)) {
                this.saveHomes();
                this.notifyListeners('device_unassigned', { deviceId, homeId: home.id });
                return true;
            }
        }
        return false;
    }

    getHomeForDevice(deviceId) {
        for (const home of this.homes.values()) {
            if (home.devices.includes(deviceId)) {
                return home;
            }
        }
        return null;
    }

    // ============================================
    // UTILITY METHODS
    // ============================================

    getHomeStats() {
        const homes = this.getAllHomes();
        return {
            totalHomes: homes.length,
            archivedHomes: this.getArchivedHomes().length,
            totalRooms: homes.reduce((sum, h) => sum + h.rooms.length, 0),
            totalMembers: homes.reduce((sum, h) => sum + h.members.length, 0),
            totalDevices: homes.reduce((sum, h) => sum + h.devices.length, 0),
            totalScenes: homes.reduce((sum, h) => sum + h.scenes.length, 0),
            totalAutomations: homes.reduce((sum, h) => sum + h.automations.length, 0)
        };
    }

    exportHome(homeId) {
        const home = this.getHome(homeId);
        if (!home) return null;
        
        return {
            version: '2.0',
            exportedAt: Date.now(),
            home: home.toJSON()
        };
    }

    importHome(data) {
        try {
            const home = new ManagedHome(data.home);
            this.homes.set(home.id, home);
            this.saveHomes();
            this.notifyListeners('home_imported', home);
            return home;
        } catch (error) {
            console.error('[HomeManager] Import failed:', error);
            return null;
        }
    }

    archiveHome(homeId) {
        const home = this.homes.get(homeId);
        if (!home) return false;
        
        home.isArchived = true;
        this.saveHomes();
        this.notifyListeners('home_archived', home);
        
        if (this.currentHomeId === homeId) {
            this.setCurrentHome(null);
        }
        
        return true;
    }

    unarchiveHome(homeId) {
        const home = this.homes.get(homeId);
        if (!home) return false;
        
        home.isArchived = false;
        this.saveHomes();
        this.notifyListeners('home_unarchived', home);
        
        return true;
    }

    reset() {
        this.homes.clear();
        this.currentHomeId = null;
        this.saveHomes();
        this.saveCurrentHome();
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
// HOME MANAGER UI COMPONENT
// ============================================

class HomeManagerUI {
    constructor(manager) {
        this.manager = manager;
        this.init();
    }

    init() {
        this.createUI();
        this.bindEvents();
        this.render();
        HomeManagerConfig.debug && console.log('[HomeManagerUI] Initialized');
    }

    createUI() {
        const container = document.getElementById('home-manager-container');
        if (!container) return;

        container.innerHTML = `
            <div class="home-manager-panel">
                <div class="manager-header">
                    <i class="fas fa-home"></i>
                    <h3>Home Manager</h3>
                    <button id="create-home-btn" class="btn btn-sm btn-primary">
                        <i class="fas fa-plus"></i> New Home
                    </button>
                </div>
                
                <div class="current-home" id="current-home"></div>
                
                <div class="homes-list" id="homes-list"></div>
            </div>
        `;

        this.cacheElements();
        this.bindUIEvents();
    }

    cacheElements() {
        this.currentHomeDiv = document.getElementById('current-home');
        this.homesList = document.getElementById('homes-list');
        this.createBtn = document.getElementById('create-home-btn');
    }

    bindUIEvents() {
        if (this.createBtn) {
            this.createBtn.addEventListener('click', () => this.showCreateHomeDialog());
        }
    }

    bindEvents() {
        this.manager.addEventListener('home_created', () => this.render());
        this.manager.addEventListener('home_updated', () => this.render());
        this.manager.addEventListener('home_deleted', () => this.render());
        this.manager.addEventListener('current_home_changed', () => this.render());
    }

    render() {
        this.renderCurrentHome();
        this.renderHomesList();
    }

    renderCurrentHome() {
        const currentHome = this.manager.getCurrentHome();
        
        if (!currentHome) {
            this.currentHomeDiv.innerHTML = `
                <div class="no-current-home">
                    <p>No active home selected</p>
                    <button class="select-home-btn">Select a home</button>
                </div>
            `;
            return;
        }
        
        this.currentHomeDiv.innerHTML = `
            <div class="current-home-card">
                <div class="home-icon">🏠</div>
                <div class="home-info">
                    <div class="home-name">${this.escapeHtml(currentHome.getDisplayName())}</div>
                    <div class="home-stats-mini">
                        <span>${currentHome.devices.length} devices</span>
                        <span>${currentHome.members.length} members</span>
                    </div>
                </div>
                <button class="switch-home-btn" disabled>Active</button>
            </div>
        `;
    }

    renderHomesList() {
        const homes = this.manager.getAllHomes();
        const currentHome = this.manager.getCurrentHome();
        
        if (homes.length === 0) {
            this.homesList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-home"></i>
                    <p>No homes yet. Click "New Home" to create your first smart home.</p>
                </div>
            `;
            return;
        }
        
        this.homesList.innerHTML = homes.map(home => `
            <div class="home-list-item ${currentHome?.id === home.id ? 'active' : ''}" data-home-id="${home.id}">
                <div class="home-icon">🏠</div>
                <div class="home-info">
                    <div class="home-name">${this.escapeHtml(home.getDisplayName())}</div>
                    <div class="home-address">${this.escapeHtml(home.address || 'No address')}</div>
                </div>
                <div class="home-actions">
                    ${currentHome?.id !== home.id ? `
                        <button class="switch-home" data-home-id="${home.id}" title="Switch to this home">
                            <i class="fas fa-exchange-alt"></i>
                        </button>
                    ` : ''}
                    <button class="edit-home" data-home-id="${home.id}" title="Edit">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="delete-home" data-home-id="${home.id}" title="Delete">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `).join('');
        
        // Bind actions
        document.querySelectorAll('.switch-home').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const homeId = btn.dataset.homeId;
                this.switchHome(homeId);
            });
        });
        
        document.querySelectorAll('.edit-home').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const homeId = btn.dataset.homeId;
                this.editHome(homeId);
            });
        });
        
        document.querySelectorAll('.delete-home').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const homeId = btn.dataset.homeId;
                this.deleteHome(homeId);
            });
        });
    }

    showCreateHomeDialog() {
        const name = prompt('Enter home name:');
        if (!name) return;
        
        const currentUser = JSON.parse(localStorage.getItem('estif_user') || '{}');
        
        try {
            const home = this.manager.createHome({ name }, currentUser.id);
            this.manager.setCurrentHome(home.id);
            this.showToast(`Home "${home.name}" created successfully!`, 'success');
        } catch (error) {
            this.showToast(error.message, 'error');
        }
    }

    async switchHome(homeId) {
        try {
            await this.manager.switchHome(homeId);
            this.showToast('Home switched successfully', 'success');
        } catch (error) {
            this.showToast(error.message, 'error');
        }
    }

    editHome(homeId) {
        const home = this.manager.getHome(homeId);
        if (!home) return;
        
        const newName = prompt('Enter new home name:', home.name);
        if (newName && newName !== home.name) {
            this.manager.updateHome(homeId, { name: newName });
            this.showToast('Home updated', 'success');
        }
    }

    deleteHome(homeId) {
        if (confirm('Are you sure you want to delete this home? This action cannot be undone.')) {
            this.manager.deleteHome(homeId);
            this.showToast('Home deleted', 'success');
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

const homeManagerStyles = `
    .home-manager-panel {
        background: var(--bg-card);
        border-radius: 12px;
        padding: 20px;
        border: 1px solid var(--border-color);
    }
    
    .manager-header {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 20px;
        padding-bottom: 12px;
        border-bottom: 1px solid var(--border-color);
    }
    
    .manager-header i {
        font-size: 20px;
        color: var(--primary);
    }
    
    .manager-header h3 {
        flex: 1;
        margin: 0;
    }
    
    .current-home {
        margin-bottom: 20px;
    }
    
    .current-home-card, .home-list-item {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 16px;
        background: var(--bg-secondary);
        border-radius: 10px;
        transition: all 0.2s ease;
    }
    
    .current-home-card {
        background: linear-gradient(135deg, var(--primary-soft), var(--bg-secondary));
        border: 1px solid var(--primary);
    }
    
    .home-icon {
        font-size: 32px;
    }
    
    .home-info {
        flex: 1;
    }
    
    .home-name {
        font-weight: 500;
        margin-bottom: 4px;
    }
    
    .home-address, .home-stats-mini {
        font-size: 11px;
        color: var(--text-muted);
    }
    
    .home-stats-mini {
        display: flex;
        gap: 12px;
        margin-top: 4px;
    }
    
    .switch-home-btn, .switch-home, .edit-home, .delete-home {
        background: var(--bg-tertiary);
        border: none;
        border-radius: 6px;
        padding: 6px 12px;
        cursor: pointer;
        transition: all 0.2s ease;
    }
    
    .switch-home-btn:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }
    
    .switch-home:hover, .switch-home-btn:not(:disabled):hover {
        background: var(--success);
        color: white;
    }
    
    .edit-home:hover {
        background: var(--info);
        color: white;
    }
    
    .delete-home:hover {
        background: var(--danger);
        color: white;
    }
    
    .homes-list {
        max-height: 400px;
        overflow-y: auto;
    }
    
    .home-list-item {
        margin-bottom: 8px;
    }
    
    .home-list-item.active {
        border-left: 3px solid var(--success);
    }
    
    .empty-state {
        text-align: center;
        padding: 40px;
        color: var(--text-muted);
    }
    
    .empty-state i {
        font-size: 48px;
        margin-bottom: 16px;
        opacity: 0.5;
    }
    
    .no-current-home {
        text-align: center;
        padding: 20px;
        background: var(--bg-secondary);
        border-radius: 10px;
    }
`;

// Inject styles
if (typeof document !== 'undefined') {
    const styleSheet = document.createElement('style');
    styleSheet.textContent = homeManagerStyles;
    document.head.appendChild(styleSheet);
}

// ============================================
// CREATE SINGLETON INSTANCES
// ============================================

const homeManager = new HomeManager();
const homeManagerUI = new HomeManagerUI(homeManager);

// ============================================
// EXPORTS
// ============================================

// Expose to window
window.homeManager = homeManager;
window.homeManagerUI = homeManagerUI;
window.HomeManager = HomeManager;
window.HomeManagerConfig = HomeManagerConfig;

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        homeManager,
        homeManagerUI,
        HomeManager,
        HomeManagerConfig
    };
}

// ES modules export
export {
    homeManager,
    homeManagerUI,
    HomeManager,
    HomeManagerConfig
};