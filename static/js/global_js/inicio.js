
//  D'Antojitos — Inicio (publicidad + monitor catálogo + editor admin)

let productosMemoria       = [];
let notificacionesDisponibles = [];
let isFirstLoad            = true;
let audioCtx               = null;
let swiperInstance         = null;

let _editMode      = false;
let _configOriginal = {};   // snapshot antes de editar para poder cancelar
let _configActual   = {};   // config cargada del servidor
let _sortableMain   = null;
let _sortableSidebar = null;
let _targetConfigKey = null; // para el modal de texto

//  AUDIO

function initAudioContext() {
    if (!audioCtx) {
        const Cls = window.AudioContext || window.webkitAudioContext;
        if (Cls) audioCtx = new Cls();
    }
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
}

function playNotificationSound(type = 'default') {
    try {
        initAudioContext();
        if (!audioCtx) return;
        const osc  = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        if (type === 'agotado') {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(330, audioCtx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(110, audioCtx.currentTime + 0.3);
            gain.gain.setValueAtTime(0.03, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.4);
            osc.start(); osc.stop(audioCtx.currentTime + 0.4);
        } else {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(523.25, audioCtx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(1046.50, audioCtx.currentTime + 0.15);
            gain.gain.setValueAtTime(0.02, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.6);
            osc.start(); osc.stop(audioCtx.currentTime + 0.6);
        }
        osc.connect(gain);
        gain.connect(audioCtx.destination);
    } catch {}
}

//  TOAST

function mostrarToastPublicidad(imagen, titulo, descripcion, isError = false) {
    mostrarAlertaPublica({ imagen, titulo, mensaje: descripcion, tipo: isError ? 'error' : 'info', duracion: 6000 });
}

function mostrarToastActualizacion(imagen, titulo, descripcion, idUnico, isError = false) {
    mostrarAlertaPublica({ imagen, titulo, mensaje: descripcion, tipo: isError ? 'error' : 'info', idUnico, duracion: 6000 });
}

//  MONITOR CATÁLOGO

async function monitorearCambiosCatalogo() {
    try {
        const res  = await fetch("/obtener_catalogo");
        const data = await res.json();
        const nuevos = data.productos || [];
        if (!isFirstLoad) {
            nuevos.forEach(nuevo => {
                const viejo = productosMemoria.find(p => p.id_producto == nuevo.id_producto);
                if (!viejo) return;
                if (viejo.stock > 0 && nuevo.stock <= 0)
                    mostrarToastActualizacion(nuevo.imagen_url || '/static/uploads/logo.png', "¡Producto Agotado!", `Se acaba de terminar: ${nuevo.nombre}`, `agotado-${nuevo.id_producto}`, true);
                else if (viejo.stock <= 0 && nuevo.stock > 0)
                    mostrarToastActualizacion(nuevo.imagen_url || '/static/uploads/logo.png', "¡Nueva Disponibilidad!", `${nuevo.nombre} está listo para pedir nuevamente`, `disponible-${nuevo.id_producto}`);
            });
        }
        productosMemoria = nuevos;
        isFirstLoad = false;
    } catch {}
}

//  MARKETING / PUBLICIDAD

async function cargarMarketing() {
    try {
        const res = await fetch("/api/publicidad/activa", { cache: "no-store" });
        const arr = await res.json();
        if (!Array.isArray(arr)) return;

        const secAlFrente  = document.getElementById("seccionesAlFrente");
        const secDebajo    = document.getElementById("seccionesDebajo");
        const carouselInner = document.getElementById("carouselItems");
        const swiperWrap   = document.querySelector(".swiperPromo");

        if (secAlFrente)  secAlFrente.innerHTML  = "";
        if (secDebajo)    secDebajo.innerHTML    = "";
        if (carouselInner) carouselInner.innerHTML = "";

        notificacionesDisponibles = arr.filter(i => i.tipo === 'notificacion');

        // Cinta inicio — solo muestra lo que el admin configura en publicidad
        // Prioridad: inicio_cinta → cinta; si no hay nada configurado, se oculta
        const cintaInicioEl = document.getElementById('cintaInicio');
        if (cintaInicioEl) {
            let cintaItems = arr.filter(i => i.tipo === 'inicio_cinta' && i.estado !== false);
            if (!cintaItems.length) cintaItems = arr.filter(i => i.tipo === 'cinta' && i.estado !== false);

            if (cintaItems.length > 0) {
                const buildItem = (imgUrl, label) => {
                    const validImg = imgUrl && imgUrl.startsWith('http');
                    return `<div class="cinta-inicio-item">
                        ${validImg
                            ? `<div class="cinta-img-aura"><img src="${imgUrl}" alt="${label}" loading="lazy"
                                   onerror="this.parentElement.style.display='none'"></div>`
                            : ''}
                        <span>${label || ''}</span>
                    </div>`;
                };
                // Triplicar para animación fluida
                const tripled = [...cintaItems, ...cintaItems, ...cintaItems];
                cintaInicioEl.innerHTML = `<div class="cinta-inicio-track">${
                    tripled.map(i => buildItem(i.imagen_url || '', i.titulo || '')).join('')
                }</div>`;
                cintaInicioEl.style.display = 'block';
            } else {
                cintaInicioEl.style.display = 'none';
            }
        }

        // Secciones
        arr.filter(i => i.tipo === 'seccion' && i.estado !== false).forEach((item, idx) => {
            const imgSrc = (item.imagen_url && item.imagen_url.startsWith('http'))
                ? item.imagen_url : '/static/uploads/logo.png';
            const card = `
                <div class="seccion-card shadow-sm h-100 w-100">
                    <img src="${imgSrc}" class="postre-imagen-seccion w-100"
                         loading="lazy" onerror="this.src='/static/uploads/logo.png'">
                    <div class="p-3 d-flex flex-column flex-grow-1">
                        <h6 class="fw-bold mb-1" style="color:#d6336c;font-size:1.1rem;">${item.titulo || ''}</h6>
                        <p class="text-muted mb-0 small">${item.descripcion || ''}</p>
                    </div>
                </div>`;
            if (secAlFrente && idx < 2) {
                const w = document.createElement('div');
                w.className = 'w-100 mb-3';
                w.innerHTML = card;
                secAlFrente.appendChild(w);
            } else if (secDebajo) {
                const col = document.createElement('div');
                col.className = 'col-6 col-md-4 col-lg-3 mb-4';
                col.innerHTML = card;
                secDebajo.appendChild(col);
            }
        });

        // Carrusel — solo items con imagen válida
        const carrusel = arr.filter(i =>
            i.tipo === 'carrusel' &&
            i.estado !== false &&
            i.imagen_url && i.imagen_url.startsWith('http')
        );

        if (swiperInstance) {
            try { swiperInstance.destroy(true, true); } catch {}
            swiperInstance = null;
        }

        if (swiperWrap) swiperWrap.style.display = carrusel.length ? '' : 'none';

        if (carrusel.length && carouselInner) {
            carrusel.forEach(item => {
                const div = document.createElement('div');
                div.className = 'swiper-slide';
                div.innerHTML = `
                    <div class="carousel-item active">
                        <div class="carousel-img-wrapper">
                            <img src="${item.imagen_url}" class="carousel-background-blur"
                                 loading="lazy" onerror="this.style.display='none'">
                            <img src="${item.imagen_url}" class="d-block carousel-img-render"
                                 loading="lazy" onerror="this.style.opacity='0'">
                            <div class="carousel-overlay"></div>
                        </div>
                        <div class="carousel-caption-custom">
                            <h6 class="carousel-title-animate">${item.titulo || ''}</h6>
                            <div class="carousel-divider"></div>
                            <p class="carousel-desc-animate">${item.descripcion || ''}</p>
                        </div>
                    </div>`;
                carouselInner.appendChild(div);
            });

            // Pequeño delay para que el DOM se pinte antes de iniciar Swiper
            requestAnimationFrame(() => {
                swiperInstance = new Swiper('.swiperPromo', {
                    loop:         carrusel.length > 1,
                    effect:       'fade',
                    fadeEffect:   { crossFade: true },
                    autoplay:     { delay: 5000, disableOnInteraction: false },
                    pagination:   { el: '.swiper-pagination', clickable: true },
                    navigation:   { nextEl: '.swiper-button-next', prevEl: '.swiper-button-prev' }
                });
            });
        }
    } catch (e) { console.error("Error publicidad:", e); }
}

//  CONFIG — cargar y aplicar textos

async function cargarConfigInicio() {
    try {
        const res  = await fetch("/api/inicio/config", { cache: "no-store" });
        const data = await res.json();
        _configActual = data;
        aplicarConfigAlDOM(data);
    } catch {}
}

function aplicarConfigAlDOM(cfg) {
    document.querySelectorAll('[data-config-key]').forEach(el => {
        const val = cfg[el.dataset.configKey];
        if (val !== undefined && val !== null) el.innerHTML = val;
    });

    // Visibilidad de widgets
    Object.keys(cfg).forEach(k => {
        if (k.startsWith('visible_')) {
            const widgetId = k.replace('visible_', '');
            const oculto   = cfg[k] === 'false';
            const bloque   = document.querySelector(`.widget-bloque[data-widget="${widgetId}"]`);
            if (bloque) aplicarVisibilidadWidget(bloque, !oculto);
        }
    });

    // Orden widgets (main)
    try {
        const orden = JSON.parse(cfg['orden_main'] || '[]');
        if (orden.length) reordenarWidgets('sortable-main', orden);
    } catch {}

    try {
        const orden = JSON.parse(cfg['orden_sidebar'] || '[]');
        if (orden.length) reordenarWidgets('sortable-sidebar', orden);
    } catch {}
}

function reordenarWidgets(containerId, orden) {
    const container = document.getElementById(containerId);
    if (!container) return;
    orden.forEach(widgetId => {
        const el = container.querySelector(`.widget-bloque[data-widget="${widgetId}"]`);
        if (el) container.appendChild(el);
    });
}

function aplicarVisibilidadWidget(bloque, visible) {
    const inner = bloque.querySelectorAll(':scope > *:not(.widget-controls)');
    inner.forEach(el => { el.style.display = visible ? '' : 'none'; });
    bloque.classList.toggle('widget-oculto', !visible);
    const btn = bloque.querySelector('.widget-toggle');
    if (btn) {
        const icon = btn.querySelector('i');
        if (icon) {
            icon.className = visible ? 'bi bi-eye' : 'bi bi-eye-slash';
        }
    }
}

//  MENSAJE BIENVENIDA (botón admin en template)

function actualizarMensajeBienvenida() {
    const inp = document.getElementById('inputMensajeAdmin');
    const el  = document.getElementById('mensajeBienvenidaDinamico');
    if (!inp || !el) return;
    const val = inp.value.trim();
    if (!val) return;
    el.textContent = val;
    _configActual['bienvenida_mensaje'] = val;
    inp.value = '';
    fetch('/api/inicio/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bienvenida_mensaje: val })
    }).then(r => r.json()).then(d => {
        mostrarAlerta(d.ok ? 'Mensaje actualizado' : (d.error || 'Error'), !d.ok);
    }).catch(() => mostrarAlerta('Error de conexión', true));
}

//  EDITOR DE WIDGETS

function toggleModoEdicion() {
    if (_editMode) {
        cancelarEdicion();
    } else {
        _editMode = true;
        _configOriginal = JSON.parse(JSON.stringify(_configActual));
        document.body.classList.add('editing');

        const btn   = document.getElementById('btnEditarInicio');
        const label = document.getElementById('editBtnLabel');
        const bar   = document.getElementById('saveBar');
        if (btn)   btn.classList.add('active');
        if (label) label.textContent = 'Salir de Edición';
        if (bar)   bar.classList.add('show');

        iniciarSortable();
        vincularBotonesWidget();
    }
}

function cancelarEdicion() {
    _editMode = false;
    document.body.classList.remove('editing');

    const btn   = document.getElementById('btnEditarInicio');
    const label = document.getElementById('editBtnLabel');
    const bar   = document.getElementById('saveBar');
    if (btn)   btn.classList.remove('active');
    if (label) label.textContent = 'Editar Inicio';
    if (bar)   bar.classList.remove('show');

    destruirSortable();

    // Restaurar config original
    aplicarConfigAlDOM(_configOriginal);
    _configActual = JSON.parse(JSON.stringify(_configOriginal));
}

async function guardarEdicion() {
    // Recoger textos editados
    document.querySelectorAll('[data-config-key]').forEach(el => {
        _configActual[el.dataset.configKey] = el.innerHTML.trim();
    });

    // Recoger visibilidad
    document.querySelectorAll('.widget-bloque[data-widget]').forEach(bloque => {
        const wid = bloque.dataset.widget;
        _configActual[`visible_${wid}`] = bloque.classList.contains('widget-oculto') ? 'false' : 'true';
    });

    // Recoger orden main
    const main = document.getElementById('sortable-main');
    if (main) {
        const orden = [...main.querySelectorAll(':scope > .widget-bloque')].map(b => b.dataset.widget);
        _configActual['orden_main'] = JSON.stringify(orden);
    }

    // Recoger orden sidebar
    const sidebar = document.getElementById('sortable-sidebar');
    if (sidebar) {
        const orden = [...sidebar.querySelectorAll(':scope > .widget-bloque')].map(b => b.dataset.widget);
        _configActual['orden_sidebar'] = JSON.stringify(orden);
    }

    const btn = document.querySelector('.btn-save');
    if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Guardando...'; }

    try {
        const res  = await fetch('/api/inicio/config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(_configActual)
        });
        const data = await res.json();
        if (data.ok) {
            mostrarAlerta('¡Inicio actualizado con éxito!');
            cancelarEdicion();
        } else {
            mostrarAlerta(data.error || 'Error al guardar', true);
        }
    } catch {
        mostrarAlerta('Error de conexión', true);
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="bi bi-cloud-check me-1"></i>Guardar Cambios'; }
    }
}

