/**
 * ESTIF HOME ULTIMATE - SPA ROUTER MODULE
 * Client-side routing with history API, guards, and lazy loading
 * Version: 2.0.0
 * Author: Estifanos Yohannis
 */

// ============================================
// ROUTER CONFIGURATION
// ============================================

const RouterConfig = {
    mode: 'history', // 'history' or 'hash'
    root: '/',
    defaultRoute: '/dashboard',
    useHash: false,
    enableLogging: false,
    lazyLoad: true,
    scrollBehavior: 'auto', // 'auto', 'smooth', or 'instant'
    transitionDuration: 300,
    routes: [],
    guards: [],
    notFoundRoute: '/404'
};

// ============================================
// ROUTE CLASS
// ============================================

class Route {
    constructor(options) {
        this.path = options.path;
        this.name = options.name || null;
        this.component = options.component;
        this.template = options.template || null;
        this.title = options.title || null;
        this.meta = options.meta || {};
        this.guards = options.guards || [];
        this.lazyLoad = options.lazyLoad !== undefined ? options.lazyLoad : RouterConfig.lazyLoad;
        this.children = options.children || [];
        this.redirect = options.redirect || null;
        this.loadingComponent = options.loadingComponent || null;
        this.errorComponent = options.errorComponent || null;
    }

    matches(path) {
        return this.matchPath(path) !== null;
    }

    matchPath(path) {
        // Convert route path to regex
        const routeRegex = this.pathToRegex(this.path);
        const match = path.match(routeRegex);
        if (!match) return null;
        
        // Extract params
        const params = {};
        const paramNames = this.getParamNames(this.path);
        for (let i = 0; i < paramNames.length; i++) {
            params[paramNames[i]] = match[i + 1];
        }
        
        return { params, query: this.parseQuery(path) };
    }

    pathToRegex(path) {
        const pattern = path
            .replace(/\/:([^\/]+)/g, '/([^/]+)')
            .replace(/\*/g, '.*');
        return new RegExp(`^${pattern}$`);
    }

    getParamNames(path) {
        const params = [];
        const matches = path.matchAll(/\/:([^\/]+)/g);
        for (const match of matches) {
            params.push(match[1]);
        }
        return params;
    }

    parseQuery(url) {
        const query = {};
        const queryString = url.split('?')[1];
        if (!queryString) return query;
        
        const pairs = queryString.split('&');
        for (const pair of pairs) {
            const [key, value] = pair.split('=');
            query[decodeURIComponent(key)] = decodeURIComponent(value || '');
        }
        return query;
    }

    generateUrl(params = {}) {
        let url = this.path;
        for (const [key, value] of Object.entries(params)) {
            url = url.replace(`:${key}`, encodeURIComponent(value));
        }
        return url;
    }
}

// ============================================
// ROUTER CLASS
// ============================================

class Router {
    constructor(options = {}) {
        this.routes = [];
        this.currentRoute = null;
        this.previousRoute = null;
        this.container = null;
        this.mode = options.mode || RouterConfig.mode;
        this.root = options.root || RouterConfig.root;
        this.defaultRoute = options.defaultRoute || RouterConfig.defaultRoute;
        this.notFoundRoute = options.notFoundRoute || RouterConfig.notFoundRoute;
        this.globalGuards = [];
        this.beforeEachGuards = [];
        this.afterEachGuards = [];
        this.onErrorHandlers = [];
        this.listeners = [];
        this.loading = false;
        this.transitioning = false;
        
        this.init(options);
    }

    // ============================================
    // INITIALIZATION
    // ============================================

    init(options = {}) {
        // Set container
        this.container = options.container || document.getElementById('app');
        
        // Bind event handlers
        this.handlePopState = this.handlePopState.bind(this);
        this.handleLinkClick = this.handleLinkClick.bind(this);
        
        // Add event listeners
        window.addEventListener('popstate', this.handlePopState);
        document.addEventListener('click', this.handleLinkClick);
        
        // Initialize routes from config
        if (options.routes && Array.isArray(options.routes)) {
            this.addRoutes(options.routes);
        }
        
        // Initial navigation
        this.initNavigation();
        
        RouterConfig.enableLogging && console.log('[Router] Initialized');
    }

