/**
 * ESTIF HOME ULTIMATE - CRYPTO WORKER
 * Cryptographic operations in background thread
 * Version: 2.0.0
 * Author: Estifanos Yohannis
 */

(function() {
    'use strict';

    // ============================================
    // CONFIGURATION
    // ============================================
    
    const CryptoWorkerConfig = {
        algorithm: 'AES-GCM',
        keyLength: 256,
        ivLength: 12,
        iterations: 100000,
        debug: false
    };

    let encryptionKey = null;

    // ============================================
    // INITIALIZATION
    // ============================================
    
    self.addEventListener('message', async (event) => {
        const { type, data } = event.data;
        
        switch (type) {
            case 'init':
                await initialize(data);
                break;
            case 'encrypt':
                await encrypt(data);
                break;
            case 'decrypt':
                await decrypt(data);
                break;
            case 'hash':
                await hash(data);
                break;
            case 'generateKey':
                await generateKey(data);
                break;
            case 'deriveKey':
                await deriveKey(data);
                break;
            case 'sign':
                await sign(data);
                break;
            case 'verify':
                await verify(data);
                break;
        }
    });

    async function initialize(data) {
        if (data.key) {
            encryptionKey = await importKey(data.key);
        } else if (data.password) {
            encryptionKey = await deriveKeyFromPassword(data.password, data.salt);
        } else {
            encryptionKey = await generateCryptoKey();
        }
        
        log('Crypto worker initialized');
        self.postMessage({ type: 'ready' });
    }

    // ============================================
    // ENCRYPTION/DECRYPTION
    // ============================================
    
    async function encrypt(data) {
        try {
            const encoder = new TextEncoder();
            const iv = crypto.getRandomValues(new Uint8Array(CryptoWorkerConfig.ivLength));
            const key = encryptionKey || await importKey(data.key);
            
            const encrypted = await crypto.subtle.encrypt(
                { name: CryptoWorkerConfig.algorithm, iv: iv },
                key,
                encoder.encode(JSON.stringify(data.value))
            );
            
            const result = new Uint8Array(iv.length + encrypted.byteLength);
            result.set(iv);
            result.set(new Uint8Array(encrypted), iv.length);
            
            self.postMessage({ 
                type: 'encrypt_success', 
                data: { id: data.id, result: arrayBufferToBase64(result) } 
            });
        } catch (error) {
            console.error('[CryptoWorker] Encrypt failed:', error);
            self.postMessage({ 
                type: 'encrypt_error', 
                data: { id: data.id, error: error.message } 
            });
        }
    }

    async function decrypt(data) {
        try {
            const encrypted = base64ToArrayBuffer(data.value);
            const iv = encrypted.slice(0, CryptoWorkerConfig.ivLength);
            const ciphertext = encrypted.slice(CryptoWorkerConfig.ivLength);
            const key = encryptionKey || await importKey(data.key);
            
            const decrypted = await crypto.subtle.decrypt(
                { name: CryptoWorkerConfig.algorithm, iv: iv },
                key,
                ciphertext
            );
            
            const decoder = new TextDecoder();
            const result = JSON.parse(decoder.decode(decrypted));
            
            self.postMessage({ 
                type: 'decrypt_success', 
                data: { id: data.id, result } 
            });
        } catch (error) {
            console.error('[CryptoWorker] Decrypt failed:', error);
            self.postMessage({ 
                type: 'decrypt_error', 
                data: { id: data.id, error: error.message } 
            });
        }
    }

    // ============================================
    // HASHING
    // ============================================
    
    async function hash(data) {
        try {
            const encoder = new TextEncoder();
            const hash = await crypto.subtle.digest(data.algorithm || 'SHA-256', encoder.encode(data.value));
            const result = arrayBufferToHex(hash);
            
            self.postMessage({ 
                type: 'hash_success', 
                data: { id: data.id, result } 
            });
        } catch (error) {
            console.error('[CryptoWorker] Hash failed:', error);
            self.postMessage({ 
                type: 'hash_error', 
                data: { id: data.id, error: error.message } 
            });
        }
    }

    // ============================================
    // KEY MANAGEMENT
    // ============================================
    
    async function generateKey(data) {
        try {
            const key = await crypto.subtle.generateKey(
                { name: CryptoWorkerConfig.algorithm, length: CryptoWorkerConfig.keyLength },
                true,
                ['encrypt', 'decrypt']
            );
            
            const exported = await crypto.subtle.exportKey('jwk', key);
            
            self.postMessage({ 
                type: 'generateKey_success', 
                data: { id: data.id, key: exported } 
            });
        } catch (error) {
            console.error('[CryptoWorker] Generate key failed:', error);
            self.postMessage({ 
                type: 'generateKey_error', 
                data: { id: data.id, error: error.message } 
            });
        }
    }

    async function deriveKey(data) {
        try {
            const encoder = new TextEncoder();
            const baseKey = await crypto.subtle.importKey(
                'raw',
                encoder.encode(data.password),
                'PBKDF2',
                false,
                ['deriveKey']
            );
            
            const salt = data.salt ? base64ToArrayBuffer(data.salt) : crypto.getRandomValues(new Uint8Array(16));
            const key = await crypto.subtle.deriveKey(
                {
                    name: 'PBKDF2',
                    salt: salt,
                    iterations: CryptoWorkerConfig.iterations,
                    hash: 'SHA-256'
                },
                baseKey,
                { name: CryptoWorkerConfig.algorithm, length: CryptoWorkerConfig.keyLength },
                true,
                ['encrypt', 'decrypt']
            );
            
            const exported = await crypto.subtle.exportKey('jwk', key);
            
            self.postMessage({ 
                type: 'deriveKey_success', 
                data: { id: data.id, key: exported, salt: arrayBufferToBase64(salt) } 
            });
        } catch (error) {
            console.error('[CryptoWorker] Derive key failed:', error);
            self.postMessage({ 
                type: 'deriveKey_error', 
                data: { id: data.id, error: error.message } 
            });
        }
    }

    async function importKey(keyData) {
        return await crypto.subtle.importKey(
            'jwk',
            keyData,
            { name: CryptoWorkerConfig.algorithm },
            true,
            ['encrypt', 'decrypt']
        );
    }

    async function generateCryptoKey() {
        return await crypto.subtle.generateKey(
            { name: CryptoWorkerConfig.algorithm, length: CryptoWorkerConfig.keyLength },
            true,
            ['encrypt', 'decrypt']
        );
    }

    async function deriveKeyFromPassword(password, salt) {
        const encoder = new TextEncoder();
        const baseKey = await crypto.subtle.importKey(
            'raw',
            encoder.encode(password),
            'PBKDF2',
            false,
            ['deriveKey']
        );
        
        const saltBuffer = salt ? base64ToArrayBuffer(salt) : crypto.getRandomValues(new Uint8Array(16));
        
        return await crypto.subtle.deriveKey(
            {
                name: 'PBKDF2',
                salt: saltBuffer,
                iterations: CryptoWorkerConfig.iterations,
                hash: 'SHA-256'
            },
            baseKey,
            { name: CryptoWorkerConfig.algorithm, length: CryptoWorkerConfig.keyLength },
            true,
            ['encrypt', 'decrypt']
        );
    }

    // ============================================
    // SIGNATURE
    // ============================================
    
    async function sign(data) {
        try {
            const encoder = new TextEncoder();
            const privateKey = await importPrivateKey(data.privateKey);
            
            const signature = await crypto.subtle.sign(
                { name: 'RSASSA-PKCS1-v1_5' },
                privateKey,
                encoder.encode(data.value)
            );
            
            self.postMessage({ 
                type: 'sign_success', 
                data: { id: data.id, signature: arrayBufferToBase64(signature) } 
            });
        } catch (error) {
            console.error('[CryptoWorker] Sign failed:', error);
            self.postMessage({ 
                type: 'sign_error', 
                data: { id: data.id, error: error.message } 
            });
        }
    }

    async function verify(data) {
        try {
            const encoder = new TextEncoder();
            const publicKey = await importPublicKey(data.publicKey);
            const signature = base64ToArrayBuffer(data.signature);
            
            const isValid = await crypto.subtle.verify(
                { name: 'RSASSA-PKCS1-v1_5' },
                publicKey,
                signature,
                encoder.encode(data.value)
            );
            
            self.postMessage({ 
                type: 'verify_success', 
                data: { id: data.id, isValid } 
            });
        } catch (error) {
            console.error('[CryptoWorker] Verify failed:', error);
            self.postMessage({ 
                type: 'verify_error', 
                data: { id: data.id, error: error.message } 
            });
        }
    }

    async function importPrivateKey(keyData) {
        return await crypto.subtle.importKey(
            'jwk',
            keyData,
            { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
            false,
            ['sign']
        );
    }

    async function importPublicKey(keyData) {
        return await crypto.subtle.importKey(
            'jwk',
            keyData,
            { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
            false,
            ['verify']
        );
    }

    // ============================================
    // UTILITY
    // ============================================
    
    function arrayBufferToBase64(buffer) {
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    }

    function base64ToArrayBuffer(base64) {
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes.buffer;
    }

    function arrayBufferToHex(buffer) {
        const bytes = new Uint8Array(buffer);
        let hex = '';
        for (let i = 0; i < bytes.length; i++) {
            hex += bytes[i].toString(16).padStart(2, '0');
        }
        return hex;
    }

    function log(message) {
        if (CryptoWorkerConfig.debug) {
            console.log(`[CryptoWorker] ${message}`);
        }
    }

    log('Crypto worker loaded');
})();