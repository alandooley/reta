// Service Worker for Injection Tracker PWA
const VERSION = '1.1.0';
const CACHE_NAME = `injection-tracker-v${VERSION}`;
const CACHE_ASSETS = [
  './',
  './index.html',
  './manifest.json'
];
const CDN_ASSETS = [
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.min.js',
  'https://cdn.jsdelivr.net/npm/chartjs-adapter-date-fns@3.0.0/dist/chartjs-adapter-date-fns.bundle.min.js'
];
const urlsToCache = [...CACHE_ASSETS, ...CDN_ASSETS];

// Install event - cache resources
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        // Cache files individually to handle failures gracefully
        return Promise.allSettled(
          urlsToCache.map(url => {
            return cache.add(url).catch(error => {
              console.warn(`Failed to cache ${url}:`, error);
              return null;
            });
          })
        );
      })
      .then(() => {
        console.log('Cache installation completed');
        self.skipWaiting();
      })
      .catch(error => {
        console.error('Cache install failed:', error);
      })
  );
});

// Fetch event - serve from cache when offline with network-first strategy for API calls
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Network-first for API calls and dynamic content
  if (url.pathname.includes('/api/') || request.method !== 'GET') {
    event.respondWith(
      fetch(request)
        .then(response => {
          // Clone and cache successful responses
          if (response.ok) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(request, responseClone);
            });
          }
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Cache-first for static assets
  event.respondWith(
    caches.match(request)
      .then(response => {
        if (response) {
          // Update cache in background
          fetch(request).then(freshResponse => {
            if (freshResponse.ok) {
              caches.open(CACHE_NAME).then(cache => {
                cache.put(request, freshResponse);
              });
            }
          }).catch(() => {});
          return response;
        }

        // Fetch from network
        return fetch(request)
          .then(response => {
            if (response.ok) {
              const responseClone = response.clone();
              caches.open(CACHE_NAME).then(cache => {
                cache.put(request, responseClone);
              });
            }
            return response;
          });
      })
      .catch(error => {
        console.error('Fetch failed:', error);
        // Return offline fallback for documents
        if (request.destination === 'document') {
          return caches.match('/index.html');
        }
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  console.log(`Service Worker ${VERSION} activated`);
  event.waitUntil(
    Promise.all([
      // Clean up old caches
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            if (cacheName !== CACHE_NAME) {
              console.log('Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      }),
      // Take control of all clients immediately
      self.clients.claim()
    ])
  );
});

// Handle background sync for data synchronization
self.addEventListener('sync', event => {
  if (event.tag === 'background-sync') {
    event.waitUntil(
      // Perform background sync operations
      console.log('Background sync triggered')
    );
  }
});

// Handle push notifications (for injection reminders)
self.addEventListener('push', event => {
  const options = {
    body: event.data ? event.data.text() : 'Time for your next injection!',
    icon: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="64" height="64"%3E%3Crect width="64" height="64" fill="%231a1a1a"/%3E%3Ctext x="50%25" y="50%25" font-family="sans-serif" font-size="16" fill="white" text-anchor="middle" dominant-baseline="central"%3ESR%3C/text%3E%3C/svg%3E',
    badge: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="32" height="32"%3E%3Crect width="32" height="32" fill="%23007AFF"/%3E%3Ctext x="50%25" y="50%25" font-family="sans-serif" font-size="16" fill="white" text-anchor="middle" dominant-baseline="central"%3E💉%3C/text%3E%3C/svg%3E',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    actions: [
      {
        action: 'explore',
        title: 'Open App',
        icon: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="24" height="24"%3E%3Crect width="24" height="24" fill="%23007AFF"/%3E%3C/svg%3E'
      },
      {
        action: 'close',
        title: 'Dismiss',
        icon: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="24" height="24"%3E%3Crect width="24" height="24" fill="%23888888"/%3E%3C/svg%3E'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification('Injection Tracker', options)
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', event => {
  event.notification.close();

  if (event.action === 'explore') {
    // Open the app
    event.waitUntil(
      clients.openWindow('/')
    );
  } else if (event.action === 'close') {
    // Just close the notification
    return;
  } else {
    // Default action - open the app
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});

// Handle messages from the main app
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});