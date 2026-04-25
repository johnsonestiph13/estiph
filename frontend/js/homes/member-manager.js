/**
 * ESTIF HOME ULTIMATE - MEMBER MANAGER MODULE
 * Manage home members, roles, permissions, and member settings
 * Version: 2.0.0
 * Author: Estifanos Yohannis
 */

// ============================================
// MEMBER MANAGER CONFIGURATION
// ============================================

const MemberManagerConfig = {
    // Role definitions
    roles: {
        owner: {
            level: 100,
            name: 'Owner',
            nameAm: 'ባለቤት',
            icon: '👑',
            permissions: ['all'],
            color: '#ffd166'
        },
        admin: {
            level: 80,
            name: 'Admin',
            nameAm: 'አስተዳዳሪ',
            icon: '🛡️',
            permissions: ['manage_members', 'manage_devices', 'manage_automation', 'view_analytics', 'manage_settings'],
            color: '#4361ee'
        },
        member: {
            level: 50,
            name: 'Member',
            nameAm: 'አባል',
            icon: '👤',
            permissions: ['control_devices', 'view_devices', 'view_automation', 'view_analytics'],
            color: '#06d6a0'
        },
        guest: {
            level: 20,
            name: 'Guest',
            nameAm: 'እንግዳ',
            icon: '🚪',
            permissions: ['view_devices', 'control_limited'],
            color: '#7209b7'
        }
    },
    
    // Permission definitions
    permissions: {
        manage_members: { name: 'Manage Members', description: 'Add, remove, and modify member roles' },
        manage_devices: { name: 'Manage Devices', description: 'Add, remove, and configure devices' },
        manage_automation: { name: 'Manage Automation', description: 'Create and edit automation rules' },
        control_devices: { name: 'Control Devices', description: 'Turn devices on/off' },
        view_devices: { name: 'View Devices', description: 'See device status and information' },
        view_automation: { name: 'View Automation', description: 'See automation rules' },
        view_analytics: { name: 'View Analytics', description: 'Access energy and usage analytics' },
        manage_settings: { name: 'Manage Settings', description: 'Change home settings' },
        control_limited: { name: 'Limited Control', description: 'Control only guest-allowed devices' }
    },
    
    // Storage
    storageKey: 'estif_member_preferences',
    
    // Debug
    debug: false
};

// ============================================
// MEMBER CLASS
// ============================================

class HomeMember {
    constructor(data) {
        this.userId = data.userId;
        this.name = data.name;
        this.nameAm = data.nameAm || data.name;
        this.email = data.email;
        this.avatar = data.avatar || this.getDefaultAvatar();
        this.role = data.role || 'member';
        this.permissions = data.permissions || this.getDefaultPermissions(data.role);
        this.joinedAt = data.joinedAt || Date.now();
        this.lastActive = data.lastActive || Date.now();
        this.invitedBy = data.invitedBy || null;
        this.settings = data.settings || {
            notifications: true,
            emailUpdates: true,
            language: 'en'
        };
        this.isActive = data.isActive !== undefined ? data.isActive : true;
        this.metadata = data.metadata || {};
    }

    getDefaultAvatar() {
        const initials = (this.name || 'U').charAt(0).toUpperCase();
        return `https://ui-avatars.com/api/?name=${initials}&background=4361ee&color=fff`;
    }

    getDefaultPermissions(role) {
        return MemberManagerConfig.roles[role]?.permissions || MemberManagerConfig.roles.member.permissions;
    }

    hasPermission(permission) {
        if (this.role === 'owner') return true;
        return this.permissions.includes(permission);
    }

    update(data) {
        if (data.name !== undefined) this.name = data.name;
        if (data.nameAm !== undefined) this.nameAm = data.nameAm;
        if (data.avatar !== undefined) this.avatar = data.avatar;
        if (data.role !== undefined) {
            this.role = data.role;
            this.permissions = this.getDefaultPermissions(data.role);
        }
        if (data.permissions !== undefined) this.permissions = data.permissions;
        if (data.settings !== undefined) this.settings = { ...this.settings, ...data.settings };
        if (data.isActive !== undefined) this.isActive = data.isActive;
        this.lastActive = Date.now();
    }

    toJSON() {
        return {
            userId: this.userId,
            name: this.name,
            nameAm: this.nameAm,
            email: this.email,
            avatar: this.avatar,
            role: this.role,
            permissions: this.permissions,
            joinedAt: this.joinedAt,
            lastActive: this.lastActive,
            invitedBy: this.invitedBy,
            settings: this.settings,
            isActive: this.isActive,
            metadata: this.metadata
        };
    }
}

