/**
 * ESTIF HOME ULTIMATE - CONSTANTS MODULE
 * Global constants, enums, and immutable values
 * Version: 2.0.0
 * Author: Estifanos Yohannis
 */

// ============================================
// APP CONSTANTS
// ============================================

export const APP = {
    NAME: 'Estif Home Ultimate',
    SHORT_NAME: 'Estif Home',
    VERSION: '2.0.0',
    BUILD: '2024.01.01',
    AUTHOR: 'Estifanos Yohannis',
    EMAIL: 'johnsonestiph01@gmail.com',
    PHONE: '+251 987 713 787',
    WEBSITE: 'https://estif-home.com',
    GITHUB: 'https://github.com/estif-home/estif-home-ultimate',
    DESCRIPTION: 'Enterprise Smart Home Control System',
    COPYRIGHT: `© ${new Date().getFullYear()} Estif Home. All rights reserved.`
};

// ============================================
// API ENDPOINTS
// ============================================

export const API_ENDPOINTS = {
    // Auth
    AUTH_LOGIN: '/auth/login',
    AUTH_REGISTER: '/auth/register',
    AUTH_LOGOUT: '/auth/logout',
    AUTH_REFRESH: '/auth/refresh',
    AUTH_FORGOT_PASSWORD: '/auth/forgot-password',
    AUTH_RESET_PASSWORD: '/auth/reset-password',
    AUTH_VERIFY_EMAIL: '/auth/verify-email',
    
    // User
    USER_PROFILE: '/users/me',
    USER_UPDATE: '/users/me',
    USER_CHANGE_PASSWORD: '/users/change-password',
    USER_DELETE: '/users/me',
    
    // Homes
    HOMES: '/homes',
    HOME_DETAIL: (id) => `/homes/${id}`,
    HOME_MEMBERS: (id) => `/homes/${id}/members`,
    HOME_MEMBER: (homeId, memberId) => `/homes/${homeId}/members/${memberId}`,
    
    // Devices
    DEVICES: '/devices',
    DEVICE_DETAIL: (id) => `/devices/${id}`,
    DEVICE_TOGGLE: (id) => `/devices/${id}/toggle`,
    DEVICE_AUTO: (id) => `/devices/${id}/auto`,
    DEVICE_MASTER: '/devices/master',
    
    // Automations
    AUTOMATIONS: '/automations',
    AUTOMATION_DETAIL: (id) => `/automations/${id}`,
    AUTOMATION_TOGGLE: (id) => `/automations/${id}/toggle`,
    
    // Analytics
    ANALYTICS_ENERGY: '/analytics/energy',
    ANALYTICS_DEVICES: '/analytics/devices',
    ANALYTICS_PEAK_HOURS: '/analytics/peak-hours',
    ANALYTICS_EXPORT: (type) => `/analytics/export/${type}`,
    
    // Voice
    VOICE_COMMAND: '/voice/command',
    
    // ESP32
    ESP32_REGISTER: '/esp32/register',
    ESP32_DEVICES: '/esp32/devices',
    ESP32_STATUS: (id) => `/esp32/devices/${id}/status`,
    
    // System
    SYSTEM_STATUS: '/system/status',
    SYSTEM_HEALTH: '/system/health',
    SYSTEM_CONFIG: '/system/config'
};

// ============================================
// WEB SOCKET EVENTS
// ============================================

