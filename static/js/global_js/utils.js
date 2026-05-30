
//  D'Antojitos — Utilidades globales
//  Toast admin (blanco), toast público (oscuro), confirm modal,
//  scroll-to-top, barra de progreso, notificaciones navegador.

// ——— TOAST ADMIN (fondo blanco, verde/rojo) — modelo: pedidos.js ———
function mostrarAlerta(mensaje, esError = false, duracionMs = 4000) {
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
    const lang = (typeof getLang === 'function') ? getLang() : 'es';

    const btn = document.getElementById('themeToggleBtn');
    if (btn) {
        const icon = btn.querySelector('i');
        if (icon) icon.className = theme === 'dark' ? 'bi bi-sun-fill me-2' : 'bi bi-moon-fill me-2';
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

//  PANEL GLOBAL DE NOTIFICACIONES — funciona en TODAS las páginas

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
        list.innerHTML = '';
        const total = Array.isArray(data) ? data.length : 0;
        const activos = Array.isArray(data) ? data.filter(p => ['Pendiente','Emitida','Emitido'].includes(p.estado)).length : 0;
        if (count) count.textContent = activos || total;
        if (empty) empty.style.display = total ? 'none' : 'flex';
        if (badge) { badge.textContent = activos > 9 ? '9+' : (activos || ''); badge.style.display = activos > 0 ? 'flex' : 'none'; }

        const ESTADO_CFG = {
            'Pendiente': { color:'#b45309', bg:'#fef3c7', icon:'bi-hourglass-split'   },
            'Emitida':   { color:'#0369a1', bg:'#e0f2fe', icon:'bi-file-earmark-arrow-up' },
            'Emitido':   { color:'#0369a1', bg:'#e0f2fe', icon:'bi-file-earmark-arrow-up' },
            'Enviado':   { color:'#92400e', bg:'#fef3c7', icon:'bi-truck'              },
            'Pagado ✓':  { color:'#15803d', bg:'#dcfce7', icon:'bi-check-circle-fill'  },
            'Entregado': { color:'#15803d', bg:'#dcfce7', icon:'bi-house-check-fill'   },
            'Cancelado': { color:'#64748b', bg:'#f1f5f9', icon:'bi-x-circle'           },
            'Anulada':   { color:'#dc2626', bg:'#fee2e2', icon:'bi-slash-circle'       },
        };
        let _sistemRead = JSON.parse(sessionStorage.getItem('_sistemRead') || '[]');
        (Array.isArray(data) ? data : []).forEach((n, i) => {
            const li = document.createElement('li');
            li.className = 'notif-item';
            li.id = `sitem-${i}`;
            const cfg = ESTADO_CFG[n.estado] || { color:'#888', bg:'#f5f5f5', icon:'bi-bell' };
            const isRead = _sistemRead.includes(n.id_pedido||String(i));
            li.innerHTML = `
                <div class="notif-item-img" style="background:${cfg.bg};">
                    <i class="bi ${cfg.icon}" style="color:${cfg.color};font-size:1.1rem;"></i>
                </div>
                <div class="notif-item-info" onclick="window.location.href='/pedidos_page'" style="flex:1;min-width:0;cursor:pointer;">
                    <strong style="opacity:${isRead ? 0.5 : 1};">${n.titulo}</strong>
                    <small style="display:block;margin-top:2px;">
                        <span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:${cfg.color};vertical-align:middle;margin-right:4px;"></span>
                        ${n.estado} · ${n.descripcion || ''} · <i class="bi bi-clock" style="font-size:0.6rem;"></i> ${n.fecha || ''}
                    </small>
                </div>
                <div class="notif-item-actions">
                    <button class="btn-notif-del" onclick="event.stopPropagation();_quitarNotifSistem(this,'${n.id_pedido||i}')" title="Quitar">
                        <i class="bi bi-x-lg"></i>
                    </button>
                </div>`;
            list.appendChild(li);
        });
    } catch { /* silent */ }
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

        // Actualizar badge en navbar
        ['campanaBadge','navBellBadge'].forEach(id => {
            const b = document.getElementById(id);
            if (!b) return;
            b.textContent = total > 9 ? '9+' : total;
            b.style.display = total > 0 ? 'flex' : 'none';
        });

        const pubCount = document.getElementById('notifCount');
        const pubBadge = document.getElementById('navPubBadge');
        const activas  = Array.isArray(data) ? data.filter(n => n.estado).length : 0;
        if (pubCount) { pubCount.textContent = activas || ''; pubCount.style.display = activas > 0 ? 'inline-flex' : 'none'; }
        if (pubBadge) { pubBadge.textContent = activas > 9 ? '9+' : activas; pubBadge.style.display = activas > 0 ? 'flex' : 'none'; }

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
                    <button class="notif-status-dot ${n.estado ? 'active' : ''}"
                            onclick="toggleNotifEstado('${n.id_publicidad}', !${n.estado})"
                            title="${n.estado ? 'Desactivar' : 'Activar'}"></button>
                    <button class="btn-notif-del" onclick="eliminarNotif('${n.id_publicidad}')" title="Eliminar">
                        <i class="bi bi-x-lg"></i>
                    </button>
                </div>`;
            list.appendChild(li);
        });
    } catch { /* silent */ }
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

document.addEventListener('DOMContentLoaded', () => {
    initScrollToTop();
    initScrollProgressBar();
    solicitarPermisosNotificacion();
    setTheme(localStorage.getItem('dantojitos_theme') || 'light');
    if (document.getElementById('notifAdminPanel')) cargarNotificacionesAdmin();
});

/* ── Helpers bandeja sistema (pedidos) ── */
function _quitarNotifSistem(btn, id) {
    const li = btn.closest('.notif-item');
    if (li) { li.style.transition = 'opacity 0.25s,transform 0.25s'; li.style.opacity = '0'; li.style.transform = 'translateX(16px)'; setTimeout(() => li.remove(), 260); }
    let read = JSON.parse(sessionStorage.getItem('_sistemRead') || '[]');
    if (!read.includes(String(id))) read.push(String(id));
    sessionStorage.setItem('_sistemRead', JSON.stringify(read));
}

window._pedidosMarcarTodo = function() {
    document.querySelectorAll('#sistemList .notif-item strong').forEach(el => { el.style.opacity = '0.45'; });
    const badge = document.getElementById('sistemCount');
    if (badge) { badge.textContent = ''; badge.style.display = 'none'; }
    const navBadge = document.getElementById('navBellBadge');
    if (navBadge) navBadge.style.display = 'none';
    const readAllBtn = document.getElementById('sistemReadAllBtn');
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
    if (typeof window._pedidosLog !== 'undefined' || typeof _notifLog !== 'undefined') {
        if (typeof _notifLog !== 'undefined') {
            _notifLog.forEach(n => { n.activa = false; });
            localStorage.setItem('pedidos_notif_log', JSON.stringify(_notifLog));
        }
    }
};

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