// ============================================
// MEMBER MANAGER
// ============================================

class MemberManager {
    constructor(homeManager) {
        this.homeManager = homeManager;
        this.memberPreferences = new Map();
        this.listeners = [];
        
        this.init();
    }

    init() {
        this.loadPreferences();
        MemberManagerConfig.debug && console.log('[MemberManager] Initialized');
    }

    loadPreferences() {
        try {
            const saved = localStorage.getItem(MemberManagerConfig.storageKey);
            if (saved) {
                this.memberPreferences = new Map(JSON.parse(saved));
            }
        } catch (error) {
            console.error('[MemberManager] Failed to load preferences:', error);
        }
    }

    savePreferences() {
        try {
            localStorage.setItem(MemberManagerConfig.storageKey, JSON.stringify(Array.from(this.memberPreferences.entries())));
        } catch (error) {
            console.error('[MemberManager] Failed to save preferences:', error);
        }
    }

    // ============================================
    // MEMBER MANAGEMENT
    // ============================================

    getMembers(homeId) {
        const home = this.homeManager.getHome(homeId);
        if (!home) return [];
        
        return home.members.map(m => new HomeMember(m));
    }

    getMember(homeId, userId) {
        const home = this.homeManager.getHome(homeId);
        if (!home) return null;
        
        const member = home.members.find(m => m.userId === userId);
        return member ? new HomeMember(member) : null;
    }

    addMember(homeId, memberData) {
        const home = this.homeManager.getHome(homeId);
        if (!home) {
            throw new Error('Home not found');
        }
        
        // Check permission
        if (!this.canManageMembers(homeId)) {
            throw new Error('You do not have permission to add members');
        }
        
        // Check if already a member
        const existing = home.members.find(m => m.userId === memberData.userId);
        if (existing) {
            throw new Error('User is already a member');
        }
        
        const currentUser = this.getCurrentUser();
        const member = new HomeMember({
            ...memberData,
            invitedBy: currentUser.id
        });
        
        home.addMember(member);
        this.homeManager.saveHomes();
        
        this.notifyListeners('member_added', { homeId, member });
        
        return member;
    }

    updateMember(homeId, userId, updates) {
        const home = this.homeManager.getHome(homeId);
        if (!home) {
            throw new Error('Home not found');
        }
        
        // Check permission
        if (!this.canManageMembers(homeId) && userId !== this.getCurrentUserId()) {
            throw new Error('You do not have permission to update members');
        }
        
        const memberIndex = home.members.findIndex(m => m.userId === userId);
        if (memberIndex === -1) {
            throw new Error('Member not found');
        }
        
        const member = new HomeMember(home.members[memberIndex]);
        member.update(updates);
        
        home.members[memberIndex] = member;
        this.homeManager.saveHomes();
        
        this.notifyListeners('member_updated', { homeId, userId, updates });
        
        return member;
    }

    removeMember(homeId, userId) {
        const home = this.homeManager.getHome(homeId);
        if (!home) {
            throw new Error('Home not found');
        }
        
        // Check permission
        if (!this.canManageMembers(homeId)) {
            throw new Error('You do not have permission to remove members');
        }
        
        // Cannot remove owner
        const member = home.members.find(m => m.userId === userId);
        if (member?.role === 'owner') {
            throw new Error('Cannot remove the home owner');
        }
        
        const removed = home.removeMember(userId);
        if (removed) {
            this.homeManager.saveHomes();
            this.notifyListeners('member_removed', { homeId, userId });
        }
        
        return removed;
    }

    // ============================================
    // ROLE MANAGEMENT
    // ============================================

    changeRole(homeId, userId, newRole) {
        const home = this.homeManager.getHome(homeId);
        if (!home) {
            throw new Error('Home not found');
        }
        
        // Check permission
        if (!this.canManageMembers(homeId)) {
            throw new Error('You do not have permission to change roles');
        }
        
        const member = home.members.find(m => m.userId === userId);
        if (!member) {
            throw new Error('Member not found');
        }
        
        // Cannot change owner role
        if (member.role === 'owner') {
            throw new Error('Cannot change the home owner\'s role');
        }
        
        member.role = newRole;
        member.permissions = MemberManagerConfig.roles[newRole]?.permissions || [];
        
        this.homeManager.saveHomes();
        this.notifyListeners('role_changed', { homeId, userId, oldRole: member.role, newRole });
        
        return member;
    }

