/**
 * ESTIF HOME ULTIMATE - READ RECEIPTS MODULE
 * Track message read status, seen receipts, and delivery confirmation
 * Version: 2.0.0
 * Author: Estifanos Yohannis
 */

// ============================================
// READ RECEIPTS CONFIGURATION
// ============================================

const ReadReceiptsConfig = {
    // Settings
    trackReadReceipts: true,
    trackDeliveryReceipts: true,
    receiptTimeout: 30000, // ms to wait for receipt
    
    // Storage
    storageKey: 'estif_read_receipts',
    
    // Debug
    debug: false
};

// ============================================
// READ RECEIPTS MANAGER
// ============================================

class ReadReceiptsManager {
    constructor(wsClient) {
        this.wsClient = wsClient;
        this.receipts = new Map(); // messageId -> { status, timestamp, readBy }
        this.pendingReceipts = new Map(); // messageId -> resolve/reject
        this.listeners = [];
        
        this.init();
    }

    init() {
        this.loadReceipts();
        this.setupWebSocketHandlers();
        ReadReceiptsConfig.debug && console.log('[ReadReceipts] Manager initialized');
    }

    loadReceipts() {
        try {
            const saved = localStorage.getItem(ReadReceiptsConfig.storageKey);
            if (saved) {
                const receipts = JSON.parse(saved);
                for (const [messageId, receipt] of Object.entries(receipts)) {
                    this.receipts.set(messageId, receipt);
                }
            }
        } catch (error) {
            console.error('[ReadReceipts] Failed to load receipts:', error);
        }
    }

    saveReceipts() {
        try {
            const receipts = Object.fromEntries(this.receipts);
            localStorage.setItem(ReadReceiptsConfig.storageKey, JSON.stringify(receipts));
        } catch (error) {
            console.error('[ReadReceipts] Failed to save receipts:', error);
        }
    }

    // ============================================
    // RECEIPT TRACKING
    // ============================================

    trackMessage(messageId, recipientId) {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                this.pendingReceipts.delete(messageId);
                reject(new Error('Receipt timeout'));
            }, ReadReceiptsConfig.receiptTimeout);
            
            this.pendingReceipts.set(messageId, { resolve, reject, timeout, recipientId });
            
            // Send message with receipt tracking
            if (this.wsClient && this.wsClient.isConnected()) {
                this.wsClient.send('message_with_receipt', {
                    messageId,
                    recipientId,
                    timestamp: Date.now()
                });
            }
        });
    }

    markAsDelivered(messageId, recipientId) {
        const receipt = this.receipts.get(messageId) || { status: 'pending', timestamp: Date.now() };
        receipt.status = 'delivered';
        receipt.deliveredAt = Date.now();
        receipt.deliveredTo = recipientId;
        this.receipts.set(messageId, receipt);
        this.saveReceipts();
        
        // Resolve pending promise
        const pending = this.pendingReceipts.get(messageId);
        if (pending && pending.recipientId === recipientId) {
            clearTimeout(pending.timeout);
            pending.resolve({ status: 'delivered' });
            this.pendingReceipts.delete(messageId);
        }
        
        this.notifyListeners('delivered', { messageId, recipientId });
    }

    markAsRead(messageId, readerId, readerName) {
        const receipt = this.receipts.get(messageId) || { status: 'delivered', timestamp: Date.now() };
        receipt.status = 'read';
        receipt.readAt = Date.now();
        receipt.readBy = readerId;
        receipt.readByName = readerName;
        this.receipts.set(messageId, receipt);
        this.saveReceipts();
        
        this.notifyListeners('read', { messageId, readerId, readerName });
    }

    // ============================================
    // QUERIES
    // ============================================

    getReceiptStatus(messageId) {
        const receipt = this.receipts.get(messageId);
        return receipt?.status || 'pending';
    }

    isDelivered(messageId) {
        const status = this.getReceiptStatus(messageId);
        return status === 'delivered' || status === 'read';
    }

    isRead(messageId) {
        return this.getReceiptStatus(messageId) === 'read';
    }

    getReadBy(messageId) {
        const receipt = this.receipts.get(messageId);
        return receipt?.readBy ? { id: receipt.readBy, name: receipt.readByName } : null;
    }

    getReadTimestamp(messageId) {
        const receipt = this.receipts.get(messageId);
        return receipt?.readAt || null;
    }

    // ============================================
    // WEB SOCKET HANDLERS
    // ============================================

    setupWebSocketHandlers() {
        if (!this.wsClient) return;
        
        this.wsClient.on('delivery_receipt', (data) => {
            this.markAsDelivered(data.messageId, data.recipientId);
        });
        
        this.wsClient.on('read_receipt', (data) => {
            this.markAsRead(data.messageId, data.readerId, data.readerName);
        });
    }

    // ============================================
    // MANUAL RECEIPTS
    // ============================================

    sendDeliveryReceipt(messageId, recipientId) {
        if (!this.wsClient || !this.wsClient.isConnected()) return;
        
        this.wsClient.send('delivery_receipt', {
            messageId,
            recipientId,
            timestamp: Date.now()
        });
    }

    sendReadReceipt(messageId, readerId, readerName) {
        if (!this.wsClient || !this.wsClient.isConnected()) return;
        
        this.wsClient.send('read_receipt', {
            messageId,
            readerId,
            readerName,
            timestamp: Date.now()
        });
    }

    // ============================================
    // CLEANUP
    // ============================================

    clearOldReceipts(maxAge = 7 * 24 * 60 * 60 * 1000) { // 7 days
        const now = Date.now();
        for (const [messageId, receipt] of this.receipts.entries()) {
            if (now - receipt.timestamp > maxAge) {
                this.receipts.delete(messageId);
            }
        }
        this.saveReceipts();
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
// READ RECEIPTS UI COMPONENT
// ============================================

class ReadReceiptsUI {
    constructor(receiptsManager) {
        this.receiptsManager = receiptsManager;
        this.init();
    }

    init() {
        ReadReceiptsConfig.debug && console.log('[ReadReceiptsUI] Initialized');
    }

    getReceiptIcon(messageId) {
        const isRead = this.receiptsManager.isRead(messageId);
        const isDelivered = this.receiptsManager.isDelivered(messageId);
        
        if (isRead) {
            return '<i class="fas fa-check-double" style="color: #06d6a0;"></i>';
        }
        if (isDelivered) {
            return '<i class="fas fa-check-double" style="color: #6c757d;"></i>';
        }
        return '<i class="fas fa-check" style="color: #6c757d;"></i>';
    }

    getReceiptTooltip(messageId) {
        const isRead = this.receiptsManager.isRead(messageId);
        const readBy = this.receiptsManager.getReadBy(messageId);
        const readAt = this.receiptsManager.getReadTimestamp(messageId);
        
        if (isRead && readBy) {
            return `Read by ${readBy.name} at ${new Date(readAt).toLocaleTimeString()}`;
        }
        return 'Delivered';
    }
}

// ============================================
// CREATE SINGLETON INSTANCES
// ============================================

let readReceiptsManager = null;
let readReceiptsUI = null;

const initReadReceipts = (wsClient) => {
    readReceiptsManager = new ReadReceiptsManager(wsClient);
    readReceiptsUI = new ReadReceiptsUI(readReceiptsManager);
    return { readReceiptsManager, readReceiptsUI };
};

// Exports
window.ReadReceiptsManager = ReadReceiptsManager;
window.initReadReceipts = initReadReceipts;

export { readReceiptsManager, readReceiptsUI, ReadReceiptsManager, ReadReceiptsConfig, initReadReceipts };