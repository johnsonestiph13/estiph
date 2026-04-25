module.exports = {
    // User Roles
    USER_ROLES: {
        SUPER_ADMIN: 'super_admin',
        ADMIN: 'admin',
        USER: 'user'
    },
    
    // Device Types
    DEVICE_TYPES: {
        LIGHT: 'light',
        FAN: 'fan',
        AC: 'ac',
        TV: 'tv',
        HEATER: 'heater',
        PUMP: 'pump',
        SENSOR: 'sensor',
        CAMERA: 'camera',
        LOCK: 'lock',
        SPEAKER: 'speaker',
        BLIND: 'blind'
    },
    
    // Device Categories
    DEVICE_CATEGORIES: {
        LIGHTING: 'lighting',
        HVAC: 'hvac',
        ENTERTAINMENT: 'entertainment',
        APPLIANCE: 'appliance',
        SECURITY: 'security',
        SENSOR: 'sensor'
    },
    
    // Automation Trigger Types
    TRIGGER_TYPES: {
        SCHEDULE: 'schedule',
        TEMPERATURE: 'temperature',
        HUMIDITY: 'humidity',
        MOTION: 'motion',
        DEVICE_STATE: 'device_state',
        TIME: 'time',
        SUNRISE: 'sunrise',
        SUNSET: 'sunset',
        VOICE: 'voice',
        MANUAL: 'manual'
    },
    
    // Automation Action Types
    ACTION_TYPES: {
        DEVICE_ON: 'device_on',
        DEVICE_OFF: 'device_off',
        DEVICE_TOGGLE: 'device_toggle',
        SCENE_ACTIVATE: 'scene_activate',
        NOTIFICATION: 'notification',
        WEBHOOK: 'webhook',
        DELAY: 'delay'
    },
    
    // Notification Types
    NOTIFICATION_TYPES: {
        INFO: 'info',
        SUCCESS: 'success',
        WARNING: 'warning',
        ERROR: 'error'
    },
    
    // HTTP Status Codes
    HTTP_STATUS: {
        OK: 200,
        CREATED: 201,
        ACCEPTED: 202,
        NO_CONTENT: 204,
        BAD_REQUEST: 400,
        UNAUTHORIZED: 401,
        FORBIDDEN: 403,
        NOT_FOUND: 404,
        CONFLICT: 409,
        UNPROCESSABLE_ENTITY: 422,
        TOO_MANY_REQUESTS: 429,
        INTERNAL_SERVER_ERROR: 500,
        SERVICE_UNAVAILABLE: 503
    },
    
    // Event Types
    EVENT_TYPES: {
        DEVICE_TOGGLED: 'device_toggled',
        DEVICE_UPDATED: 'device_updated',
        AUTO_MODE_CHANGED: 'auto_mode_changed',
        MASTER_CONTROL: 'master_control',
        SENSOR_UPDATE: 'sensor_update',
        AUTOMATION_TRIGGERED: 'automation_triggered',
        NOTIFICATION: 'notification'
    },
    
    // Cache TTL (seconds)
    CACHE_TTL: {
        SHORT: 60,
        MEDIUM: 300,
        LONG: 3600,
        DAY: 86400
    },
    
    // Rate Limit Windows (ms)
    RATE_LIMIT: {
        AUTH: 15 * 60 * 1000,
        API: 60 * 1000,
        STRICT: 60 * 1000,
        WEBHOOK: 60 * 1000
    },
    
    // Time Constants (ms)
    TIME: {
        SECOND: 1000,
        MINUTE: 60 * 1000,
        HOUR: 60 * 60 * 1000,
        DAY: 24 * 60 * 60 * 1000,
        WEEK: 7 * 24 * 60 * 60 * 1000
    },
    
    // Pagination
    PAGINATION: {
        DEFAULT_PAGE: 1,
        DEFAULT_LIMIT: 20,
        MAX_LIMIT: 100
    },
    
    // File Upload Limits
    UPLOAD: {
        MAX_FILE_SIZE: 5 * 1024 * 1024,
        ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
        ALLOWED_DOC_TYPES: ['application/pdf']
    },
    
    // Temperature Thresholds
    TEMP_THRESHOLDS: {
        AC_ON: 26,
        AC_OFF: 24,
        HEATER_ON: 18,
        HEATER_OFF: 20,
        FAN_ON: 26,
        FAN_OFF: 24
    }
};