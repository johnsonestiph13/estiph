/**
 * ESTIF HOME ULTIMATE - ACCESSIBILITY MODULE
 * WCAG compliance, screen reader support, keyboard navigation, and focus management
 * Version: 2.0.0
 * Author: Estifanos Yohannis
 */

// ============================================
// ACCESSIBILITY CONFIGURATION
// ============================================

const AccessibilityConfig = {
    // Features
    enableKeyboardShortcuts: true,
    enableFocusTrap: true,
    enableAnnouncer: true,
    enableHighContrast: true,
    
    // Keyboard shortcuts
    shortcuts: {
        '?': { action: 'show_help', description: 'Show keyboard shortcuts' },
        '/': { action: 'focus_search', description: 'Focus search' },
        'g d': { action: 'go_dashboard', description: 'Go to Dashboard' },
        'g d': { action: 'go_devices', description: 'Go to Devices' },
        'g a': { action: 'go_automation', description: 'Go to Automation' },
        'g s': { action: 'go_settings', description: 'Go to Settings' },
        'esc': { action: 'close_modal', description: 'Close modal/dialog' },
        'ctrl+/': { action: 'toggle_help', description: 'Toggle help' }
    },
    
    // ARIA roles
    roles: {
        alert: 'alert',
        dialog: 'dialog',
        menu: 'menu',
        menuitem: 'menuitem',
        tablist: 'tablist',
        tab: 'tab',
        tabpanel: 'tabpanel',
        progressbar: 'progressbar'
    },
    
    // Debug
    debug: false
};

// ============================================
// ACCESSIBILITY MANAGER
// ============================================

class AccessibilityManager {
    constructor() {
        this.focusableElements = [];
        this.trappedElement = null;
        this.announcer = null;
        this.listeners = [];
        
        this.init();
    }

    init() {
        this.createAnnouncer();
        this.setupKeyboardShortcuts();
        this.setupFocusManagement();
        this.setupScreenReaderAnnouncements();
        AccessibilityConfig.debug && console.log('[Accessibility] Manager initialized');
    }

    // ============================================
    // SCREEN READER ANNOUNCER
    // ============================================

    createAnnouncer() {
        if (!AccessibilityConfig.enableAnnouncer) return;
        
        this.announcer = document.createElement('div');
        this.announcer.setAttribute('aria-live', 'polite');
        this.announcer.setAttribute('aria-atomic', 'true');
        this.announcer.className = 'sr-only';
        this.announcer.style.position = 'absolute';
        this.announcer.style.width = '1px';
        this.announcer.style.height = '1px';
        this.announcer.style.padding = '0';
        this.announcer.style.margin = '-1px';
        this.announcer.style.overflow = 'hidden';
        this.announcer.style.clip = 'rect(0,0,0,0)';
        this.announcer.style.border = '0';
        document.body.appendChild(this.announcer);
    }

    announce(message, priority = 'polite') {
        if (!this.announcer) return;
        
        this.announcer.setAttribute('aria-live', priority);
        this.announcer.textContent = message;
        
        // Clear after announcement
        setTimeout(() => {
            this.announcer.textContent = '';
        }, 3000);
        
        AccessibilityConfig.debug && console.log('[Accessibility] Announce:', message);
    }

    // ============================================
    // KEYBOARD SHORTCUTS
    // ============================================

    setupKeyboardShortcuts() {
        if (!AccessibilityConfig.enableKeyboardShortcuts) return;
        
        let keys = '';
        
        document.addEventListener('keydown', (e) => {
            // Don't trigger shortcuts when typing in input fields
            if (e.target.matches('input, textarea, select, [contenteditable]')) {
                return;
            }
            
            // Handle single key shortcuts
            const key = e.key.toLowerCase();
            
            switch (key) {
                case '?':
                    e.preventDefault();
                    this.showShortcutsHelp();
                    break;
                case '/':
                    e.preventDefault();
                    this.focusSearch();
                    break;
                case 'esc':
                    this.closeModals();
                    break;
            }
            
            // Handle Ctrl+key shortcuts
            if (e.ctrlKey) {
                switch (key) {
                    case '/':
                        e.preventDefault();
                        this.toggleHelp();
                        break;
                }
            }
            
            // Handle letter shortcuts
            if (!e.ctrlKey && !e.altKey && !e.metaKey) {
                switch (key) {
                    case 'd':
                        this.navigateTo('dashboard');
                        break;
                    case 'v':
                        this.navigateTo('devices');
                        break;
                    case 'a':
                        this.navigateTo('automation');
                        break;
                    case 's':
                        this.navigateTo('settings');
                        break;
                }
            }
        });
    }

