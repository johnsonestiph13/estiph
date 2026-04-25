/**
 * ESTIF HOME ULTIMATE - INTERNATIONALIZATION (i18n) MODULE
 * Multi-language support with dynamic loading and fallback
 * Version: 2.0.0
 * Author: Estifanos Yohannis
 */

// ============================================
// I18N CONFIGURATION
// ============================================

const I18nConfig = {
    defaultLanguage: 'en',
    fallbackLanguage: 'en',
    supportedLanguages: ['en', 'am', 'ar', 'de', 'es', 'fr', 'zh'],
    localStorageKey: 'estif_language',
    cookieName: 'estif_lang',
    debugMode: false,
    loadPath: '/locales/{{lng}}.json',
    cacheEnabled: true,
    cacheExpiry: 86400000, // 24 hours in milliseconds
    pluralRules: {
        en: (n) => n === 1 ? 'one' : 'other',
        am: (n) => n === 1 ? 'one' : 'other',
        ar: (n) => {
            if (n === 0) return 'zero';
            if (n === 1) return 'one';
            if (n === 2) return 'two';
            if (n % 100 >= 3 && n % 100 <= 10) return 'few';
            if (n % 100 >= 11 && n % 100 <= 99) return 'many';
            return 'other';
        },
        de: (n) => n === 1 ? 'one' : 'other',
        es: (n) => n === 1 ? 'one' : 'other',
        fr: (n) => n === 1 ? 'one' : 'other',
        zh: (n) => 'other'
    }
};

// ============================================
// I18N CACHE MANAGER
// ============================================

class I18nCache {
    constructor() {
        this.cache = new Map();
        this.loadFromStorage();
    }

    loadFromStorage() {
        try {
            const stored = localStorage.getItem('estif_i18n_cache');
            if (stored) {
                const data = JSON.parse(stored);
                const now = Date.now();
                for (const [lang, cacheData] of Object.entries(data)) {
                    if (now - cacheData.timestamp < I18nConfig.cacheExpiry) {
                        this.cache.set(lang, cacheData.translations);
                    }
                }
            }
        } catch (e) {
            console.warn('Failed to load i18n cache:', e);
        }
    }

    saveToStorage() {
        try {
            const data = {};
            for (const [lang, translations] of this.cache.entries()) {
                data[lang] = {
                    translations: translations,
                    timestamp: Date.now()
                };
            }
            localStorage.setItem('estif_i18n_cache', JSON.stringify(data));
        } catch (e) {
            console.warn('Failed to save i18n cache:', e);
        }
    }

    get(lang) {
        return this.cache.get(lang);
    }

    set(lang, translations) {
        this.cache.set(lang, translations);
        this.saveToStorage();
    }

    has(lang) {
        return this.cache.has(lang);
    }

    clear() {
        this.cache.clear();
        localStorage.removeItem('estif_i18n_cache');
    }

    getStats() {
        return {
            size: this.cache.size,
            languages: Array.from(this.cache.keys()),
            cachedAt: new Date().toISOString()
        };
    }
}

// ============================================
// LANGUAGE DETECTOR
// ============================================

class LanguageDetector {
    static detect() {
        // Priority order:
        // 1. User preference (localStorage)
        // 2. Browser language
        // 3. URL parameter
        // 4. navigator.language
        // 5. Default language

        // Check localStorage
        const saved = localStorage.getItem(I18nConfig.localStorageKey);
        if (saved && I18nConfig.supportedLanguages.includes(saved)) {
            return saved;
        }

        // Check cookie
        const cookie = this.getCookie(I18nConfig.cookieName);
        if (cookie && I18nConfig.supportedLanguages.includes(cookie)) {
            return cookie;
        }

        // Check URL parameter
        const urlParams = new URLSearchParams(window.location.search);
        const urlLang = urlParams.get('lang');
        if (urlLang && I18nConfig.supportedLanguages.includes(urlLang)) {
            return urlLang;
        }

        // Check browser language
        const browserLang = this.getBrowserLanguage();
        if (browserLang && I18nConfig.supportedLanguages.includes(browserLang)) {
            return browserLang;
        }

        // Return default
        return I18nConfig.defaultLanguage;
    }

