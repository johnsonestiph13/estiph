const encryptionService = require('../../services/security/encryptionService');

describe('Encryption Tests', () => {
    const testData = 'Sensitive Information';

    describe('encrypt/decrypt', () => {
        it('should encrypt and decrypt data', () => {
            const encrypted = encryptionService.encrypt(testData);
            const decrypted = encryptionService.decrypt(encrypted);
            
            expect(decrypted).toBe(testData);
        });

        it('should produce different encryption each time', () => {
            const encrypted1 = encryptionService.encrypt(testData);
            const encrypted2 = encryptionService.encrypt(testData);
            
            expect(encrypted1.encrypted).not.toBe(encrypted2.encrypted);
        });
    });
});