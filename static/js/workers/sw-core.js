

const SW_VERSION      = 'v4';
const PREFS_CACHE     = 'dantojitos-prefs-v4';
const API_TIMEOUT_MS  = 3500;
const FAST_TIMEOUT_MS = 2000;

const CDN_ASSETS = [
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css',
    'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.css',
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js',
    'https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;0,9..40,800;1,9..40,700&display=swap',
];

const SHARED_STATIC = [
    '/static/css/global_modules/style_utils.css',
    '/static/css/global_modules/style_navbar.css',
    '/static/css/global_modules/style_footer.css',
    '/static/css/global_modules/style_design_system.css',
    '/static/js/global_js/utils.js',
    '/static/js/global_js/i18n.js',
    '/static/js/compiled/design-system.js',
    '/static/js/compiled/theme.js',
    '/static/uploads/logo.ico',
    '/static/uploads/logo.png',
];



async function _openCache(name) { return caches.open(name); }

function _isCacheable(res) { return res && res.status === 200 && res.type !== 'opaque'; }


async function broadcastAll(data) {
    const clients = await self.clients.matchAll({ includeUncontrolled: true, type: 'window' });
    clients.forEach(c => c.postMessage(data));
}


async function cacheFirst(req, cacheName) {
    const cache  = await _openCache(cacheName);
    const cached = await cache.match(req);
    if (cached) return cached;
    try {
        const res = await fetch(req);
        if (_isCacheable(res)) cache.put(req, res.clone());
        return res;
    } catch {
        return new Response('', { status: 503, headers: { 'X-Offline': '1' } });
    }
}


async function cacheFirstWithUpdate(req, cacheName) {
    const cache  = await _openCache(cacheName);
    const cached = await cache.match(req);
    fetch(req).then(res => {
        if (_isCacheable(res)) cache.put(req, res.clone());
    }).catch(() => {});
    if (cached) return cached;
    try {
        const res = await fetch(req);
        if (_isCacheable(res)) cache.put(req, res.clone());
        return res;
    } catch {
        return new Response('', { status: 503, headers: { 'X-Offline': '1' } });
    }
}


async function networkFirst(req, cacheName, timeoutMs = API_TIMEOUT_MS) {
    const cache = await _openCache(cacheName);
    try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        const res = await fetch(req, { signal: controller.signal });
        clearTimeout(timer);
        if (res && res.status < 400) cache.put(req, res.clone());
        return res;
    } catch {
        const cached = await cache.match(req);
        if (cached) return cached;
        const isNav = req.mode === 'navigate';
        const isApi = req.url.includes('/api/');
        return new Response(
            isApi
                ? JSON.stringify({ ok: false, offline: true, error: 'Sin conexión' })
                : offlinePage(isNav),
            {
                status: isApi ? 503 : 200,
                headers: {
                    'Content-Type': isApi ? 'application/json' : 'text/html; charset=utf-8',
                    'X-Offline': '1',
                },
            }
        );
    }
}


async function staleWhileRevalidate(req, cacheName) {
    const cache  = await _openCache(cacheName);
    const cached = await cache.match(req);
    const fetchPromise = fetch(req).then(res => {
        if (_isCacheable(res)) cache.put(req, res.clone());
        return res;
    }).catch(() => cached);
    return cached ?? fetchPromise;
}


