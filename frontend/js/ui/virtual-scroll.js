/**
 * ESTIF HOME ULTIMATE - VIRTUAL SCROLL MODULE
 * Efficient rendering of large lists with dynamic row virtualization
 * Version: 2.0.0
 * Author: Estifanos Yohannis
 */

// ============================================
// VIRTUAL SCROLL CONFIGURATION
// ============================================

const VirtualScrollConfig = {
    // Default row height
    defaultRowHeight: 50,
    
    // Overscan (extra rows to render)
    overscan: 5,
    
    // Throttle scroll events (ms)
    scrollThrottle: 16,
    
    // Debug
    debug: false
};

// ============================================
// VIRTUAL SCROLL MANAGER
// ============================================

class VirtualScrollManager {
    constructor(container, options = {}) {
        this.container = container;
        this.items = options.items || [];
        this.rowHeight = options.rowHeight || VirtualScrollConfig.defaultRowHeight;
        this.renderItem = options.renderItem;
        this.overscan = options.overscan || VirtualScrollConfig.overscan;
        
        this.scrollTop = 0;
        this.startIndex = 0;
        this.endIndex = 0;
        this.visibleItems = [];
        this.resizeObserver = null;
        this.scrollListener = null;
        this.animationFrame = null;
        
        this.init();
    }

    init() {
        this.createStructure();
        this.bindEvents();
        this.calculateVisibleRange();
        this.render();
        
        VirtualScrollConfig.debug && console.log('[VirtualScroll] Initialized with', this.items.length, 'items');
    }

    createStructure() {
        // Create viewport container
        this.viewport = document.createElement('div');
        this.viewport.className = 'virtual-scroll-viewport';
        this.viewport.style.position = 'relative';
        this.viewport.style.width = '100%';
        this.viewport.style.height = '100%';
        this.viewport.style.overflow = 'auto';
        
        // Create spacer for scroll height
        this.spacer = document.createElement('div');
        this.spacer.className = 'virtual-scroll-spacer';
        this.spacer.style.height = `${this.items.length * this.rowHeight}px`;
        
        // Create content container
        this.content = document.createElement('div');
        this.content.className = 'virtual-scroll-content';
        this.content.style.position = 'absolute';
        this.content.style.top = '0';
        this.content.style.left = '0';
        this.content.style.right = '0';
        
        this.viewport.appendChild(this.spacer);
        this.viewport.appendChild(this.content);
        
        // Clear container and add viewport
        this.container.innerHTML = '';
        this.container.appendChild(this.viewport);
        this.container.style.position = 'relative';
        this.container.style.overflow = 'hidden';
    }

    bindEvents() {
        // Scroll event with throttling
        this.scrollListener = () => {
            if (this.animationFrame) {
                cancelAnimationFrame(this.animationFrame);
            }
            this.animationFrame = requestAnimationFrame(() => {
                this.handleScroll();
            });
        };
        this.viewport.addEventListener('scroll', this.scrollListener);
        
        // Resize observer for container size changes
        this.resizeObserver = new ResizeObserver(() => {
            this.calculateVisibleRange();
            this.render();
        });
        this.resizeObserver.observe(this.viewport);
    }

    handleScroll() {
        const newScrollTop = this.viewport.scrollTop;
        
        if (newScrollTop === this.scrollTop) return;
        
        this.scrollTop = newScrollTop;
        this.calculateVisibleRange();
        this.render();
        
        VirtualScrollConfig.debug && console.log('[VirtualScroll] Scrolled to:', this.scrollTop);
    }

    calculateVisibleRange() {
        const viewportHeight = this.viewport.clientHeight;
        const totalHeight = this.items.length * this.rowHeight;
        
        // Calculate start index
        let startIndex = Math.floor(this.scrollTop / this.rowHeight);
        startIndex = Math.max(0, startIndex - this.overscan);
        
        // Calculate end index
        let endIndex = Math.ceil((this.scrollTop + viewportHeight) / this.rowHeight);
        endIndex = Math.min(this.items.length, endIndex + this.overscan);
        
        this.startIndex = startIndex;
        this.endIndex = endIndex;
        
        VirtualScrollConfig.debug && console.log('[VirtualScroll] Range:', startIndex, '-', endIndex);
    }

