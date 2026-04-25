/**
 * ESTIF HOME ULTIMATE - HOME SETTINGS MODULE
 * Comprehensive home configuration, preferences, and management settings
 * Version: 2.0.0
 * Author: Estifanos Yohannis
 */

// ============================================
// HOME SETTINGS CONFIGURATION
// ============================================

const HomeSettingsConfig = {
    // Available settings categories
    categories: [
        'general',
        'location',
        'preferences',
        'security',
        'notifications',
        'members',
        'integrations',
        'backup',
        'advanced'
    ],
    
    // Default settings
    defaults: {
        general: {
            name: '',
            nameAm: '',
            description: '',
            timezone: 'Africa/Addis_Ababa',
            language: 'en',
            theme: 'light'
        },
        location: {
            address: '',
            city: '',
            country: 'Ethiopia',
            zipCode: '',
            latitude: null,
            longitude: null,
            timezone: 'Africa/Addis_Ababa'
        },
        preferences: {
            temperatureUnit: 'celsius',
            dateFormat: 'DD/MM/YYYY',
            timeFormat: '24h',
            energyUnit: 'kWh',
            currency: 'ETB',
            defaultView: 'dashboard'
        },
        security: {
            requirePin: false,
            pinCode: '',
            sessionTimeout: 3600,
            maxFailedAttempts: 5,
            lockoutDuration: 900,
            guestAccess: false,
            guestPin: ''
        },
        notifications: {
            deviceStatus: true,
            energyAlerts: true,
            securityAlerts: true,
            maintenanceReminders: true,
            dailyDigest: true,
            weeklyReport: true,
            pushEnabled: true,
            emailEnabled: false,
            soundEnabled: true
        },
        integrations: {
            googleHome: false,
            alexa: false,
            ifttt: false,
            homekit: false,
            webhooks: []
        },
        backup: {
            autoBackup: true,
            backupFrequency: 'daily',
            backupTime: '03:00',
            maxBackups: 10,
            cloudBackup: false,
            cloudProvider: null
        },
        advanced: {
            debugMode: false,
            logLevel: 'info',
            apiAccess: false,
            apiKey: '',
            webhookUrl: '',
            customScripts: []
        }
    },
    
    // Storage
    storageKey: 'estif_home_settings',
    
    // Debug
    debug: false
};

// ============================================
// HOME SETTINGS MANAGER
// ============================================

class HomeSettingsManager {
    constructor(homeManager) {
        this.homeManager = homeManager;
        this.settingsCache = new Map();
        this.listeners = [];
        
        this.init();
    }

    init() {
        this.loadSettings();
        HomeSettingsConfig.debug && console.log('[HomeSettings] Manager initialized');
    }

    loadSettings() {
        try {
            const saved = localStorage.getItem(HomeSettingsConfig.storageKey);
            if (saved) {
                const settings = JSON.parse(saved);
                for (const [homeId, homeSettings] of Object.entries(settings)) {
                    this.settingsCache.set(homeId, homeSettings);
                }
                HomeSettingsConfig.debug && console.log('[HomeSettings] Loaded settings for', this.settingsCache.size, 'homes');
            }
        } catch (error) {
            console.error('[HomeSettings] Failed to load settings:', error);
        }
    }

    saveSettings() {
        try {
            const settings = Object.fromEntries(this.settingsCache);
            localStorage.setItem(HomeSettingsConfig.storageKey, JSON.stringify(settings));
            HomeSettingsConfig.debug && console.log('[HomeSettings] Saved settings for', this.settingsCache.size, 'homes');
        } catch (error) {
            console.error('[HomeSettings] Failed to save settings:', error);
        }
    }

    // ============================================
    // SETTINGS MANAGEMENT
    // ============================================

    getSettings(homeId, category = null) {
        let settings = this.settingsCache.get(homeId);
        
        if (!settings) {
            settings = this.getDefaultSettings();
            this.settingsCache.set(homeId, settings);
        }
        
        if (category) {
            return settings[category] || null;
        }
        
        return settings;
    }

    getDefaultSettings() {
        return {
            general: { ...HomeSettingsConfig.defaults.general },
            location: { ...HomeSettingsConfig.defaults.location },
            preferences: { ...HomeSettingsConfig.defaults.preferences },
            security: { ...HomeSettingsConfig.defaults.security },
            notifications: { ...HomeSettingsConfig.defaults.notifications },
            integrations: { ...HomeSettingsConfig.defaults.integrations },
            backup: { ...HomeSettingsConfig.defaults.backup },
            advanced: { ...HomeSettingsConfig.defaults.advanced }
        };
    }

