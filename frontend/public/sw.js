/**
 * ESTIF HOME ULTIMATE - SERVICE WORKER
 * Progressive Web App (PWA) with Offline Support
 * Version: 2.0.0
 * Author: Estifanos Yohannis
 */

const CACHE_NAME = 'estif-home-v2.0.0';
const OFFLINE_URL = '/offline.html';

// Assets to cache on install
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/offline.html',
    '/manifest.json',
    
    // CSS Files
    '/css/variables.css',
    '/css/base.css',
    '/css/utilities.css',
    '/css/main.css',
    '/css/animations.css',
    
    // Components CSS
    '/css/components/buttons.css',
    '/css/components/cards.css',
    '/css/components/modals.css',
    '/css/components/forms.css',
    '/css/components/tables.css',
    '/css/components/charts.css',
    '/css/components/device-card.css',
    '/css/components/voice-card.css',
    '/css/components/emergency-card.css',
    '/css/components/toast.css',
    '/css/components/dropdown.css',
    '/css/components/tabs.css',
    '/css/components/accordion.css',
    '/css/components/badge.css',
    '/css/components/tooltip.css',
    '/css/components/skeleton.css',
    
    // Layouts CSS
    '/css/layouts/sidebar.css',
    '/css/layouts/header.css',
    '/css/layouts/footer.css',
    '/css/layouts/grid.css',
    '/css/layouts/container.css',
    '/css/layouts/flex.css',
    
    // Pages CSS
    '/css/pages/dashboard.css',
    '/css/pages/analytics.css',
    '/css/pages/devices.css',
    '/css/pages/automation.css',
    '/css/pages/settings.css',
    '/css/pages/homes.css',
    '/css/pages/members.css',
    '/css/pages/profile.css',
    
    // Themes CSS
    '/css/themes/light.css',
    '/css/themes/dark.css',
    '/css/themes/amoled.css',
    '/css/themes/high-contrast.css',
    '/css/themes/sepia.css',
    '/css/themes/colorblind.css',
    
    // Responsive CSS
    '/css/responsive/mobile.css',
    '/css/responsive/tablet.css',
    '/css/responsive/desktop.css',
    '/css/responsive/tv.css',
    '/css/responsive/print.css',
    '/css/responsive/dark-mode-support.css',
    
    // JavaScript
    '/js/app.js',
    
    // Icons
    '/assets/icons/favicon.ico',
    '/assets/icons/icon-72.png',
    '/assets/icons/icon-96.png',
    '/assets/icons/icon-128.png',
    '/assets/icons/icon-144.png',
    '/assets/icons/icon-152.png',
    '/assets/icons/icon-192.png',
    '/assets/icons/icon-384.png',
    '/assets/icons/icon-512.png',
    '/assets/icons/apple-touch-icon.png',
    
    // Fonts
    'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap',
    'https://fonts.googleapis.com/css2?family=Noto+Sans+Ethiopic:wght@400;500;700&display=swap',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
    'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js'
];

// Dynamic API endpoints to cache
const API_CACHE = [
    '/api/health',
    '/api/devices',
    '/api/status'
];

// ============================================
// INSTALL EVENT - Cache static assets
// ============================================
self.addEventListener('install', (event) => {
    console.log('[Service Worker] Installing...');
    
    event.waitUntil(
        (async () => {
            const cache = await caches.open(CACHE_NAME);
            console.log('[Service Worker] Caching static assets');
            
            // Cache static assets with error handling
            const cachePromises = STATIC_ASSETS.map(async (asset) => {
                try {
                    const response = await fetch(asset);
                    if (response.ok) {
                        await cache.put(asset, response);
                    }
                } catch (error) {
                    console.log(`[Service Worker] Failed to cache: ${asset}`, error);
                }
            });
            
            await Promise.all(cachePromises);
            
            // Cache offline page separately
            const offlineResponse = await fetch(OFFLINE_URL);
            if (offlineResponse.ok) {
                await cache.put(OFFLINE_URL, offlineResponse);
            }
            
            console.log('[Service Worker] Installation complete');
        })()
    );
    
    // Force waiting service worker to become active
    self.skipWaiting();
});

// ============================================
// ACTIVATE EVENT - Clean up old caches
// ============================================
self.addEventListener('activate', (event) => {
    console.log('[Service Worker] Activating...');
    
    event.waitUntil(
        (async () => {
            const cacheNames = await caches.keys();
            const deletePromises = cacheNames.map((cacheName) => {
                if (cacheName !== CACHE_NAME) {
                    console.log(`[Service Worker] Deleting old cache: ${cacheName}`);
                    return caches.delete(cacheName);
                }
            });
            await Promise.all(deletePromises);
            
            console.log('[Service Worker] Now ready to handle fetch requests');
        })()
    );
    
    // Take control of all clients immediately
    self.clients.claim();
});

