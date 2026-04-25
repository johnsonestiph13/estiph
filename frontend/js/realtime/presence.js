/**
 * ESTIF HOME ULTIMATE - PRESENCE MODULE
 * Real-time user presence tracking, online/offline status, and activity monitoring
 * Version: 2.0.0
 * Author: Estifanos Yohannis
 */

// ============================================
// PRESENCE CONFIGURATION
// ============================================

const PresenceConfig = {
    // Heartbeat settings
    heartbeatInterval: 30000, // 30 seconds
    timeoutThreshold: 90000, // 90 seconds
    
    // Status types
    statuses: {
        online: { name: 'Online', icon: '🟢', color: '#06d6a0' },
        away: { name: 'Away', icon: '🟡', color: '#ffd166' },
        busy: { name: 'Busy', icon: '🔴', color: '#ef476f' },
        offline: { name: 'Offline', icon: '⚫', color: '#6c757d' }
    },
    
    // Activity tracking
    trackActivities: ['viewing', 'editing', 'controlling'],
    
    // Storage
    storageKey: 'estif_presence_data',
    
    // Debug
    debug: false
};

// ============================================
// PRESENCE MANAGER
// ============================================

class PresenceManager {
    constructor(wsClient, store) {
        this.wsClient = wsClient;
        this.store = store;
        this.currentUser = null;
        this.users = new Map();
        this.heartbeatInterval = null;
        this.status = 'online';
        self.currentActivity = null;
        this.listeners = [];
        
        this.init();
    }

    init() {
        this.loadUsers();
        this.setCurrentUser();
        this.startHeartbeat();
        this.setupWebSocketHandlers();
        this.trackUserActivity();
        PresenceConfig.debug && console.log('[Presence] Manager initialized');
    }

    loadUsers() {
        try {
            const saved = localStorage.getItem(PresenceConfig.storageKey);
            if (saved) {
                const users = JSON.parse(saved);
                for (const [userId, userData] of Object.entries(users)) {
                    this.users.set(userId, userData);
                }
            }
        } catch (error) {
            console.error('[Presence] Failed to load users:', error);
        }
    }

    saveUsers() {
        try {
            const users = Object.fromEntries(this.users);
            localStorage.setItem(PresenceConfig.storageKey, JSON.stringify(users));
        } catch (error) {
            console.error('[Presence] Failed to save users:', error);
        }
    }

    setCurrentUser() {
        const user = JSON.parse(localStorage.getItem('estif_user') || '{}');
        this.currentUser = {
            id: user.id,
            name: user.name,
            avatar: user.avatar,
            status: this.status,
            lastSeen: Date.now(),
            currentActivity: null
        };
        
        this.users.set(this.currentUser.id, this.currentUser);
        this.saveUsers();
    }

    // ============================================
    // HEARTBEAT
    // ============================================

    startHeartbeat() {
        this.heartbeatInterval = setInterval(() => {
            this.sendHeartbeat();
        }, PresenceConfig.heartbeatInterval);
        
        window.addEventListener('beforeunload', () => {
            this.setStatus('offline');
            this.sendHeartbeat();
        });
    }

