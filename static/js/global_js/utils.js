
(function() {
    'use strict';
    if (window.DA) return;

    var _ua  = navigator.userAgent;
    var _taq = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

    var _disposit = {
        esMovil:  /Mobi|Android|iPhone|iPod/i.test(_ua),
        esTablet: /iPad|Tablet/i.test(_ua) || (_taq && !/Mobi|Android|iPhone|iPod/i.test(_ua) && window.screen.width >= 600),
        esTV:     /TV|SmartTV|WebOS|Tizen|CrKey|SMART-TV/i.test(_ua) || (window.screen.width >= 1920 && !_taq && (window.devicePixelRatio || 1) <= 1),
        esTactil: _taq,
        esIOS:    /iPad|iPhone|iPod/.test(_ua) && !window.MSStream,
        esAndroid:/Android/.test(_ua),
        dpr:      window.devicePixelRatio || 1,
    };
    _disposit.tipo = _disposit.esTV ? 'tv'
        : _disposit.esTablet ? 'tablet'
        : _disposit.esMovil  ? 'movil'
        : 'escritorio';

    var _pantalla = {
        ancho:        function() { return window.innerWidth; },
        alto:         function() { return window.innerHeight; },
        esHorizontal: function() { return window.innerWidth > window.innerHeight; },
        punto: function() {
            var w = window.innerWidth;
            if (w < 360)  return 'xs';
            if (w < 600)  return 'sm';
            if (w < 1024) return 'md';
            if (w < 1440) return 'lg';
            if (w < 1920) return 'xl';
            return '2xl';
        },
    };

    function _actualizarVars() {
        var r = document.documentElement;
        r.style.setProperty('--da-1vh', (window.innerHeight * 0.01) + 'px');
        r.setAttribute('data-da-bp', _pantalla.punto());
    }

    var _reducido = typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    var _obsAnim = (!_reducido && typeof IntersectionObserver !== 'undefined')
        ? new IntersectionObserver(function(entries) {
            entries.forEach(function(e) {
                if (e.isIntersecting) {
                    e.target.classList.add('da-visible');
                    _obsAnim.unobserve(e.target);
                }
            });
          }, { threshold: 0.1, rootMargin: '0px 0px -30px 0px' })
        : null;

    var _bus = {};

    window.DA = {
        dispositivo: _disposit,
        pantalla:    _pantalla,
        en: function(ev, fn) { (_bus[ev] = _bus[ev] || []).push(fn); },
        emitir: function(ev, d) { (_bus[ev] || []).forEach(function(f) { f(d); }); },
        quitar: function(ev, fn) {
            if (!fn) { _bus[ev] = []; return; }
            _bus[ev] = (_bus[ev] || []).filter(function(f) { return f !== fn; });
        },
        anim: {
            observar: function(el) {
                if (!_obsAnim || !el) return;
                if (el.forEach) { el.forEach(function(e) { _obsAnim.observe(e); }); }
                else { _obsAnim.observe(el); }
            },
            activar: function(sel) {
                if (!_obsAnim) return;
                document.querySelectorAll(sel || '[data-da-anim]').forEach(function(e) { _obsAnim.observe(e); });
            },
        },
    };

    function _clasesCuerpo() {
        var b = document.body;
        if (!b) return;
        b.classList.add('da-' + _disposit.tipo);
        if (_disposit.esTactil) b.classList.add('da-tactil');
        if (_disposit.esIOS)    b.classList.add('da-ios');
        if (_disposit.esAndroid) b.classList.add('da-android');
        if (_disposit.esTV)     b.classList.add('da-tv');
        b.setAttribute('data-da-bp', _pantalla.punto());
    }

    function _observarDinamicos() {
        if (!_obsAnim || typeof MutationObserver === 'undefined') return;
        new MutationObserver(function(mutations) {
            mutations.forEach(function(m) {
                m.addedNodes.forEach(function(n) {
                    if (n.nodeType !== 1) return;
                    if (n.hasAttribute && n.hasAttribute('data-da-anim')) _obsAnim.observe(n);
                    if (n.querySelectorAll) n.querySelectorAll('[data-da-anim]').forEach(function(e) { _obsAnim.observe(e); });
                });
            });
        }).observe(document.body, { childList: true, subtree: true });
    }

    _actualizarVars();

    var _rt = null;
    window.addEventListener('resize', function() {
        clearTimeout(_rt);
        _rt = setTimeout(function() {
            _actualizarVars();
            if (document.body) document.body.setAttribute('data-da-bp', _pantalla.punto());
            window.DA.emitir('resize', { ancho: window.innerWidth, alto: window.innerHeight, punto: _pantalla.punto() });
        }, 100);
    }, { passive: true });

    window.addEventListener('orientationchange', function() {
        setTimeout(function() {
            _actualizarVars();
            window.DA.emitir('orientacion', { horizontal: _pantalla.esHorizontal() });
        }, 350);
    }, { passive: true });

    function _iniciar() {
        _clasesCuerpo();
        window.DA.anim.activar();
        _observarDinamicos();
        window.DA.emitir('listo', { dispositivo: _disposit, pantalla: _pantalla });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', _iniciar);
    } else {
        _iniciar();
    }
})();

function fmtCOP(n) {
    return Number(n).toLocaleString('es-CO', {
        style: 'currency', currency: 'COP', maximumFractionDigits: 0
    });
}

const _alertaDedup = new Map();

function mostrarAlerta(mensaje, esError = false, duracionMs = 4000) {

    const ahora = Date.now();
    const expira = _alertaDedup.get(mensaje);
    if (expira && ahora < expira) return;
    _alertaDedup.set(mensaje, ahora + duracionMs + 300);
    setTimeout(() => _alertaDedup.delete(mensaje), duracionMs + 400);

    let container = document.getElementById('toastContainer');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toastContainer';
        container.style.cssText = 'position:fixed;top:25px;right:25px;z-index:10000;display:flex;flex-direction:column;gap:10px;pointer-events:none;max-width:420px;width:calc(100vw - 40px);';
        document.body.appendChild(container);
    }

    _playNotifSound(esError ? 'error' : 'default');

    const isDark      = document.documentElement.getAttribute('data-theme') === 'dark';
    const color       = esError ? '#ff4757' : '#2ed573';
    const bgSurface   = isDark ? '#1e1e1e' : '#ffffff';
    const textMain    = isDark ? '#e8e8e8' : '#1a1a1a';
    const textMuted   = isDark ? '#888'    : '#747d8c';
    const shadow      = isDark
        ? `0 12px 36px rgba(0,0,0,0.5)`
        : `0 10px 30px ${esError ? 'rgba(255,71,87,0.18)' : 'rgba(46,213,115,0.18)'}`;

    const toast = document.createElement('div');
    toast.style.cssText = `
        background:${bgSurface};
        color:${textMain};
        padding:14px 18px;
        border-radius:16px;
        box-shadow:${shadow};
        display:flex;
        align-items:center;
        gap:14px;
        border-left:5px solid ${color};
        pointer-events:auto;
        transition:transform 0.4s cubic-bezier(0.175,0.885,0.32,1.275), opacity 0.35s ease;
        transform:translateX(110%);
        opacity:0;
        overflow:hidden;
        position:relative;
    `;

    toast.innerHTML = `
        <div style="
            width:38px;height:38px;min-width:38px;
            border-radius:50%;
            background:${color};
            display:flex;align-items:center;justify-content:center;
            flex-shrink:0;
            box-shadow:0 0 0 5px ${color}22;
        ">
            <i class="bi ${esError ? 'bi-x-lg' : 'bi-check-lg'}" style="
                color:#fff;
                font-size:1rem;
                font-weight:900;
                line-height:1;
                display:flex;align-items:center;justify-content:center;
                width:100%;height:100%;
            "></i>
        </div>
        <div style="flex:1;min-width:0;">
            <strong style="display:block;font-size:0.7rem;text-transform:uppercase;letter-spacing:0.6px;color:${textMuted};margin-bottom:2px;">
                ${esError ? 'Error' : 'Sistema'}
            </strong>
            <span style="font-size:0.9rem;font-weight:600;line-height:1.3;word-break:break-word;">${mensaje}</span>
        </div>
        <button class="btn-close-toast" style="
            background:none;border:none;cursor:pointer;
            padding:6px;border-radius:8px;
            color:${textMuted};font-size:0.8rem;
            flex-shrink:0;line-height:1;
            transition:background 0.15s, color 0.15s;
        " onmouseenter="this.style.background='${color}22';this.style.color='${color}'"
           onmouseleave="this.style.background='none';this.style.color='${textMuted}'">
            <i class="bi bi-x-lg"></i>
        </button>`;

    container.appendChild(toast);

    requestAnimationFrame(() => requestAnimationFrame(() => {
        toast.style.transform = 'translateX(0)';
        toast.style.opacity   = '1';
    }));

    const eliminar = () => {
        toast.style.transform = 'translateX(110%)';
        toast.style.opacity   = '0';
        setTimeout(() => toast.remove(), 400);
    };
    toast.querySelector('.btn-close-toast').onclick = eliminar;
    setTimeout(eliminar, duracionMs);
}

const _SS_NOTIF_IDS_KEY = '_dantojitos_snotif_ids';

function _ssNotifIdSet() {
    try { return new Set(JSON.parse(sessionStorage.getItem(_SS_NOTIF_IDS_KEY) || '[]')); }
    catch { return new Set(); }
}
function _ssNotifIdAdd(id, duracion) {
    const set = _ssNotifIdSet();
    set.add(id);
    try { sessionStorage.setItem(_SS_NOTIF_IDS_KEY, JSON.stringify([...set])); }
    catch {}
    setTimeout(() => {
        const s2 = _ssNotifIdSet(); s2.delete(id);
        try { sessionStorage.setItem(_SS_NOTIF_IDS_KEY, JSON.stringify([...s2])); } catch {}
    }, duracion + 1500);
}

