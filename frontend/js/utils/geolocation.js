/**
 * ESTIF HOME ULTIMATE - GEOLOCATION UTILITIES
 * Location tracking, distance calculation, and geocoding
 * Version: 2.0.0
 * Author: Estifanos Yohannis
 */

// ============================================
// GEOLOCATION CONFIGURATION
// ============================================

const GeolocationConfig = {
    defaultOptions: {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
    },
    cacheTTL: 60000, // 1 minute
    debug: false
};

// ============================================
// GEOLOCATION MANAGER
// ============================================

class GeolocationManager {
    constructor() {
        this.currentPosition = null;
        this.watchId = null;
        this.cache = new Map();
        this.listeners = [];
        this.isWatching = false;
        
        this.init();
    }

    init() {
        this.loadCachedPosition();
        GeolocationConfig.debug && console.log('[Geolocation] Manager initialized');
    }

    loadCachedPosition() {
        try {
            const cached = localStorage.getItem('estif_geolocation_cache');
            if (cached) {
                const data = JSON.parse(cached);
                if (Date.now() - data.timestamp < GeolocationConfig.cacheTTL) {
                    this.currentPosition = data.position;
                }
            }
        } catch (error) {
            console.error('[Geolocation] Failed to load cache:', error);
        }
    }

    saveCachedPosition(position) {
        try {
            localStorage.setItem('estif_geolocation_cache', JSON.stringify({
                position,
                timestamp: Date.now()
            }));
        } catch (error) {
            console.error('[Geolocation] Failed to save cache:', error);
        }
    }

    // ============================================
    // POSITION METHODS
    // ============================================

    async getCurrentPosition(options = {}) {
        if (!navigator.geolocation) {
            throw new Error('Geolocation not supported');
        }

        return new Promise((resolve, reject) => {
            const opts = { ...GeolocationConfig.defaultOptions, ...options };
            
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    this.currentPosition = position;
                    this.saveCachedPosition(position);
                    this.notifyListeners('position_updated', position);
                    resolve(position);
                },
                (error) => {
                    reject(this.handleError(error));
                },
                opts
            );
        });
    }

    startWatching(options = {}, callback = null) {
        if (!navigator.geolocation) {
            throw new Error('Geolocation not supported');
        }

        if (this.isWatching) {
            this.stopWatching();
        }

        const opts = { ...GeolocationConfig.defaultOptions, ...options };
        
        this.watchId = navigator.geolocation.watchPosition(
            (position) => {
                this.currentPosition = position;
                this.saveCachedPosition(position);
                this.notifyListeners('position_updated', position);
                if (callback) callback(position);
            },
            (error) => {
                this.handleError(error);
                if (callback) callback(null, error);
            },
            opts
        );
        
        this.isWatching = true;
        return this.watchId;
    }

    stopWatching() {
        if (this.watchId !== null) {
            navigator.geolocation.clearWatch(this.watchId);
            this.watchId = null;
            this.isWatching = false;
            this.notifyListeners('watching_stopped');
        }
    }

    handleError(error) {
        const errors = {
            1: 'Permission denied',
            2: 'Position unavailable',
            3: 'Timeout'
        };
        const message = errors[error.code] || 'Unknown error';
        this.notifyListeners('error', { code: error.code, message });
        return new Error(message);
    }

    // ============================================
    // DISTANCE CALCULATIONS
    // ============================================

    static calculateDistance(lat1, lon1, lat2, lon2, unit = 'km') {
        const R = unit === 'km' ? 6371 : 3959; // Earth's radius
        const dLat = this.toRad(lat2 - lat1);
        const dLon = this.toRad(lon2 - lon1);
        
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                  Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
                  Math.sin(dLon / 2) * Math.sin(dLon / 2);
        
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const distance = R * c;
        
        return Math.round(distance * 100) / 100;
    }

    static toRad(degrees) {
        return degrees * Math.PI / 180;
    }

    static calculateBearing(lat1, lon1, lat2, lon2) {
        const φ1 = this.toRad(lat1);
        const φ2 = this.toRad(lat2);
        const λ1 = this.toRad(lon1);
        const λ2 = this.toRad(lon2);
        
        const y = Math.sin(λ2 - λ1) * Math.cos(φ2);
        const x = Math.cos(φ1) * Math.sin(φ2) -
                  Math.sin(φ1) * Math.cos(φ2) * Math.cos(λ2 - λ1);
        
        const bearing = Math.atan2(y, x);
        return (bearing * 180 / Math.PI + 360) % 360;
    }

    static getCardinalDirection(bearing) {
        const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 
                           'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
        const index = Math.round(bearing / 22.5) % 16;
        return directions[index];
    }

    // ============================================
    // GEOCODING
    // ============================================

    async reverseGeocode(lat, lon) {
        const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`;
        
        try {
            const response = await fetch(url);
            const data = await response.json();
            return {
                address: data.display_name,
                city: data.address?.city || data.address?.town,
                country: data.address?.country,
                postalCode: data.address?.postcode,
                street: data.address?.road,
                houseNumber: data.address?.house_number
            };
        } catch (error) {
            console.error('[Geolocation] Reverse geocoding failed:', error);
            return null;
        }
    }

    async geocode(address) {
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}`;
        
        try {
            const response = await fetch(url);
            const data = await response.json();
            if (data.length > 0) {
                return {
                    lat: parseFloat(data[0].lat),
                    lon: parseFloat(data[0].lon),
                    displayName: data[0].display_name
                };
            }
            return null;
        } catch (error) {
            console.error('[Geolocation] Geocoding failed:', error);
            return null;
        }
    }

    // ============================================
    // UTILITY METHODS
    // ============================================

    getCurrentLocation() {
        return this.currentPosition;
    }

    isWithinRadius(lat, lon, radiusKm) {
        if (!this.currentPosition) return false;
        
        const distance = GeolocationManager.calculateDistance(
            this.currentPosition.coords.latitude,
            this.currentPosition.coords.longitude,
            lat, lon
        );
        
        return distance <= radiusKm;
    }

    // ============================================
    // EVENT SYSTEM
    // ============================================

    addEventListener(event, callback) {
        this.listeners.push({ event, callback });
        return () => {
            const index = this.listeners.findIndex(l => l.event === event && l.callback === callback);
            if (index !== -1) this.listeners.splice(index, 1);
        };
    }

    notifyListeners(event, data) {
        this.listeners.forEach(listener => {
            if (listener.event === event) {
                listener.callback(data);
            }
        });
    }
}

// ============================================
// CREATE SINGLETON INSTANCE
// ============================================

const geolocation = new GeolocationManager();

// Expose globally
window.geolocation = geolocation;
window.GeolocationManager = GeolocationManager;

export { geolocation, GeolocationManager, GeolocationConfig };