    getAvailableRoles() {
        return Object.entries(MemberManagerConfig.roles).map(([key, value]) => ({
            id: key,
            name: value.name,
            nameAm: value.nameAm,
            level: value.level,
            icon: value.icon,
            color: value.color
        }));
    }

    getRoleInfo(role) {
        return MemberManagerConfig.roles[role] || MemberManagerConfig.roles.member;
    }

    // ============================================
    // PERMISSIONS
    // ============================================

    getAvailablePermissions() {
        return Object.entries(MemberManagerConfig.permissions).map(([key, value]) => ({
            id: key,
            name: value.name,
            description: value.description
        }));
    }

    hasPermission(homeId, userId, permission) {
        const member = this.getMember(homeId, userId);
        if (!member) return false;
        
        return member.hasPermission(permission);
    }

    canManageMembers(homeId) {
        const currentUserId = this.getCurrentUserId();
        const member = this.getMember(homeId, currentUserId);
        
        if (!member) return false;
        return member.role === 'owner' || member.role === 'admin';
    }

    // ============================================
    // MEMBER PREFERENCES
    // ============================================

    getMemberPreference(homeId, userId, key, defaultValue = null) {
        const prefKey = `${homeId}_${userId}`;
        const prefs = this.memberPreferences.get(prefKey) || {};
        return prefs[key] !== undefined ? prefs[key] : defaultValue;
    }

    setMemberPreference(homeId, userId, key, value) {
        const prefKey = `${homeId}_${userId}`;
        let prefs = this.memberPreferences.get(prefKey) || {};
        prefs = { ...prefs, [key]: value };
        this.memberPreferences.set(prefKey, prefs);
        this.savePreferences();
        
        this.notifyListeners('preference_updated', { homeId, userId, key, value });
    }

    // ============================================
    // ACTIVITY TRACKING
    // ============================================

    updateLastActive(homeId, userId) {
        const home = this.homeManager.getHome(homeId);
        if (!home) return;
        
        const member = home.members.find(m => m.userId === userId);
        if (member) {
            member.lastActive = Date.now();
            this.homeManager.saveHomes();
        }
    }

    getMemberActivity(homeId, userId, days = 7) {
        // In production, fetch from server
        const member = this.getMember(homeId, userId);
        if (!member) return null;
        
        return {
            userId,
            name: member.name,
            lastActive: member.lastActive,
            joinedAt: member.joinedAt,
            isActive: member.isActive
        };
    }

    // ============================================
    // BULK OPERATIONS
    // ============================================

    async inviteMembers(homeId, emails, role = 'member') {
        const results = [];
        
        for (const email of emails) {
            try {
                // Create invite
                const invite = { email, role };
                results.push({ email, success: true, invite });
            } catch (error) {
                results.push({ email, success: false, error: error.message });
            }
        }
        
        this.notifyListeners('bulk_invite_completed', { homeId, results });
        return results;
    }

    async removeMultipleMembers(homeId, userIds) {
        const results = [];
        
        for (const userId of userIds) {
            try {
                const removed = this.removeMember(homeId, userId);
                results.push({ userId, success: removed });
            } catch (error) {
                results.push({ userId, success: false, error: error.message });
            }
        }
        
        this.notifyListeners('bulk_remove_completed', { homeId, results });
        return results;
    }

    // ============================================
    // UTILITY
    // ============================================

    getCurrentUser() {
        const user = JSON.parse(localStorage.getItem('estif_user') || '{}');
        return {
            id: user.id,
            name: user.name,
            email: user.email
        };
    }

    getCurrentUserId() {
        const user = this.getCurrentUser();
        return user.id;
    }

