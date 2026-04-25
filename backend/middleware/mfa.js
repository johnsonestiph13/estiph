const speakeasy = require('speakeasy');
const QRCode = require('qrcode');

const generateMFASecret = (email) => {
    const secret = speakeasy.generateSecret({
        name: `Estif Home (${email})`,
        length: 20
    });
    
    return {
        secret: secret.base32,
        otpauthUrl: secret.otpauth_url
    };
};

const generateQRCode = async (otpauthUrl) => {
    try {
        const qrCode = await QRCode.toDataURL(otpauthUrl);
        return qrCode;
    } catch (error) {
        console.error('QR Code generation error:', error);
        throw error;
    }
};

const verifyMFA = (secret, token) => {
    return speakeasy.totp.verify({
        secret: secret,
        encoding: 'base32',
        token: token,
        window: 1
    });
};

const generateBackupCodes = (count = 10) => {
    const codes = [];
    for (let i = 0; i < count; i++) {
        codes.push(Math.random().toString(36).substring(2, 10).toUpperCase());
    }
    return codes;
};

const mfaMiddleware = (req, res, next) => {
    if (req.user?.settings?.twoFactorEnabled && !req.headers['x-mfa-token']) {
        return res.status(401).json({
            success: false,
            message: 'MFA token required',
            requireMFA: true
        });
    }
    
    if (req.headers['x-mfa-token']) {
        const isValid = verifyMFA(req.user.mfaSecret, req.headers['x-mfa-token']);
        if (!isValid) {
            return res.status(401).json({
                success: false,
                message: 'Invalid MFA token'
            });
        }
    }
    
    next();
};

module.exports = {
    generateMFASecret,
    generateQRCode,
    verifyMFA,
    generateBackupCodes,
    mfaMiddleware
};