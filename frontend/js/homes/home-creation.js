/**
 * ESTIF HOME ULTIMATE - HOME CREATION MODULE
 * Create, configure, and initialize new smart homes
 * Version: 2.0.0
 * Author: Estifanos Yohannis
 */

// ============================================
// HOME CREATION CONFIGURATION
// ============================================

const HomeCreationConfig = {
    // Default settings
    defaultSettings: {
        timezone: 'Africa/Addis_Ababa',
        temperatureUnit: 'celsius',
        language: 'en',
        theme: 'light',
        notifications: true,
        energyMonitoring: true,
        autoBackup: true
    },
    
    // Room defaults
    defaultRooms: [
        { name: 'Living Room', nameAm: 'ሳሎን', icon: '🛋️', type: 'living' },
        { name: 'Bedroom', nameAm: 'መኝታ', icon: '🛏️', type: 'bedroom' },
        { name: 'Kitchen', nameAm: 'ኩሽና', icon: '🍳', type: 'kitchen' },
        { name: 'Bathroom', nameAm: 'መታጠቢያ', icon: '🚿', type: 'bathroom' },
        { name: 'Office', nameAm: 'ቢሮ', icon: '💼', type: 'office' },
        { name: 'Garden', nameAm: 'አትክልት', icon: '🌳', type: 'garden' }
    ],
    
    // Validation
    minNameLength: 2,
    maxNameLength: 50,
    maxRooms: 30,
    maxMembers: 20,
    
    // Storage
    storageKey: 'estif_homes',
    
    // Debug
    debug: false
};

// ============================================
// HOME CLASS
// ============================================

class Home {
    constructor(data) {
        this.id = data.id || this.generateId();
        this.name = data.name;
        this.nameAm = data.nameAm || data.name;
        this.address = data.address || '';
        this.city = data.city || '';
        this.country = data.country || 'Ethiopia';
        this.zipCode = data.zipCode || '';
        this.rooms = data.rooms || [];
        this.members = data.members || [];
        this.devices = data.devices || [];
        this.settings = { ...HomeCreationConfig.defaultSettings, ...data.settings };
        this.createdAt = data.createdAt || Date.now();
        this.updatedAt = Date.now();
        this.ownerId = data.ownerId || null;
        this.isActive = data.isActive !== undefined ? data.isActive : true;
        this.metadata = data.metadata || {};
        this.location = data.location || null;
        this.image = data.image || null;
    }