    initNavigation() {
        const path = this.getCurrentPath();
        const route = this.findRoute(path);
        
        if (route && route.redirect) {
            this.navigate(route.redirect, { replace: true });
        } else if (route) {
            this.navigate(path, { replace: true });
        } else {
            this.navigate(this.defaultRoute, { replace: true });
        }
    }

    // ============================================
    // ROUTE MANAGEMENT
    // ============================================

    addRoute(routeConfig) {
        const route = new Route(routeConfig);
        this.routes.push(route);
        
        // Add child routes
        if (route.children && route.children.length) {
            for (const child of route.children) {
                child.path = route.path + child.path;
                this.addRoute(child);
            }
        }
        
        return route;
    }

    addRoutes(routes) {
        for (const routeConfig of routes) {
            this.addRoute(routeConfig);
        }
    }

    removeRoute(path) {
        const index = this.routes.findIndex(r => r.path === path);
        if (index !== -1) {
            this.routes.splice(index, 1);
        }
    }

    findRoute(path) {
        // Remove query string
        const pathWithoutQuery = path.split('?')[0];
        
        // Try exact match first
        let route = this.routes.find(r => r.path === pathWithoutQuery);
        if (route) return route;
        
        // Try pattern match
        for (const r of this.routes) {
            if (r.matches(pathWithoutQuery)) {
                return r;
            }
        }
        
        return null;
    }

    // ============================================
    // NAVIGATION
    // ============================================

    async navigate(path, options = {}) {
        if (this.transitioning && !options.force) {
            RouterConfig.enableLogging && console.log('[Router] Navigation blocked - transition in progress');
            return false;
        }
        
        // Normalize path
        path = this.normalizePath(path);
        
        // Run global guards
        for (const guard of this.globalGuards) {
            const result = await guard(path, this.currentRoute);
            if (result === false) return false;
            if (typeof result === 'string') {
                return this.navigate(result, options);
            }
        }
        
        // Run beforeEach guards
        for (const guard of this.beforeEachGuards) {
            const result = await guard(path, this.currentRoute);
            if (result === false) return false;
            if (typeof result === 'string') {
                return this.navigate(result, options);
            }
        }
        
        const route = this.findRoute(path);
        
        // Handle 404
        if (!route) {
            return this.navigate(this.notFoundRoute, options);
        }
        
        // Handle redirect
        if (route.redirect) {
            return this.navigate(route.redirect, options);
        }
        
        // Run route-specific guards
        for (const guard of route.guards) {
            const result = await guard(path, this.currentRoute);
            if (result === false) return false;
            if (typeof result === 'string') {
                return this.navigate(result, options);
            }
        }
        
        // Update history
        this.updateHistory(path, options);
        
        // Load and render route
        await this.loadRoute(route, path, options);
        
        // Update current route
        this.previousRoute = this.currentRoute;
        this.currentRoute = {
            path,
            route,
            params: route.matchPath(path)?.params || {},
            query: route.matchPath(path)?.query || {}
        };
        
        // Update document title
        this.updateTitle(route);
        
        // Scroll to top
        this.scrollToTop(options);
        
        // Run afterEach guards
        for (const guard of this.afterEachGuards) {
            await guard(path, this.currentRoute);
        }
        
        // Notify listeners
        this.notifyListeners();
        
        RouterConfig.enableLogging && console.log(`[Router] Navigated to: ${path}`);
        return true;
    }

    async loadRoute(route, path, options = {}) {
        this.loading = true;
        this.transitioning = true;
        
        // Show loading indicator
        this.showLoading();
        
        try {
            // Lazy load component if needed
            let component = route.component;
            if (route.lazyLoad && typeof component === 'function') {
                component = await component();
                component = component.default || component;
            }
            
            // Hide loading indicator
            this.hideLoading();
            
            // Render component
            await this.render(component, route, path, options);
            
        } catch (error) {
            this.hideLoading();
            this.handleError(error, route);
        } finally {
            this.loading = false;
            setTimeout(() => {
                this.transitioning = false;
            }, RouterConfig.transitionDuration);
        }
    }