function offlinePage(isNav = true) {
    if (!isNav) return '';
    return `<!DOCTYPE html><html lang="es" data-theme="light"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>D'Antojitos — Sin conexión</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
:root{--bg:linear-gradient(135deg,#fff9f5,#ffecd8);--card:#fff;--text:#1a1a2e;--sub:#6c757d;--accent:#d35400;--btn:linear-gradient(135deg,#d35400,#e67e22)}
[data-theme="dark"]{--bg:linear-gradient(135deg,#0d0d0d,#1a1010);--card:#1a1a1a;--text:#e8e8e8;--sub:#888;--accent:#f0883e}
body{font-family:'DM Sans',system-ui,sans-serif;min-height:100vh;display:flex;align-items:center;justify-content:center;background:var(--bg);color:var(--text);transition:background .3s}
.wrap{text-align:center;padding:3rem 2rem;background:var(--card);border-radius:28px;box-shadow:0 24px 64px rgba(211,84,0,.14);max-width:440px;width:90%;border:1px solid rgba(211,84,0,.1)}
.icon{font-size:3.5rem;margin-bottom:1.2rem;display:block}
h1{font-size:1.5rem;font-weight:800;margin-bottom:.6rem;color:var(--text)}
p{font-size:.9rem;color:var(--sub);margin-bottom:2rem;line-height:1.6}
.brand{font-weight:900;color:var(--accent);display:block;margin-bottom:1.5rem;font-size:1.1rem;letter-spacing:.5px}
a{display:inline-block;padding:.8rem 2.2rem;background:var(--btn);color:#fff;text-decoration:none;border-radius:50px;font-weight:700;font-size:.9rem;transition:transform .2s,box-shadow .2s}
a:hover{transform:translateY(-2px);box-shadow:0 10px 28px rgba(211,84,0,.3)}
</style></head>
<body>
<div class="wrap">
  <span class="brand">D'Antojitos©</span>
  <span class="icon">📡</span>
  <h1>Sin conexión</h1>
  <p>No hay conexión a internet. El contenido se mostrará desde la caché cuando esté disponible.</p>
  <a onclick="location.reload()">Reintentar</a>
</div>
<script>
const t=localStorage.getItem('dantojitos_theme')||'light';
document.documentElement.setAttribute('data-theme',t);
</script>
</body></html>`;
}


async function precacheAssets(cacheName, assets) {
    const cache = await _openCache(cacheName);
    return Promise.allSettled(
        assets.map(url =>
            fetch(url, { cache: 'no-cache' })
                .then(res => { if (_isCacheable(res)) cache.put(url, res); })
                .catch(() => {})
        )
    );
}


async function cleanOldCaches(currentCache) {
    const keys    = await caches.keys();
    const prefix  = currentCache.replace(/-v\d+$/, '');
    return Promise.all(
        keys
            .filter(k => k !== currentCache && k.startsWith(prefix))
            .map(k => caches.delete(k))
    );
}


self.addEventListener('message', async event => {
    const { data } = event;
    if (!data) return;

    switch (data.type) {
        case 'SKIP_WAITING':
            self.skipWaiting();
            break;

        case 'CACHE_THEME': {
            const cache = await _openCache(PREFS_CACHE);
            await cache.put('/sw-prefs/theme', new Response(
                JSON.stringify({ theme: data.theme, ts: Date.now() }),
                { headers: { 'Content-Type': 'application/json' } }
            ));

            broadcastAll({ type: 'THEME_UPDATED', theme: data.theme });
            break;
        }

        case 'CACHE_LANG': {
            const cache = await _openCache(PREFS_CACHE);
            await cache.put('/sw-prefs/lang', new Response(
                JSON.stringify({ lang: data.lang, ts: Date.now() }),
                { headers: { 'Content-Type': 'application/json' } }
            ));

            broadcastAll({ type: 'LANG_UPDATED', lang: data.lang });
            break;
        }

        case 'GET_PREFS': {
            const cache = await _openCache(PREFS_CACHE);
            const [themeRes, langRes] = await Promise.all([
                cache.match('/sw-prefs/theme'),
                cache.match('/sw-prefs/lang'),
            ]);
            const theme = themeRes ? (await themeRes.json()).theme : null;
            const lang  = langRes  ? (await langRes.json()).lang  : null;
            event.source?.postMessage({ type: 'PREFS_DATA', theme, lang });
            break;
        }

        case 'CLEAR_MODULE_CACHE': {
            if (data.cacheName) await caches.delete(data.cacheName);
            break;
        }
    }
});
