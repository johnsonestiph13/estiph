/**
 * ESTIF HOME ULTIMATE - INVITE MANAGER MODULE
 * Manage home invitations, accept/decline, and member onboarding
 * Version: 2.0.0
 * Author: Estifanos Yohannis
 */

// ============================================
// INVITE MANAGER CONFIGURATION
// ============================================

const InviteManagerConfig = {
    // Invite settings
    inviteExpiryDays: 7,
    maxPendingInvites: 20,
    maxInvitesPerHome: 50,
    
    // Roles
    roles: {
        owner: { level: 100, name: 'Owner', nameAm: 'ባለቤት' },
        admin: { level: 80, name: 'Admin', nameAm: 'አስተዳዳሪ' },
        member: { level: 50, name: 'Member', nameAm: 'አባል' },
        guest: { level: 20, name: 'Guest', nameAm: 'እንግዳ' }
    },
    
    // Storage
    storageKey: 'estif_home_invites',
    
    // Email settings
    emailEnabled: false,
    emailSubject: 'You\'ve been invited to join a home on Estif Home',
    
    // Debug
    debug: false
};

// ============================================
// INVITE CLASS
// ============================================

class HomeInvite {
    constructor(data) {
        this.id = data.id || this.generateId();
        this.homeId = data.homeId;
        this.homeName = data.homeName;
        this.inviterId = data.inviterId;
        this.inviterName = data.inviterName;
        this.inviteeEmail = data.inviteeEmail;
        this.role = data.role || 'member';
        this.message = data.message || '';
        this.status = data.status || 'pending'; // pending, accepted, declined, expired
        this.createdAt = data.createdAt || Date.now();
        this.expiresAt = data.expiresAt || Date.now() + (InviteManagerConfig.inviteExpiryDays * 24 * 60 * 60 * 1000);
        this.acceptedAt = data.acceptedAt || null;
        this.declinedAt = data.declinedAt || null;
        this.token = data.token || this.generateToken();
    }

