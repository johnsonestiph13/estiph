/**
 * ESTIF HOME ULTIMATE - HOME DELETION MODULE
 * Secure home deletion with backup, confirmation, and data migration
 * Version: 2.0.0
 * Author: Estifanos Yohannis
 */

// ============================================
// HOME DELETION CONFIGURATION
// ============================================

const HomeDeletionConfig = {
    // Deletion settings
    requireConfirmation: true,
    requirePassword: true,
    requireReason: true,
    backupBeforeDelete: true,
    
    // Data retention
    retentionDays: 30,
    permanentDeleteAfterDays: 90,
    
    // Archive settings
    archiveEnabled: true,
    archiveStorageKey: 'estif_deleted_homes',
    maxArchiveSize: 50,
    
    // Transfer options
    transferOptions: ['archive', 'transfer', 'delete_permanent'],
    
    // Messages
    messages: {
        confirmTitle: 'Delete Home',
        confirmMessage: 'Are you sure you want to delete this home? This action cannot be undone.',
        passwordRequired: 'Please enter your password to confirm deletion',
        reasonRequired: 'Please provide a reason for deleting this home',
        backupCreated: 'Backup created successfully',
        transferSuccess: 'Data transferred successfully',
        deleteSuccess: 'Home deleted successfully'
    },
    
    // Debug
    debug: false
};

// ============================================
// DELETED HOME ARCHIVE
// ============================================

class DeletedHomeArchive {
    constructor() {
        this.deletedHomes = [];
        this.loadArchive();
    }

    loadArchive() {
        try {
            const saved = localStorage.getItem(HomeDeletionConfig.archiveStorageKey);
            if (saved) {
                this.deletedHomes = JSON.parse(saved);
                HomeDeletionConfig.debug && console.log('[Archive] Loaded', this.deletedHomes.length, 'deleted homes');
            }
        } catch (error) {
            console.error('[Archive] Failed to load:', error);
        }
    }

    saveArchive() {
        try {
            localStorage.setItem(HomeDeletionConfig.archiveStorageKey, JSON.stringify(this.deletedHomes));
        } catch (error) {
            console.error('[Archive] Failed to save:', error);
        }
    }

    add(home, reason, deletedBy) {
        const archiveEntry = {
            id: home.id,
            name: home.name,
            nameAm: home.nameAm,
            address: home.address,
            deletedAt: Date.now(),
            deletedBy: deletedBy,
            reason: reason,
            data: home.toJSON(),
            retentionUntil: Date.now() + HomeDeletionConfig.retentionDays * 24 * 60 * 60 * 1000
        };
        
        this.deletedHomes.unshift(archiveEntry);
        
        // Limit archive size
        if (this.deletedHomes.length > HomeDeletionConfig.maxArchiveSize) {
            this.deletedHomes.pop();
        }
        
        this.saveArchive();
        HomeDeletionConfig.debug && console.log('[Archive] Added home:', home.name);
        return archiveEntry;
    }

    get(homeId) {
        return this.deletedHomes.find(h => h.id === homeId);
    }

    getAll() {
        return this.deletedHomes;
    }

    restore(homeId, homeCreationManager) {
        const archiveEntry = this.get(homeId);
        if (!archiveEntry) return null;
        
        const home = homeCreationManager.importHome({ home: archiveEntry.data });
        if (home) {
            this.deletedHomes = this.deletedHomes.filter(h => h.id !== homeId);
            this.saveArchive();
            HomeDeletionConfig.debug && console.log('[Archive] Restored home:', home.name);
        }
        return home;
    }

    permanentDelete(homeId) {
        this.deletedHomes = this.deletedHomes.filter(h => h.id !== homeId);
        this.saveArchive();
    }

