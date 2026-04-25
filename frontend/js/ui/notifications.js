/**
 * ESTIF HOME ULTIMATE - NOTIFICATIONS MODULE
 * Toast notifications, push notifications, and in-app alerts
 * Version: 2.0.0
 * Author: Estifanos Yohannis
 */

// ============================================
// NOTIFICATIONS CONFIGURATION
// ============================================

const NotificationsConfig = {
    // Toast settings
    toastDuration: 3000,
    toastMaxStack: 5,
    toastPositions: ['top-right', 'top-left', 'bottom-right', 'bottom-left', 'top-center', 'bottom-center'],
    defaultPosition: 'bottom-right',
    
    // Push notification settings
    pushEnabled: true,
    vapidPublicKey: null,
    
    // Sound settings
    soundEnabled: true,
    soundFiles: {
        success: '/assets/sounds/success.mp3',
        error: '/assets/sounds/error.mp3',
        warning: '/assets/sounds/warning.mp3',
        info: '/assets/sounds/info.mp3'
    },
    
    // Storage
    storageKey: 'estif_notification_settings',
    
    // Debug
    debug: false
};

// ============================================
// NOTIFICATION CLASS
// ============================================

class Notification {
    constructor(options) {
        this.id = options.id || Date.now();
        this.type = options.type || 'info';
        this.title = options.title;
        this.message = options.message;
        this.duration = options.duration || NotificationsConfig.toastDuration;
        this.position = options.position || NotificationsConfig.defaultPosition;
        this.onClick = options.onClick || null;
        this.onClose = options.onClose || null;
        this.timestamp = Date.now();
        this.timeout = null;
    }
}

// ============================================
// NOTIFICATIONS MANAGER
// ============================================

class NotificationsManager {
    constructor() {
        this.toasts = [];
        this.container = null;
        this.settings = this.loadSettings();
        this.pushSubscription = null;
        this.listeners = [];
        
        this.init();
    }

    init() {
        this.createContainer();
        this.setupPushNotifications();
        NotificationsConfig.debug && console.log('[Notifications] Manager initialized');
    }

    loadSettings() {
        try {
            const saved = localStorage.getItem(NotificationsConfig.storageKey);
            if (saved) {
                return JSON.parse(saved);
            }
        } catch (error) {
            console.error('[Notifications] Failed to load settings:', error);
        }
        return { soundEnabled: true, pushEnabled: true };
    }

    saveSettings() {
        try {
            localStorage.setItem(NotificationsConfig.storageKey, JSON.stringify(this.settings));
        } catch (error) {
            console.error('[Notifications] Failed to save settings:', error);
        }
    }

    createContainer() {
        if (this.container) return;
        
        this.container = document.createElement('div');
        this.container.className = 'toast-container';
        this.container.id = 'toastContainer';
        document.body.appendChild(this.container);
    }

    // ============================================
    // TOAST NOTIFICATIONS
    // ============================================

    show(options) {
        const notification = new Notification(options);
        
        // Add to queue
        this.toasts.unshift(notification);
        
        // Limit stack size
        if (this.toasts.length > NotificationsConfig.toastMaxStack) {
            const removed = this.toasts.pop();
            this.removeToast(removed.id);
        }
        
        this.renderToast(notification);
        
        // Auto-remove after duration
        notification.timeout = setTimeout(() => {
            this.hide(notification.id);
        }, notification.duration);
        
        this.notifyListeners('toast_shown', notification);
        
        return notification.id;
    }

    success(message, options = {}) {
        return this.show({ type: 'success', message, ...options });
    }

    error(message, options = {}) {
        return this.show({ type: 'error', message, ...options });
    }

    warning(message, options = {}) {
        return this.show({ type: 'warning', message, ...options });
    }

    info(message, options = {}) {
        return this.show({ type: 'info', message, ...options });
    }

    renderToast(notification) {
        const icons = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️'
        };
        
