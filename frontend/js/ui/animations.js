/**
 * ESTIF HOME ULTIMATE - ANIMATIONS MODULE
 * Smooth animations, page transitions, and micro-interactions
 * Version: 2.0.0
 * Author: Estifanos Yohannis
 */

// ============================================
// ANIMATIONS CONFIGURATION
// ============================================

const AnimationsConfig = {
    // Default durations
    durations: {
        fast: 150,
        normal: 300,
        slow: 500,
        verySlow: 1000
    },
    
    // Easing functions
    easings: {
        linear: 'linear',
        ease: 'ease',
        easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
        easeOut: 'cubic-bezier(0, 0, 0.2, 1)',
        easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
        bounce: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)'
    },
    
    // Enable/disable based on reduced motion
    respectReducedMotion: true,
    
    // Debug
    debug: false
};

// ============================================
// ANIMATIONS MANAGER
// ============================================

class AnimationsManager {
    constructor() {
        this.animatingElements = new Set();
        this.prefersReducedMotion = false;
        this.listeners = [];
        
        this.init();
    }

    init() {
        this.detectReducedMotion();
        this.injectKeyframes();
        AnimationsConfig.debug && console.log('[Animations] Manager initialized');
    }

    detectReducedMotion() {
        if (!AnimationsConfig.respectReducedMotion) return;
        
        const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
        this.prefersReducedMotion = mediaQuery.matches;
        
        mediaQuery.addEventListener('change', (e) => {
            this.prefersReducedMotion = e.matches;
            this.notifyListeners('reduced_motion_changed', this.prefersReducedMotion);
        });
    }

    injectKeyframes() {
        const style = document.createElement('style');
        style.textContent = `
            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            
            @keyframes fadeInUp {
                from {
                    opacity: 0;
                    transform: translateY(20px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }
            
            @keyframes fadeInDown {
                from {
                    opacity: 0;
                    transform: translateY(-20px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }
            
            @keyframes fadeInLeft {
                from {
                    opacity: 0;
                    transform: translateX(-20px);
                }
                to {
                    opacity: 1;
                    transform: translateX(0);
                }
            }
            
            @keyframes fadeInRight {
                from {
                    opacity: 0;
                    transform: translateX(20px);
                }
                to {
                    opacity: 1;
                    transform: translateX(0);
                }
            }
            
            @keyframes scaleIn {
                from {
                    opacity: 0;
                    transform: scale(0.9);
                }
                to {
                    opacity: 1;
                    transform: scale(1);
                }
            }
            
            @keyframes slideInLeft {
                from {
                    transform: translateX(-100%);
                }
                to {
                    transform: translateX(0);
                }
            }
            
            @keyframes slideInRight {
                from {
                    transform: translateX(100%);
                }
                to {
                    transform: translateX(0);
                }
            }
            
            @keyframes slideInUp {
                from {
                    transform: translateY(100%);
                }
                to {
                    transform: translateY(0);
                }
            }
            
            @keyframes slideInDown {
                from {
                    transform: translateY(-100%);
                }
                to {
                    transform: translateY(0);
                }
            }
            
            @keyframes pulse {
                0% { transform: scale(1); }
                50% { transform: scale(1.05); }
                100% { transform: scale(1); }
            }
            
            @keyframes shake {
                0%, 100% { transform: translateX(0); }
                25% { transform: translateX(-5px); }
                75% { transform: translateX(5px); }
            }
            
            @keyframes spin {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
            }
            
            @keyframes bounce {
                0%, 100% { transform: translateY(0); }
                50% { transform: translateY(-10px); }
            }
            
            @keyframes glow {
                0% { text-shadow: 0 0 5px rgba(67, 97, 238, 0.5); }
                100% { text-shadow: 0 0 20px rgba(67, 97, 238, 0.8); }
            }
            
            @keyframes ripple {
                0% { transform: scale(0); opacity: 0.5; }
                100% { transform: scale(4); opacity: 0; }
            }
            
            @keyframes skeleton {
                0% { background-position: 200% 0; }
                100% { background-position: -200% 0; }
            }
        `;
        document.head.appendChild(style);
    }

    // ============================================
    // ANIMATION METHODS
    // ============================================

    animate(element, animation, options = {}) {
        if (this.prefersReducedMotion && options.respectMotion !== false) {
            if (options.callback) options.callback();
            return Promise.resolve();
        }
        
        const duration = options.duration || AnimationsConfig.durations.normal;
        const easing = options.easing || AnimationsConfig.easings.easeInOut;
        const delay = options.delay || 0;
        
        return new Promise((resolve) => {
            if (this.animatingElements.has(element)) {
                resolve();
                return;
            }
            
            this.animatingElements.add(element);
            
            element.style.animation = `${animation} ${duration}ms ${easing} ${delay}ms forwards`;
            
            const onEnd = () => {
                element.style.animation = '';
                this.animatingElements.delete(element);
                element.removeEventListener('animationend', onEnd);
                if (options.callback) options.callback();
                resolve();
            };
            
            element.addEventListener('animationend', onEnd, { once: true });
        });
    }