function iniciarSortable() {
    if (typeof Sortable === 'undefined') return;

    _sortableMain = Sortable.create(document.getElementById('sortable-main'), {
        handle: '.widget-handle',
        animation: 180,
        ghostClass: 'sortable-ghost',
        chosenClass: 'sortable-chosen',
        dragClass: 'sortable-drag'
    });

    _sortableSidebar = Sortable.create(document.getElementById('sortable-sidebar'), {
        handle: '.widget-handle',
        animation: 180,
        ghostClass: 'sortable-ghost',
        chosenClass: 'sortable-chosen'
    });
}

function destruirSortable() {
    if (_sortableMain)   { _sortableMain.destroy();   _sortableMain   = null; }
    if (_sortableSidebar) { _sortableSidebar.destroy(); _sortableSidebar = null; }
}

function vincularBotonesWidget() {
    document.querySelectorAll('.widget-toggle').forEach(btn => {
        btn.onclick = function () {
            const widgetId = this.dataset.widget;
            const bloque   = document.querySelector(`.widget-bloque[data-widget="${widgetId}"]`);
            if (!bloque) return;
            const visible = bloque.classList.contains('widget-oculto');
            aplicarVisibilidadWidget(bloque, visible);
        };
    });
}

function abrirModalEditor(configKey, etiqueta, valorActual) {
    _targetConfigKey = configKey;
    const modal    = document.getElementById('modalEditorTexto');
    const textarea = document.getElementById('modalEditorTextarea');
    const label    = document.getElementById('modalEditorLabel');
    if (!modal || !textarea) return;

    label.textContent    = `Editar: ${etiqueta}`;
    textarea.value       = valorActual || '';
    modal.style.display  = 'flex';
    textarea.focus();
}