    generateId() {
        return `home_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    addRoom(room) {
        if (this.rooms.length >= HomeCreationConfig.maxRooms) {
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
        const roomIndex = this.rooms.findIndex(r => r.id === roomId);
        if (roomIndex === -1) return null;
        
        this.rooms[roomIndex] = { ...this.rooms[roomIndex], ...updates, updatedAt: Date.now() };
        this.updatedAt = Date.now();
        return this.rooms[roomIndex];
    }

    removeRoom(roomId) {
        const roomIndex = this.rooms.findIndex(r => r.id === roomId);
        if (roomIndex === -1) return false;
        
        this.rooms.splice(roomIndex, 1);
        this.updatedAt = Date.now();
        return true;
    }

    addMember(member) {
        if (this.members.length >= HomeCreationConfig.maxMembers) {
            throw new Error('Maximum number of members reached');
        }
        
        const existingMember = this.members.find(m => m.userId === member.userId);
        if (existingMember) return existingMember;
        
        const newMember = {
            userId: member.userId,
            name: member.name,
            email: member.email,
            role: member.role || 'member',
            joinedAt: Date.now(),
            invitedBy: member.invitedBy || null
        };
        
        this.members.push(newMember);
        this.updatedAt = Date.now();
        return newMember;
    }

    removeMember(userId) {
        const memberIndex = this.members.findIndex(m => m.userId === userId);
        if (memberIndex === -1) return false;
        
        this.members.splice(memberIndex, 1);
        this.updatedAt = Date.now();
        return true;
    }

    updateMemberRole(userId, role) {
        const member = this.members.find(m => m.userId === userId);
        if (!member) return null;
        
        member.role = role;
        member.updatedAt = Date.now();
        this.updatedAt = Date.now();
        return member;
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

    updateSettings(settings) {
        this.settings = { ...this.settings, ...settings };
        this.updatedAt = Date.now();
    }

    toJSON() {
        return {
            id: this.id,
            name: this.name,
            nameAm: this.nameAm,
            address: this.address,
            city: this.city,
            country: this.country,
            zipCode: this.zipCode,
            rooms: this.rooms,
            members: this.members,
            devices: this.devices,
            settings: this.settings,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
            ownerId: this.ownerId,
            isActive: this.isActive,
            metadata: this.metadata,
            location: this.location,
            image: this.image
        };
    }

    getDisplayName(lang = 'en') {
        return lang === 'am' && this.nameAm ? this.nameAm : this.name;
    }

    getRoomDisplayName(room, lang = 'en') {
        return lang === 'am' && room.nameAm ? room.nameAm : room.name;
    }

    getStats() {
        return {
            totalRooms: this.rooms.length,
            totalMembers: this.members.length,
            totalDevices: this.devices.length,
            activeDevices: 0 // Will be populated by device registry
        };
    }
}

// ============================================
// HOME CREATION MANAGER
// ============================================

class HomeCreationManager {
    constructor() {
        this.homes = new Map();
        this.currentHome = null;
        this.listeners = [];
        
        this.init();
    }

    init() {
        this.loadHomes();
        HomeCreationConfig.debug && console.log('[HomeCreation] Manager initialized with', this.homes.size, 'homes');
    }

    loadHomes() {
        try {
            const saved = localStorage.getItem(HomeCreationConfig.storageKey);
            if (saved) {
                const homes = JSON.parse(saved);
                for (const homeData of homes) {
                    const home = new Home(homeData);
                    this.homes.set(home.id, home);
                }
                HomeCreationConfig.debug && console.log('[HomeCreation] Loaded', this.homes.size, 'homes');
            }
        } catch (error) {
            console.error('[HomeCreation] Failed to load homes:', error);
        }
    }

    saveHomes() {
        try {
            const homes = Array.from(this.homes.values()).map(h => h.toJSON());
            localStorage.setItem(HomeCreationConfig.storageKey, JSON.stringify(homes));
            HomeCreationConfig.debug && console.log('[HomeCreation] Saved', homes.length, 'homes');
        } catch (error) {
            console.error('[HomeCreation] Failed to save homes:', error);
        }
    }

    // ============================================
    // HOME CREATION
    // ============================================

    createHome(data, ownerId = null) {
        // Validate name
        if (!data.name || data.name.length < HomeCreationConfig.minNameLength) {
            throw new Error(`Home name must be at least ${HomeCreationConfig.minNameLength} characters`);
        }
        if (data.name.length > HomeCreationConfig.maxNameLength) {
            throw new Error(`Home name must be less than ${HomeCreationConfig.maxNameLength} characters`);
        }
        
        // Create home
        const home = new Home({
            ...data,
            ownerId: ownerId || this.getCurrentUserId()
        });
        
        // Add default rooms
        for (const roomData of HomeCreationConfig.defaultRooms) {
            home.addRoom(roomData);
        }
        
        // Add owner as member
        if (ownerId) {
            home.addMember({
                userId: ownerId,
                name: 'Owner',
                email: '',
                role: 'owner'
            });
        }
        
        this.homes.set(home.id, home);
        this.saveHomes();
        this.notifyListeners('home_created', home);
        
        return home;
    }

    updateHome(homeId, updates) {
        const home = this.homes.get(homeId);
        if (!home) return null;
        
        if (updates.name) home.name = updates.name;
        if (updates.nameAm) home.nameAm = updates.nameAm;
        if (updates.address !== undefined) home.address = updates.address;
        if (updates.city !== undefined) home.city = updates.city;
        if (updates.country !== undefined) home.country = updates.country;
        if (updates.zipCode !== undefined) home.zipCode = updates.zipCode;
        if (updates.settings) home.updateSettings(updates.settings);
        if (updates.image !== undefined) home.image = updates.image;
        if (updates.location !== undefined) home.location = updates.location;
        
        home.updatedAt = Date.now();
        this.saveHomes();
        this.notifyListeners('home_updated', home);
        
        return home;
    }

    deleteHome(homeId) {
        const home = this.homes.get(homeId);
        if (!home) return false;
        
        this.homes.delete(homeId);
        this.saveHomes();
        this.notifyListeners('home_deleted', home);
        
        if (this.currentHome === homeId) {
            this.setCurrentHome(null);
        }
        
        return true;
    }

    getHome(homeId) {
        return this.homes.get(homeId) || null;
    }

    getAllHomes() {
        return Array.from(this.homes.values());
    }

    getHomesByOwner(ownerId) {
        return this.getAllHomes().filter(h => h.ownerId === ownerId);
    }

    getHomesByMember(userId) {
        return this.getAllHomes().filter(h => h.members.some(m => m.userId === userId));
    }

    setCurrentHome(homeId) {
        this.currentHome = homeId;
        this.notifyListeners('current_home_changed', this.getHome(homeId));
    }

    getCurrentHome() {
        return this.getHome(this.currentHome);
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

    updateMemberRole(homeId, userId, role) {
        const home = this.homes.get(homeId);
        if (!home) return null;
        
        const member = home.updateMemberRole(userId, role);
        if (member) {
            this.saveHomes();
            this.notifyListeners('member_role_updated', { homeId, userId, role });
        }
        
        return member;
    }

    getMembers(homeId) {
        const home = this.homes.get(homeId);
        return home ? home.members : [];
    }

    // ============================================
    // DEVICE ASSIGNMENT
    // ============================================

    assignDeviceToHome(deviceId, homeId) {
        // Remove from current home
        for (const home of this.homes.values()) {
            if (home.devices.includes(deviceId)) {
                home.removeDevice(deviceId);
            }
        }
        
        // Add to new home
        const home = this.homes.get(homeId);
        if (home) {
            home.addDevice(deviceId);
            this.saveHomes();
            this.notifyListeners('device_assigned', { deviceId, homeId });
            return true;
        }
        
        return false;
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

    getCurrentUserId() {
        const user = JSON.parse(localStorage.getItem('estif_user') || '{}');
        return user.id || null;
    }

    getHomeStats() {
        const homes = this.getAllHomes();
        return {
            totalHomes: homes.length,
            totalRooms: homes.reduce((sum, h) => sum + h.rooms.length, 0),
            totalMembers: homes.reduce((sum, h) => sum + h.members.length, 0),
            totalDevices: homes.reduce((sum, h) => sum + h.devices.length, 0)
        };
    }

    exportHome(homeId) {
        const home = this.getHome(homeId);
        if (!home) return null;
        
        return {
            version: '1.0',
            exportedAt: Date.now(),
            home: home.toJSON()
        };
    }

    importHome(data) {
        try {
            const home = new Home(data.home);
            this.homes.set(home.id, home);
            this.saveHomes();
            this.notifyListeners('home_imported', home);
            return home;
        } catch (error) {
            console.error('[HomeCreation] Import failed:', error);
            return null;
        }
    }

    reset() {
        this.homes.clear();
        this.currentHome = null;
        this.saveHomes();
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
// HOME CREATION UI COMPONENT
// ============================================

class HomeCreationUI {
    constructor(manager) {
        this.manager = manager;
        this.init();
    }

    init() {
        this.createUI();
        this.bindEvents();
        this.render();
        HomeCreationConfig.debug && console.log('[HomeCreationUI] Initialized');
    }

    createUI() {
        const container = document.getElementById('home-creation-container');
        if (!container) return;

        container.innerHTML = `
            <div class="home-creation-panel">
                <div class="creation-header">
                    <i class="fas fa-home"></i>
                    <h3>My Homes</h3>
                    <button id="create-home-btn" class="btn btn-sm btn-primary">
                        <i class="fas fa-plus"></i> New Home
                    </button>
                </div>
                
                <div class="homes-grid" id="homes-grid"></div>
                
                <!-- Create Home Modal -->
                <div id="create-home-modal" class="modal-overlay" style="display: none;">
                    <div class="modal">
                        <div class="modal-header">
                            <h3>Create New Home</h3>
                            <button class="modal-close">&times;</button>
                        </div>
                        <div class="modal-body">
                            <form id="create-home-form">
                                <div class="form-group">
                                    <label>Home Name *</label>
                                    <input type="text" id="home-name" required>
                                </div>
                                <div class="form-group">
                                    <label>Home Name (Amharic)</label>
                                    <input type="text" id="home-name-am">
                                </div>
                                <div class="form-group">
                                    <label>Address</label>
                                    <input type="text" id="home-address">
                                </div>
                                <div class="form-row">
                                    <div class="form-group">
                                        <label>City</label>
                                        <input type="text" id="home-city">
                                    </div>
                                    <div class="form-group">
                                        <label>Country</label>
                                        <input type="text" id="home-country" value="Ethiopia">
                                    </div>
                                </div>
                            </form>
                        </div>
                        <div class="modal-footer">
                            <button id="cancel-home-btn" class="btn btn-secondary">Cancel</button>
                            <button id="save-home-btn" class="btn btn-primary">Create Home</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        this.cacheElements();
        this.bindUIEvents();
    }

