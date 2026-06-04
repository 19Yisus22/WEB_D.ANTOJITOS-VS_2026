const CACHE_NAME = 'dantojitos-catalogo-v5';
const STATIC_ASSETS = [
    '/static/css/general_modules/style_catalogo.css',
    '/static/css/global_modules/style_navbar.css',
    '/static/css/global_modules/style_footer.css',
    '/static/css/global_modules/style_utils.css',
    '/static/js/general_js/catalogo.js',
    '/static/js/global_js/utils.js',
    '/static/uploads/logo.ico',
    '/static/uploads/logo.png',
    '/static/uploads/default.png',
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css',
    'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.css',
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js'
];

const NETWORK_ONLY_ROUTES = [
    '/obtener_catalogo',
    '/agregar_al_carrito',
    '/guardar_catalogo',
    '/obtener_carrito',
    '/api/publicidad/activa'
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

    if (NETWORK_ONLY_ROUTES.some(r => url.pathname.startsWith(r))) {
        event.respondWith(
            fetch(event.request).catch(() =>
                new Response(
                    JSON.stringify({ error: true, productos: [], message: 'Sin conexión al servidor.' }),
                    { headers: { 'Content-Type': 'application/json' } }
                )
            )
        );
        return;
    }

    event.respondWith(staleWhileRevalidate(event.request));
});

async function staleWhileRevalidate(request) {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);
    const fetchPromise = fetch(request).then(res => {
        if (res && res.status === 200) cache.put(request, res.clone());
        return res;
    }).catch(() => {
        if (request.mode === 'navigate') return cached || caches.match('/catalogo_page');
        return cached;
    });
    return cached || fetchPromise;
}

self.addEventListener('sync', event => {
    if (event.tag === 'sync-carrito') {
        event.waitUntil(sincronizarCarritoPendiente());
    }
});

async function sincronizarCarritoPendiente() {
    const cache = await caches.open('offline-requests');
    const requests = await cache.keys();
    return Promise.all(
        requests.map(async req => {
            try {
                const res = await fetch(req.clone());
                if (res.ok) await cache.delete(req);
            } catch {}
        })
    );
}