function cerrarModalEditor() {
    const modal = document.getElementById('modalEditorTexto');
    if (modal) modal.style.display = 'none';
    _targetConfigKey = null;
}

function aplicarCambioTexto() {
    if (!_targetConfigKey) return;
    const textarea = document.getElementById('modalEditorTextarea');
    const valor    = textarea.value.trim();
    const el       = document.querySelector(`[data-config-key="${_targetConfigKey}"]`);
    if (el) el.innerHTML = valor;
    _configActual[_targetConfigKey] = valor;
    cerrarModalEditor();
}

// Doble clic en texto editable abre modal (más cómodo que contenteditable)
function vincularEdicionTexto() {
    document.querySelectorAll('[data-config-key]').forEach(el => {
        el.addEventListener('dblclick', function () {
            if (!_editMode) return;
            const labels = {
                bienvenida_mensaje: 'Mensaje de bienvenida',
                historia_titulo:    'Título "Historia"',
                historia_p1:        'Historia — párrafo 1',
                historia_p2:        'Historia — párrafo 2',
                historia_p3:        'Historia — párrafo 3',
                explorar_titulo:    'Título "Explorar"'
            };
            abrirModalEditor(this.dataset.configKey, labels[this.dataset.configKey] || this.dataset.configKey, this.innerHTML);
        });
    });

    // Cerrar modal con Escape
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') cerrarModalEditor();
    });

    // Click fuera cierra modal
    const modal = document.getElementById('modalEditorTexto');
    if (modal) {
        modal.addEventListener('click', e => {
            if (e.target === modal) cerrarModalEditor();
        });
    }
}

