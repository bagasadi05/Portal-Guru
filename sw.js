const CACHE_NAME = 'guru-pwa-cache-v3';
const RUNTIME_CACHE = 'guru-runtime-cache-v3';
const IMAGE_CACHE = 'guru-image-cache-v3';

const APP_SHELL_URLS = [
    '/',
    '/index.html',
    '/favicon.svg',
    '/manifest.webmanifest',
    '/logo.svg'
];

const MAX_CACHE_AGE = 7 * 24 * 60 * 60 * 1000;
const MAX_IMAGES = 50;

// Install: cache the app shell
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('Service Worker: Caching App Shell');
                return cache.addAll(APP_SHELL_URLS);
            })
            .then(() => self.skipWaiting()) // Activate new SW immediately
    );
});

self.addEventListener('activate', (event) => {
    const validCaches = [CACHE_NAME, RUNTIME_CACHE, IMAGE_CACHE];
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (!validCaches.includes(cacheName)) {
                        console.log('Service Worker: Clearing old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    return self.clients.claim();
});

self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET' ||
        event.request.url.startsWith('chrome-extension://') ||
        event.request.url.includes('/api/') ||
        event.request.url.includes('supabase.co')) {
        return;
    }

    const url = new URL(event.request.url);
    const isImage = /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(url.pathname);
    const isAppShell = APP_SHELL_URLS.some(path => url.pathname === path || url.pathname.endsWith(path));

    if (isAppShell) {
        event.respondWith(
            caches.match(event.request).then(response => {
                return response || fetch(event.request).then(fetchResponse => {
                    return caches.open(CACHE_NAME).then(cache => {
                        cache.put(event.request, fetchResponse.clone());
                        return fetchResponse;
                    });
                });
            })
        );
    } else if (isImage) {
        event.respondWith(
            caches.open(IMAGE_CACHE).then(cache => {
                return cache.match(event.request).then(response => {
                    if (response) return response;

                    return fetch(event.request).then(fetchResponse => {
                        if (fetchResponse && fetchResponse.status === 200) {
                            cache.put(event.request, fetchResponse.clone());
                            limitCacheSize(IMAGE_CACHE, MAX_IMAGES);
                        }
                        return fetchResponse;
                    }).catch(() => null);
                });
            })
        );
    } else {
        event.respondWith(
            caches.open(RUNTIME_CACHE).then(cache => {
                return cache.match(event.request).then(cachedResponse => {
                    const fetchPromise = fetch(event.request).then(networkResponse => {
                        if (networkResponse && networkResponse.status === 200) {
                            cache.put(event.request, networkResponse.clone());
                        }
                        return networkResponse;
                    }).catch(() => cachedResponse);

                    return cachedResponse || fetchPromise;
                });
            })
        );
    }
});

async function limitCacheSize(cacheName, maxItems) {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    if (keys.length > maxItems) {
        await cache.delete(keys[0]);
        await limitCacheSize(cacheName, maxItems);
    }
}

// Existing notification logic
let timeoutIds = [];
const dayMap = { 'Senin': 1, 'Selasa': 2, 'Rabu': 3, 'Kamis': 4, 'Jumat': 5, 'Sabtu': 6, 'Minggu': 0 };

function showNotification(item) {
    const className = item.className || item.class_id; 
    self.registration.showNotification('Pengingat Kelas: ' + item.subject, {
        body: 'Kelas ' + className + ' akan dimulai pada pukul ' + item.start_time + '.',
        icon: '/logo.svg', // Use new SVG logo for notifications
        requireInteraction: true,
        tag: item.id,
    });
}

function scheduleNotifications(schedule) {
    clearScheduledNotifications();
    const now = new Date();
    const todayIndex = now.getDay();
    const upcomingClasses = schedule.filter(item => {
        if (dayMap[item.day] !== todayIndex) return false;
        const [hours, minutes] = item.start_time.split(':');
        const classTime = new Date();
        classTime.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0);
        return classTime > now;
    });
    upcomingClasses.forEach(item => {
        const [hours, minutes] = item.start_time.split(':');
        const classTime = new Date();
        classTime.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0);
        // Remind 5 minutes before
        const notificationTime = new Date(classTime.getTime() - 5 * 60 * 1000);
        if (notificationTime > now) {
            const delay = notificationTime.getTime() - now.getTime();
            const id = setTimeout(() => {
                showNotification(item);
            }, delay);
            timeoutIds.push(id);
        }
    });
}

function clearScheduledNotifications() {
    timeoutIds.forEach(clearTimeout);
    timeoutIds = [];
}

self.addEventListener('message', (event) => {
    if (event.data) {
        if (event.data.type === 'SCHEDULE_UPDATED') {
            scheduleNotifications(event.data.payload);
        } else if (event.data.type === 'CLEAR_SCHEDULE') {
            clearScheduledNotifications();
        }
    }
});