    render() {
        if (!this.content) return;
        
        // Clear content
        this.content.innerHTML = '';
        
        // Render visible items
        const fragment = document.createDocumentFragment();
        const topOffset = this.startIndex * this.rowHeight;
        
        for (let i = this.startIndex; i < this.endIndex; i++) {
            const item = this.items[i];
            const itemElement = this.renderItem(item, i);
            
            if (itemElement) {
                itemElement.style.position = 'absolute';
                itemElement.style.top = `${i * this.rowHeight - topOffset}px`;
                itemElement.style.left = '0';
                itemElement.style.right = '0';
                itemElement.style.height = `${this.rowHeight}px`;
                fragment.appendChild(itemElement);
            }
        }
        
        this.content.appendChild(fragment);
        this.content.style.top = `${topOffset}px`;
        
        this.notifyListeners('rendered', { start: this.startIndex, end: this.endIndex });
    }

    // ============================================
    // PUBLIC METHODS
    // ============================================

    updateItems(newItems) {
        this.items = newItems;
        this.spacer.style.height = `${this.items.length * this.rowHeight}px`;
        this.calculateVisibleRange();
        this.render();
        
        VirtualScrollConfig.debug && console.log('[VirtualScroll] Updated items:', this.items.length);
    }

    setRowHeight(height) {
        this.rowHeight = height;
        this.spacer.style.height = `${this.items.length * this.rowHeight}px`;
        this.calculateVisibleRange();
        this.render();
    }

    scrollToIndex(index, options = { behavior: 'smooth' }) {
        if (index < 0 || index >= this.items.length) return;
        
        const scrollTop = index * this.rowHeight;
        this.viewport.scrollTo({ top: scrollTop, behavior: options.behavior });
    }

    scrollToTop(options = { behavior: 'smooth' }) {
        this.viewport.scrollTo({ top: 0, behavior: options.behavior });
    }

    scrollToBottom(options = { behavior: 'smooth' }) {
        const scrollTop = this.items.length * this.rowHeight - this.viewport.clientHeight;
        this.viewport.scrollTo({ top: scrollTop, behavior: options.behavior });
    }

    getVisibleRange() {
        return {
            start: this.startIndex,
            end: this.endIndex,
            items: this.items.slice(this.startIndex, this.endIndex)
        };
    }

    getScrollPosition() {
        return {
            top: this.viewport.scrollTop,
            maxTop: this.items.length * this.rowHeight - this.viewport.clientHeight,
            percentage: this.viewport.scrollTop / (this.items.length * this.rowHeight - this.viewport.clientHeight)
        };
    }

    // ============================================
    // DESTROY
    // ============================================

    destroy() {
        if (this.scrollListener) {
            this.viewport.removeEventListener('scroll', this.scrollListener);
        }
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
        }
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
        }
        
        this.container.innerHTML = '';
        VirtualScrollConfig.debug && console.log('[VirtualScroll] Destroyed');
    }

    // ============================================
    // STATIC METHODS
    // ============================================

    static estimateRowHeight(container) {
        const temp = document.createElement('div');
        temp.className = 'virtual-scroll-row-estimate';
        temp.textContent = 'Test row';
        container.appendChild(temp);
        const height = temp.offsetHeight;
        temp.remove();
        return height || VirtualScrollConfig.defaultRowHeight;
    }

    // ============================================
    // EVENT SYSTEM
    // ============================================

    addEventListener(event, callback) {
        if (!this.listeners) this.listeners = [];
        this.listeners.push({ event, callback });
        return () => {
            const index = this.listeners.findIndex(l => l.event === event && l.callback === callback);
            if (index !== -1) this.listeners.splice(index, 1);
        };
    }

    notifyListeners(event, data) {
        if (!this.listeners) return;
        this.listeners.forEach(listener => {
            if (listener.event === event) {
                listener.callback(data);
            }
        });
    }
}

