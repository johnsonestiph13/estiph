/**
 * ESTIF HOME ULTIMATE - HOME SWITCHER MODULE
 * Quick home switching interface with recent homes, favorites, and search
 * Version: 2.0.0
 * Author: Estifanos Yohannis
 */

// ============================================
// HOME SWITCHER CONFIGURATION
// ============================================

const HomeSwitcherConfig = {
    // Storage
    recentHomesKey: 'estif_recent_homes',
    favoriteHomesKey: 'estif_favorite_homes',
    maxRecentHomes: 5,
    
    // UI settings
    showRecentHomes: true,
    showFavoriteHomes: true,
    showSearch: true,
    showStats: true,
    
    // Animation
    transitionDuration: 300,
    
    // Debug
    debug: false
};

// ============================================
// HOME SWITCHER MANAGER
// ============================================

class HomeSwitcherManager {
    constructor(homeManager) {
        this.homeManager = homeManager;
        this.recentHomes = [];
        this.favoriteHomes = new Set();
        this.listeners = [];
        
        this.init();
    }

    init() {
        this.loadRecentHomes();
        this.loadFavoriteHomes();
        HomeSwitcherConfig.debug && console.log('[HomeSwitcher] Manager initialized');
    }

    loadRecentHomes() {
        try {
            const saved = localStorage.getItem(HomeSwitcherConfig.recentHomesKey);
            if (saved) {
                this.recentHomes = JSON.parse(saved);
            }
        } catch (error) {
            console.error('[HomeSwitcher] Failed to load recent homes:', error);
        }
    }

    saveRecentHomes() {
        try {
            localStorage.setItem(HomeSwitcherConfig.recentHomesKey, JSON.stringify(this.recentHomes.slice(0, HomeSwitcherConfig.maxRecentHomes)));
        } catch (error) {
            console.error('[HomeSwitcher] Failed to save recent homes:', error);
        }
    }

    loadFavoriteHomes() {
        try {
            const saved = localStorage.getItem(HomeSwitcherConfig.favoriteHomesKey);
            if (saved) {
                this.favoriteHomes = new Set(JSON.parse(saved));
            }
        } catch (error) {
            console.error('[HomeSwitcher] Failed to load favorite homes:', error);
        }
    }

    saveFavoriteHomes() {
        try {
            localStorage.setItem(HomeSwitcherConfig.favoriteHomesKey, JSON.stringify(Array.from(this.favoriteHomes)));
        } catch (error) {
            console.error('[HomeSwitcher] Failed to save favorite homes:', error);
        }
    }

    // ============================================
    // RECENT HOMES
    // ============================================

    addToRecent(homeId) {
        // Remove if already exists
        const index = this.recentHomes.indexOf(homeId);
        if (index !== -1) {
            this.recentHomes.splice(index, 1);
        }
        
        // Add to front
        this.recentHomes.unshift(homeId);
        
        // Limit size
        if (this.recentHomes.length > HomeSwitcherConfig.maxRecentHomes) {
            this.recentHomes.pop();
        }
        
        this.saveRecentHomes();
        this.notifyListeners('recent_updated', this.recentHomes);
    }

    getRecentHomes() {
        return this.recentHomes
            .map(id => this.homeManager.getHome(id))
            .filter(home => home !== null);
    }

    clearRecentHomes() {
        this.recentHomes = [];
        this.saveRecentHomes();
        this.notifyListeners('recent_cleared');
    }

    // ============================================
    // FAVORITE HOMES
    // ============================================

    toggleFavorite(homeId) {
        if (this.favoriteHomes.has(homeId)) {
            this.favoriteHomes.delete(homeId);
        } else {
            this.favoriteHomes.add(homeId);
        }
        
        this.saveFavoriteHomes();
        this.notifyListeners('favorites_updated', Array.from(this.favoriteHomes));
    }

    addFavorite(homeId) {
        if (!this.favoriteHomes.has(homeId)) {
            this.favoriteHomes.add(homeId);
            this.saveFavoriteHomes();
            this.notifyListeners('favorites_updated', Array.from(this.favoriteHomes));
        }
    }

