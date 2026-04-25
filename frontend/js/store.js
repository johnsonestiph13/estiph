/**
 * ESTIF HOME ULTIMATE - STATE MANAGEMENT STORE
 * Centralized state management with Vuex-like API, persistence, and reactivity
 * Version: 2.0.0
 * Author: Estifanos Yohannis
 */

// ============================================
// STORE CONFIGURATION
// ============================================

const StoreConfig = {
    debug: false,
    persist: true,
    persistKey: 'estif_store',
    persistPaths: ['user', 'settings', 'theme', 'language'],
    persistThrottle: 1000, // ms
    strict: false,
    plugins: []
};

// ============================================
// STATE
// ============================================

const initialState = {
    // User State
    user: {
        isAuthenticated: false,
        currentUser: null,
        token: null,
        refreshToken: null,
        permissions: [],
        homes: []
    },
    
    // Device State
    devices: {
        items: [],
        loading: false,
        error: null,
        lastUpdated: null,
        filters: {
            room: null,
            status: null,
            search: ''
        }
    },
    
    // Home State
    homes: {
        items: [],
        currentHome: null,
        loading: false,
        error: null
    },
    
    // Automation State
    automations: {
        rules: [],
        logs: [],
        loading: false,
        error: null
    },
    
    // Analytics State
    analytics: {
        energyData: [],
        deviceStats: [],
        peakHours: [],
        loading: false,
        dateRange: 'week'
    },
    
    // UI State
    ui: {
        theme: 'light',
        language: 'en',
        sidebarOpen: false,
        modalOpen: false,
        modalData: null,
        toast: null,
        loading: false,
        notifications: [],
        unreadCount: 0
    },
    
    // Connection State
    connection: {
        isConnected: false,
        isReconnecting: false,
        socketId: null,
        espConnected: false,
        lastPing: null
    },
    
    // System State
    system: {
        temperature: 23,
        humidity: 45,
        energyUsage: 0,
        activeDevices: 0,
        uptime: 0,
        version: '2.0.0'
    },
    
    // Activity State
    activity: {
        logs: [],
        loading: false,
        hasMore: true,
        page: 1
    }
};

// ============================================
// MUTATIONS
// ============================================