    updateSettings(homeId, category, updates) {
        let settings = this.settingsCache.get(homeId);
        
        if (!settings) {
            settings = this.getDefaultSettings();
        }
        
        if (!settings[category]) {
            settings[category] = {};
        }
        
        // Merge updates
        settings[category] = { ...settings[category], ...updates };
        
        this.settingsCache.set(homeId, settings);
        this.saveSettings();
        
        // Apply settings to home object
        this.applySettingsToHome(homeId, category, updates);
        
        this.notifyListeners('settings_updated', { homeId, category, updates });
        
        return settings[category];
    }

    updateMultipleSettings(homeId, updates) {
        let settings = this.settingsCache.get(homeId);
        
        if (!settings) {
            settings = this.getDefaultSettings();
        }
        
        for (const [category, categoryUpdates] of Object.entries(updates)) {
            if (!settings[category]) {
                settings[category] = {};
            }
            settings[category] = { ...settings[category], ...categoryUpdates };
            this.applySettingsToHome(homeId, category, categoryUpdates);
        }
        
        this.settingsCache.set(homeId, settings);
        this.saveSettings();
        
        this.notifyListeners('settings_updated', { homeId, updates });
        
        return settings;
    }

    resetSettings(homeId, category = null) {
        let settings = this.settingsCache.get(homeId);
        
        if (!settings) {
            settings = this.getDefaultSettings();
        }
        
        if (category) {
            settings[category] = { ...HomeSettingsConfig.defaults[category] };
            this.applySettingsToHome(homeId, category, settings[category]);
        } else {
            settings = this.getDefaultSettings();
            this.applyAllSettingsToHome(homeId, settings);
        }
        
        this.settingsCache.set(homeId, settings);
        this.saveSettings();
        
        this.notifyListeners('settings_reset', { homeId, category });
        
        return settings;
    }

    applySettingsToHome(homeId, category, updates) {
        const home = this.homeManager.getHome(homeId);
        if (!home) return;
        
        switch (category) {
            case 'general':
                if (updates.name) home.name = updates.name;
                if (updates.nameAm) home.nameAm = updates.nameAm;
                if (updates.description) home.description = updates.description;
                break;
            case 'location':
                if (updates.address !== undefined) home.address = updates.address;
                if (updates.city !== undefined) home.city = updates.city;
                if (updates.country !== undefined) home.country = updates.country;
                if (updates.zipCode !== undefined) home.zipCode = updates.zipCode;
                if (updates.latitude !== undefined || updates.longitude !== undefined) {
                    home.location = {
                        lat: updates.latitude || home.location?.lat,
                        lng: updates.longitude || home.location?.lng
                    };
                }
                break;
        }
        
        // Update home settings in home object
        home.settings = { ...home.settings, ...this.getSettings(homeId) };
        this.homeManager.saveHomes();
    }

    applyAllSettingsToHome(homeId, settings) {
        const home = this.homeManager.getHome(homeId);
        if (!home) return;
        
        if (settings.general.name) home.name = settings.general.name;
        if (settings.general.nameAm) home.nameAm = settings.general.nameAm;
        if (settings.general.description) home.description = settings.general.description;
        
        if (settings.location.address !== undefined) home.address = settings.location.address;
        if (settings.location.city !== undefined) home.city = settings.location.city;
        if (settings.location.country !== undefined) home.country = settings.location.country;
        if (settings.location.zipCode !== undefined) home.zipCode = settings.location.zipCode;
        
        home.settings = { ...home.settings, ...settings };
        this.homeManager.saveHomes();
    }

    // ============================================
    // CATEGORY SPECIFIC METHODS
    // ============================================

    // General Settings
    updateGeneralSettings(homeId, updates) {
        return this.updateSettings(homeId, 'general', updates);
    }

    getGeneralSettings(homeId) {
        return this.getSettings(homeId, 'general');
    }

    // Location Settings
    updateLocationSettings(homeId, updates) {
        return this.updateSettings(homeId, 'location', updates);
    }

    getLocationSettings(homeId) {
        return this.getSettings(homeId, 'location');
    }

    // Preferences
    updatePreferences(homeId, updates) {
        return this.updateSettings(homeId, 'preferences', updates);
    }

    getPreferences(homeId) {
        return this.getSettings(homeId, 'preferences');
    }

    // Security Settings
    updateSecuritySettings(homeId, updates) {
        // Hash PIN code if provided
        if (updates.pinCode) {
            updates.pinCode = this.hashPin(updates.pinCode);
        }
        if (updates.guestPin) {
            updates.guestPin = this.hashPin(updates.guestPin);
        }
        
        return this.updateSettings(homeId, 'security', updates);
    }

    getSecuritySettings(homeId) {
        const settings = this.getSettings(homeId, 'security');
        // Don't return actual PIN codes
        const safeSettings = { ...settings };
        delete safeSettings.pinCode;
        delete safeSettings.guestPin;
        safeSettings.hasPin = !!settings.pinCode;
        safeSettings.hasGuestPin = !!settings.guestPin;
        return safeSettings;
    }

