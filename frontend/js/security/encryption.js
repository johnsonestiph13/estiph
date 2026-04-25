/**
 * ESTIF HOME ULTIMATE - ENCRYPTION MODULE
 * Client-side encryption for sensitive data using Web Crypto API
 * Version: 2.0.0
 * Author: Estifanos Yohannis
 */

// ============================================
// ENCRYPTION CONFIGURATION
// ============================================

const EncryptionConfig = {
    // Algorithm settings
    algorithm: 'AES-GCM',
    keyLength: 256,
    ivLength: 12,
    
    // PBKDF2 settings
    iterations: 100000,
    hash: 'SHA-256',
    saltLength: 16,
    
    // Storage
    storageKey: 'estif_encryption_key',
    
    // Debug
    debug: false
};

// ============================================
// ENCRYPTION MANAGER
// ============================================

class EncryptionManager {
    constructor() {
        this.encryptionKey = null;
        this.isReady = false;
        this.init();
    }

    async init() {
        await this.loadOrGenerateKey();
        EncryptionConfig.debug && console.log('[Encryption] Manager initialized');
    }

    async loadOrGenerateKey() {
        try {
            // Try to load existing key
            const savedKey = localStorage.getItem(EncryptionConfig.storageKey);
            if (savedKey) {
                const keyData = JSON.parse(savedKey);
                this.encryptionKey = await this.importKey(keyData);
                this.isReady = true;
                EncryptionConfig.debug && console.log('[Encryption] Key loaded');
                return;
            }
        } catch (error) {
            console.error('[Encryption] Failed to load key:', error);
        }
        
        // Generate new key
        await this.generateKey();
    }

    async generateKey(password = null) {
        try {
            if (password) {
                // Derive key from password
                this.encryptionKey = await this.deriveKeyFromPassword(password);
            } else {
                // Generate random key
                this.encryptionKey = await crypto.subtle.generateKey(
                    { name: EncryptionConfig.algorithm, length: EncryptionConfig.keyLength },
                    true,
                    ['encrypt', 'decrypt']
                );
            }
            
            // Export and store key
            const exportedKey = await crypto.subtle.exportKey('jwk', this.encryptionKey);
            localStorage.setItem(EncryptionConfig.storageKey, JSON.stringify(exportedKey));
            
            this.isReady = true;
            EncryptionConfig.debug && console.log('[Encryption] Key generated');
            return true;
        } catch (error) {
            console.error('[Encryption] Failed to generate key:', error);
            return false;
        }
    }

    async deriveKeyFromPassword(password) {
        const encoder = new TextEncoder();
        const salt = crypto.getRandomValues(new Uint8Array(EncryptionConfig.saltLength));
        
        const baseKey = await crypto.subtle.importKey(
            'raw',
            encoder.encode(password),
            'PBKDF2',
            false,
            ['deriveKey']
        );
        
        return await crypto.subtle.deriveKey(
            {
                name: 'PBKDF2',
                salt: salt,
                iterations: EncryptionConfig.iterations,
                hash: EncryptionConfig.hash
            },
            baseKey,
            { name: EncryptionConfig.algorithm, length: EncryptionConfig.keyLength },
            true,
            ['encrypt', 'decrypt']
        );
    }

    async importKey(keyData) {
        return await crypto.subtle.importKey(
            'jwk',
            keyData,
            { name: EncryptionConfig.algorithm },
            true,
            ['encrypt', 'decrypt']
        );
    }

    // ============================================
    // ENCRYPTION METHODS
    // ============================================

    async encrypt(data) {
        if (!this.isReady) {
            throw new Error('Encryption not ready');
        }
        
        const encoder = new TextEncoder();
        const iv = crypto.getRandomValues(new Uint8Array(EncryptionConfig.ivLength));
        
        const encrypted = await crypto.subtle.encrypt(
            { name: EncryptionConfig.algorithm, iv: iv },
            this.encryptionKey,
            encoder.encode(JSON.stringify(data))
        );
        
        // Combine IV and encrypted data
        const result = new Uint8Array(iv.length + encrypted.byteLength);
        result.set(iv);
        result.set(new Uint8Array(encrypted), iv.length);
        
        return this.arrayBufferToBase64(result);
    }

    async decrypt(encryptedData) {
        if (!this.isReady) {
            throw new Error('Encryption not ready');
        }
        
        const data = this.base64ToArrayBuffer(encryptedData);
        const iv = data.slice(0, EncryptionConfig.ivLength);
        const encrypted = data.slice(EncryptionConfig.ivLength);
        
        const decrypted = await crypto.subtle.decrypt(
            { name: EncryptionConfig.algorithm, iv: iv },
            this.encryptionKey,
            encrypted
        );
        
        const decoder = new TextDecoder();
        return JSON.parse(decoder.decode(decrypted));
    }

