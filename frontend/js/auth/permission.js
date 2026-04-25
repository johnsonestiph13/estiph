/**
 * ESTIF HOME ULTIMATE - PERMISSION MANAGEMENT MODULE
 * Role-based access control (RBAC) with granular permissions
 * Version: 2.0.0
 * Author: Estifanos Yohannis
 */

// ============================================
// PERMISSION CONFIGURATION
// ============================================

const PermissionConfig = {
    // Role definitions
    roles: {
        super_admin: {
            level: 100,
            name: 'Super Administrator',
            description: 'Full system access with all permissions',
            color: '#ef476f'
        },
        admin: {
            level: 80,
            name: 'Administrator',
            description: 'Full access to home management and user settings',
            color: '#4361ee'
        },
        home_owner: {
            level: 60,
            name: 'Home Owner',
            description: 'Complete control over their own home',
            color: '#06d6a0'
        },
        home_admin: {
            level: 50,
            name: 'Home Admin',
            description: 'Manage home settings and members',
            color: '#4cc9f0'
        },
        member: {
            level: 30,
            name: 'Member',
            description: 'Control devices and view analytics',
            color: '#7209b7'
        },
        guest: {
            level: 10,
            name: 'Guest',
            description: 'Limited access to basic controls',
            color: '#6c757d'
        }
    },
    
    // Permission definitions
    permissions: {
        // User management
        'user:view': ['super_admin', 'admin'],
        'user:create': ['super_admin', 'admin'],
        'user:edit': ['super_admin', 'admin'],
        'user:delete': ['super_admin'],
        'user:role:change': ['super_admin'],
        
        // Home management
        'home:create': ['super_admin', 'admin', 'home_owner'],
        'home:view': ['super_admin', 'admin', 'home_owner', 'home_admin', 'member', 'guest'],
        'home:edit': ['super_admin', 'admin', 'home_owner', 'home_admin'],
        'home:delete': ['super_admin', 'home_owner'],
        'home:transfer': ['super_admin', 'home_owner'],
        
        // Member management
        'member:view': ['super_admin', 'admin', 'home_owner', 'home_admin'],
        'member:add': ['super_admin', 'admin', 'home_owner', 'home_admin'],
        'member:remove': ['super_admin', 'admin', 'home_owner', 'home_admin'],
        'member:role:change': ['super_admin', 'admin', 'home_owner'],
        
        // Device management
        'device:view': ['super_admin', 'admin', 'home_owner', 'home_admin', 'member', 'guest'],
        'device:control': ['super_admin', 'admin', 'home_owner', 'home_admin', 'member'],
        'device:add': ['super_admin', 'admin', 'home_owner', 'home_admin'],
        'device:edit': ['super_admin', 'admin', 'home_owner', 'home_admin'],
        'device:delete': ['super_admin', 'admin', 'home_owner'],
        'device:auto:mode': ['super_admin', 'admin', 'home_owner', 'home_admin', 'member'],
        
        // Automation management
        'automation:view': ['super_admin', 'admin', 'home_owner', 'home_admin', 'member'],
        'automation:create': ['super_admin', 'admin', 'home_owner', 'home_admin'],
        'automation:edit': ['super_admin', 'admin', 'home_owner', 'home_admin'],
        'automation:delete': ['super_admin', 'admin', 'home_owner'],
        'automation:enable': ['super_admin', 'admin', 'home_owner', 'home_admin'],
        
        // Analytics
        'analytics:view': ['super_admin', 'admin', 'home_owner', 'home_admin', 'member'],
        'analytics:export': ['super_admin', 'admin', 'home_owner', 'home_admin'],
        
        // Settings
        'settings:view': ['super_admin', 'admin', 'home_owner', 'home_admin'],
        'settings:edit': ['super_admin', 'admin', 'home_owner'],
        'settings:security': ['super_admin', 'admin', 'home_owner'],
        
        // Backup
        'backup:create': ['super_admin', 'admin', 'home_owner'],
        'backup:restore': ['super_admin', 'admin'],
        'backup:delete': ['super_admin', 'admin'],
        
        // Audit logs
        'audit:view': ['super_admin', 'admin'],
        'audit:export': ['super_admin', 'admin'],
        
        // Voice control
        'voice:use': ['super_admin', 'admin', 'home_owner', 'home_admin', 'member', 'guest'],
        
        // Emergency
        'emergency:call': ['super_admin', 'admin', 'home_owner', 'home_admin', 'member', 'guest']
    },
    
    // Resource ownership checking
    enableResourceOwnership: true,
    
    // Cache settings
    cachePermissions: true,
    cacheTTL: 300000, // 5 minutes
    
    // Debug
    debug: false
};