// ============================================
// FETCH EVENT - Network-first with cache fallback
// ============================================
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);
    
    // Skip non-GET requests
    if (request.method !== 'GET') {
        return;
    }
    
    // Skip Chrome extension requests
    if (url.protocol === 'chrome-extension:') {
        return;
    }
    
    // Handle API requests
    if (url.pathname.startsWith('/api/')) {
        event.respondWith(handleAPIRequest(request));
        return;
    }
    
    // Handle static assets (CSS, JS, Icons)
    if (STATIC_ASSETS.includes(url.pathname) || 
        url.pathname.startsWith('/css/') || 
        url.pathname.startsWith('/js/') ||
        url.pathname.startsWith('/assets/')) {
        event.respondWith(handleStaticRequest(request));
        return;
    }
    
    // Handle HTML pages
    if (request.mode === 'navigate') {
        event.respondWith(handleNavigationRequest(request));
        return;
    }
    
    // Default: network first, cache fallback
    event.respondWith(
        networkFirst(request)
    );
});

// ============================================
// HANDLE STATIC REQUESTS (Cache First)
// ============================================
async function handleStaticRequest(request) {
    const cache = await caches.open(CACHE_NAME);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
        // Return cached response and update cache in background
        fetch(request).then((networkResponse) => {
            if (networkResponse.ok) {
                cache.put(request, networkResponse);
            }
        }).catch(() => {});
        return cachedResponse;
    }
    
    // Fallback to network
    try {
        const networkResponse = await fetch(request);
        if (networkResponse.ok) {
            cache.put(request, networkResponse.clone());
        }
        return networkResponse;
    } catch (error) {
        console.log('[Service Worker] Failed to fetch static:', request.url);
        return new Response('Resource not available offline', {
            status: 404,
            statusText: 'Not Found'
        });
    }
}

// ============================================
// HANDLE API REQUESTS (Network First)
// ============================================
async function handleAPIRequest(request) {
    try {
        // Try network first
        const networkResponse = await fetch(request);
        
        // Cache successful API responses
        if (networkResponse.ok && API_CACHE.some(api => request.url.includes(api))) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, networkResponse.clone());
        }
        
        return networkResponse;
    } catch (error) {
        // Network failed, try cache
        const cache = await caches.open(CACHE_NAME);
        const cachedResponse = await cache.match(request);
        
        if (cachedResponse) {
            console.log('[Service Worker] Serving cached API response');
            return cachedResponse;
        }
        
        // Return offline status
        return new Response(JSON.stringify({
            success: false,
            error: 'You are offline. Please check your internet connection.',
            offline: true
        }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

// ============================================
// HANDLE NAVIGATION REQUESTS (Network First)
// ============================================
async function handleNavigationRequest(request) {
    try {
        // Try network first
        const networkResponse = await fetch(request);
        
        // Cache successful navigation response
        if (networkResponse.ok) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, networkResponse.clone());
        }
        
        return networkResponse;
    } catch (error) {
        // Network failed, try cache
        const cache = await caches.open(CACHE_NAME);
        const cachedResponse = await cache.match(request);
        
        if (cachedResponse) {
            console.log('[Service Worker] Serving cached navigation');
            return cachedResponse;
        }
        
        // Return offline page
        const offlineResponse = await cache.match(OFFLINE_URL);
        if (offlineResponse) {
            return offlineResponse;
        }
        
        return new Response('You are offline. Please reconnect.', {
            status: 503,
            statusText: 'Service Unavailable'
        });
    }
}

// ============================================
// NETWORK FIRST STRATEGY
// ============================================
async function networkFirst(request) {
    try {
        const networkResponse = await fetch(request);
        
        // Cache successful responses
        if (networkResponse.ok) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, networkResponse.clone());
        }
        
        return networkResponse;
    } catch (error) {
        const cache = await caches.open(CACHE_NAME);
        const cachedResponse = await cache.match(request);
        
        if (cachedResponse) {
            return cachedResponse;
        }
        
        return new Response('Resource not available offline', {
            status: 404,
            statusText: 'Not Found'
        });
    }
}

// ============================================
// CACHE FIRST STRATEGY (for static assets)
// ============================================
async function cacheFirst(request) {
    const cache = await caches.open(CACHE_NAME);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
        return cachedResponse;
    }
    
    try {
        const networkResponse = await fetch(request);
        if (networkResponse.ok) {
            cache.put(request, networkResponse.clone());
        }
        return networkResponse;
    } catch (error) {
        return new Response('Resource not available', { status: 404 });
    }
}

// ============================================
// SYNC EVENT - Background Sync for offline actions
// ============================================
self.addEventListener('sync', (event) => {
    console.log('[Service Worker] Sync event triggered:', event.tag);
    
    if (event.tag === 'sync-devices') {
        event.waitUntil(syncDevices());
    } else if (event.tag === 'sync-activity') {
        event.waitUntil(syncActivityLog());
    }
});

async function syncDevices() {
    console.log('[Service Worker] Syncing devices...');
    // Implement device sync logic
    const cache = await caches.open(CACHE_NAME);
    const pendingRequests = await cache.keys();
    
    for (const request of pendingRequests) {
        if (request.url.includes('/api/device/')) {
            try {
                const response = await fetch(request);
                if (response.ok) {
                    await cache.delete(request);
                }
            } catch (error) {
                console.log('[Service Worker] Failed to sync device request');
            }
        }
    }
}