const mutations = {
    // ========== User Mutations ==========
    SET_USER(state, user) {
        state.user.currentUser = user;
        state.user.isAuthenticated = !!user;
    },
    
    SET_TOKEN(state, token) {
        state.user.token = token;
    },
    
    SET_REFRESH_TOKEN(state, refreshToken) {
        state.user.refreshToken = refreshToken;
    },
    
    SET_USER_PERMISSIONS(state, permissions) {
        state.user.permissions = permissions;
    },
    
    SET_USER_HOMES(state, homes) {
        state.user.homes = homes;
    },
    
    LOGOUT(state) {
        state.user.currentUser = null;
        state.user.isAuthenticated = false;
        state.user.token = null;
        state.user.refreshToken = null;
        state.user.permissions = [];
        state.user.homes = [];
    },
    
    // ========== Device Mutations ==========
    SET_DEVICES(state, devices) {
        state.devices.items = devices;
        state.devices.lastUpdated = Date.now();
    },
    
    ADD_DEVICE(state, device) {
        state.devices.items.push(device);
    },
    
    UPDATE_DEVICE(state, updatedDevice) {
        const index = state.devices.items.findIndex(d => d.id === updatedDevice.id);
        if (index !== -1) {
            state.devices.items[index] = { ...state.devices.items[index], ...updatedDevice };
        }
    },
    
    REMOVE_DEVICE(state, deviceId) {
        state.devices.items = state.devices.items.filter(d => d.id !== deviceId);
    },
    
    SET_DEVICES_LOADING(state, loading) {
        state.devices.loading = loading;
    },
    
    SET_DEVICES_ERROR(state, error) {
        state.devices.error = error;
    },
    
    SET_DEVICE_FILTERS(state, filters) {
        state.devices.filters = { ...state.devices.filters, ...filters };
    },
    
    TOGGLE_DEVICE(state, { deviceId, state: deviceState }) {
        const device = state.devices.items.find(d => d.id === deviceId);
        if (device) {
            device.state = deviceState;
            device.lastUpdated = Date.now();
        }
    },
    
    TOGGLE_AUTO_MODE(state, { deviceId, enabled }) {
        const device = state.devices.items.find(d => d.id === deviceId);
        if (device) {
            device.autoMode = enabled;
        }
    },
    
    // ========== Home Mutations ==========
    SET_HOMES(state, homes) {
        state.homes.items = homes;
    },
    
    ADD_HOME(state, home) {
        state.homes.items.push(home);
    },
    
    UPDATE_HOME(state, updatedHome) {
        const index = state.homes.items.findIndex(h => h.id === updatedHome.id);
        if (index !== -1) {
            state.homes.items[index] = { ...state.homes.items[index], ...updatedHome };
        }
    },
    
    REMOVE_HOME(state, homeId) {
        state.homes.items = state.homes.items.filter(h => h.id !== homeId);
    },
    
    SET_CURRENT_HOME(state, home) {
        state.homes.currentHome = home;
    },
    
    SET_HOMES_LOADING(state, loading) {
        state.homes.loading = loading;
    },
    
    // ========== Automation Mutations ==========
    SET_AUTOMATION_RULES(state, rules) {
        state.automations.rules = rules;
    },
    
    ADD_AUTOMATION_RULE(state, rule) {
        state.automations.rules.push(rule);
    },
    
    UPDATE_AUTOMATION_RULE(state, updatedRule) {
        const index = state.automations.rules.findIndex(r => r.id === updatedRule.id);
        if (index !== -1) {
            state.automations.rules[index] = { ...state.automations.rules[index], ...updatedRule };
        }
    },
    
    REMOVE_AUTOMATION_RULE(state, ruleId) {
        state.automations.rules = state.automations.rules.filter(r => r.id !== ruleId);
    },
    
    TOGGLE_AUTOMATION_RULE(state, { ruleId, enabled }) {
        const rule = state.automations.rules.find(r => r.id === ruleId);
        if (rule) {
            rule.enabled = enabled;
        }
    },
    
    ADD_AUTOMATION_LOG(state, log) {
        state.automations.logs.unshift(log);
        if (state.automations.logs.length > 100) {
            state.automations.logs.pop();
        }
    },
    
    // ========== Analytics Mutations ==========
    SET_ENERGY_DATA(state, data) {
        state.analytics.energyData = data;
    },
    
    SET_DEVICE_STATS(state, stats) {
        state.analytics.deviceStats = stats;
    },
    
    SET_PEAK_HOURS(state, hours) {
        state.analytics.peakHours = hours;
    },
    
    SET_ANALYTICS_LOADING(state, loading) {
        state.analytics.loading = loading;
    },
    
    SET_DATE_RANGE(state, range) {
        state.analytics.dateRange = range;
    },
    
    // ========== UI Mutations ==========
    SET_THEME(state, theme) {
        state.ui.theme = theme;
        if (typeof document !== 'undefined') {
            if (theme === 'dark') {
                document.documentElement.setAttribute('data-theme', 'dark');
            } else {
                document.documentElement.removeAttribute('data-theme');
            }
        }
    },
    
    SET_LANGUAGE(state, language) {
        state.ui.language = language;
    },
    
    TOGGLE_SIDEBAR(state) {
        state.ui.sidebarOpen = !state.ui.sidebarOpen;
    },
    
    SET_SIDEBAR(state, open) {
        state.ui.sidebarOpen = open;
    },
    
    SHOW_MODAL(state, { modal, data }) {
        state.ui.modalOpen = true;
        state.ui.modalData = { modal, data };
    },
    
    HIDE_MODAL(state) {
        state.ui.modalOpen = false;
        state.ui.modalData = null;
    },
    
    SHOW_TOAST(state, { message, type = 'info', duration = 3000 }) {
        state.ui.toast = { message, type, duration };
        setTimeout(() => {
            if (state.ui.toast?.message === message) {
                state.ui.toast = null;
            }
        }, duration);
    },
    
    HIDE_TOAST(state) {
        state.ui.toast = null;
    },
    
    SET_LOADING(state, loading) {
        state.ui.loading = loading;
    },
    
    ADD_NOTIFICATION(state, notification) {
        state.ui.notifications.unshift(notification);
        state.ui.unreadCount++;
        if (state.ui.notifications.length > 50) {
            state.ui.notifications.pop();
        }
    },
    
    MARK_NOTIFICATION_READ(state, notificationId) {
        const notification = state.ui.notifications.find(n => n.id === notificationId);
        if (notification) {
            notification.read = true;
            state.ui.unreadCount = Math.max(0, state.ui.unreadCount - 1);
        }
    },
    
    MARK_ALL_NOTIFICATIONS_READ(state) {
        state.ui.notifications.forEach(n => n.read = true);
        state.ui.unreadCount = 0;
    },
    
    CLEAR_NOTIFICATIONS(state) {
        state.ui.notifications = [];
        state.ui.unreadCount = 0;
    },
    
    // ========== Connection Mutations ==========
    SET_CONNECTION_STATUS(state, isConnected) {
        state.connection.isConnected = isConnected;
    },
    
    SET_RECONNECTING(state, isReconnecting) {
        state.connection.isReconnecting = isReconnecting;
    },
    
    SET_SOCKET_ID(state, socketId) {
        state.connection.socketId = socketId;
    },
    
    SET_ESP_CONNECTED(state, espConnected) {
        state.connection.espConnected = espConnected;
    },
    
    SET_LAST_PING(state) {
        state.connection.lastPing = Date.now();
    },
    
    // ========== System Mutations ==========
    UPDATE_SYSTEM_STATS(state, stats) {
        state.system = { ...state.system, ...stats };
    },
    
    SET_TEMPERATURE(state, temperature) {
        state.system.temperature = temperature;
    },
    
    SET_HUMIDITY(state, humidity) {
        state.system.humidity = humidity;
    },
    
    SET_ENERGY_USAGE(state, energyUsage) {
        state.system.energyUsage = energyUsage;
    },
    
    SET_ACTIVE_DEVICES(state, activeDevices) {
        state.system.activeDevices = activeDevices;
    },
    
    // ========== Activity Mutations ==========
    ADD_ACTIVITY_LOG(state, log) {
        state.activity.logs.unshift({
            ...log,
            id: Date.now(),
            timestamp: new Date().toISOString()
        });
        if (state.activity.logs.length > 200) {
            state.activity.logs.pop();
        }
    },
    
    SET_ACTIVITY_LOGS(state, logs) {
        state.activity.logs = logs;
    },
    
    CLEAR_ACTIVITY_LOGS(state) {
        state.activity.logs = [];
    },
    
    // ========== Store Mutations ==========
    RESET_STATE(state) {
        Object.assign(state, JSON.parse(JSON.stringify(initialState)));
    },
    
    HYDRATE_STATE(state, savedState) {
        Object.assign(state, savedState);
    }
};

