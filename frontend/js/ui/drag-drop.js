/**
 * ESTIF HOME ULTIMATE - DRAG AND DROP MODULE
 * Sortable lists, draggable elements, and drop zones
 * Version: 2.0.0
 * Author: Estifanos Yohannis
 */

// ============================================
// DRAG DROP CONFIGURATION
// ============================================

const DragDropConfig = {
    // Drag modes
    modes: {
        sortable: 'sortable',
        draggable: 'draggable',
        droppable: 'droppable'
    },
    
    // Classes
    classes: {
        dragging: 'dragging',
        dragOver: 'drag-over',
        dropZone: 'drop-zone',
        sortableItem: 'sortable-item',
        sortableContainer: 'sortable-container'
    },
    
    // Thresholds
    dragThreshold: 5, // pixels
    autoScrollSpeed: 10,
    
    // Debug
    debug: false
};

// ============================================
// DRAG DROP MANAGER
// ============================================

class DragDropManager {
    constructor() {
        this.draggedElement = null;
        this.dragStartX = 0;
        this.dragStartY = 0;
        self.isDragging = false;
        self.dropZones = new Map();
        self.sortableContainers = new Map();
        this.listeners = [];
        
        this.init();
    }

    init() {
        this.setupGlobalListeners();
        DragDropConfig.debug && console.log('[DragDrop] Manager initialized');
    }

    setupGlobalListeners() {
        document.addEventListener('dragstart', (e) => this.handleDragStart(e));
        document.addEventListener('dragend', (e) => this.handleDragEnd(e));
        document.addEventListener('dragover', (e) => this.handleDragOver(e));
        document.addEventListener('drop', (e) => this.handleDrop(e));
        
        // Touch support
        document.addEventListener('touchstart', (e) => this.handleTouchStart(e));
        document.addEventListener('touchmove', (e) => this.handleTouchMove(e));
        document.addEventListener('touchend', (e) => this.handleTouchEnd(e));
    }

    // ============================================
    // SORTABLE
    // ============================================

