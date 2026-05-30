// ============================================================
//  D'Antojitos — Utilidades globales
//  Toast admin (blanco), toast público (oscuro), confirm modal,
//  scroll-to-top, barra de progreso, notificaciones navegador.
// ============================================================

// ——— TOAST ADMIN (fondo blanco, verde/rojo) — modelo: pedidos.js ———
function mostrarAlerta(mensaje, esError = false, duracionMs = 4000) {
    let container = document.getElementById('toastContainer');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toastContainer';
        container.style.cssText = 'position:fixed;top:25px;right:25px;z-index:10000;display:flex;flex-direction:column;gap:12px;';
        document.body.appendChild(container);
    }

    _playNotifSound(esError ? 'error' : 'default');

    const colorPrimario = esError ? '#ff4757' : '#2ed573';
    const sombraColor   = esError ? 'rgba(255,71,87,0.2)' : 'rgba(46,213,115,0.2)';

    const toast = document.createElement('div');
    toast.className = 'custom-toast-alert';
    toast.style.cssText = `
        background:#fff;color:#2f3542;padding:16px 24px;border-radius:12px;
        box-shadow:0 10px 30px ${sombraColor};display:flex;justify-content:space-between;
        align-items:center;min-width:350px;max-width:450px;border-left:6px solid ${colorPrimario};
        transition:all 0.5s cubic-bezier(0.175,0.885,0.32,1.275);
        transform:translateX(100%);opacity:0;`;

    toast.innerHTML = `
        <div class="d-flex align-items-center">
            <div style="background:${colorPrimario};width:35px;height:35px;border-radius:50%;
                        display:flex;align-items:center;justify-content:center;margin-right:15px;">
                <i class="bi ${esError ? 'bi-x-circle-fill' : 'bi-check-circle-fill'} text-white fs-5"></i>
            </div>
            <div>
                <strong style="display:block;font-size:0.8rem;text-transform:uppercase;color:#747d8c;">
                    Notificación de Sistema
                </strong>
                <span style="font-size:0.95rem;font-weight:600;">${mensaje}</span>
            </div>
        </div>
        <i class="bi bi-x-lg ms-3 btn-close-toast" style="cursor:pointer;font-size:1rem;color:#a4b0be;"></i>`;

    container.appendChild(toast);

    requestAnimationFrame(() => {
        toast.style.transform = 'translateX(0)';
        toast.style.opacity   = '1';
    });

    const eliminar = () => {
        toast.style.transform = 'translateX(120%)';
        toast.style.opacity   = '0';
        setTimeout(() => toast.remove(), 500);
    };
    toast.querySelector('.btn-close-toast').onclick = eliminar;
    setTimeout(eliminar, duracionMs);
}

// ——— TOAST PÚBLICO (fondo oscuro, con imagen) — modelo: catalogo.js / inicio ———
const _notifIdSet = new Set();

function mostrarAlertaPublica({
    mensaje    = '',
    titulo     = '',
    imagen     = '/static/uploads/logo.png',
    tipo       = 'info',
    duracion   = 4000,
    idUnico    = null,
    sonido     = true
} = {}) {
    if (idUnico && _notifIdSet.has(idUnico)) return;
    if (idUnico) {
        _notifIdSet.add(idUnico);
        setTimeout(() => _notifIdSet.delete(idUnico), duracion + 1000);
    }

    let cont = document.getElementById('toastContainer');
    if (!cont) {
        cont = document.createElement('div');
        cont.id = 'toastContainer';
        cont.style.cssText = 'position:fixed;top:20px;right:20px;z-index:10000;display:flex;flex-direction:column;gap:10px;';
        document.body.appendChild(cont);
    }

    if (sonido) _playNotifSound(tipo === 'error' || tipo === 'warning' ? 'error' : 'default');

    const esError      = tipo === 'error' || tipo === 'warning';
    const colorPrimario = esError ? '#ff4757' : '#ff9800';
    const iconClass     = esError            ? 'bi-exclamation-triangle-fill' :
                          tipo === 'favorito' ? 'bi-heart-fill'               :
                          tipo === 'bienvenida'? 'bi-emoji-smile-fill'        : 'bi-stars';
    const tituloFinal   = titulo || (esError ? 'Sistema' : 'D\'Antojitos');

    const toast = document.createElement('div');
    toast.style.cssText = `
        background:#121212;color:#fff;padding:14px 18px;border-radius:12px;
        box-shadow:0 8px 25px rgba(0,0,0,0.5);display:flex;align-items:center;
        min-width:320px;max-width:400px;border-left:5px solid ${colorPrimario};
        transition:all 0.4s cubic-bezier(0.175,0.885,0.32,1.275);
        transform:translateX(120%);opacity:0;`;

    toast.innerHTML = `
        <div class="d-flex align-items-center w-100">
            <div style="position:relative;flex-shrink:0;">
                <img src="${imagen}" style="width:50px;height:50px;object-fit:cover;border-radius:8px;"
                     onerror="this.src='/static/uploads/logo.png'">
                <div style="position:absolute;bottom:-4px;right:-4px;background:${colorPrimario};
                            width:20px;height:20px;border-radius:50%;display:flex;align-items:center;
                            justify-content:center;border:2px solid #121212;">
                    <i class="bi ${iconClass} text-white" style="font-size:0.65rem;"></i>
                </div>
            </div>
            <div class="ms-3 flex-grow-1">
                <strong style="display:block;font-size:0.7rem;text-transform:uppercase;
                               color:${colorPrimario};letter-spacing:0.8px;">${tituloFinal}</strong>
                <div style="font-size:0.85rem;font-weight:400;color:#f0f0f0;line-height:1.2;">${mensaje}</div>
            </div>
            <button class="btn-close-toast ms-2"
                    style="background:none;border:none;color:#888;cursor:pointer;font-size:1rem;">
                <i class="bi bi-x-lg"></i>
            </button>
        </div>`;

    cont.appendChild(toast);
    setTimeout(() => {
        toast.style.transform = 'translateX(0)';
        toast.style.opacity   = '1';
    }, 50);

    const remove = () => {
        toast.style.transform = 'translateX(120%)';
        toast.style.opacity   = '0';
        setTimeout(() => toast.remove(), 400);
    };
    toast.querySelector('.btn-close-toast').onclick = remove;
    setTimeout(remove, duracion);
}

