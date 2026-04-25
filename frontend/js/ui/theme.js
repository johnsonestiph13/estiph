/**
 * ESTIF HOME ULTIMATE - THEME MODULE
 * Dynamic theme management with multiple themes and system preference detection
 * Version: 2.0.0
 * Author: Estifanos Yohannis
 */

// ============================================
// THEME CONFIGURATION
// ============================================

const ThemeConfig = {
    // Available themes
    themes: {
        light: {
            name: 'Light',
            nameAm: 'ብርሃን',
            icon: 'fa-sun',
            background: '#ffffff',
            primary: '#4361ee'
        },
        dark: {
            name: 'Dark',
            nameAm: 'ጨለማ',
            icon: 'fa-moon',
            background: '#0f172a',
            primary: '#4895ef'
        },
        amoled: {
            name: 'AMOLED',
            nameAm: 'ኤሞሌድ',
            icon: 'fa-mobile-alt',
            background: '#000000',
            primary: '#00e5ff'
        },
        highContrast: {
            name: 'High Contrast',
            nameAm: 'ከፍተኛ ንፅፅር',
            icon: 'fa-adjust',
            background: '#000000',
            primary: '#ffff00'
        },
        sepia: {
            name: 'Sepia',
            nameAm: 'ሴፒያ',
            icon: 'fa-book',
            background: '#f4ecd8',
            primary: '#8b6914'
        },
        colorblind: {
            name: 'Colorblind',
            nameAm: 'የቀለም ዕውር',
            icon: 'fa-eye',
            background: '#faf9f6',
            primary: '#2c7da0'
        }
    },
    
    // Default theme
    defaultTheme: 'light',
    
    // Storage
    storageKey: 'estif_theme',
    
    // Auto-detect system preference
    autoDetect: true,
    
    // Transition duration
    transitionDuration: 300,
    
    // Debug
    debug: false
};

// ============================================
// THEME MANAGER
// ============================================

class ThemeManager {
    constructor() {
        this.currentTheme = null;
        this.listeners = [];
        this.transitioning = false;
        
        this.init();
    }

    init() {
        this.loadTheme();
        this.setupSystemPreferenceListener();
        ThemeConfig.debug && console.log('[Theme] Manager initialized with theme:', this.currentTheme);
    }

    loadTheme() {
        // Try to load from storage
        const saved = localStorage.getItem(ThemeConfig.storageKey);
        if (saved && ThemeConfig.themes[saved]) {
            this.currentTheme = saved;
        } else if (ThemeConfig.autoDetect) {
            // Auto-detect system preference
            this.currentTheme = this.detectSystemPreference();
        } else {
            this.currentTheme = ThemeConfig.defaultTheme;
        }
        
        this.applyTheme();
    }