export const WS_EVENTS = {
    // Connection
    CONNECT: 'connect',
    DISCONNECT: 'disconnect',
    RECONNECT: 'reconnect',
    RECONNECT_ATTEMPT: 'reconnect_attempt',
    RECONNECT_ERROR: 'reconnect_error',
    
    // Device Events
    DEVICE_UPDATE: 'device_update',
    DEVICE_ADDED: 'device_added',
    DEVICE_REMOVED: 'device_removed',
    DEVICE_STATE_CHANGE: 'device_state_change',
    
    // Home Events
    HOME_SWITCHED: 'home_switched',
    HOME_UPDATED: 'home_updated',
    MEMBER_ADDED: 'member_added',
    MEMBER_REMOVED: 'member_removed',
    
    // Automation Events
    AUTOMATION_TRIGGERED: 'automation_triggered',
    AUTOMATION_UPDATED: 'automation_updated',
    
    // Sensor Events
    SENSOR_UPDATE: 'sensor_update',
    TEMPERATURE_UPDATE: 'temperature_update',
    HUMIDITY_UPDATE: 'humidity_update',
    
    // ESP32 Events
    ESP32_STATUS: 'esp32_status',
    ESP32_HEARTBEAT: 'esp32_heartbeat',
    
    // System Events
    SYSTEM_STATUS: 'system_status',
    ACTIVITY_UPDATE: 'activity_update',
    NOTIFICATION: 'notification',
    
    // Voice Events
    VOICE_COMMAND_RECEIVED: 'voice_command_received',
    VOICE_RESPONSE: 'voice_response'
};

// ============================================
// DEVICE TYPES
// ============================================

export const DEVICE_TYPES = {
    LIGHT: { id: 0, name: 'Light', icon: '💡', category: 'lighting' },
    FAN: { id: 1, name: 'Fan', icon: '🌀', category: 'hvac' },
    AC: { id: 2, name: 'AC', icon: '❄️', category: 'hvac' },
    TV: { id: 3, name: 'TV', icon: '📺', category: 'entertainment' },
    HEATER: { id: 4, name: 'Heater', icon: '🔥', category: 'hvac' },
    PUMP: { id: 5, name: 'Pump', icon: '💧', category: 'appliance' },
    REFRIGERATOR: { id: 6, name: 'Refrigerator', icon: '🧊', category: 'appliance' },
    WASHING_MACHINE: { id: 7, name: 'Washing Machine', icon: '🧺', category: 'appliance' },
    OVEN: { id: 8, name: 'Oven', icon: '🍕', category: 'appliance' },
    MICROWAVE: { id: 9, name: 'Microwave', icon: '🍿', category: 'appliance' },
    VACUUM: { id: 10, name: 'Vacuum', icon: '🧹', category: 'appliance' },
    DOOR_LOCK: { id: 11, name: 'Door Lock', icon: '🔒', category: 'security' },
    CAMERA: { id: 12, name: 'Camera', icon: '📷', category: 'security' },
    SENSOR: { id: 13, name: 'Sensor', icon: '📡', category: 'sensor' },
    GARAGE_DOOR: { id: 14, name: 'Garage Door', icon: '🚪', category: 'security' },
    SPRINKLER: { id: 15, name: 'Sprinkler', icon: '💦', category: 'outdoor' }
};

// ============================================
// ROOM TYPES
// ============================================

export const ROOM_TYPES = {
    LIVING_ROOM: { id: 'living', name: 'Living Room', icon: '🛋️' },
    BEDROOM: { id: 'bedroom', name: 'Bedroom', icon: '🛏️' },
    KITCHEN: { id: 'kitchen', name: 'Kitchen', icon: '🍳' },
    BATHROOM: { id: 'bathroom', name: 'Bathroom', icon: '🚿' },
    MASTER: { id: 'master', name: 'Master Bedroom', icon: '👑' },
    GUEST: { id: 'guest', name: 'Guest Room', icon: '🚪' },
    OFFICE: { id: 'office', name: 'Office', icon: '💼' },
    GARAGE: { id: 'garage', name: 'Garage', icon: '🚗' },
    GARDEN: { id: 'garden', name: 'Garden', icon: '🌳' },
    DINING: { id: 'dining', name: 'Dining Room', icon: '🍽️' },
    ENTERTAINMENT: { id: 'entertainment', name: 'Entertainment', icon: '🎬' },
    LAUNDRY: { id: 'laundry', name: 'Laundry Room', icon: '🧺' },
    HALLWAY: { id: 'hallway', name: 'Hallway', icon: '🚶' },
    STAIRS: { id: 'stairs', name: 'Stairs', icon: '📶' },
    BALCONY: { id: 'balcony', name: 'Balcony', icon: '🏙️' }
};

