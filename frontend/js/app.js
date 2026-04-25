/**
 * ESTIF HOME ULTIMATE - MAIN APPLICATION
 * Complete Smart Home Control System
 * Version: 1.0.0
 * Author: Estifanos Yohannis
 */

// ============================================
// APPLICATION STATE
// ============================================

const AppState = {
    // User State
    currentUser: null,
    sessionToken: null,
    isLoggedIn: false,
    
    // UI State
    currentPage: 'dashboard',
    currentLanguage: localStorage.getItem('language') || 'en',
    currentTheme: localStorage.getItem('theme') || 'light',
    sidebarOpen: false,
    
    // Device State
    devices: [],
    systemStats: {
        temperature: 23,
        humidity: 45,
        energyUsage: 0,
        activeDevices: 0
    },
    
    // Connection State
    socket: null,
    wsConnected: false,
    espConnected: false,
    
    // Voice State
    isListening: false,
    wakeWordDetected: false,
    recognition: null,
    voiceSupported: false,
    
    // Loading State
    isLoading: false,
    autoRefresh: true,
    
    // Data
    activityLog: [],
    notifications: [],
    automations: []
};

// ============================================
// TRANSLATIONS
// ============================================

const Translations = {
    en: {
        // Navigation
        dashboard: 'Dashboard',
        analytics: 'Analytics',
        devices: 'Devices',
        automation: 'Automation',
        settings: 'Settings',
        logout: 'Logout',
        
        // Common
        login: 'Login',
        register: 'Register',
        email: 'Email',
        password: 'Password',
        confirmPassword: 'Confirm Password',
        fullName: 'Full Name',
        save: 'Save',
        cancel: 'Cancel',
        delete: 'Delete',
        edit: 'Edit',
        add: 'Add',
        search: 'Search',
        filter: 'Filter',
        loading: 'Loading...',
        noData: 'No data available',
        
        // Dashboard
        welcome: 'Welcome back',
        totalDevices: 'Total Devices',
        activeNow: 'Active Now',
        autoMode: 'Auto Mode',
        temperature: 'Temperature',
        allOn: 'ALL ON',
        allOff: 'ALL OFF',
        recentActivity: 'Recent Activity',
        
        // Voice
        voiceAssistant: 'Voice Assistant',
        wakeWord: 'Say "Hey Estiph" or "ሰላም እስቲፍ"',
        startListening: 'Start Listening',
        listening: 'Listening...',
        processing: 'Processing...',
        
        // Emergency
        emergencyContact: 'Emergency Contact',
        emergencyDesc: 'Click to call for immediate assistance',
        
        // Messages
        loginSuccess: 'Login successful! Welcome',
        loginFailed: 'Invalid email or password',
        logoutSuccess: 'Logged out successfully',
        registerSuccess: 'Account created successfully! Please login',
        emailExists: 'Email already registered',
        passwordMismatch: 'Passwords do not match',
        autoModeBlock: 'Device is in AUTO mode. Disable auto mode first.',
        deviceNotFound: 'Device not found',
        unauthorized: 'Unauthorized access',
        
        // Device States
        on: 'ON',
        off: 'OFF',
        auto: 'AUTO',
        manual: 'MANUAL',
        
        // Connection
        connected: 'Connected',
        disconnected: 'Disconnected',
        
        // Settings
        darkMode: 'Dark Mode',
        darkModeDesc: 'Switch between light and dark theme',
        notifications: 'Notifications',
        notificationsDesc: 'Receive device notifications',
        soundEffects: 'Sound Effects',
        soundEffectsDesc: 'Play sounds for actions',
        temperatureUnit: 'Temperature Unit',
        temperatureUnitDesc: 'Celsius or Fahrenheit'
    },
    am: {
        // Navigation
        dashboard: 'ዳሽቦርድ',
        analytics: 'ትንተና',
        devices: 'መሳሪያዎች',
        automation: 'አውቶሜሽን',
        settings: 'ቅንብሮች',
        logout: 'ውጣ',
        
        // Common
        login: 'ግባ',
        register: 'ተመዝገብ',
        email: 'ኢሜይል',
        password: 'የይለፍ ቃል',
        confirmPassword: 'የይለፍ ቃል አረጋግጥ',
        fullName: 'ሙሉ ስም',
        save: 'አስቀምጥ',
        cancel: 'ሰርዝ',
        delete: 'አጥፋ',
        edit: 'አርትዕ',
        add: 'ጨምር',
        search: 'ፈልግ',
        filter: 'አጣራ',
        loading: 'በመጫን ላይ...',
        noData: 'ምንም ውሂብ የለም',
        
        // Dashboard
        welcome: 'እንኳን ደህና መጡ',
        totalDevices: 'ጠቅላላ መሳሪያዎች',
        activeNow: 'አሁን የሚሰሩ',
        autoMode: 'አውቶማቲክ',
        temperature: 'ሙቀት',
        allOn: 'ሁሉንም አብራ',
        allOff: 'ሁሉንም አጥፋ',
        recentActivity: 'የቅርብ ጊዜ እንቅስቃሴ',
        
        // Voice
        voiceAssistant: 'የድምጽ ረዳት',
        wakeWord: 'ሰላም እስቲፍ ወይም Hey Estiph ይበሉ',
        startListening: 'ማዳመጥ ጀምር',
        listening: 'እያዳመጥኩ ነው...',
        processing: 'በማስኬድ ላይ...',
        
        // Emergency
        emergencyContact: 'የአደጋ ጊዜ መደወያ',
        emergencyDesc: 'ፈጣን እርዳታ ለማግኘት ይጫኑ',
        
        // Messages
        loginSuccess: 'ግባት ተሳክቷል! እንኳን ደህና መጡ',
        loginFailed: 'የኢሜይል ወይም የይለፍ ቃል ስህተት ነው',
        logoutSuccess: 'በስኬት ወጥተሃል',
        registerSuccess: 'መለያ ተፈጥሯል! እባክህ ግባ',
        emailExists: 'ኢሜይሉ ቀድሞ ተመዝግቧል',
        passwordMismatch: 'የይለፍ ቃሎቹ አይዛመዱም',
        autoModeBlock: 'መሳሪያው በአውቶማቲክ ሁነታ ላይ ነው',
        deviceNotFound: 'መሳሪያ አልተገኘም',
        unauthorized: 'ፈቃድ የለህም',
        
        // Device States
        on: 'በርቷል',
        off: 'ጠፍቷል',
        auto: 'አውቶ',
        manual: 'እጅ',
        
        // Connection
        connected: 'ተገናኝቷል',
        disconnected: 'አልተገናኘም',
        
        // Settings
        darkMode: 'ጨለማ ሁነታ',
        darkModeDesc: 'በብርሃን እና በጨለማ ሁነታ መካከል ይቀይሩ',
        notifications: 'ማሳወቂያዎች',
        notificationsDesc: 'የመሳሪያ ማሳወቂያዎችን ይቀበሉ',
        soundEffects: 'የድምጽ ውጤቶች',
        soundEffectsDesc: 'ለድርጊቶች ድምጽ ያጫውቱ',
        temperatureUnit: 'የሙቀት መለኪያ',
        temperatureUnitDesc: 'ሴልሺየስ ወይም ፋራናይት'
    }
};

