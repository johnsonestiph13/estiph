const deepClone = (obj) => {
    return JSON.parse(JSON.stringify(obj));
};

const deepMerge = (target, ...sources) => {
    if (!sources.length) return target;
    const source = sources.shift();
    
    if (isObject(target) && isObject(source)) {
        for (const key in source) {
            if (isObject(source[key])) {
                if (!target[key]) Object.assign(target, { [key]: {} });
                deepMerge(target[key], source[key]);
            } else {
                Object.assign(target, { [key]: source[key] });
            }
        }
    }
    
    return deepMerge(target, ...sources);
};

const isObject = (obj) => {
    return obj !== null && typeof obj === 'object' && !Array.isArray(obj);
};

const isEmpty = (obj) => {
    return obj && Object.keys(obj).length === 0 && obj.constructor === Object;
};

const hasKey = (obj, key) => {
    return obj && obj.hasOwnProperty(key);
};

const pick = (obj, keys) => {
    return keys.reduce((result, key) => {
        if (obj && obj.hasOwnProperty(key)) {
            result[key] = obj[key];
        }
        return result;
    }, {});
};

const omit = (obj, keys) => {
    const result = { ...obj };
    keys.forEach(key => delete result[key]);
    return result;
};

const getNestedValue = (obj, path, defaultValue = null) => {
    const keys = path.split('.');
    let result = obj;
    for (const key of keys) {
        if (result === null || result === undefined) {
            return defaultValue;
        }
        result = result[key];
    }
    return result === undefined ? defaultValue : result;
};

const setNestedValue = (obj, path, value) => {
    const keys = path.split('.');
    let current = obj;
    for (let i = 0; i < keys.length - 1; i++) {
        if (!current[keys[i]]) current[keys[i]] = {};
        current = current[keys[i]];
    }
    current[keys[keys.length - 1]] = value;
    return obj;
};

const keys = (obj) => {
    return Object.keys(obj);
};

const values = (obj) => {
    return Object.values(obj);
};

const entries = (obj) => {
    return Object.entries(obj);
};

const mapValues = (obj, fn) => {
    return Object.entries(obj).reduce((result, [key, value]) => {
        result[key] = fn(value, key, obj);
        return result;
    }, {});
};

const filterKeys = (obj, predicate) => {
    return Object.entries(obj).reduce((result, [key, value]) => {
        if (predicate(key, value, obj)) {
            result[key] = value;
        }
        return result;
    }, {});
};

const invert = (obj) => {
    return Object.entries(obj).reduce((result, [key, value]) => {
        result[value] = key;
        return result;
    }, {});
};

const size = (obj) => {
    return Object.keys(obj).length;
};

const toQueryString = (obj) => {
    return Object.entries(obj)
        .filter(([, value]) => value !== undefined && value !== null)
        .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
        .join('&');
};

const fromQueryString = (queryString) => {
    const params = new URLSearchParams(queryString);
    const result = {};
    for (const [key, value] of params) {
        result[key] = value;
    }
    return result;
};

const compare = (obj1, obj2) => {
    return JSON.stringify(obj1) === JSON.stringify(obj2);
};

const freeze = (obj) => {
    return Object.freeze(obj);
};

const seal = (obj) => {
    return Object.seal(obj);
};

module.exports = {
    deepClone,
    deepMerge,
    isObject,
    isEmpty,
    hasKey,
    pick,
    omit,
    getNestedValue,
    setNestedValue,
    keys,
    values,
    entries,
    mapValues,
    filterKeys,
    invert,
    size,
    toQueryString,
    fromQueryString,
    compare,
    freeze,
    seal
};