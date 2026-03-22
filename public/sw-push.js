import { precacheAndRoute } from 'workbox-precaching'
import { registerRoute } from 'workbox-routing'
import { NetworkFirst } from 'workbox-strategies'
import { ExpirationPlugin } from 'workbox-expiration'

// ── Workbox precaching (injected by vite-plugin-pwa) ─────────────────────────
precacheAndRoute(self.__WB_MANIFEST)

// ── Runtime caching for Supabase API ─────────────────────────────────────────
registerRoute(
  /^https:\/\/lbeivhmaesgissghtzzh\.supabase\.co\/.*/i,
  new NetworkFirst({
    cacheName: 'supabase-cache',
    plugins: [
      new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 }),
    ],
  })
)

// ── Push notifications ───────────────────────────────────────────────────────
self.addEventListener('push', (event) => {
  let data = { title: 'בן עזרי מרקט 🛒', body: 'הודעה חדשה' }
  try {
    if (event.data) data = event.data.json()
  } catch { /* fallback to defaults */ }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      dir: 'rtl',
      lang: 'he',
      vibrate: [200, 100, 200],
      tag: 'ben-ezri-market',
      renotify: true,
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus()
        }
      }
      return clients.openWindow('/')
    })
  )
})