// ============================================
// DEFAULT DEVICES
// ============================================

const DefaultDevices = [
    { id: 0, icon: "💡", nameEn: "Light", nameAm: "መብራት", roomEn: "Living Room", roomAm: "ሳሎን", gpio: 23, power: 10, state: false, autoMode: false },
    { id: 1, icon: "🌀", nameEn: "Fan", nameAm: "ማራገቢያ", roomEn: "Bedroom", roomAm: "መኝታ", gpio: 22, power: 40, state: false, autoMode: true },
    { id: 2, icon: "❄️", nameEn: "AC", nameAm: "አየር ማቀዝቀዣ", roomEn: "Master", roomAm: "ዋና", gpio: 21, power: 120, state: false, autoMode: true },
    { id: 3, icon: "📺", nameEn: "TV", nameAm: "ቴሌቪዥን", roomEn: "Entertainment", roomAm: "መዝናኛ", gpio: 19, power: 80, state: false, autoMode: false },
    { id: 4, icon: "🔥", nameEn: "Heater", nameAm: "ማሞቂያ", roomEn: "Bathroom", roomAm: "መታጠቢያ", gpio: 18, power: 1500, state: false, autoMode: true },
    { id: 5, icon: "💧", nameEn: "Pump", nameAm: "ፓምፕ", roomEn: "Garden", roomAm: "አትክልት", gpio: 5, power: 250, state: false, autoMode: false }
];

// ============================================
// USER MANAGEMENT
// ============================================