    getMemberStats(homeId) {
        const members = this.getMembers(homeId);
        
        return {
            total: members.length,
            byRole: {
                owner: members.filter(m => m.role === 'owner').length,
                admin: members.filter(m => m.role === 'admin').length,
                member: members.filter(m => m.role === 'member').length,
                guest: members.filter(m => m.role === 'guest').length
            },
            activeToday: members.filter(m => Date.now() - m.lastActive < 24 * 60 * 60 * 1000).length,
            newThisWeek: members.filter(m => Date.now() - m.joinedAt < 7 * 24 * 60 * 60 * 1000).length
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
// MEMBER MANAGER UI COMPONENT
// ============================================

class MemberManagerUI {
    constructor(memberManager, homeManager) {
        this.memberManager = memberManager;
        this.homeManager = homeManager;
        this.currentHomeId = null;
        this.currentFilter = 'all';
        
        this.init();
    }

    init() {
        this.createUI();
        this.bindEvents();
        this.render();
        MemberManagerConfig.debug && console.log('[MemberManagerUI] Initialized');
    }

    createUI() {
        const container = document.getElementById('member-manager-container');
        if (!container) return;

        container.innerHTML = `
            <div class="member-manager-panel">
                <div class="member-header">
                    <i class="fas fa-users"></i>
                    <h3>Home Members</h3>
                    <button id="invite-member-btn" class="btn btn-sm btn-primary">
                        <i class="fas fa-user-plus"></i> Invite
                    </button>
                </div>
                
                <div class="member-stats" id="member-stats"></div>
                
                <div class="member-filters">
                    <button class="filter-btn active" data-filter="all">All</button>
                    <button class="filter-btn" data-filter="admin">Admins</button>
                    <button class="filter-btn" data-filter="member">Members</button>
                    <button class="filter-btn" data-filter="guest">Guests</button>
                </div>
                
                <div class="member-list" id="member-list"></div>
                
                <!-- Edit Member Modal -->
                <div id="edit-member-modal" class="modal-overlay" style="display: none;">
                    <div class="modal">
                        <div class="modal-header">
                            <h3>Edit Member</h3>
                            <button class="modal-close">&times;</button>
                        </div>
                        <div class="modal-body">
                            <form id="edit-member-form">
                                <div class="form-group">
                                    <label>Name</label>
                                    <input type="text" id="edit-name" class="form-input">
                                </div>
                                <div class="form-group">
                                    <label>Role</label>
                                    <select id="edit-role" class="form-select">
                                        ${this.memberManager.getAvailableRoles().filter(r => r.id !== 'owner').map(role => `
                                            <option value="${role.id}">${role.name}</option>
                                        `).join('')}
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label class="checkbox-label">
                                        <input type="checkbox" id="edit-notifications">
                                        Receive notifications
                                    </label>
                                </div>
                            </form>
                        </div>
                        <div class="modal-footer">
                            <button id="cancel-edit" class="btn btn-secondary">Cancel</button>
                            <button id="save-edit" class="btn btn-primary">Save Changes</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        this.cacheElements();
        this.bindUIEvents();
    }

    cacheElements() {
        this.statsContainer = document.getElementById('member-stats');
        this.memberList = document.getElementById('member-list');
        this.inviteBtn = document.getElementById('invite-member-btn');
        this.editModal = document.getElementById('edit-member-modal');
        this.editName = document.getElementById('edit-name');
        this.editRole = document.getElementById('edit-role');
        this.editNotifications = document.getElementById('edit-notifications');
    }

    bindUIEvents() {
        if (this.inviteBtn) {
            this.inviteBtn.addEventListener('click', () => this.showInviteDialog());
        }
        
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.currentFilter = btn.dataset.filter;
                this.renderMembers();
            });
        });
        
        document.getElementById('cancel-edit')?.addEventListener('click', () => this.closeEditModal());
        document.getElementById('save-edit')?.addEventListener('click', () => this.saveMemberEdit());
        document.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', () => this.closeEditModal());
        });
    }

    bindEvents() {
        this.homeManager.addEventListener('current_home_changed', () => this.onHomeChange());
        this.memberManager.addEventListener('member_added', () => this.render());
        this.memberManager.addEventListener('member_updated', () => this.render());
        this.memberManager.addEventListener('member_removed', () => this.render());
        this.memberManager.addEventListener('role_changed', () => this.render());
    }

    onHomeChange() {
        const currentHome = this.homeManager.getCurrentHome();
        this.currentHomeId = currentHome?.id;
        this.render();
    }

    render() {
        if (!this.currentHomeId) {
            this.memberList.innerHTML = '<div class="no-members">Select a home to view members</div>';
            return;
        }
        
        this.renderStats();
        this.renderMembers();
    }

    renderStats() {
        const stats = this.memberManager.getMemberStats(this.currentHomeId);
        
        this.statsContainer.innerHTML = `
            <div class="stat-card">
                <div class="stat-value">${stats.total}</div>
                <div class="stat-label">Total Members</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${stats.activeToday}</div>
                <div class="stat-label">Active Today</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${stats.newThisWeek}</div>
                <div class="stat-label">New This Week</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${stats.byRole.admin}</div>
                <div class="stat-label">Admins</div>
            </div>
        `;
    }

    renderMembers() {
        let members = this.memberManager.getMembers(this.currentHomeId);
        
        // Apply filter
        if (this.currentFilter !== 'all') {
            members = members.filter(m => m.role === this.currentFilter);
        }
        
        if (members.length === 0) {
            this.memberList.innerHTML = '<div class="no-members">No members found</div>';
            return;
        }
        
        const currentUserId = this.memberManager.getCurrentUserId();
        const canManage = this.memberManager.canManageMembers(this.currentHomeId);
        
        this.memberList.innerHTML = members.map(member => {
            const roleInfo = this.memberManager.getRoleInfo(member.role);
            const isCurrentUser = member.userId === currentUserId;
            
            return `
                <div class="member-card" data-user-id="${member.userId}">
                    <div class="member-avatar">
                        <img src="${member.avatar}" alt="${member.name}" onerror="this.src='https://ui-avatars.com/api/?name=${member.name.charAt(0)}&background=4361ee&color=fff'">
                        ${member.isActive ? '<span class="online-dot"></span>' : ''}
                    </div>
                    <div class="member-info">
                        <div class="member-name">${this.escapeHtml(member.name)}</div>
                        <div class="member-email">${this.escapeHtml(member.email)}</div>
                        <div class="member-role" style="color: ${roleInfo.color}">
                            <i class="${member.role === 'owner' ? 'fas fa-crown' : 'fas fa-user-tag'}"></i>
                            ${roleInfo.name}
                        </div>
                    </div>
                    <div class="member-stats">
                        <div class="stat">
                            <span class="stat-label">Joined</span>
                            <span class="stat-value">${new Date(member.joinedAt).toLocaleDateString()}</span>
                        </div>
                        <div class="stat">
                            <span class="stat-label">Last Active</span>
                            <span class="stat-value">${this.getRelativeTime(member.lastActive)}</span>
                        </div>
                    </div>
                    ${canManage && !isCurrentUser && member.role !== 'owner' ? `
                        <div class="member-actions">
                            <button class="edit-member" data-user-id="${member.userId}" title="Edit Member">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="remove-member" data-user-id="${member.userId}" title="Remove Member">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    ` : ''}
                </div>
            `;
        }).join('');
        
        // Bind edit buttons
        document.querySelectorAll('.edit-member').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const userId = btn.dataset.userId;
                this.editMember(userId);
            });
        });
        
        // Bind remove buttons
        document.querySelectorAll('.remove-member').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const userId = btn.dataset.userId;
                this.removeMember(userId);
            });
        });
    }

    showInviteDialog() {
        const email = prompt('Enter email address to invite:');
        if (email) {
            const role = prompt('Enter role (admin/member/guest):', 'member');
            if (role && ['admin', 'member', 'guest'].includes(role)) {
                try {
                    this.memberManager.addMember(this.currentHomeId, {
                        userId: 'temp_' + Date.now(),
                        name: email.split('@')[0],
                        email: email,
                        role: role
                    });
                    this.showToast(`Invitation sent to ${email}`, 'success');
                } catch (error) {
                    this.showToast(error.message, 'error');
                }
            }
        }
    }

    editMember(userId) {
        const member = this.memberManager.getMember(this.currentHomeId, userId);
        if (!member) return;
        
        this.editName.value = member.name;
        this.editRole.value = member.role;
        this.editNotifications.checked = member.settings?.notifications || false;
        this.currentEditUserId = userId;
        
        this.editModal.style.display = 'flex';
    }

    saveMemberEdit() {
        const updates = {
            name: this.editName.value,
            role: this.editRole.value,
            settings: {
                notifications: this.editNotifications.checked
            }
        };
        
        try {
            this.memberManager.updateMember(this.currentHomeId, this.currentEditUserId, updates);
            this.showToast('Member updated successfully', 'success');
            this.closeEditModal();
            this.render();
        } catch (error) {
            this.showToast(error.message, 'error');
        }
    }

    removeMember(userId) {
        if (confirm('Are you sure you want to remove this member?')) {
            try {
                this.memberManager.removeMember(this.currentHomeId, userId);
                this.showToast('Member removed successfully', 'success');
                this.render();
            } catch (error) {
                this.showToast(error.message, 'error');
            }
        }
    }

    closeEditModal() {
        this.editModal.style.display = 'none';
        this.currentEditUserId = null;
    }

    getRelativeTime(timestamp) {
        const seconds = Math.floor((Date.now() - timestamp) / 1000);
        
        if (seconds < 60) return 'just now';
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes}m ago`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}h ago`;
        const days = Math.floor(hours / 24);
        if (days < 7) return `${days}d ago`;
        return new Date(timestamp).toLocaleDateString();
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

const memberManagerStyles = `
    .member-manager-panel {
        background: var(--bg-card);
        border-radius: 12px;
        padding: 20px;
        border: 1px solid var(--border-color);
    }
    
    .member-header {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 20px;
        padding-bottom: 12px;
        border-bottom: 1px solid var(--border-color);
    }
    
    .member-header i {
        font-size: 20px;
        color: var(--primary);
    }
    
    .member-header h3 {
        flex: 1;
        margin: 0;
    }
    
    .member-stats {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
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
    
    .member-filters {
        display: flex;
        gap: 8px;
        margin-bottom: 16px;
        flex-wrap: wrap;
    }
    
    .filter-btn {
        padding: 6px 12px;
        background: var(--bg-tertiary);
        border: none;
        border-radius: 20px;
        cursor: pointer;
        transition: all 0.2s ease;
    }
    
    .filter-btn.active {
        background: var(--primary);
        color: white;
    }
    
    .member-list {
        max-height: 500px;
        overflow-y: auto;
    }
    
    .member-card {
        display: flex;
        align-items: center;
        gap: 16px;
        padding: 16px;
        background: var(--bg-secondary);
        border-radius: 10px;
        margin-bottom: 12px;
        transition: all 0.2s ease;
    }
    
    .member-card:hover {
        transform: translateX(4px);
    }
    
    .member-avatar {
        position: relative;
        width: 48px;
        height: 48px;
    }
    
    .member-avatar img {
        width: 100%;
        height: 100%;
        border-radius: 50%;
        object-fit: cover;
    }
    
    .online-dot {
        position: absolute;
        bottom: 0;
        right: 0;
        width: 12px;
        height: 12px;
        background: var(--success);
        border-radius: 50%;
        border: 2px solid var(--bg-secondary);
    }
    
    .member-info {
        flex: 1;
    }
    
    .member-name {
        font-weight: 500;
        margin-bottom: 4px;
    }
    
    .member-email {
        font-size: 12px;
        color: var(--text-muted);
        margin-bottom: 4px;
    }
    
    .member-role {
        font-size: 11px;
        display: flex;
        align-items: center;
        gap: 4px;
    }
    
    .member-stats {
        display: flex;
        gap: 16px;
        padding: 0 16px;
        border-left: 1px solid var(--border-light);
        border-right: 1px solid var(--border-light);
    }
    
    .member-stats .stat {
        text-align: center;
    }
    
    .member-stats .stat-label {
        font-size: 10px;
    }
    
    .member-stats .stat-value {
        font-size: 12px;
        font-weight: normal;
    }
    
    .member-actions {
        display: flex;
        gap: 8px;
    }
    
    .edit-member, .remove-member {
        background: var(--bg-tertiary);
        border: none;
        border-radius: 6px;
        padding: 6px;
        cursor: pointer;
        transition: all 0.2s ease;
    }
    
    .edit-member:hover {
        background: var(--info);
        color: white;
    }
    
    .remove-member:hover {
        background: var(--danger);
        color: white;
    }
    
    .no-members {
        text-align: center;
        color: var(--text-muted);
        padding: 40px;
    }
`;

// Inject styles
if (typeof document !== 'undefined') {
    const styleSheet = document.createElement('style');
    styleSheet.textContent = memberManagerStyles;
    document.head.appendChild(styleSheet);
}

// ============================================
// CREATE SINGLETON INSTANCES
// ============================================

let memberManager = null;
let memberManagerUI = null;

const initMemberManager = (homeManager) => {
    memberManager = new MemberManager(homeManager);
    memberManagerUI = new MemberManagerUI(memberManager, homeManager);
    return { memberManager, memberManagerUI };
};

// ============================================
// EXPORTS
// ============================================

// Expose to window
window.MemberManager = MemberManager;
window.MemberManagerConfig = MemberManagerConfig;
window.initMemberManager = initMemberManager;

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        memberManager,
        memberManagerUI,
        MemberManager,
        MemberManagerConfig,
        initMemberManager
    };
}

// ES modules export
export {
    memberManager,
    memberManagerUI,
    MemberManager,
    MemberManagerConfig,
    initMemberManager
};