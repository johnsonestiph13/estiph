const unique = (arr) => {
    return [...new Set(arr)];
};

const uniqueByKey = (arr, key) => {
    const seen = new Set();
    return arr.filter(item => {
        const value = item[key];
        if (seen.has(value)) return false;
        seen.add(value);
        return true;
    });
};

const chunk = (arr, size) => {
    const result = [];
    for (let i = 0; i < arr.length; i += size) {
        result.push(arr.slice(i, i + size));
    }
    return result;
};

const shuffle = (arr) => {
    const array = [...arr];
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
};

const groupBy = (arr, key) => {
    return arr.reduce((result, item) => {
        const groupKey = item[key];
        if (!result[groupKey]) result[groupKey] = [];
        result[groupKey].push(item);
        return result;
    }, {});
};

const sortBy = (arr, key, order = 'asc') => {
    return [...arr].sort((a, b) => {
        let aVal = a[key];
        let bVal = b[key];
        
        if (typeof aVal === 'string') {
            aVal = aVal.toLowerCase();
            bVal = bVal.toLowerCase();
        }
        
        if (order === 'asc') {
            return aVal > bVal ? 1 : -1;
        } else {
            return aVal < bVal ? 1 : -1;
        }
    });
};

const intersection = (arr1, arr2) => {
    return arr1.filter(value => arr2.includes(value));
};

const difference = (arr1, arr2) => {
    return arr1.filter(value => !arr2.includes(value));
};

const union = (arr1, arr2) => {
    return unique([...arr1, ...arr2]);
};

const flatten = (arr, depth = 1) => {
    return arr.flat(depth);
};

const removeDuplicates = (arr) => {
    return unique(arr);
};

const removeFalsy = (arr) => {
    return arr.filter(Boolean);
};

const sum = (arr) => {
    return arr.reduce((a, b) => a + (b || 0), 0);
};

const average = (arr) => {
    if (arr.length === 0) return 0;
    return sum(arr) / arr.length;
};

const min = (arr) => {
    if (arr.length === 0) return null;
    return Math.min(...arr);
};

const max = (arr) => {
    if (arr.length === 0) return null;
    return Math.max(...arr);
};

const first = (arr, n = 1) => {
    if (n === 1) return arr[0];
    return arr.slice(0, n);
};

const last = (arr, n = 1) => {
    if (n === 1) return arr[arr.length - 1];
    return arr.slice(-n);
};

const isEmpty = (arr) => {
    return !arr || arr.length === 0;
};

const isNotEmpty = (arr) => {
    return arr && arr.length > 0;
};

const contains = (arr, value) => {
    return arr.includes(value);
};

const containsAny = (arr, values) => {
    return values.some(value => arr.includes(value));
};

const containsAll = (arr, values) => {
    return values.every(value => arr.includes(value));
};

const move = (arr, fromIndex, toIndex) => {
    const result = [...arr];
    const [moved] = result.splice(fromIndex, 1);
    result.splice(toIndex, 0, moved);
    return result;
};

const insert = (arr, index, ...items) => {
    const result = [...arr];
    result.splice(index, 0, ...items);
    return result;
};

const remove = (arr, predicate) => {
    const index = typeof predicate === 'function'
        ? arr.findIndex(predicate)
        : arr.indexOf(predicate);
    
    if (index === -1) return [...arr];
    const result = [...arr];
    result.splice(index, 1);
    return result;
};

module.exports = {
    unique,
    uniqueByKey,
    chunk,
    shuffle,
    groupBy,
    sortBy,
    intersection,
    difference,
    union,
    flatten,
    removeDuplicates,
    removeFalsy,
    sum,
    average,
    min,
    max,
    first,
    last,
    isEmpty,
    isNotEmpty,
    contains,
    containsAny,
    containsAll,
    move,
    insert,
    remove
};