class UserManager {
    constructor() {
        this.users = this.loadUsers();
        this.currentUser = null;
    }
    
    loadUsers() {
        const saved = localStorage.getItem('estif_users');
        if (saved) {
            try {
                return JSON.parse(saved);
            } catch(e) {
                return this.getDefaultUsers();
            }
        }
        return this.getDefaultUsers();
    }
    
    getDefaultUsers() {
        return [
            {
                id: 1,
                email: 'admin@estifhome.com',
                password: this.hashPassword('admin123'),
                name: 'Admin User',
                nameAm: 'አስተዳዳሪ',
                role: 'admin',
                avatar: '👨',
                createdAt: new Date().toISOString(),
                lastLogin: null,
                settings: { language: 'en', theme: 'light', notifications: true, sound: true }
            }
        ];
    }
    
    hashPassword(password) {
        let hash = 0;
        for (let i = 0; i < password.length; i++) {
            hash = ((hash << 5) - hash) + password.charCodeAt(i);
            hash |= 0;
        }
        return hash.toString();
    }
    
    verifyPassword(password, hash) {
        return this.hashPassword(password) === hash;
    }
    
    saveUsers() {
        localStorage.setItem('estif_users', JSON.stringify(this.users));
    }
    
    login(email, password) {
        const user = this.users.find(u => u.email === email);
        if (!user) return { success: false, error: 'user_not_found' };
        if (!this.verifyPassword(password, user.password)) return { success: false, error: 'invalid_password' };
        
        user.lastLogin = new Date().toISOString();
        this.saveUsers();
        
        const { password: _, ...safeUser } = user;
        return { success: true, user: safeUser };
    }
    
    register(email, password, name) {
        if (this.users.find(u => u.email === email)) {
            return { success: false, error: 'email_exists' };
        }
        
        const newUser = {
            id: this.users.length + 1,
            email,
            password: this.hashPassword(password),
            name,
            nameAm: name,
            role: 'user',
            avatar: '👤',
            createdAt: new Date().toISOString(),
            lastLogin: null,
            settings: { language: 'en', theme: 'light', notifications: true, sound: true }
        };
        
        this.users.push(newUser);
        this.saveUsers();
        
        const { password: _, ...safeUser } = newUser;
        return { success: true, user: safeUser };
    }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function t(key) {
    return Translations[AppState.currentLanguage][key] || key;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
    
    toast.innerHTML = `
        <span class="toast-icon">${icons[type] || 'ℹ️'}</span>
        <div class="toast-content">${escapeHtml(message)}</div>
        <button class="toast-close" onclick="this.parentElement.remove()">×</button>
    `;
    
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

function addActivityLog(message, source = 'system') {
    const logContainer = document.getElementById('activityLog');
    if (!logContainer) return;
    
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const logEntry = document.createElement('div');
    logEntry.className = 'log-entry';
    logEntry.innerHTML = `
        <span class="log-time">${time}</span>
        <span class="log-message">${escapeHtml(message)}</span>
        <span class="log-source">${escapeHtml(source)}</span>
    `;
    
    logContainer.insertBefore(logEntry, logContainer.firstChild);
    
    while (logContainer.children.length > 20) {
        logContainer.removeChild(logContainer.lastChild);
    }
    
    // Also add to AppState
    AppState.activityLog.unshift({ time, message, source });
}

function updateUI() {
    updateUILanguage();
    applyTheme();
    updateStatistics();
    renderDeviceGrid();
    updateConnectionStatus();
}

function updateUILanguage() {
    const t = Translations[AppState.currentLanguage];
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (t[key]) el.textContent = t[key];
    });
    
    const pageTitle = document.getElementById('pageTitle');
    if (pageTitle && t[AppState.currentPage]) {
        pageTitle.textContent = t[AppState.currentPage];
    }
    
    const voiceDisplay = document.getElementById('voiceCommandText');
    if (voiceDisplay && !AppState.isListening) {
        voiceDisplay.textContent = t.wakeWord;
    }
}

function applyTheme() {
    const html = document.documentElement;
    if (AppState.currentTheme === 'dark') {
        html.setAttribute('data-theme', 'dark');
    } else {
        html.removeAttribute('data-theme');
    }
}

function toggleTheme() {
    AppState.currentTheme = AppState.currentTheme === 'light' ? 'dark' : 'light';
    localStorage.setItem('theme', AppState.currentTheme);
    applyTheme();
    showToast(`${AppState.currentTheme === 'light' ? 'Light' : 'Dark'} mode enabled`, 'info');
}