    async render(component, route, path, options) {
        if (!this.container) return;
        
        // Add transition class
        this.container.classList.add('page-transition-out');
        
        // Wait for transition
        await this.wait(RouterConfig.transitionDuration / 2);
        
        // Render component
        if (typeof component === 'function') {
            const element = component({
                route: this.currentRoute,
                params: route.matchPath(path)?.params || {},
                query: route.matchPath(path)?.query || {},
                navigate: this.navigate.bind(this)
            });
            
            if (typeof element === 'string') {
                this.container.innerHTML = element;
            } else if (element instanceof HTMLElement) {
                this.container.innerHTML = '';
                this.container.appendChild(element);
            }
        } else if (typeof route.template === 'string') {
            this.container.innerHTML = route.template;
        }
        
        // Apply translations
        if (window.I18nHTML) {
            window.I18nHTML.translatePage();
        }
        
        // Remove transition class
        this.container.classList.remove('page-transition-out');
        this.container.classList.add('page-transition-in');
        
        setTimeout(() => {
            this.container.classList.remove('page-transition-in');
        }, RouterConfig.transitionDuration);
    }

    // ============================================
    // HISTORY MANAGEMENT
    // ============================================

    getCurrentPath() {
        if (this.mode === 'hash') {
            let hash = window.location.hash.slice(1);
            return hash || this.defaultRoute;
        }
        
        let path = window.location.pathname;
        if (this.root !== '/' && path.startsWith(this.root)) {
            path = path.slice(this.root.length);
        }
        return path || this.defaultRoute;
    }

    normalizePath(path) {
        if (!path) return this.defaultRoute;
        
        // Ensure path starts with /
        if (!path.startsWith('/')) {
            path = '/' + path;
        }
        
        // Remove trailing slash
        if (path !== '/' && path.endsWith('/')) {
            path = path.slice(0, -1);
        }
        
        return path;
    }

    updateHistory(path, options) {
        const url = this.generateUrl(path);
        
        if (options.replace) {
            window.history.replaceState({ path }, '', url);
        } else {
            window.history.pushState({ path }, '', url);
        }
    }

    generateUrl(path) {
        if (this.mode === 'hash') {
            return `#${path}`;
        }
        return this.root === '/' ? path : this.root + path;
    }

    handlePopState(event) {
        const path = this.getCurrentPath();
        this.navigate(path, { replace: true });
    }

    handleLinkClick(event) {
        const target = event.target.closest('a');
        if (!target) return;
        
        // Check if link should be handled by router
        const href = target.getAttribute('href');
        if (!href) return;
        
        // Skip external links
        if (target.target === '_blank') return;
        if (href.startsWith('http') && !href.startsWith(window.location.origin)) return;
        if (href.startsWith('#')) return;
        if (href.startsWith('mailto:')) return;
        if (href.startsWith('tel:')) return;
        
        // Prevent default behavior
        event.preventDefault();
        
        // Extract path
        let path = href;
        if (this.mode === 'hash') {
            path = href.split('#')[1] || this.defaultRoute;
        } else if (href.startsWith(window.location.origin)) {
            path = href.slice(window.location.origin.length);
        }
        
        // Navigate
        this.navigate(path);
    }

    // ============================================
    // GUARDS & HOOKS
    // ============================================

    beforeEach(guard) {
        this.beforeEachGuards.push(guard);
        return () => {
            const index = this.beforeEachGuards.indexOf(guard);
            if (index !== -1) this.beforeEachGuards.splice(index, 1);
        };
    }

    afterEach(guard) {
        this.afterEachGuards.push(guard);
        return () => {
            const index = this.afterEachGuards.indexOf(guard);
            if (index !== -1) this.afterEachGuards.splice(index, 1);
        };
    }

    onError(handler) {
        this.onErrorHandlers.push(handler);
        return () => {
            const index = this.onErrorHandlers.indexOf(handler);
            if (index !== -1) this.onErrorHandlers.splice(index, 1);
        };
    }

    addGlobalGuard(guard) {
        this.globalGuards.push(guard);
    }

    // ============================================
    // EVENT LISTENERS
    // ============================================

