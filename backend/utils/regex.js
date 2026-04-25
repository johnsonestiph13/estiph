module.exports = {
    // Email validation
    EMAIL: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
    
    // Phone validation (international)
    PHONE: /^[\+]?[(]?[0-9]{1,4}[)]?[-\s\.]?[(]?[0-9]{1,4}[)]?[-\s\.]?[0-9]{1,9}$/,
    
    // Password validation (at least 8 chars, 1 uppercase, 1 lowercase, 1 number)
    PASSWORD: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d]{8,}$/,
    
    // Strong password (with special characters)
    PASSWORD_STRONG: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
    
    // IP Address (IPv4)
    IPV4: /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/,
    
    // IP Address (IPv6)
    IPV6: /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/,
    
    // MAC Address
    MAC: /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/,
    
    // UUID
    UUID: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    
    // URL
    URL: /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/,
    
    // Hex Color
    HEX_COLOR: /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/,
    
    // HTML Tag
    HTML_TAG: /<[^>]*>/g,
    
    // MongoDB ObjectId
    OBJECT_ID: /^[0-9a-fA-F]{24}$/,
    
    // JWT Token
    JWT: /^eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/,
    
    // Credit Card (Visa, Mastercard, Amex, Discover)
    CREDIT_CARD: /^(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|6(?:011|5[0-9][0-9])[0-9]{12})$/,
    
    // Postal Code (US)
    POSTAL_CODE_US: /^\d{5}(-\d{4})?$/,
    
    // Time (24-hour format)
    TIME_24H: /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/,
    
    // Time (12-hour format)
    TIME_12H: /^(0?[1-9]|1[0-2]):[0-5][0-9] (AM|PM)$/i,
    
    // Date (YYYY-MM-DD)
    DATE_ISO: /^\d{4}-\d{2}-\d{2}$/,
    
    // Date Time (YYYY-MM-DD HH:MM:SS)
    DATETIME_ISO: /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/,
    
    // Domain Name
    DOMAIN: /^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}$/,
    
    // Username (alphanumeric, underscore, 3-20 chars)
    USERNAME: /^[a-zA-Z0-9_]{3,20}$/,
    
    // Alpha (letters only)
    ALPHA: /^[a-zA-Z]+$/,
    
    // Alphanumeric
    ALPHANUMERIC: /^[a-zA-Z0-9]+$/,
    
    // Numeric
    NUMERIC: /^\d+$/,
    
    // Integer (positive and negative)
    INTEGER: /^-?\d+$/,
    
    // Decimal
    DECIMAL: /^-?\d+(\.\d+)?$/,
    
    // Latitude
    LATITUDE: /^-?([1-8]?[1-9]|[1-9]0)\.{1}\d{1,6}$|^[-]?90\.{1}\d{1,6}$/,
    
    // Longitude
    LONGITUDE: /^-?([1-9]?[1-9]|[1-9]0)\.{1}\d{1,6}$|^[-]?180\.{1}\d{1,6}$/,
    
    // Base64
    BASE64: /^[A-Za-z0-9+/]*={0,2}$/,
    
    // Slug
    SLUG: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    
    // Version (semver)
    SEMVER: /^\d+\.\d+\.\d+(-[a-zA-Z0-9.-]+)?(\+[a-zA-Z0-9.-]+)?$/
};