    verifyPin(homeId, pin) {
        const settings = this.getSettings(homeId, 'security');
        if (!settings.requirePin) return true;
        
        const hashedPin = this.hashPin(pin);
        return settings.pinCode === hashedPin;
    }

    verifyGuestPin(homeId, pin) {
        const settings = this.getSettings(homeId, 'security');
        if (!settings.guestAccess) return false;
        
        const hashedPin = this.hashPin(pin);
        return settings.guestPin === hashedPin;
    }

    hashPin(pin) {
        // Simple hash for PIN (in production, use proper encryption)
        let hash = 0;
        for (let i = 0; i < pin.length; i++) {
            hash = ((hash << 5) - hash) + pin.charCodeAt(i);
            hash |= 0;
        }
        return hash.toString();
    }

    // Notification Settings
    updateNotificationSettings(homeId, updates) {
        return this.updateSettings(homeId, 'notifications', updates);
    }

    getNotificationSettings(homeId) {
        return this.getSettings(homeId, 'notifications');
    }

    // Integration Settings
    updateIntegrationSettings(homeId, updates) {
        return this.updateSettings(homeId, 'integrations', updates);
    }

    getIntegrationSettings(homeId) {
        return this.getSettings(homeId, 'integrations');
    }

    // Backup Settings
    updateBackupSettings(homeId, updates) {
        return this.updateSettings(homeId, 'backup', updates);
    }

    getBackupSettings(homeId) {
        return this.getSettings(homeId, 'backup');
    }

    // Advanced Settings
    updateAdvancedSettings(homeId, updates) {
        return this.updateSettings(homeId, 'advanced', updates);
    }

    getAdvancedSettings(homeId) {
        return this.getSettings(homeId, 'advanced');
    }

    // ============================================
    // EXPORT/IMPORT
    // ============================================

    exportSettings(homeId) {
        const settings = this.getSettings(homeId);
        const home = this.homeManager.getHome(homeId);
        
        return {
            version: '1.0',
            exportedAt: Date.now(),
            homeId,
            homeName: home?.name,
            settings
        };
    }

    importSettings(homeId, data) {
        try {
            const imported = data.settings;
            const current = this.getSettings(homeId);
            
            // Merge settings
            const merged = this.deepMerge(current, imported);
            this.settingsCache.set(homeId, merged);
            this.saveSettings();
            this.applyAllSettingsToHome(homeId, merged);
            
            this.notifyListeners('settings_imported', { homeId });
            return true;
        } catch (error) {
            console.error('[HomeSettings] Import failed:', error);
            return false;
        }
    }

    deepMerge(target, source) {
        const result = { ...target };
        
        for (const key in source) {
            if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                result[key] = this.deepMerge(target[key] || {}, source[key]);
            } else {
                result[key] = source[key];
            }
        }
        