function setLanguage(lang) {
    AppState.currentLanguage = lang;
    localStorage.setItem('language', lang);
    updateUILanguage();
    renderDeviceGrid();
    
    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.classList.remove('active');
        if ((lang === 'en' && btn.textContent === 'EN') ||
            (lang === 'am' && btn.textContent === 'አማ')) {
            btn.classList.add('active');
        }
    });
    
    showToast(`Language: ${lang === 'en' ? 'English' : 'Amharic'}`, 'success');
}

// ============================================
// DEVICE MANAGEMENT
// ============================================

function loadDevices() {
    const saved = localStorage.getItem('estif_devices');
    if (saved) {
        try {
            AppState.devices = JSON.parse(saved);
        } catch(e) {
            AppState.devices = JSON.parse(JSON.stringify(DefaultDevices));
        }
    } else {
        AppState.devices = JSON.parse(JSON.stringify(DefaultDevices));
    }
    updateStatistics();
    renderDeviceGrid();
}

function saveDevices() {
    localStorage.setItem('estif_devices', JSON.stringify(AppState.devices));
}

function toggleDevice(deviceId) {
    const device = AppState.devices.find(d => d.id === deviceId);
    if (!device) {
        showToast(t('deviceNotFound'), 'error');
        return;
    }
    
    if (device.autoMode) {
        showToast(t('autoModeBlock'), 'warning');
        return;
    }
    
    device.state = !device.state;
    saveDevices();
    updateStatistics();
    renderDeviceGrid();
    
    const deviceName = AppState.currentLanguage === 'en' ? device.nameEn : device.nameAm;
    addActivityLog(`${deviceName} turned ${device.state ? 'ON' : 'OFF'}`, 'device');
    showToast(`${deviceName} ${device.state ? t('on') : t('off')}`, device.state ? 'success' : 'info');
    
    // Send to server via WebSocket if connected
    if (AppState.socket && AppState.wsConnected) {
        AppState.socket.emit('device_control', { deviceId, state: device.state });
    }
}

function toggleAutoMode(deviceId) {
    const device = AppState.devices.find(d => d.id === deviceId);
    if (!device) return;
    
    device.autoMode = !device.autoMode;
    saveDevices();
    renderDeviceGrid();
    
    const deviceName = AppState.currentLanguage === 'en' ? device.nameEn : device.nameAm;
    addActivityLog(`${deviceName} auto mode ${device.autoMode ? 'enabled' : 'disabled'}`, 'system');
    showToast(`${deviceName} ${device.autoMode ? t('auto') : t('manual')} mode`, 'info');
    
    // Send to server via WebSocket if connected
    if (AppState.socket && AppState.wsConnected) {
        AppState.socket.emit('auto_mode', { deviceId, enabled: device.autoMode });
    }
}

function masterAllOn() {
    AppState.devices.forEach(device => {
        if (!device.autoMode) {
            device.state = true;
        }
    });
    saveDevices();
    updateStatistics();
    renderDeviceGrid();
    addActivityLog('All devices turned ON', 'system');
    showToast(t('allOn'), 'success');
    
    if (AppState.socket && AppState.wsConnected) {
        AppState.socket.emit('master_control', { state: true });
    }
}

function masterAllOff() {
    AppState.devices.forEach(device => {
        if (!device.autoMode) {
            device.state = false;
        }
    });
    saveDevices();
    updateStatistics();
    renderDeviceGrid();
    addActivityLog('All devices turned OFF', 'system');
    showToast(t('allOff'), 'info');
    
    if (AppState.socket && AppState.wsConnected) {
        AppState.socket.emit('master_control', { state: false });
    }
}

function renderDeviceGrid() {
    const grid = document.getElementById('deviceGrid');
    if (!grid) return;
    
    const t = Translations[AppState.currentLanguage];
    let html = '';
    
    AppState.devices.forEach(device => {
        const name = AppState.currentLanguage === 'en' ? device.nameEn : device.nameAm;
        const room = AppState.currentLanguage === 'en' ? device.roomEn : device.roomAm;
        const state = device.state ? t.on : t.off;
        const mode = device.autoMode ? t.auto : t.manual;
        
        html += `
            <div class="device-card ${device.state ? 'active' : ''}" onclick="toggleDevice(${device.id})">
                <div class="auto-badge ${device.autoMode ? 'auto-on' : 'auto-off'}" 
                     onclick="event.stopPropagation(); toggleAutoMode(${device.id})">
                    ${mode}
                </div>
                <div class="device-icon">${device.icon}</div>
                <div class="device-name">${escapeHtml(name)}</div>
                <div class="device-room">${escapeHtml(room)}</div>
                <div class="device-state">${state}</div>
                <div class="device-power">${device.power}W</div>
                <button class="auto-toggle" onclick="event.stopPropagation(); toggleAutoMode(${device.id})" 
                        title="${t.autoMode}">
                    <i class="fas ${device.autoMode ? 'fa-robot' : 'fa-hand-paper'}"></i>
                </button>
            </div>
        `;
    });
    
    grid.innerHTML = html;
    updateDeviceCount();
}