    removeFavorite(homeId) {
        if (this.favoriteHomes.has(homeId)) {
            this.favoriteHomes.delete(homeId);
            this.saveFavoriteHomes();
            this.notifyListeners('favorites_updated', Array.from(this.favoriteHomes));
        }
    }

    isFavorite(homeId) {
        return this.favoriteHomes.has(homeId);
    }

    getFavoriteHomes() {
        return Array.from(this.favoriteHomes)
            .map(id => this.homeManager.getHome(id))
            .filter(home => home !== null);
    }

    clearFavorites() {
        this.favoriteHomes.clear();
        this.saveFavoriteHomes();
        this.notifyListeners('favorites_cleared');
    }

    // ============================================
    // SEARCH
    // ============================================

    searchHomes(query, limit = 10) {
        const homes = this.homeManager.getUserHomes(this.getCurrentUserId());
        const lowerQuery = query.toLowerCase();
        
        return homes
            .filter(home => 
                home.name.toLowerCase().includes(lowerQuery) ||
                (home.nameAm && home.nameAm.toLowerCase().includes(lowerQuery)) ||
                (home.address && home.address.toLowerCase().includes(lowerQuery))
            )
            .slice(0, limit);
    }

    // ============================================
    // SWITCHING
    // ============================================

    async switchToHome(homeId, options = {}) {
        const home = this.homeManager.getHome(homeId);
        if (!home) {
            throw new Error('Home not found');
        }
        
        // Check permissions
        if (!this.canAccessHome(homeId)) {
            throw new Error('You do not have access to this home');
        }
        
        // Record current home before switching
        const previousHome = this.homeManager.getCurrentHome();
        
        // Switch
        const result = await this.homeManager.switchHome(homeId);
        
        // Add to recent
        this.addToRecent(homeId);
        
        this.notifyListeners('home_switched', {
            from: previousHome,
            to: result,
            timestamp: Date.now()
        });
        
        return result;
    }

    canAccessHome(homeId) {
        const homes = this.homeManager.getUserHomes(this.getCurrentUserId());
        return homes.some(h => h.id === homeId);
    }

    getCurrentUserId() {
        const user = JSON.parse(localStorage.getItem('estif_user') || '{}');
        return user.id || null;
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
// HOME SWITCHER UI COMPONENT
// ============================================

class HomeSwitcherUI {
    constructor(switcherManager, homeManager) {
        this.switcherManager = switcherManager;
        this.homeManager = homeManager;
        this.isOpen = false;
        this.searchQuery = '';
        
        this.init();
    }

    init() {
        this.createUI();
        this.bindEvents();
        this.render();
        HomeSwitcherConfig.debug && console.log('[HomeSwitcherUI] Initialized');
    }

    createUI() {
        // Create dropdown button
        const container = document.getElementById('home-switcher-container');
        if (!container) return;

        container.innerHTML = `
            <div class="home-switcher">
                <button id="home-switcher-btn" class="home-switcher-btn">
                    <i class="fas fa-home"></i>
                    <span id="current-home-name">Loading...</span>
                    <i class="fas fa-chevron-down"></i>
                </button>
                
                <div id="home-switcher-dropdown" class="home-switcher-dropdown" style="display: none;">
                    <div class="dropdown-header">
                        <div class="search-box">
                            <i class="fas fa-search"></i>
                            <input type="text" id="home-search" placeholder="Search homes..." class="search-input">
                        </div>
                    </div>
                    
                    <div id="recent-homes-section" class="dropdown-section">
                        <div class="section-header">
                            <i class="fas fa-clock"></i>
                            <span>Recent Homes</span>
                        </div>
                        <div id="recent-homes-list" class="homes-list"></div>
                    </div>
                    
                    <div id="favorite-homes-section" class="dropdown-section">
                        <div class="section-header">
                            <i class="fas fa-star"></i>
                            <span>Favorite Homes</span>
                        </div>
                        <div id="favorite-homes-list" class="homes-list"></div>
                    </div>
                    
                    <div id="all-homes-section" class="dropdown-section">
                        <div class="section-header">
                            <i class="fas fa-list"></i>
                            <span>All Homes</span>
                        </div>
                        <div id="all-homes-list" class="homes-list"></div>
                    </div>
                </div>
            </div>
        `;

        this.cacheElements();
    }

    cacheElements() {
        this.switcherBtn = document.getElementById('home-switcher-btn');
        this.dropdown = document.getElementById('home-switcher-dropdown');
        this.currentHomeSpan = document.getElementById('current-home-name');
        this.searchInput = document.getElementById('home-search');
        this.recentList = document.getElementById('recent-homes-list');
        this.favoriteList = document.getElementById('favorite-homes-list');
        this.allList = document.getElementById('all-homes-list');
        this.recentSection = document.getElementById('recent-homes-section');
        this.favoriteSection = document.getElementById('favorite-homes-section');
    }

    bindEvents() {
        // Toggle dropdown
        if (this.switcherBtn) {
            this.switcherBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleDropdown();
            });
        }
        
        // Close on click outside
        document.addEventListener('click', (e) => {
            if (this.isOpen && !e.target.closest('.home-switcher')) {
                this.closeDropdown();
            }
        });
        
        // Search
        if (this.searchInput) {
            this.searchInput.addEventListener('input', (e) => {
                this.searchQuery = e.target.value;
                this.renderAllHomes();
            });
        }
        
        // Listen for home changes
        this.homeManager.addEventListener('current_home_changed', () => this.updateCurrentHome());
        this.switcherManager.addEventListener('recent_updated', () => this.renderRecentHomes());
        this.switcherManager.addEventListener('favorites_updated', () => this.renderFavoriteHomes());
    }

