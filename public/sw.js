const CACHE = 'panela-v1'
const urls = ['/dashboard', '/lancamentos', '/novo-lancamento', '/contas-a-pagar', '/churrasco', '/fechamento', '/configuracoes']

self.addEventListener('install', (e: any) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(urls)))
  self.skipWaiting()
})

self.addEventListener('activate', (e: any) => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE).map(k => caches.delete(k))
    ))
  )
  self.clients.claim()
})

self.addEventListener('fetch', (e: any) => {
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  )
})
