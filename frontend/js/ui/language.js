/**
 * ESTIF HOME ULTIMATE - LANGUAGE MODULE
 * Multi-language support with dynamic switching and RTL support
 * Version: 2.0.0
 * Author: Estifanos Yohannis
 */

// ============================================
// LANGUAGE CONFIGURATION
// ============================================

const LanguageConfig = {
    // Available languages
    languages: {
        en: {
            name: 'English',
            nativeName: 'English',
            flag: '🇺🇸',
            dir: 'ltr',
            rtl: false
        },
        am: {
            name: 'Amharic',
            nativeName: 'አማርኛ',
            flag: '🇪🇹',
            dir: 'ltr',
            rtl: false
        },
        ar: {
            name: 'Arabic',
            nativeName: 'العربية',
            flag: '🇸🇦',
            dir: 'rtl',
            rtl: true
        },
        fr: {
            name: 'French',
            nativeName: 'Français',
            flag: '🇫🇷',
            dir: 'ltr',
            rtl: false
        },
        es: {
            name: 'Spanish',
            nativeName: 'Español',
            flag: '🇪🇸',
            dir: 'ltr',
            rtl: false
        },
        de: {
            name: 'German',
            nativeName: 'Deutsch',
            flag: '🇩🇪',
            dir: 'ltr',
            rtl: false
        },
        zh: {
            name: 'Chinese',
            nativeName: '中文',
            flag: '🇨🇳',
            dir: 'ltr',
            rtl: false
        }
    },
    
    // Default language
    defaultLanguage: 'en',
    
    // Storage
    storageKey: 'estif_language',
    
    // Auto-detect browser language
    autoDetect: true,
    
    // Translations endpoint
    translationsEndpoint: '/locales/{{lng}}.json',
    
    // Debug
    debug: false
};

// ============================================
// LANGUAGE MANAGER
// ============================================

class LanguageManager {
    constructor() {
        this.currentLanguage = null;
        this.translations = {};
        this.listeners = [];
        this.loading = false;
        
        this.init();
    }

    async init() {
        this.currentLanguage = this.detectLanguage();
        await this.loadTranslations();
        this.applyLanguage();
        LanguageConfig.debug && console.log('[Language] Manager initialized with language:', this.currentLanguage);
    }

    detectLanguage() {
        // Check localStorage
        const saved = localStorage.getItem(LanguageConfig.storageKey);
        if (saved && LanguageConfig.languages[saved]) {
            return saved;
        }
        
        // Auto-detect browser language
        if (LanguageConfig.autoDetect) {
            const browserLang = navigator.language.split('-')[0];
            if (LanguageConfig.languages[browserLang]) {
                return browserLang;
            }
        }
        
        return LanguageConfig.defaultLanguage;
    }

    async loadTranslations() {
        this.loading = true;
        
        try {
            const url = LanguageConfig.translationsEndpoint.replace('{{lng}}', this.currentLanguage);
            const response = await fetch(url);
            if (response.ok) {
                this.translations = await response.json();
                LanguageConfig.debug && console.log('[Language] Translations loaded');
            } else {
                console.error('[Language] Failed to load translations');
                this.translations = {};
            }
        } catch (error) {
            console.error('[Language] Error loading translations:', error);
            this.translations = {};
        }
        
        this.loading = false;
    }

    async setLanguage(languageCode) {
        if (!LanguageConfig.languages[languageCode]) {
            console.error('[Language] Unknown language:', languageCode);
            return false;
        }
        
        if (languageCode === this.currentLanguage) return true;
        
        this.currentLanguage = languageCode;
        await this.loadTranslations();
        this.applyLanguage();
        
        // Save preference
        localStorage.setItem(LanguageConfig.storageKey, languageCode);
        
        // Dispatch event
        const event = new CustomEvent('languageChanged', { detail: { language: languageCode } });
        window.dispatchEvent(event);
        
        this.notifyListeners('languageChanged', languageCode);
        
        LanguageConfig.debug && console.log('[Language] Language changed to:', languageCode);
        
        return true;
    }

    applyLanguage() {
        // Set HTML lang attribute
        document.documentElement.setAttribute('lang', this.currentLanguage);
        
        // Set RTL/LTR direction
        const isRTL = LanguageConfig.languages[this.currentLanguage]?.rtl;
        document.documentElement.setAttribute('dir', isRTL ? 'rtl' : 'ltr');
        
        // Update body class for font
        if (this.currentLanguage === 'am') {
            document.body.classList.add('amharic');
        } else {
            document.body.classList.remove('amharic');
        }
        
        // Translate page elements
        this.translatePage();
    }

    translatePage() {
        // Translate elements with data-i18n attribute
        document.querySelectorAll('[data-i18n]').forEach(element => {
            const key = element.getAttribute('data-i18n');
            const translation = this.getTranslation(key);
            if (translation) {
                if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
                    if (element.getAttribute('data-i18n-attr') === 'placeholder') {
                        element.placeholder = translation;
                    } else {
                        element.value = translation;
                    }
                } else {
                    element.innerHTML = translation;
                }
            }
        });
        
