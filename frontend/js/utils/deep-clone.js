/**
 * ESTIF HOME ULTIMATE - DEEP CLONE UTILITY
 * Deep cloning of objects, arrays, and complex data structures
 * Version: 2.0.0
 * Author: Estifanos Yohannis
 */

// ============================================
// DEEP CLONE IMPLEMENTATION
// ============================================

/**
 * Deep clones a value handling various data types
 * @param {*} value - The value to clone
 * @param {Map} cache - Cache for circular references
 * @returns {*} - Cloned value
 */
function deepClone(value, cache = new Map()) {
    // Handle null, undefined, and primitives
    if (value === null || typeof value !== 'object') {
        return value;
    }
    
    // Handle circular references
    if (cache.has(value)) {
        return cache.get(value);
    }
    
    // Handle Date
    if (value instanceof Date) {
        return new Date(value.getTime());
    }
    
    // Handle RegExp
    if (value instanceof RegExp) {
        return new RegExp(value.source, value.flags);
    }
    
    // Handle Map
    if (value instanceof Map) {
        const clone = new Map();
        cache.set(value, clone);
        for (const [key, val] of value) {
            clone.set(deepClone(key, cache), deepClone(val, cache));
        }
        return clone;
    }
    
    // Handle Set
    if (value instanceof Set) {
        const clone = new Set();
        cache.set(value, clone);
        for (const item of value) {
            clone.add(deepClone(item, cache));
        }
        return clone;
    }
    
    // Handle Array
    if (Array.isArray(value)) {
        const clone = [];
        cache.set(value, clone);
        for (let i = 0; i < value.length; i++) {
            clone[i] = deepClone(value[i], cache);
        }
        return clone;
    }
    
    // Handle Typed Arrays
    if (value instanceof ArrayBuffer) {
        return value.slice(0);
    }
    
    if (ArrayBuffer.isView(value)) {
        return new value.constructor(value);
    }
    
    // Handle plain objects
    const clone = {};
    cache.set(value, clone);
    
    // Clone all enumerable properties including symbols
    const keys = [...Object.keys(value), ...Object.getOwnPropertySymbols(value)];
    for (const key of keys) {
        clone[key] = deepClone(value[key], cache);
    }
    
    // Copy prototype
    Object.setPrototypeOf(clone, Object.getPrototypeOf(value));
    
    return clone;
}

// ============================================
// STRUCTURED CLONE (Browser API)
// ============================================

function structuredCloneSafe(value) {
    if (typeof window !== 'undefined' && window.structuredClone) {
        return window.structuredClone(value);
    }
    return deepClone(value);
}

// ============================================
// JSON CLONE (Fast but limited)
// ============================================

function jsonClone(value) {
    try {
        return JSON.parse(JSON.stringify(value));
    } catch {
        return deepClone(value);
    }
}

// ============================================
// MERGE DEEP
// ============================================

function mergeDeep(target, ...sources) {
    if (!sources.length) return target;
    const source = sources.shift();
    
    if (isObject(target) && isObject(source)) {
        for (const key in source) {
            if (isObject(source[key])) {
                if (!target[key]) Object.assign(target, { [key]: {} });
                mergeDeep(target[key], source[key]);
            } else {
                Object.assign(target, { [key]: source[key] });
            }
        }
    }
    
    return mergeDeep(target, ...sources);
}

function isObject(item) {
    return item && typeof item === 'object' && !Array.isArray(item);
}

// ============================================
// SELECTIVE CLONE
// ============================================

function pickClone(obj, keys) {
    const clone = {};
    for (const key of keys) {
        if (key in obj) {
            clone[key] = deepClone(obj[key]);
        }
    }
    return clone;
}

function omitClone(obj, keys) {
    const clone = deepClone(obj);
    for (const key of keys) {
        delete clone[key];
    }
    return clone;
}

// ============================================
// EXPORTS
// ============================================

// Expose globally
window.deepClone = deepClone;
window.structuredCloneSafe = structuredCloneSafe;
window.jsonClone = jsonClone;
window.mergeDeep = mergeDeep;
window.pickClone = pickClone;
window.omitClone = omitClone;

export { 
    deepClone, 
    structuredCloneSafe, 
    jsonClone, 
    mergeDeep, 
    pickClone, 
    omitClone 
};