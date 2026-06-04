const CACHE_NAME = 'dantojitos-facturacion-v4';
const STATIC_ASSETS = [
    '/static/css/admin_modules/style_facturacion.css',
    '/static/css/global_modules/style_navbar.css',
    '/static/css/global_modules/style_utils.css',
    '/static/js/admin_js/facturacion.js',
    '/static/js/global_js/utils.js',
    '/static/js/global_js/widget_system.js',
    '/static/uploads/logo.ico',
    '/static/uploads/logo.png',
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css',
    'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.css',
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js',
    'https://cdn.jsdelivr.net/npm/sortablejs@1.15.2/Sortable.min.js'
];

const NETWORK_FIRST_ROUTES = [
    '/facturacion_page',
    '/obtener_metodos_pago',
    '/actualizar_metodo_pago/',
    '/eliminar_metodo_pago/',
    '/cloudinary_storage_info'
];

self.addEventListener('install', event => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache =>
            Promise.allSettled(
                STATIC_ASSETS.map(url =>
                    fetch(url).then(res => { if (res.ok) cache.put(url, res); }).catch(() => {})
                )
            )
        )
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
        ).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', event => {
    if (event.request.method !== 'GET') return;

    const url = new URL(event.request.url);

    if (NETWORK_FIRST_ROUTES.some(r => url.pathname.startsWith(r))) {
        event.respondWith(networkFirst(event.request));
        return;
    }

    event.respondWith(staleWhileRevalidate(event.request));
});

async function networkFirst(request) {
    const cache = await caches.open(CACHE_NAME);
    try {
        const res = await fetch(request);
        if (res.ok) cache.put(request, res.clone());
        return res;
    } catch {
        return await cache.match(request) || new Response(
            JSON.stringify({ error: 'Sin conexión' }),
            { headers: { 'Content-Type': 'application/json' } }
        );
    }
}

async function staleWhileRevalidate(request) {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);
    const fetchPromise = fetch(request).then(res => {
        if (res && res.status === 200) cache.put(request, res.clone());
        return res;
    }).catch(() => cached);
    return cached || fetchPromise;
}