        return result;
    }

    // ============================================
    // VALIDATION
    // ============================================

    validateSettings(category, settings) {
        const errors = [];
        
        switch (category) {
            case 'general':
                if (settings.name && settings.name.length < 2) {
                    errors.push('Home name must be at least 2 characters');
                }
                if (settings.name && settings.name.length > 50) {
                    errors.push('Home name must be less than 50 characters');
                }
                break;
                
            case 'security':
                if (settings.requirePin && (!settings.pinCode || settings.pinCode.length < 4)) {
                    errors.push('PIN code must be at least 4 digits');
                }
                if (settings.maxFailedAttempts && (settings.maxFailedAttempts < 1 || settings.maxFailedAttempts > 10)) {
                    errors.push('Max failed attempts must be between 1 and 10');
                }
                break;
                
            case 'backup':
                if (settings.maxBackups && (settings.maxBackups < 1 || settings.maxBackups > 50)) {
                    errors.push('Max backups must be between 1 and 50');
                }
                break;
        }
        
        return errors;
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
// HOME SETTINGS UI COMPONENT
// ============================================

class HomeSettingsUI {
    constructor(settingsManager, homeManager) {
        this.settingsManager = settingsManager;
        this.homeManager = homeManager;
        this.currentHomeId = null;
        this.currentCategory = 'general';
        
        this.init();
    }

    init() {
        this.createUI();
        this.bindEvents();
        this.render();
        HomeSettingsConfig.debug && console.log('[HomeSettingsUI] Initialized');
    }

    createUI() {
        const container = document.getElementById('home-settings-container');
        if (!container) return;

        container.innerHTML = `
            <div class="home-settings-panel">
                <div class="settings-header">
                    <i class="fas fa-sliders-h"></i>
                    <h3>Home Settings</h3>
                    <select id="home-selector" class="home-selector"></select>
                </div>
                
                <div class="settings-content">
                    <div class="settings-sidebar" id="settings-sidebar"></div>
                    <div class="settings-main" id="settings-main"></div>
                </div>
                
                <div class="settings-footer">
                    <button id="save-settings" class="btn btn-primary">Save Changes</button>
                    <button id="reset-settings" class="btn btn-secondary">Reset</button>
                </div>
            </div>
        `;

        this.cacheElements();
        this.buildSidebar();
    }

    cacheElements() {
        this.homeSelector = document.getElementById('home-selector');
        this.settingsSidebar = document.getElementById('settings-sidebar');
        this.settingsMain = document.getElementById('settings-main');
        this.saveBtn = document.getElementById('save-settings');
        this.resetBtn = document.getElementById('reset-settings');
    }

    bindEvents() {
        if (this.homeSelector) {
            this.homeSelector.addEventListener('change', () => this.onHomeChange());
        }
        
        if (this.saveBtn) {
            this.saveBtn.addEventListener('click', () => this.saveSettings());
        }
        
        if (this.resetBtn) {
            this.resetBtn.addEventListener('click', () => this.resetSettings());
        }
        
        this.homeManager.addEventListener('current_home_changed', () => this.onHomeChange());
    }

    buildSidebar() {
        const categories = [
            { id: 'general', icon: 'fas fa-info-circle', label: 'General' },
            { id: 'location', icon: 'fas fa-map-marker-alt', label: 'Location' },
            { id: 'preferences', icon: 'fas fa-cog', label: 'Preferences' },
            { id: 'security', icon: 'fas fa-shield-alt', label: 'Security' },
            { id: 'notifications', icon: 'fas fa-bell', label: 'Notifications' },
            { id: 'integrations', icon: 'fas fa-plug', label: 'Integrations' },
            { id: 'backup', icon: 'fas fa-database', label: 'Backup' },
            { id: 'advanced', icon: 'fas fa-code', label: 'Advanced' }
        ];
        
        this.settingsSidebar.innerHTML = categories.map(cat => `
            <button class="settings-category ${this.currentCategory === cat.id ? 'active' : ''}" data-category="${cat.id}">
                <i class="${cat.icon}"></i>
                <span>${cat.label}</span>
            </button>
        `).join('');
        
        // Bind category clicks
        document.querySelectorAll('.settings-category').forEach(btn => {
            btn.addEventListener('click', () => {
                this.currentCategory = btn.dataset.category;
                this.renderCategory();
                this.updateActiveCategory();
            });
        });
    }

    updateActiveCategory() {
        document.querySelectorAll('.settings-category').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.category === this.currentCategory);
        });
    }

    onHomeChange() {
        this.currentHomeId = this.homeSelector.value;
        this.renderCategory();
    }

    render() {
        const homes = this.homeManager.getUserHomes(this.getCurrentUserId());
        const currentHome = this.homeManager.getCurrentHome();
        
        this.homeSelector.innerHTML = homes.map(home => `
            <option value="${home.id}" ${(this.currentHomeId === home.id || currentHome?.id === home.id) ? 'selected' : ''}>
                ${home.getDisplayName()}
            </option>
        `).join('');
        
        if (!this.currentHomeId && currentHome) {
            this.currentHomeId = currentHome.id;
        } else if (homes.length > 0 && !this.currentHomeId) {
            this.currentHomeId = homes[0].id;
        }
        
        this.renderCategory();
    }

    renderCategory() {
        if (!this.currentHomeId) return;
        
        const settings = this.settingsManager.getSettings(this.currentHomeId);
        const categorySettings = settings[this.currentCategory];
        
        let html = '';
        
        switch (this.currentCategory) {
            case 'general':
                html = this.renderGeneralSettings(categorySettings);
                break;
            case 'location':
                html = this.renderLocationSettings(categorySettings);
                break;
            case 'preferences':
                html = this.renderPreferencesSettings(categorySettings);
                break;
            case 'security':
                html = this.renderSecuritySettings(categorySettings);
                break;
            case 'notifications':
                html = this.renderNotificationSettings(categorySettings);
                break;
            case 'integrations':
                html = this.renderIntegrationSettings(categorySettings);
                break;
            case 'backup':
                html = this.renderBackupSettings(categorySettings);
                break;
            case 'advanced':
                html = this.renderAdvancedSettings(categorySettings);
                break;
            default:
                html = '<p>Select a category</p>';
        }
        
        this.settingsMain.innerHTML = html;
    }

    renderGeneralSettings(settings) {
        return `
            <div class="settings-form">
                <h3>General Settings</h3>
                <div class="form-group">
                    <label>Home Name *</label>
                    <input type="text" id="home-name" class="form-input" value="${this.escapeHtml(settings.name || '')}" placeholder="Enter home name">
                </div>
                <div class="form-group">
                    <label>Home Name (Amharic)</label>
                    <input type="text" id="home-name-am" class="form-input" value="${this.escapeHtml(settings.nameAm || '')}" placeholder="የቤት ስም">
                </div>
                <div class="form-group">
                    <label>Description</label>
                    <textarea id="home-description" class="form-textarea" rows="3" placeholder="Enter home description">${this.escapeHtml(settings.description || '')}</textarea>
                </div>
                <div class="form-group">
                    <label>Timezone</label>
                    <select id="timezone" class="form-select">
                        <option value="Africa/Addis_Ababa" ${settings.timezone === 'Africa/Addis_Ababa' ? 'selected' : ''}>Addis Ababa</option>
                        <option value="Africa/Nairobi" ${settings.timezone === 'Africa/Nairobi' ? 'selected' : ''}>Nairobi</option>
                        <option value="UTC" ${settings.timezone === 'UTC' ? 'selected' : ''}>UTC</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Language</label>
                    <select id="language" class="form-select">
                        <option value="en" ${settings.language === 'en' ? 'selected' : ''}>English</option>
                        <option value="am" ${settings.language === 'am' ? 'selected' : ''}>Amharic</option>
                    </select>
                </div>
            </div>
        `;
    }

    renderLocationSettings(settings) {
        return `
            <div class="settings-form">
                <h3>Location Settings</h3>
                <div class="form-group">
                    <label>Address</label>
                    <input type="text" id="address" class="form-input" value="${this.escapeHtml(settings.address || '')}">
                </div>
                <div class="form-group">
                    <label>City</label>
                    <input type="text" id="city" class="form-input" value="${this.escapeHtml(settings.city || '')}">
                </div>
                <div class="form-group">
                    <label>Country</label>
                    <input type="text" id="country" class="form-input" value="${this.escapeHtml(settings.country || 'Ethiopia')}">
                </div>
                <div class="form-group">
                    <label>Zip Code</label>
                    <input type="text" id="zipCode" class="form-input" value="${this.escapeHtml(settings.zipCode || '')}">
                </div>
            </div>
        `;
    }

    renderPreferencesSettings(settings) {
        return `
            <div class="settings-form">
                <h3>Preferences</h3>
                <div class="form-group">
                    <label>Temperature Unit</label>
                    <select id="temperatureUnit" class="form-select">
                        <option value="celsius" ${settings.temperatureUnit === 'celsius' ? 'selected' : ''}>Celsius (°C)</option>
                        <option value="fahrenheit" ${settings.temperatureUnit === 'fahrenheit' ? 'selected' : ''}>Fahrenheit (°F)</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Date Format</label>
                    <select id="dateFormat" class="form-select">
                        <option value="DD/MM/YYYY" ${settings.dateFormat === 'DD/MM/YYYY' ? 'selected' : ''}>DD/MM/YYYY</option>
                        <option value="MM/DD/YYYY" ${settings.dateFormat === 'MM/DD/YYYY' ? 'selected' : ''}>MM/DD/YYYY</option>
                        <option value="YYYY-MM-DD" ${settings.dateFormat === 'YYYY-MM-DD' ? 'selected' : ''}>YYYY-MM-DD</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Time Format</label>
                    <select id="timeFormat" class="form-select">
                        <option value="12h" ${settings.timeFormat === '12h' ? 'selected' : ''}>12-hour</option>
                        <option value="24h" ${settings.timeFormat === '24h' ? 'selected' : ''}>24-hour</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Energy Unit</label>
                    <select id="energyUnit" class="form-select">
                        <option value="kWh" ${settings.energyUnit === 'kWh' ? 'selected' : ''}>kWh</option>
                        <option value="Wh" ${settings.energyUnit === 'Wh' ? 'selected' : ''}>Wh</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Currency</label>
                    <select id="currency" class="form-select">
                        <option value="ETB" ${settings.currency === 'ETB' ? 'selected' : ''}>Ethiopian Birr (ETB)</option>
                        <option value="USD" ${settings.currency === 'USD' ? 'selected' : ''}>US Dollar (USD)</option>
                        <option value="EUR" ${settings.currency === 'EUR' ? 'selected' : ''}>Euro (EUR)</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Default View</label>
                    <select id="defaultView" class="form-select">
                        <option value="dashboard" ${settings.defaultView === 'dashboard' ? 'selected' : ''}>Dashboard</option>
                        <option value="devices" ${settings.defaultView === 'devices' ? 'selected' : ''}>Devices</option>
                        <option value="automation" ${settings.defaultView === 'automation' ? 'selected' : ''}>Automation</option>
                    </select>
                </div>
            </div>
        `;
    }

    renderSecuritySettings(settings) {
        const hasPin = settings.hasPin;
        return `
            <div class="settings-form">
                <h3>Security Settings</h3>
                <div class="form-group">
                    <label class="checkbox-label">
                        <input type="checkbox" id="requirePin" ${settings.requirePin ? 'checked' : ''}>
                        Require PIN for access
                    </label>
                </div>
                <div class="form-group" id="pin-group" style="display: ${settings.requirePin ? 'block' : 'none'}">
                    <label>PIN Code (4-6 digits)</label>
                    <input type="password" id="pinCode" class="form-input" maxlength="6" placeholder="Enter PIN code">
                    ${hasPin ? '<small class="info">Leave blank to keep existing PIN</small>' : ''}
                </div>
                <div class="form-group">
                    <label>Max Failed Attempts</label>
                    <input type="number" id="maxFailedAttempts" class="form-input" value="${settings.maxFailedAttempts || 5}" min="1" max="10">
                </div>
                <div class="form-group">
                    <label>Session Timeout (seconds)</label>
                    <input type="number" id="sessionTimeout" class="form-input" value="${settings.sessionTimeout || 3600}">
                </div>
                <div class="form-group">
                    <label class="checkbox-label">
                        <input type="checkbox" id="guestAccess" ${settings.guestAccess ? 'checked' : ''}>
                        Enable Guest Access
                    </label>
                </div>
                <div class="form-group" id="guest-pin-group" style="display: ${settings.guestAccess ? 'block' : 'none'}">
                    <label>Guest PIN Code</label>
                    <input type="password" id="guestPin" class="form-input" maxlength="6" placeholder="Enter guest PIN">
                </div>
            </div>
            
            <script>
                document.getElementById('requirePin')?.addEventListener('change', (e) => {
                    document.getElementById('pin-group').style.display = e.target.checked ? 'block' : 'none';
                });
                document.getElementById('guestAccess')?.addEventListener('change', (e) => {
                    document.getElementById('guest-pin-group').style.display = e.target.checked ? 'block' : 'none';
                });
            </script>
        `;
    }

    renderNotificationSettings(settings) {
        return `
            <div class="settings-form">
                <h3>Notification Settings</h3>
                <div class="form-group">
                    <label class="checkbox-label">
                        <input type="checkbox" id="deviceStatus" ${settings.deviceStatus ? 'checked' : ''}>
                        Device Status Changes
                    </label>
                </div>
                <div class="form-group">
                    <label class="checkbox-label">
                        <input type="checkbox" id="energyAlerts" ${settings.energyAlerts ? 'checked' : ''}>
                        Energy Alerts
                    </label>
                </div>
                <div class="form-group">
                    <label class="checkbox-label">
                        <input type="checkbox" id="securityAlerts" ${settings.securityAlerts ? 'checked' : ''}>
                        Security Alerts
                    </label>
                </div>
                <div class="form-group">
                    <label class="checkbox-label">
                        <input type="checkbox" id="maintenanceReminders" ${settings.maintenanceReminders ? 'checked' : ''}>
                        Maintenance Reminders
                    </label>
                </div>
                <div class="form-group">
                    <label class="checkbox-label">
                        <input type="checkbox" id="dailyDigest" ${settings.dailyDigest ? 'checked' : ''}>
                        Daily Digest
                    </label>
                </div>
                <div class="form-group">
                    <label class="checkbox-label">
                        <input type="checkbox" id="weeklyReport" ${settings.weeklyReport ? 'checked' : ''}>
                        Weekly Report
                    </label>
                </div>
                <div class="form-group">
                    <label class="checkbox-label">
                        <input type="checkbox" id="pushEnabled" ${settings.pushEnabled ? 'checked' : ''}>
                        Push Notifications
                    </label>
                </div>
                <div class="form-group">
                    <label class="checkbox-label">
                        <input type="checkbox" id="soundEnabled" ${settings.soundEnabled ? 'checked' : ''}>
                        Sound Effects
                    </label>
                </div>
            </div>
        `;
    }

    renderIntegrationSettings(settings) {
        return `
            <div class="settings-form">
                <h3>Integrations</h3>
                <div class="form-group">
                    <label class="checkbox-label">
                        <input type="checkbox" id="googleHome" ${settings.googleHome ? 'checked' : ''}>
                        Google Home
                    </label>
                </div>
                <div class="form-group">
                    <label class="checkbox-label">
                        <input type="checkbox" id="alexa" ${settings.alexa ? 'checked' : ''}>
                        Amazon Alexa
                    </label>
                </div>
                <div class="form-group">
                    <label class="checkbox-label">
                        <input type="checkbox" id="ifttt" ${settings.ifttt ? 'checked' : ''}>
                        IFTTT
                    </label>
                </div>
                <div class="form-group">
                    <label class="checkbox-label">
                        <input type="checkbox" id="homekit" ${settings.homekit ? 'checked' : ''}>
                        Apple HomeKit
                    </label>
                </div>
            </div>
        `;
    }

    renderBackupSettings(settings) {
        return `
            <div class="settings-form">
                <h3>Backup Settings</h3>
                <div class="form-group">
                    <label class="checkbox-label">
                        <input type="checkbox" id="autoBackup" ${settings.autoBackup ? 'checked' : ''}>
                        Automatic Backup
                    </label>
                </div>
                <div class="form-group">
                    <label>Backup Frequency</label>
                    <select id="backupFrequency" class="form-select">
                        <option value="daily" ${settings.backupFrequency === 'daily' ? 'selected' : ''}>Daily</option>
                        <option value="weekly" ${settings.backupFrequency === 'weekly' ? 'selected' : ''}>Weekly</option>
                        <option value="monthly" ${settings.backupFrequency === 'monthly' ? 'selected' : ''}>Monthly</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Backup Time</label>
                    <input type="time" id="backupTime" class="form-input" value="${settings.backupTime || '03:00'}">
                </div>
                <div class="form-group">
                    <label>Max Backups to Keep</label>
                    <input type="number" id="maxBackups" class="form-input" value="${settings.maxBackups || 10}" min="1" max="50">
                </div>
                <div class="form-group">
                    <label class="checkbox-label">
                        <input type="checkbox" id="cloudBackup" ${settings.cloudBackup ? 'checked' : ''}>
                        Cloud Backup
                    </label>
                </div>
                <button id="backup-now-btn" class="btn btn-secondary">Backup Now</button>
            </div>
        `;
    }

    renderAdvancedSettings(settings) {
        return `
            <div class="settings-form">
                <h3>Advanced Settings</h3>
                <div class="form-group">
                    <label class="checkbox-label">
                        <input type="checkbox" id="debugMode" ${settings.debugMode ? 'checked' : ''}>
                        Debug Mode
                    </label>
                </div>
                <div class="form-group">
                    <label>Log Level</label>
                    <select id="logLevel" class="form-select">
                        <option value="debug" ${settings.logLevel === 'debug' ? 'selected' : ''}>Debug</option>
                        <option value="info" ${settings.logLevel === 'info' ? 'selected' : ''}>Info</option>
                        <option value="warn" ${settings.logLevel === 'warn' ? 'selected' : ''}>Warning</option>
                        <option value="error" ${settings.logLevel === 'error' ? 'selected' : ''}>Error</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="checkbox-label">
                        <input type="checkbox" id="apiAccess" ${settings.apiAccess ? 'checked' : ''}>
                        Enable API Access
                    </label>
                </div>
                ${settings.apiAccess ? `
                    <div class="form-group">
                        <label>API Key</label>
                        <input type="text" id="apiKey" class="form-input" value="${this.escapeHtml(settings.apiKey || '')}" readonly>
                        <button id="generate-api-key" class="btn btn-sm btn-secondary">Generate New Key</button>
                    </div>
                ` : ''}
                <div class="form-group">
                    <label>Webhook URL</label>
                    <input type="url" id="webhookUrl" class="form-input" value="${this.escapeHtml(settings.webhookUrl || '')}">
                </div>
            </div>
        `;
    }

    saveSettings() {
        if (!this.currentHomeId) return;
        
        const updates = {};
        
        switch (this.currentCategory) {
            case 'general':
                updates.general = {
                    name: document.getElementById('home-name')?.value,
                    nameAm: document.getElementById('home-name-am')?.value,
                    description: document.getElementById('home-description')?.value,
                    timezone: document.getElementById('timezone')?.value,
                    language: document.getElementById('language')?.value
                };
                break;
            case 'location':
                updates.location = {
                    address: document.getElementById('address')?.value,
                    city: document.getElementById('city')?.value,
                    country: document.getElementById('country')?.value,
                    zipCode: document.getElementById('zipCode')?.value
                };
                break;
            case 'preferences':
                updates.preferences = {
                    temperatureUnit: document.getElementById('temperatureUnit')?.value,
                    dateFormat: document.getElementById('dateFormat')?.value,
                    timeFormat: document.getElementById('timeFormat')?.value,
                    energyUnit: document.getElementById('energyUnit')?.value,
                    currency: document.getElementById('currency')?.value,
                    defaultView: document.getElementById('defaultView')?.value
                };
                break;
            case 'security':
                const pinCode = document.getElementById('pinCode')?.value;
                const guestPin = document.getElementById('guestPin')?.value;
                updates.security = {
                    requirePin: document.getElementById('requirePin')?.checked,
                    maxFailedAttempts: parseInt(document.getElementById('maxFailedAttempts')?.value),
                    sessionTimeout: parseInt(document.getElementById('sessionTimeout')?.value),
                    guestAccess: document.getElementById('guestAccess')?.checked
                };
                if (pinCode) updates.security.pinCode = pinCode;
                if (guestPin && updates.security.guestAccess) updates.security.guestPin = guestPin;
                break;
            case 'notifications':
                updates.notifications = {
                    deviceStatus: document.getElementById('deviceStatus')?.checked,
                    energyAlerts: document.getElementById('energyAlerts')?.checked,
                    securityAlerts: document.getElementById('securityAlerts')?.checked,
                    maintenanceReminders: document.getElementById('maintenanceReminders')?.checked,
                    dailyDigest: document.getElementById('dailyDigest')?.checked,
                    weeklyReport: document.getElementById('weeklyReport')?.checked,
                    pushEnabled: document.getElementById('pushEnabled')?.checked,
                    soundEnabled: document.getElementById('soundEnabled')?.checked
                };
                break;
            case 'integrations':
                updates.integrations = {
                    googleHome: document.getElementById('googleHome')?.checked,
                    alexa: document.getElementById('alexa')?.checked,
                    ifttt: document.getElementById('ifttt')?.checked,
                    homekit: document.getElementById('homekit')?.checked
                };
                break;
            case 'backup':
                updates.backup = {
                    autoBackup: document.getElementById('autoBackup')?.checked,
                    backupFrequency: document.getElementById('backupFrequency')?.value,
                    backupTime: document.getElementById('backupTime')?.value,
                    maxBackups: parseInt(document.getElementById('maxBackups')?.value),
                    cloudBackup: document.getElementById('cloudBackup')?.checked
                };
                break;
            case 'advanced':
                updates.advanced = {
                    debugMode: document.getElementById('debugMode')?.checked,
                    logLevel: document.getElementById('logLevel')?.value,
                    apiAccess: document.getElementById('apiAccess')?.checked,
                    webhookUrl: document.getElementById('webhookUrl')?.value
                };
                break;
        }
        
        this.settingsManager.updateMultipleSettings(this.currentHomeId, updates);
        this.showToast('Settings saved successfully!', 'success');
        this.renderCategory();
    }

    resetSettings() {
        if (confirm('Are you sure you want to reset all settings to default? This action cannot be undone.')) {
            this.settingsManager.resetSettings(this.currentHomeId, this.currentCategory);
            this.showToast('Settings reset to default', 'info');
            this.renderCategory();
        }
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

const homeSettingsStyles = `
    .home-settings-panel {
        background: var(--bg-card);
        border-radius: 12px;
        padding: 20px;
        border: 1px solid var(--border-color);
    }
    
    .settings-header {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 20px;
        padding-bottom: 12px;
        border-bottom: 1px solid var(--border-color);
    }
    
    .settings-header i {
        font-size: 20px;
        color: var(--primary);
    }
    
    .settings-header h3 {
        flex: 1;
        margin: 0;
    }
    
    .home-selector {
        padding: 6px 12px;
        border-radius: 6px;
        border: 1px solid var(--border-color);
        background: var(--bg-primary);
        color: var(--text-primary);
    }
    
    .settings-content {
        display: flex;
        gap: 20px;
        min-height: 400px;
    }
    
    .settings-sidebar {
        width: 200px;
        display: flex;
        flex-direction: column;
        gap: 4px;
    }
    
    .settings-category {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 10px 12px;
        background: none;
        border: none;
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.2s ease;
        color: var(--text-secondary);
    }
    
    .settings-category:hover {
        background: var(--bg-hover);
        color: var(--primary);
    }
    
    .settings-category.active {
        background: var(--primary);
        color: white;
    }
    
    .settings-main {
        flex: 1;
        background: var(--bg-secondary);
        border-radius: 8px;
        padding: 20px;
    }
    
    .settings-form {
        max-width: 500px;
    }
    
    .settings-form h3 {
        margin-bottom: 20px;
        padding-bottom: 10px;
        border-bottom: 1px solid var(--border-color);
    }
    
    .settings-footer {
        display: flex;
        justify-content: flex-end;
        gap: 12px;
        margin-top: 20px;
        padding-top: 20px;
        border-top: 1px solid var(--border-color);
    }
    
    .checkbox-label {
        display: flex;
        align-items: center;
        gap: 8px;
        cursor: pointer;
    }
    
    .info {
        display: block;
        font-size: 11px;
        color: var(--text-muted);
        margin-top: 4px;
    }
`;

// Inject styles
if (typeof document !== 'undefined') {
    const styleSheet = document.createElement('style');
    styleSheet.textContent = homeSettingsStyles;
    document.head.appendChild(styleSheet);
}

// ============================================
// CREATE SINGLETON INSTANCES
// ============================================

let homeSettings = null;

const initHomeSettings = (homeManager) => {
    homeSettings = new HomeSettingsManager(homeManager);
    new HomeSettingsUI(homeSettings, homeManager);
    return homeSettings;
};

// ============================================
// EXPORTS
// ============================================

// Expose to window
window.HomeSettingsManager = HomeSettingsManager;
window.HomeSettingsConfig = HomeSettingsConfig;
window.initHomeSettings = initHomeSettings;

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        homeSettings,
        HomeSettingsManager,
        HomeSettingsConfig,
        initHomeSettings
    };
}

// ES modules export
export {
    homeSettings,
    HomeSettingsManager,
    HomeSettingsConfig,
    initHomeSettings
};