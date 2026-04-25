const { validateEmail, validatePassword, validateName } = require('../../utils/validators');

describe('Validation Tests', () => {
    describe('Email Validation', () => {
        it('should validate correct email', () => {
            expect(validateEmail('test@example.com')).toBe(true);
            expect(validateEmail('invalid')).toBe(false);
        });
    });

    describe('Password Validation', () => {
        it('should validate strong password', () => {
            const result = validatePassword('Test@123456');
            expect(result.isValid).toBe(true);
        });

        it('should reject weak password', () => {
            const result = validatePassword('weak');
            expect(result.isValid).toBe(false);
        });
    });

    describe('Name Validation', () => {
        it('should validate correct name', () => {
            expect(validateName('John Doe')).toBe(true);
            expect(validateName('J')).toBe(false);
        });
    });
});