const crypto = require('crypto');

const generateRandomBytes = (size = 32) => {
    return crypto.randomBytes(size);
};

const generateRandomHex = (size = 32) => {
    return crypto.randomBytes(size).toString('hex');
};

const generateRandomBase64 = (size = 32) => {
    return crypto.randomBytes(size).toString('base64');
};

const sha256 = (data) => {
    return crypto.createHash('sha256').update(data).digest('hex');
};

const sha512 = (data) => {
    return crypto.createHash('sha512').update(data).digest('hex');
};

const md5 = (data) => {
    return crypto.createHash('md5').update(data).digest('hex');
};

const hmacSha256 = (data, secret) => {
    return crypto.createHmac('sha256', secret).update(data).digest('hex');
};

const generateKeyPair = () => {
    return crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
    });
};

const signData = (data, privateKey) => {
    const sign = crypto.createSign('SHA256');
    sign.update(data);
    sign.end();
    return sign.sign(privateKey, 'hex');
};

const verifySignature = (data, signature, publicKey) => {
    const verify = crypto.createVerify('SHA256');
    verify.update(data);
    verify.end();
    return verify.verify(publicKey, signature, 'hex');
};

const constantTimeCompare = (a, b) => {
    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
};

module.exports = {
    generateRandomBytes,
    generateRandomHex,
    generateRandomBase64,
    sha256,
    sha512,
    md5,
    hmacSha256,
    generateKeyPair,
    signData,
    verifySignature,
    constantTimeCompare
};