    toggleDropdown() {
        if (this.isOpen) {
            this.closeDropdown();
        } else {
            this.openDropdown();
        }
    }

    openDropdown() {
        this.isOpen = true;
        this.dropdown.style.display = 'block';
        this.render();
        setTimeout(() => {
            this.dropdown.classList.add('open');
        }, 10);
        
        if (this.searchInput) {
            setTimeout(() => this.searchInput.focus(), 100);
        }
    }

    closeDropdown() {
        this.isOpen = false;
        this.dropdown.classList.remove('open');
        setTimeout(() => {
            if (!this.isOpen) {
                this.dropdown.style.display = 'none';
            }
        }, HomeSwitcherConfig.transitionDuration);
        
        if (this.searchInput) {
            this.searchQuery = '';
            this.searchInput.value = '';
        }
    }

    render() {
        this.updateCurrentHome();
        this.renderRecentHomes();
        this.renderFavoriteHomes();
        this.renderAllHomes();
    }

    updateCurrentHome() {
        const currentHome = this.homeManager.getCurrentHome();
        if (currentHome && this.currentHomeSpan) {
            this.currentHomeSpan.textContent = currentHome.getDisplayName();
        } else if (this.currentHomeSpan) {
            this.currentHomeSpan.textContent = 'Select Home';
        }
    }

    renderRecentHomes() {
        if (!this.recentList) return;
        
        const recentHomes = this.switcherManager.getRecentHomes();
        
        if (recentHomes.length === 0) {
            this.recentSection.style.display = 'none';
            return;
        }
        
        this.recentSection.style.display = 'block';
        this.recentList.innerHTML = recentHomes.map(home => this.renderHomeItem(home)).join('');
        
        this.bindHomeItemEvents();
    }

    renderFavoriteHomes() {
        if (!this.favoriteList) return;
        
        const favoriteHomes = this.switcherManager.getFavoriteHomes();
        
        if (favoriteHomes.length === 0 && !this.searchQuery) {
            this.favoriteSection.style.display = 'none';
            return;
        }
        
        this.favoriteSection.style.display = 'block';
        this.favoriteList.innerHTML = favoriteHomes.map(home => this.renderHomeItem(home, true)).join('');
        
        this.bindHomeItemEvents();
    }