// ============================================
// PERMISSION CACHE
// ============================================

class PermissionCache {
    constructor() {
        this.cache = new Map();
    }

    get(key) {
        if (!PermissionConfig.cachePermissions) return null;
        
        const cached = this.cache.get(key);
        if (cached && cached.expiry > Date.now()) {
            return cached.value;
        }
        this.cache.delete(key);
        return null;
    }

    set(key, value) {
        if (!PermissionConfig.cachePermissions) return;
        
        this.cache.set(key, {
            value,
            expiry: Date.now() + PermissionConfig.cacheTTL
        });
    }

    clear() {
        this.cache.clear();
    }

    invalidate(userId) {
        for (const [key] of this.cache) {
            if (key.startsWith(`user_${userId}`)) {
                this.cache.delete(key);
            }
        }
    }
}

// ============================================
// PERMISSION MANAGER
// ============================================

class PermissionManager {
    constructor() {
        this.cache = new PermissionCache();
        this.currentUser = null;
        this.currentHome = null;
        this.listeners = [];
        this.init();
    }

    init() {
        this.loadCurrentUser();
        PermissionConfig.debug && console.log('[Permission] Manager initialized');
    }

    loadCurrentUser() {
        try {
            const user = localStorage.getItem('currentUser');
            if (user) {
                this.currentUser = JSON.parse(user);
            }
        } catch (error) {
            PermissionConfig.debug && console.log('[Permission] Failed to load user');
        }
    }

    setCurrentUser(user) {
        this.currentUser = user;
        this.cache.invalidate(user?.id);
        this.notifyListeners('user_changed', user);
    }

    setCurrentHome(home) {
        this.currentHome = home;
        this.notifyListeners('home_changed', home);
    }

    // ============================================
    // PERMISSION CHECKING
    // ============================================

    hasPermission(permission, resourceId = null, userId = null) {
        const user = userId ? this.getUserById(userId) : this.currentUser;
        
        if (!user) return false;
        
        // Super admin has all permissions
        if (user.role === 'super_admin') return true;
        
        // Check cache first
        const cacheKey = `user_${user.id}_perm_${permission}_${resourceId}`;
        const cached = this.cache.get(cacheKey);
        if (cached !== null) return cached;
        
        // Get roles that have this permission
        const allowedRoles = PermissionConfig.permissions[permission];
        if (!allowedRoles) {
            PermissionConfig.debug && console.log(`[Permission] Unknown permission: ${permission}`);
            return false;
        }
        
        // Check if user's role has permission
        let hasPerm = allowedRoles.includes(user.role);
        
        // Check resource ownership if applicable
        if (hasPerm && PermissionConfig.enableResourceOwnership && resourceId) {
            hasPerm = this.checkResourceOwnership(user, permission, resourceId);
        }
        
        // Cache the result
        this.cache.set(cacheKey, hasPerm);
        
        return hasPerm;
    }

    hasPermissions(permissions, resourceId = null, requireAll = true) {
        if (requireAll) {
            return permissions.every(perm => this.hasPermission(perm, resourceId));
        } else {
            return permissions.some(perm => this.hasPermission(perm, resourceId));
        }
    }

    checkResourceOwnership(user, permission, resourceId) {
        // Check if user owns the resource
        if (permission.startsWith('home:')) {
            return user.homeId === resourceId || user.ownedHomes?.includes(resourceId);
        }
        
        if (permission.startsWith('device:')) {
            const device = this.getDeviceById(resourceId);
            return device && (device.homeId === user.homeId || user.ownedHomes?.includes(device.homeId));
        }
        
        if (permission.startsWith('member:')) {
            return user.homeId === resourceId || user.ownedHomes?.includes(resourceId);
        }
        
        return true;
    }

    // ============================================
    // ROLE MANAGEMENT
    // ============================================

    getUserRole() {
        return this.currentUser?.role || 'guest';
    }

    getRoleLevel(role = null) {
        const roleName = role || this.getUserRole();
        return PermissionConfig.roles[roleName]?.level || 0;
    }

