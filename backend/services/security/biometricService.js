/**
 * ESTIF HOME ULTIMATE - BIOMETRIC SERVICE
 * Biometric authentication support for fingerprint and face ID
 * Version: 2.0.0
 */

const crypto = require('crypto');

class BiometricService {
    constructor() {
        this.registeredDevices = new Map();
    }

    generateChallenge() {
        return crypto.randomBytes(32).toString('base64');
    }

    verifySignature(challenge, signature, publicKey) {
        try {
            const verify = crypto.createVerify('SHA256');
            verify.update(challenge);
            verify.end();
            return verify.verify(publicKey, signature, 'base64');
        } catch (error) {
            return false;
        }
    }

    registerDevice(userId, deviceId, deviceName, publicKey) {
        if (!this.registeredDevices.has(userId)) {
            this.registeredDevices.set(userId, new Map());
        }
        
        const userDevices = this.registeredDevices.get(userId);
        userDevices.set(deviceId, {
            deviceName,
            publicKey,
            registeredAt: Date.now(),
            lastUsed: null
        });
        
        return true;
    }

    authenticateDevice(userId, deviceId, challenge, signature) {
        const userDevices = this.registeredDevices.get(userId);
        if (!userDevices) return false;
        
        const device = userDevices.get(deviceId);
        if (!device) return false;
        
        const isValid = this.verifySignature(challenge, signature, device.publicKey);
        
        if (isValid) {
            device.lastUsed = Date.now();
            userDevices.set(deviceId, device);
        }
        
        return isValid;
    }

    unregisterDevice(userId, deviceId) {
        const userDevices = this.registeredDevices.get(userId);
        if (!userDevices) return false;
        
        return userDevices.delete(deviceId);
    }

    getUserDevices(userId) {
        const userDevices = this.registeredDevices.get(userId);
        if (!userDevices) return [];
        
        return Array.from(userDevices.entries()).map(([deviceId, data]) => ({
            deviceId,
            deviceName: data.deviceName,
            registeredAt: data.registeredAt,
            lastUsed: data.lastUsed
        }));
    }

    hasBiometricEnabled(userId) {
        const userDevices = this.registeredDevices.get(userId);
        return userDevices && userDevices.size > 0;
    }

    generateAttestationOptions(userId) {
        return {
            challenge: this.generateChallenge(),
            rp: { name: 'Estif Home', id: process.env.DOMAIN || 'estif-home.com' },
            user: { id: userId, name: userId, displayName: `User ${userId}` },
            pubKeyCredParams: [
                { type: 'public-key', alg: -7 },
                { type: 'public-key', alg: -257 }
            ],
            authenticatorSelection: {
                authenticatorAttachment: 'platform',
                userVerification: 'required',
                residentKey: 'preferred'
            },
            timeout: 60000,
            attestation: 'none'
        };
    }

    generateAssertionOptions(userId, deviceId) {
        const userDevices = this.registeredDevices.get(userId);
        if (!userDevices) return null;
        
        const device = userDevices.get(deviceId);
        if (!device) return null;
        
        return {
            challenge: this.generateChallenge(),
            allowCredentials: [{
                id: Buffer.from(deviceId, 'utf8'),
                type: 'public-key',
                transports: ['internal']
            }],
            timeout: 60000,
            userVerification: 'required'
        };
    }

    getBiometricType() {
        const userAgent = navigator?.userAgent || '';
        
        if (/Face ID/.test(userAgent)) return 'face_id';
        if (/Touch ID/.test(userAgent)) return 'touch_id';
        if (/Windows Hello/.test(userAgent)) return 'windows_hello';
        if (/Android/.test(userAgent)) return 'android_fingerprint';
        
        return 'unknown';
    }
}

module.exports = new BiometricService();