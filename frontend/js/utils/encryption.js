/**
 * ESTIF HOME ULTIMATE - ENCRYPTION UTILITIES
 * Client-side encryption/decryption using Web Crypto API
 * Version: 2.0.0
 * Author: Estifanos Yohannis
 */

// ============================================
// ENCRYPTION CONFIGURATION
// ============================================

const ClientEncryptionConfig = {
    algorithm: 'AES-GCM',
    keyLength: 256,
    ivLength: 12,
    iterations: 100000,
    hash: 'SHA-256',
    debug: false
};

// ============================================
// CLIENT ENCRYPTION MANAGER
// ============================================

class ClientEncryptionManager {
    constructor() {
        this.encryptionKey = null;
        this.isReady = false;
        this.init();
    }

    async init() {
        await this.loadOrGenerateKey();
        ClientEncryptionConfig.debug && console.log('[ClientEncryption] Manager initialized');
    }

    async loadOrGenerateKey() {
        try {
            const savedKey = localStorage.getItem('estif_client_encryption_key');
            if (savedKey) {
                const keyData = JSON.parse(savedKey);
                this.encryptionKey = await this.importKey(keyData);
                this.isReady = true;
                return;
            }
        } catch (error) {
            console.error('[ClientEncryption] Failed to load key:', error);
        }
        await this.generateKey();
    }

    async generateKey() {
        this.encryptionKey = await crypto.subtle.generateKey(
            { name: ClientEncryptionConfig.algorithm, length: ClientEncryptionConfig.keyLength },
            true,
            ['encrypt', 'decrypt']
        );
        
        const exportedKey = await crypto.subtle.exportKey('jwk', this.encryptionKey);
        localStorage.setItem('estif_client_encryption_key', JSON.stringify(exportedKey));
        
        this.isReady = true;
        ClientEncryptionConfig.debug && console.log('[ClientEncryption] Key generated');
    }

    async importKey(keyData) {
        return await crypto.subtle.importKey(
            'jwk',
            keyData,
            { name: ClientEncryptionConfig.algorithm },
            true,
            ['encrypt', 'decrypt']
        );
    }

    async encrypt(data) {
        if (!this.isReady) throw new Error('Encryption not ready');
        
        const encoder = new TextEncoder();
        const iv = crypto.getRandomValues(new Uint8Array(ClientEncryptionConfig.ivLength));
        
        const encrypted = await crypto.subtle.encrypt(
            { name: ClientEncryptionConfig.algorithm, iv: iv },
            this.encryptionKey,
            encoder.encode(JSON.stringify(data))
        );
        
        const result = new Uint8Array(iv.length + encrypted.byteLength);
        result.set(iv);
        result.set(new Uint8Array(encrypted), iv.length);
        
        return this.arrayBufferToBase64(result);
    }

    async decrypt(encryptedData) {
        if (!this.isReady) throw new Error('Encryption not ready');
        
        const data = this.base64ToArrayBuffer(encryptedData);
        const iv = data.slice(0, ClientEncryptionConfig.ivLength);
        const encrypted = data.slice(ClientEncryptionConfig.ivLength);
        
        const decrypted = await crypto.subtle.decrypt(
            { name: ClientEncryptionConfig.algorithm, iv: iv },
            this.encryptionKey,
            encrypted
        );
        
        const decoder = new TextDecoder();
        return JSON.parse(decoder.decode(decrypted));
    }

    async encryptString(text) {
        if (!this.isReady) throw new Error('Encryption not ready');
        
        const encoder = new TextEncoder();
        const iv = crypto.getRandomValues(new Uint8Array(ClientEncryptionConfig.ivLength));
        
        const encrypted = await crypto.subtle.encrypt(
            { name: ClientEncryptionConfig.algorithm, iv: iv },
            this.encryptionKey,
            encoder.encode(text)
        );
        
        const result = new Uint8Array(iv.length + encrypted.byteLength);
        result.set(iv);
        result.set(new Uint8Array(encrypted), iv.length);
        
        return this.arrayBufferToBase64(result);
    }

    async decryptString(encryptedText) {
        if (!this.isReady) throw new Error('Encryption not ready');
        
        const data = this.base64ToArrayBuffer(encryptedText);
        const iv = data.slice(0, ClientEncryptionConfig.ivLength);
        const encrypted = data.slice(ClientEncryptionConfig.ivLength);
        
        const decrypted = await crypto.subtle.decrypt(
            { name: ClientEncryptionConfig.algorithm, iv: iv },
            this.encryptionKey,
            encrypted
        );
        
        const decoder = new TextDecoder();
        return decoder.decode(decrypted);
    }

    async hash(data, algorithm = 'SHA-256') {
        const encoder = new TextEncoder();
        const hash = await crypto.subtle.digest(algorithm, encoder.encode(data));
        return this.arrayBufferToHex(hash);
    }

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
}

// ============================================
// CREATE SINGLETON INSTANCE
// ============================================

const clientEncryption = new ClientEncryptionManager();

// Expose globally
window.clientEncryption = clientEncryption;

export { clientEncryption, ClientEncryptionManager, ClientEncryptionConfig };