    cleanupExpired() {
        const now = Date.now();
        const expired = this.deletedHomes.filter(h => h.retentionUntil < now);
        if (expired.length > 0) {
            this.deletedHomes = this.deletedHomes.filter(h => h.retentionUntil >= now);
            this.saveArchive();
            HomeDeletionConfig.debug && console.log('[Archive] Cleaned up', expired.length, 'expired homes');
        }
    }
}

// ============================================
// HOME DELETION MANAGER
// ============================================

class HomeDeletionManager {
    constructor(homeCreationManager, deviceRegistry, userManager) {
        this.homeCreation = homeCreationManager;
        this.deviceRegistry = deviceRegistry;
        this.userManager = userManager;
        this.archive = new DeletedHomeArchive();
        this.pendingDeletions = [];
        this.listeners = [];
        
        this.init();
    }

    init() {
        this.archive.cleanupExpired();
        HomeDeletionConfig.debug && console.log('[HomeDeletion] Manager initialized');
    }

    // ============================================
    // DELETION METHODS
    // ============================================

    async deleteHome(homeId, options = {}) {
        const home = this.homeCreation.getHome(homeId);
        if (!home) {
            throw new Error('Home not found');
        }
        
        // Check permissions
        if (!this.canDeleteHome(home)) {
            throw new Error('You do not have permission to delete this home');
        }
        
        // Confirm deletion
        if (HomeDeletionConfig.requireConfirmation && !options.skipConfirm) {
            const confirmed = await this.showConfirmationDialog(home);
            if (!confirmed) {
                return { success: false, cancelled: true };
            }
        }
        
        // Verify password
        if (HomeDeletionConfig.requirePassword && !options.skipPassword) {
            const passwordVerified = await this.verifyPassword();
            if (!passwordVerified) {
                throw new Error('Password verification failed');
            }
        }
        
        // Get reason
        let reason = options.reason;
        if (HomeDeletionConfig.requireReason && !reason) {
            reason = await this.getDeletionReason();
            if (!reason) {
                return { success: false, cancelled: true };
            }
        }
        
        // Create backup
        let backup = null;
        if (HomeDeletionConfig.backupBeforeDelete && options.backup !== false) {
            backup = await this.createBackup(home);
            this.notifyListeners('backup_created', { homeId, backup });
        }
        
        // Handle data transfer
        let transferResult = null;
        if (options.transferTo && options.transferTo !== 'archive') {
            transferResult = await this.transferData(home, options.transferTo);
            this.notifyListeners('data_transferred', { homeId, transferResult });
        }
        
        // Archive home
        const archiveEntry = this.archive.add(home, reason, this.getCurrentUserId());
        
        // Remove from active homes
        this.homeCreation.deleteHome(homeId);
        
        // Clean up associated data
        await this.cleanupAssociatedData(home);
        
        // Record deletion
        this.recordDeletion(home, reason);
        
        this.notifyListeners('home_deleted', {
            homeId,
            reason,
            archiveEntry,
            backup,
            transferResult
        });
        
        return {
            success: true,
            archiveId: archiveEntry.id,
            backup,
            transferResult
        };
    }

    async transferData(home, targetHomeId) {
        const targetHome = this.homeCreation.getHome(targetHomeId);
        if (!targetHome) {
            throw new Error('Target home not found');
        }
        
        const transfer = {
            devices: [],
            rooms: [],
            members: []
        };
        
        // Transfer devices
        for (const deviceId of home.devices) {
            const device = this.deviceRegistry.getDevice(deviceId);
            if (device) {
                const success = this.homeCreation.assignDeviceToHome(deviceId, targetHomeId);
                if (success) {
                    transfer.devices.push(deviceId);
                }
            }
        }
        
        // Transfer rooms
        for (const room of home.rooms) {
            const newRoom = targetHome.addRoom({
                name: room.name,
                nameAm: room.nameAm,
                icon: room.icon,
                type: room.type
            });
            if (newRoom) {
                transfer.rooms.push(newRoom);
            }
        }
        
        // Transfer members
        for (const member of home.members) {
            const newMember = targetHome.addMember({
                userId: member.userId,
                name: member.name,
                email: member.email,
                role: member.role,
                invitedBy: this.getCurrentUserId()
            });
            if (newMember) {
                transfer.members.push(newMember);
            }
        }
        
        this.homeCreation.saveHomes();
        return transfer;
    }