    showShortcutsHelp() {
        const shortcuts = AccessibilityConfig.shortcuts;
        let message = 'Keyboard shortcuts: ';
        for (const [key, value] of Object.entries(shortcuts)) {
            message += `${key} - ${value.description}. `;
        }
        this.announce(message);
        
        // Create modal with shortcuts
        const modal = document.createElement('div');
        modal.className = 'shortcuts-modal';
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-label', 'Keyboard Shortcuts');
        modal.innerHTML = `
            <div class="shortcuts-content">
                <h2>Keyboard Shortcuts</h2>
                <table class="shortcuts-table">
                    <thead>
                        <tr><th>Shortcut</th><th>Action</th></tr>
                    </thead>
                    <tbody>
                        ${Object.entries(shortcuts).map(([key, value]) => `
                            <tr><td><kbd>${key}</kbd></td><td>${value.description}</td></tr>
                        `).join('')}
                    </tbody>
                </table>
                <button class="close-shortcuts">Close</button>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        const closeBtn = modal.querySelector('.close-shortcuts');
        closeBtn.focus();
        
        const close = () => {
            modal.remove();
            document.body.removeEventListener('keydown', handleEsc);
        };
        
        const handleEsc = (e) => {
            if (e.key === 'Escape') close();
        };
        
        closeBtn.addEventListener('click', close);
        document.body.addEventListener('keydown', handleEsc);
    }

    focusSearch() {
        const searchInput = document.querySelector('input[type="search"], .search-input');
        if (searchInput) {
            searchInput.focus();
            this.announce('Search input focused');
        }
    }

    closeModals() {
        const modals = document.querySelectorAll('.modal-overlay, .modal');
        modals.forEach(modal => {
            if (modal.style.display !== 'none') {
                const closeBtn = modal.querySelector('.modal-close, .close-btn');
                if (closeBtn) closeBtn.click();
            }
        });
    }

    navigateTo(page) {
        if (window.navigateTo) {
            window.navigateTo(page);
            this.announce(`Navigated to ${page}`);
        }
    }

    toggleHelp() {
        const helpPanel = document.getElementById('help-panel');
        if (helpPanel) {
            helpPanel.classList.toggle('visible');
            this.announce(helpPanel.classList.contains('visible') ? 'Help panel opened' : 'Help panel closed');
        }
    }

    // ============================================
    // FOCUS MANAGEMENT
    // ============================================

    setupFocusManagement() {
        // Add focus styles
        const style = document.createElement('style');
        style.textContent = `
            :focus-visible {
                outline: 2px solid var(--primary);
                outline-offset: 2px;
            }
            
            .focus-trap {
                position: relative;
            }
            
            .focus-trap:focus-within {
                outline: none;
            }
        `;
        document.head.appendChild(style);
        
        // Trap focus in modals
        document.addEventListener('focusin', (e) => {
            const modal = e.target.closest('.modal-overlay, .modal');
            if (modal && AccessibilityConfig.enableFocusTrap) {
                this.trapFocus(modal);
            }
        });
    }

    trapFocus(element) {
        const focusable = this.getFocusableElements(element);
        if (focusable.length === 0) return;
        
        const firstFocusable = focusable[0];
        const lastFocusable = focusable[focusable.length - 1];
        
        element.addEventListener('keydown', (e) => {
            if (e.key !== 'Tab') return;
            
            if (e.shiftKey) {
                if (document.activeElement === firstFocusable) {
                    lastFocusable.focus();
                    e.preventDefault();
                }
            } else {
                if (document.activeElement === lastFocusable) {
                    firstFocusable.focus();
                    e.preventDefault();
                }
            }
        });
    }

    getFocusableElements(container) {
        const selectors = [
            'a[href]', 'button', 'textarea', 'input', 'select',
            '[tabindex]:not([tabindex="-1"])', '[contenteditable="true"]'
        ];
        return Array.from(container.querySelectorAll(selectors));
    }

    setFocus(element, announce = true) {
        if (element) {
            element.focus();
            if (announce) {
                const label = element.getAttribute('aria-label') || element.textContent || 'Element';
                this.announce(`Focused on ${label}`);
            }
        }
    }

    // ============================================
    // ARIA ATTRIBUTES
    // ============================================

    setRole(element, role) {
        element.setAttribute('role', role);
    }

    setLabel(element, label) {
        element.setAttribute('aria-label', label);
    }

    setDescription(element, description) {
        element.setAttribute('aria-description', description);
    }

    setLiveRegion(element, priority = 'polite') {
        element.setAttribute('aria-live', priority);
        element.setAttribute('aria-atomic', 'true');
    }

    setExpanded(element, expanded) {
        element.setAttribute('aria-expanded', expanded);
    }

    setDisabled(element, disabled) {
        element.setAttribute('aria-disabled', disabled);
    }

    setSelected(element, selected) {
        element.setAttribute('aria-selected', selected);
    }

    setCurrent(element, current) {
        element.setAttribute('aria-current', current);
    }

    // ============================================
    // SKIP TO CONTENT
    // ============================================

    addSkipToContentLink() {
        const skipLink = document.createElement('a');
        skipLink.href = '#main-content';
        skipLink.className = 'skip-to-content';
        skipLink.textContent = 'Skip to main content';
        skipLink.style.position = 'absolute';
        skipLink.style.top = '-40px';
        skipLink.style.left = '0';
        skipLink.style.background = 'var(--primary)';
        skipLink.style.color = 'white';
        skipLink.style.padding = '8px 16px';
        skipLink.style.zIndex = '9999';
        skipLink.style.transition = 'top 0.2s';
        
        skipLink.addEventListener('focus', () => {
            skipLink.style.top = '0';
        });
        
        skipLink.addEventListener('blur', () => {
            skipLink.style.top = '-40px';
        });
        
        document.body.insertBefore(skipLink, document.body.firstChild);
    }

    // ============================================
    // HIGH CONTRAST
    // ============================================

    enableHighContrast() {
        if (!AccessibilityConfig.enableHighContrast) return;
        
        document.documentElement.setAttribute('data-high-contrast', 'true');
        this.announce('High contrast mode enabled');
    }

    disableHighContrast() {
        document.documentElement.removeAttribute('data-high-contrast');
        this.announce('High contrast mode disabled');
    }

    toggleHighContrast() {
        if (document.documentElement.hasAttribute('data-high-contrast')) {
            this.disableHighContrast();
        } else {
            this.enableHighContrast();
        }
    }

    // ============================================
    // REDUCED MOTION
    // ============================================

    detectReducedMotion() {
        const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)');
        if (prefersReduced.matches) {
            document.documentElement.setAttribute('data-reduced-motion', 'true');
            this.announce('Reduced motion detected');
        }
        
        prefersReduced.addEventListener('change', (e) => {
            if (e.matches) {
                document.documentElement.setAttribute('data-reduced-motion', 'true');
                this.announce('Reduced motion enabled');
            } else {
                document.documentElement.removeAttribute('data-reduced-motion');
                this.announce('Reduced motion disabled');
            }
        });
    }

    // ============================================
    // LANDMARK ROLES
    // ============================================

    addLandmarks() {
        const landmarks = [
            { selector: 'header', role: 'banner' },
            { selector: 'nav', role: 'navigation' },
            { selector: 'main', role: 'main' },
            { selector: 'aside', role: 'complementary' },
            { selector: 'footer', role: 'contentinfo' },
            { selector: 'form', role: 'form' },
            { selector: 'search', role: 'search' }
        ];
        
        landmarks.forEach(landmark => {
            const elements = document.querySelectorAll(landmark.selector);
            elements.forEach(el => {
                if (!el.hasAttribute('role')) {
                    el.setAttribute('role', landmark.role);
                }
            });
        });
    }

    // ============================================
    // FORM VALIDATION ANNOUNCEMENT
    // ============================================

    announceFormErrors(form, errors) {
        const errorList = document.createElement('ul');
        errorList.setAttribute('role', 'alert');
        errorList.setAttribute('aria-live', 'assertive');
        
        errors.forEach(error => {
            const li = document.createElement('li');
            li.textContent = error;
            errorList.appendChild(li);
        });
        
        form.insertBefore(errorList, form.firstChild);
        
        setTimeout(() => {
            errorList.remove();
        }, 5000);
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

const accessibilityStyles = `
    .shortcuts-modal {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.7);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
    }
    