// ============================================
// ACTIONS
// ============================================

const actions = {
    // ========== User Actions ==========
    async login({ commit, dispatch }, { email, password }) {
        try {
            commit('SET_LOADING', true);
            
            // Simulate API call - Replace with actual API
            const response = await mockApiLogin(email, password);
            
            commit('SET_USER', response.user);
            commit('SET_TOKEN', response.token);
            commit('SET_REFRESH_TOKEN', response.refreshToken);
            commit('SET_USER_PERMISSIONS', response.permissions || []);
            
            // Store token in localStorage for API calls
            localStorage.setItem('auth_token', response.token);
            
            dispatch('addActivityLog', {
                action: 'login',
                message: `User ${response.user.name} logged in`,
                type: 'success'
            });
            
            commit('SHOW_TOAST', { message: 'Login successful!', type: 'success' });
            return { success: true, user: response.user };
        } catch (error) {
            commit('SHOW_TOAST', { message: error.message, type: 'error' });
            return { success: false, error: error.message };
        } finally {
            commit('SET_LOADING', false);
        }
    },
    
    async logout({ commit, dispatch }) {
        const user = store.state.user.currentUser;
        if (user) {
            dispatch('addActivityLog', {
                action: 'logout',
                message: `User ${user.name} logged out`,
                type: 'info'
            });
        }
        
        commit('LOGOUT');
        localStorage.removeItem('auth_token');
        commit('SHOW_TOAST', { message: 'Logged out successfully', type: 'info' });
    },
    
    // ========== Device Actions ==========
    async fetchDevices({ commit }) {
        commit('SET_DEVICES_LOADING', true);
        try {
            // Simulate API call - Replace with actual API
            const devices = await mockApiGetDevices();
            commit('SET_DEVICES', devices);
            commit('SET_DEVICES_ERROR', null);
            return devices;
        } catch (error) {
            commit('SET_DEVICES_ERROR', error.message);
            return [];
        } finally {
            commit('SET_DEVICES_LOADING', false);
        }
    },
    
    async toggleDevice({ commit, state, dispatch }, { deviceId }) {
        const device = state.devices.items.find(d => d.id === deviceId);
        if (!device) return;
        
        if (device.autoMode) {
            commit('SHOW_TOAST', { message: 'Device is in AUTO mode. Disable auto mode first.', type: 'warning' });
            return;
        }
        
        const newState = !device.state;
        commit('TOGGLE_DEVICE', { deviceId, state: newState });
        
        // Simulate API call
        await mockApiToggleDevice(deviceId, newState);
        
        dispatch('addActivityLog', {
            action: 'device_toggle',
            message: `${device.name} turned ${newState ? 'ON' : 'OFF'}`,
            type: newState ? 'success' : 'info'
        });
        
        commit('SHOW_TOAST', { message: `${device.name} ${newState ? 'ON' : 'OFF'}`, type: newState ? 'success' : 'info' });
    },
    
    async toggleAutoMode({ commit, state, dispatch }, { deviceId, enabled }) {
        const device = state.devices.items.find(d => d.id === deviceId);
        if (!device) return;
        
        commit('TOGGLE_AUTO_MODE', { deviceId, enabled });
        
        await mockApiToggleAutoMode(deviceId, enabled);
        
        dispatch('addActivityLog', {
            action: 'auto_mode',
            message: `${device.name} auto mode ${enabled ? 'enabled' : 'disabled'}`,
            type: 'info'
        });
        
        commit('SHOW_TOAST', { message: `${device.name} ${enabled ? 'AUTO' : 'MANUAL'} mode`, type: 'info' });
    },
    
    async masterControl({ commit, state, dispatch }, { state: masterState }) {
        const devicesToToggle = state.devices.items.filter(d => !d.autoMode);
        
        for (const device of devicesToToggle) {
            commit('TOGGLE_DEVICE', { deviceId: device.id, state: masterState });
        }
        
        await mockApiMasterControl(masterState);
        
        dispatch('addActivityLog', {
            action: 'master_control',
            message: `All devices turned ${masterState ? 'ON' : 'OFF'}`,
            type: masterState ? 'success' : 'info'
        });
        
        commit('SHOW_TOAST', { message: masterState ? 'All devices ON' : 'All devices OFF', type: masterState ? 'success' : 'info' });
    },
    
    // ========== Home Actions ==========
    async fetchHomes({ commit }) {
        commit('SET_HOMES_LOADING', true);
        try {
            const homes = await mockApiGetHomes();
            commit('SET_HOMES', homes);
            return homes;
        } catch (error) {
            commit('SHOW_TOAST', { message: error.message, type: 'error' });
            return [];
        } finally {
            commit('SET_HOMES_LOADING', false);
        }
    },
    
    setCurrentHome({ commit, dispatch }, home) {
        commit('SET_CURRENT_HOME', home);
        dispatch('fetchDevices');
        dispatch('addActivityLog', {
            action: 'switch_home',
            message: `Switched to home: ${home.name}`,
            type: 'info'
        });
    },
    
    // ========== Analytics Actions ==========
    async fetchEnergyData({ commit }, { days = 7 } = {}) {
        commit('SET_ANALYTICS_LOADING', true);
        try {
            const data = await mockApiGetEnergyData(days);
            commit('SET_ENERGY_DATA', data);
            return data;
        } catch (error) {
            commit('SHOW_TOAST', { message: error.message, type: 'error' });
            return [];
        } finally {
            commit('SET_ANALYTICS_LOADING', false);
        }
    },
    
    // ========== UI Actions ==========
    setTheme({ commit }, theme) {
        commit('SET_THEME', theme);
        localStorage.setItem('theme', theme);
    },
    
    setLanguage({ commit, dispatch }, language) {
        commit('SET_LANGUAGE', language);
        localStorage.setItem('language', language);
        
        // Update i18n if available
        if (window.i18n) {
            window.i18n.changeLanguage(language);
        }
        
        dispatch('addActivityLog', {
            action: 'language_change',
            message: `Language changed to ${language}`,
            type: 'info'
        });
    },
    
    // ========== Activity Actions ==========
    addActivityLog({ commit }, { action, message, type = 'info' }) {
        commit('ADD_ACTIVITY_LOG', { action, message, type, timestamp: new Date().toISOString() });
    },
    
    // ========== System Actions ==========
    async fetchSystemStatus({ commit }) {
        try {
            const status = await mockApiGetStatus();
            commit('UPDATE_SYSTEM_STATS', status);
            return status;
        } catch (error) {
            console.error('Failed to fetch system status:', error);
            return null;
        }
    },
    
    // ========== Connection Actions ==========
    updateConnectionStatus({ commit }, isConnected) {
        commit('SET_CONNECTION_STATUS', isConnected);
        if (isConnected) {
            commit('SET_LAST_PING');
        }
    },
    
    // ========== Notification Actions ==========
    addNotification({ commit }, notification) {
        commit('ADD_NOTIFICATION', {
            ...notification,
            id: Date.now(),
            createdAt: new Date().toISOString(),
            read: false
        });
    }
};