    renderAllHomes() {
        if (!this.allList) return;
        
        let homes = this.homeManager.getUserHomes(this.getCurrentUserId());
        
        if (this.searchQuery) {
            homes = this.switcherManager.searchHomes(this.searchQuery);
        }
        
        if (homes.length === 0) {
            this.allList.innerHTML = '<div class="no-results">No homes found</div>';
            return;
        }
        
        this.allList.innerHTML = homes.map(home => this.renderHomeItem(home)).join('');
        
        this.bindHomeItemEvents();
    }

    renderHomeItem(home, isFavorite = false) {
        const currentHome = this.homeManager.getCurrentHome();
        const isCurrent = currentHome?.id === home.id;
        
        return `
            <div class="home-item ${isCurrent ? 'active' : ''}" data-home-id="${home.id}">
                <div class="home-icon">🏠</div>
                <div class="home-info">
                    <div class="home-name">${this.escapeHtml(home.getDisplayName())}</div>
                    <div class="home-details">
                        ${home.address ? `<span class="home-address">${this.escapeHtml(home.address)}</span>` : ''}
                        <span class="home-stats">${home.devices.length} devices</span>
                    </div>
                </div>
                <div class="home-actions">
                    <button class="favorite-btn ${isFavorite ? 'active' : ''}" data-home-id="${home.id}" title="${isFavorite ? 'Remove from favorites' : 'Add to favorites'}">
                        <i class="fas ${isFavorite ? 'fa-star' : 'fa-star-o'}"></i>
                    </button>
                    ${!isCurrent ? `
                        <button class="switch-btn" data-home-id="${home.id}" title="Switch to this home">
                            <i class="fas fa-exchange-alt"></i>
                        </button>
                    ` : '<span class="active-badge">Active</span>'}
                </div>
            </div>
        `;
    }