// ============================================
// USER ROLES
// ============================================

export const USER_ROLES = {
    SUPER_ADMIN: { id: 'super_admin', level: 100, name: 'Super Administrator' },
    ADMIN: { id: 'admin', level: 80, name: 'Administrator' },
    HOME_OWNER: { id: 'home_owner', level: 60, name: 'Home Owner' },
    HOME_ADMIN: { id: 'home_admin', level: 50, name: 'Home Admin' },
    MEMBER: { id: 'member', level: 30, name: 'Member' },
    GUEST: { id: 'guest', level: 10, name: 'Guest' }
};

// ============================================
// PERMISSIONS
// ============================================

export const PERMISSIONS = {
    // User permissions
    USER_VIEW: 'user:view',
    USER_CREATE: 'user:create',
    USER_EDIT: 'user:edit',
    USER_DELETE: 'user:delete',
    USER_ROLE_CHANGE: 'user:role:change',
    
    // Home permissions
    HOME_VIEW: 'home:view',
    HOME_CREATE: 'home:create',
    HOME_EDIT: 'home:edit',
    HOME_DELETE: 'home:delete',
    HOME_TRANSFER: 'home:transfer',
    
    // Member permissions
    MEMBER_VIEW: 'member:view',
    MEMBER_ADD: 'member:add',
    MEMBER_REMOVE: 'member:remove',
    MEMBER_ROLE_CHANGE: 'member:role:change',
    
    // Device permissions
    DEVICE_VIEW: 'device:view',
    DEVICE_CONTROL: 'device:control',
    DEVICE_ADD: 'device:add',
    DEVICE_EDIT: 'device:edit',
    DEVICE_DELETE: 'device:delete',
    DEVICE_AUTO_MODE: 'device:auto:mode',
    
    // Automation permissions
    AUTOMATION_VIEW: 'automation:view',
    AUTOMATION_CREATE: 'automation:create',
    AUTOMATION_EDIT: 'automation:edit',
    AUTOMATION_DELETE: 'automation:delete',
    AUTOMATION_ENABLE: 'automation:enable',
    
    // Analytics permissions
    ANALYTICS_VIEW: 'analytics:view',
    ANALYTICS_EXPORT: 'analytics:export',
    
    // Settings permissions
    SETTINGS_VIEW: 'settings:view',
    SETTINGS_EDIT: 'settings:edit',
    SETTINGS_SECURITY: 'settings:security',
    
    // Backup permissions
    BACKUP_CREATE: 'backup:create',
    BACKUP_RESTORE: 'backup:restore',
    BACKUP_DELETE: 'backup:delete',
    
    // Audit permissions
    AUDIT_VIEW: 'audit:view',
    AUDIT_EXPORT: 'audit:export',
    
    // Voice permissions
    VOICE_USE: 'voice:use',
    
    // Emergency permissions
    EMERGENCY_CALL: 'emergency:call'
};

// ============================================
// HTTP STATUS CODES
// ============================================

export const HTTP_STATUS = {
    // Success
    OK: 200,
    CREATED: 201,
    ACCEPTED: 202,
    NO_CONTENT: 204,
    
    // Redirection
    MOVED_PERMANENTLY: 301,
    FOUND: 302,
    NOT_MODIFIED: 304,
    
    // Client Errors
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    METHOD_NOT_ALLOWED: 405,
    CONFLICT: 409,
    TOO_MANY_REQUESTS: 429,
    
    // Server Errors
    INTERNAL_SERVER_ERROR: 500,
    BAD_GATEWAY: 502,
    SERVICE_UNAVAILABLE: 503,
    GATEWAY_TIMEOUT: 504
};

// ============================================
// STORAGE KEYS
// ============================================