        const toast = document.createElement('div');
        toast.className = `toast toast-${notification.type}`;
        toast.setAttribute('data-id', notification.id);
        toast.innerHTML = `
            <div class="toast-icon">${icons[notification.type]}</div>
            <div class="toast-content">
                ${notification.title ? `<div class="toast-title">${this.escapeHtml(notification.title)}</div>` : ''}
                <div class="toast-message">${this.escapeHtml(notification.message)}</div>
            </div>
            <button class="toast-close">&times;</button>
        `;
        
        // Add click handler
        const closeBtn = toast.querySelector('.toast-close');
        closeBtn.addEventListener('click', () => this.hide(notification.id));
        
        if (notification.onClick) {
            toast.addEventListener('click', (e) => {
                if (e.target !== closeBtn) {
                    notification.onClick();
                    this.hide(notification.id);
                }
            });
        }
        
        this.container.appendChild(toast);
        
        // Play sound
        if (this.settings.soundEnabled && NotificationsConfig.soundEnabled) {
            this.playSound(notification.type);
        }
        
        // Animate in
        setTimeout(() => toast.classList.add('show'), 10);
    }

    hide(id) {
        const toast = this.container?.querySelector(`.toast[data-id="${id}"]`);
        if (!toast) return;
        
        const notification = this.toasts.find(n => n.id === id);
        if (notification) {
            clearTimeout(notification.timeout);
            if (notification.onClose) notification.onClose();
            this.toasts = this.toasts.filter(n => n.id !== id);
        }
        
        toast.classList.remove('show');
        toast.classList.add('hide');
        
        setTimeout(() => toast.remove(), 300);
        
        this.notifyListeners('toast_hidden', { id });
    }

    hideAll() {
        this.toasts.forEach(toast => this.hide(toast.id));
    }

    // ============================================
    // SOUND EFFECTS
    // ============================================

    playSound(type) {
        if (!NotificationsConfig.soundFiles[type]) return;
        
        const audio = new Audio(NotificationsConfig.soundFiles[type]);
        audio.volume = 0.5;
        audio.play().catch(e => NotificationsConfig.debug && console.log('[Notifications] Sound play failed:', e));
    }

    setSoundEnabled(enabled) {
        this.settings.soundEnabled = enabled;
        this.saveSettings();
        this.notifyListeners('sound_setting_changed', enabled);
    }

    // ============================================
    // PUSH NOTIFICATIONS
    // ============================================

    async setupPushNotifications() {
        if (!NotificationsConfig.pushEnabled || !this.settings.pushEnabled) return;
        
        if (!('Notification' in window)) {
            console.warn('[Notifications] Push notifications not supported');
            return;
        }
        
        if (Notification.permission === 'granted') {
            await this.subscribePush();
        }
    }

    async requestPushPermission() {
        if (!('Notification' in window)) {
            return { success: false, error: 'Not supported' };
        }
        
        const permission = await Notification.requestPermission();
        
        if (permission === 'granted') {
            await this.subscribePush();
            return { success: true };
        }
        
        return { success: false, error: 'Permission denied' };
    }

    async subscribePush() {
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
            return;
        }
        
        try {
            const registration = await navigator.serviceWorker.ready;
            const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: NotificationsConfig.vapidPublicKey
            });
            
            this.pushSubscription = subscription;
            
            // Send subscription to server
            await fetch('/api/notifications/subscribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(subscription)
            });
            
            NotificationsConfig.debug && console.log('[Notifications] Push subscription successful');
        } catch (error) {
            console.error('[Notifications] Push subscription failed:', error);
        }
    }

    async unsubscribePush() {
        if (!this.pushSubscription) return;
        
        try {
            await this.pushSubscription.unsubscribe();
            this.pushSubscription = null;
            
            await fetch('/api/notifications/unsubscribe', { method: 'POST' });
            
            NotificationsConfig.debug && console.log('[Notifications] Push unsubscribed');
        } catch (error) {
            console.error('[Notifications] Unsubscribe failed:', error);
        }
    }

    sendPushNotification(title, body, options = {}) {
        if (Notification.permission === 'granted') {
            new Notification(title, { body, ...options });
        }
    }

    // ============================================
    // UTILITY
    // ============================================

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // ============================================
    // SETTINGS
    // ============================================

    updateSettings(updates) {
        this.settings = { ...this.settings, ...updates };
        this.saveSettings();
        
        if (updates.pushEnabled !== undefined) {
            if (updates.pushEnabled) {
                this.requestPushPermission();
            } else {
                this.unsubscribePush();
            }
        }
        
        this.notifyListeners('settings_updated', this.settings);
    }

    getSettings() {
        return { ...this.settings };
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

const notificationStyles = `
    .toast-container {
        position: fixed;
        z-index: 9999;
        display: flex;
        flex-direction: column;
        gap: 10px;
        pointer-events: none;
    }
    
    .toast-container:has(.toast) {
        pointer-events: auto;
    }
    
    /* Positions */
    .toast-container[data-position="top-right"] {
        top: 20px;
        right: 20px;
    }
    
    .toast-container[data-position="top-left"] {
        top: 20px;
        left: 20px;
    }
    
    .toast-container[data-position="bottom-right"] {
        bottom: 20px;
        right: 20px;
    }
    
    .toast-container[data-position="bottom-left"] {
        bottom: 20px;
        left: 20px;
    }
    
    .toast-container[data-position="top-center"] {
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
    }
    
    .toast-container[data-position="bottom-center"] {
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
    }
    
    .toast {
        background: var(--bg-card);
        border-radius: 8px;
        padding: 12px 16px;
        display: flex;
        align-items: center;
        gap: 12px;
        box-shadow: var(--shadow-lg);
        border-left: 4px solid;
        transform: translateX(0);
        opacity: 1;
        transition: all 0.3s ease;
        min-width: 280px;
        max-width: 400px;
    }
    
    .toast.show {
        animation: toastSlideIn 0.3s ease;
    }
    
    .toast.hide {
        animation: toastSlideOut 0.3s ease forwards;
    }
    
    @keyframes toastSlideIn {
        from {
            opacity: 0;
            transform: translateX(100%);
        }
        to {
            opacity: 1;
            transform: translateX(0);
        }
    }
    
    @keyframes toastSlideOut {
        from {
            opacity: 1;
            transform: translateX(0);
        }
        to {
            opacity: 0;
            transform: translateX(100%);
        }
    }
    
    .toast-success {
        border-left-color: var(--success);
    }
    
    .toast-error {
        border-left-color: var(--danger);
    }
    
    .toast-warning {
        border-left-color: var(--warning);
    }
    
    .toast-info {
        border-left-color: var(--info);
    }
    
    .toast-icon {
        font-size: 20px;
    }
    
    .toast-content {
        flex: 1;
    }
    
    .toast-title {
        font-weight: 600;
        margin-bottom: 2px;
    }
    
    .toast-message {
        font-size: 13px;
        color: var(--text-secondary);
    }
    
    .toast-close {
        background: none;
        border: none;
        font-size: 18px;
        cursor: pointer;
        color: var(--text-muted);
        padding: 4px;
        border-radius: 4px;
        transition: all 0.2s ease;
    }
    
    .toast-close:hover {
        background: var(--bg-hover);
        color: var(--danger);
    }
`;

// Inject styles
if (typeof document !== 'undefined') {
    const styleSheet = document.createElement('style');
    styleSheet.textContent = notificationStyles;
    document.head.appendChild(styleSheet);
}

// ============================================
// CREATE SINGLETON INSTANCE
// ============================================

const notifications = new NotificationsManager();

// Expose globally
window.notifications = notifications;
window.showToast = (message, type = 'info') => notifications.show({ message, type });

export { notifications, NotificationsManager, NotificationsConfig };