    getRoleName(role = null) {
        const roleName = role || this.getUserRole();
        return PermissionConfig.roles[roleName]?.name || 'Unknown';
    }

    getRoleDescription(role = null) {
        const roleName = role || this.getUserRole();
        return PermissionConfig.roles[roleName]?.description || '';
    }

    getRoleColor(role = null) {
        const roleName = role || this.getUserRole();
        return PermissionConfig.roles[roleName]?.color || '#6c757d';
    }

    getAllRoles() {
        return Object.entries(PermissionConfig.roles).map(([key, value]) => ({
            id: key,
            ...value
        }));
    }

    getRolesByLevel(minLevel = 0, maxLevel = 100) {
        return this.getAllRoles().filter(role => 
            role.level >= minLevel && role.level <= maxLevel
        );
    }

    hasHigherRoleThan(userRole, compareRole) {
        const userLevel = this.getRoleLevel(userRole);
        const compareLevel = this.getRoleLevel(compareRole);
        return userLevel > compareLevel;
    }

    canAssignRole(currentUserRole, targetRole) {
        const currentLevel = this.getRoleLevel(currentUserRole);
        const targetLevel = this.getRoleLevel(targetRole);
        return currentLevel > targetLevel;
    }

    // ============================================
    // PERMISSION HELPERS
    // ============================================

    canViewUsers() {
        return this.hasPermission('user:view');
    }

    canManageUsers() {
        return this.hasPermission('user:create') && this.hasPermission('user:edit');
    }

    canDeleteUsers() {
        return this.hasPermission('user:delete');
    }

    canViewHome(homeId = null) {
        return this.hasPermission('home:view', homeId);
    }

    canEditHome(homeId = null) {
        return this.hasPermission('home:edit', homeId);
    }

    canDeleteHome(homeId = null) {
        return this.hasPermission('home:delete', homeId);
    }

    canViewMembers(homeId = null) {
        return this.hasPermission('member:view', homeId);
    }

    canAddMember(homeId = null) {
        return this.hasPermission('member:add', homeId);
    }

    canRemoveMember(homeId = null) {
        return this.hasPermission('member:remove', homeId);
    }

    canChangeMemberRole(homeId = null) {
        return this.hasPermission('member:role:change', homeId);
    }

    canViewDevices(homeId = null) {
        return this.hasPermission('device:view', homeId);
    }

    canControlDevice(deviceId = null) {
        return this.hasPermission('device:control', deviceId);
    }

    canAddDevice(homeId = null) {
        return this.hasPermission('device:add', homeId);
    }

    canEditDevice(deviceId = null) {
        return this.hasPermission('device:edit', deviceId);
    }

    canDeleteDevice(deviceId = null) {
        return this.hasPermission('device:delete', deviceId);
    }

    canUseAutoMode(deviceId = null) {
        return this.hasPermission('device:auto:mode', deviceId);
    }

    canViewAutomations(homeId = null) {
        return this.hasPermission('automation:view', homeId);
    }

    canCreateAutomation(homeId = null) {
        return this.hasPermission('automation:create', homeId);
    }

    canEditAutomation(automationId = null) {
        return this.hasPermission('automation:edit', automationId);
    }

    canDeleteAutomation(automationId = null) {
        return this.hasPermission('automation:delete', automationId);
    }

    canViewAnalytics(homeId = null) {
        return this.hasPermission('analytics:view', homeId);
    }

    canExportAnalytics(homeId = null) {
        return this.hasPermission('analytics:export', homeId);
    }

    canViewSettings() {
        return this.hasPermission('settings:view');
    }

    canEditSettings() {
        return this.hasPermission('settings:edit');
    }

    canUseVoice() {
        return this.hasPermission('voice:use');
    }

    canCallEmergency() {
        return this.hasPermission('emergency:call');
    }

    // ============================================
    // UI HELPER METHODS
    // ============================================

    filterMenuItems(menuItems) {
        return menuItems.filter(item => {
            if (item.permission) {
                return this.hasPermission(item.permission);
            }
            if (item.permissions) {
                return this.hasPermissions(item.permissions);
            }
            return true;
        });
    }

    filterDevices(devices) {
        return devices.filter(device => 
            this.canControlDevice(device.id) || this.canViewDevices(device.homeId)
        );
    }