function updateStatistics() {
    const activeCount = AppState.devices.filter(d => d.state).length;
    const autoCount = AppState.devices.filter(d => d.autoMode).length;
    const totalPower = AppState.devices.reduce((sum, d) => sum + (d.state ? d.power : 0), 0);
    
    const statTotal = document.getElementById('statTotalDevices');
    const statActive = document.getElementById('statActiveDevices');
    const statAuto = document.getElementById('statAutoMode');
    const statTemp = document.getElementById('statTemperature');
    
    if (statTotal) statTotal.textContent = AppState.devices.length;
    if (statActive) statActive.textContent = activeCount;
    if (statAuto) statAuto.textContent = autoCount;
    if (statTemp) statTemp.textContent = `${AppState.systemStats.temperature}°C`;
    
    AppState.systemStats.activeDevices = activeCount;
    AppState.systemStats.energyUsage = totalPower;
}

function updateDeviceCount() {
    const activeCount = AppState.devices.filter(d => d.state).length;
    const badge = document.getElementById('deviceCount');
    if (badge) badge.textContent = activeCount;
}

// ============================================
// VOICE RECOGNITION
// ============================================

function initVoice() {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        console.log('Voice recognition not supported');
        showToast('Voice not supported. Use Chrome browser.', 'warning');
        AppState.voiceSupported = false;
        return false;
    }
    
    const SpeechRecognition = window.webkitSpeechRecognition || window.SpeechRecognition;
    AppState.recognition = new SpeechRecognition();
    AppState.recognition.continuous = true;
    AppState.recognition.interimResults = true;
    AppState.recognition.lang = AppState.currentLanguage === 'en' ? 'en-US' : 'am-ET';
    
    AppState.recognition.onstart = () => {
        AppState.isListening = true;
        updateVoiceUI(true);
        const voiceDisplay = document.getElementById('voiceCommandText');
        if (voiceDisplay) voiceDisplay.textContent = t('listening');
        console.log('Voice recognition started');
    };
    
    AppState.recognition.onend = () => {
        if (AppState.isListening) {
            AppState.recognition.start();
        } else {
            updateVoiceUI(false);
        }
    };
    
    AppState.recognition.onerror = (event) => {
        console.error('Voice error:', event.error);
        if (event.error === 'not-allowed') {
            showToast('Microphone access denied. Please allow microphone access.', 'error');
        }
        updateVoiceUI(false);
        AppState.isListening = false;
    };
    
    AppState.recognition.onresult = (event) => {
        const transcript = Array.from(event.results)
            .map(result => result[0].transcript.toLowerCase().trim())
            .join(' ');
        
        if (transcript) {
            console.log('Heard:', transcript);
            processVoiceCommand(transcript);
        }
    };
    
    AppState.voiceSupported = true;
    return true;
}