function mostrarAlertaPublica({
    mensaje    = '',
    titulo     = '',
    imagen     = '/static/uploads/logo.ico',
    tipo       = 'info',
    duracion   = 4000,
    idUnico    = null,
    sonido     = true,
    url        = null
} = {}) {
    if (idUnico && _ssNotifIdSet().has(idUnico)) return;
    if (idUnico) _ssNotifIdAdd(idUnico, duracion);

    let cont = document.getElementById('toastContainer');
    if (!cont) {
        cont = document.createElement('div');
        cont.id = 'toastContainer';
        document.body.appendChild(cont);
    }
    cont.style.cssText = `
        position:fixed;top:72px;left:16px;z-index:10000;
        display:flex;flex-direction:column;gap:8px;
        max-width:340px;width:calc(100vw - 32px);pointer-events:none;`;

    if (sonido) _playNotifSound(tipo === 'error' || tipo === 'warning' ? 'error' : 'default');

    const esError       = tipo === 'error' || tipo === 'warning';
    const isDark        = document.documentElement.getAttribute('data-theme') === 'dark';
    const accentColor   = esError ? '#e53935' :
                          tipo === 'favorito'   ? '#e91e8c' :
                          tipo === 'bienvenida' ? '#27ae60' :
                          tipo === 'success'    ? '#27ae60' : '#d35400';
    const iconClass     = esError            ? 'bi-exclamation-triangle-fill' :
                          tipo === 'favorito' ? 'bi-heart-fill'               :
                          tipo === 'bienvenida'? 'bi-stars'        :
                          tipo === 'success'  ? 'bi-check-circle-fill'        : 'bi-megaphone-fill';
    const tituloFinal   = titulo || (esError ? 'Aviso' : "D'Antojitos");
    const bgToast       = isDark ? 'rgba(22,22,26,0.97)' : 'rgba(255,255,255,0.97)';
    const textMain      = isDark ? '#f0f0f0' : '#1a1a1a';
    const textSub       = isDark ? '#999' : '#555';
    const borderImg     = isDark ? '#333' : '#eee';

    const toast = document.createElement('div');
    toast.style.cssText = `
        background:${bgToast};
        padding:11px 14px;border-radius:14px;
        box-shadow:0 6px 24px rgba(0,0,0,0.13),0 1px 6px rgba(0,0,0,0.07);
        display:flex;align-items:center;gap:11px;
        border-left:3px solid ${accentColor};
        backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);
        transition:transform 0.35s cubic-bezier(0.175,0.885,0.32,1.275),opacity 0.28s ease;
        transform:translateX(-110%);opacity:0;pointer-events:auto;
        cursor:${url ? 'pointer' : 'default'};min-width:0;width:100%;box-sizing:border-box;`;

    toast.innerHTML = `
        <div style="position:relative;flex-shrink:0;">
            <img src="${imagen}"
                 style="width:40px;height:40px;object-fit:cover;border-radius:9px;
                        border:1.5px solid ${borderImg};display:block;"
                 onerror="this.src='/static/uploads/logo.ico'">
            <div style="position:absolute;bottom:-3px;right:-3px;background:${accentColor};
                        width:16px;height:16px;border-radius:50%;display:flex;align-items:center;
                        justify-content:center;border:2px solid ${isDark ? '#16161a' : '#fff'};">
                <i class="bi ${iconClass}" style="color:#fff;font-size:0.5rem;line-height:1;"></i>
            </div>
        </div>
        <div style="flex:1;min-width:0;">
            <strong style="display:block;font-size:0.65rem;text-transform:uppercase;
                           color:${accentColor};letter-spacing:0.7px;font-weight:800;
                           word-break:break-word;">${tituloFinal}</strong>
            <div style="font-size:0.8rem;font-weight:400;color:${textSub};line-height:1.35;
                        word-break:break-word;">${mensaje}</div>
        </div>
        <button class="btn-close-toast"
                style="background:none;border:none;color:${textSub};cursor:pointer;
                       padding:2px 4px;font-size:0.75rem;flex-shrink:0;line-height:1;
                       opacity:0.6;transition:opacity 0.15s;">
            <i class="bi bi-x-lg"></i>
        </button>`;

    cont.appendChild(toast);
    requestAnimationFrame(() => requestAnimationFrame(() => {
        toast.style.transform = 'translateX(0)';
        toast.style.opacity   = '1';
    }));

    const remove = () => {
        toast.style.transform = 'translateX(-110%)';
        toast.style.opacity   = '0';
        setTimeout(() => toast.remove(), 380);
    };
    const closeBtn = toast.querySelector('.btn-close-toast');
    closeBtn.onmouseenter = () => closeBtn.style.opacity = '1';
    closeBtn.onmouseleave = () => closeBtn.style.opacity = '0.6';
    closeBtn.onclick = (e) => { e.stopPropagation(); remove(); };
    if (url) {
        toast.addEventListener('click', (e) => {
            if (!e.target.closest('.btn-close-toast')) {
                remove();
                setTimeout(() => { window.location.href = url; }, 160);
            }
        });
    }
    setTimeout(remove, duracion);
}

function mostrarConfirmacionApp(titulo, mensaje, onConfirm) {
    const existing = document.getElementById('appModalConfirm');
    if (existing) existing.remove();

    const isDark   = document.documentElement.getAttribute('data-theme') === 'dark';
    const bgCard   = isDark ? '#1a1a1a' : '#ffffff';
    const textH    = isDark ? '#e8e8e8' : '#1a1a1a';
    const textBody = isDark ? '#aaa'    : '#555';
    const borderC  = isDark ? '#2a2a2a' : '#f1f2f6';

    const overlay = document.createElement('div');
    overlay.id = 'appModalConfirm';
    overlay.style.cssText = `
        position:fixed;top:0;left:0;width:100%;height:100%;
        background:rgba(0,0,0,0.75);
        display:flex;align-items:center;justify-content:center;
        z-index:20000;backdrop-filter:blur(6px);
        transition:opacity 0.3s ease;`;

    const modal = document.createElement('div');
    modal.style.cssText = `
        background:${bgCard};width:95%;max-width:400px;padding:36px 32px;
        border-radius:24px;text-align:center;
        box-shadow:0 28px 60px rgba(0,0,0,0.35);
        transform:scale(0.8) translateY(20px);
        transition:transform 0.35s cubic-bezier(0.175,0.885,0.32,1.275),opacity 0.3s;
        opacity:0;`;

    modal.innerHTML = `
        <div style="
            width:68px;height:68px;border-radius:50%;
            background:linear-gradient(135deg,#ff4757,#c0392b);
            display:flex;align-items:center;justify-content:center;
            margin:0 auto 20px;
            box-shadow:0 0 0 8px rgba(255,71,87,0.12),0 8px 24px rgba(255,71,87,0.3);
        ">
            <i class="bi bi-exclamation-lg" style="color:#fff;font-size:2rem;font-weight:900;line-height:1;"></i>
        </div>
        <h3 style="margin-bottom:10px;font-weight:800;color:${textH};font-size:1.25rem;letter-spacing:-0.3px;">${titulo}</h3>
        <p style="color:${textBody};margin-bottom:28px;line-height:1.6;font-size:0.95rem;">${mensaje}</p>
        <div style="display:flex;gap:10px;justify-content:center;">
            <button id="btnCancelModal" style="
                flex:1;padding:12px 20px;border-radius:14px;font-weight:700;font-size:0.9rem;
                background:transparent;border:2px solid ${borderC};color:${textBody};cursor:pointer;
                transition:all 0.2s;">
                Cancelar
            </button>
            <button id="btnConfirmModal" style="
                flex:1;padding:12px 20px;border-radius:14px;font-weight:700;font-size:0.9rem;
                background:linear-gradient(135deg,#ff4757,#c0392b);border:none;color:#fff;cursor:pointer;
                box-shadow:0 6px 18px rgba(255,71,87,0.3);transition:all 0.2s;">
                Confirmar
            </button>
        </div>`;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    requestAnimationFrame(() => requestAnimationFrame(() => {
        modal.style.transform = 'scale(1) translateY(0)';
        modal.style.opacity   = '1';
    }));

    const btnCancel  = modal.querySelector('#btnCancelModal');
    const btnConfirm = modal.querySelector('#btnConfirmModal');

    btnCancel.onmouseenter  = () => { btnCancel.style.background = isDark ? '#252525' : '#f1f2f6'; };
    btnCancel.onmouseleave  = () => { btnCancel.style.background = 'transparent'; };
    btnConfirm.onmouseenter = () => { btnConfirm.style.filter = 'brightness(1.1)'; btnConfirm.style.transform = 'translateY(-1px)'; };
    btnConfirm.onmouseleave = () => { btnConfirm.style.filter = ''; btnConfirm.style.transform = ''; };

    const cerrar = () => {
        modal.style.transform = 'scale(0.85) translateY(10px)';
        modal.style.opacity   = '0';
        overlay.style.opacity = '0';
        setTimeout(() => overlay.remove(), 320);
    };
    btnCancel.onclick  = cerrar;
    btnConfirm.onclick = () => { onConfirm(); cerrar(); };
    overlay.onclick    = (e) => { if (e.target === overlay) cerrar(); };
}

function initScrollToTop() {
    let btn = document.getElementById('scrollToTopBtn');
    if (!btn) return;

    window.addEventListener('scroll', () => {
        if (window.scrollY > 300) {
            btn.classList.add('show');
        } else {
            btn.classList.remove('show');
        }
    }, { passive: true });

    btn.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
}

function initScrollProgressBar() {
    const bar = document.getElementById('scrollProgressBar');
    if (!bar) return;

    const update = () => {
        const winScroll = document.documentElement.scrollTop || document.body.scrollTop;
        const height    = document.documentElement.scrollHeight - document.documentElement.clientHeight;
        const pct       = height > 0 ? Math.min((winScroll / height) * 100, 100) : 0;
        bar.style.width = pct + '%';
    };

    window.addEventListener('scroll', update, { passive: true });
    update();
}

function solicitarPermisosNotificacion() {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'granted') return;
    if (localStorage.getItem('dantojitos_notif_asked')) return;

    Notification.requestPermission().then(perm => {
        localStorage.setItem('dantojitos_notif_asked', '1');
    });
}

function lanzarNotificacionNativa(titulo, cuerpo, icono = '/static/uploads/logo.ico') {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    try {
        new Notification(titulo, { body: cuerpo, icon: icono });
    } catch (e) { console.warn('Notificación nativa no disponible'); }
}

function _playNotifSound(type = 'default') {
    if (_isNotifMuted()) return;
    try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();

        const _nota = (freq, start, dur, vol = 0.07) => {
            [['sine', 1.0], ['triangle', 0.35]].forEach(([type, amp]) => {
                const osc  = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = type;
                osc.frequency.setValueAtTime(freq, start);
                gain.gain.setValueAtTime(0, start);
                gain.gain.linearRampToValueAtTime(vol * amp, start + 0.009);
                gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start(start);
                osc.stop(start + dur);
            });
        };

        const t = ctx.currentTime;
        if (type === 'error') {

            _nota(440, t,        0.22, 0.045);
            _nota(311, t + 0.13, 0.28, 0.04);
        } else {

            _nota(523.25, t,        0.28, 0.07);
            _nota(783.99, t + 0.13, 0.30, 0.06);
            _nota(1046.5, t + 0.25, 0.22, 0.04);
        }
    } catch (_) {}
}

function _swPost(data) {
    try {
        if (navigator.serviceWorker?.controller) {
            navigator.serviceWorker.controller.postMessage(data);
        }
    } catch (_) {}
}

