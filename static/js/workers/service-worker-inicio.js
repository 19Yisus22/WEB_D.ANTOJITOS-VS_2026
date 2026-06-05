/**
 * D'Antojitos — Service Worker: INICIO v4
 * Cubre: /inicio, publicaciones, config de inicio, carrito badge,
 *        widgets, tema y cambio de idioma sin errores.
 */
importScripts('/static/js/workers/sw-core.js');

const CACHE_NAME = 'dantojitos-inicio-v4';

const PRECACHE = [
    /* Páginas */
    '/inicio',
    /* CSS módulo */
    '/static/css/global_modules/style_inicio.css',
    /* CSS compartido */
    '/static/css/global_modules/style_utils.css',
    '/static/css/global_modules/style_navbar.css',
    '/static/css/global_modules/style_footer.css',
    '/static/css/global_modules/style_design_system.css',
    /* JS módulo */
    '/static/js/global_js/inicio.js',
    '/static/js/global_js/widget_system.js',
    /* JS compartido — i18n y tema incluidos para cambio instantáneo */
    '/static/js/global_js/utils.js',
    '/static/js/global_js/i18n.js',
    '/static/js/compiled/design-system.js',
    '/static/js/compiled/theme.js',
    /* Assets */
    '/static/uploads/logo.ico',
    '/static/uploads/logo.png',
    /* CDN */
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css',
    'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.css',
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js',
    'https://cdn.jsdelivr.net/npm/sortablejs@1.15.2/Sortable.min.js',
    'https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;0,9..40,800;1,9..40,700&display=swap',
];

/* APIs que deben ir siempre a red primero */
const NETWORK_FIRST_PATHS = [
    '/api/publicidad/activa',
    '/api/admin/notificaciones',
    '/api/inicio/config',
    '/api/carrito/cantidad',
    '/mensajes_privados',
    '/obtener-cliente-id',
    '/api/inicio/widgets',
    '/api/usuarios/estado',
];

const CDN_RE = /^https:\/\/(cdn\.jsdelivr\.net|fonts\.(googleapis|gstatic)\.com)/;
const IMG_RE = /^https:\/\/res\.cloudinary\.com\//;

/* ── Instalación: precaché inmediato ── */
self.addEventListener('install', e => {
    self.skipWaiting();
    e.waitUntil(precacheAssets(CACHE_NAME, PRECACHE));
});

/* ── Activación: limpia versiones antiguas y toma control ── */
self.addEventListener('activate', e => {
    e.waitUntil(cleanOldCaches(CACHE_NAME).then(() => self.clients.claim()));
});

/* ── Interceptor de fetch ── */
self.addEventListener('fetch', e => {
    const { request } = e;
    if (request.method !== 'GET') return;
    const url = new URL(request.url);

    /* CDN y fuentes — caché permanente */
    if (CDN_RE.test(request.url)) {
        e.respondWith(cacheFirst(request, CACHE_NAME)); return;
    }

    /* Imágenes Cloudinary — caché con actualización silenciosa */
    if (IMG_RE.test(request.url)) {
        e.respondWith(cacheFirstWithUpdate(request, CACHE_NAME)); return;
    }

    /* Estáticos propios — caché primero */
    if (url.pathname.startsWith('/static/')) {
        e.respondWith(cacheFirst(request, CACHE_NAME)); return;
    }

    /* APIs dinámicas — red primero, caché de emergencia */
    if (NETWORK_FIRST_PATHS.some(p => url.pathname.startsWith(p))) {
        e.respondWith(networkFirst(request, CACHE_NAME, FAST_TIMEOUT_MS)); return;
    }

    /* Página principal — stale-while-revalidate para carga instantánea */
    if (url.pathname === '/inicio' || url.pathname === '/') {
        e.respondWith(staleWhileRevalidate(request, CACHE_NAME)); return;
    }

    /* Todo lo demás — red primero con fallback a caché */
    e.respondWith(networkFirst(request, CACHE_NAME));
});