export const STORAGE_KEYS = {
    AUTH_TOKEN: 'estif_auth_token',
    REFRESH_TOKEN: 'estif_refresh_token',
    USER: 'estif_user',
    SETTINGS: 'estif_settings',
    THEME: 'estif_theme',
    LANGUAGE: 'estif_language',
    DEVICES: 'estif_devices',
    HOMES: 'estif_homes',
    SESSION: 'estif_session',
    CONFIG: 'estif_config',
    OFFLINE_QUEUE: 'estif_offline_queue'
};

// ============================================
// ERROR CODES
// ============================================

export const ERROR_CODES = {
    // Auth Errors
    AUTH_INVALID_CREDENTIALS: 'auth/invalid-credentials',
    AUTH_EMAIL_EXISTS: 'auth/email-exists',
    AUTH_WEAK_PASSWORD: 'auth/weak-password',
    AUTH_TOKEN_EXPIRED: 'auth/token-expired',
    AUTH_UNAUTHORIZED: 'auth/unauthorized',
    AUTH_FORBIDDEN: 'auth/forbidden',
    
    // Validation Errors
    VALIDATION_REQUIRED: 'validation/required',
    VALIDATION_INVALID_EMAIL: 'validation/invalid-email',
    VALIDATION_PASSWORD_MISMATCH: 'validation/password-mismatch',
    
    // Device Errors
    DEVICE_NOT_FOUND: 'device/not-found',
    DEVICE_OFFLINE: 'device/offline',
    DEVICE_AUTO_MODE: 'device/auto-mode',
    
    // Network Errors
    NETWORK_OFFLINE: 'network/offline',
    NETWORK_TIMEOUT: 'network/timeout',
    NETWORK_CONNECTION_REFUSED: 'network/connection-refused',
    
    // Server Errors
    SERVER_INTERNAL: 'server/internal',
    SERVER_UNAVAILABLE: 'server/unavailable',
    
    // Rate Limit
    RATE_LIMIT_EXCEEDED: 'rate-limit/exceeded'
};

// ============================================
// MESSAGE TYPES
// ============================================

export const MESSAGE_TYPES = {
    SUCCESS: 'success',
    ERROR: 'error',
    WARNING: 'warning',
    INFO: 'info'
};

// ============================================
// TIME CONSTANTS (in milliseconds)
// ============================================

export const TIME = {
    SECOND: 1000,
    MINUTE: 60 * 1000,
    HOUR: 60 * 60 * 1000,
    DAY: 24 * 60 * 60 * 1000,
    WEEK: 7 * 24 * 60 * 60 * 1000,
    MONTH: 30 * 24 * 60 * 60 * 1000,
    YEAR: 365 * 24 * 60 * 60 * 1000
};

// ============================================
// REGEX PATTERNS
// ============================================

export const REGEX = {
    EMAIL: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
    PHONE: /^[\+]?[(]?[0-9]{1,4}[)]?[-\s\.]?[(]?[0-9]{1,4}[)]?[-\s\.]?[0-9]{1,9}$/,
    PASSWORD_STRONG: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
    IP_ADDRESS: /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/,
    MAC_ADDRESS: /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/,
    UUID: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    HEX_COLOR: /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/,
    URL: /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/
};

// ============================================
// DATE FORMATS
// ============================================

export const DATE_FORMATS = {
    DATE: 'YYYY-MM-DD',
    TIME: 'HH:mm:ss',
    DATE_TIME: 'YYYY-MM-DD HH:mm:ss',
    DATE_TIME_12H: 'YYYY-MM-DD hh:mm:ss A',
    TIME_12H: 'hh:mm:ss A',
    HUMAN_DATE: 'MMM DD, YYYY',
    HUMAN_DATE_TIME: 'MMM DD, YYYY HH:mm',
    ISO: 'YYYY-MM-DDTHH:mm:ssZ'
};

// ============================================
// DEFAULT VALUES
// ============================================