// ============================================
// GETTERS
// ============================================

const getters = {
    // User Getters
    isAuthenticated: (state) => state.user.isAuthenticated,
    currentUser: (state) => state.user.currentUser,
    userPermissions: (state) => state.user.permissions,
    hasPermission: (state) => (permission) => state.user.permissions.includes(permission),
    
    // Device Getters
    devices: (state) => state.devices.items,
    activeDevices: (state) => state.devices.items.filter(d => d.state),
    autoModeDevices: (state) => state.devices.items.filter(d => d.autoMode),
    manualModeDevices: (state) => state.devices.items.filter(d => !d.autoMode),
    filteredDevices: (state) => {
        let result = [...state.devices.items];
        const { room, status, search } = state.devices.filters;
        
        if (room) {
            result = result.filter(d => d.room === room);
        }
        if (status === 'active') {
            result = result.filter(d => d.state);
        }
        if (status === 'inactive') {
            result = result.filter(d => !d.state);
        }
        if (search) {
            const searchLower = search.toLowerCase();
            result = result.filter(d => 
                d.name.toLowerCase().includes(searchLower) ||
                (d.nameAm && d.nameAm.toLowerCase().includes(searchLower))
            );
        }
        
        return result;
    },
    devicesByRoom: (state) => {
        const rooms = {};
        state.devices.items.forEach(device => {
            if (!rooms[device.room]) rooms[device.room] = [];
            rooms[device.room].push(device);
        });
        return rooms;
    },
    totalPower: (state) => state.devices.items.reduce((sum, d) => sum + (d.state ? d.power : 0), 0),
    
    // Home Getters
    homes: (state) => state.homes.items,
    currentHome: (state) => state.homes.currentHome,
    
    // Automation Getters
    automationRules: (state) => state.automations.rules,
    activeAutomationRules: (state) => state.automations.rules.filter(r => r.enabled),
    automationLogs: (state) => state.automations.logs,
    
    // Analytics Getters
    energyData: (state) => state.analytics.energyData,
    deviceStats: (state) => state.analytics.deviceStats,
    peakHours: (state) => state.analytics.peakHours,
    totalEnergyConsumption: (state) => {
        return state.analytics.energyData.reduce((sum, d) => sum + (d.value || 0), 0);
    },
    
    // UI Getters
    theme: (state) => state.ui.theme,
    language: (state) => state.ui.language,
    isSidebarOpen: (state) => state.ui.sidebarOpen,
    isModalOpen: (state) => state.ui.modalOpen,
    modalData: (state) => state.ui.modalData,
    toast: (state) => state.ui.toast,
    isLoading: (state) => state.ui.loading,
    notifications: (state) => state.ui.notifications,
    unreadCount: (state) => state.ui.unreadCount,
    
    // Connection Getters
    isConnected: (state) => state.connection.isConnected,
    isReconnecting: (state) => state.connection.isReconnecting,
    espConnected: (state) => state.connection.espConnected,
    
    // System Getters
    temperature: (state) => state.system.temperature,
    humidity: (state) => state.system.humidity,
    energyUsage: (state) => state.system.energyUsage,
    activeDevicesCount: (state) => state.system.activeDevices,
    systemUptime: (state) => state.system.uptime,
    appVersion: (state) => state.system.version,
    
    // Activity Getters
    activityLogs: (state) => state.activity.logs,
    recentActivity: (state) => state.activity.logs.slice(0, 10)
};

