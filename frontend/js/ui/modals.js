/**
 * ESTIF HOME ULTIMATE - MODALS MODULE
 * Dynamic modal dialogs for confirmations, forms, and custom content
 * Version: 2.0.0
 * Author: Estifanos Yohannis
 */

// ============================================
// MODALS CONFIGURATION
// ============================================

const ModalsConfig = {
    // Default sizes
    sizes: {
        sm: '400px',
        md: '600px',
        lg: '800px',
        xl: '1140px',
        full: '95%'
    },
    
    // Animation duration
    animationDuration: 300,
    
    // Debug
    debug: false
};

// ============================================
// MODAL CLASS
// ============================================

class Modal {
    constructor(options) {
        this.id = options.id || `modal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        this.title = options.title || '';
        this.content = options.content || '';
        this.size = options.size || 'md';
        this.closable = options.closable !== false;
        this.draggable = options.draggable || false;
        this.onOpen = options.onOpen || null;
        this.onClose = options.onClose || null;
        this.onConfirm = options.onConfirm || null;
        this.onCancel = options.onCancel || null;
        this.buttons = options.buttons || [];
        this.showClose = options.showClose !== false;
        this.closeOnOverlayClick = options.closeOnOverlayClick !== false;
        this.closeOnEscape = options.closeOnEscape !== false;
        
        this.element = null;
        this.isOpen = false;
    }
}

// ============================================
// MODALS MANAGER
// ============================================

class ModalsManager {
    constructor() {
        this.modals = new Map();
        this.activeModal = null;
        this.listeners = [];
        this.zIndex = 1000;
        
        this.init();
    }

    init() {
        this.setupGlobalHandlers();
        ModalsConfig.debug && console.log('[Modals] Manager initialized');
    }

    setupGlobalHandlers() {
        // ESC key handler
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.activeModal && this.activeModal.closeOnEscape) {
                this.close(this.activeModal.id);
            }
        });
    }

    create(options) {
        const modal = new Modal(options);
        this.modals.set(modal.id, modal);
        
        // Build modal DOM
        this.buildModal(modal);
        
        ModalsConfig.debug && console.log('[Modals] Modal created:', modal.id);
        
        return modal.id;
    }

    buildModal(modal) {
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.setAttribute('data-modal-id', modal.id);
        overlay.style.zIndex = this.zIndex++;
        
        const modalContainer = document.createElement('div');
        modalContainer.className = 'modal-container';
        
        const modalElement = document.createElement('div');
        modalElement.className = `modal modal-${modal.size}`;
        
        // Header
        const header = document.createElement('div');
        header.className = 'modal-header';
        
        const title = document.createElement('h3');
        title.className = 'modal-title';
        title.innerHTML = modal.title;
        
        header.appendChild(title);
        
        if (modal.showClose) {
            const closeBtn = document.createElement('button');
            closeBtn.className = 'modal-close';
            closeBtn.innerHTML = '&times;';
            closeBtn.addEventListener('click', () => this.close(modal.id));
            header.appendChild(closeBtn);
        }
        
        modalElement.appendChild(header);
        
        // Body
        const body = document.createElement('div');
        body.className = 'modal-body';
        
        if (typeof modal.content === 'string') {
            body.innerHTML = modal.content;
        } else if (modal.content instanceof HTMLElement) {
            body.appendChild(modal.content);
        }
        
        modalElement.appendChild(body);
        
        // Footer
        const footer = document.createElement('div');
        footer.className = 'modal-footer';
        
        if (modal.buttons.length > 0) {
            modal.buttons.forEach(btn => {
                const button = document.createElement('button');
                button.className = `btn ${btn.class || 'btn-secondary'}`;
                button.textContent = btn.text;
                button.addEventListener('click', () => {
                    if (btn.onClick) btn.onClick();
                    if (btn.closeOnClick !== false) this.close(modal.id);
                });
                footer.appendChild(button);
            });
        } else if (modal.onConfirm || modal.onCancel) {
            if (modal.onCancel) {
                const cancelBtn = document.createElement('button');
                cancelBtn.className = 'btn btn-secondary';
                cancelBtn.textContent = 'Cancel';
                cancelBtn.addEventListener('click', () => {
                    modal.onCancel();
                    this.close(modal.id);
                });
                footer.appendChild(cancelBtn);
            }
            
            if (modal.onConfirm) {
                const confirmBtn = document.createElement('button');
                confirmBtn.className = 'btn btn-primary';
                confirmBtn.textContent = 'Confirm';
                confirmBtn.addEventListener('click', () => {
                    modal.onConfirm();
                    this.close(modal.id);
                });
                footer.appendChild(confirmBtn);
            }
        }
        
        modalElement.appendChild(footer);
        modalContainer.appendChild(modalElement);
        overlay.appendChild(modalContainer);
        
        // Draggable functionality
        if (modal.draggable) {
            this.makeDraggable(modalElement, header);
        }
        
        // Close on overlay click
        if (modal.closeOnOverlayClick) {
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    this.close(modal.id);
                }
            });
        }
        
        modal.element = overlay;
    }

    makeDraggable(modal, handle) {
        let isDragging = false;
        let startX, startY, initialLeft, initialTop;
        
        handle.style.cursor = 'move';
        
        handle.addEventListener('mousedown', (e) => {
            if (e.button !== 0) return;
            
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            
            const rect = modal.getBoundingClientRect();
            initialLeft = rect.left;
            initialTop = rect.top;
            
            modal.style.position = 'fixed';
            modal.style.margin = '0';
            modal.style.left = `${initialLeft}px`;
            modal.style.top = `${initialTop}px`;
            
            document.body.style.userSelect = 'none';
        });
        
        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            
            modal.style.left = `${initialLeft + dx}px`;
            modal.style.top = `${initialTop + dy}px`;
        });
        
        document.addEventListener('mouseup', () => {
            isDragging = false;
            document.body.style.userSelect = '';
        });
    }

    open(modalId) {
        const modal = this.modals.get(modalId);
        if (!modal || !modal.element) return false;
        
        // Close current modal if open
        if (this.activeModal) {
            this.close(this.activeModal.id);
        }
        
        document.body.appendChild(modal.element);
        document.body.style.overflow = 'hidden';
        
        // Animate in
        setTimeout(() => {
            modal.element.classList.add('active');
            modal.element.querySelector('.modal')?.classList.add('active');
        }, 10);
        
        modal.isOpen = true;
        this.activeModal = modal;
        
        if (modal.onOpen) modal.onOpen();
        this.notifyListeners('modal_opened', modal);
        
        ModalsConfig.debug && console.log('[Modals] Modal opened:', modalId);
        
        return true;
    }

    close(modalId) {
        const modal = this.modals.get(modalId);
        if (!modal || !modal.isOpen) return false;
        
        modal.element.classList.remove('active');
        modal.element.querySelector('.modal')?.classList.remove('active');
        
        setTimeout(() => {
            if (modal.element.parentNode) {
                modal.element.parentNode.removeChild(modal.element);
            }
            document.body.style.overflow = '';
            
            modal.isOpen = false;
            
            if (this.activeModal?.id === modalId) {
                this.activeModal = null;
            }
            
            if (modal.onClose) modal.onClose();
            this.notifyListeners('modal_closed', modal);
        }, ModalsConfig.animationDuration);
        
        ModalsConfig.debug && console.log('[Modals] Modal closed:', modalId);
        
        return true;
    }

    closeAll() {
        this.modals.forEach(modal => {
            if (modal.isOpen) {
                this.close(modal.id);
            }
        });
    }

    getModal(modalId) {
        return this.modals.get(modalId);
    }

    updateContent(modalId, content) {
        const modal = this.modals.get(modalId);
        if (!modal || !modal.element) return false;
        
        const body = modal.element.querySelector('.modal-body');
        if (body) {
            if (typeof content === 'string') {
                body.innerHTML = content;
            } else if (content instanceof HTMLElement) {
                body.innerHTML = '';
                body.appendChild(content);
            }
        }
        
        return true;
    }

    // ============================================
    // CONVENIENCE METHODS
    // ============================================

    alert(message, title = 'Alert') {
        return new Promise((resolve) => {
            const modalId = this.create({
                title,
                content: `<p>${message}</p>`,
                buttons: [
                    { text: 'OK', onClick: resolve, class: 'btn-primary' }
                ],
                showClose: false,
                closeOnOverlayClick: false
            });
            this.open(modalId);
        });
    }

    confirm(message, title = 'Confirm') {
        return new Promise((resolve) => {
            const modalId = this.create({
                title,
                content: `<p>${message}</p>`,
                onConfirm: () => resolve(true),
                onCancel: () => resolve(false),
                closeOnOverlayClick: false
            });
            this.open(modalId);
        });
    }

    prompt(message, defaultValue = '', title = 'Input') {
        return new Promise((resolve) => {
            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'form-input';
            input.value = defaultValue;
            input.placeholder = message;
            
            const modalId = this.create({
                title,
                content: input,
                onConfirm: () => resolve(input.value),
                onCancel: () => resolve(null)
            });
            this.open(modalId);
            
            // Focus input after animation
            setTimeout(() => input.focus(), ModalsConfig.animationDuration);
        });
    }

    form(fields, title = 'Form') {
        return new Promise((resolve) => {
            const form = document.createElement('form');
            form.className = 'modal-form';
            
            const fieldElements = {};
            
            fields.forEach(field => {
                const group = document.createElement('div');
                group.className = 'form-group';
                
                const label = document.createElement('label');
                label.textContent = field.label;
                group.appendChild(label);
                
                let input;
                if (field.type === 'select') {
                    input = document.createElement('select');
                    input.className = 'form-select';
                    field.options.forEach(opt => {
                        const option = document.createElement('option');
                        option.value = opt.value;
                        option.textContent = opt.label;
                        input.appendChild(option);
                    });
                } else if (field.type === 'textarea') {
                    input = document.createElement('textarea');
                    input.className = 'form-textarea';
                    input.rows = field.rows || 3;
                } else {
                    input = document.createElement('input');
                    input.type = field.type || 'text';
                    input.className = 'form-input';
                    input.placeholder = field.placeholder || '';
                }
                
                input.name = field.name;
                input.required = field.required || false;
                
                if (field.value) input.value = field.value;
                
                group.appendChild(input);
                form.appendChild(group);
                fieldElements[field.name] = input;
            });
            
            const modalId = this.create({
                title,
                content: form,
                onConfirm: () => {
                    const values = {};
                    for (const [name, input] of Object.entries(fieldElements)) {
                        values[name] = input.value;
                    }
                    resolve(values);
                },
                onCancel: () => resolve(null)
            });
            this.open(modalId);
        });
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

const modalsStyles = `
    .modal-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.7);
        backdrop-filter: blur(4px);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
        opacity: 0;
        visibility: hidden;
        transition: opacity 0.3s ease, visibility 0.3s ease;
    }
    
    .modal-overlay.active {
        opacity: 1;
        visibility: visible;
    }
    
    .modal-container {
        max-width: 90%;
        max-height: 90vh;
    }
    
    .modal {
        background: var(--bg-card);
        border-radius: 12px;
        box-shadow: var(--shadow-2xl);
        width: 100%;
        overflow: hidden;
        transform: scale(0.95);
        opacity: 0;
        transition: transform 0.3s ease, opacity 0.3s ease;
    }
    
    .modal.active {
        transform: scale(1);
        opacity: 1;
    }
    
    .modal-sm { max-width: 400px; }
    .modal-md { max-width: 600px; }
    .modal-lg { max-width: 800px; }
    .modal-xl { max-width: 1140px; }
    .modal-full { max-width: 95%; width: 95%; }
    
    .modal-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 16px 20px;
        border-bottom: 1px solid var(--border-color);
        background: var(--bg-secondary);
    }
    
    .modal-title {
        margin: 0;
        font-size: 18px;
        font-weight: 600;
    }
    
    .modal-close {
        background: none;
        border: none;
        font-size: 24px;
        cursor: pointer;
        color: var(--text-muted);
        transition: all 0.2s ease;
        padding: 4px 8px;
        border-radius: 4px;
    }
    
    .modal-close:hover {
        background: var(--bg-hover);
        color: var(--danger);
    }
    
    .modal-body {
        padding: 20px;
        max-height: calc(90vh - 140px);
        overflow-y: auto;
    }
    
    .modal-footer {
        display: flex;
        justify-content: flex-end;
        gap: 12px;
        padding: 16px 20px;
        border-top: 1px solid var(--border-color);
        background: var(--bg-secondary);
    }
    
    .modal-form {
        display: flex;
        flex-direction: column;
        gap: 16px;
    }
`;

// Inject styles
if (typeof document !== 'undefined') {
    const styleSheet = document.createElement('style');
    styleSheet.textContent = modalsStyles;
    document.head.appendChild(styleSheet);
}

// ============================================
// CREATE SINGLETON INSTANCE
// ============================================

const modals = new ModalsManager();

// Expose globally
window.modals = modals;

export { modals, ModalsManager, ModalsConfig };