    stopHeartbeat() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
    }

    sendHeartbeat() {
        const presenceData = {
            userId: this.currentUser.id,
            status: this.status,
            lastSeen: Date.now(),
            currentActivity: this.currentActivity,
            timestamp: Date.now()
        };
        
        if (this.wsClient && this.wsClient.isConnected()) {
            this.wsClient.send('presence_update', presenceData);
        }
        
        // Update local
        this.currentUser.lastSeen = Date.now();
        this.users.set(this.currentUser.id, this.currentUser);
        this.saveUsers();
    }

    // ============================================
    // STATUS MANAGEMENT
    // ============================================

    setStatus(status) {
        if (!PresenceConfig.statuses[status]) return;
        
        this.status = status;
        this.currentUser.status = status;
        this.sendHeartbeat();
        this.notifyListeners('status_changed', { userId: this.currentUser.id, status });
    }

    getStatus(userId) {
        const user = this.users.get(userId);
        return user?.status || 'offline';
    }

    isOnline(userId) {
        const user = this.users.get(userId);
        if (!user) return false;
        
        const isRecent = Date.now() - user.lastSeen < PresenceConfig.timeoutThreshold;
        return isRecent && user.status !== 'offline';
    }

    // ============================================
    // ACTIVITY TRACKING
    // ============================================

    trackUserActivity() {
        // Track page views
        const trackView = () => {
            const currentPage = window.location.pathname;
            this.setActivity('viewing', currentPage);
        };
        
        // Track editing (input focus)
        document.addEventListener('focusin', (e) => {
            if (e.target.matches('input, textarea, [contenteditable]')) {
                this.setActivity('editing', e.target.name || 'form');
            }
        });
        
        // Track device control (custom event)
        window.addEventListener('device_control', (e) => {
            this.setActivity('controlling', e.detail?.deviceId);
        });
        
        // Track page navigation
        window.addEventListener('popstate', trackView);
        trackView();
    }

    setActivity(type, context) {
        if (!PresenceConfig.trackActivities.includes(type)) return;
        
        this.currentActivity = { type, context, timestamp: Date.now() };
        this.currentUser.currentActivity = this.currentActivity;
        this.sendHeartbeat();
        this.notifyListeners('activity_changed', { userId: this.currentUser.id, activity: this.currentActivity });
    }

    getUserActivity(userId) {
        const user = this.users.get(userId);
        return user?.currentActivity || null;
    }

    // ============================================
    // WEB SOCKET HANDLERS
    // ============================================

    setupWebSocketHandlers() {
        if (!this.wsClient) return;
        
        this.wsClient.on('presence_update', (data) => {
            this.handlePresenceUpdate(data);
        });
        
        this.wsClient.on('presence_batch', (batch) => {
            batch.forEach(data => this.handlePresenceUpdate(data));
        });
    }

    handlePresenceUpdate(data) {
        const { userId, status, lastSeen, currentActivity } = data;
        
        const user = this.users.get(userId) || {
            id: userId,
            name: userId,
            status: 'offline'
        };
        
        user.status = status;
        user.lastSeen = lastSeen;
        user.currentActivity = currentActivity;
        
        this.users.set(userId, user);
        this.saveUsers();
        
        this.notifyListeners('presence_updated', { userId, status, lastSeen, currentActivity });
    }

    // ============================================
    // USER MANAGEMENT
    // ============================================

    updateUser(userData) {
        const user = this.users.get(userData.id);
        if (user) {
            Object.assign(user, userData);
            this.users.set(userData.id, user);
            this.saveUsers();
            this.notifyListeners('user_updated', user);
        }
    }

    removeUser(userId) {
        this.users.delete(userId);
        this.saveUsers();
        this.notifyListeners('user_removed', { userId });
    }

    getAllUsers() {
        return Array.from(this.users.values());
    }

    getOnlineUsers() {
        return this.getAllUsers().filter(user => this.isOnline(user.id));
    }

    getUserCount() {
        return this.users.size;
    }

    getOnlineCount() {
        return this.getOnlineUsers().length;
    }

    // ============================================
    // STATUS HELPERS
    // ============================================

    getStatusIcon(status) {
        return PresenceConfig.statuses[status]?.icon || '⚫';
    }

    getStatusColor(status) {
        return PresenceConfig.statuses[status]?.color || '#6c757d';
    }

    getStatusName(status) {
        return PresenceConfig.statuses[status]?.name || 'Offline';
    }

    formatLastSeen(timestamp) {
        const seconds = Math.floor((Date.now() - timestamp) / 1000);
        
        if (seconds < 60) return 'just now';
        if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
        if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
        return new Date(timestamp).toLocaleDateString();
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
// PRESENCE UI COMPONENT
// ============================================

class PresenceUI {
    constructor(presenceManager) {
        this.presenceManager = presenceManager;
        this.init();
    }

    init() {
        this.createUI();
        this.bindEvents();
        this.startUpdates();
        PresenceConfig.debug && console.log('[PresenceUI] Initialized');
    }

    createUI() {
        const container = document.getElementById('presence-container');
        if (!container) return;

        container.innerHTML = `
            <div class="presence-panel">
                <div class="presence-header">
                    <i class="fas fa-users"></i>
                    <h3>Online Users</h3>
                    <span class="online-count" id="online-count">0</span>
                </div>
                <div class="users-list" id="users-list"></div>
            </div>
        `;

        this.cacheElements();
    }

    cacheElements() {
        this.onlineCount = document.getElementById('online-count');
        this.usersList = document.getElementById('users-list');
    }

    bindEvents() {
        this.presenceManager.addEventListener('presence_updated', () => this.render());
        this.presenceManager.addEventListener('user_updated', () => this.render());
        this.presenceManager.addEventListener('user_removed', () => this.render());
    }

    startUpdates() {
        setInterval(() => this.render(), 1000);
    }

    render() {
        const onlineUsers = this.presenceManager.getOnlineUsers();
        const allUsers = this.presenceManager.getAllUsers();
        
        this.onlineCount.textContent = onlineUsers.length;
        
        if (allUsers.length === 0) {
            this.usersList.innerHTML = '<div class="no-users">No users online</div>';
            return;
        }
        
        this.usersList.innerHTML = allUsers.map(user => {
            const isOnline = this.presenceManager.isOnline(user.id);
            const statusIcon = this.presenceManager.getStatusIcon(user.status);
            const lastSeen = this.presenceManager.formatLastSeen(user.lastSeen);
            const activityText = user.currentActivity ? `${user.currentActivity.type} ${user.currentActivity.context}` : '';
            
            return `
                <div class="user-item ${isOnline ? 'online' : 'offline'}">
                    <div class="user-avatar">
                        <img src="${user.avatar || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(user.name) + '&background=4361ee&color=fff'}" alt="${user.name}">
                        <span class="status-indicator" style="background: ${this.presenceManager.getStatusColor(user.status)}">${statusIcon}</span>
                    </div>
                    <div class="user-info">
                        <div class="user-name">${this.escapeHtml(user.name)}</div>
                        <div class="user-status">${this.presenceManager.getStatusName(user.status)}</div>
                        ${activityText ? `<div class="user-activity">${this.escapeHtml(activityText)}</div>` : ''}
                        ${!isOnline ? `<div class="user-lastseen">Last seen ${lastSeen}</div>` : ''}
                    </div>
                </div>
            `;
        }).join('');
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// ============================================
// CREATE SINGLETON INSTANCES
// ============================================

let presenceManager = null;
let presenceUI = null;

const initPresence = (wsClient, store) => {
    presenceManager = new PresenceManager(wsClient, store);
    presenceUI = new PresenceUI(presenceManager);
    return { presenceManager, presenceUI };
};

// Exports
window.PresenceManager = PresenceManager;
window.initPresence = initPresence;

export { presenceManager, presenceUI, PresenceManager, PresenceConfig, initPresence };