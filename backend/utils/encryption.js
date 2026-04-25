const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

const encrypt = (text, key) => {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(key, 'hex'), iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return {
        encrypted: encrypted,
        iv: iv.toString('hex'),
        authTag: authTag.toString('hex')
    };
};

const decrypt = (encryptedData, key) => {
    const decipher = crypto.createDecipheriv(
        ALGORITHM,
        Buffer.from(key, 'hex'),
        Buffer.from(encryptedData.iv, 'hex')
    );
    
    decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));
    
    let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
};

const hashPassword = (password, salt = null) => {
    const useSalt = salt || crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(password, useSalt, 100000, 64, 'sha512').toString('hex');
    return { hash, salt: useSalt };
};

const verifyPassword = (password, hash, salt) => {
    const { hash: computedHash } = hashPassword(password, salt);
    return computedHash === hash;
};

const generateApiKey = () => {
    return crypto.randomBytes(32).toString('hex');
};

const generateSecret = () => {
    return crypto.randomBytes(64).toString('hex');
};

const hashData = (data, algorithm = 'sha256') => {
    return crypto.createHash(algorithm).update(data).digest('hex');
};

const hmacSign = (data, secret) => {
    return crypto.createHmac('sha256', secret).update(data).digest('hex');
};

const hmacVerify = (data, signature, secret) => {
    const expected = hmacSign(data, secret);
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
};

module.exports = {
    encrypt,
    decrypt,
    hashPassword,
    verifyPassword,
    generateApiKey,
    generateSecret,
    hashData,
    hmacSign,
    hmacVerify
};