// ============================================
// STORE CLASS
// ============================================

class Store {
    constructor(options = {}) {
        this.state = this.deepClone(initialState);
        this.mutations = mutations;
        this.actions = actions;
        this.getters = getters;
        this.config = { ...StoreConfig, ...options };
        this.subscribers = [];
        this.actionSubscribers = [];
        
        this.init();
    }
    
    init() {
        // Load persisted state
        if (this.config.persist) {
            this.loadPersistedState();
        }
        
        // Apply plugins
        if (this.config.plugins) {
            this.config.plugins.forEach(plugin => plugin(this));
        }
        
        // Auto-save on mutations
        if (this.config.persist) {
            this.subscribe((mutation, state) => {
                this.persistState(mutation, state);
            });
        }
        
        this.config.debug && console.log('[Store] Initialized');
    }
    
    // ========== Core Methods ==========
    
    commit(mutationName, payload) {
        const mutation = this.mutations[mutationName];
        if (!mutation) {
            console.error(`[Store] Mutation "${mutationName}" not found`);
            return;
        }
        
        const oldState = this.deepClone(this.state);
        
        try {
            mutation(this.state, payload);
            
            this.config.debug && console.log(`[Store] Mutation: ${mutationName}`, payload);
            
            // Notify subscribers
            this.subscribers.forEach(sub => {
                sub({ mutation: mutationName, payload }, this.state, oldState);
            });
            
        } catch (error) {
            console.error(`[Store] Error in mutation ${mutationName}:`, error);
        }
    }
    