let _swSyncBusy = false;
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', ev => {
        if (_swSyncBusy) return;
        _swSyncBusy = true;
        try {
            if (ev.data?.type === 'THEME_UPDATED' && ev.data.theme) setTheme(ev.data.theme);
            if (ev.data?.type === 'LANG_UPDATED'  && ev.data.lang)  { if (typeof setLang === 'function') setLang(ev.data.lang); }
        } finally { _swSyncBusy = false; }
    });
}

function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('dantojitos_theme', theme);
    if (!_swSyncBusy) _swPost({ type: 'CACHE_THEME', theme });
    const lang = (typeof getLang === 'function') ? getLang() : 'es';

    const btn = document.getElementById('themeToggleBtn');
    if (btn) {
        const icon = btn.querySelector('i');
        const hasLabel = !!btn.querySelector('[data-i18n="nav.theme"]');
        if (icon) icon.className = theme === 'dark'
            ? (hasLabel ? 'bi bi-sun-fill me-2' : 'bi bi-sun-fill')
            : (hasLabel ? 'bi bi-moon-fill me-2' : 'bi bi-moon-fill');
        const label = btn.querySelector('[data-i18n="nav.theme"]');
        if (label) {
            label.textContent = theme === 'dark'
                ? (lang === 'en' ? 'Light Mode' : 'Modo Claro')
                : (lang === 'en' ? 'Dark Mode'  : 'Modo Oscuro');
        }
    }

    const navIcon  = document.getElementById('navThemeIcon');
    const navLabel = document.getElementById('navThemeLabel');
    if (navIcon)  navIcon.className   = theme === 'dark' ? 'bi bi-sun-fill' : 'bi bi-moon-fill';
    if (navLabel) navLabel.textContent = theme === 'dark'
        ? (lang === 'en' ? 'Light' : 'Claro')
        : (lang === 'en' ? 'Dark'  : 'Oscuro');
}

function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'light';
    setTheme(current === 'dark' ? 'light' : 'dark');
}

let _notifPanelOpenGlobal = false;
let _sistemPanelOpen = false;

function _togglePanel(panelId, bodyId, chevronId, btnId, openFlag, loaderFn) {
    const panel   = document.getElementById(panelId);
    const body    = document.getElementById(bodyId);
    const chevron = document.getElementById(chevronId);
    const btn     = document.getElementById(btnId);
    if (!panel) return false;
    const open = !openFlag;
    panel.classList.toggle('is-open', open);
    if (body)    body.classList.toggle('open', open);
    if (chevron) chevron.className = open ? 'bi bi-chevron-up ms-auto' : 'bi bi-chevron-down ms-auto';
    if (btn)     btn.classList.toggle('active', open);
    if (open && loaderFn) loaderFn();
    return open;
}

function toggleNotifPanel() {
    _notifPanelOpenGlobal = _togglePanel('notifAdminPanel','notifAdminBody','notifChevron','navPubBtn', _notifPanelOpenGlobal, cargarNotificacionesAdmin);
    if (_notifPanelOpenGlobal && _sistemPanelOpen) {
        _sistemPanelOpen = _togglePanel('sistemPanel','sistemBody','sistemChevron','navBellBtn', true, null);
    }
}

function toggleSistemPanel() {
    _sistemPanelOpen = _togglePanel('sistemPanel','sistemBody','sistemChevron','navBellBtn', _sistemPanelOpen, cargarNotificacionesSistema);
    if (_sistemPanelOpen && _notifPanelOpenGlobal) {
        _notifPanelOpenGlobal = _togglePanel('notifAdminPanel','notifAdminBody','notifChevron','navPubBtn', true, null);
    }
}

const _PEDIDOS_VISTOS_KEY = '_dantojitos_pedidos_vistos';
function _getPedidosVistos() {
    try { return JSON.parse(localStorage.getItem(_PEDIDOS_VISTOS_KEY) || '[]'); }
    catch { return []; }
}
function _makePedidoKey(id, estado) {
    return String(id) + '|' + String(estado || '');
}
function _savePedidoVisto(key) {
    const list = _getPedidosVistos();
    if (!list.includes(key)) { list.push(key); localStorage.setItem(_PEDIDOS_VISTOS_KEY, JSON.stringify(list)); }
}
function _saveAllPedidosVistos(keys) {
    const existing = _getPedidosVistos();
    keys.forEach(k => { if (!existing.includes(k)) existing.push(k); });
    localStorage.setItem(_PEDIDOS_VISTOS_KEY, JSON.stringify(existing));
}

function _updateSistemBadge() {
    const remaining = document.querySelectorAll('#sistemList .notif-item').length;
    const badge = document.getElementById('navBellBadge');
    const count = document.getElementById('sistemCount');
    const empty = document.getElementById('sistemEmpty');
    const muted = _isNotifMuted();
    if (badge) { badge.textContent = remaining > 9 ? '9+' : remaining; badge.style.display = (!muted && remaining > 0) ? 'flex' : 'none'; }
    if (count) { count.textContent = remaining || ''; count.style.display = (!muted && remaining > 0) ? 'inline-flex' : 'none'; }
    if (empty) empty.style.display = remaining === 0 ? 'flex' : 'none';
}

