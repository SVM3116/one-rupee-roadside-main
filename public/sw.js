// Service Worker for Push Notifications
// Register this in your main app

const CACHE_NAME = 'one-rupee-v1';
const urlsToCache = [
  '/',
  '/index.html',
];

// Install event - cache resources
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(urlsToCache))
  );
});

// Fetch event - serve from cache, fallback to network
// Skip API requests to avoid mixed content issues
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Skip API requests - let them go directly to network
  // This prevents mixed content errors (HTTPS page -> HTTP API)
  if (url.pathname.startsWith('/api/') || url.pathname.includes('/api/')) {
    return; // Don't intercept API requests
  }
  
  event.respondWith(
    caches.match(event.request)
      .then((response) => response || fetch(event.request))
  );
});

// Push event - handle push notifications
self.addEventListener('push', (event) => {
  let notificationData = {
    title: 'One Rupee RapidFix',
    body: 'You have a new notification',
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    tag: 'one-rupee-notification',
    data: {},
  };

  if (event.data) {
    try {
      const data = event.data.json();
      notificationData = {
        ...notificationData,
        title: data.title || notificationData.title,
        body: data.message || data.body || notificationData.body,
        icon: data.icon || notificationData.icon,
        data: data.data || {},
      };
    } catch (e) {
      notificationData.body = event.data.text();
    }
  }

  event.waitUntil(
    self.registration.showNotification(notificationData.title, {
      body: notificationData.body,
      icon: notificationData.icon,
      badge: notificationData.badge,
      tag: notificationData.tag,
      data: notificationData.data,
      requireInteraction: false,
      silent: false,
    })
  );
});

// Notification click event - open app when notification is clicked
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const urlToOpen = event.notification.data.url || '/';

  event.waitUntil(
    clients.matchAll({
      type: 'window',
      includeUncontrolled: true,
    }).then((clientList) => {
      // Check if app is already open
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      // Open new window if app is not open
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

// Background sync for offline notifications (optional)
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-notifications') {
    event.waitUntil(
      // Sync notifications when back online
      Promise.resolve()
    );
  }
});

