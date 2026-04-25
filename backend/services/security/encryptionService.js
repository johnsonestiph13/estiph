/**
 * ESTIF HOME ULTIMATE - ENCRYPTION SERVICE
 * AES-256-GCM encryption for sensitive data
 * Version: 2.0.0
 */

const crypto = require('crypto');

class EncryptionService {
    constructor() {
        this.algorithm = 'aes-256-gcm';
        this.keyLength = 32;
        this.ivLength = 12;
        this.authTagLength = 16;
        this.encoding = 'hex';
        this.masterKey = null;
        this.init();
    }

    init() {
        if (process.env.ENCRYPTION_KEY) {
            this.masterKey = Buffer.from(process.env.ENCRYPTION_KEY, this.encoding);
        } else {
            this.masterKey = crypto.randomBytes(this.keyLength);
            console.warn('⚠️ No ENCRYPTION_KEY set, using temporary key');
        }
    }

    encrypt(text) {
        if (!text) return null;
        
        const iv = crypto.randomBytes(this.ivLength);
        const cipher = crypto.createCipheriv(this.algorithm, this.masterKey, iv);
        
        let encrypted = cipher.update(text, 'utf8', this.encoding);
        encrypted += cipher.final(this.encoding);
        
        const authTag = cipher.getAuthTag();
        
        return {
            encrypted,
            iv: iv.toString(this.encoding),
            authTag: authTag.toString(this.encoding)
        };
    }

    decrypt(encryptedData) {
        if (!encryptedData || !encryptedData.encrypted) return null;
        
        const iv = Buffer.from(encryptedData.iv, this.encoding);
        const authTag = Buffer.from(encryptedData.authTag, this.encoding);
        const decipher = crypto.createDecipheriv(this.algorithm, this.masterKey, iv);
        
        decipher.setAuthTag(authTag);
        
        let decrypted = decipher.update(encryptedData.encrypted, this.encoding, 'utf8');
        decrypted += decipher.final('utf8');
        
        return decrypted;
    }

    encryptObject(obj) {
        return this.encrypt(JSON.stringify(obj));
    }

    decryptObject(encryptedData) {
        const decrypted = this.decrypt(encryptedData);
        return decrypted ? JSON.parse(decrypted) : null;
    }

    hashData(data, algorithm = 'sha256') {
        return crypto.createHash(algorithm).update(data).digest(this.encoding);
    }

    generateSecureToken(length = 32) {
        return crypto.randomBytes(length).toString(this.encoding);
    }

    rotateKey() {
        const newKey = crypto.randomBytes(this.keyLength);
        this.masterKey = newKey;
        return newKey.toString(this.encoding);
    }
}

module.exports = new EncryptionService();