    makeSortable(container, options = {}) {
        container.classList.add(DragDropConfig.classes.sortableContainer);
        container.setAttribute('data-sortable', 'true');
        
        const items = container.children;
        for (let i = 0; i < items.length; i++) {
            this.makeSortableItem(items[i], options);
        }
        
        this.sortableContainers.set(container, {
            items: Array.from(items),
            options,
            onSort: options.onSort || null
        });
        
        // Observe for new items
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === 1 && container.contains(node)) {
                        this.makeSortableItem(node, options);
                    }
                });
            });
        });
        
        observer.observe(container, { childList: true });
        
        return () => observer.disconnect();
    }

    makeSortableItem(item, options) {
        if (item.hasAttribute('data-sortable-item')) return;
        
        item.setAttribute('draggable', 'true');
        item.classList.add(DragDropConfig.classes.sortableItem);
        item.setAttribute('data-sortable-item', 'true');
        
        if (options.handle) {
            const handle = item.querySelector(options.handle);
            if (handle) {
                handle.setAttribute('draggable', 'true');
                handle.style.cursor = 'grab';
            }
        } else {
            item.style.cursor = 'grab';
        }
    }

    // ============================================
    // DRAGGABLE
    // ============================================

    makeDraggable(element, options = {}) {
        element.setAttribute('draggable', 'true');
        element.classList.add('draggable');
        
        element.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', element.id || '');
            e.dataTransfer.effectAllowed = 'move';
            
            if (options.onDragStart) options.onDragStart(element);
        });
        
        element.addEventListener('dragend', (e) => {
            if (options.onDragEnd) options.onDragEnd(element);
        });
    }

    // ============================================
    // DROPPABLE
    // ============================================

    makeDroppable(element, options = {}) {
        element.classList.add(DragDropConfig.classes.dropZone);
        this.dropZones.set(element, options);
        
        element.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            element.classList.add(DragDropConfig.classes.dragOver);
        });
        
        element.addEventListener('dragleave', () => {
            element.classList.remove(DragDropConfig.classes.dragOver);
        });
        
        element.addEventListener('drop', (e) => {
            e.preventDefault();
            element.classList.remove(DragDropConfig.classes.dragOver);
            
            const data = e.dataTransfer.getData('text/plain');
            const draggedElement = document.getElementById(data);
            
            if (options.onDrop) options.onDrop(draggedElement, element);
        });
    }

    // ============================================
    // DRAG HANDLERS
    // ============================================

    handleDragStart(e) {
        const target = e.target.closest('[draggable="true"]');
        if (!target) return;
        
        this.draggedElement = target;
        target.classList.add(DragDropConfig.classes.dragging);
        
        e.dataTransfer.setData('text/plain', target.id || '');
        e.dataTransfer.effectAllowed = 'move';
    }

    handleDragEnd(e) {
        if (this.draggedElement) {
            this.draggedElement.classList.remove(DragDropConfig.classes.dragging);
            this.draggedElement = null;
        }
        
        document.querySelectorAll(`.${DragDropConfig.classes.dragOver}`).forEach(el => {
            el.classList.remove(DragDropConfig.classes.dragOver);
        });
    }

    handleDragOver(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    }

    handleDrop(e) {
        e.preventDefault();
        
        const target = e.target.closest(`.${DragDropConfig.classes.sortableContainer}, .${DragDropConfig.classes.dropZone}`);
        if (!target) return;
        
        const draggedId = e.dataTransfer.getData('text/plain');
        const draggedElement = document.getElementById(draggedId) || this.draggedElement;
        
        if (!draggedElement) return;
        
        // Handle sortable containers
        if (target.classList.contains(DragDropConfig.classes.sortableContainer)) {
            this.handleSortableDrop(draggedElement, target, e);
        }
        
        // Handle drop zones
        const dropZone = this.dropZones.get(target);
        if (dropZone && dropZone.onDrop) {
            dropZone.onDrop(draggedElement, target);
        }
    }

    handleSortableDrop(draggedElement, container, e) {
        const items = Array.from(container.children);
        let insertIndex = items.length;
        
        for (let i = 0; i < items.length; i++) {
            const rect = items[i].getBoundingClientRect();
            const mouseY = e.clientY;
            const middle = rect.top + rect.height / 2;
            
            if (mouseY < middle) {
                insertIndex = i;
                break;
            }
        }
        
        if (draggedElement.parentElement === container) {
            const currentIndex = items.indexOf(draggedElement);
            if (currentIndex === insertIndex || (currentIndex + 1 === insertIndex)) {
                return;
            }
        }
        
        // Move element
        if (draggedElement.parentElement !== container) {
            draggedElement.remove();
        } else {
            draggedElement.remove();
        }
        
        if (insertIndex === items.length) {
            container.appendChild(draggedElement);
        } else {
            container.insertBefore(draggedElement, items[insertIndex]);
        }
        
        // Trigger sort event
        const sortableData = this.sortableContainers.get(container);
        if (sortableData && sortableData.onSort) {
            const newOrder = Array.from(container.children).map((child, idx) => ({
                id: child.id || child.getAttribute('data-id'),
                index: idx,
                element: child
            }));
            sortableData.onSort(newOrder);
        }
    }

    // ============================================
    // TOUCH SUPPORT
    // ============================================

    handleTouchStart(e) {
        const target = e.target.closest('[draggable="true"]');
        if (!target) return;
        
        e.preventDefault();
        
        this.draggedElement = target;
        this.dragStartX = e.touches[0].clientX;
        this.dragStartY = e.touches[0].clientY;
        
        target.classList.add(DragDropConfig.classes.dragging);
        
        // Clone for visual feedback
        this.clone = target.cloneNode(true);
        this.clone.style.position = 'fixed';
        this.clone.style.left = `${this.dragStartX}px`;
        this.clone.style.top = `${this.dragStartY}px`;
        this.clone.style.width = `${target.offsetWidth}px`;
        this.clone.style.opacity = '0.6';
        this.clone.style.pointerEvents = 'none';
        this.clone.style.zIndex = '9999';
        document.body.appendChild(this.clone);
        
        this.isDragging = true;
    }

    handleTouchMove(e) {
        if (!this.isDragging) return;
        
        e.preventDefault();
        
        const x = e.touches[0].clientX;
        const y = e.touches[0].clientY;
        
        if (this.clone) {
            this.clone.style.left = `${x - this.dragStartX + this.draggedElement.offsetLeft}px`;
            this.clone.style.top = `${y - this.dragStartY + this.draggedElement.offsetTop}px`;
        }
        
        // Find drop target
        const elementUnderCursor = document.elementsFromPoint(x, y)[0];
        const dropTarget = elementUnderCursor.closest(`.${DragDropConfig.classes.sortableContainer}`);
        
        if (dropTarget) {
            dropTarget.classList.add(DragDropConfig.classes.dragOver);
        }
    }

    handleTouchEnd(e) {
        if (!this.isDragging) return;
        
        e.preventDefault();
        
        const x = e.changedTouches[0].clientX;
        const y = e.changedTouches[0].clientY;
        const elementUnderCursor = document.elementsFromPoint(x, y)[0];
        const dropTarget = elementUnderCursor.closest(`.${DragDropConfig.classes.sortableContainer}`);
        
        if (dropTarget && this.draggedElement) {
            const mouseEvent = new MouseEvent('drop', {
                clientX: x,
                clientY: y,
                bubbles: true
            });
            dropTarget.dispatchEvent(mouseEvent);
        }
        
        if (this.clone) {
            this.clone.remove();
            this.clone = null;
        }
        
        if (this.draggedElement) {
            this.draggedElement.classList.remove(DragDropConfig.classes.dragging);
            this.draggedElement = null;
        }
        
        document.querySelectorAll(`.${DragDropConfig.classes.dragOver}`).forEach(el => {
            el.classList.remove(DragDropConfig.classes.dragOver);
        });
        
        this.isDragging = false;
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

const dragDropStyles = `
    .draggable {
        cursor: grab;
        user-select: none;
    }
    
    .draggable:active {
        cursor: grabbing;
    }
    
    .dragging {
        opacity: 0.5;
        cursor: grabbing !important;
    }
    
    .drag-over {
        background: var(--primary-soft);
        border: 2px dashed var(--primary);
    }
    
    .sortable-container {
        min-height: 50px;
    }
    
    .sortable-item {
        transition: transform 0.2s ease;
    }
    
    .sortable-item:active {
        cursor: grabbing;
    }
`;

// Inject styles
if (typeof document !== 'undefined') {
    const styleSheet = document.createElement('style');
    styleSheet.textContent = dragDropStyles;
    document.head.appendChild(styleSheet);
}

// ============================================
// CREATE SINGLETON INSTANCE
// ============================================

const dragDrop = new DragDropManager();

// Expose globally
window.dragDrop = dragDrop;

export { dragDrop, DragDropManager, DragDropConfig };