    async dispatch(actionName, payload) {
        const action = this.actions[actionName];
        if (!action) {
            console.error(`[Store] Action "${actionName}" not found`);
            return;
        }
        
        this.config.debug && console.log(`[Store] Action: ${actionName}`, payload);
        
        // Notify action subscribers
        this.actionSubscribers.forEach(sub => {
            sub({ action: actionName, payload });
        });
        
        try {
            const result = await action(this, payload);
            return result;
        } catch (error) {
            console.error(`[Store] Error in action ${actionName}:`, error);
            throw error;
        }
    }
    
    getter(getterName) {
        const getter = this.getters[getterName];
        if (!getter) {
            console.error(`[Store] Getter "${getterName}" not found`);
            return null;
        }
        
        if (typeof getter === 'function') {
            return getter(this.state, this.getters);
        }
        
        return getter;
    }
    
    // ========== Subscription Methods ==========
    
    subscribe(callback) {
        this.subscribers.push(callback);
        return () => {
            const index = this.subscribers.indexOf(callback);
            if (index !== -1) this.subscribers.splice(index, 1);
        };
    }
    
    subscribeAction(callback) {
        this.actionSubscribers.push(callback);
        return () => {
            const index = this.actionSubscribers.indexOf(callback);
            if (index !== -1) this.actionSubscribers.splice(index, 1);
        };
    }
    