    getAccessibleHomes(homes) {
        return homes.filter(home => this.canViewHome(home.id));
    }

    // ============================================
    // PERMISSION UI DIRECTIVES
    // ============================================

    showElementIfHasPermission(element, permission, resourceId = null) {
        if (this.hasPermission(permission, resourceId)) {
            element.style.display = '';
            return true;
        } else {
            element.style.display = 'none';
            return false;
        }
    }

    enableElementIfHasPermission(element, permission, resourceId = null) {
        const hasPerm = this.hasPermission(permission, resourceId);
        element.disabled = !hasPerm;
        return hasPerm;
    }

    // Auto-apply permissions to elements with data-permission attribute
    applyPermissionsToDOM() {
        document.querySelectorAll('[data-permission]').forEach(element => {
            const permission = element.dataset.permission;
            const resourceId = element.dataset.resourceId;
            const action = element.dataset.permissionAction || 'hide';
            
            const hasPerm = this.hasPermission(permission, resourceId);
            
            if (action === 'hide') {
                element.style.display = hasPerm ? '' : 'none';
            } else if (action === 'disable') {
                element.disabled = !hasPerm;
            } else if (action === 'remove') {
                if (!hasPerm) element.remove();
            }
        });
    }

    // ============================================
    // UI COMPONENT
    // ============================================

    renderPermissionUI() {
        const container = document.getElementById('permission-ui');
        if (!container) return;
        
        const userRole = this.getUserRole();
        const roleInfo = PermissionConfig.roles[userRole];
        
        container.innerHTML = `
            <div class="permission-badge" style="background: ${roleInfo.color}20; color: ${roleInfo.color};">
                <i class="fas fa-shield-alt"></i>
                <span>${roleInfo.name}</span>
            </div>
        `;
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

    // ============================================
    // HELPER METHODS
    // ============================================

    getUserById(userId) {
        // This should be replaced with actual API call
        const users = JSON.parse(localStorage.getItem('estif_users') || '[]');
        return users.find(u => u.id === userId);
    }

    getDeviceById(deviceId) {
        // This should be replaced with actual API call
        const devices = JSON.parse(localStorage.getItem('estif_devices') || '[]');
        return devices.find(d => d.id === deviceId);
    }

    clearCache() {
        this.cache.clear();
    }

    getPermissionSummary() {
        const userRole = this.getUserRole();
        const userPermissions = Object.keys(PermissionConfig.permissions)
            .filter(perm => this.hasPermission(perm));
        
        return {
            role: userRole,
            roleName: this.getRoleName(),
            roleLevel: this.getRoleLevel(),
            permissionsCount: userPermissions.length,
            permissions: userPermissions
        };
    }
}

// ============================================
// CSS STYLES (Auto-injected)
// ============================================

const permissionStyles = `
    .permission-badge {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 6px 12px;
        border-radius: 20px;
        font-size: 12px;
        font-weight: 500;
    }
    
    .permission-denied {
        text-align: center;
        padding: 40px;
        color: var(--text-muted);
    }
    
    .permission-denied i {
        font-size: 48px;
        margin-bottom: 16px;
        opacity: 0.5;
    }
    
    [data-permission="hide"] {
        transition: display 0.2s ease;
    }
    
    [disabled][data-permission] {
        cursor: not-allowed;
        opacity: 0.6;
    }
`;

// Inject styles
if (typeof document !== 'undefined') {
    const styleSheet = document.createElement('style');
    styleSheet.textContent = permissionStyles;
    document.head.appendChild(styleSheet);
}

// ============================================
// CREATE SINGLETON INSTANCE
// ============================================

const permissionManager = new PermissionManager();

// Auto-apply permissions on DOM ready
if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        permissionManager.applyPermissionsToDOM();
        permissionManager.renderPermissionUI();
    });
    
    // Watch for dynamically added elements
    const observer = new MutationObserver(() => {
        permissionManager.applyPermissionsToDOM();
    });
    observer.observe(document.body, { childList: true, subtree: true });
}

// ============================================
// EXPORTS
// ============================================

// Expose to window
window.permissionManager = permissionManager;
window.PermissionManager = PermissionManager;
window.PermissionConfig = PermissionConfig;

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        permissionManager,
        PermissionManager,
        PermissionConfig
    };
}

// ES modules export
export {
    permissionManager,
    PermissionManager,
    PermissionConfig
};