async function cargarNotificacionesSistema() {
    const list  = document.getElementById('sistemList');
    const empty = document.getElementById('sistemEmpty');
    const count = document.getElementById('sistemCount');
    const badge = document.getElementById('navBellBadge');
    if (!list) return;
    try {
        const res  = await fetch('/api/admin/notificaciones_sistema', { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();

        list.querySelectorAll('.notif-item[data-pedido-clave]').forEach(li => li.remove());

        const vistos = _getPedidosVistos();

        const pendientes = (Array.isArray(data) ? data : [])
            .filter((n, i) => !vistos.includes(_makePedidoKey(n.id_pedido ?? i, n.estado)));

        const otros = list.querySelectorAll('.notif-item').length;
        const total = pendientes.length + otros;
        const muted = _isNotifMuted();

        if (count) { count.textContent = total || ''; count.style.display = (!muted && total > 0) ? 'inline-flex' : 'none'; }
        if (empty) empty.style.display = total === 0 ? 'flex' : 'none';
        if (badge) { badge.textContent = total > 9 ? '9+' : total; badge.style.display = (!muted && total > 0) ? 'flex' : 'none'; }

        const ESTADO_CFG = {
            'Pendiente': { color:'#b45309', bg:'#fef3c7', icon:'bi-hourglass-split'        },
            'Emitida':   { color:'#0369a1', bg:'#e0f2fe', icon:'bi-file-earmark-arrow-up'  },
            'Emitido':   { color:'#0369a1', bg:'#e0f2fe', icon:'bi-file-earmark-arrow-up'  },
            'Enviado':   { color:'#92400e', bg:'#fef3c7', icon:'bi-truck'                  },
            'Pagado ✓':  { color:'#15803d', bg:'#dcfce7', icon:'bi-check-circle-fill'      },
            'Entregado': { color:'#15803d', bg:'#dcfce7', icon:'bi-house-check-fill'       },
            'Cancelado': { color:'#64748b', bg:'#f1f5f9', icon:'bi-x-circle'              },
            'Anulada':   { color:'#dc2626', bg:'#fee2e2', icon:'bi-slash-circle'           },
        };

        pendientes.forEach((n, i) => {
            const id    = String(n.id_pedido ?? i);
            const clave = _makePedidoKey(id, n.estado);
            const cfg   = ESTADO_CFG[n.estado] || { color:'#888', bg:'#f0f0f0', icon:'bi-bell' };
            const li    = document.createElement('li');
            li.className = 'notif-item';
            li.style.cursor = 'pointer';
            li.dataset.pedidoId    = id;
            li.dataset.pedidoClave = clave;
            li.innerHTML = `
                <div class="notif-item-img" style="background:${cfg.bg};">
                    <i class="bi ${cfg.icon}" style="color:${cfg.color};font-size:1rem;"></i>
                </div>
                <div class="notif-item-info" style="flex:1;min-width:0;">
                    <strong>${n.titulo}</strong>
                    <small style="display:block;margin-top:2px;">
                        <span style="display:inline-block;width:6px;height:6px;border-radius:50%;
                                     background:${cfg.color};vertical-align:middle;margin-right:4px;"></span>
                        ${n.estado}${n.descripcion ? ' · ' + n.descripcion : ''}${n.fecha ? ' · ' + n.fecha : ''}
                    </small>
                </div>
                <div class="notif-item-actions">
                    <button class="btn-notif-visto"
                            onclick="event.stopPropagation();_marcarVistoPedido(this,'${clave}')"
                            title="Marcar como visto">
                        <i class="bi bi-check2"></i>
                    </button>
                </div>`;
            li.addEventListener('click', (e) => {
                if (e.target.closest('.btn-notif-visto')) return;
                _savePedidoVisto(li.dataset.pedidoClave);
                li.style.transition = 'opacity 0.2s, transform 0.2s';
                li.style.opacity = '0';
                li.style.transform = 'translateX(18px)';
                setTimeout(() => {
                    li.remove();
                    _updateSistemBadge();
                }, 220);
                setTimeout(() => { window.location.href = '/pedidos_page'; }, 260);
            });
            list.appendChild(li);
        });
    } catch {  }
}

async function cargarNotificacionesAdmin() {
    const list  = document.getElementById('notifList');
    const empty = document.getElementById('notifEmpty');
    const count = document.getElementById('notifCount');
    if (!list) return;
    try {
        const res  = await fetch('/api/admin/notificaciones', { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        list.innerHTML = '';
        const total = Array.isArray(data) ? data.length : 0;
        if (count) count.textContent = total;
        if (empty) empty.style.display = total ? 'none' : 'flex';

        const pubCount = document.getElementById('notifCount');
        const pubBadge = document.getElementById('navPubBadge');
        const activas  = Array.isArray(data) ? data.filter(n => n.estado).length : 0;
        const _pubMuted = _isNotifMuted();
        if (pubCount) { pubCount.textContent = activas || ''; pubCount.style.display = (!_pubMuted && activas > 0) ? 'inline-flex' : 'none'; }
        if (pubBadge) { pubBadge.textContent = activas > 9 ? '9+' : activas; pubBadge.style.display = (!_pubMuted && activas > 0) ? 'flex' : 'none'; }

        (Array.isArray(data) ? data : []).forEach(n => {
            const li = document.createElement('li');
            li.className = 'notif-item';
            li.style.opacity = n.estado ? '1' : '0.45';
            li.innerHTML = `
                <div class="notif-item-img" style="background:${n.estado ? '#fff5e0' : '#f5f5f5'};">
                    ${n.imagen_url
                        ? `<img src="${n.imagen_url}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
                           <i class="bi bi-bell" style="display:none;color:#d35400;font-size:1.1rem;"></i>`
                        : '<i class="bi bi-bell" style="color:#d35400;font-size:1.1rem;"></i>'}
                </div>
                <div class="notif-item-info">
                    <strong>${n.titulo || 'Sin título'}</strong>
                    <small>${n.descripcion || ''}</small>
                </div>
                <div class="notif-item-actions">
                    <label class="notif-pub-toggle" title="${n.estado ? 'Desactivar' : 'Activar'}">
                        <input type="checkbox" ${n.estado ? 'checked' : ''}
                               onchange="event.stopPropagation();toggleNotifEstado('${n.id_publicidad}', this.checked)">
                        <span class="notif-pub-slider"></span>
                    </label>
                    <button class="btn-notif-del" onclick="event.stopPropagation();eliminarNotif('${n.id_publicidad}')" title="Eliminar">
                        <i class="bi bi-trash3-fill"></i>
                    </button>
                </div>`;
            list.appendChild(li);
        });
    } catch {  }
}

async function toggleNotifEstado(id, estado) {
    try {
        await fetch(`/api/admin/notificaciones/estado/${id}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ estado })
        });
        await cargarNotificacionesAdmin();
    } catch { mostrarAlerta('Error al actualizar estado', true); }
}

async function eliminarNotif(id) {
    mostrarConfirmacionApp('Eliminar notificación', '¿Deseas eliminar esta notificación?', async () => {
        try {
            const res = await fetch(`/api/admin/notificaciones/${id}`, { method: 'DELETE' });
            if ((await res.json()).ok) {
                mostrarAlerta('Notificación eliminada');
                await cargarNotificacionesAdmin();
            }
        } catch { mostrarAlerta('Error al eliminar', true); }
    });
}

function _notifImgFallback(img, icon, color) {
    if (!img || !img.parentNode) return;
    const i = document.createElement('i');
    i.className = `bi ${icon}`;
    i.style.cssText = `color:${color};font-size:1rem;`;
    img.parentNode.replaceChild(i, img);
}
function _notifImgFallbackCover(img, icon, color) {
    if (!img || !img.parentNode) return;
    const i = document.createElement('i');
    i.className = `bi ${icon}`;
    i.style.cssText = `color:${color};font-size:1rem;width:100%;height:100%;display:flex;align-items:center;justify-content:center;`;
    img.parentNode.replaceChild(i, img);
}

const _CLIENT_NOTIF_KEY = '_dantojitos_client_notifs';
const _CLIENT_SEEN_KEY  = '_dantojitos_client_seen';
const _CLIENT_NOTIF_MAX = 30;
const _NOTIF_MUTED_KEY  = '_dantojitos_notif_muted';

function _isNotifMuted() {
    return localStorage.getItem(_NOTIF_MUTED_KEY) === '1';
}

function _syncMuteUI() {
    const muted = _isNotifMuted();
    document.querySelectorAll('.notif-mute-btn').forEach(btn => {
        const icon = btn.querySelector('i');
        if (icon) icon.className = muted ? 'bi bi-bell-slash-fill' : 'bi bi-bell-fill';
        btn.title  = muted ? 'Activar notificaciones' : 'Silenciar notificaciones';
        btn.classList.toggle('muted', muted);
    });

    ['navClientBellBtn','navBellBtn'].forEach(id => {
        const icon = document.querySelector(`#${id} i`);
        if (icon) icon.className = muted ? 'bi bi-bell-slash-fill' : 'bi bi-bell-fill';
    });

    if (muted) {
        ['navClientBellBadge','navBellBadge','clientNotifCount','sistemCount','navPubBadge','notifCount']
            .forEach(id => { const el = document.getElementById(id); if (el) el.style.display = 'none'; });
    } else {

        _renderClientNotifs();
        if (document.getElementById('navBellBadge'))    cargarNotificacionesSistema();
        if (document.getElementById('notifAdminPanel')) cargarNotificacionesAdmin();
    }
}

window.toggleNotifMute = function() {
    localStorage.setItem(_NOTIF_MUTED_KEY, _isNotifMuted() ? '0' : '1');
    _syncMuteUI();
};

function _getClientNotifs() {
    try { return JSON.parse(localStorage.getItem(_CLIENT_NOTIF_KEY) || '[]'); } catch { return []; }
}
function _saveClientNotifs(arr) {
    localStorage.setItem(_CLIENT_NOTIF_KEY, JSON.stringify(arr.slice(0, _CLIENT_NOTIF_MAX)));
}
function _getClientSeen() {
    try { return JSON.parse(localStorage.getItem(_CLIENT_SEEN_KEY) || '[]'); } catch { return []; }
}
function _addClientSeen(sig) {
    const seen = _getClientSeen();
    if (!seen.includes(sig)) {
        seen.unshift(sig);
        if (seen.length > 200) seen.length = 200;
        localStorage.setItem(_CLIENT_SEEN_KEY, JSON.stringify(seen));
    }
}
function _notifSig(n) {
    return (n.tipo || '') + '|' + (n.titulo || '') + '|' + (n.mensaje || '').substring(0, 40);
}
function _pushClientNotif(notif) {
    const sig  = _notifSig(notif);
    const tipo = notif.tipo || '';
    const isRepeatable = tipo === 'agotado' || tipo === 'disponible' || tipo.startsWith('pedido_');
    if (!isRepeatable && _getClientSeen().includes(sig)) return;
    const arr = _getClientNotifs();
    if (arr.some(x => _notifSig(x) === sig)) return;
    arr.unshift({ ...notif, ts: Date.now(), _sig: sig });
    _saveClientNotifs(arr);
    _renderClientNotifs();
}
function _renderClientNotifs() {
    const list    = document.getElementById('clientNotifList');
    const empty   = document.getElementById('clientNotifEmpty');
    const count   = document.getElementById('clientNotifCount');
    const badge   = document.getElementById('navClientBellBadge');
    if (!list) return;
    const notifs  = _getClientNotifs();
    list.innerHTML = '';
    if (notifs.length === 0) {
        if (empty)  empty.style.display  = 'flex';
        if (count)  count.style.display  = 'none';
        if (badge)  badge.style.display  = 'none';
        return;
    }
    if (empty)  empty.style.display  = 'none';
    const _muted = _isNotifMuted();
    if (count)  { count.textContent  = notifs.length > 9 ? '9+' : notifs.length; count.style.display = _muted ? 'none' : 'inline-flex'; }
    if (badge)  { badge.textContent  = notifs.length > 9 ? '9+' : notifs.length; badge.style.display = _muted ? 'none' : 'flex'; }
    notifs.forEach((n, i) => {
        const isPerfil   = n.tipo === 'perfil';
        const agotado    = n.tipo === 'agotado';
        const isPrivMsg  = n.tipo === 'priv_msg';
        const isPedido   = (n.tipo || '').startsWith('pedido_');
        const isCancelado= n.tipo === 'pedido_cancelado' || n.tipo === 'pedido_anulada';
        const isEntregado= n.tipo === 'pedido_entregado' || n.tipo === 'pedido_pagado';
        const icon  = agotado ? 'bi-x-circle-fill'
                    : isPerfil ? 'bi-person-fill-exclamation'
                    : isPrivMsg ? 'bi-chat-text-fill'
                    : isCancelado ? 'bi-x-circle'
                    : isPedido && isEntregado ? 'bi-check-circle-fill'
                    : isPedido ? 'bi-bag-check-fill'
                    : 'bi-check-circle-fill';
        const color = agotado ? '#dc2626'
                    : isPerfil ? '#d35400'
                    : isPrivMsg ? '#7c3aed'
                    : isCancelado ? '#64748b'
                    : isPedido && isEntregado ? '#15803d'
                    : isPedido ? '#0369a1'
                    : '#15803d';
        const bg    = agotado ? '#fee2e2'
                    : isPerfil ? '#fff4ee'
                    : isPrivMsg ? '#f5f3ff'
                    : isCancelado ? '#f1f5f9'
                    : isPedido && isEntregado ? '#dcfce7'
                    : isPedido ? '#e0f2fe'
                    : '#dcfce7';
        const li = document.createElement('li');
        li.className = 'notif-item' + (n.url ? ' notif-item-link' : '');
        li.dataset.notifIdx = i;
        if (n.url) { li.style.cursor = 'pointer'; li.onclick = (e) => { if (!e.target.closest('.btn-notif-visto')) window.location.href = n.url; }; }
        li.innerHTML = `
            <div class="notif-item-img" style="background:${bg};">
                ${n.imagen ? `<img src="${n.imagen}" onerror="_notifImgFallback(this,'${icon}','${color}')" style="width:100%;height:100%;object-fit:cover;border-radius:8px;">` : `<i class="bi ${icon}" style="color:${color};font-size:1rem;"></i>`}
            </div>
            <div class="notif-item-info" style="flex:1;min-width:0;">
                <strong style="font-size:0.78rem;">${n.titulo}</strong>
                <small style="display:block;margin-top:2px;color:#888;">${n.mensaje}</small>
            </div>
            <div class="notif-item-actions">
                <button class="btn-notif-visto" title="Marcar como visto">
                    <i class="bi bi-check2" style="font-size:0.82rem;"></i>
                </button>
            </div>`;
        const vistoBtn = li.querySelector('.btn-notif-visto');
        vistoBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (isPrivMsg) { _dismissPrivClient(); return; }
            _clientNotifRemoveAnimado(li, i, n._sig);
        });
        list.appendChild(li);
    });
}
window._clientNotifRemoveAnimado = function(li, idx, sig) {
    li.style.transition = 'opacity 0.28s ease, transform 0.28s ease, max-height 0.3s ease, padding 0.3s ease';
    li.style.opacity    = '0';
    li.style.transform  = 'translateX(44px)';
    li.style.overflow   = 'hidden';
    li.style.pointerEvents = 'none';
    if (sig) _addClientSeen(sig);
    setTimeout(() => {
        li.style.maxHeight = li.offsetHeight + 'px';
        requestAnimationFrame(() => {
            li.style.maxHeight  = '0';
            li.style.paddingTop = '0';
            li.style.paddingBottom = '0';
            li.style.borderBottom  = 'none';
        });
        setTimeout(() => {
            const arr = _getClientNotifs();
            if (idx < arr.length) arr.splice(idx, 1);
            _saveClientNotifs(arr);
            _renderClientNotifs();
        }, 320);
    }, 290);
};
window._clientNotifRemove = function(idx) {
    const arr = _getClientNotifs();
    if (arr[idx]?._sig) _addClientSeen(arr[idx]._sig);
    arr.splice(idx, 1);
    _saveClientNotifs(arr);
    _renderClientNotifs();
};
window._clientNotifClearAll = function() {
    const arr = _getClientNotifs();
    arr.forEach(n => { if (n._sig) _addClientSeen(n._sig); });
    _saveClientNotifs([]);
    _renderClientNotifs();
};

let _clientPanelOpen = false;
function toggleClientNotifPanel() {
    _clientPanelOpen = _togglePanel('clientNotifPanel','clientNotifBody','clientNotifChevron','navClientBellBtn', _clientPanelOpen, _renderClientNotifs);
}

function _pushStockToSistemPanel(p, tipo) {
    const list = document.getElementById('sistemList');
    if (!list) return;
    const empty = document.getElementById('sistemEmpty');
    if (empty) empty.style.display = 'none';
    const agotado = tipo === 'agotado';
    const icon  = agotado ? 'bi-x-circle-fill' : 'bi-check-circle-fill';
    const color = agotado ? '#dc2626' : '#15803d';
    const bg    = agotado ? '#fee2e2' : '#dcfce7';
    const titulo = agotado ? '¡Agotado! ' + p.nombre : '¡Disponible! ' + p.nombre;
    const desc   = agotado ? 'Sin stock disponible' : (p.stock + ' unidades disponibles');
    const li = document.createElement('li');
    li.className = 'notif-item';
    li.dataset.pedidoId = `stock-${p.id_producto}`;
    li.innerHTML = `
        <div class="notif-item-img" style="background:${bg};">
            ${p.imagen_url ? `<img src="${p.imagen_url}" onerror="_notifImgFallbackCover(this,'${icon}','${color}')" style="width:100%;height:100%;object-fit:cover;">` : `<i class="bi ${icon}" style="color:${color};font-size:1rem;"></i>`}
        </div>
        <div class="notif-item-info" style="flex:1;min-width:0;">
            <strong style="font-size:0.78rem;">${titulo}</strong>
            <small style="display:block;margin-top:2px;">
                <span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:${color};vertical-align:middle;margin-right:4px;"></span>
                ${desc}
            </small>
        </div>
        <div class="notif-item-actions">
            <button class="btn-notif-visto" onclick="_marcarVistoPedido(this,'stock-${p.id_producto}|stock')" title="Marcar como visto">
                <i class="bi bi-check2"></i>
            </button>
        </div>`;
    list.insertBefore(li, list.firstChild);
    _updateSistemBadge();
    _animateBadge(document.getElementById('navBellBadge'));
}

(function _initStockMonitor() {
    const _SS_SNAP_KEY  = '_dantojitos_stock_snap';
    const _SS_INIT_KEY  = '_dantojitos_stock_init';

    function _loadSnap() {
        try { return JSON.parse(sessionStorage.getItem(_SS_SNAP_KEY) || '{}'); } catch { return {}; }
    }
    function _saveSnap(snap) {
        try { sessionStorage.setItem(_SS_SNAP_KEY, JSON.stringify(snap)); } catch {}
    }

    function _ringClientBell() {
        const cb = document.getElementById('navClientBellBtn');
        const bd = document.getElementById('navClientBellBadge');
        if (cb && !_isNotifMuted()) { cb.classList.add('ring-anim'); setTimeout(() => cb.classList.remove('ring-anim'), 2500); }
        _animateBadge(bd);
    }

    async function _checkStock() {
        try {
            const res   = await fetch('/obtener_catalogo', { cache: 'no-store' });
            const data  = await res.json();
            const prods = data.productos || data || [];
            if (!Array.isArray(prods)) return;

            const snap    = _loadSnap();
            const firstRun = !sessionStorage.getItem(_SS_INIT_KEY);

            if (firstRun) {
                prods.forEach(p => { snap[String(p.id_producto)] = parseInt(p.stock ?? 0, 10); });
                _saveSnap(snap);
                sessionStorage.setItem(_SS_INIT_KEY, '1');
                return;
            }

            const currIds = new Set(prods.map(p => String(p.id_producto)));

            Object.keys(snap).forEach(id => {
                if (!currIds.has(id)) {
                    mostrarAlertaPublica({
                        titulo:  '¡Producto eliminado!',
                        mensaje: 'Un producto fue removido del catálogo',
                        tipo:    'error',
                        duracion: 5000,
                        idUnico: `eliminado-${id}`,
                        url:     '/catalogo_page',
                    });
                    _pushClientNotif({ tipo: 'agotado', titulo: '¡Producto eliminado!', mensaje: 'Un producto fue removido del catálogo', imagen: '/static/uploads/logo.ico', url: '/catalogo_page' });
                    _pushStockToSistemPanel({ id_producto: id, nombre: 'Producto eliminado', stock: 0, imagen_url: '' }, 'agotado');
                    _ringClientBell();
                    delete snap[id];
                }
            });

            prods.forEach(p => {
                const id    = String(p.id_producto);
                const curr  = parseInt(p.stock ?? 0, 10);
                const isNew = !Object.prototype.hasOwnProperty.call(snap, id);
                const prev  = isNew ? null : snap[id];

                snap[id] = curr;

                if (isNew) {
                    mostrarAlertaPublica({
                        titulo:  '¡Nuevo producto!',
                        mensaje: `${p.nombre} se añadió al catálogo` + (curr > 0 ? ` · ${curr} uds` : ''),
                        imagen:  p.imagen_url || '/static/uploads/logo.ico',
                        tipo:    'success',
                        duracion: 6000,
                        idUnico: `nuevo-${id}`,
                        sonido:  true,
                        url:     '/catalogo_page',
                    });
                    _pushClientNotif({ tipo: 'disponible', titulo: '¡Nuevo producto!', mensaje: p.nombre + (curr > 0 ? ` · ${curr} uds` : ' — sin stock aún'), imagen: p.imagen_url, url: '/catalogo_page' });
                    _pushStockToSistemPanel({ ...p, stock: curr }, 'disponible');
                    _ringClientBell();
                    return;
                }

                if (prev === curr) return;

                if (prev > 0 && curr <= 0) {
                    mostrarAlertaPublica({
                        titulo:  '¡Producto Agotado!',
                        mensaje: `${p.nombre} ya no tiene stock disponible`,
                        imagen:  p.imagen_url || '/static/uploads/logo.ico',
                        tipo:    'error',
                        duracion: 6000,
                        idUnico: `agotado-${id}`,
                        sonido:  true,
                        url:     '/catalogo_page',
                    });
                    _pushClientNotif({ tipo: 'agotado', titulo: '¡Agotado!', mensaje: p.nombre + ' sin stock', imagen: p.imagen_url, url: '/catalogo_page' });
                    _pushStockToSistemPanel({ ...p, stock: curr }, 'agotado');
                    _ringClientBell();

                } else if (prev <= 0 && curr > 0) {
                    mostrarAlertaPublica({
                        titulo:  '¡Disponible!',
                        mensaje: `${p.nombre} vuelve a tener stock (${curr} uds)`,
                        imagen:  p.imagen_url || '/static/uploads/logo.ico',
                        tipo:    'success',
                        duracion: 6000,
                        idUnico: `disponible-${id}`,
                        sonido:  true,
                        url:     '/catalogo_page',
                    });
                    _pushClientNotif({ tipo: 'disponible', titulo: '¡Disponible!', mensaje: p.nombre + ' · ' + curr + ' unidades', imagen: p.imagen_url, url: '/catalogo_page' });
                    _pushStockToSistemPanel({ ...p, stock: curr }, 'disponible');
                    _ringClientBell();
                }
            });

            _saveSnap(snap);
        } catch {}
    }

    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(_checkStock, 5000);
        setInterval(_checkStock, 30000);
    });
})();