    bindHomeItemEvents() {
        // Switch buttons
        document.querySelectorAll('.switch-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const homeId = btn.dataset.homeId;
                await this.switchHome(homeId);
            });
        });
        
        // Favorite buttons
        document.querySelectorAll('.favorite-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const homeId = btn.dataset.homeId;
                this.toggleFavorite(homeId);
            });
        });
        
        // Home item click (switch)
        document.querySelectorAll('.home-item').forEach(item => {
            item.addEventListener('click', async (e) => {
                // Don't trigger if clicking on buttons
                if (e.target.closest('.favorite-btn') || e.target.closest('.switch-btn')) return;
                
                const homeId = item.dataset.homeId;
                await this.switchHome(homeId);
            });
        });
    }

    async switchHome(homeId) {
        try {
            await this.switcherManager.switchToHome(homeId);
            this.closeDropdown();
            this.showToast('Home switched successfully', 'success');
        } catch (error) {
            this.showToast(error.message, 'error');
        }
    }

    async toggleFavorite(homeId) {
        this.switcherManager.toggleFavorite(homeId);
        this.renderFavoriteHomes();
        this.renderAllHomes();
    }

    getCurrentUserId() {
        const user = JSON.parse(localStorage.getItem('estif_user') || '{}');
        return user.id || null;
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

const homeSwitcherStyles = `
    .home-switcher {
        position: relative;
        display: inline-block;
    }
    
    .home-switcher-btn {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 16px;
        background: var(--bg-tertiary);
        border: 1px solid var(--border-color);
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.2s ease;
        font-size: 14px;
        color: var(--text-primary);
    }
    
    .home-switcher-btn:hover {
        background: var(--bg-hover);
        border-color: var(--primary);
    }
    
    .home-switcher-btn i:first-child {
        color: var(--primary);
    }
    
    .home-switcher-btn i:last-child {
        font-size: 12px;
        color: var(--text-muted);
    }
    
    .home-switcher-dropdown {
        position: absolute;
        top: 100%;
        right: 0;
        margin-top: 8px;
        width: 320px;
        max-height: 500px;
        background: var(--bg-card);
        border: 1px solid var(--border-color);
        border-radius: 12px;
        box-shadow: var(--shadow-lg);
        overflow: hidden;
        z-index: 1000;
        opacity: 0;
        transform: translateY(-10px);
        transition: opacity 0.2s ease, transform 0.2s ease;
    }
    
    .home-switcher-dropdown.open {
        opacity: 1;
        transform: translateY(0);
    }
    
    .dropdown-header {
        padding: 12px;
        border-bottom: 1px solid var(--border-color);
    }
    
    .search-box {
        position: relative;
    }
    
    .search-box i {
        position: absolute;
        left: 12px;
        top: 50%;
        transform: translateY(-50%);
        color: var(--text-muted);
        font-size: 14px;
    }
    
    .search-box .search-input {
        width: 100%;
        padding: 8px 12px 8px 36px;
        border: 1px solid var(--border-color);
        border-radius: 8px;
        background: var(--bg-primary);
        color: var(--text-primary);
        font-size: 13px;
    }
    
    .dropdown-section {
        border-bottom: 1px solid var(--border-color);
    }
    
    .dropdown-section:last-child {
        border-bottom: none;
    }
    
    .section-header {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 10px 12px;
        background: var(--bg-secondary);
        font-size: 12px;
        font-weight: 600;
        color: var(--text-secondary);
        border-bottom: 1px solid var(--border-color);
    }
    
    .section-header i {
        font-size: 12px;
    }
    
    .homes-list {
        max-height: 200px;
        overflow-y: auto;
    }
    
    .home-item {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px;
        cursor: pointer;
        transition: all 0.2s ease;
        border-bottom: 1px solid var(--border-light);
    }
    
    .home-item:hover {
        background: var(--bg-hover);
    }
    
    .home-item.active {
        background: var(--primary-soft);
    }
    
    .home-icon {
        font-size: 24px;
    }
    
    .home-info {
        flex: 1;
    }
    
    .home-name {
        font-weight: 500;
        font-size: 14px;
        margin-bottom: 2px;
    }
    
    .home-details {
        display: flex;
        gap: 8px;
        font-size: 11px;
        color: var(--text-muted);
    }
    
    .home-actions {
        display: flex;
        align-items: center;
        gap: 8px;
    }
    
    .favorite-btn, .switch-btn {
        background: none;
        border: none;
        cursor: pointer;
        padding: 6px;
        border-radius: 4px;
        transition: all 0.2s ease;
        color: var(--text-muted);
    }
    
    .favorite-btn:hover, .switch-btn:hover {
        background: var(--bg-tertiary);
        color: var(--primary);
    }
    
    .favorite-btn.active {
        color: var(--warning);
    }
    
    .active-badge {
        background: var(--success);
        color: white;
        padding: 2px 8px;
        border-radius: 12px;
        font-size: 10px;
    }
    
    .no-results {
        text-align: center;
        padding: 20px;
        color: var(--text-muted);
        font-size: 13px;
    }
`;

// Inject styles
if (typeof document !== 'undefined') {
    const styleSheet = document.createElement('style');
    styleSheet.textContent = homeSwitcherStyles;
    document.head.appendChild(styleSheet);
}

// ============================================
// CREATE SINGLETON INSTANCES
// ============================================

let homeSwitcher = null;
let homeSwitcherUI = null;

const initHomeSwitcher = (homeManager) => {
    homeSwitcher = new HomeSwitcherManager(homeManager);
    homeSwitcherUI = new HomeSwitcherUI(homeSwitcher, homeManager);
    return { homeSwitcher, homeSwitcherUI };
};

// ============================================
// EXPORTS
// ============================================

// Expose to window
window.HomeSwitcherManager = HomeSwitcherManager;
window.HomeSwitcherConfig = HomeSwitcherConfig;
window.initHomeSwitcher = initHomeSwitcher;

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        homeSwitcher,
        homeSwitcherUI,
        HomeSwitcherManager,
        HomeSwitcherConfig,
        initHomeSwitcher
    };
}

// ES modules export
export {
    homeSwitcher,
    homeSwitcherUI,
    HomeSwitcherManager,
    HomeSwitcherConfig,
    initHomeSwitcher
};