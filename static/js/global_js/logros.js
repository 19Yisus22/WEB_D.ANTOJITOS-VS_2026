
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

    const _RUTAS_MODULO = [
        ['/catalogo',                'catalogo'],
        ['/carrito',                 'carrito'],
        ['/zona_pagos',              'pagos'],
        ['/pedidos_page',            'pagos'],
        ['/pedidos',                 'pagos'],
        ['/facturacion_page',        'pagos'],
        ['/pagos',                   'pagos'],
        ['/comentarios',             'sugerencias'],
        ['/sugerencias',             'sugerencias'],
        ['/mensajes',                'mensajes'],
        ['/mi_perfil',               'perfil'],
        ['/perfil',                  'perfil'],
        ['/gestionar_facturas',      'historial'],
        ['/todas_facturas',          'historial'],
        ['/historial',               'historial'],
        ['/facturas',                'historial'],
        ['/gestionar_productos',     'gestion_productos'],
        ['/gestion_productos',       'gestion_productos'],
        ['/publicidad',              'publicidad'],
        ['/gestion_usuarios',        'gestion_usuarios'],
        ['/usuarios',                'gestion_usuarios'],
    ];

    function _moduloActual() {
        const p = window.location.pathname;
        if (p === '/' || p === '/inicio' || p === '') return 'inicio';
        for (const [ruta, mod] of _RUTAS_MODULO) {
            if (p.startsWith(ruta)) return mod;
        }
        return null;
    }

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
        etiqueta.innerHTML = '<i class="bi bi-trophy-fill me-1"></i>Logro Desbloqueado';
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

    window.mostrarLogros = function (logros) {
        if (!logros) return;
        const lista = Array.isArray(logros) ? logros : [logros];
        lista.forEach((l, i) => setTimeout(() => _mostrarLogro(l), i * 320));
    };

    function _lsGetDays(modulo) {
        try { return JSON.parse(localStorage.getItem(`_dantojitos_days_${modulo}`) || '[]'); } catch (_) { return []; }
    }
    function _lsSetDays(modulo, arr) {
        localStorage.setItem(`_dantojitos_days_${modulo}`, JSON.stringify(arr));
    }
    function _lsGetStreak(modulo) {
        try { return JSON.parse(localStorage.getItem(`_dantojitos_streak_${modulo}`) || '{"streak":0,"lastDay":""}'); } catch (_) { return { streak: 0, lastDay: '' }; }
    }
    function _lsSetStreak(modulo, obj) {
        localStorage.setItem(`_dantojitos_streak_${modulo}`, JSON.stringify(obj));
    }

    function _colombiaHoy() {
        return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
    }

    async function _cargarContadoresDB() {
        try {
            const r = await fetch('/logros/contadores');
            if (!r.ok) return null;
            return await r.json();
        } catch (_) {
            return null;
        }
    }

    if (!sessionStorage.getItem('_logros_login_ok')) {
        sessionStorage.setItem('_logros_login_ok', '1');
        setTimeout(() => window.verificarLogros({ tipo: 'login' }), 1500);
    }

    (function () {
        const modulo = _moduloActual();
        if (!modulo) return;
        const hoy = _colombiaHoy();

        _cargarContadoresDB().then((dbContadores) => {
            let days = _lsGetDays(modulo);
            const esDiaNuevo = !days.includes(hoy);
            if (esDiaNuevo) {
                days.push(hoy);
                _lsSetDays(modulo, days);
            }

            let sd = _lsGetStreak(modulo);
            let streak = sd.streak || 0;
            if (esDiaNuevo) {
                const ayer = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Bogota' }));
                ayer.setDate(ayer.getDate() - 1);
                const ayerStr = ayer.toLocaleDateString('en-CA');
                streak = sd.lastDay === ayerStr ? streak + 1 : 1;
                _lsSetStreak(modulo, { streak, lastDay: hoy });
            }

            const dbVisit  = dbContadores ? parseInt(dbContadores[`v_${modulo}`] || 0) : 0;
            const dbStreak = dbContadores ? parseInt(dbContadores[`s_${modulo}`] || 0) : 0;
            const visitCount  = Math.max(days.length, dbVisit);
            const streakCount = Math.max(streak, dbStreak);

            setTimeout(() => {
                window.verificarLogros({ tipo: 'visita', modulo, visit_count: visitCount, streak_count: streakCount });
            }, 2500);
        });
    })();

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

    const RAREZA_COLOR = {
        comun:      { bg: 'linear-gradient(135deg,#2e4a7a,#4a6fa5)', text: '#7da7d9' },
        raro:       { bg: 'linear-gradient(135deg,#4a1b7a,#7c3aed)', text: '#c084fc' },
        epico:      { bg: 'linear-gradient(135deg,#6d28d9,#a855f7)', text: '#e879f9' },
        legendario: { bg: 'linear-gradient(135deg,#c2410c,#f59e0b)', text: '#fbbf24' },
    };

    function _valorCampo(campo, stats, rolStats, contadores) {
        if (!campo) return 0;
        if (campo.startsWith('v_') || campo.startsWith('s_')) {
            return parseInt((contadores || {})[campo] || 0);
        }
        if (campo in (stats || {})) return Number(stats[campo]) || 0;
        if (campo in (rolStats || {})) return Number(rolStats[campo]) || 0;
        return 0;
    }

    window.renderizarLogrosUsuario = async function (contenedorId) {
        const cont = document.getElementById(contenedorId);
        if (!cont) return;
        try {
            cont.innerHTML = '<div class="text-center py-4"><div class="spinner-border text-warning" style="width:2rem;height:2rem;"></div></div>';
            const r = await fetch('/logros/mis_logros');
            if (!r.ok) return;
            const data = await r.json();
            const obtenidos  = new Set((data.obtenidos || []).map(l => l.codigo_logro));
            const todos       = data.todos || [];
            const stats       = data.stats || {};
            const rolStats    = data.rol_stats || {};
            const contadores  = data.contadores || {};

            if (!todos.length) {
                cont.innerHTML = '<p class="text-muted text-center">Sin logros disponibles</p>';
                return;
            }

            const obtenidosCount = obtenidos.size;

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
                    const rc = RAREZA_COLOR[l.rareza] || RAREZA_COLOR.comun;
                    const rarLabel = RAREZA_ES[l.rareza] || l.rareza || 'Común';

                    let barraHtml = '';
                    if (!desbloqueado && l.meta && l.campo) {
                        const val = _valorCampo(l.campo, stats, rolStats, contadores);
                        const pct = Math.min(100, Math.round(val / l.meta * 100));
                        let valFmt, metaFmt;
                        const esMoney = l.campo.includes('gastado') || l.campo.includes('gasto');
                        const esRacha = l.campo.startsWith('s_');
                        const esDias  = l.campo.startsWith('v_') || esRacha || l.campo === 'dias_registrado';
                        if (esMoney) {
                            const fmt = n => Number(n).toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
                            valFmt  = fmt(val);
                            metaFmt = fmt(l.meta);
                        } else if (esDias) {
                            const sufijo = esRacha ? ' días seguidos' : ' días';
                            valFmt  = val + sufijo;
                            metaFmt = l.meta + sufijo;
                        } else {
                            valFmt  = val;
                            metaFmt = l.meta;
                        }
                        barraHtml = `
                        <div class="logro-progreso">
                            <div class="logro-progreso-bar" style="width:${pct}%;background:${rc.bg}"></div>
                        </div>
                        <div class="logro-progreso-txt">${valFmt} / ${metaFmt}</div>`;
                    }

                    html += `
                    <div class="logro-card ${desbloqueado ? '' : 'bloqueado'}">
                        <div class="logro-card-icono" style="background:${rc.bg}">${l.icono}</div>
                        <div class="logro-card-info">
                            <div class="logro-card-nombre">${l.nombre}</div>
                            <div class="logro-card-desc">${l.descripcion}</div>
                            ${barraHtml}
                        </div>
                        <div class="logro-card-side">
                            <span class="logro-rareza-card" style="color:${rc.text}">${rarLabel}</span>
                            ${desbloqueado
                                ? '<div class="logro-check"><i class="bi bi-check-lg"></i></div>'
                                : '<i class="bi bi-lock-fill logro-lock-ico"></i>'}
                        </div>
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
