/**
 * ESTIF HOME ULTIMATE - DEBOUNCE UTILITY
 * Debounce function for limiting function call frequency
 * Version: 2.0.0
 * Author: Estifanos Yohannis
 */

// ============================================
// DEBOUNCE IMPLEMENTATION
// ============================================

/**
 * Creates a debounced function that delays invoking func until after wait milliseconds
 * @param {Function} func - The function to debounce
 * @param {number} wait - The number of milliseconds to delay
 * @param {Object} options - Options object
 * @param {boolean} options.leading - Specify invoking on the leading edge
 * @param {boolean} options.trailing - Specify invoking on the trailing edge
 * @param {number} options.maxWait - The maximum time func is allowed to be delayed
 * @returns {Function} - Debounced function
 */
function debounce(func, wait = 300, options = {}) {
    let timeoutId = null;
    let lastArgs = null;
    let lastThis = null;
    let lastCallTime = null;
    let lastInvokeTime = 0;
    let maxWait = options.maxWait || 0;
    let leading = options.leading || false;
    let trailing = options.trailing !== false;
    
    function invokeFunc(time) {
        const args = lastArgs;
        const thisArg = lastThis;
        
        lastArgs = null;
        lastThis = null;
        lastInvokeTime = time;
        
        func.apply(thisArg, args);
    }
    
    function leadingEdge(time) {
        lastInvokeTime = time;
        timeoutId = setTimeout(timerExpired, wait);
        if (leading) invokeFunc(time);
    }
    
    function remainingWait(time) {
        const timeSinceLastCall = time - lastCallTime;
        const timeSinceLastInvoke = time - lastInvokeTime;
        const timeWaiting = wait - timeSinceLastCall;
        
        return maxWait
            ? Math.min(timeWaiting, maxWait - timeSinceLastInvoke)
            : timeWaiting;
    }
    
    function shouldInvoke(time) {
        const timeSinceLastCall = time - lastCallTime;
        const timeSinceLastInvoke = time - lastInvokeTime;
        
        return (lastCallTime === null) ||
            (timeSinceLastCall >= wait) ||
            (timeSinceLastCall < 0) ||
            (maxWait && timeSinceLastInvoke >= maxWait);
    }
    
    function timerExpired() {
        const time = Date.now();
        if (shouldInvoke(time)) {
            return trailingEdge(time);
        }
        timeoutId = setTimeout(timerExpired, remainingWait(time));
    }
    
    function trailingEdge(time) {
        timeoutId = null;
        
        if (trailing && lastArgs) {
            invokeFunc(time);
        }
        lastArgs = null;
        lastThis = null;
    }
    
    function debounced(...args) {
        const time = Date.now();
        const isInvoking = shouldInvoke(time);
        
        lastArgs = args;
        lastThis = this;
        lastCallTime = time;
        
        if (isInvoking) {
            if (timeoutId === null) {
                leadingEdge(time);
            } else if (maxWait) {
                timeoutId = setTimeout(timerExpired, wait);
            }
        }
        
        return debounced;
    }
    
    debounced.cancel = function() {
        if (timeoutId !== null) {
            clearTimeout(timeoutId);
        }
        lastArgs = null;
        lastThis = null;
        lastCallTime = null;
        timeoutId = null;
    };
    
    debounced.flush = function() {
        if (timeoutId !== null) {
            trailingEdge(Date.now());
        }
    };
    
    return debounced;
}

// ============================================
// DEBOUNCE DECORATOR
// ============================================

function Debounce(wait = 300, options = {}) {
    return function(target, propertyKey, descriptor) {
        const originalMethod = descriptor.value;
        let debouncedFn = null;
        
        descriptor.value = function(...args) {
            if (!debouncedFn) {
                debouncedFn = debounce(originalMethod.bind(this), wait, options);
            }
            return debouncedFn(...args);
        };
        
        return descriptor;
    };
}

// ============================================
// REACT HOOK (if React is available)
// ============================================

if (typeof React !== 'undefined') {
    function useDebounce(value, delay = 500) {
        const [debouncedValue, setDebouncedValue] = React.useState(value);
        
        React.useEffect(() => {
            const timer = setTimeout(() => {
                setDebouncedValue(value);
            }, delay);
            
            return () => {
                clearTimeout(timer);
            };
        }, [value, delay]);
        
        return debouncedValue;
    }
    
    function useDebouncedCallback(callback, deps, delay = 500) {
        const callbackRef = React.useRef(callback);
        const timeoutRef = React.useRef(null);
        
        React.useEffect(() => {
            callbackRef.current = callback;
        }, [callback]);
        
        const debouncedCallback = React.useCallback((...args) => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
            
            timeoutRef.current = setTimeout(() => {
                callbackRef.current(...args);
            }, delay);
        }, [delay]);
        
        React.useEffect(() => {
            return () => {
                if (timeoutRef.current) {
                    clearTimeout(timeoutRef.current);
                }
            };
        }, []);
        
        return debouncedCallback;
    }
    
    window.useDebounce = useDebounce;
    window.useDebouncedCallback = useDebouncedCallback;
}

// ============================================
// EXPORTS
// ============================================

// Expose globally
window.debounce = debounce;
window.Debounce = Debounce;

export { debounce, Debounce };