function _animateBadge(badgeEl) {
    if (!badgeEl || _isNotifMuted()) return;
    badgeEl.style.transition = 'none';
    badgeEl.style.transform  = 'scale(1.7)';
    badgeEl.style.background = '#e74c3c';
    setTimeout(() => {
        badgeEl.style.transition = 'transform 0.4s cubic-bezier(0.175,0.885,0.32,1.275)';
        badgeEl.style.transform  = 'scale(1)';
    }, 80);
}

let _lastBellCount = 0;
let _lastPrivCv    = -1;
let _lastPrivStaff = -1;

async function _pollSistemNotif() {
    const badge = document.getElementById('navBellBadge');
    if (!badge) return;
    await cargarNotificacionesSistema();
    const cnt = parseInt(badge.textContent || '0', 10);
    if (cnt > _lastBellCount) _animateBadge(badge);
    _lastBellCount = cnt;
}

const _MIS_PEDIDOS_KEY  = '_dantojitos_mis_pedidos_estado';
const _MIS_PEDIDOS_SEEN = '_dantojitos_mis_pedidos_vistos';

function _getMisPedidosEstado() {
    try { return JSON.parse(localStorage.getItem(_MIS_PEDIDOS_KEY) || '{}'); } catch { return {}; }
}
function _saveMisPedidosEstado(obj) {
    try { localStorage.setItem(_MIS_PEDIDOS_KEY, JSON.stringify(obj)); } catch {}
}
function _getMisPedidosVistos() {
    try { return JSON.parse(localStorage.getItem(_MIS_PEDIDOS_SEEN) || '[]'); } catch { return []; }
}
function _addMiPedidoVisto(key) {
    const list = _getMisPedidosVistos();
    if (!list.includes(key)) { list.push(key); localStorage.setItem(_MIS_PEDIDOS_SEEN, JSON.stringify(list.slice(-50))); }
}

const _PEDIDO_ESTADO_CFG = {
    'Pendiente': { icon: 'bi-hourglass-split',           color: '#b45309', tipo: 'info'     },
    'Emitida':   { icon: 'bi-file-earmark-arrow-up',     color: '#0369a1', tipo: 'info'     },
    'Enviado':   { icon: 'bi-truck',                     color: '#92400e', tipo: 'info'     },
    'Entregado': { icon: 'bi-house-check-fill',          color: '#15803d', tipo: 'success'  },
    'Pagado ✓':  { icon: 'bi-check-circle-fill',         color: '#15803d', tipo: 'success'  },
    'Cancelado': { icon: 'bi-x-circle',                  color: '#64748b', tipo: 'agotado'  },
    'Anulada':   { icon: 'bi-slash-circle',              color: '#dc2626', tipo: 'agotado'  },
};