// ——— CONFIRM MODAL — modelo: pedidos.js ———
function mostrarConfirmacionApp(titulo, mensaje, onConfirm) {
    const existing = document.getElementById('appModalConfirm');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'appModalConfirm';
    overlay.style.cssText = `
        position:fixed;top:0;left:0;width:100%;height:100%;
        background:rgba(0,0,0,0.8);display:flex;align-items:center;
        justify-content:center;z-index:20000;backdrop-filter:blur(5px);
        transition:opacity 0.3s ease;`;

    const modal = document.createElement('div');
    modal.style.cssText = `
        background:#fff;width:95%;max-width:420px;padding:35px;
        border-radius:25px;text-align:center;box-shadow:0 25px 50px rgba(0,0,0,0.4);
        transform:scale(0.7);transition:transform 0.4s cubic-bezier(0.175,0.885,0.32,1.275);`;

    modal.innerHTML = `
        <div style="color:#ff4757;font-size:4rem;margin-bottom:20px;">
            <i class="bi bi-exclamation-triangle-fill"></i>
        </div>
        <h2 style="margin-bottom:12px;font-weight:800;color:#1e272e;letter-spacing:-0.5px;">${titulo}</h2>
        <p style="color:#485460;margin-bottom:30px;line-height:1.6;font-size:1.05rem;">${mensaje}</p>
        <div style="display:flex;gap:12px;justify-content:center;">
            <button id="btnCancelModal" class="btn btn-light"
                    style="padding:12px 30px;border-radius:15px;font-weight:700;border:2px solid #f1f2f6;">
                CANCELAR
            </button>
            <button id="btnConfirmModal" class="btn btn-danger"
                    style="padding:12px 30px;border-radius:15px;font-weight:700;
                           background:#ff4757;border:none;box-shadow:0 5px 15px rgba(255,71,87,0.3);">
                CONFIRMAR
            </button>
        </div>`;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    setTimeout(() => { modal.style.transform = 'scale(1)'; }, 10);

    const cerrar = () => {
        modal.style.transform = 'scale(0.7)';
        overlay.style.opacity = '0';
        setTimeout(() => overlay.remove(), 300);
    };
    document.getElementById('btnCancelModal').onclick = cerrar;
    document.getElementById('btnConfirmModal').onclick = () => { onConfirm(); cerrar(); };
}

// ——— SCROLL TO TOP ———
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

// ——— BARRA DE PROGRESO SCROLL ———
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

// ——— NOTIFICACIONES NAVEGADOR (una sola vez) ———
function solicitarPermisosNotificacion() {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'granted') return;
    if (localStorage.getItem('dantojitos_notif_asked')) return;

    Notification.requestPermission().then(perm => {
        localStorage.setItem('dantojitos_notif_asked', '1');
    });
}

function lanzarNotificacionNativa(titulo, cuerpo, icono = '/static/uploads/logo.png') {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    try {
        new Notification(titulo, { body: cuerpo, icon: icono });
    } catch (e) { console.warn('Notificación nativa no disponible'); }
}

// ——— AUDIO INTERNO (no expuesto globalmente) ———
function _playNotifSound(type = 'default') {
    try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        const ctx  = new AudioCtx();
        const osc  = ctx.createOscillator();
        const gain = ctx.createGain();

        if (type === 'error') {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(330, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(110, ctx.currentTime + 0.3);
            gain.gain.setValueAtTime(0.03, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
            osc.start(); osc.stop(ctx.currentTime + 0.4);
        } else {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(880, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.1);
            gain.gain.setValueAtTime(0.05, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
            osc.start(); osc.stop(ctx.currentTime + 0.2);
        }
        osc.connect(gain);
        gain.connect(ctx.destination);
    } catch (e) {}
}

// ——— TEMA CLARO / OSCURO ———
function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('dantojitos_theme', theme);
    const btn  = document.getElementById('themeToggleBtn');
    if (!btn) return;
    const icon = btn.querySelector('i');
    if (icon) {
        icon.className = theme === 'dark' ? 'bi bi-sun-fill me-2' : 'bi bi-moon-fill me-2';
    }
    // Si el botón tiene texto de etiqueta, actualizarlo
    const label = btn.querySelector('[data-i18n="nav.theme"]');
    if (label) {
        const lang = (typeof getLang === 'function') ? getLang() : 'es';
        label.textContent = theme === 'dark'
            ? (lang === 'en' ? 'Light Mode' : 'Modo Claro')
            : (lang === 'en' ? 'Dark Mode'  : 'Modo Oscuro');
    }
}

function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'light';
    setTheme(current === 'dark' ? 'light' : 'dark');
}

// ——— INIT GLOBAL ———
document.addEventListener('DOMContentLoaded', () => {
    initScrollToTop();
    initScrollProgressBar();
    solicitarPermisosNotificacion();
    setTheme(localStorage.getItem('dantojitos_theme') || 'light');
});