    detectSystemPreference() {
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            return 'dark';
        }
        return ThemeConfig.defaultTheme;
    }

    setupSystemPreferenceListener() {
        if (!ThemeConfig.autoDetect) return;
        
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
            if (!localStorage.getItem(ThemeConfig.storageKey)) {
                this.setTheme(e.matches ? 'dark' : 'light');
            }
        });
    }

    async setTheme(themeName) {
        if (!ThemeConfig.themes[themeName]) {
            console.error('[Theme] Unknown theme:', themeName);
            return false;
        }
        
        if (this.transitioning) return false;
        
        this.transitioning = true;
        
        // Start transition
        document.documentElement.classList.add('theme-transition');
        
        // Apply theme
        this.currentTheme = themeName;
        this.applyTheme();
        
        // Save preference
        localStorage.setItem(ThemeConfig.storageKey, themeName);
        
        // Dispatch event
        const event = new CustomEvent('themeChanged', { detail: { theme: themeName } });
        window.dispatchEvent(event);
        
        this.notifyListeners('themeChanged', themeName);
        
        // End transition
        setTimeout(() => {
            document.documentElement.classList.remove('theme-transition');
            this.transitioning = false;
        }, ThemeConfig.transitionDuration);
        
        ThemeConfig.debug && console.log('[Theme] Theme changed to:', themeName);
        
        return true;
    }

    applyTheme() {
        // Set data-theme attribute
        document.documentElement.setAttribute('data-theme', this.currentTheme);
        
        // Update meta theme-color
        const themeColor = document.querySelector('meta[name="theme-color"]');
        if (themeColor) {
            themeColor.setAttribute('content', ThemeConfig.themes[this.currentTheme].primary);
        }
        
        // Update theme icon in UI
        this.updateThemeIcon();
    }

    updateThemeIcon() {
        const themeIcon = document.getElementById('themeIcon');
        if (themeIcon) {
            const iconClass = ThemeConfig.themes[this.currentTheme].icon;
            themeIcon.className = `fas ${iconClass}`;
        }
    }

    getCurrentTheme() {
        return {
            name: this.currentTheme,
            ...ThemeConfig.themes[this.currentTheme]
        };
    }

    getAvailableThemes() {
        return Object.entries(ThemeConfig.themes).map(([key, value]) => ({
            id: key,
            ...value
        }));
    }

    toggleTheme() {
        const themes = Object.keys(ThemeConfig.themes);
        const currentIndex = themes.indexOf(this.currentTheme);
        const nextTheme = themes[(currentIndex + 1) % themes.length];
        return this.setTheme(nextTheme);
    }

    // ============================================
    // CSS VARIABLE MANAGEMENT
    // ============================================

    setCSSVariable(name, value) {
        document.documentElement.style.setProperty(name, value);
    }

    getCSSVariable(name) {
        return getComputedStyle(document.documentElement).getPropertyValue(name);
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
// THEME UI COMPONENT
// ============================================

class ThemeUI {
    constructor(themeManager) {
        this.themeManager = themeManager;
        this.init();
    }

    init() {
        this.createThemeSelector();
        this.bindEvents();
        ThemeConfig.debug && console.log('[ThemeUI] Initialized');
    }

    createThemeSelector() {
        const container = document.getElementById('theme-selector-container');
        if (!container) return;

        const themes = this.themeManager.getAvailableThemes();
        
        container.innerHTML = `
            <div class="theme-selector">
                <div class="theme-selector-header">
                    <i class="fas fa-palette"></i>
                    <span>Select Theme</span>
                </div>
                <div class="theme-grid">
                    ${themes.map(theme => `
                        <div class="theme-option ${this.themeManager.currentTheme === theme.id ? 'active' : ''}" data-theme="${theme.id}">
                            <div class="theme-preview" style="background: ${theme.background}; border-color: ${theme.primary}"></div>
                            <div class="theme-name">${theme.name}</div>
                            <div class="theme-name-am">${theme.nameAm}</div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;

        this.bindThemeEvents();
    }

    bindThemeEvents() {
        document.querySelectorAll('.theme-option').forEach(option => {
            option.addEventListener('click', () => {
                const theme = option.dataset.theme;
                this.themeManager.setTheme(theme);
            });
        });
    }

    bindEvents() {
        this.themeManager.addEventListener('themeChanged', (theme) => {
            document.querySelectorAll('.theme-option').forEach(opt => {
                opt.classList.toggle('active', opt.dataset.theme === theme);
            });
        });
    }
}

// ============================================
// CSS STYLES
// ============================================

const themeStyles = `
    .theme-selector {
        background: var(--bg-card);
        border-radius: 12px;
        padding: 16px;
    }
    
    .theme-selector-header {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 16px;
        padding-bottom: 12px;
        border-bottom: 1px solid var(--border-color);
    }
    
    .theme-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
        gap: 12px;
    }
    
    .theme-option {
        text-align: center;
        cursor: pointer;
        padding: 8px;
        border-radius: 8px;
        transition: all 0.2s ease;
    }
    
    .theme-option:hover {
        background: var(--bg-hover);
        transform: translateY(-2px);
    }
    
    .theme-option.active {
        background: var(--primary-soft);
    }
    
    .theme-preview {
        width: 60px;
        height: 60px;
        border-radius: 8px;
        margin: 0 auto 8px;
        border: 2px solid;
        transition: all 0.2s ease;
    }
    
    .theme-name {
        font-size: 12px;
        font-weight: 500;
    }
    
    .theme-name-am {
        font-size: 10px;
        color: var(--text-muted);
    }
    
    /* Theme transition */
    .theme-transition,
    .theme-transition * {
        transition: background-color 0.3s ease, border-color 0.3s ease, color 0.3s ease !important;
    }
`;

// Inject styles
if (typeof document !== 'undefined') {
    const styleSheet = document.createElement('style');
    styleSheet.textContent = themeStyles;
    document.head.appendChild(styleSheet);
}

// ============================================
// CREATE SINGLETON INSTANCES
// ============================================

const themeManager = new ThemeManager();
const themeUI = new ThemeUI(themeManager);

// Exports
window.themeManager = themeManager;
window.themeUI = themeUI;

export { themeManager, themeUI, ThemeManager, ThemeConfig };