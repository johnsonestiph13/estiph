/**
 * ESTIF HOME ULTIMATE - LOADING MODULE
 * Loading indicators, spinners, and skeleton screens
 * Version: 2.0.0
 * Author: Estifanos Yohannis
 */

// ============================================
// LOADING CONFIGURATION
// ============================================

const LoadingConfig = {
    // Loading types
    types: {
        spinner: 'spinner',
        dots: 'dots',
        pulse: 'pulse',
        skeleton: 'skeleton'
    },
    
    // Default type
    defaultType: 'spinner',
    
    // Minimum loading time (ms)
    minDisplayTime: 500,
    
    // Debug
    debug: false
};

// ============================================
// LOADING MANAGER
// ============================================

class LoadingManager {
    constructor() {
        this.loaders = new Map();
        this.globalLoader = null;
        this.loadingCount = 0;
        this.listeners = [];
        
        this.init();
    }

    init() {
        this.createGlobalLoader();
        LoadingConfig.debug && console.log('[Loading] Manager initialized');
    }

    createGlobalLoader() {
        this.globalLoader = document.createElement('div');
        this.globalLoader.className = 'global-loader';
        this.globalLoader.style.display = 'none';
        this.globalLoader.innerHTML = `
            <div class="loader-overlay">
                <div class="loader-content">
                    <div class="spinner"></div>
                    <p>Loading...</p>
                </div>
            </div>
        `;
        document.body.appendChild(this.globalLoader);
    }

    // ============================================
    // GLOBAL LOADING
    // ============================================

    show(options = {}) {
        this.loadingCount++;
        
        if (this.loadingCount === 1) {
            this.globalLoader.style.display = 'flex';
            
            if (options.message) {
                const messageEl = this.globalLoader.querySelector('p');
                if (messageEl) messageEl.textContent = options.message;
            }
            
            this.notifyListeners('loading_started');
        }
        
        return () => this.hide();
    }

    hide() {
        this.loadingCount = Math.max(0, this.loadingCount - 1);
        
        if (this.loadingCount === 0) {
            setTimeout(() => {
                if (this.loadingCount === 0) {
                    this.globalLoader.style.display = 'none';
                    this.notifyListeners('loading_finished');
                }
            }, LoadingConfig.minDisplayTime);
        }
    }

    // ============================================
    // LOCAL LOADERS
    // ============================================