    async createBackup(home) {
        const backup = {
            id: `backup_${home.id}_${Date.now()}`,
            home: home.toJSON(),
            devices: [],
            createdAt: Date.now(),
            createdBy: this.getCurrentUserId()
        };
        
        // Get device details
        for (const deviceId of home.devices) {
            const device = this.deviceRegistry.getDevice(deviceId);
            if (device) {
                backup.devices.push(device.toJSON());
            }
        }
        
        // Store backup in localStorage
        const backups = this.getBackups();
        backups.push(backup);
        localStorage.setItem('estif_home_backups', JSON.stringify(backups));
        
        return backup;
    }

    getBackups(homeId = null) {
        try {
            const backups = JSON.parse(localStorage.getItem('estif_home_backups') || '[]');
            if (homeId) {
                return backups.filter(b => b.home.id === homeId);
            }
            return backups;
        } catch {
            return [];
        }
    }

    restoreBackup(backupId) {
        const backups = this.getBackups();
        const backup = backups.find(b => b.id === backupId);
        if (!backup) return null;
        
        // Restore home
        const home = this.homeCreation.importHome({ home: backup.home });
        if (!home) return null;
        
        // Restore devices
        for (const deviceData of backup.devices) {
            const existingDevice = this.deviceRegistry.getDevice(deviceData.id);
            if (!existingDevice) {
                this.deviceRegistry.addDevice(deviceData);
            }
        }
        
        // Remove backup from list
        const updatedBackups = backups.filter(b => b.id !== backupId);
        localStorage.setItem('estif_home_backups', JSON.stringify(updatedBackups));
        
        this.notifyListeners('home_restored', home);
        return home;
    }

    // ============================================
    // CLEANUP
    // ============================================

    async cleanupAssociatedData(home) {
        // Unassign all devices
        for (const deviceId of home.devices) {
            this.homeCreation.unassignDevice(deviceId);
        }
        
        // Remove from current home if active
        if (this.homeCreation.currentHome === home.id) {
            this.homeCreation.setCurrentHome(null);
        }
        
        // Clear any scheduled tasks
        this.clearScheduledTasks(home.id);
        
        // Remove from user's home lists
        this.removeFromUserProfiles(home);
        
        HomeDeletionConfig.debug && console.log('[HomeDeletion] Cleanup completed for:', home.id);
    }

    clearScheduledTasks(homeId) {
        // Clear any automation schedules for this home
        if (window.automationManager) {
            window.automationManager.clearHomeSchedules(homeId);
        }
    }

    removeFromUserProfiles(home) {
        // Remove home from user profiles
        const users = this.userManager?.getAllUsers() || [];
        for (const user of users) {
            if (user.homes && user.homes.includes(home.id)) {
                user.homes = user.homes.filter(h => h !== home.id);
                this.userManager?.updateUser(user.id, { homes: user.homes });
            }
        }
    }

    // ============================================
    // PERMISSIONS
    // ============================================

    canDeleteHome(home) {
        const currentUserId = this.getCurrentUserId();
        return home.ownerId === currentUserId;
    }

    getCurrentUserId() {
        const user = JSON.parse(localStorage.getItem('estif_user') || '{}');
        return user.id || null;
    }

    // ============================================
    // UI DIALOGS
    // ============================================