//  MINI-PANEL NOTIFICACIONES ADMIN

let _notifPanelOpen = false;

function toggleNotifPanel() {
    const panel   = document.getElementById('notifAdminPanel');
    const bellBtn = document.getElementById('btnCampanaNotif');
    const body    = document.getElementById('notifAdminBody');
    const chevron = document.getElementById('notifChevron');
    if (!panel) return;
    _notifPanelOpen = !_notifPanelOpen;

    if (_notifPanelOpen) {
        panel.classList.add('is-open');
        if (bellBtn) {
            bellBtn.classList.add('panel-open');
            const icon = bellBtn.querySelector('i');
            if (icon) icon.className = 'bi bi-x-lg';
        }
        if (body)    body.classList.add('open');
        if (chevron) chevron.className = 'bi bi-chevron-down ms-auto';
        cargarNotificacionesAdmin();
    } else {
        panel.classList.remove('is-open');
        if (bellBtn) {
            bellBtn.classList.remove('panel-open');
            const icon = bellBtn.querySelector('i');
            if (icon) icon.className = 'bi bi-bell-fill';
        }
        if (body)    body.classList.remove('open');
        if (chevron) chevron.className = 'bi bi-chevron-up ms-auto';
    }
}

async function cargarNotificacionesAdmin() {
    if (!IS_ADMIN) return;
    try {
        const res  = await fetch('/api/admin/notificaciones', { cache: 'no-store' });
        const data = await res.json();
        const list  = document.getElementById('notifList');
        const empty = document.getElementById('notifEmpty');
        const count = document.getElementById('notifCount');
        if (!list) return;

        list.innerHTML = '';
        const total = Array.isArray(data) ? data.length : 0;
        if (count) count.textContent = total;
        if (empty) empty.style.display = total ? 'none' : 'flex';

        // Actualizar badge del botón campana (flotante e inicio Y navbar)
        ['campanaBadge', 'navBellBadge'].forEach(id => {
            const badge = document.getElementById(id);
            if (!badge) return;
            badge.textContent = total > 9 ? '9+' : total;
            badge.style.display = total > 0 ? 'flex' : 'none';
        });
        // El panel usa clases CSS (no display:none) para animar
        // No lo abrimos automáticamente — el usuario lo abre con el botón campana

        (Array.isArray(data) ? data : []).forEach(n => {
            const li = document.createElement('li');
            li.className = 'notif-item';
            li.innerHTML = `
                <div class="notif-item-img">
                    ${n.imagen_url ? `<img src="${n.imagen_url}" onerror="this.style.display='none'">` : '<i class="bi bi-bell"></i>'}
                </div>
                <div class="notif-item-info">
                    <strong>${n.titulo || 'Sin título'}</strong>
                    <small>${n.descripcion || ''}</small>
                </div>
                <div class="notif-item-actions">
                    <div class="form-check form-switch mb-0" title="${n.estado ? 'Activa' : 'Inactiva'}">
                        <input class="form-check-input" type="checkbox" ${n.estado ? 'checked' : ''}
                               onchange="toggleNotifEstado('${n.id_publicidad}', this.checked)">
                    </div>
                    <button class="btn-notif-del" onclick="eliminarNotif('${n.id_publicidad}')" title="Eliminar">
                        <i class="bi bi-trash"></i>
                    </button>
                </div>`;
            list.appendChild(li);
        });

        // Sincroniza el array de publicadas que se lanzan cada 12s
        notificacionesDisponibles = (Array.isArray(data) ? data : []).filter(n => n.estado);
    } catch {}
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

//  INIT

document.addEventListener('DOMContentLoaded', () => {
    cargarMarketing();
    cargarConfigInicio();
    monitorearCambiosCatalogo();

    setInterval(() => {
        if (notificacionesDisponibles.length > 0) {
            const e = notificacionesDisponibles[Math.floor(Math.random() * notificacionesDisponibles.length)];
            mostrarToastPublicidad(e.imagen_url, e.titulo, e.descripcion);
        }
    }, 12000);

    setInterval(monitorearCambiosCatalogo, 10000);

    if (IS_ADMIN) {
        vincularEdicionTexto();
        cargarNotificacionesAdmin();
        setInterval(cargarNotificacionesAdmin, 30000);
    }
});

document.addEventListener('click', () => { initAudioContext(); }, { once: true });

(function () {
    window.history.pushState(null, '', window.location.href);
    window.onpopstate  = () => window.history.pushState(null, '', window.location.href);
    window.onpageshow  = e => {
        if (e.persisted || (window.performance && window.performance.navigation.type === 2))
            window.location.reload();
    };
})();

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/static/js/workers/service-worker-inicio.js')
            .catch(() => {});
    });
}

