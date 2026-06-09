importScripts('/static/js/workers/sw-core.js');

const CACHE_NAME = 'dantojitos-ui-v1';

const PRECACHE = [
    '/gestion_usuarios_page',
    '/gestionar_facturas_page',
    '/todas_facturas_page',
    '/manual_page',
    '/static/css/admin_modules/style_gestion_usuarios.css',
    '/static/css/admin_modules/style_manual.css',
    '/static/css/general_modules/style_facturas.css',
    '/static/css/global_modules/style_utils.css',
    '/static/css/global_modules/style_navbar.css',
    '/static/css/global_modules/style_footer.css',
    '/static/css/global_modules/style_design_system.css',
    '/static/js/admin_js/gestion_usuarios.js',
    '/static/js/admin_js/manual.js',
    '/static/js/general_js/facturas.js',
    '/static/js/global_js/utils.js',
    '/static/js/global_js/i18n.js',
    '/static/js/compiled/design-system.js',
    '/static/js/compiled/theme.js',
    '/static/uploads/logo.ico',
    '/static/uploads/logo.png',
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css',
    'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.css',
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js',
    'https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;0,9..40,800;1,9..40,700&display=swap',
];

const NETWORK_FIRST_PATHS = [
    '/obtener_usuarios',
    '/editar_usuario',
    '/eliminar_usuario',
    '/bloquear_usuario',
    '/obtener_facturas_page',
    '/buscar_facturas_page',
    '/api/',
];

const CDN_RE = /^https:\/\/(cdn\.jsdelivr\.net|fonts\.(googleapis|gstatic)\.com)/;

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

    if (CDN_RE.test(request.url)) {
        e.respondWith(cacheFirst(request, CACHE_NAME));
        return;
    }

    if (NETWORK_FIRST_PATHS.some(p => url.pathname.startsWith(p))) {
        e.respondWith(networkFirst(request, CACHE_NAME));
        return;
    }

    if (url.pathname.startsWith('/static/css/') || url.pathname.startsWith('/static/js/compiled/')) {
        e.respondWith(staleWhileRevalidate(request, CACHE_NAME));
        return;
    }

    if (url.pathname.startsWith('/static/js/') || url.pathname.startsWith('/static/uploads/')) {
        e.respondWith(cacheFirst(request, CACHE_NAME));
        return;
    }

    if (request.mode === 'navigate') {
        e.respondWith(networkFirst(request, CACHE_NAME, 4000));
    }
});