    static getBrowserLanguage() {
        const browserLang = navigator.language || navigator.userLanguage;
        if (!browserLang) return null;
        
        // Get primary language code (en-US -> en)
        const primary = browserLang.split('-')[0].toLowerCase();
        
        // Check if primary is supported
        if (I18nConfig.supportedLanguages.includes(primary)) {
            return primary;
        }
        
        // Check for specific matches
        const langMap = {
            'zh-CN': 'zh',
            'zh-TW': 'zh',
            'pt': 'es',
            'it': 'es',
            'ru': 'en'
        };
        
        return langMap[browserLang] || I18nConfig.defaultLanguage;
    }

    static getCookie(name) {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) return parts.pop().split(';').shift();
        return null;
    }

    static setCookie(name, value, days = 365) {
        const date = new Date();
        date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
        document.cookie = `${name}=${value}; expires=${date.toUTCString()}; path=/`;
    }
}

// ============================================
// PLURALIZATION ENGINE
// ============================================

class Pluralizer {
    static getPluralRule(language) {
        return I18nConfig.pluralRules[language] || I18nConfig.pluralRules[I18nConfig.defaultLanguage];
    }

    static pluralize(language, count, forms) {
        const rule = this.getPluralRule(language);
        const key = rule(count);
        return forms[key] || forms.other || forms.one || '';
    }

    static getPluralForm(language, count, translationKey) {
        const forms = ['zero', 'one', 'two', 'few', 'many', 'other'];
        for (const form of forms) {
            const key = `${translationKey}_${form}`;
            if (window.i18n && window.i18n.exists(key)) {
                if (this.getPluralRule(language)(count) === form) {
                    return window.i18n.t(key, { count });
                }
            }
        }
        return window.i18n ? window.i18n.t(translationKey, { count }) : `${translationKey} (${count})`;
    }
}

// ============================================
// I18N MAIN CLASS
// ============================================

class I18n {
    constructor() {
        this.translations = new Map();
        this.currentLanguage = I18nConfig.defaultLanguage;
        this.fallbackLanguage = I18nConfig.fallbackLanguage;
        this.cache = new I18nCache();
        this.listeners = [];
        this.isLoading = false;
        this.loadPromises = new Map();
        this.observers = new Set();
    }

    // ============================================
    // INITIALIZATION
    // ============================================

    async init(options = {}) {
        this.currentLanguage = options.language || LanguageDetector.detect();
        I18nConfig.debugMode = options.debug || I18nConfig.debugMode;
        
        if (this.cache.has(this.currentLanguage)) {
            this.translations = this.cache.get(this.currentLanguage);
            this.log(`Loaded ${this.currentLanguage} from cache`);
            this.notifyListeners();
            return true;
        }

        return await this.loadLanguage(this.currentLanguage);
    }

    // ============================================
    // LANGUAGE MANAGEMENT
    // ============================================

    async loadLanguage(language) {
        if (this.loadPromises.has(language)) {
            return this.loadPromises.get(language);
        }

        this.isLoading = true;
        const promise = this._loadLanguage(language);
        this.loadPromises.set(language, promise);

        try {
            const translations = await promise;
            this.translations = translations;
            this.cache.set(language, translations);
            this.currentLanguage = language;
            this.saveLanguagePreference(language);
            this.log(`Loaded language: ${language}`);
            this.notifyListeners();
            return true;
        } catch (error) {
            this.log(`Failed to load language: ${language}`, error);
            if (language !== this.fallbackLanguage) {
                return await this.loadLanguage(this.fallbackLanguage);
            }
            return false;
        } finally {
            this.isLoading = false;
            this.loadPromises.delete(language);
        }
    }

