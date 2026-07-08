// Service worker mínimo do LeadFarma — habilita instalação (PWA) e um cache leve
// dos assets estáticos. Sem cache agressivo do catálogo (preços/estoque mudam).
const CACHE = 'leadfarma-v1'
const ASSETS = ['/icon-192.png', '/icon-512.png', '/placeholder.svg']

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).catch(() => {}))
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))),
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  // assets estáticos: cache-first. resto: network-first com fallback ao cache.
  if (ASSETS.includes(url.pathname) || url.pathname.startsWith('/_next/static/')) {
    event.respondWith(caches.match(request).then((hit) => hit || fetch(request)))
    return
  }
  event.respondWith(
    fetch(request)
      .then((res) => {
        const copy = res.clone()
        caches.open(CACHE).then((c) => c.put(request, copy)).catch(() => {})
        return res
      })
      .catch(() => caches.match(request)),
  )
})