    onRouteChange(callback) {
        this.listeners.push(callback);
        return () => {
            const index = this.listeners.indexOf(callback);
            if (index !== -1) this.listeners.splice(index, 1);
        };
    }

    notifyListeners() {
        for (const listener of this.listeners) {
            listener(this.currentRoute);
        }
    }

    // ============================================
    // UTILITY METHODS
    // ============================================

    updateTitle(route) {
        let title = route.title || route.meta?.title || 'Estif Home Ultimate';
        
        if (this.currentRoute?.params && route.title) {
            for (const [key, value] of Object.entries(this.currentRoute.params)) {
                title = title.replace(`:${key}`, value);
            }
        }
        
        document.title = title;
    }

    scrollToTop(options = {}) {
        const behavior = options.scrollBehavior || RouterConfig.scrollBehavior;
        window.scrollTo({
            top: 0,
            left: 0,
            behavior: behavior === 'smooth' ? 'smooth' : 'auto'
        });
    }

    showLoading() {
        const loader = document.getElementById('router-loader');
        if (loader) {
            loader.style.display = 'flex';
        }
    }

    hideLoading() {
        const loader = document.getElementById('router-loader');
        if (loader) {
            loader.style.display = 'none';
        }
    }

    handleError(error, route) {
        RouterConfig.enableLogging && console.error('[Router] Error:', error);
        
        for (const handler of this.onErrorHandlers) {
            handler(error, route);
        }
        
        // Show error message
        if (this.container) {
            this.container.innerHTML = `
                <div class="error-container">
                    <div class="error-icon">⚠️</div>
                    <h2>Something went wrong</h2>
                    <p>${error.message || 'Failed to load page'}</p>
                    <button onclick="location.reload()">Retry</button>
                </div>
            `;
        }
    }

    wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // ============================================
    // HELPER METHODS
    // ============================================

    goBack() {
        window.history.back();
    }

    goForward() {
        window.history.forward();
    }

    replace(path) {
        return this.navigate(path, { replace: true });
    }

    push(path) {
        return this.navigate(path);
    }

    getCurrentRoute() {
        return this.currentRoute;
    }

    getPreviousRoute() {
        return this.previousRoute;
    }

    // ============================================
    // CLEANUP
    // ============================================

    destroy() {
        window.removeEventListener('popstate', this.handlePopState);
        document.removeEventListener('click', this.handleLinkClick);
        this.routes = [];
        this.listeners = [];
        RouterConfig.enableLogging && console.log('[Router] Destroyed');
    }
}

// ============================================
// ROUTE GUARDS
// ============================================

class RouteGuards {
    static requireAuth(to, from) {
        const isAuthenticated = localStorage.getItem('currentUser') !== null;
        
        if (!isAuthenticated && to !== '/login' && to !== '/register') {
            return '/login';
        }
        
        if (isAuthenticated && (to === '/login' || to === '/register')) {
            return '/dashboard';
        }
        
        return true;
    }

    static requireAdmin(to, from) {
        const user = JSON.parse(localStorage.getItem('currentUser') || '{}');
        
        if (user.role !== 'admin') {
            return '/dashboard';
        }
        
        return true;
    }

    static requireHomeAccess(to, from, params) {
        const user = JSON.parse(localStorage.getItem('currentUser') || '{}');
        const homeId = params.homeId;
        
        // Check if user has access to this home
        if (!user.homes?.includes(homeId) && user.role !== 'admin') {
            return '/homes';
        }
        
        return true;
    }

    static rateLimit(limit = 10, window = 60000) {
        const requests = new Map();
        
        return (to, from) => {
            const now = Date.now();
            const userRequests = requests.get(to) || [];
            const recentRequests = userRequests.filter(t => now - t < window);
            
            if (recentRequests.length >= limit) {
                console.warn('Rate limit exceeded for route:', to);
                return false;
            }
            
            recentRequests.push(now);
            requests.set(to, recentRequests);
            return true;
        };
    }
}

// ============================================
// LAZY LOADING HELPERS
// ============================================

const lazyLoad = (importFn) => {
    return () => importFn();
};