    createLoader(container, options = {}) {
        const type = options.type || LoadingConfig.defaultType;
        const loader = this.buildLoader(type, options);
        
        if (container) {
            container.appendChild(loader);
        }
        
        const loaderId = `loader_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        this.loaders.set(loaderId, { element: loader, container, options });
        
        return {
            id: loaderId,
            remove: () => this.removeLoader(loaderId)
        };
    }

    buildLoader(type, options) {
        const loader = document.createElement('div');
        loader.className = `loader loader-${type}`;
        
        switch (type) {
            case 'spinner':
                loader.innerHTML = '<div class="spinner"></div>';
                break;
            case 'dots':
                loader.innerHTML = `
                    <div class="dots-loader">
                        <span></span>
                        <span></span>
                        <span></span>
                    </div>
                `;
                break;
            case 'pulse':
                loader.innerHTML = '<div class="pulse-loader"></div>';
                break;
            case 'skeleton':
                loader.className = 'skeleton-loader';
                loader.innerHTML = this.buildSkeleton(options.skeletonType || 'card');
                break;
        }
        
        if (options.message) {
            const message = document.createElement('p');
            message.className = 'loader-message';
            message.textContent = options.message;
            loader.appendChild(message);
        }
        
        return loader;
    }

    buildSkeleton(type) {
        const skeletons = {
            card: `
                <div class="skeleton-card">
                    <div class="skeleton-image"></div>
                    <div class="skeleton-title"></div>
                    <div class="skeleton-text"></div>
                    <div class="skeleton-text short"></div>
                </div>
            `,
            list: `
                <div class="skeleton-list">
                    <div class="skeleton-list-item"></div>
                    <div class="skeleton-list-item"></div>
                    <div class="skeleton-list-item"></div>
                </div>
            `,
            profile: `
                <div class="skeleton-profile">
                    <div class="skeleton-avatar"></div>
                    <div class="skeleton-info">
                        <div class="skeleton-name"></div>
                        <div class="skeleton-bio"></div>
                    </div>
                </div>
            `,
            table: `
                <div class="skeleton-table">
                    <div class="skeleton-row"></div>
                    <div class="skeleton-row"></div>
                    <div class="skeleton-row"></div>
                    <div class="skeleton-row"></div>
                </div>
            `
        };
        
        return skeletons[type] || skeletons.card;
    }

    removeLoader(loaderId) {
        const loader = this.loaders.get(loaderId);
        if (loader) {
            if (loader.element && loader.element.parentNode) {
                loader.element.parentNode.removeChild(loader.element);
            }
            this.loaders.delete(loaderId);
        }
    }

    removeAllLoaders() {
        this.loaders.forEach((loader, id) => this.removeLoader(id));
    }

    // ============================================
    // BUTTON LOADING
    // ============================================

    setButtonLoading(button, loading = true, text = null) {
        if (loading) {
            this.originalButtonText = button.innerHTML;
            button.disabled = true;
            button.classList.add('loading');
            button.innerHTML = '<span class="button-spinner"></span> Loading...';
            if (text) button.innerHTML = `<span class="button-spinner"></span> ${text}`;
        } else {
            button.disabled = false;
            button.classList.remove('loading');
            if (this.originalButtonText) {
                button.innerHTML = this.originalButtonText;
            }
        }
    }

    // ============================================
    // PAGE LOADING
    // ============================================

    async withLoading(promise, options = {}) {
        const hideLoader = this.show(options);
        try {
            const result = await promise;
            return result;
        } finally {
            hideLoader();
        }
    }

    // ============================================
    // ELEMENT LOADING
    // ============================================

    setElementLoading(element, loading = true) {
        if (loading) {
            element.classList.add('loading');
            const overlay = document.createElement('div');
            overlay.className = 'element-loader';
            overlay.innerHTML = '<div class="spinner small"></div>';
            element.style.position = 'relative';
            element.appendChild(overlay);
        } else {
            element.classList.remove('loading');
            const overlay = element.querySelector('.element-loader');
            if (overlay) overlay.remove();
        }
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
// CSS STYLES
// ============================================

const loadingStyles = `
    .global-loader {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 9999;
        display: none;
        align-items: center;
        justify-content: center;
    }
    
    .loader-overlay {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        backdrop-filter: blur(4px);
    }
    
    .loader-content {
        position: relative;
        background: var(--bg-card);
        border-radius: 12px;
        padding: 24px;
        text-align: center;
        min-width: 200px;
        box-shadow: var(--shadow-xl);
    }
    
    .spinner {
        width: 40px;
        height: 40px;
        border: 3px solid var(--border-color);
        border-top-color: var(--primary);
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
        margin: 0 auto 12px;
    }
    
    .spinner.small {
        width: 20px;
        height: 20px;
        border-width: 2px;
    }
    
    @keyframes spin {
        to { transform: rotate(360deg); }
    }
    
    .dots-loader {
        display: flex;
        gap: 8px;
        justify-content: center;
        margin-bottom: 12px;
    }
    
    .dots-loader span {
        width: 10px;
        height: 10px;
        background: var(--primary);
        border-radius: 50%;
        animation: dotPulse 1.4s ease-in-out infinite;
    }
    
    .dots-loader span:nth-child(2) { animation-delay: 0.2s; }
    .dots-loader span:nth-child(3) { animation-delay: 0.4s; }
    
    @keyframes dotPulse {
        0%, 80%, 100% { transform: scale(0.6); opacity: 0.5; }
        40% { transform: scale(1); opacity: 1; }
    }
    
    .pulse-loader {
        width: 40px;
        height: 40px;
        background: var(--primary);
        border-radius: 50%;
        margin: 0 auto 12px;
        animation: pulse 1.4s ease-in-out infinite;
    }
    
    @keyframes pulse {
        0% { transform: scale(0.8); opacity: 0.5; }
        50% { transform: scale(1.2); opacity: 1; }
        100% { transform: scale(0.8); opacity: 0.5; }
    }
    
    .skeleton-card {
        background: var(--bg-secondary);
        border-radius: 8px;
        padding: 16px;
    }
    
    .skeleton-image {
        height: 150px;
        background: linear-gradient(90deg, var(--bg-tertiary) 25%, var(--bg-secondary) 50%, var(--bg-tertiary) 75%);
        background-size: 200% 100%;
        animation: skeletonLoading 1.5s ease-in-out infinite;
        border-radius: 8px;
        margin-bottom: 12px;
    }
    
    .skeleton-title {
        height: 20px;
        background: linear-gradient(90deg, var(--bg-tertiary) 25%, var(--bg-secondary) 50%, var(--bg-tertiary) 75%);
        background-size: 200% 100%;
        animation: skeletonLoading 1.5s ease-in-out infinite;
        border-radius: 4px;
        margin-bottom: 8px;
        width: 60%;
    }
    
    .skeleton-text {
        height: 14px;
        background: linear-gradient(90deg, var(--bg-tertiary) 25%, var(--bg-secondary) 50%, var(--bg-tertiary) 75%);
        background-size: 200% 100%;
        animation: skeletonLoading 1.5s ease-in-out infinite;
        border-radius: 4px;
        margin-bottom: 8px;
    }
    
    .skeleton-text.short {
        width: 40%;
    }
    
    .skeleton-list-item {
        height: 50px;
        background: linear-gradient(90deg, var(--bg-tertiary) 25%, var(--bg-secondary) 50%, var(--bg-tertiary) 75%);
        background-size: 200% 100%;
        animation: skeletonLoading 1.5s ease-in-out infinite;
        border-radius: 8px;
        margin-bottom: 8px;
    }
    
    .skeleton-avatar {
        width: 60px;
        height: 60px;
        background: linear-gradient(90deg, var(--bg-tertiary) 25%, var(--bg-secondary) 50%, var(--bg-tertiary) 75%);
        background-size: 200% 100%;
        animation: skeletonLoading 1.5s ease-in-out infinite;
        border-radius: 50%;
    }
    
    .skeleton-row {
        height: 40px;
        background: linear-gradient(90deg, var(--bg-tertiary) 25%, var(--bg-secondary) 50%, var(--bg-tertiary) 75%);
        background-size: 200% 100%;
        animation: skeletonLoading 1.5s ease-in-out infinite;
        border-radius: 4px;
        margin-bottom: 8px;
    }
    
    @keyframes skeletonLoading {
        0% { background-position: 200% 0; }
        100% { background-position: -200% 0; }
    }
    
    .button-spinner {
        display: inline-block;
        width: 14px;
        height: 14px;
        border: 2px solid rgba(255,255,255,0.3);
        border-top-color: white;
        border-radius: 50%;
        animation: spin 0.6s linear infinite;
        margin-right: 6px;
        vertical-align: middle;
    }
    
    .element-loader {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(255,255,255,0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: inherit;
    }
    
    [data-theme="dark"] .element-loader {
        background: rgba(0,0,0,0.7);
    }
    
    .loader-message {
        margin-top: 8px;
        font-size: 12px;
        color: var(--text-secondary);
    }
`;

// Inject styles
if (typeof document !== 'undefined') {
    const styleSheet = document.createElement('style');
    styleSheet.textContent = loadingStyles;
    document.head.appendChild(styleSheet);
}

// ============================================
// CREATE SINGLETON INSTANCE
// ============================================

const loading = new LoadingManager();

// Expose globally
window.loading = loading;

export { loading, LoadingManager, LoadingConfig };