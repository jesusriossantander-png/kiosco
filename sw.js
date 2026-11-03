/* Service worker: la app funciona sin internet. Subí VERSION al publicar cambios. */
const VERSION = 'kiosco-v12';
const SHELL = [
  './', 'index.html', 'panel.html', 'cliente.html', 'js/landing.js', 'js/catalogo.js', 'manifest.json', 'manifest-cliente.json',
  'css/app.css', 'css/tienda.css', 'img/icon.svg', 'img/icon-192.png', 'img/icon-512.png',
  'js/kv.js', 'js/ui.js', 'js/db.js', 'js/hardware.js', 'js/scanner.js', 'js/app.js', 'js/cliente.js',
  'js/modules/caja.js', 'js/modules/pos.js', 'js/modules/productos.js', 'js/modules/stock.js', 'js/modules/precios.js',
  'js/modules/clientes.js', 'js/modules/proveedores.js', 'js/modules/reportes.js', 'js/modules/varios.js', 'js/modules/historial.js', 'js/modules/admin.js',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Catálogo: primero la red para tener precios al día
  if (url.pathname.endsWith('/data/catalogo.json')) {
    e.respondWith(fetch(req).then(r => { const copy = r.clone(); caches.open(VERSION).then(c => c.put(req, copy)); return r; }).catch(() => caches.match(req)));
    return;
  }
  // Librerías de CDN (cámara, Excel, QR): se guardan la primera vez que se usan
  if (url.origin !== location.origin) {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => { if (r.ok) { const copy = r.clone(); caches.open(VERSION).then(c => c.put(req, copy)); } return r; })));
    return;
  }
  // App: caché primero y actualización en segundo plano
  e.respondWith(caches.match(req, { ignoreSearch: true }).then(hit => {
    const net = fetch(req).then(r => { if (r.ok) { const copy = r.clone(); caches.open(VERSION).then(c => c.put(req, copy)); } return r; }).catch(() => hit);
    return hit || net;
  }));
});