const lazyLoadComponent = (componentName) => {
    return lazyLoad(() => import(`/components/pages/${componentName}.js`));
};

// ============================================
// ROUTE DEFINITIONS
// ============================================

const Routes = [
    {
        path: '/',
        redirect: '/dashboard'
    },
    {
        path: '/dashboard',
        name: 'dashboard',
        title: 'Dashboard - Estif Home',
        component: () => import('/pages/dashboard.js'),
        meta: { requiresAuth: true },
        guards: [RouteGuards.requireAuth]
    },
    {
        path: '/devices',
        name: 'devices',
        title: 'Devices - Estif Home',
        component: () => import('/pages/devices.js'),
        meta: { requiresAuth: true },
        guards: [RouteGuards.requireAuth]
    },
    {
        path: '/devices/:id',
        name: 'device-detail',
        title: 'Device Details - Estif Home',
        component: () => import('/pages/device-detail.js'),
        meta: { requiresAuth: true },
        guards: [RouteGuards.requireAuth]
    },
    {
        path: '/automation',
        name: 'automation',
        title: 'Automation - Estif Home',
        component: () => import('/pages/automation.js'),
        meta: { requiresAuth: true },
        guards: [RouteGuards.requireAuth]
    },
    {
        path: '/analytics',
        name: 'analytics',
        title: 'Analytics - Estif Home',
        component: () => import('/pages/analytics.js'),
        meta: { requiresAuth: true },
        guards: [RouteGuards.requireAuth]
    },
    {
        path: '/settings',
        name: 'settings',
        title: 'Settings - Estif Home',
        component: () => import('/pages/settings.js'),
        meta: { requiresAuth: true },
        guards: [RouteGuards.requireAuth]
    },
    {
        path: '/homes',
        name: 'homes',
        title: 'Homes - Estif Home',
        component: () => import('/pages/homes.js'),
        meta: { requiresAuth: true },
        guards: [RouteGuards.requireAuth]
    },
    {
        path: '/homes/:homeId',
        name: 'home-detail',
        title: 'Home Details - Estif Home',
        component: () => import('/pages/home-detail.js'),
        meta: { requiresAuth: true },
        guards: [RouteGuards.requireAuth, RouteGuards.requireHomeAccess]
    },
    {
        path: '/members',
        name: 'members',
        title: 'Members - Estif Home',
        component: () => import('/pages/members.js'),
        meta: { requiresAuth: true },
        guards: [RouteGuards.requireAuth]
    },
    {
        path: '/profile',
        name: 'profile',
        title: 'Profile - Estif Home',
        component: () => import('/pages/profile.js'),
        meta: { requiresAuth: true },
        guards: [RouteGuards.requireAuth]
    },
    {
        path: '/login',
        name: 'login',
        title: 'Login - Estif Home',
        component: () => import('/pages/login.js'),
        meta: { requiresAuth: false }
    },
    {
        path: '/register',
        name: 'register',
        title: 'Register - Estif Home',
        component: () => import('/pages/register.js'),
        meta: { requiresAuth: false }
    },
    {
        path: '/help',
        name: 'help',
        title: 'Help - Estif Home',
        component: () => import('/pages/help.js'),
        meta: { requiresAuth: false }
    },
    {
        path: '/404',
        name: '404',
        title: '404 - Page Not Found',
        component: () => import('/pages/404.js'),
        meta: { requiresAuth: false }
    },
    {
        path: '*',
        redirect: '/404'
    }
];

// ============================================
// CREATE ROUTER INSTANCE
// ============================================

const router = new Router({
    routes: Routes,
    container: document.getElementById('router-view'),
    mode: 'history',
    defaultRoute: '/dashboard',
    notFoundRoute: '/404',
    enableLogging: false
});

// Add global auth guard
router.beforeEach(RouteGuards.requireAuth);

// Add route change listener
router.onRouteChange((route) => {
    RouterConfig.enableLogging && console.log('Route changed:', route);
});

// ============================================
// EXPORTS
// ============================================

// Expose to window
window.router = router;
window.Router = Router;
window.RouteGuards = RouteGuards;

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { router, Router, Routes, RouteGuards, lazyLoad, lazyLoadComponent };
}