function processVoiceCommand(transcript) {
    const t = Translations[AppState.currentLanguage];
    const voiceDisplay = document.getElementById('voiceCommandText');
    
    // Wake word detection
    const wakeWords = ['hey estiph', 'hey estif', 'estiph', 'ok estiph', 'hello estiph'];
    const wakeWordsAm = ['ሰላም እስቲፍ', 'እስቲፍ', 'ሰላም'];
    
    const allWakeWords = AppState.currentLanguage === 'en' ? wakeWords : wakeWordsAm;
    
    if (!AppState.wakeWordDetected) {
        for (const wake of allWakeWords) {
            if (transcript.includes(wake)) {
                AppState.wakeWordDetected = true;
                if (voiceDisplay) voiceDisplay.textContent = t('listening');
                setTimeout(() => {
                    AppState.wakeWordDetected = false;
                }, 8000);
                return;
            }
        }
        return;
    }
    
    // Process commands
    if (transcript.includes('light on')) toggleDevice(0);
    else if (transcript.includes('light off')) toggleDevice(0);
    else if (transcript.includes('fan on')) toggleDevice(1);
    else if (transcript.includes('fan off')) toggleDevice(1);
    else if (transcript.includes('ac on')) toggleDevice(2);
    else if (transcript.includes('ac off')) toggleDevice(2);
    else if (transcript.includes('tv on')) toggleDevice(3);
    else if (transcript.includes('tv off')) toggleDevice(3);
    else if (transcript.includes('heater on')) toggleDevice(4);
    else if (transcript.includes('heater off')) toggleDevice(4);
    else if (transcript.includes('pump on')) toggleDevice(5);
    else if (transcript.includes('pump off')) toggleDevice(5);
    else if (transcript.includes('all on')) masterAllOn();
    else if (transcript.includes('all off')) masterAllOff();
    else {
        if (voiceDisplay) voiceDisplay.textContent = t('wakeWord');
    }
    
    AppState.wakeWordDetected = false;
}

function toggleVoice() {
    if (!AppState.voiceSupported) {
        initVoice();
    }
    
    if (AppState.isListening) {
        if (AppState.recognition) {
            AppState.recognition.stop();
        }
        AppState.isListening = false;
        updateVoiceUI(false);
        showToast('Voice stopped', 'info');
    } else {
        if (AppState.recognition) {
            try {
                AppState.recognition.start();
            } catch(e) {
                initVoice();
                AppState.recognition.start();
            }
        } else {
            initVoice();
            AppState.recognition.start();
        }
    }
}

function toggleVoiceRecognition() {
    toggleVoice();
}

function updateVoiceUI(isListening) {
    const voiceBtn = document.getElementById('voiceBtn');
    const voiceDisplay = document.getElementById('voiceCommandText');
    
    if (voiceBtn) {
        if (isListening) {
            voiceBtn.classList.add('listening');
            voiceBtn.style.background = 'var(--danger)';
            voiceBtn.style.color = 'white';
        } else {
            voiceBtn.classList.remove('listening');
            voiceBtn.style.background = '';
            voiceBtn.style.color = '';
        }
    }
    
    if (voiceDisplay && !isListening) {
        voiceDisplay.textContent = t('wakeWord');
    }
}

// ============================================
// WEBSOCKET CONNECTION
// ============================================

function setupWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;
    
    try {
        AppState.socket = io(wsUrl, { reconnection: true, reconnectionAttempts: 5 });
        
        AppState.socket.on('connect', () => {
            AppState.wsConnected = true;
            updateConnectionStatus(true);
            console.log('WebSocket connected');
        });
        
        AppState.socket.on('disconnect', () => {
            AppState.wsConnected = false;
            updateConnectionStatus(false);
            console.log('WebSocket disconnected');
        });
        
        AppState.socket.on('initial_data', (data) => {
            if (data.devices) {
                AppState.devices = data.devices;
                saveDevices();
                renderDeviceGrid();
            }
            if (data.stats) {
                AppState.systemStats = data.stats;
                updateStatistics();
            }
        });
        
        AppState.socket.on('device_update', (device) => {
            const localDevice = AppState.devices.find(d => d.id === device.id);
            if (localDevice) {
                localDevice.state = device.state;
                localDevice.autoMode = device.autoMode;
                saveDevices();
                renderDeviceGrid();
                updateStatistics();
            }
        });
        
        AppState.socket.on('sensor_update', (data) => {
            if (data.temperature) AppState.systemStats.temperature = data.temperature;
            if (data.humidity) AppState.systemStats.humidity = data.humidity;
            updateStatistics();
        });
        
        AppState.socket.on('esp_status', (data) => {
            AppState.espConnected = data.connected;
            updateConnectionStatus(AppState.wsConnected);
        });
        
    } catch(e) {
        console.log('WebSocket not available, using local mode');
        AppState.wsConnected = false;
    }
}

function updateConnectionStatus(connected) {
    const statusDot = document.getElementById('statusDot');
    const connectionText = document.getElementById('connectionText');
    
    if (statusDot) {
        if (connected) {
            statusDot.style.background = 'var(--success)';
        } else {
            statusDot.style.background = 'var(--danger)';
        }
    }
    
    if (connectionText) {
        connectionText.textContent = connected ? t('connected') : t('disconnected');
    }
}

// ============================================
// NAVIGATION
// ============================================

