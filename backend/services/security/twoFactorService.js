/**
 * ESTIF HOME ULTIMATE - TWO FACTOR SERVICE
 * TOTP-based two-factor authentication
 * Version: 2.0.0
 */

const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const crypto = require('crypto');

class TwoFactorService {
    constructor() {
        this.appName = 'Estif Home';
    }

    generateSecret(email) {
        const secret = speakeasy.generateSecret({
            name: `${this.appName} (${email})`,
            length: 20,
            issuer: this.appName
        });
        
        return {
            secret: secret.base32,
            otpauthUrl: secret.otpauth_url,
            qrCode: null
        };
    }

    async generateQRCode(otpauthUrl) {
        try {
            return await QRCode.toDataURL(otpauthUrl);
        } catch (error) {
            console.error('QR Code generation error:', error);
            return null;
        }
    }

    verifyToken(secret, token) {
        return speakeasy.totp.verify({
            secret: secret,
            encoding: 'base32',
            token: token,
            window: 1
        });
    }

    generateBackupCodes(count = 10) {
        const codes = [];
        for (let i = 0; i < count; i++) {
            const code = crypto.randomBytes(4).toString('hex').toUpperCase();
            const hashedCode = crypto.createHash('sha256').update(code).digest('hex');
            codes.push({ code, hashedCode });
        }
        return codes;
    }

    verifyBackupCode(code, hashedCodes) {
        const hashedInput = crypto.createHash('sha256').update(code).digest('hex');
        const match = hashedCodes.find(hc => hc === hashedInput);
        if (match) {
            return { valid: true, code: match };
        }
        return { valid: false };
    }

    generateRecoveryCodes() {
        const codes = [];
        for (let i = 0; i < 8; i++) {
            codes.push(crypto.randomBytes(5).toString('hex').toUpperCase());
        }
        return codes;
    }

    getRemainingBackupCodes(usedCodes, totalCount = 10) {
        return totalCount - usedCodes.length;
    }
}

module.exports = new TwoFactorService();