export const DEFAULTS = {
    // Pagination
    PAGE_SIZE: 20,
    PAGE: 1,
    
    // Temperature
    TEMPERATURE_UNIT: 'celsius', // celsius, fahrenheit
    DEFAULT_TEMPERATURE: 23,
    DEFAULT_HUMIDITY: 45,
    
    // Theme
    THEME: 'light',
    LANGUAGE: 'en',
    
    // Device
    DEVICE_AUTO_MODE: false,
    DEVICE_STATE: false,
    
    // Connection
    CONNECTION_TIMEOUT: 30000,
    RECONNECT_ATTEMPTS: 5,
    RECONNECT_DELAY: 1000
};

// ============================================
// THEME NAMES
// ============================================

export const THEMES = {
    LIGHT: 'light',
    DARK: 'dark',
    AMOLED: 'amoled',
    HIGH_CONTRAST: 'high-contrast',
    SEPIA: 'sepia',
    COLORBLIND: 'colorblind'
};

// ============================================
// LANGUAGE CODES
// ============================================

export const LANGUAGES = {
    ENGLISH: { code: 'en', name: 'English', native: 'English', flag: '🇺🇸' },
    AMHARIC: { code: 'am', name: 'Amharic', native: 'አማርኛ', flag: '🇪🇹' },
    ARABIC: { code: 'ar', name: 'Arabic', native: 'العربية', flag: '🇸🇦' },
    GERMAN: { code: 'de', name: 'German', native: 'Deutsch', flag: '🇩🇪' },
    SPANISH: { code: 'es', name: 'Spanish', native: 'Español', flag: '🇪🇸' },
    FRENCH: { code: 'fr', name: 'French', native: 'Français', flag: '🇫🇷' },
    CHINESE: { code: 'zh', name: 'Chinese', native: '中文', flag: '🇨🇳' }
};

// ============================================
// DEVICE CATEGORIES
// ============================================

export const DEVICE_CATEGORIES = {
    LIGHTING: { id: 'lighting', name: 'Lighting', icon: '💡' },
    HVAC: { id: 'hvac', name: 'HVAC', icon: '🌡️' },
    ENTERTAINMENT: { id: 'entertainment', name: 'Entertainment', icon: '📺' },
    APPLIANCE: { id: 'appliance', name: 'Appliances', icon: '🔌' },
    SECURITY: { id: 'security', name: 'Security', icon: '🔒' },
    SENSOR: { id: 'sensor', name: 'Sensors', icon: '📡' },
    OUTDOOR: { id: 'outdoor', name: 'Outdoor', icon: '🌳' }
};

// ============================================
// AUTOMATION TRIGGER TYPES
// ============================================

export const TRIGGER_TYPES = {
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
};

// ============================================
// AUTOMATION ACTION TYPES
// ============================================

export const ACTION_TYPES = {
    DEVICE_ON: 'device_on',
    DEVICE_OFF: 'device_off',
    DEVICE_TOGGLE: 'device_toggle',
    SCENE_ACTIVATE: 'scene_activate',
    NOTIFICATION: 'notification',
    DELAY: 'delay',
    WEBHOOK: 'webhook'
};

// ============================================
// CHART TYPES
// ============================================

export const CHART_TYPES = {
    LINE: 'line',
    BAR: 'bar',
    PIE: 'pie',
    DOUGHNUT: 'doughnut',
    RADAR: 'radar',
    AREA: 'area',
    GAUGE: 'gauge'
};

// ============================================
// EXPORT ALL
// ============================================

// For CommonJS
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        APP,
        API_ENDPOINTS,
        WS_EVENTS,
        DEVICE_TYPES,
        ROOM_TYPES,
        USER_ROLES,
        PERMISSIONS,
        HTTP_STATUS,
        STORAGE_KEYS,
        ERROR_CODES,
        MESSAGE_TYPES,
        TIME,
        REGEX,
        DATE_FORMATS,
        DEFAULTS,
        THEMES,
        LANGUAGES,
        DEVICE_CATEGORIES,
        TRIGGER_TYPES,
        ACTION_TYPES,
        CHART_TYPES
    };
}