    async encryptString(text) {
        if (!this.isReady) {
            throw new Error('Encryption not ready');
        }
        
        const encoder = new TextEncoder();
        const iv = crypto.getRandomValues(new Uint8Array(EncryptionConfig.ivLength));
        
        const encrypted = await crypto.subtle.encrypt(
            { name: EncryptionConfig.algorithm, iv: iv },
            this.encryptionKey,
            encoder.encode(text)
        );
        
        const result = new Uint8Array(iv.length + encrypted.byteLength);
        result.set(iv);
        result.set(new Uint8Array(encrypted), iv.length);
        
        return this.arrayBufferToBase64(result);
    }

    async decryptString(encryptedText) {
        if (!this.isReady) {
            throw new Error('Encryption not ready');
        }
        
        const data = this.base64ToArrayBuffer(encryptedText);
        const iv = data.slice(0, EncryptionConfig.ivLength);
        const encrypted = data.slice(EncryptionConfig.ivLength);
        
        const decrypted = await crypto.subtle.decrypt(
            { name: EncryptionConfig.algorithm, iv: iv },
            this.encryptionKey,
            encrypted
        );
        
        const decoder = new TextDecoder();
        return decoder.decode(decrypted);
    }

    // ============================================
    // HASHING
    // ============================================

    async hash(data, algorithm = 'SHA-256') {
        const encoder = new TextEncoder();
        const hash = await crypto.subtle.digest(algorithm, encoder.encode(data));
        return this.arrayBufferToHex(hash);
    }

    async hashPassword(password) {
        const salt = crypto.getRandomValues(new Uint8Array(16));
        const encoder = new TextEncoder();
        
        const baseKey = await crypto.subtle.importKey(
            'raw',
            encoder.encode(password),
            'PBKDF2',
            false,
            ['deriveBits']
        );
        
        const derivedBits = await crypto.subtle.deriveBits(
            {
                name: 'PBKDF2',
                salt: salt,
                iterations: EncryptionConfig.iterations,
                hash: EncryptionConfig.hash
            },
            baseKey,
            EncryptionConfig.keyLength
        );
        
        const hashHex = this.arrayBufferToHex(derivedBits);
        const saltHex = this.arrayBufferToHex(salt);
        
        return `${saltHex}:${hashHex}`;
    }

    async verifyPassword(password, storedHash) {
        const [saltHex, originalHash] = storedHash.split(':');
        const salt = this.hexToArrayBuffer(saltHex);
        const encoder = new TextEncoder();
        
        const baseKey = await crypto.subtle.importKey(
            'raw',
            encoder.encode(password),
            'PBKDF2',
            false,
            ['deriveBits']
        );
        
        const derivedBits = await crypto.subtle.deriveBits(
            {
                name: 'PBKDF2',
                salt: salt,
                iterations: EncryptionConfig.iterations,
                hash: EncryptionConfig.hash
            },
            baseKey,
            EncryptionConfig.keyLength
        );
        
        const hashHex = this.arrayBufferToHex(derivedBits);
        return hashHex === originalHash;
    }

    // ============================================
    // UTILITY METHODS
    // ============================================

    arrayBufferToBase64(buffer) {
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    }

    base64ToArrayBuffer(base64) {
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes.buffer;
    }

    arrayBufferToHex(buffer) {
        const bytes = new Uint8Array(buffer);
        let hex = '';
        for (let i = 0; i < bytes.length; i++) {
            hex += bytes[i].toString(16).padStart(2, '0');
        }
        return hex;
    }

    hexToArrayBuffer(hex) {
        const bytes = new Uint8Array(hex.length / 2);
        for (let i = 0; i < hex.length; i += 2) {
            bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
        }
        return bytes.buffer;
    }

    generateRandomString(length = 32) {
        const array = new Uint8Array(length);
        crypto.getRandomValues(array);
        return this.arrayBufferToBase64(array).substring(0, length);
    }

    // ============================================
    // KEY MANAGEMENT
    // ============================================

    async rotateKey() {
        const oldKey = this.encryptionKey;
        await this.generateKey();
        
        // Re-encrypt data with new key (implement based on needs)
        this.notifyListeners('key_rotated');
        
        return true;
    }

    async exportPublicKey() {
        if (!this.encryptionKey) return null;
        
        const exported = await crypto.subtle.exportKey('spki', this.encryptionKey);
        return this.arrayBufferToBase64(exported);
    }

    clearKey() {
        this.encryptionKey = null;
        this.isReady = false;
        localStorage.removeItem(EncryptionConfig.storageKey);
        this.notifyListeners('key_cleared');
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
// CREATE SINGLETON INSTANCE
// ============================================

const encryptionManager = new EncryptionManager();

// Exports
window.encryptionManager = encryptionManager;
window.EncryptionManager = EncryptionManager;

export { encryptionManager, EncryptionManager, EncryptionConfig };