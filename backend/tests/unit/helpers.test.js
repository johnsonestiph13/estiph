const { formatDate, formatCurrency, generateOTP } = require('../../utils/helpers');

describe('Helpers Tests', () => {
    describe('formatDate', () => {
        it('should format date correctly', () => {
            const date = new Date('2024-01-15T10:30:00');
            expect(formatDate(date, 'YYYY-MM-DD')).toBe('2024-01-15');
        });
    });

    describe('formatCurrency', () => {
        it('should format currency', () => {
            expect(formatCurrency(1234.56, 'USD')).toBe('$1,234.56');
        });
    });

    describe('generateOTP', () => {
        it('should generate 6-digit OTP', () => {
            const otp = generateOTP();
            expect(otp).toHaveLength(6);
            expect(/^\d+$/.test(otp)).toBe(true);
        });
    });
});