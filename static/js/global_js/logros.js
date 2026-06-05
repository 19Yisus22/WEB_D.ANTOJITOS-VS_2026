/* ══════════════════════════════════════════════════════
   SISTEMA DE LOGROS — Toast estilo Steam
   ══════════════════════════════════════════════════════ */

(function () {
    'use strict';

    const RAREZA_ES = { comun: 'Común', raro: 'Raro', epico: 'Épico', legendario: 'Legendario' };

    const MODULOS_ES = {
        inicio:            'Inicio',
        catalogo:          'Catálogo',
        carrito:           'Carrito',
        pagos:             'Zona de Pagos',
        sugerencias:       'Sugerencias',
        mensajes:          'Mensajes Privados',
        perfil:            'Perfil',
        historial:         'Historial & Facturas',
        gestion_productos: 'Gestión de Productos',
        publicidad:        'Publicidad',
        gestion_usuarios:  'Gestión de Usuarios',
    };

    // ── Módulo actual por URL ──────────────────────────────────
    const _RUTAS_MODULO = [
        ['/catalogo',           'catalogo'],
        ['/carrito',            'carrito'],
        ['/zona_pagos',         'pagos'],
        ['/pagos',              'pagos'],
        ['/comentarios',        'sugerencias'],
        ['/sugerencias',        'sugerencias'],
        ['/mensajes',           'mensajes'],
        ['/perfil',             'perfil'],
        ['/historial',          'historial'],
        ['/facturas',           'historial'],
        ['/gestion_productos',  'gestion_productos'],
        ['/publicidad',         'publicidad'],
        ['/gestion_usuarios',   'gestion_usuarios'],
        ['/usuarios',           'gestion_usuarios'],
    ];

    function _moduloActual() {
        const p = window.location.pathname;
        if (p === '/' || p === '/inicio' || p === '') return 'inicio';
        for (const [ruta, mod] of _RUTAS_MODULO) {
            if (p.startsWith(ruta)) return mod;
        }
        return null;
    }

    // ── Contenedor de toasts ───────────────────────────────────
    let _contenedor = null;

    function _getContenedor() {
        if (!_contenedor) {
            _contenedor = document.getElementById('logros-container');
            if (!_contenedor) {
                _contenedor = document.createElement('div');
                _contenedor.id = 'logros-container';
                document.body.appendChild(_contenedor);
            }
        }
        return _contenedor;
    }

    // ── Mostrar toast individual ───────────────────────────────
    function _mostrarLogro(logro) {
        const cont = _getContenedor();
        const toast = document.createElement('div');
        toast.className = 'logro-toast';

        const iconoWrap = document.createElement('div');
        iconoWrap.className = `logro-icono-wrap rareza-${logro.rareza || 'comun'}`;
        iconoWrap.textContent = logro.icono || '🏆';

        const info = document.createElement('div');
        info.className = 'logro-info';
        const etiqueta = document.createElement('div');
        etiqueta.className = 'logro-etiqueta';
        etiqueta.textContent = '🏆 Logro Desbloqueado';
        const nombre = document.createElement('div');
        nombre.className = 'logro-nombre';
        nombre.textContent = logro.nombre;
        const desc = document.createElement('div');
        desc.className = 'logro-desc';
        desc.textContent = logro.descripcion;
        info.appendChild(etiqueta);
        info.appendChild(nombre);
        info.appendChild(desc);

        const rarBadge = document.createElement('span');
        rarBadge.className = `logro-rareza-badge ${logro.rareza || 'comun'}`;
        rarBadge.textContent = RAREZA_ES[logro.rareza] || logro.rareza || 'Común';

        const progress = document.createElement('div');
        progress.className = 'logro-progress-bar';

        toast.appendChild(iconoWrap);
        toast.appendChild(info);
        toast.appendChild(rarBadge);
        toast.appendChild(progress);

        const duracion = logro.rareza === 'legendario' ? 7000 : (logro.rareza === 'epico' ? 6000 : 5000);
        progress.style.animationDuration = duracion + 'ms';

        toast.onclick = () => _cerrarToast(toast);
        cont.appendChild(toast);

        toast._timer = setTimeout(() => _cerrarToast(toast), duracion);
    }

    function _cerrarToast(toast) {
        if (!toast || toast._cerrando) return;
        toast._cerrando = true;
        clearTimeout(toast._timer);
        toast.classList.add('saliendo');
        setTimeout(() => toast.remove(), 380);
    }

    /** API pública: mostrar uno o varios logros en esquina */
    window.mostrarLogros = function (logros) {
        if (!logros) return;
        const lista = Array.isArray(logros) ? logros : [logros];
        lista.forEach((l, i) => setTimeout(() => _mostrarLogro(l), i * 320));
    };

    // ── Verificación login (una vez por sesión de tab) ─────────
    if (!sessionStorage.getItem('_logros_login_ok')) {
        sessionStorage.setItem('_logros_login_ok', '1');
        setTimeout(() => window.verificarLogros({ tipo: 'login' }), 1500);
    }

    // ── Verificar visita a módulo actual ───────────────────────
    (function () {
        const modulo = _moduloActual();
        if (!modulo) return;
        const key = `_dantojitos_visits_${modulo}`;
        const visitas = parseInt(localStorage.getItem(key) || '0') + 1;
        localStorage.setItem(key, String(visitas));
        setTimeout(() => {
            window.verificarLogros({ tipo: 'visita', modulo, visit_count: visitas });
        }, 2500);
    })();

    /** Llama al backend para verificar logros y muestra los nuevos */
    window.verificarLogros = async function (contexto) {
        try {
            const r = await fetch('/logros/verificar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(contexto || {})
            });
            if (!r.ok) return;
            const data = await r.json();
            if (data.nuevos && data.nuevos.length > 0) {
                window.mostrarLogros(data.nuevos);
            }
        } catch (_) {}
    };

    /** Renderiza logros agrupados por módulo en un contenedor */
    window.renderizarLogrosUsuario = async function (contenedorId) {
        const cont = document.getElementById(contenedorId);
        if (!cont) return;
        try {
            cont.innerHTML = '<div class="text-center py-4"><div class="spinner-border text-warning" style="width:2rem;height:2rem;"></div></div>';
            const r = await fetch('/logros/mis_logros');
            if (!r.ok) return;
            const data = await r.json();
            const obtenidos = new Set((data.obtenidos || []).map(l => l.codigo_logro));
            const todos = data.todos || [];

            if (!todos.length) {
                cont.innerHTML = '<p class="text-muted text-center">Sin logros disponibles</p>';
                return;
            }

            const obtenidosCount = obtenidos.size;

            const iconoBg = {
                comun:      'background:linear-gradient(135deg,#2c3e50,#34495e)',
                raro:       'background:linear-gradient(135deg,#1a3a6e,#2980b9)',
                epico:      'background:linear-gradient(135deg,#4a235a,#8e44ad)',
                legendario: 'background:linear-gradient(135deg,#7d5a00,#d4a017)',
            };

            // Agrupar por módulo
            const porModulo = {};
            const ordenModulos = Object.keys(MODULOS_ES);
            todos.forEach(l => {
                const mod = l.modulo || 'perfil';
                if (!porModulo[mod]) porModulo[mod] = [];
                porModulo[mod].push(l);
            });

            let html = `
                <div class="d-flex align-items-center justify-content-between mb-3">
                    <h6 class="mb-0 fw-bold"><i class="bi bi-trophy-fill text-warning me-2"></i>Logros</h6>
                    <span class="badge bg-warning text-dark">${obtenidosCount} / ${todos.length}</span>
                </div>`;

            const modulosOrdenados = ordenModulos.filter(m => porModulo[m]);
            // append any leftovers not in the order
            Object.keys(porModulo).forEach(m => { if (!modulosOrdenados.includes(m)) modulosOrdenados.push(m); });

            modulosOrdenados.forEach(mod => {
                const lista = porModulo[mod];
                if (!lista || !lista.length) return;
                const desbMod = lista.filter(l => obtenidos.has(l.codigo)).length;
                html += `
                <div class="logros-modulo-header">
                    <h6>${MODULOS_ES[mod] || mod}</h6>
                    <span class="badge bg-warning text-dark ms-auto">${desbMod}/${lista.length}</span>
                </div>
                <div class="logros-grid">`;
                lista.forEach(l => {
                    const desbloqueado = obtenidos.has(l.codigo);
                    html += `
                    <div class="logro-card ${desbloqueado ? '' : 'bloqueado'}">
                        <div class="logro-card-icono" style="${iconoBg[l.rareza] || ''}">${l.icono}</div>
                        <div class="logro-card-info">
                            <div class="logro-card-nombre">${l.nombre}</div>
                            <div class="logro-card-desc">${l.descripcion}</div>
                        </div>
                        ${desbloqueado
                            ? '<div class="logro-check"><i class="bi bi-check-lg"></i></div>'
                            : '<i class="bi bi-lock-fill text-muted" style="font-size:0.9rem;"></i>'}
                    </div>`;
                });
                html += '</div>';
            });

            cont.innerHTML = html;
        } catch (_) {
            if (cont) cont.innerHTML = '<p class="text-muted text-center small">No se pudieron cargar los logros</p>';
        }
    };

})();