    generateId() {
        return `invite_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    generateToken() {
        return Math.random().toString(36).substr(2, 16) + Date.now().toString(36);
    }

    isExpired() {
        return Date.now() > this.expiresAt;
    }

    accept(userId, userName) {
        this.status = 'accepted';
        this.acceptedAt = Date.now();
        this.acceptedBy = userId;
        this.acceptedByName = userName;
    }

    decline() {
        this.status = 'declined';
        this.declinedAt = Date.now();
    }

    toJSON() {
        return {
            id: this.id,
            homeId: this.homeId,
            homeName: this.homeName,
            inviterId: this.inviterId,
            inviterName: this.inviterName,
            inviteeEmail: this.inviteeEmail,
            role: this.role,
            message: this.message,
            status: this.status,
            createdAt: this.createdAt,
            expiresAt: this.expiresAt,
            acceptedAt: this.acceptedAt,
            declinedAt: this.declinedAt,
            token: this.token,
            acceptedBy: this.acceptedBy,
            acceptedByName: this.acceptedByName
        };
    }
}

// ============================================
// INVITE MANAGER
// ============================================

class InviteManager {
    constructor(homeManager, userManager = null) {
        this.homeManager = homeManager;
        this.userManager = userManager;
        this.invites = new Map();
        this.listeners = [];
        
        this.init();
    }

    init() {
        this.loadInvites();
        this.cleanExpiredInvites();
        InviteManagerConfig.debug && console.log('[InviteManager] Initialized with', this.invites.size, 'invites');
    }

    loadInvites() {
        try {
            const saved = localStorage.getItem(InviteManagerConfig.storageKey);
            if (saved) {
                const invites = JSON.parse(saved);
                for (const inviteData of invites) {
                    const invite = new HomeInvite(inviteData);
                    this.invites.set(invite.id, invite);
                }
                InviteManagerConfig.debug && console.log('[InviteManager] Loaded', this.invites.size, 'invites');
            }
        } catch (error) {
            console.error('[InviteManager] Failed to load invites:', error);
        }
    }

    saveInvites() {
        try {
            const invites = Array.from(this.invites.values()).map(i => i.toJSON());
            localStorage.setItem(InviteManagerConfig.storageKey, JSON.stringify(invites));
            InviteManagerConfig.debug && console.log('[InviteManager] Saved', invites.length, 'invites');
        } catch (error) {
            console.error('[InviteManager] Failed to save invites:', error);
        }
    }

    cleanExpiredInvites() {
        let cleaned = 0;
        for (const [id, invite] of this.invites.entries()) {
            if (invite.isExpired() && invite.status === 'pending') {
                invite.status = 'expired';
                cleaned++;
            }
        }
        if (cleaned > 0) {
            this.saveInvites();
            InviteManagerConfig.debug && console.log('[InviteManager] Cleaned', cleaned, 'expired invites');
        }
    }

    // ============================================
    // CREATE INVITES
    // ============================================

    createInvite(homeId, inviteeEmail, role, message = '') {
        const home = this.homeManager.getHome(homeId);
        if (!home) {
            throw new Error('Home not found');
        }
        
        // Check permissions
        if (!this.canInvite(homeId)) {
            throw new Error('You do not have permission to invite members');
        }
        
        // Check invite limit
        const pendingInvites = this.getPendingInvitesForHome(homeId);
        if (pendingInvites.length >= InviteManagerConfig.maxInvitesPerHome) {
            throw new Error('Maximum pending invites reached for this home');
        }
        
        // Check if user already a member
        const existingMember = home.members.find(m => m.email === inviteeEmail);
        if (existingMember) {
            throw new Error('User is already a member of this home');
        }
        
        // Check for existing pending invite
        const existingInvite = this.getPendingInviteByEmail(homeId, inviteeEmail);
        if (existingInvite) {
            throw new Error('An invitation has already been sent to this email');
        }
        
        const currentUser = this.getCurrentUser();
        
        const invite = new HomeInvite({
            homeId,
            homeName: home.name,
            inviterId: currentUser.id,
            inviterName: currentUser.name,
            inviteeEmail,
            role,
            message
        });
        
        this.invites.set(invite.id, invite);
        this.saveInvites();
        
        // Send email if enabled
        if (InviteManagerConfig.emailEnabled) {
            this.sendInviteEmail(invite);
        }
        
        this.notifyListeners('invite_created', invite);
        
        return invite;
    }

    createInviteLink(homeId, role = 'guest', expiresInDays = InviteManagerConfig.inviteExpiryDays) {
        const home = this.homeManager.getHome(homeId);
        if (!home) {
            throw new Error('Home not found');
        }
        
        if (!this.canInvite(homeId)) {
            throw new Error('You do not have permission to create invite links');
        }
        
        const invite = new HomeInvite({
            homeId,
            homeName: home.name,
            inviterId: this.getCurrentUser().id,
            inviterName: this.getCurrentUser().name,
            inviteeEmail: 'link',
            role,
            message: 'Join via invite link'
        });
        
        // Extend expiry for links
        invite.expiresAt = Date.now() + (expiresInDays * 24 * 60 * 60 * 1000);
        
        this.invites.set(invite.id, invite);
        this.saveInvites();
        
        this.notifyListeners('invite_link_created', invite);
        
        return {
            inviteId: invite.id,
            link: `${window.location.origin}/join/${invite.token}`,
            token: invite.token
        };
    }

    // ============================================
    // ACCEPT/DECLINE INVITES
    // ============================================

    acceptInvite(inviteId, userId = null, userName = null) {
        const invite = this.invites.get(inviteId);
        if (!invite) {
            throw new Error('Invite not found');
        }
        
        if (invite.isExpired()) {
            invite.status = 'expired';
            this.saveInvites();
            throw new Error('Invite has expired');
        }
        
        if (invite.status !== 'pending') {
            throw new Error(`Invite is already ${invite.status}`);
        }
        
        const currentUser = userId ? { id: userId, name: userName } : this.getCurrentUser();
        
        // Add user to home
        const home = this.homeManager.getHome(invite.homeId);
        if (!home) {
            throw new Error('Home no longer exists');
        }
        
        home.addMember({
            userId: currentUser.id,
            name: currentUser.name,
            email: invite.inviteeEmail !== 'link' ? invite.inviteeEmail : currentUser.email,
            role: invite.role,
            invitedBy: invite.inviterId
        });
        
        this.homeManager.saveHomes();
        
        // Update invite status
        invite.accept(currentUser.id, currentUser.name);
        this.saveInvites();
        
        this.notifyListeners('invite_accepted', invite);
        
        return { home, invite };
    }

    declineInvite(inviteId) {
        const invite = this.invites.get(inviteId);
        if (!invite) {
            throw new Error('Invite not found');
        }
        
        if (invite.status !== 'pending') {
            throw new Error(`Invite is already ${invite.status}`);
        }
        
        invite.decline();
        this.saveInvites();
        
        this.notifyListeners('invite_declined', invite);
        
        return invite;
    }

    acceptByToken(token, userId, userName) {
        const invite = this.findInviteByToken(token);
        if (!invite) {
            throw new Error('Invalid invite token');
        }
        return this.acceptInvite(invite.id, userId, userName);
    }

    // ============================================
    // CANCEL INVITES
    // ============================================

    cancelInvite(inviteId) {
        const invite = this.invites.get(inviteId);
        if (!invite) {
            throw new Error('Invite not found');
        }
        
        if (!this.canCancelInvite(invite)) {
            throw new Error('You do not have permission to cancel this invite');
        }
        
        this.invites.delete(inviteId);
        this.saveInvites();
        
        this.notifyListeners('invite_cancelled', invite);
        
        return invite;
    }

    // ============================================
    // GET INVITES
    // ============================================

    getInvite(inviteId) {
        return this.invites.get(inviteId);
    }

    getInvitesForHome(homeId) {
        return Array.from(this.invites.values())
            .filter(invite => invite.homeId === homeId);
    }

    getPendingInvitesForHome(homeId) {
        return this.getInvitesForHome(homeId)
            .filter(invite => invite.status === 'pending' && !invite.isExpired());
    }

    getInvitesForUser(email) {
        return Array.from(this.invites.values())
            .filter(invite => invite.inviteeEmail === email && invite.status === 'pending' && !invite.isExpired());
    }

    getPendingInviteByEmail(homeId, email) {
        return this.getInvitesForHome(homeId)
            .find(invite => invite.inviteeEmail === email && invite.status === 'pending' && !invite.isExpired());
    }

    findInviteByToken(token) {
        return Array.from(this.invites.values())
            .find(invite => invite.token === token && invite.status === 'pending' && !invite.isExpired());
    }

    // ============================================
    // PERMISSIONS
    // ============================================

    canInvite(homeId) {
        const home = this.homeManager.getHome(homeId);
        if (!home) return false;
        
        const currentUser = this.getCurrentUser();
        const member = home.members.find(m => m.userId === currentUser.id);
        
        if (!member) return false;
        return member.role === 'owner' || member.role === 'admin';
    }

    canCancelInvite(invite) {
        const currentUser = this.getCurrentUser();
        return invite.inviterId === currentUser.id || this.isHomeOwner(invite.homeId);
    }

    isHomeOwner(homeId) {
        const home = this.homeManager.getHome(homeId);
        if (!home) return false;
        
        const currentUser = this.getCurrentUser();
        return home.ownerId === currentUser.id;
    }

    // ============================================
    // EMAIL
    // ============================================

    sendInviteEmail(invite) {
        const link = `${window.location.origin}/join/${invite.token}`;
        const subject = InviteManagerConfig.emailSubject;
        const body = `
            <h2>Home Invitation</h2>
            <p><strong>${invite.inviterName}</strong> has invited you to join <strong>${invite.homeName}</strong> as a <strong>${invite.role}</strong>.</p>
            ${invite.message ? `<p>Message: ${invite.message}</p>` : ''}
            <p>Click the link below to accept the invitation:</p>
            <p><a href="${link}">${link}</a></p>
            <p>This invitation will expire in ${InviteManagerConfig.inviteExpiryDays} days.</p>
        `;
        
        // In production, use actual email service
        console.log('[InviteManager] Email sent to:', invite.inviteeEmail);
        console.log('[InviteManager] Link:', link);
        
        this.notifyListeners('email_sent', { invite, link });
    }

    // ============================================
    // UTILITY
    // ============================================

    getCurrentUser() {
        const user = JSON.parse(localStorage.getItem('estif_user') || '{}');
        if (!user.id) {
            return { id: 'temp_' + Date.now(), name: 'Temporary User', email: 'temp@example.com' };
        }
        return user;
    }

    getRoleInfo(role) {
        return InviteManagerConfig.roles[role] || InviteManagerConfig.roles.member;
    }

    getAvailableRoles() {
        return Object.entries(InviteManagerConfig.roles).map(([key, value]) => ({
            id: key,
            name: value.name,
            nameAm: value.nameAm,
            level: value.level
        }));
    }

    cleanup() {
        this.cleanExpiredInvites();
        this.saveInvites();
    }

    reset() {
        this.invites.clear();
        this.saveInvites();
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
// INVITE MANAGER UI COMPONENT
// ============================================

class InviteManagerUI {
    constructor(inviteManager, homeManager) {
        this.inviteManager = inviteManager;
        this.homeManager = homeManager;
        this.currentHomeId = null;
        
        this.init();
    }

    init() {
        this.createUI();
        this.bindEvents();
        this.render();
        InviteManagerConfig.debug && console.log('[InviteManagerUI] Initialized');
    }

    createUI() {
        const container = document.getElementById('invite-manager-container');
        if (!container) return;

        container.innerHTML = `
            <div class="invite-manager-panel">
                <div class="invite-header">
                    <i class="fas fa-envelope-open-text"></i>
                    <h3>Invite Members</h3>
                    <button id="create-invite-btn" class="btn btn-sm btn-primary">
                        <i class="fas fa-plus"></i> Invite
                    </button>
                </div>
                
                <div class="invite-list" id="invite-list"></div>
                
                <!-- Create Invite Modal -->
                <div id="invite-modal" class="modal-overlay" style="display: none;">
                    <div class="modal">
                        <div class="modal-header">
                            <h3>Invite Member</h3>
                            <button class="modal-close">&times;</button>
                        </div>
                        <div class="modal-body">
                            <form id="invite-form">
                                <div class="form-group">
                                    <label>Email Address *</label>
                                    <input type="email" id="invite-email" class="form-input" required>
                                </div>
                                <div class="form-group">
                                    <label>Role</label>
                                    <select id="invite-role" class="form-select">
                                        ${this.inviteManager.getAvailableRoles().filter(r => r.id !== 'owner').map(role => `
                                            <option value="${role.id}">${role.name}</option>
                                        `).join('')}
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label>Personal Message (Optional)</label>
                                    <textarea id="invite-message" class="form-textarea" rows="3" placeholder="Add a personal message..."></textarea>
                                </div>
                                <div class="form-group">
                                    <label class="checkbox-label">
                                        <input type="checkbox" id="invite-link-only">
                                        Generate invite link only (no email)
                                    </label>
                                </div>
                            </form>
                        </div>
                        <div class="modal-footer">
                            <button id="cancel-invite" class="btn btn-secondary">Cancel</button>
                            <button id="send-invite" class="btn btn-primary">Send Invite</button>
                        </div>
                    </div>
                </div>
                
                <!-- Invite Link Modal -->
                <div id="link-modal" class="modal-overlay" style="display: none;">
                    <div class="modal">
                        <div class="modal-header">
                            <h3>Invite Link</h3>
                            <button class="modal-close">&times;</button>
                        </div>
                        <div class="modal-body">
                            <p>Share this link with people you want to invite:</p>
                            <div class="invite-link-container">
                                <input type="text" id="invite-link" class="form-input" readonly>
                                <button id="copy-link-btn" class="btn btn-secondary">Copy</button>
                            </div>
                            <p class="note">This link expires in ${InviteManagerConfig.inviteExpiryDays} days.</p>
                        </div>
                        <div class="modal-footer">
                            <button id="close-link-modal" class="btn btn-primary">Close</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        this.cacheElements();
        this.bindUIEvents();
    }