function navigateTo(page) {
    if (!AppState.isLoggedIn && page !== 'login') {
        showLoginPage();
        return;
    }
    
    AppState.currentPage = page;
    
    document.querySelectorAll('.page-container').forEach(container => {
        container.classList.remove('active');
    });
    
    const targetPage = document.getElementById(`${page}-page`);
    if (targetPage) targetPage.classList.add('active');
    
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
        if (item.getAttribute('onclick') === `navigateTo('${page}')`) {
            item.classList.add('active');
        }
    });
    
    const pageTitle = document.getElementById('pageTitle');
    if (pageTitle) pageTitle.textContent = t(page);
    
    if (window.innerWidth <= 768) {
        const sidebar = document.getElementById('sidebar');
        if (sidebar) sidebar.classList.remove('open');
    }
}

function showLoginPage() {
    document.querySelectorAll('.page-container').forEach(p => p.classList.remove('active'));
    const loginPage = document.getElementById('login-page');
    if (loginPage) loginPage.classList.add('active');
    
    const sidebar = document.querySelector('.sidebar');
    const topBar = document.querySelector('.top-bar');
    if (sidebar) sidebar.style.display = 'none';
    if (topBar) topBar.style.display = 'none';
}

function showDashboardPage() {
    document.querySelectorAll('.page-container').forEach(p => p.classList.remove('active'));
    const dashboardPage = document.getElementById('dashboard-page');
    if (dashboardPage) dashboardPage.classList.add('active');
    
    const sidebar = document.querySelector('.sidebar');
    const topBar = document.querySelector('.top-bar');
    if (sidebar) sidebar.style.display = 'flex';
    if (topBar) topBar.style.display = 'flex';
    
    renderDeviceGrid();
    updateStatistics();
    updateUILanguage();
    
    AppState.currentPage = 'dashboard';
    const pageTitle = document.getElementById('pageTitle');
    if (pageTitle) pageTitle.textContent = t('dashboard');
}

// ============================================
// AUTHENTICATION
// ============================================

const userManager = new UserManager();

function handleLogin(event) {
    event.preventDefault();
    
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    
    const result = userManager.login(email, password);
    
    if (result.success) {
        AppState.currentUser = result.user;
        AppState.isLoggedIn = true;
        AppState.currentLanguage = result.user.settings?.language || 'en';
        AppState.currentTheme = result.user.settings?.theme || 'light';
        
        localStorage.setItem('currentUser', JSON.stringify(result.user));
        setLanguage(AppState.currentLanguage);
        applyTheme();
        
        showToast(`${t('loginSuccess')} ${result.user.name}!`, 'success');
        showDashboardPage();
        updateUserProfile();
        loadDevices();
    } else {
        let errorMsg = t('loginFailed');
        if (result.error === 'user_not_found') errorMsg = 'Email not found';
        if (result.error === 'invalid_password') errorMsg = 'Incorrect password';
        showToast(errorMsg, 'error');
    }
}

function handleRegister(event) {
    event.preventDefault();
    
    const name = document.getElementById('regName').value;
    const email = document.getElementById('regEmail').value;
    const password = document.getElementById('regPassword').value;
    const confirm = document.getElementById('regConfirmPassword').value;
    
    if (password !== confirm) {
        showToast(t('passwordMismatch'), 'error');
        return;
    }
    
    const result = userManager.register(email, password, name);
    
    if (result.success) {
        showToast(t('registerSuccess'), 'success');
        showLoginOnly();
        document.getElementById('registerForm').reset();
    } else {
        showToast(t('emailExists'), 'error');
    }
}

function logout() {
    AppState.currentUser = null;
    AppState.isLoggedIn = false;
    localStorage.removeItem('currentUser');
    showLoginPage();
    showToast(t('logoutSuccess'), 'info');
}

function updateUserProfile() {
    if (!AppState.currentUser) return;
    
    const userNameEl = document.querySelector('.user-info .name');
    const userRoleEl = document.querySelector('.user-info .role');
    const userAvatarEl = document.querySelector('.user-avatar');
    
    if (userNameEl) {
        userNameEl.textContent = AppState.currentUser.name;
    }
    if (userRoleEl) {
        userRoleEl.textContent = AppState.currentUser.role === 'admin' ? 'Administrator' : 'User';
    }
    if (userAvatarEl) {
        userAvatarEl.textContent = AppState.currentUser.avatar || AppState.currentUser.name.charAt(0).toUpperCase();
    }
}