    // ========== Persistence Methods ==========
    
    loadPersistedState() {
        try {
            const saved = localStorage.getItem(this.config.persistKey);
            if (saved) {
                const persisted = JSON.parse(saved);
                
                // Only restore allowed paths
                if (this.config.persistPaths && this.config.persistPaths.length) {
                    for (const path of this.config.persistPaths) {
                        const value = this.getNestedValue(persisted, path);
                        if (value !== undefined) {
                            this.setNestedValue(this.state, path, value);
                        }
                    }
                } else {
                    Object.assign(this.state, persisted);
                }
                
                this.config.debug && console.log('[Store] Loaded persisted state');
            }
        } catch (error) {
            console.error('[Store] Failed to load persisted state:', error);
        }
    }
    
    persistState(mutation, state) {
        if (this.persistTimeout) clearTimeout(this.persistTimeout);
        
        this.persistTimeout = setTimeout(() => {
            try {
                const toPersist = {};
                
                if (this.config.persistPaths && this.config.persistPaths.length) {
                    for (const path of this.config.persistPaths) {
                        const value = this.getNestedValue(state, path);
                        if (value !== undefined) {
                            this.setNestedValue(toPersist, path, value);
                        }
                    }
                } else {
                    Object.assign(toPersist, state);
                }
                
                localStorage.setItem(this.config.persistKey, JSON.stringify(toPersist));
                this.config.debug && console.log('[Store] Persisted state');
            } catch (error) {
                console.error('[Store] Failed to persist state:', error);
            }
        }, this.config.persistThrottle);
    }
    
    // ========== Utility Methods ==========
    
    deepClone(obj) {
        return JSON.parse(JSON.stringify(obj));
    }
    
    getNestedValue(obj, path) {
        const parts = path.split('.');
        let current = obj;
        for (const part of parts) {
            if (current[part] === undefined) return undefined;
            current = current[part];
        }
        return current;
    }
    
    setNestedValue(obj, path, value) {
        const parts = path.split('.');
        let current = obj;
        for (let i = 0; i < parts.length - 1; i++) {
            if (!current[parts[i]]) current[parts[i]] = {};
            current = current[parts[i]];
        }
        current[parts[parts.length - 1]] = value;
    }
    
    reset() {
        this.commit('RESET_STATE');
        this.config.debug && console.log('[Store] State reset');
    }
    
    getState() {
        return this.deepClone(this.state);
    }
    
    replaceState(newState) {
        Object.assign(this.state, newState);
        this.config.debug && console.log('[Store] State replaced');
    }
}

// ============================================
// MOCK API FUNCTIONS (For demo purposes)
// ============================================

