importScripts('/static/js/workers/sw-core.js');

const CACHE_NAME = 'dantojitos-pedidos-v10';

const PRECACHE = [
    '/pedidos_page',
    '/static/css/admin_modules/style_pedidos.css',
    '/static/css/global_modules/style_utils.css',
    '/static/css/global_modules/style_navbar.css',
    '/static/css/global_modules/style_footer.css',
    '/static/css/global_modules/style_design_system.css',
    '/static/js/admin_js/pedidos.js',
    '/static/js/admin_js/pedidos_notif.js',
    '/static/js/global_js/logros.js',
    '/static/js/global_js/utils.js',
    '/static/js/global_js/i18n.js',
    '/static/js/compiled/design-system.js',
    '/static/js/compiled/theme.js',
    '/static/uploads/logo.ico',
    '/static/uploads/logo.ico',
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css',
    'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.css',
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js',
    'https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;0,9..40,800;1,9..40,700&display=swap',
];

const NETWORK_FIRST_PATHS = [
    '/api/pedidos',
    '/obtener_pedidos',
    '/mensajes_privados',
    '/api/notificaciones',
    '/listar_pedidos',
    '/cambiar_estado_pedido',
    '/api/pedidos/estado',
    '/api/admin/notificaciones',
    '/api/pedidos/detalle',
    '/api/mensajes',
    '/logros/verificar',
    '/logros/mis_logros',
];

const NEVER_CACHE = [
    '/stream_pedidos',
    '/api/pedidos/stream',
    '/sse/',
];

const CDN_RE = /^https:\/\/(cdn\.jsdelivr\.net|fonts\.(googleapis|gstatic)\.com|cdnjs\.cloudflare\.com)/;
const IMG_RE = /^https:\/\/res\.cloudinary\.com\
self.addEventListener('install', e => {
    self.skipWaiting();
    e.waitUntil(precacheAssets(CACHE_NAME, PRECACHE));
});

self.addEventListener('activate', e => {
    e.waitUntil(cleanOldCaches(CACHE_NAME).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
    const { request } = e;
    if (request.method !== 'GET') return;
    const url = new URL(request.url);

    if (NEVER_CACHE.some(p => url.pathname.startsWith(p))) return;

    if (CDN_RE.test(request.url)) {
        e.respondWith(cacheFirst(request, CACHE_NAME)); return;
    }
    if (IMG_RE.test(request.url)) {
        e.respondWith(cacheFirstWithUpdate(request, CACHE_NAME)); return;
    }
    if (url.pathname.startsWith('/static/')) {
        e.respondWith(cacheFirst(request, CACHE_NAME)); return;
    }
    if (NETWORK_FIRST_PATHS.some(p => url.pathname.startsWith(p))) {
        e.respondWith(networkFirst(request, CACHE_NAME, FAST_TIMEOUT_MS)); return;
    }
    if (url.pathname === '/pedidos_page') {
        e.respondWith(staleWhileRevalidate(request, CACHE_NAME)); return;
    }
    e.respondWith(networkFirst(request, CACHE_NAME));
});
