/**
 * ESTIF HOME ULTIMATE - UUID GENERATOR
 * Generate UUID v4, v1, and custom IDs
 * Version: 2.0.0
 * Author: Estifanos Yohannis
 */

// ============================================
// UUID GENERATION
// ============================================

class UUIDGenerator {
    /**
     * Generate UUID v4 (random)
     */
    static v4() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    /**
     * Generate UUID v1 (timestamp-based)
     */
    static v1() {
        let timestamp = Date.now();
        let clockSeq = (Math.random() * 0x3fff) | 0;
        
        const timeLow = timestamp & 0xffffffff;
        const timeMid = (timestamp >> 32) & 0xffff;
        const timeHigh = (timestamp >> 48) & 0x0fff;
        
        const clockSeqLow = clockSeq & 0xff;
        const clockSeqHigh = (clockSeq >> 8) & 0x3f;
        
        const node = (Math.random() * 0xffffffffffff) | 0;
        
        return [
            this.formatHex(timeLow, 8),
            this.formatHex(timeMid, 4),
            this.formatHex((timeHigh & 0x0fff) | 0x1000, 4),
            this.formatHex((clockSeqHigh << 8) | clockSeqLow, 4),
            this.formatHex(node, 12)
        ].join('-');
    }

    static formatHex(value, length) {
        return value.toString(16).padStart(length, '0').slice(-length);
    }

    /**
     * Generate short ID (8 characters)
     */
    static short() {
        return Math.random().toString(36).substr(2, 8).toUpperCase();
    }

    /**
     * Generate nano ID (10 characters)
     */
    static nano() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < 10; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    /**
     * Generate numeric ID
     */
    static numeric(length = 8) {
        let result = '';
        for (let i = 0; i < length; i++) {
            result += Math.floor(Math.random() * 10);
        }
        return result;
    }

    /**
     * Generate session ID
     */
    static session() {
        return `sess_${Date.now()}_${this.short()}`;
    }

    /**
     * Generate device ID
     */
    static device(deviceType = 'dev') {
        return `${deviceType}_${Date.now()}_${this.short()}`;
    }

    /**
     * Generate user ID
     */
    static user() {
        return `usr_${Date.now()}_${this.short()}`;
    }

    /**
     * Generate home ID
     */
    static home() {
        return `home_${Date.now()}_${this.short()}`;
    }

    /**
     * Generate room ID
     */
    static room() {
        return `room_${Date.now()}_${this.short()}`;
    }

    /**
     * Generate automation rule ID
     */
    static automation() {
        return `auto_${Date.now()}_${this.short()}`;
    }

    /**
     * Generate scene ID
     */
    static scene() {
        return `scene_${Date.now()}_${this.short()}`;
    }

    /**
     * Generate notification ID
     */
    static notification() {
        return `notif_${Date.now()}_${this.short()}`;
    }

    /**
     * Generate event ID
     */
    static event() {
        return `evt_${Date.now()}_${this.short()}`;
    }

    /**
     * Generate operation ID
     */
    static operation() {
        return `op_${Date.now()}_${this.short()}`;
    }

    /**
     * Generate message ID
     */
    static message() {
        return `msg_${Date.now()}_${this.short()}`;
    }

    /**
     * Validate UUID v4
     */
    static isValid(uuid) {
        const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        return regex.test(uuid);
    }

    /**
     * Validate any UUID version
     */
    static isValidAny(uuid) {
        const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        return regex.test(uuid);
    }

    /**
     * Bulk generate UUIDs
     */
    static bulk(count = 10, version = 'v4') {
        const uuids = [];
        for (let i = 0; i < count; i++) {
            uuids.push(this[version]());
        }
        return uuids;
    }
}

// ============================================
// EXPORTS
// ============================================

// Expose globally
window.UUIDGenerator = UUIDGenerator;

export { UUIDGenerator };