    async showConfirmationDialog(home) {
        return new Promise((resolve) => {
            const modal = document.createElement('div');
            modal.className = 'modal-overlay';
            modal.innerHTML = `
                <div class="modal confirmation-modal">
                    <div class="modal-header">
                        <h3>${HomeDeletionConfig.messages.confirmTitle}</h3>
                        <button class="modal-close">&times;</button>
                    </div>
                    <div class="modal-body">
                        <p>${HomeDeletionConfig.messages.confirmMessage}</p>
                        <p><strong>Home:</strong> ${home.name}</p>
                        <p><strong>Rooms:</strong> ${home.rooms.length}</p>
                        <p><strong>Devices:</strong> ${home.devices.length}</p>
                        <p><strong>Members:</strong> ${home.members.length}</p>
                        <div class="warning-box">
                            <i class="fas fa-exclamation-triangle"></i>
                            <span>This action cannot be undone. All data will be permanently deleted.</span>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button id="cancel-delete" class="btn btn-secondary">Cancel</button>
                        <button id="confirm-delete" class="btn btn-danger">Delete Home</button>
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);
            modal.style.display = 'flex';
            
            const closeModal = () => {
                modal.remove();
                resolve(false);
            };
            
            modal.querySelector('.modal-close').addEventListener('click', closeModal);
            modal.querySelector('#cancel-delete').addEventListener('click', closeModal);
            modal.querySelector('#confirm-delete').addEventListener('click', () => {
                modal.remove();
                resolve(true);
            });
        });
    }

    async verifyPassword() {
        return new Promise((resolve) => {
            const modal = document.createElement('div');
            modal.className = 'modal-overlay';
            modal.innerHTML = `
                <div class="modal password-modal">
                    <div class="modal-header">
                        <h3>Verify Password</h3>
                        <button class="modal-close">&times;</button>
                    </div>
                    <div class="modal-body">
                        <p>${HomeDeletionConfig.messages.passwordRequired}</p>
                        <div class="form-group">
                            <input type="password" id="verify-password" placeholder="Enter your password" class="form-input">
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button id="cancel-verify" class="btn btn-secondary">Cancel</button>
                        <button id="confirm-verify" class="btn btn-primary">Verify</button>
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);
            modal.style.display = 'flex';
            
            const passwordInput = modal.querySelector('#verify-password');
            passwordInput.focus();
            
            const verify = () => {
                const password = passwordInput.value;
                // In production, verify with actual authentication
                const isValid = password.length > 0;
                modal.remove();
                resolve(isValid);
            };
            
            modal.querySelector('.modal-close').addEventListener('click', () => {
                modal.remove();
                resolve(false);
            });
            modal.querySelector('#cancel-verify').addEventListener('click', () => {
                modal.remove();
                resolve(false);
            });
            modal.querySelector('#confirm-verify').addEventListener('click', verify);
            passwordInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') verify();
            });
        });
    }

    async getDeletionReason() {
        return new Promise((resolve) => {
            const modal = document.createElement('div');
            modal.className = 'modal-overlay';
            modal.innerHTML = `
                <div class="modal reason-modal">
                    <div class="modal-header">
                        <h3>Reason for Deletion</h3>
                        <button class="modal-close">&times;</button>
                    </div>
                    <div class="modal-body">
                        <p>${HomeDeletionConfig.messages.reasonRequired}</p>
                        <div class="form-group">
                            <select id="delete-reason" class="form-select">
                                <option value="">Select a reason...</option>
                                <option value="no_longer_needed">No longer needed</option>
                                <option value="moved">Moved to new location</option>
                                <option value="duplicate">Duplicate home</option>
                                <option value="consolidating">Consolidating homes</option>
                                <option value="other">Other</option>
                            </select>
                        </div>
                        <div class="form-group" id="other-reason-group" style="display: none;">
                            <textarea id="other-reason" class="form-textarea" placeholder="Please specify..." rows="3"></textarea>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button id="cancel-reason" class="btn btn-secondary">Cancel</button>
                        <button id="confirm-reason" class="btn btn-primary">Continue</button>
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);
            modal.style.display = 'flex';
            
            const reasonSelect = modal.querySelector('#delete-reason');
            const otherGroup = modal.querySelector('#other-reason-group');
            const otherInput = modal.querySelector('#other-reason');
            
            reasonSelect.addEventListener('change', () => {
                otherGroup.style.display = reasonSelect.value === 'other' ? 'block' : 'none';
            });
            
            const confirm = () => {
                let reason = reasonSelect.value;
                if (reason === 'other') {
                    reason = otherInput.value.trim();
                    if (!reason) {
                        alert('Please specify a reason');
                        return;
                    }
                } else if (!reason) {
                    alert('Please select a reason');
                    return;
                }
                modal.remove();
                resolve(reason);
            };
            
            modal.querySelector('.modal-close').addEventListener('click', () => {
                modal.remove();
                resolve(null);
            });
            modal.querySelector('#cancel-reason').addEventListener('click', () => {
                modal.remove();
                resolve(null);
            });
            modal.querySelector('#confirm-reason').addEventListener('click', confirm);
        });
    }

    // ============================================
    // RECORD KEEPING
    // ============================================

    recordDeletion(home, reason) {
        const deletionRecord = {
            homeId: home.id,
            homeName: home.name,
            reason: reason,
            deletedAt: Date.now(),
            deletedBy: this.getCurrentUserId(),
            roomsCount: home.rooms.length,
            devicesCount: home.devices.length,
            membersCount: home.members.length
        };
        
        const records = this.getDeletionRecords();
        records.unshift(deletionRecord);
        localStorage.setItem('estif_deletion_records', JSON.stringify(records.slice(0, 100)));
        
        this.notifyListeners('deletion_recorded', deletionRecord);
    }

    getDeletionRecords(limit = 20) {
        try {
            return JSON.parse(localStorage.getItem('estif_deletion_records') || '[]').slice(0, limit);
        } catch {
            return [];
        }
    }

    // ============================================
    // ARCHIVE MANAGEMENT
    // ============================================

    getArchivedHomes() {
        return this.archive.getAll();
    }

    restoreArchivedHome(homeId) {
        const restored = this.archive.restore(homeId, this.homeCreation);
        if (restored) {
            this.notifyListeners('home_restored', restored);
        }
        return restored;
    }

    permanentDeleteArchived(homeId) {
        this.archive.permanentDelete(homeId);
        this.notifyListeners('archived_home_permanently_deleted', { homeId });
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
// CSS STYLES (Auto-injected)
// ============================================

const homeDeletionStyles = `
    .confirmation-modal {
        max-width: 450px;
    }
    
    .password-modal, .reason-modal {
        max-width: 400px;
    }
    
    .warning-box {
        background: var(--danger-soft);
        border-left: 4px solid var(--danger);
        padding: 12px;
        margin-top: 16px;
        border-radius: 8px;
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 13px;
    }
    
    .warning-box i {
        color: var(--danger);
        font-size: 18px;
    }
`;

// Inject styles
if (typeof document !== 'undefined') {
    const styleSheet = document.createElement('style');
    styleSheet.textContent = homeDeletionStyles;
    document.head.appendChild(styleSheet);
}

// ============================================
// CREATE SINGLETON INSTANCES
// ============================================

let homeDeletion = null;

// Initialize after dependencies are ready
const initHomeDeletion = (homeCreationManager, deviceRegistry, userManager) => {
    homeDeletion = new HomeDeletionManager(homeCreationManager, deviceRegistry, userManager);
    return homeDeletion;
};

// ============================================
// EXPORTS
// ============================================

// Expose to window
window.HomeDeletionManager = HomeDeletionManager;
window.HomeDeletionConfig = HomeDeletionConfig;
window.initHomeDeletion = initHomeDeletion;

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        homeDeletion,
        HomeDeletionManager,
        HomeDeletionConfig,
        initHomeDeletion
    };
}

// ES modules export
export {
    homeDeletion,
    HomeDeletionManager,
    HomeDeletionConfig,
    initHomeDeletion
};