// ============================================
// VIRTUAL LIST COMPONENT (High-level API)
// ============================================

class VirtualList {
    constructor(container, options = {}) {
        this.container = container;
        this.options = options;
        this.manager = null;
        this.items = [];
        
        this.init();
    }

    init() {
        this.manager = new VirtualScrollManager(this.container, {
            items: this.items,
            rowHeight: this.options.rowHeight,
            renderItem: (item, index) => this.renderItem(item, index),
            overscan: this.options.overscan
        });
    }

    renderItem(item, index) {
        const div = document.createElement('div');
        div.className = 'virtual-list-item';
        
        if (this.options.itemRenderer) {
            div.innerHTML = this.options.itemRenderer(item, index);
        } else {
            div.textContent = typeof item === 'string' ? item : JSON.stringify(item);
        }
        
        if (this.options.onItemClick) {
            div.addEventListener('click', (e) => {
                e.stopPropagation();
                this.options.onItemClick(item, index);
            });
        }
        
        return div;
    }

    setData(items) {
        this.items = items;
        if (this.manager) {
            this.manager.updateItems(items);
        }
        return this;
    }

    scrollToIndex(index, options = { behavior: 'smooth' }) {
        if (this.manager) {
            this.manager.scrollToIndex(index, options);
        }
        return this;
    }

    scrollToTop(options = { behavior: 'smooth' }) {
        if (this.manager) {
            this.manager.scrollToTop(options);
        }
        return this;
    }

    scrollToBottom(options = { behavior: 'smooth' }) {
        if (this.manager) {
            this.manager.scrollToBottom(options);
        }
        return this;
    }

    refresh() {
        if (this.manager) {
            this.manager.calculateVisibleRange();
            this.manager.render();
        }
        return this;
    }

    destroy() {
        if (this.manager) {
            this.manager.destroy();
            this.manager = null;
        }
        return this;
    }

    on(event, callback) {
        if (this.manager) {
            this.manager.addEventListener(event, callback);
        }
        return this;
    }
}

// ============================================
// CSS STYLES (Auto-injected)
// ============================================

const virtualScrollStyles = `
    .virtual-scroll-viewport {
        position: relative;
        width: 100%;
        height: 100%;
        overflow: auto;
        -webkit-overflow-scrolling: touch;
    }
    
    .virtual-scroll-spacer {
        position: relative;
        pointer-events: none;
    }
    
    .virtual-scroll-content {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        will-change: transform;
    }
    
    .virtual-list-item {
        position: absolute;
        left: 0;
        right: 0;
        box-sizing: border-box;
        overflow: hidden;
    }
    
    /* Loading state */
    .virtual-scroll-loading {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
        color: var(--text-secondary);
    }
    
    /* Empty state */
    .virtual-scroll-empty {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 40px;
        color: var(--text-muted);
        text-align: center;
    }
    
    /* Scrollbar styling */
    .virtual-scroll-viewport::-webkit-scrollbar {
        width: 8px;
        height: 8px;
    }
    
    .virtual-scroll-viewport::-webkit-scrollbar-track {
        background: var(--bg-tertiary);
        border-radius: 4px;
    }
    
    .virtual-scroll-viewport::-webkit-scrollbar-thumb {
        background: var(--primary);
        border-radius: 4px;
    }
    
    .virtual-scroll-viewport::-webkit-scrollbar-thumb:hover {
        background: var(--primary-dark);
    }
`;

// Inject styles
if (typeof document !== 'undefined') {
    const styleSheet = document.createElement('style');
    styleSheet.textContent = virtualScrollStyles;
    document.head.appendChild(styleSheet);
}

// ============================================
// EXPORTS
// ============================================

// Expose to window
window.VirtualScrollManager = VirtualScrollManager;
window.VirtualList = VirtualList;
window.VirtualScrollConfig = VirtualScrollConfig;

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        VirtualScrollManager,
        VirtualList,
        VirtualScrollConfig
    };
}

// ES modules export
export {
    VirtualScrollManager,
    VirtualList,
    VirtualScrollConfig
};