function showRegisterOnly() {
    document.getElementById('loginForm').style.display = 'none';
    document.getElementById('registerForm').style.display = 'block';
    const switchForm = document.querySelector('.switch-form');
    if (switchForm) {
        switchForm.innerHTML = `<p>Already have an account? <a href="#" onclick="showLoginOnly()">Login</a></p>`;
    }
}

function showLoginOnly() {
    document.getElementById('registerForm').style.display = 'none';
    document.getElementById('loginForm').style.display = 'block';
    const switchForm = document.querySelector('.switch-form');
    if (switchForm) {
        switchForm.innerHTML = `<p>Don't have an account? <a href="#" onclick="showRegisterOnly()">Register</a></p>`;
    }
}

// ============================================
// EMERGENCY CALL
// ============================================

function makeEmergencyCall() {
    const emergencyNumber = '+251987713787';
    if (confirm(`Call emergency contact: ${emergencyNumber}?`)) {
        window.location.href = `tel:${emergencyNumber}`;
        addActivityLog('Emergency contact called', 'emergency');
        showToast('Calling emergency contact...', 'warning');
    }
}

// ============================================
// SIDEBAR TOGGLE
// ============================================

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    if (sidebar) {
        sidebar.classList.toggle('open');
        AppState.sidebarOpen = sidebar.classList.contains('open');
    }
}

function showUserMenu() {
    // Simple user info display
    if (AppState.currentUser) {
        showToast(`${AppState.currentUser.name} - ${AppState.currentUser.role}`, 'info');
    }
}

// ============================================
// INITIALIZATION
// ============================================

function checkAuth() {
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
        try {
            AppState.currentUser = JSON.parse(savedUser);
            AppState.isLoggedIn = true;
            AppState.currentLanguage = AppState.currentUser.settings?.language || 'en';
            AppState.currentTheme = AppState.currentUser.settings?.theme || 'light';
            setLanguage(AppState.currentLanguage);
            applyTheme();
            updateUserProfile();
            loadDevices();
            showDashboardPage();
            return true;
        } catch(e) {
            console.log('Invalid saved session');
        }
    }
    showLoginPage();
    return false;
}

function setupMobileMenu() {
    const menuToggle = document.getElementById('menuToggleBtn');
    if (menuToggle) {
        menuToggle.addEventListener('click', toggleSidebar);
    }
    
    document.addEventListener('click', (e) => {
        if (window.innerWidth <= 768 && AppState.sidebarOpen) {
            const sidebar = document.getElementById('sidebar');
            if (sidebar && !sidebar.contains(e.target) && e.target !== menuToggle) {
                sidebar.classList.remove('open');
                AppState.sidebarOpen = false;
            }
        }
    });
}

function startAutoRefresh() {
    setInterval(() => {
        if (AppState.autoRefresh && AppState.isLoggedIn) {
            updateStatistics();
        }
    }, 5000);
}

function initCharts() {
    const canvas = document.getElementById('energyChart');
    if (canvas && typeof Chart !== 'undefined') {
        new Chart(canvas, {
            type: 'line',
            data: {
                labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
                datasets: [{
                    label: 'Energy (kWh)',
                    data: [12, 19, 15, 17, 14, 18, 16],
                    borderColor: '#4361ee',
                    backgroundColor: 'rgba(67, 97, 238, 0.1)',
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'bottom' }
                }
            }
        });
    }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    console.log('Estif Home Ultimate Initializing...');
    
    setupMobileMenu();
    checkAuth();
    setupWebSocket();
    initVoice();
    startAutoRefresh();
    initCharts();
    
    // Expose global functions
    window.navigateTo = navigateTo;
    window.setLanguage = setLanguage;
    window.toggleTheme = toggleTheme;
    window.toggleDevice = toggleDevice;
    window.toggleAutoMode = toggleAutoMode;
    window.masterAllOn = masterAllOn;
    window.masterAllOff = masterAllOff;
    window.toggleVoice = toggleVoice;
    window.toggleVoiceRecognition = toggleVoiceRecognition;
    window.showUserMenu = showUserMenu;
    window.logout = logout;
    window.handleLogin = handleLogin;
    window.handleRegister = handleRegister;
    window.showLoginOnly = showLoginOnly;
    window.showRegisterOnly = showRegisterOnly;
    window.makeEmergencyCall = makeEmergencyCall;
    
    console.log('Application Ready');
});