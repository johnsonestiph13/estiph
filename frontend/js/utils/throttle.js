/**
 * ESTIF HOME ULTIMATE - THROTTLE UTILITY
 * Throttle function for limiting function call rate
 * Version: 2.0.0
 * Author: Estifanos Yohannis
 */

// ============================================
// THROTTLE IMPLEMENTATION
// ============================================

/**
 * Creates a throttled function that only invokes func at most once per every wait milliseconds
 * @param {Function} func - The function to throttle
 * @param {number} wait - The number of milliseconds to throttle invocations to
 * @param {Object} options - Options object
 * @param {boolean} options.leading - Specify invoking on the leading edge
 * @param {boolean} options.trailing - Specify invoking on the trailing edge
 * @returns {Function} - Throttled function
 */
function throttle(func, wait = 300, options = {}) {
    let timeoutId = null;
    let lastArgs = null;
    let lastThis = null;
    let lastCallTime = 0;
    let leading = options.leading !== false;
    let trailing = options.trailing !== false;
    
    function invokeFunc(time) {
        const args = lastArgs;
        const thisArg = lastThis;
        
        lastArgs = null;
        lastThis = null;
        lastCallTime = time;
        
        func.apply(thisArg, args);
    }
    
    function leadingEdge(time) {
        lastCallTime = time;
        timeoutId = setTimeout(timerExpired, wait);
        if (leading) invokeFunc(time);
    }
    
    function remainingWait(time) {
        const timeSinceLastCall = time - lastCallTime;
        return wait - timeSinceLastCall;
    }
    
    function shouldInvoke(time) {
        const timeSinceLastCall = time - lastCallTime;
        return timeSinceLastCall >= wait;
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
    
    function throttled(...args) {
        const time = Date.now();
        const isInvoking = shouldInvoke(time);
        
        lastArgs = args;
        lastThis = this;
        
        if (isInvoking) {
            if (timeoutId === null) {
                leadingEdge(time);
            }
            return;
        }
        
        if (trailing && timeoutId === null) {
            timeoutId = setTimeout(timerExpired, wait);
        }
    }
    
    throttled.cancel = function() {
        if (timeoutId !== null) {
            clearTimeout(timeoutId);
        }
        lastArgs = null;
        lastThis = null;
        lastCallTime = 0;
        timeoutId = null;
    };
    
    throttled.flush = function() {
        if (timeoutId !== null) {
            trailingEdge(Date.now());
        }
    };
    
    return throttled;
}

// ============================================
// RAF THROTTLE (RequestAnimationFrame)
// ============================================

function rafThrottle(func) {
    let ticking = false;
    
    function throttled(...args) {
        if (!ticking) {
            requestAnimationFrame(() => {
                func.apply(this, args);
                ticking = false;
            });
            ticking = true;
        }
    }
    
    throttled.cancel = function() {
        ticking = false;
    };
    
    return throttled;
}

// ============================================
// THROTTLE DECORATOR
// ============================================

function Throttle(wait = 300, options = {}) {
    return function(target, propertyKey, descriptor) {
        const originalMethod = descriptor.value;
        let throttledFn = null;
        
        descriptor.value = function(...args) {
            if (!throttledFn) {
                throttledFn = throttle(originalMethod.bind(this), wait, options);
            }
            return throttledFn(...args);
        };
        
        return descriptor;
    };
}

// ============================================
// REACT HOOK (if React is available)
// ============================================

if (typeof React !== 'undefined') {
    function useThrottledCallback(callback, deps, delay = 500) {
        const callbackRef = React.useRef(callback);
        const lastRun = React.useRef(Date.now());
        const timeoutRef = React.useRef(null);
        
        React.useEffect(() => {
            callbackRef.current = callback;
        }, [callback]);
        
        const throttledCallback = React.useCallback((...args) => {
            const now = Date.now();
            
            if (now - lastRun.current >= delay) {
                lastRun.current = now;
                callbackRef.current(...args);
            } else if (timeoutRef.current === null) {
                timeoutRef.current = setTimeout(() => {
                    lastRun.current = Date.now();
                    callbackRef.current(...args);
                    timeoutRef.current = null;
                }, delay - (now - lastRun.current));
            }
        }, [delay]);
        
        React.useEffect(() => {
            return () => {
                if (timeoutRef.current) {
                    clearTimeout(timeoutRef.current);
                }
            };
        }, []);
        
        return throttledCallback;
    }
    
    function useThrottledValue(value, delay = 500) {
        const [throttledValue, setThrottledValue] = React.useState(value);
        const lastRun = React.useRef(Date.now());
        const timeoutRef = React.useRef(null);
        
        React.useEffect(() => {
            const now = Date.now();
            
            if (now - lastRun.current >= delay) {
                lastRun.current = now;
                setThrottledValue(value);
            } else if (timeoutRef.current === null) {
                timeoutRef.current = setTimeout(() => {
                    lastRun.current = Date.now();
                    setThrottledValue(value);
                    timeoutRef.current = null;
                }, delay - (now - lastRun.current));
            }
        }, [value, delay]);
        
        React.useEffect(() => {
            return () => {
                if (timeoutRef.current) {
                    clearTimeout(timeoutRef.current);
                }
            };
        }, []);
        
        return throttledValue;
    }
    
    window.useThrottledCallback = useThrottledCallback;
    window.useThrottledValue = useThrottledValue;
}

// ============================================
// EXPORTS
// ============================================

// Expose globally
window.throttle = throttle;
window.rafThrottle = rafThrottle;
window.Throttle = Throttle;

export { throttle, rafThrottle, Throttle };