async function _pollMisPedidos() {
    const badge = document.getElementById('navClientBellBadge');
    if (!badge) return;
    try {
        const res = await fetch('/api/mis_pedidos/recientes', { cache: 'no-store' });
        if (!res.ok) return;
        const pedidos = await res.json();
        if (!Array.isArray(pedidos)) return;
        const prevEstados  = _getMisPedidosEstado();
        const nuevoEstados = {};
        const vistos       = _getMisPedidosVistos();
        const estadosFinales = ['pagado ✓', 'anulada', 'cancelado', 'cancelada'];
        pedidos.forEach(p => {
            const id    = p.id_pedido;
            const est   = p.estado;
            nuevoEstados[id] = est;
            const clave = id + '|' + est;
            if (vistos.includes(clave)) return;
            const prev = prevEstados[id];
            if (prev === est || prev === undefined) return;
            if (!estadosFinales.includes(est.toLowerCase())) return;
            const total = p.total ? ` · $${Number(p.total).toLocaleString('es-CO')}` : '';
            const items = `${p.num_items || 1} ítem${(p.num_items || 1) > 1 ? 's' : ''}`;
            _pushClientNotif({
                tipo:    'pedido_' + est.toLowerCase().replace(/[^a-z]/g, ''),
                titulo:  `Pedido ${est}`,
                mensaje: `Tu pedido (${items})${total} — ${est}`,
                imagen:  '/static/uploads/logo.ico',
                url:     '/historial_facturas_page',
            });
            if (!_isNotifMuted()) {
                const bellEl = document.getElementById('navClientBellBtn');
                const bdEl   = document.getElementById('navClientBellBadge');
                if (bellEl) { bellEl.classList.add('ring-anim'); setTimeout(() => bellEl.classList.remove('ring-anim'), 2500); }
                _animateBadge(bdEl);
            }
        });
        _saveMisPedidosEstado(nuevoEstados);
    } catch {}
}

function _cerrarTodosPaneles(exceptId) {
    if (_clientPanelOpen && exceptId !== 'clientNotifPanel') {
        _clientPanelOpen = _togglePanel('clientNotifPanel','clientNotifBody','clientNotifChevron','navClientBellBtn', true, null);
    }
    if (_sistemPanelOpen && exceptId !== 'sistemPanel') {
        _sistemPanelOpen = _togglePanel('sistemPanel','sistemBody','sistemChevron','navBellBtn', true, null);
    }
    if (_notifPanelOpenGlobal && exceptId !== 'notifAdminPanel') {
        _notifPanelOpenGlobal = _togglePanel('notifAdminPanel','notifAdminBody','notifChevron','navPubBtn', true, null);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    initScrollToTop();
    initScrollProgressBar();
    solicitarPermisosNotificacion();
    setTheme(localStorage.getItem('dantojitos_theme') || 'light');
    _syncMuteUI();
    if (document.getElementById('notifAdminPanel')) cargarNotificacionesAdmin();

    if (document.getElementById('navBellBadge')) {
        setTimeout(_pollSistemNotif, 2000);
        setInterval(_pollSistemNotif, 12000);
    }

    if (document.getElementById('clientNotifList')) {
        _renderClientNotifs();
    }

    if (document.getElementById('navClientBellBadge') || document.getElementById('navBellBadge') || document.getElementById('navSugerenciasBadge')) {
        setTimeout(_pollPrivMsgs, 500);
        setInterval(_pollPrivMsgs, 6000);
    }

    if (document.getElementById('navClientBellBadge')) {
        setTimeout(_pollMisPedidos, 6000);
        setInterval(_pollMisPedidos, 15000);
    }

    if (document.getElementById('contadorCarritoBadge') || document.getElementById('dropdownCartBadge')) {
        _syncCartBadge(localStorage.getItem('cant_carrito') || '0');
        setTimeout(_pollCartCount, 1000);
        setInterval(_pollCartCount, 10000);
    }

    (function () {
        const _vl = document.getElementById('versionLabel');
        if (!_vl) return;
        const _vc = ['#d35400','#e67e22','#9b59b6','#3498db','#1abc9c',
                     '#e74c3c','#f39c12','#27ae60','#e91e63','#00bcd4',
                     '#8e44ad','#16a085','#c0392b','#2980b9','#f59e0b'];
        setInterval(() => {
            _vl.style.color = _vc[Math.floor(Math.random() * _vc.length)];
        }, 2200);
    })();

    document.addEventListener('click', function(e) {
        const pares = [
            { panel: 'clientNotifPanel', btn: 'navClientBellBtn' },
            { panel: 'sistemPanel',      btn: 'navBellBtn'       },
            { panel: 'notifAdminPanel',  btn: 'navPubBtn'        },
        ];
        pares.forEach(({ panel, btn }) => {
            const panelEl = document.getElementById(panel);
            if (!panelEl || !panelEl.classList.contains('is-open')) return;
            const btnEl = document.getElementById(btn);
            if (!panelEl.contains(e.target) && !(btnEl && btnEl.contains(e.target))) {
                _cerrarTodosPaneles(null);
            }
        });
    }, true);
});

function _syncCartBadge(count) {
    const badge = document.getElementById('contadorCarritoBadge');
    const ddBadge = document.getElementById('dropdownCartBadge');
    const n = parseInt(count) || 0;
    if (badge) { badge.textContent = n > 99 ? '99+' : n; badge.style.display = n > 0 ? 'flex' : 'none'; }
    if (ddBadge) { ddBadge.textContent = n > 99 ? '99+' : n; ddBadge.style.display = n > 0 ? 'inline-flex' : 'none'; }
}

async function _pollCartCount() {
    try {
        const r = await fetch('/api/carrito/cantidad', { cache: 'no-store' });
        if (!r.ok) return;
        const d = await r.json();
        const n = d.cantidad ?? 0;
        localStorage.setItem('cant_carrito', n);
        _syncCartBadge(n);
    } catch {}
}

window.addEventListener('storage', (e) => {
    if (e.key === 'cant_carrito') _syncCartBadge(e.newValue || '0');
});

const _TICKER_SPEED_KEY = '_dantojitos_ticker_speed';

window.getTickerSpeed  = () => parseFloat(localStorage.getItem(_TICKER_SPEED_KEY) || '1');
window.saveTickerSpeed = (v) => localStorage.setItem(_TICKER_SPEED_KEY, String(v));

window._serverConfigPromise = fetch('/api/inicio/config')
    .then(r => r.ok ? r.json() : {})
    .catch(() => ({}));

function _aplicarVelocidadCintas(speed) {
    document.documentElement.style.setProperty('--ticker-speed', speed);
    document.querySelectorAll('.payment-track, .promo-track, .ci-track').forEach(track => {
        const base = parseFloat(track.dataset.baseDuration || '25');
        track.style.animationDuration = (base / speed).toFixed(1) + 's';
        track.style.willChange = 'transform';
        track.style.webkitAnimationDuration = (base / speed).toFixed(1) + 's';
    });
}

window.setTickerSpeed = function(speed) {
    window.saveTickerSpeed(speed);
    _aplicarVelocidadCintas(speed);
    document.querySelectorAll('.ticker-speed-btn').forEach(btn => {
        btn.classList.toggle('active', parseFloat(btn.dataset.speed) === speed);
    });
};

window.addEventListener('storage', (e) => {
    if (e.key === '_dantojitos_ticker_speed') {
        const spd = parseFloat(e.newValue || '1');
        _aplicarVelocidadCintas(spd);
    }
});

document.addEventListener('DOMContentLoaded', () => {
    window._serverConfigPromise.then(cfg => {
        const speed = parseFloat(cfg.velocidad_cinta || '1');
        window.saveTickerSpeed(speed);
        if (speed !== 1) _aplicarVelocidadCintas(speed);
    });
});

class PromoBannerTicker {

    constructor(track, items) {
        this._track   = track;
        this._items   = items;
        this._idx     = 0;
        this._timer   = null;
        this._speed   = window.getTickerSpeed();

        this._DWELL   = 3800;

        this._ENTER   = 680;
        this._EXIT    = 540;

        if (!window._activeTickers) window._activeTickers = [];
        window._activeTickers.push(this);
    }

    start() { this._show(0); }

    stop() {
        if (this._timer) clearTimeout(this._timer);
        (window._activeTickers || []).splice(
            (window._activeTickers || []).indexOf(this), 1
        );
    }

    setSpeed(s) { this._speed = s; }

    _show(idx) {
        if (!this._track || !this._items.length) return;
        const item = this._items[idx % this._items.length];

        const el = document.createElement('div');
        el.className = 'promo-ticker-item';
        el.innerHTML = this._html(item);

        el.style.cssText = `
            position:absolute;inset:0;display:flex;align-items:center;
            justify-content:center;padding:0 50px;
            transform:translateX(65%);opacity:0;
            transition:transform ${this._ENTER}ms cubic-bezier(0.22,1,0.36,1),
                        opacity ${this._ENTER * 0.55 | 0}ms ease;
            pointer-events:none;`;
        this._track.appendChild(el);

        requestAnimationFrame(() => requestAnimationFrame(() => {
            el.style.transform = 'translateX(0)';
            el.style.opacity   = '1';
        }));

        const dwell = this._DWELL / this._speed;
        this._timer = setTimeout(() => {

            el.style.transition = `transform ${this._EXIT}ms cubic-bezier(0.55,0,0.8,0),opacity ${this._EXIT * 0.6 | 0}ms ease`;
            el.style.transform  = 'translateX(-65%)';
            el.style.opacity    = '0';
            setTimeout(() => { if (el.parentNode) el.remove(); }, this._EXIT + 80);

            this._idx = (idx + 1) % this._items.length;
            this._timer = setTimeout(() => this._show(this._idx), 60);
        }, dwell + this._ENTER);
    }

    _html(item) {

        const imgS = [
            'width:56px;height:56px;object-fit:cover',
            'border-radius:14px;border:2px solid rgba(255,255,255,0.22)',
            'display:block;flex-shrink:0;',
            'box-shadow:0 0 20px rgba(251,146,60,0.55),0 4px 14px rgba(0,0,0,0.45)',
        ].join(';');

        const imgEl = item.imagen_url
            ? `<img src="${item.imagen_url}" style="${imgS}"
                    onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
            : '';
        const fallbackEl = `<i class="bi bi-megaphone-fill"
            style="display:${item.imagen_url ? 'none' : 'flex'};
                   font-size:1.5rem;color:rgba(251,146,60,0.7);
                   width:56px;height:56px;align-items:center;justify-content:center;
                   flex-shrink:0;border-radius:14px;
                   background:rgba(255,255,255,0.06);"></i>`;

        const subEl = item.descripcion
            ? `<span style="font-size:0.66rem;color:rgba(253,210,150,0.6);
                            font-weight:500;word-break:break-word;
                            display:block;">${item.descripcion}</span>`
            : '';

        return `
            <div style="position:relative;flex-shrink:0;">
                <div style="position:absolute;inset:-10px;background:rgba(251,146,60,0.28);
                            border-radius:20px;filter:blur(14px);z-index:0;
                            animation:none;"></div>
                ${imgEl}${fallbackEl}
            </div>
            <div style="display:flex;flex-direction:column;gap:3px;min-width:0;">
                <span style="font-weight:800;font-size:0.95rem;letter-spacing:0.5px;
                             text-transform:uppercase;white-space:nowrap;
                             background:linear-gradient(90deg,#fb923c 0%,#fde68a 50%,#fb923c 100%);
                             background-size:200% 100%;
                             -webkit-background-clip:text;-webkit-text-fill-color:transparent;
                             background-clip:text;">${item.titulo || ''}</span>
                ${subEl}
            </div>`;
    }
}

