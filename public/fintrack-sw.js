const CACHE_NAME = 'fintrack-shell-v5'
const SHELL_ASSETS = ['/fintrack-offline.html', '/fintrack-icon-192.png', '/fintrack-icon-512.png', '/fintrack-maskable-512.png', '/apple-touch-icon.png']

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith('fintrack-shell-') && key !== CACHE_NAME).map((key) => caches.delete(key)))).then(() => self.clients.claim()))
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/auth/')) return
  if (request.mode === 'navigate' && url.pathname.startsWith('/fintrack')) {
    event.respondWith(fetch(request).then((response) => response.status >= 500 ? caches.match('/fintrack-offline.html') : response).catch(() => caches.match('/fintrack-offline.html')))
  }
})