async function syncActivityLog() {
    console.log('[Service Worker] Syncing activity logs...');
    // Implement activity log sync logic
}

// ============================================
// PUSH EVENT - Push Notifications
// ============================================
self.addEventListener('push', (event) => {
    console.log('[Service Worker] Push notification received');
    
    let data = {
        title: 'Estif Home',
        body: 'New notification from your smart home',
        icon: '/assets/icons/icon-192.png',
        badge: '/assets/icons/icon-72.png',
        vibrate: [200, 100, 200],
        actions: [
            { action: 'view', title: 'View' },
            { action: 'dismiss', title: 'Dismiss' }
        ]
    };
    
    if (event.data) {
        try {
            data = Object.assign(data, event.data.json());
        } catch (e) {
            data.body = event.data.text();
        }
    }
    
    event.waitUntil(
        self.registration.showNotification(data.title, {
            body: data.body,
            icon: data.icon,
            badge: data.badge,
            vibrate: data.vibrate,
            actions: data.actions,
            data: data.data || {},
            requireInteraction: data.requireInteraction || false,
            silent: data.silent || false
        })
    );
});

// ============================================
// NOTIFICATION CLICK EVENT
// ============================================
self.addEventListener('notificationclick', (event) => {
    console.log('[Service Worker] Notification clicked');
    
    event.notification.close();
    
    const action = event.action;
    const notificationData = event.notification.data;
    
    if (action === 'view') {
        event.waitUntil(
            clients.openWindow('/')
        );
    } else if (action === 'dismiss') {
        // Just close the notification
    } else {
        event.waitUntil(
            clients.openWindow('/')
        );
    }
});

// ============================================
// MESSAGE EVENT - Communication with main thread
// ============================================
self.addEventListener('message', (event) => {
    console.log('[Service Worker] Message received:', event.data);
    
    const { type, payload } = event.data;
    
    switch (type) {
        case 'SKIP_WAITING':
            self.skipWaiting();
            break;
        case 'CLEAR_CACHE':
            event.waitUntil(clearCache());
            break;
        case 'GET_CACHE_SIZE':
            event.waitUntil(getCacheSize(event));
            break;
        default:
            console.log('[Service Worker] Unknown message type:', type);
    }
});

async function clearCache() {
    const cacheNames = await caches.keys();
    const deletePromises = cacheNames.map((cacheName) => {
        if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
        }
    });
    await Promise.all(deletePromises);
    console.log('[Service Worker] Cache cleared');
}

async function getCacheSize(event) {
    const cache = await caches.open(CACHE_NAME);
    const keys = await cache.keys();
    let size = 0;
    
    for (const request of keys) {
        const response = await cache.match(request);
        const blob = await response.blob();
        size += blob.size;
    }
    
    event.ports[0].postMessage({ size: Math.round(size / 1024) });
}

// ============================================
// PERIODIC BACKGROUND SYNC (if supported)
// ============================================
if ('periodicSync' in self.registration) {
    self.addEventListener('periodicsync', (event) => {
        console.log('[Service Worker] Periodic sync:', event.tag);
        
        if (event.tag === 'update-devices') {
            event.waitUntil(updateDevicesPeriodically());
        }
    });
}

async function updateDevicesPeriodically() {
    console.log('[Service Worker] Periodic device update');
    // Implement periodic device status check
    const cache = await caches.open(CACHE_NAME);
    const response = await fetch('/api/devices');
    
    if (response.ok) {
        await cache.put('/api/devices', response);
    }
}

// ============================================
// VERSION CHECK & UPDATE
// ============================================
self.addEventListener('message', (event) => {
    if (event.data === 'CHECK_VERSION') {
        event.waitUntil(
            (async () => {
                const response = await fetch('/api/version');
                const { version } = await response.json();
                if (version !== CACHE_NAME.split('-')[2]) {
                    // New version available
                    self.registration.waiting.postMessage('UPDATE_AVAILABLE');
                }
            })()
        );
    }
});

// ============================================
// OFFLINE ANALYTICS
// ============================================
let offlineEvents = [];

self.addEventListener('fetch', (event) => {
    // Track offline requests for analytics
    if (!navigator.onLine && event.request.method === 'GET') {
        offlineEvents.push({
            url: event.request.url,
            timestamp: Date.now(),
            type: 'offline_request'
        });
        
        // Store offline events in IndexedDB when available
        storeOfflineEvent(event.request.url);
    }
});

async function storeOfflineEvent(url) {
    const db = await openDB();
    const tx = db.transaction('offlineEvents', 'readwrite');
    const store = tx.objectStore('offlineEvents');
    store.add({ url, timestamp: Date.now() });
    await tx.done;
}

function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('EstifHomeDB', 1);
        
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
        
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains('offlineEvents')) {
                db.createObjectStore('offlineEvents', { autoIncrement: true });
            }
        };
    });
}

// ============================================
// LOGGING
// ============================================
function log(message, data = null) {
    console.log(`[Service Worker] ${message}`, data ? data : '');
}