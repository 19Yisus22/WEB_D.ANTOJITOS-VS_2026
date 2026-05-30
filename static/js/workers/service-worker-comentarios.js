const CACHE_NAME = 'dantojitos-comentarios-v2';
const STATIC_ASSETS = [
    '/comentarios_page',
    '/static/css/general_modules/style_comentarios.css',
    '/static/css/global_modules/style_navbar.css',
    '/static/css/global_modules/style_utils.css',
    '/static/js/general_js/comentarios.js',
    '/static/uploads/logo.ico',
    '/static/uploads/logo.png',
    '/static/uploads/default_icon_profile.png',
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css',
    'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.css',
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js'
];

const NETWORK_FIRST_ROUTES = [
    '/comentarios',
    '/usuarios_activos_conteo',
    '/actualizar_estado_comentarios'
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
        return await cache.match(request) || new Response(JSON.stringify({ error: 'Sin conexión' }), {
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

async function staleWhileRevalidate(request) {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);
    const fetchPromise = fetch(request).then(res => {
        if (res && res.status === 200) cache.put(request, res.clone());
        return res;
    }).catch(() => {
        if (request.mode === 'navigate') return cached || caches.match('/comentarios_page');
        return cached;
    });
    return cached || fetchPromise;
}