window._marcarVistoPedido = function(btn, id) {
    _savePedidoVisto(id);
    const li = btn.closest('.notif-item');
    if (li) {
        li.style.transition = 'opacity 0.25s, transform 0.25s';
        li.style.opacity = '0';
        li.style.transform = 'translateX(18px)';
        setTimeout(() => { li.remove(); _updateSistemBadge(); }, 260);
    }
};

window._pedidosMarcarTodo = function() {

    const items = [...document.querySelectorAll('#sistemList .notif-item')];
    const claves = items.map(li => li.dataset.pedidoClave || li.dataset.pedidoId).filter(Boolean);
    _saveAllPedidosVistos(claves);

    items.forEach((li, i) => {
        setTimeout(() => {
            li.style.transition = 'opacity 0.2s, transform 0.2s';
            li.style.opacity    = '0';
            li.style.transform  = 'translateX(18px)';
            setTimeout(() => { li.remove(); if (i === items.length - 1) _updateSistemBadge(); }, 220);
        }, i * 45);
    });

    const readAllBtn = document.getElementById('sistemReadAllBtn');
    if (readAllBtn) {
        readAllBtn.innerHTML = '<i class="bi bi-check2-all"></i><span class="notif-read-label">Listo ✓</span>';
        readAllBtn.disabled  = true;
        readAllBtn.classList.add('did-read');
        setTimeout(() => {
            readAllBtn.innerHTML = '<i class="bi bi-check2-all"></i><span class="notif-read-label">Leído</span>';
            readAllBtn.disabled  = false;
            readAllBtn.classList.remove('did-read');
        }, 3000);
    }
};

const _PRIV_STATE_KEY = '_dantojitos_priv_state';
function _getPrivState() {
    try { return JSON.parse(localStorage.getItem(_PRIV_STATE_KEY) || '{}'); } catch { return {}; }
}
function _savePrivState(s) { localStorage.setItem(_PRIV_STATE_KEY, JSON.stringify(s)); }

function _privShouldShow(tipo, count) {
    if (count <= 0) return false;
    return count > ((_getPrivState()[tipo] || {}).dismissedAtCount ?? -1);
}

function _privResetIfZero(tipo, prev, curr) {
    if (curr === 0 && prev > 0) {
        const state = _getPrivState();
        state[tipo] = { ...(state[tipo] || {}), dismissedAtCount: -1 };
        _savePrivState(state);
    }
}

window._dismissPrivSistem = function(tipo) {
    const curr  = tipo === 'cv' ? _lastPrivCv : _lastPrivStaff;
    const state = _getPrivState();
    state[tipo] = { ...(state[tipo] || {}), dismissedAtCount: Math.max(curr, 0) };
    _savePrivState(state);
    const li = document.querySelector(`#sistemList [data-priv-tipo="${tipo}"]`);
    if (li) {
        li.style.transition = 'opacity 0.28s ease, transform 0.28s ease';
        li.style.opacity    = '0';
        li.style.transform  = 'translateX(22px)';
        setTimeout(() => { li.remove(); _updateSistemBadge(); }, 300);
    }
};

window._dismissPrivClient = function() {
    const curr  = _lastPrivCv;
    const state = _getPrivState();
    state['client_cv'] = { ...(state['client_cv'] || {}), dismissedAtCount: Math.max(curr, 0) };
    _savePrivState(state);
    let arr = _getClientNotifs();
    arr = arr.filter(n => n.tipo !== 'priv_msg');
    _saveClientNotifs(arr);
    _renderClientNotifs();
};

function _updatePrivNotifSistem(tipo, count) {
    const list = document.getElementById('sistemList');
    if (!list) return;
    if (!_privShouldShow(tipo, count)) return;

    const existing = list.querySelector(`[data-priv-tipo="${tipo}"]`);
    const isCv  = tipo === 'cv';
    const color = isCv ? '#7c3aed' : '#0ea5e9';
    const bg    = isCv ? '#f5f3ff' : '#e0f2fe';
    const icon  = isCv ? 'bi-people-fill' : 'bi-chat-text-fill';
    const label = isCv
        ? (count === 1 ? '1 mensaje de cliente sin leer' : `${count} mensajes de clientes sin leer`)
        : (count === 1 ? '1 mensaje de equipo sin leer'  : `${count} mensajes de equipo sin leer`);

    if (existing) {
        const strong = existing.querySelector('strong');
        if (strong) strong.textContent = label;
        const prev = isCv ? _lastPrivCv : _lastPrivStaff;
        if (count > prev && prev >= 0) _animateBadge(document.getElementById('navBellBadge'));
        return;
    }

    const empty = document.getElementById('sistemEmpty');
    if (empty) empty.style.display = 'none';
    const li = document.createElement('li');
    li.className = 'notif-item';
    li.dataset.pedidoId = `priv-${tipo}`;
    li.dataset.privTipo = tipo;
    li.innerHTML = `
        <div class="notif-item-img" style="background:${bg};">
            <i class="bi ${icon}" style="color:${color};font-size:1rem;"></i>
        </div>
        <div class="notif-item-info" style="flex:1;min-width:0;cursor:pointer;"
             onclick="window.location.href='/comentarios_page'">
            <strong style="font-size:0.78rem;">${label}</strong>
            <small style="display:block;margin-top:2px;color:${color};font-weight:600;">Ir a mensajes →</small>
        </div>
        <div class="notif-item-actions">
            <button class="btn-notif-visto" title="Marcar como leído"
                    onclick="event.stopPropagation();_dismissPrivSistem('${tipo}')">
                <i class="bi bi-check2"></i>
            </button>
        </div>`;
    list.insertBefore(li, list.firstChild);
    _updateSistemBadge();
    const prev = isCv ? _lastPrivCv : _lastPrivStaff;
    if (prev >= 0) _animateBadge(document.getElementById('navBellBadge'));
}

function _updatePrivClientNotif(count) {
    if (!_privShouldShow('client_cv', count)) return;
    let arr      = _getClientNotifs();
    const prevEntry = arr.find(n => n.tipo === 'priv_msg');
    const prevCount = prevEntry?._count || 0;
    arr = arr.filter(n => n.tipo !== 'priv_msg');
    arr.unshift({
        tipo:    'priv_msg',
        titulo:  count === 1 ? 'Nuevo mensaje privado' : `${count} mensajes sin leer`,
        mensaje: 'El personal de D\'Antojitos te ha respondido.',
        imagen:  null,
        url:     '/comentarios_page',
        _count:  count,
        ts:      Date.now(),
    });
    _saveClientNotifs(arr);
    _renderClientNotifs();
    if (count > prevCount && _lastPrivCv >= 0 && !_isNotifMuted()) {
        const bell = document.getElementById('navClientBellBtn');
        if (bell) { bell.classList.add('ring-anim'); setTimeout(() => bell.classList.remove('ring-anim'), 2500); }
        _animateBadge(document.getElementById('navClientBellBadge'));
    }
}

async function _pollPrivMsgs() {
    try {
        const _ecv  = window._chatCV_abierto    || '';
        const _estf = window._chatStaff_abierto || '';
        const _qs   = (_ecv || _estf)
            ? '?ecv=' + encodeURIComponent(_ecv) + '&estf=' + encodeURIComponent(_estf)
            : '';
        const r = await fetch('/mensajes_privados/no_leidos' + _qs, { cache: 'no-store' });
        if (!r.ok) return;
        const d     = await r.json();
        const cv    = d.cv    || 0;
        const staff = d.staff || 0;
        const total = cv + staff;

        const _prevKnown  = _lastPrivCv >= 0;
        const _prevTotal  = Math.max(_lastPrivCv, 0) + Math.max(_lastPrivStaff, 0);
        const _newMsgs    = _prevKnown && total > _prevTotal && !_isNotifMuted();

        _privResetIfZero('cv',       _lastPrivCv,    cv);
        _privResetIfZero('staff',    _lastPrivStaff, staff);
        _privResetIfZero('client_cv',_lastPrivCv,    cv);

        const _isAdmin = !!document.getElementById('navPubBtn');

        if (document.getElementById('navClientBellBadge')) _updatePrivClientNotif(cv);
        if (document.getElementById('navBellBadge')) {
            if (!_isAdmin && cv > 0) _updatePrivNotifSistem('cv', cv);
            if (staff > 0)          _updatePrivNotifSistem('staff', staff);
        }

        const _ddSugBadge = document.getElementById('dropdownSugBadge');
        if (_ddSugBadge) {
            _ddSugBadge.textContent = total > 9 ? '9+' : total;
            _ddSugBadge.style.display = total > 0 ? 'inline-flex' : 'none';
        }

        if (_newMsgs) {
            const _sugLink = document.getElementById('navSugLink');
            if (_sugLink) {
                _sugLink.classList.add('ring-anim');
                setTimeout(() => _sugLink.classList.remove('ring-anim'), 2500);
            }

            const _sysBtn = document.getElementById('navBellBtn');
            if (_sysBtn) {
                _sysBtn.classList.add('ring-anim');
                setTimeout(() => _sysBtn.classList.remove('ring-anim'), 2500);
            }

            const _diff = total - _prevTotal;
            mostrarAlertaPublica({
                titulo:  t('chat.new_msg') || 'Chat Privado',
                mensaje: `${_diff} ${_diff === 1 ? 'mensaje nuevo' : 'mensajes nuevos'} sin leer`,
                tipo:    'info',
                duracion: 6000,
                imagen:  '/static/uploads/logo.ico',
                idUnico: `priv_msg_${Date.now()}`,
                sonido:  true,
                url:     '/comentarios_page',
            });
        }

        const _navSugBadge = document.getElementById('navSugerenciasBadge');
        if (_navSugBadge) {
            _navSugBadge.textContent = total > 9 ? '9+' : total;
            _navSugBadge.style.display = total > 0 ? 'flex' : 'none';
        }
        const _cBadge = document.getElementById('subtabClientesBadge');
        if (_cBadge) {
            _cBadge.textContent = cv > 9 ? '9+' : cv;
            _cBadge.style.display = cv > 0 ? 'inline-flex' : 'none';
        }
        const _eBadge = document.getElementById('subtabEquipoBadge');
        if (_eBadge) {
            _eBadge.textContent = staff > 9 ? '9+' : staff;
            _eBadge.style.display = staff > 0 ? 'inline-flex' : 'none';
        }

        _lastPrivCv    = cv;
        _lastPrivStaff = staff;
    } catch {}
}