    async _loadLanguage(language) {
        const url = I18nConfig.loadPath.replace('{{lng}}', language);
        
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            this.log(`Fetch error: ${error.message}`);
            throw error;
        }
    }

    async changeLanguage(language) {
        if (language === this.currentLanguage) {
            return true;
        }

        if (!I18nConfig.supportedLanguages.includes(language)) {
            this.log(`Language ${language} not supported, using fallback`);
            language = this.fallbackLanguage;
        }

        const success = await this.loadLanguage(language);
        if (success) {
            document.documentElement.setAttribute('lang', language);
            document.documentElement.setAttribute('data-language', language);
            
            // Dispatch language change event
            const event = new CustomEvent('languageChanged', {
                detail: { language: this.currentLanguage }
            });
            window.dispatchEvent(event);
        }
        return success;
    }

    getLanguage() {
        return this.currentLanguage;
    }

    getLanguages() {
        return I18nConfig.supportedLanguages;
    }

    saveLanguagePreference(language) {
        localStorage.setItem(I18nConfig.localStorageKey, language);
        LanguageDetector.setCookie(I18nConfig.cookieName, language);
    }

    // ============================================
    // TRANSLATION METHODS
    // ============================================

    t(key, options = {}) {
        if (!key) return '';
        
        // Get translation
        let value = this.getNestedValue(this.translations, key);
        
        // Fallback to default language if not found
        if (value === undefined && this.currentLanguage !== this.fallbackLanguage) {
            const fallbackTranslations = this.cache.get(this.fallbackLanguage);
            if (fallbackTranslations) {
                value = this.getNestedValue(fallbackTranslations, key);
            }
        }
        
        // Return key if translation not found
        if (value === undefined) {
            this.log(`Translation missing: ${key}`);
            return key;
        }
        
        // Handle pluralization
        if (options.count !== undefined && options.count !== null) {
            value = this.handlePluralization(value, options.count);
        }
        
        // Replace variables
        if (options && typeof options === 'object') {
            value = this.replaceVariables(value, options);
        }
        
        return value;
    }

    getNestedValue(obj, path) {
        if (!obj || !path) return undefined;
        
        const parts = path.split('.');
        let current = obj;
        
        for (const part of parts) {
            if (current[part] === undefined) {
                return undefined;
            }
            current = current[part];
        }
        
        return current;
    }

    handlePluralization(value, count) {
        if (typeof value === 'object') {
            const pluralKey = this.getPluralKey(count);
            return value[pluralKey] || value.other || value.one || String(value);
        }
        return value;
    }

    getPluralKey(count) {
        const rule = Pluralizer.getPluralRule(this.currentLanguage);
        return rule(count);
    }

    replaceVariables(text, variables) {
        if (typeof text !== 'string') return text;
        
        let result = text;
        for (const [key, value] of Object.entries(variables)) {
            if (key === 'count') continue;
            result = result.replace(new RegExp(`{{${key}}}`, 'g'), value);
        }
        result = result.replace(/{{count}}/g, variables.count !== undefined ? variables.count : '');
        
        return result;
    }

    exists(key) {
        return this.getNestedValue(this.translations, key) !== undefined;
    }

    // ============================================
    // PLURALIZATION HELPERS
    // ============================================

    plural(key, count, options = {}) {
        options.count = count;
        return this.t(key, options);
    }

    // ============================================
    // EVENT SYSTEM
    // ============================================

    onLanguageChange(callback) {
        this.listeners.push(callback);
        return () => {
            const index = this.listeners.indexOf(callback);
            if (index > -1) this.listeners.splice(index, 1);
        };
    }

    notifyListeners() {
        for (const listener of this.listeners) {
            listener(this.currentLanguage);
        }
        for (const observer of this.observers) {
            observer(this.currentLanguage);
        }
    }

    observe(callback) {
        this.observers.add(callback);
        return () => this.observers.delete(callback);
    }

    // ============================================
    // UTILITY METHODS
    // ============================================

    async reload() {
        this.cache.clear();
        return await this.loadLanguage(this.currentLanguage);
    }

    clearCache() {
        this.cache.clear();
        this.loadPromises.clear();
        this.log('Cache cleared');
    }

    getDebugInfo() {
        return {
            currentLanguage: this.currentLanguage,
            supportedLanguages: I18nConfig.supportedLanguages,
            cachedLanguages: Array.from(this.cache.cache.keys()),
            isLoading: this.isLoading,
            cacheStats: this.cache.getStats()
        };
    }

    log(message, error = null) {
        if (I18nConfig.debugMode) {
            if (error) {
                console.error(`[i18n] ${message}`, error);
            } else {
                console.log(`[i18n] ${message}`);
            }
        }
    }

    // ============================================
    // LANGUAGE DIRECTION
    // ============================================

    isRTL() {
        const rtlLanguages = ['ar'];
        return rtlLanguages.includes(this.currentLanguage);
    }

    getDirection() {
        return this.isRTL() ? 'rtl' : 'ltr';
    }

    applyDirection() {
        const dir = this.getDirection();
        document.documentElement.setAttribute('dir', dir);
        document.body.setAttribute('dir', dir);
    }

    // ============================================
    // FORMATTING HELPERS
    // ============================================

    formatDate(date, options = {}) {
        if (!date) return '';
        
        const dateObj = typeof date === 'string' ? new Date(date) : date;
        const locale = this.currentLanguage === 'zh' ? 'zh-CN' : this.currentLanguage;
        
        return dateObj.toLocaleDateString(locale, options);
    }

    formatTime(date, options = {}) {
        if (!date) return '';
        
        const dateObj = typeof date === 'string' ? new Date(date) : date;
        const locale = this.currentLanguage === 'zh' ? 'zh-CN' : this.currentLanguage;
        
        return dateObj.toLocaleTimeString(locale, options);
    }

    formatDateTime(date, options = {}) {
        if (!date) return '';
        
        const dateObj = typeof date === 'string' ? new Date(date) : date;
        const locale = this.currentLanguage === 'zh' ? 'zh-CN' : this.currentLanguage;
        
        return dateObj.toLocaleString(locale, options);
    }

    formatNumber(number, options = {}) {
        const locale = this.currentLanguage === 'zh' ? 'zh-CN' : this.currentLanguage;
        return number.toLocaleString(locale, options);
    }

    formatCurrency(amount, currency = 'USD', options = {}) {
        const locale = this.currentLanguage === 'zh' ? 'zh-CN' : this.currentLanguage;
        return amount.toLocaleString(locale, {
            style: 'currency',
            currency: currency,
            ...options
        });
    }
}