        // Translate attributes
        document.querySelectorAll('[data-i18n-attr]').forEach(element => {
            const key = element.getAttribute('data-i18n');
            const attr = element.getAttribute('data-i18n-attr');
            const translation = this.getTranslation(key);
            if (translation) {
                element.setAttribute(attr, translation);
            }
        });
    }

    getTranslation(key) {
        const keys = key.split('.');
        let value = this.translations;
        
        for (const k of keys) {
            if (value && typeof value === 'object' && k in value) {
                value = value[k];
            } else {
                return key;
            }
        }
        
        return value || key;
    }

    t(key, params = {}) {
        let text = this.getTranslation(key);
        
        // Replace parameters
        for (const [param, value] of Object.entries(params)) {
            text = text.replace(new RegExp(`{{${param}}}`, 'g'), value);
        }
        
        return text;
    }

    getCurrentLanguage() {
        return {
            code: this.currentLanguage,
            ...LanguageConfig.languages[this.currentLanguage]
        };
    }

    getAvailableLanguages() {
        return Object.entries(LanguageConfig.languages).map(([code, data]) => ({
            code,
            ...data
        }));
    }

    isRTL() {
        return LanguageConfig.languages[this.currentLanguage]?.rtl || false;
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
// LANGUAGE UI COMPONENT
// ============================================

class LanguageUI {
    constructor(languageManager) {
        this.languageManager = languageManager;
        this.init();
    }

    init() {
        this.createLanguageSelector();
        this.bindEvents();
        LanguageConfig.debug && console.log('[LanguageUI] Initialized');
    }

    createLanguageSelector() {
        const container = document.getElementById('language-selector-container');
        if (!container) return;

        const languages = this.languageManager.getAvailableLanguages();
        
        container.innerHTML = `
            <div class="language-selector">
                <button class="language-toggle">
                    <span class="current-flag">${languages.find(l => l.code === this.languageManager.currentLanguage)?.flag}</span>
                    <span class="current-name">${languages.find(l => l.code === this.languageManager.currentLanguage)?.name}</span>
                    <i class="fas fa-chevron-down"></i>
                </button>
                <div class="language-dropdown">
                    ${languages.map(lang => `
                        <button class="language-option ${this.languageManager.currentLanguage === lang.code ? 'active' : ''}" data-lang="${lang.code}">
                            <span class="lang-flag">${lang.flag}</span>
                            <span class="lang-name">${lang.name}</span>
                            <span class="lang-native">${lang.nativeName}</span>
                        </button>
                    `).join('')}
                </div>
            </div>
        `;

        this.bindSelectorEvents();
    }

    bindSelectorEvents() {
        const toggle = document.querySelector('.language-toggle');
        const dropdown = document.querySelector('.language-dropdown');
        
        if (toggle) {
            toggle.addEventListener('click', () => {
                dropdown.classList.toggle('open');
            });
        }
        
        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.language-selector')) {
                dropdown?.classList.remove('open');
            }
        });
        
        document.querySelectorAll('.language-option').forEach(option => {
            option.addEventListener('click', () => {
                const lang = option.dataset.lang;
                this.languageManager.setLanguage(lang);
                dropdown.classList.remove('open');
            });
        });
    }

    bindEvents() {
        this.languageManager.addEventListener('languageChanged', () => {
            // Update active state in selector
            document.querySelectorAll('.language-option').forEach(opt => {
                opt.classList.toggle('active', opt.dataset.lang === this.languageManager.currentLanguage);
            });
            
            // Update toggle button
            const languages = this.languageManager.getAvailableLanguages();
            const current = languages.find(l => l.code === this.languageManager.currentLanguage);
            const toggle = document.querySelector('.language-toggle');
            if (toggle && current) {
                toggle.querySelector('.current-flag').textContent = current.flag;
                toggle.querySelector('.current-name').textContent = current.name;
            }
        });
    }
}

// ============================================
// CSS STYLES
// ============================================

const languageStyles = `
    .language-selector {
        position: relative;
    }
    
    .language-toggle {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 12px;
        background: var(--bg-tertiary);
        border: 1px solid var(--border-color);
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.2s ease;
    }
    
    .language-toggle:hover {
        background: var(--bg-hover);
        border-color: var(--primary);
    }
    
    .language-dropdown {
        position: absolute;
        top: 100%;
        right: 0;
        margin-top: 4px;
        min-width: 200px;
        background: var(--bg-card);
        border: 1px solid var(--border-color);
        border-radius: 8px;
        box-shadow: var(--shadow-lg);
        z-index: 1000;
        display: none;
        overflow: hidden;
    }
    
    .language-dropdown.open {
        display: block;
        animation: dropdownFadeIn 0.2s ease;
    }
    
    @keyframes dropdownFadeIn {
        from {
            opacity: 0;
            transform: translateY(-10px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }
    
    .language-option {
        display: flex;
        align-items: center;
        gap: 12px;
        width: 100%;
        padding: 10px 16px;
        background: none;
        border: none;
        cursor: pointer;
        transition: all 0.2s ease;
        text-align: left;
    }
    
    .language-option:hover {
        background: var(--bg-hover);
    }
    
    .language-option.active {
        background: var(--primary-soft);
        color: var(--primary);
    }
    
    .lang-flag {
        font-size: 20px;
    }
    
    .lang-name {
        font-weight: 500;
    }
    
    .lang-native {
        font-size: 12px;
        color: var(--text-muted);
        margin-left: auto;
    }
`;

// Inject styles
if (typeof document !== 'undefined') {
    const styleSheet = document.createElement('style');
    styleSheet.textContent = languageStyles;
    document.head.appendChild(styleSheet);
}

// ============================================
// CREATE SINGLETON INSTANCES
// ============================================

const languageManager = new LanguageManager();
const languageUI = new LanguageUI(languageManager);

// Exports
window.languageManager = languageManager;
window.languageUI = languageUI;

export { languageManager, languageUI, LanguageManager, LanguageConfig };