window._publicidadMarcarTodo = async function() {
    const readAllBtn = document.getElementById('notifReadAllBtn');
    if (readAllBtn) {
        readAllBtn.innerHTML = '<i class="bi bi-check2-all"></i><span class="notif-read-label">Listo ✓</span>';
        readAllBtn.disabled = true;
        readAllBtn.classList.add('did-read');
        setTimeout(() => {
            readAllBtn.innerHTML = '<i class="bi bi-check2-all"></i><span class="notif-read-label">Leído</span>';
            readAllBtn.disabled = false;
            readAllBtn.classList.remove('did-read');
        }, 3000);
    }
    document.querySelectorAll('#notifList .notif-status-dot').forEach(dot => {
        dot.classList.remove('active');
        dot.closest('.notif-item').style.opacity = '0.45';
    });
    const badge = document.getElementById('notifCount');
    if (badge) { badge.textContent = ''; badge.style.display = 'none'; }
    const navPub = document.getElementById('navPubBadge');
    if (navPub) navPub.style.display = 'none';
};

const _AVATAR_PALETTES = [
    ['#d35400','#e67e22'],
    ['#1a6fa8','#2980b9'],
    ['#1a8f4c','#27ae60'],
    ['#6d28d9','#8b5cf6'],
    ['#b91c1c','#ef4444'],
    ['#0e7490','#06b6d4'],
    ['#92400e','#d97706'],
    ['#1e3a8a','#3b82f6'],
];

function _avatarPalette(name) {
    const code = (name || '').split('').reduce((h, c) => (h << 5) - h + c.charCodeAt(0), 0);
    return _AVATAR_PALETTES[Math.abs(code) % _AVATAR_PALETTES.length];
}

function _buildAvatarDiv(name, fontSize = '1rem') {
    const initial  = (name || '?').charAt(0).toUpperCase();
    const [c1, c2] = _avatarPalette(name);
    const div = document.createElement('div');
    div.className = 'avatar-initial';
    div.textContent = initial;
    div.style.cssText = `
        width:100%;height:100%;
        background:linear-gradient(135deg,${c1},${c2});
        display:flex;align-items:center;justify-content:center;
        color:#fff;font-weight:800;font-size:${fontSize};
        font-family:'DM Sans',system-ui,sans-serif;
        border-radius:inherit;user-select:none;letter-spacing:-0.02em;
    `;
    return div;
}

function _applyAvatarFallback(imgEl, name) {
    if (!imgEl || !imgEl.parentNode) return;
    const container = imgEl.parentNode;
    const size = container.offsetWidth || imgEl.offsetWidth || parseInt(imgEl.getAttribute('width') || '0', 10) || 40;
    const fs   = Math.max(10, Math.round(size * 0.42)) + 'px';
    const div  = _buildAvatarDiv(name, fs);
    div.style.width       = '100%';
    div.style.height      = '100%';
    div.style.borderRadius = '50%';
    container.replaceChild(div, imgEl);
}

window._avatarFallback = _applyAvatarFallback;

function _cloudinaryThumb(url, w = 80, h = 80) {
    if (!url || !url.includes('cloudinary.com') || !url.includes('/upload/')) return url;
    return url.replace('/upload/', `/upload/w_${w},h_${h},c_fill,g_auto:face,q_auto,f_auto/`);
}

function _googleThumb(url, size = 80) {
    if (!url || !url.includes('googleusercontent.com')) return url;
    return url.replace(/=s\d+-c/, `=s${size}-c`).replace(/\/s\d+-c/, `/s${size}-c`);
}

function loadProfileImg(imgEl, rawUrl, name, thumbSize = 80) {
    if (!imgEl || !imgEl.parentNode) return;
    if (imgEl.dataset.profileLoaded) return;

    const container = imgEl.parentNode;
    const size = container.offsetWidth || 40;
    const fs   = Math.max(10, Math.round(size * 0.42)) + 'px';

    const isDefault = !rawUrl
        || rawUrl.includes('default_icon_profile')
        || rawUrl === '/static/uploads/default_icon_profile.png';

    const avatarDiv = _buildAvatarDiv(name, fs);
    avatarDiv.style.width        = '100%';
    avatarDiv.style.height       = '100%';
    avatarDiv.style.borderRadius = '50%';
    container.replaceChild(avatarDiv, imgEl);

    if (isDefault) return;

    let optimized = rawUrl;
    if (rawUrl.includes('cloudinary.com'))             optimized = _cloudinaryThumb(rawUrl, thumbSize, thumbSize);
    else if (rawUrl.includes('googleusercontent.com')) optimized = _googleThumb(rawUrl, thumbSize);

    const tmp = new Image();
    tmp.onload = () => {
        if (!avatarDiv.parentNode) return;
        const foto = document.createElement('img');
        foto.src           = optimized;
        foto.alt           = name || 'Perfil';
        foto.dataset.profileLoaded = '1';
        foto.style.cssText = 'width:100%;height:100%;object-fit:cover;object-position:center top;border-radius:50%;display:block;';
        foto.onerror = () => { if (foto.parentNode) container.replaceChild(_buildAvatarDiv(name, fs), foto); };
        container.replaceChild(foto, avatarDiv);
    };
    tmp.src = optimized;
}

function initAllProfileImages() {
    document.querySelectorAll('img[data-profile]').forEach(img => {
        const raw  = img.dataset.profile;
        const name = img.dataset.profileName || '';
        const size = parseInt(img.dataset.profileSize || '80', 10);
        loadProfileImg(img, raw, name, size);
    });
}

document.addEventListener('DOMContentLoaded', initAllProfileImages);

function _fileIconInfo(nombre) {
    const ext = (nombre || '').split('.').pop().toLowerCase();
    const map = {
        pdf:  { icon: 'bi-file-earmark-pdf-fill',  color: '#e74c3c' },
        doc:  { icon: 'bi-file-earmark-word-fill',  color: '#2980b9' },
        docx: { icon: 'bi-file-earmark-word-fill',  color: '#2980b9' },
        xls:  { icon: 'bi-file-earmark-excel-fill', color: '#27ae60' },
        xlsx: { icon: 'bi-file-earmark-excel-fill', color: '#27ae60' },
        ppt:  { icon: 'bi-file-earmark-ppt-fill',   color: '#e67e22' },
        pptx: { icon: 'bi-file-earmark-ppt-fill',   color: '#e67e22' },
        zip:  { icon: 'bi-file-earmark-zip-fill',   color: '#8e44ad' },
        rar:  { icon: 'bi-file-earmark-zip-fill',   color: '#8e44ad' },
        '7z': { icon: 'bi-file-earmark-zip-fill',   color: '#8e44ad' },
        jpg:  { icon: 'bi-file-earmark-image-fill', color: '#d35400' },
        jpeg: { icon: 'bi-file-earmark-image-fill', color: '#d35400' },
        png:  { icon: 'bi-file-earmark-image-fill', color: '#d35400' },
        gif:  { icon: 'bi-file-earmark-image-fill', color: '#d35400' },
        mp4:  { icon: 'bi-file-earmark-play-fill',  color: '#c0392b' },
        mov:  { icon: 'bi-file-earmark-play-fill',  color: '#c0392b' },
        txt:  { icon: 'bi-file-earmark-text-fill',  color: '#7f8c8d' },
        pkt:  { icon: 'bi-diagram-3-fill',          color: '#2471a3' },
        sql:  { icon: 'bi-database-fill',           color: '#1a5276' },
    };
    return map[ext] || { icon: 'bi-file-earmark-fill', color: '#95a5a6' };
}

function _fmtFileBytes(b) {
    if (!b || b === 0) return '0 B';
    if (b < 1024) return b + ' B';
    if (b < 1024 * 1024) return (b / 1024).toFixed(1) + ' KB';
    return (b / (1024 * 1024)).toFixed(2) + ' MB';
}

function _fmtFileDate(iso) {
    if (!iso) return '';
    try { return new Date(iso).toLocaleDateString('es-CO', { day:'2-digit', month:'short', year:'numeric' }); }
    catch { return ''; }
}

document.addEventListener('DOMContentLoaded', function _checkProfileNotif() {
    if (!window._PROFILE_INCOMPLETE) return;

    const KEY  = '_dantojitos_profile_notif_ts';
    const last = parseInt(localStorage.getItem(KEY) || '0', 10);
    const now  = Date.now();
    if (now - last < 24 * 60 * 60 * 1000) return;

    localStorage.setItem(KEY, String(now));

    setTimeout(function() {
        _pushClientNotif({
            tipo:    'perfil',
            titulo:  '¡Completa tu perfil!',
            mensaje: 'Agrega tu cédula real, teléfono y dirección de entrega.',
            imagen:  '/static/uploads/logo.ico',
            url:     '/mi_perfil',
        });
        const bell = document.getElementById('navClientBellBtn');
        if (bell && !_isNotifMuted()) bell.classList.add('ring-anim');
        setTimeout(() => bell && bell.classList.remove('ring-anim'), 2500);
    }, 1500);
});

(function _marcaDeAgua() {
    var _patronCache = null;
    var _moChat = false;

    function _patronRepetido() {
        if (_patronCache) return _patronCache;
        var W = 220, H = 110;
        var c = document.createElement('canvas');
        c.width = W; c.height = H;
        var ctx = c.getContext('2d');
        ctx.clearRect(0, 0, W, H);
        ctx.save();
        ctx.translate(W / 2, H / 2);
        ctx.rotate(-28 * (Math.PI / 180));
        ctx.font = 'bold 13px system-ui,sans-serif';
        ctx.fillStyle = '#d35400';
        ctx.globalAlpha = 0.04;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText("D'Antojitos© 2023", 0, 0);
        ctx.restore();
        _patronCache = c.toDataURL('image/png');
        return _patronCache;
    }

    var _IDS_CHAT = ['chatBox', 'privConvBox', 'staffConvBox', 'clienteHiloBox'];

    function _aplicarACajas() {
        var patron = _patronRepetido();
        _IDS_CHAT.forEach(function(id) {
            var box = document.getElementById(id);
            if (!box || box._wmOk) return;
            box._wmOk = true;
            var pos = window.getComputedStyle(box).position;
            if (!pos || pos === 'static') box.style.position = 'relative';
            var capa = document.createElement('div');
            capa.setAttribute('aria-hidden', 'true');
            capa.style.cssText = 'position:absolute;inset:0;z-index:0;pointer-events:none;user-select:none;' +
                'background-image:url(' + patron + ');background-repeat:repeat;';
            box.insertBefore(capa, box.firstChild);
        });
    }

    function _inyectar() {
        if (!document.querySelector('.chat-container')) return;
        _aplicarACajas();
        if (!_moChat && typeof MutationObserver !== 'undefined') {
            _moChat = true;
            new MutationObserver(_aplicarACajas).observe(document.body, { childList: true, subtree: true });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', _inyectar);
    } else {
        _inyectar();
    }
})();