// ============================================
// REACT HOOKS (For React Integration)
// ============================================

if (typeof React !== 'undefined') {
    const useTranslation = () => {
        const [language, setLanguage] = React.useState(i18n.getLanguage());
        
        React.useEffect(() => {
            const unsubscribe = i18n.onLanguageChange(setLanguage);
            return unsubscribe;
        }, []);
        
        return {
            t: (key, options) => i18n.t(key, options),
            i18n,
            language,
            changeLanguage: (lang) => i18n.changeLanguage(lang),
            exists: (key) => i18n.exists(key),
            plural: (key, count, options) => i18n.plural(key, count, options),
            formatDate: (date, options) => i18n.formatDate(date, options),
            formatTime: (date, options) => i18n.formatTime(date, options),
            formatNumber: (number, options) => i18n.formatNumber(number, options),
            formatCurrency: (amount, currency, options) => i18n.formatCurrency(amount, currency, options)
        };
    };
}

// ============================================
// HTML TRANSLATION BINDING
// ============================================

class I18nHTML {
    static init() {
        // Translate elements with data-i18n attribute
        this.translatePage();
        
        // Watch for dynamically added elements
        const observer = new MutationObserver((mutations) => {
            let shouldTranslate = false;
            for (const mutation of mutations) {
                if (mutation.addedNodes.length > 0) {
                    shouldTranslate = true;
                    break;
                }
            }
            if (shouldTranslate) {
                this.translatePage();
            }
        });
        
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
        
        // Listen for language changes
        window.addEventListener('languageChanged', () => {
            this.translatePage();
        });
    }
    
    static translatePage() {
        const elements = document.querySelectorAll('[data-i18n]');
        for (const element of elements) {
            const key = element.getAttribute('data-i18n');
            const value = window.i18n ? window.i18n.t(key) : key;
            
            if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
                if (element.getAttribute('data-i18n-attr') === 'placeholder') {
                    element.placeholder = value;
                } else {
                    element.value = value;
                }
            } else {
                element.innerHTML = value;
            }
        }
        
        // Translate attributes
        const attrElements = document.querySelectorAll('[data-i18n-attr]');
        for (const element of attrElements) {
            const attrKey = element.getAttribute('data-i18n-attr');
            const key = element.getAttribute('data-i18n');
            const value = window.i18n ? window.i18n.t(key) : key;
            element.setAttribute(attrKey, value);
        }
    }
}

// ============================================
// EXPORTS AND GLOBAL EXPOSURE
// ============================================

// Create global i18n instance
const i18n = new I18n();

// Expose to window
window.i18n = i18n;
window.I18nConfig = I18nConfig;
window.Pluralizer = Pluralizer;
window.LanguageDetector = LanguageDetector;
window.I18nHTML = I18nHTML;

// Initialize i18n when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
    await i18n.init({
        debug: false
    });
    i18n.applyDirection();
    I18nHTML.init();
});

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { i18n, I18n, I18nConfig, Pluralizer, LanguageDetector, I18nHTML };
}