async function mockApiLogin(email, password) {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            if (email === 'admin@estifhome.com' && password === 'admin123') {
                resolve({
                    user: {
                        id: 1,
                        name: 'Admin User',
                        email: 'admin@estifhome.com',
                        role: 'admin'
                    },
                    token: 'mock-jwt-token-123',
                    refreshToken: 'mock-refresh-token-456',
                    permissions: ['admin', 'devices', 'automation', 'settings']
                });
            } else {
                reject(new Error('Invalid email or password'));
            }
        }, 500);
    });
}

async function mockApiGetDevices() {
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve([
                { id: 0, name: 'Light', nameAm: 'መብራት', room: 'Living Room', roomAm: 'ሳሎን', icon: '💡', power: 10, state: false, autoMode: false, gpio: 23 },
                { id: 1, name: 'Fan', nameAm: 'ማራገቢያ', room: 'Bedroom', roomAm: 'መኝታ', icon: '🌀', power: 40, state: false, autoMode: true, gpio: 22 },
                { id: 2, name: 'AC', nameAm: 'አየር ማቀዝቀዣ', room: 'Master', roomAm: 'ዋና', icon: '❄️', power: 120, state: false, autoMode: true, gpio: 21 },
                { id: 3, name: 'TV', nameAm: 'ቴሌቪዥን', room: 'Entertainment', roomAm: 'መዝናኛ', icon: '📺', power: 80, state: false, autoMode: false, gpio: 19 },
                { id: 4, name: 'Heater', nameAm: 'ማሞቂያ', room: 'Bathroom', roomAm: 'መታጠቢያ', icon: '🔥', power: 1500, state: false, autoMode: true, gpio: 18 },
                { id: 5, name: 'Pump', nameAm: 'ፓምፕ', room: 'Garden', roomAm: 'አትክልት', icon: '💧', power: 250, state: false, autoMode: false, gpio: 5 }
            ]);
        }, 300);
    });
}

async function mockApiToggleDevice(deviceId, state) {
    return new Promise((resolve) => {
        setTimeout(() => resolve({ success: true }), 200);
    });
}

async function mockApiToggleAutoMode(deviceId, enabled) {
    return new Promise((resolve) => {
        setTimeout(() => resolve({ success: true }), 200);
    });
}

async function mockApiMasterControl(state) {
    return new Promise((resolve) => {
        setTimeout(() => resolve({ success: true }), 200);
    });
}

async function mockApiGetHomes() {
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve([
                { id: 1, name: 'Main Home', nameAm: 'ዋና ቤት', address: 'Addis Ababa, Ethiopia', devicesCount: 6, membersCount: 2 },
                { id: 2, name: 'Vacation Home', nameAm: 'የእረፍት ቤት', address: 'Bahir Dar, Ethiopia', devicesCount: 3, membersCount: 1 }
            ]);
        }, 300);
    });
}

async function mockApiGetEnergyData(days) {
    return new Promise((resolve) => {
        setTimeout(() => {
            const data = [];
            for (let i = 0; i < days; i++) {
                data.push({
                    date: new Date(Date.now() - i * 86400000).toISOString().split('T')[0],
                    value: Math.floor(Math.random() * 50) + 20
                });
            }
            resolve(data.reverse());
        }, 300);
    });
}

async function mockApiGetStatus() {
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve({
                temperature: Math.floor(Math.random() * 15) + 18,
                humidity: Math.floor(Math.random() * 40) + 30,
                energyUsage: Math.floor(Math.random() * 500) + 200,
                activeDevices: Math.floor(Math.random() * 6),
                uptime: process.uptime(),
                version: '2.0.0'
            });
        }, 200);
    });
}

// ============================================
// CREATE STORE INSTANCE
// ============================================

const store = new Store({
    debug: false,
    persist: true,
    persistKey: 'estif_store',
    persistPaths: ['user', 'ui.theme', 'ui.language', 'settings'],
    persistThrottle: 1000
});

// ============================================
// EXPORTS
// ============================================

// Expose to window
window.store = store;
window.Store = Store;

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { store, Store, mutations, actions, getters };
}

// For ES modules
export { store, Store, mutations, actions, getters };