    .shortcuts-content {
        background: var(--bg-card);
        border-radius: 12px;
        padding: 24px;
        max-width: 500px;
        width: 90%;
        max-height: 80vh;
        overflow-y: auto;
    }
    
    .shortcuts-content h2 {
        margin-bottom: 16px;
    }
    
    .shortcuts-table {
        width: 100%;
        border-collapse: collapse;
        margin-bottom: 20px;
    }
    
    .shortcuts-table th,
    .shortcuts-table td {
        padding: 8px;
        text-align: left;
        border-bottom: 1px solid var(--border-color);
    }
    
    .shortcuts-table kbd {
        background: var(--bg-tertiary);
        padding: 2px 6px;
        border-radius: 4px;
        font-family: monospace;
        font-size: 12px;
    }
    
    [data-high-contrast="true"] {
        --primary: #ffff00;
        --secondary: #00ffff;
        --bg-primary: #000000;
        --text-primary: #ffffff;
        --border-color: #ffffff;
    }
    
    [data-reduced-motion="true"] *,
    [data-reduced-motion="true"] *::before,
    [data-reduced-motion="true"] *::after {
        animation-duration: 0.01ms !important;
        transition-duration: 0.01ms !important;
    }
    
    .sr-only {
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        border: 0;
    }
`;

// Inject styles
if (typeof document !== 'undefined') {
    const styleSheet = document.createElement('style');
    styleSheet.textContent = accessibilityStyles;
    document.head.appendChild(styleSheet);
}

// ============================================
// CREATE SINGLETON INSTANCE
// ============================================

const accessibility = new AccessibilityManager();

// Expose globally
window.accessibility = accessibility;

export { accessibility, AccessibilityManager, AccessibilityConfig };