    fadeIn(element, options = {}) {
        element.style.opacity = '0';
        element.style.display = options.display || 'block';
        return this.animate(element, 'fadeIn', options);
    }

    fadeOut(element, options = {}) {
        return this.animate(element, 'fadeIn', { ...options, direction: 'reverse' })
            .then(() => {
                if (options.remove !== false) {
                    element.style.display = 'none';
                }
            });
    }

    fadeInUp(element, options = {}) {
        return this.animate(element, 'fadeInUp', options);
    }

    fadeInDown(element, options = {}) {
        return this.animate(element, 'fadeInDown', options);
    }

    fadeInLeft(element, options = {}) {
        return this.animate(element, 'fadeInLeft', options);
    }

    fadeInRight(element, options = {}) {
        return this.animate(element, 'fadeInRight', options);
    }

    slideInLeft(element, options = {}) {
        return this.animate(element, 'slideInLeft', options);
    }

    slideInRight(element, options = {}) {
        return this.animate(element, 'slideInRight', options);
    }

    slideInUp(element, options = {}) {
        return this.animate(element, 'slideInUp', options);
    }

    slideInDown(element, options = {}) {
        return this.animate(element, 'slideInDown', options);
    }

    scaleIn(element, options = {}) {
        return this.animate(element, 'scaleIn', options);
    }

    pulse(element, options = {}) {
        return this.animate(element, 'pulse', { duration: AnimationsConfig.durations.fast, ...options });
    }

    shake(element, options = {}) {
        return this.animate(element, 'shake', { duration: AnimationsConfig.durations.fast, ...options });
    }

    bounce(element, options = {}) {
        return this.animate(element, 'bounce', options);
    }

    spin(element, options = {}) {
        return this.animate(element, 'spin', { duration: AnimationsConfig.durations.slow, ...options });
    }

    glow(element, options = {}) {
        return this.animate(element, 'glow', options);
    }

    // ============================================
    // PAGE TRANSITIONS
    // ============================================

    async transitionPage(oldContent, newContent, options = {}) {
        const duration = options.duration || AnimationsConfig.durations.normal;
        
        // Fade out old content
        if (oldContent) {
            await this.fadeOut(oldContent, { duration: duration / 2 });
            oldContent.remove();
        }
        
        // Fade in new content
        if (newContent) {
            document.getElementById('app')?.appendChild(newContent);
            await this.fadeIn(newContent, { duration: duration / 2 });
        }
    }

    // ============================================
    // RIPPLE EFFECT
    // ============================================

    createRipple(event, element) {
        const rect = element.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height);
        const x = event.clientX - rect.left - size / 2;
        const y = event.clientY - rect.top - size / 2;
        
        const ripple = document.createElement('span');
        ripple.className = 'ripple-effect';
        ripple.style.width = `${size}px`;
        ripple.style.height = `${size}px`;
        ripple.style.left = `${x}px`;
        ripple.style.top = `${y}px`;
        
        element.style.position = 'relative';
        element.style.overflow = 'hidden';
        element.appendChild(ripple);
        
        setTimeout(() => ripple.remove(), 600);
    }

    // ============================================
    // SEQUENTIAL ANIMATIONS
    // ============================================

    async animateSequence(elements, animation, options = {}) {
        const stagger = options.stagger || 50;
        
        for (let i = 0; i < elements.length; i++) {
            await this.animate(elements[i], animation, { ...options, delay: i * stagger });
        }
    }

    async animateParallel(elements, animation, options = {}) {
        const promises = elements.map(el => this.animate(el, animation, options));
        await Promise.all(promises);
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
// CSS STYLES
// ============================================

const animationsStyles = `
    .ripple-effect {
        position: absolute;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.5);
        transform: scale(0);
        animation: ripple 0.6s ease-out;
        pointer-events: none;
    }
    
    [data-theme="dark"] .ripple-effect {
        background: rgba(255, 255, 255, 0.2);
    }
`;

// Inject styles
if (typeof document !== 'undefined') {
    const styleSheet = document.createElement('style');
    styleSheet.textContent = animationsStyles;
    document.head.appendChild(styleSheet);
}

// ============================================
// CREATE SINGLETON INSTANCE
// ============================================

const animations = new AnimationsManager();

// Expose globally
window.animations = animations;

export { animations, AnimationsManager, AnimationsConfig };