    cacheElements() {
        this.homesGrid = document.getElementById('homes-grid');
        this.createBtn = document.getElementById('create-home-btn');
        this.modal = document.getElementById('create-home-modal');
        this.cancelBtn = document.getElementById('cancel-home-btn');
        this.saveBtn = document.getElementById('save-home-btn');
        this.form = document.getElementById('create-home-form');
    }

    bindUIEvents() {
        if (this.createBtn) {
            this.createBtn.addEventListener('click', () => this.showCreateModal());
        }
        
        if (this.cancelBtn) {
            this.cancelBtn.addEventListener('click', () => this.hideCreateModal());
        }
        
        if (this.saveBtn) {
            this.saveBtn.addEventListener('click', () => this.createHome());
        }
        
        document.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', () => this.hideCreateModal());
        });
    }

    bindEvents() {
        this.manager.addEventListener('home_created', () => this.render());
        this.manager.addEventListener('home_updated', () => this.render());
        this.manager.addEventListener('home_deleted', () => this.render());
        this.manager.addEventListener('current_home_changed', () => this.render());
    }

    render() {
        const homes = this.manager.getAllHomes();
        const currentHome = this.manager.getCurrentHome();
        
        if (homes.length === 0) {
            this.homesGrid.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-home"></i>
                    <p>No homes yet. Click "New Home" to create your first smart home.</p>
                </div>
            `;
            return;
        }
        
        this.homesGrid.innerHTML = homes.map(home => `
            <div class="home-card ${currentHome?.id === home.id ? 'active' : ''}" data-home-id="${home.id}">
                <div class="home-header">
                    <div class="home-icon">🏠</div>
                    <div class="home-info">
                        <div class="home-name">${this.escapeHtml(home.getDisplayName())}</div>
                        <div class="home-address">${this.escapeHtml(home.address || 'No address')}</div>
                    </div>
                    <div class="home-badge">
                        ${currentHome?.id === home.id ? '<span class="active-badge">Active</span>' : ''}
                    </div>
                </div>
                <div class="home-stats">
                    <div class="stat">
                        <span class="stat-value">${home.rooms.length}</span>
                        <span class="stat-label">Rooms</span>
                    </div>
                    <div class="stat">
                        <span class="stat-value">${home.members.length}</span>
                        <span class="stat-label">Members</span>
                    </div>
                    <div class="stat">
                        <span class="stat-value">${home.devices.length}</span>
                        <span class="stat-label">Devices</span>
                    </div>
                </div>
                <div class="home-actions">
                    <button class="home-action set-active" data-home-id="${home.id}" title="Set as Active">
                        <i class="fas fa-check-circle"></i> Activate
                    </button>
                    <button class="home-action edit" data-home-id="${home.id}" title="Edit">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="home-action delete" data-home-id="${home.id}" title="Delete">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `).join('');
        
        // Bind actions
        document.querySelectorAll('.set-active').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const homeId = btn.dataset.homeId;
                this.manager.setCurrentHome(homeId);
                this.showToast('Home activated', 'success');
            });
        });
        
        document.querySelectorAll('.edit').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const homeId = btn.dataset.homeId;
                this.editHome(homeId);
            });
        });
        
        document.querySelectorAll('.delete').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const homeId = btn.dataset.homeId;
                this.deleteHome(homeId);
            });
        });
    }

    showCreateModal() {
        this.modal.style.display = 'flex';
        document.getElementById('home-name').focus();
    }

    hideCreateModal() {
        this.modal.style.display = 'none';
        this.form.reset();
    }

    createHome() {
        const name = document.getElementById('home-name').value.trim();
        if (!name) {
            this.showToast('Home name is required', 'error');
            return;
        }
        
        const homeData = {
            name,
            nameAm: document.getElementById('home-name-am').value.trim(),
            address: document.getElementById('home-address').value.trim(),
            city: document.getElementById('home-city').value.trim(),
            country: document.getElementById('home-country').value.trim()
        };
        
        try {
            const home = this.manager.createHome(homeData);
            this.hideCreateModal();
            this.showToast(`Home "${home.name}" created successfully!`, 'success');
            this.manager.setCurrentHome(home.id);
        } catch (error) {
            this.showToast(error.message, 'error');
        }
    }

    editHome(homeId) {
        const home = this.manager.getHome(homeId);
        if (!home) return;
        
        const newName = prompt('Enter home name:', home.name);
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

const homeCreationStyles = `
    .home-creation-panel {
        background: var(--bg-card);
        border-radius: 12px;
        padding: 20px;
        border: 1px solid var(--border-color);
    }
    
    .creation-header {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 20px;
        padding-bottom: 12px;
        border-bottom: 1px solid var(--border-color);
    }
    
    .creation-header i {
        font-size: 20px;
        color: var(--primary);
    }
    
    .creation-header h3 {
        flex: 1;
        margin: 0;
    }
    
    .homes-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
        gap: 16px;
        max-height: 500px;
        overflow-y: auto;
    }
    
    .home-card {
        background: var(--bg-secondary);
        border-radius: 10px;
        padding: 16px;
        transition: all 0.2s ease;
        border: 1px solid var(--border-color);
    }
    
    .home-card:hover {
        transform: translateY(-2px);
        box-shadow: var(--shadow-md);
    }
    
    .home-card.active {
        border-color: var(--primary);
        background: linear-gradient(135deg, var(--bg-secondary), var(--primary-soft));
    }
    
    .home-header {
        display: flex;
        gap: 12px;
        margin-bottom: 12px;
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
    
    .home-address {
        font-size: 11px;
        color: var(--text-muted);
    }
    
    .active-badge {
        background: var(--success);
        color: white;
        padding: 2px 8px;
        border-radius: 12px;
        font-size: 10px;
    }
    
    .home-stats {
        display: flex;
        gap: 16px;
        margin-bottom: 16px;
        padding-bottom: 12px;
        border-bottom: 1px solid var(--border-light);
    }
    
    .stat {
        text-align: center;
    }
    
    .stat-value {
        font-size: 18px;
        font-weight: 600;
        color: var(--primary);
    }
    
    .stat-label {
        font-size: 10px;
        color: var(--text-muted);
    }
    
    .home-actions {
        display: flex;
        gap: 8px;
    }
    
    .home-action {
        flex: 1;
        background: var(--bg-tertiary);
        border: none;
        border-radius: 6px;
        padding: 6px;
        cursor: pointer;
        transition: all 0.2s ease;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 4px;
        font-size: 12px;
    }
    
    .home-action:hover {
        background: var(--primary);
        color: white;
    }
    
    .home-action.delete:hover {
        background: var(--danger);
    }
    
    .empty-state {
        text-align: center;
        padding: 60px;
        color: var(--text-muted);
    }
    
    .empty-state i {
        font-size: 48px;
        margin-bottom: 16px;
        opacity: 0.5;
    }
`;

// Inject styles
if (typeof document !== 'undefined') {
    const styleSheet = document.createElement('style');
    styleSheet.textContent = homeCreationStyles;
    document.head.appendChild(styleSheet);
}

// ============================================
// CREATE SINGLETON INSTANCES
// ============================================

const homeCreation = new HomeCreationManager();
const homeCreationUI = new HomeCreationUI(homeCreation);

// ============================================
// EXPORTS
// ============================================

// Expose to window
window.homeCreation = homeCreation;
window.homeCreationUI = homeCreationUI;
window.HomeCreationManager = HomeCreationManager;
window.HomeCreationConfig = HomeCreationConfig;

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        homeCreation,
        homeCreationUI,
        HomeCreationManager,
        HomeCreationConfig
    };
}

// ES modules export
export {
    homeCreation,
    homeCreationUI,
    HomeCreationManager,
    HomeCreationConfig
};