    cacheElements() {
        this.inviteList = document.getElementById('invite-list');
        this.createBtn = document.getElementById('create-invite-btn');
        this.inviteModal = document.getElementById('invite-modal');
        this.linkModal = document.getElementById('link-modal');
        this.inviteEmail = document.getElementById('invite-email');
        this.inviteRole = document.getElementById('invite-role');
        this.inviteMessage = document.getElementById('invite-message');
        this.inviteLinkOnly = document.getElementById('invite-link-only');
        this.sendBtn = document.getElementById('send-invite');
        this.inviteLinkInput = document.getElementById('invite-link');
        this.copyLinkBtn = document.getElementById('copy-link-btn');
    }

    bindUIEvents() {
        if (this.createBtn) {
            this.createBtn.addEventListener('click', () => this.showInviteModal());
        }
        
        if (this.sendBtn) {
            this.sendBtn.addEventListener('click', () => this.sendInvite());
        }
        
        if (this.copyLinkBtn) {
            this.copyLinkBtn.addEventListener('click', () => this.copyInviteLink());
        }
        
        document.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', () => this.closeModals());
        });
        
        document.getElementById('close-link-modal')?.addEventListener('click', () => this.closeModals());
        document.getElementById('cancel-invite')?.addEventListener('click', () => this.closeModals());
    }

    bindEvents() {
        this.inviteManager.addEventListener('invite_created', () => this.render());
        this.inviteManager.addEventListener('invite_cancelled', () => this.render());
        this.inviteManager.addEventListener('invite_accepted', () => this.render());
        this.homeManager.addEventListener('current_home_changed', () => this.onHomeChange());
    }

    onHomeChange() {
        const currentHome = this.homeManager.getCurrentHome();
        this.currentHomeId = currentHome?.id;
        this.render();
    }

    render() {
        if (!this.currentHomeId) {
            this.inviteList.innerHTML = '<div class="no-invites">Select a home to manage invites</div>';
            return;
        }
        
        const invites = this.inviteManager.getInvitesForHome(this.currentHomeId);
        
        if (invites.length === 0) {
            this.inviteList.innerHTML = '<div class="no-invites">No pending invitations</div>';
            return;
        }
        
        this.inviteList.innerHTML = invites.map(invite => `
            <div class="invite-item ${invite.status}" data-invite-id="${invite.id}">
                <div class="invite-info">
                    <div class="invite-email">${this.escapeHtml(invite.inviteeEmail === 'link' ? 'Invite Link' : invite.inviteeEmail)}</div>
                    <div class="invite-details">
                        <span class="invite-role">${invite.role}</span>
                        <span class="invite-date">Sent ${new Date(invite.createdAt).toLocaleDateString()}</span>
                        ${invite.isExpired() ? '<span class="invite-expired">Expired</span>' : ''}
                    </div>
                    ${invite.message ? `<div class="invite-message">${this.escapeHtml(invite.message)}</div>` : ''}
                </div>
                <div class="invite-actions">
                    <button class="cancel-invite" data-invite-id="${invite.id}" title="Cancel Invite">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `).join('');
        
        // Bind cancel buttons
        document.querySelectorAll('.cancel-invite').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const inviteId = btn.dataset.inviteId;
                this.cancelInvite(inviteId);
            });
        });
    }

    showInviteModal() {
        this.inviteModal.style.display = 'flex';
        this.inviteEmail.focus();
    }

    sendInvite() {
        const email = this.inviteEmail.value.trim();
        const role = this.inviteRole.value;
        const message = this.inviteMessage.value;
        const linkOnly = this.inviteLinkOnly.checked;
        
        if (!linkOnly && !email) {
            alert('Please enter an email address');
            return;
        }
        
        try {
            if (linkOnly) {
                const result = this.inviteManager.createInviteLink(this.currentHomeId, role);
                this.inviteLinkInput.value = result.link;
                this.closeModals();
                this.linkModal.style.display = 'flex';
            } else {
                this.inviteManager.createInvite(this.currentHomeId, email, role, message);
                this.closeModals();
                this.showToast('Invitation sent successfully!', 'success');
            }
            this.render();
        } catch (error) {
            this.showToast(error.message, 'error');
        }
    }

    cancelInvite(inviteId) {
        if (confirm('Are you sure you want to cancel this invitation?')) {
            try {
                this.inviteManager.cancelInvite(inviteId);
                this.showToast('Invitation cancelled', 'success');
                this.render();
            } catch (error) {
                this.showToast(error.message, 'error');
            }
        }
    }

    copyInviteLink() {
        this.inviteLinkInput.select();
        document.execCommand('copy');
        this.showToast('Link copied to clipboard!', 'success');
    }

    closeModals() {
        this.inviteModal.style.display = 'none';
        this.linkModal.style.display = 'none';
        document.getElementById('invite-form')?.reset();
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

const inviteManagerStyles = `
    .invite-manager-panel {
        background: var(--bg-card);
        border-radius: 12px;
        padding: 20px;
        border: 1px solid var(--border-color);
    }
    
    .invite-header {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 20px;
        padding-bottom: 12px;
        border-bottom: 1px solid var(--border-color);
    }
    
    .invite-header i {
        font-size: 20px;
        color: var(--primary);
    }
    
    .invite-header h3 {
        flex: 1;
        margin: 0;
    }
    
    .invite-list {
        max-height: 400px;
        overflow-y: auto;
    }
    
    .invite-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px;
        background: var(--bg-secondary);
        border-radius: 8px;
        margin-bottom: 8px;
        transition: all 0.2s ease;
    }
    
    .invite-item:hover {
        transform: translateX(4px);
    }
    
    .invite-item.expired {
        opacity: 0.6;
    }
    
    .invite-info {
        flex: 1;
    }
    
    .invite-email {
        font-weight: 500;
        margin-bottom: 4px;
    }
    
    .invite-details {
        display: flex;
        gap: 12px;
        font-size: 11px;
        color: var(--text-muted);
    }
    
    .invite-role {
        background: var(--primary-soft);
        color: var(--primary);
        padding: 2px 8px;
        border-radius: 12px;
    }
    
    .invite-expired {
        background: var(--danger-soft);
        color: var(--danger);
        padding: 2px 8px;
        border-radius: 12px;
    }
    
    .invite-message {
        font-size: 11px;
        color: var(--text-secondary);
        margin-top: 4px;
        font-style: italic;
    }
    
    .cancel-invite {
        background: none;
        border: none;
        cursor: pointer;
        padding: 6px;
        border-radius: 4px;
        transition: all 0.2s ease;
        color: var(--text-muted);
    }
    
    .cancel-invite:hover {
        background: var(--danger);
        color: white;
    }
    
    .no-invites {
        text-align: center;
        color: var(--text-muted);
        padding: 40px;
    }
    
    .invite-link-container {
        display: flex;
        gap: 8px;
        margin: 16px 0;
    }
    
    .invite-link-container input {
        flex: 1;
    }
    
    .note {
        font-size: 11px;
        color: var(--text-muted);
        margin-top: 8px;
    }
`;

// Inject styles
if (typeof document !== 'undefined') {
    const styleSheet = document.createElement('style');
    styleSheet.textContent = inviteManagerStyles;
    document.head.appendChild(styleSheet);
}

// ============================================
// CREATE SINGLETON INSTANCES
// ============================================

let inviteManager = null;
let inviteManagerUI = null;

const initInviteManager = (homeManager, userManager = null) => {
    inviteManager = new InviteManager(homeManager, userManager);
    inviteManagerUI = new InviteManagerUI(inviteManager, homeManager);
    return { inviteManager, inviteManagerUI };
};

// ============================================
// EXPORTS
// ============================================

// Expose to window
window.InviteManager = InviteManager;
window.InviteManagerConfig = InviteManagerConfig;
window.initInviteManager = initInviteManager;

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        inviteManager,
        inviteManagerUI,
        InviteManager,
        InviteManagerConfig,
        initInviteManager
    };
}

// ES modules export
export {
    inviteManager,
    inviteManagerUI,
    InviteManager,
    InviteManagerConfig,
    initInviteManager
};