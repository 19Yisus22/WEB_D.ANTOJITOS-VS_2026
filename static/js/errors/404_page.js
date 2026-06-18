(function(){
    const CODIGO = window.PAGE_DATA.codigo;

    const TIPOS = {
        404: {
            emoji: '🍩',
            titulo: '¡Ups! Página no encontrada',
            desc: 'Al parecer esta página se la comieron los postres.<br>La ruta que buscas no existe o fue movida.',
        },
        403: {
            emoji: '🔒',
            titulo: 'Acceso denegado',
            desc: 'No tenés permiso para ver esta sección.<br>Iniciá sesión con una cuenta autorizada.',
        },
        500: {
            emoji: '⚙️',
            titulo: 'Error interno del servidor',
            desc: 'Algo falló en el servidor. El equipo ya fue notificado.<br>Intentalo de nuevo en unos momentos.',
        },
        401: {
            emoji: '🔑',
            titulo: 'Sesión expirada',
            desc: 'Tu sesión ha expirado o no tenés autorización para ver este contenido.<br>Volvé a iniciar sesión para continuar.',
        },
        offline: {
            emoji: '📡',
            titulo: 'Sin conexión a internet',
            desc: 'No se detecta conexión. Revisá tu red Wi-Fi o datos móviles e intentá de nuevo.',
        },
    };

    const PAGES = [
        { label:'Inicio',                 url:'/inicio',                        icon:'bi-house-door-fill',   rol:null },
        { label:'Catálogo de productos',  url:'/catalogo_page',                 icon:'bi-shop',              rol:null },
        { label:'Mi carrito',             url:'/carrito_page',                  icon:'bi-cart3',             rol:null },
        { label:'Mi perfil',              url:'/mi_perfil',                     icon:'bi-person-circle',     rol:null },
        { label:'Sugerencias',            url:'/comentarios_page',              icon:'bi-chat-dots',         rol:null },
        { label:'Historial de facturas',  url:'/gestionar_facturas_page',       icon:'bi-receipt',           rol:null },
        { label:'Zona de pagos',          url:'/zona_pagos',                    icon:'bi-credit-card',       rol:null },
        { label:'Mensajes privados',      url:'/mensajes_privados',             icon:'bi-envelope-fill',     rol:null },
        { label:'Iniciar sesión',         url:'/login',                         icon:'bi-box-arrow-in-right',rol:null },
        { label:'Registrarme',            url:'/registro',                      icon:'bi-person-plus',       rol:null },
        { label:'Gestión de productos',   url:'/gestion_productos_page',        icon:'bi-box-seam',          rol:'vendedor' },
        { label:'Publicidad',             url:'/publicidad_page',               icon:'bi-megaphone',         rol:'vendedor' },
        { label:'Gestión de usuarios',    url:'/gestion_usuarios_page',         icon:'bi-people-fill',       rol:'admin' },
    ];

    const BOTONES = {
        default: `
            <button class="btn btn-primary" onclick="irA('/inicio')"><i class="bi bi-house-door-fill"></i> Inicio</button>
            <button class="btn btn-outline" onclick="irA('/catalogo_page')"><i class="bi bi-shop"></i> Catálogo</button>
            <button class="btn btn-outline" onclick="history.back()"><i class="bi bi-arrow-left"></i> Volver</button>`,
        401: `
            <button class="btn btn-primary" onclick="irA('/login')"><i class="bi bi-box-arrow-in-right"></i> Iniciar sesión</button>
            <button class="btn btn-outline" onclick="irA('/inicio')"><i class="bi bi-house-door-fill"></i> Inicio</button>`,
        offline: `
            <button class="btn btn-primary" onclick="location.reload()"><i class="bi bi-arrow-clockwise"></i> Reintentar</button>
            <button class="btn btn-outline" onclick="irA('/inicio')"><i class="bi bi-house-door-fill"></i> Inicio</button>`,
    };

    function aplicarTipo(tipo) {
        const t = TIPOS[tipo] || TIPOS[404];
        document.getElementById('errEmoji').textContent = t.emoji;
        document.getElementById('errEmoji').className = 'error-emoji' + (tipo === 'offline' ? ' sin-internet' : '');
        document.getElementById('errTitulo').textContent = t.titulo;
        document.getElementById('errDesc').innerHTML = t.desc;
        const bg = document.getElementById('btnGroup');
        if (bg) bg.innerHTML = BOTONES[tipo] || BOTONES.default;
    }

    function actualizarOffline(offline) {
        const banner = document.getElementById('offlineBanner');
        if (offline) {
            banner.classList.add('visible');
            aplicarTipo('offline');
            document.getElementById('errCodigo').textContent = '!';
        } else {
            banner.classList.remove('visible');
            aplicarTipo(CODIGO);
            document.getElementById('errCodigo').textContent = CODIGO;
        }
    }

    const _urlTipo = new URLSearchParams(location.search).get('tipo');
    if (_urlTipo && TIPOS[_urlTipo]) {
        aplicarTipo(_urlTipo);
        document.getElementById('errCodigo').textContent = _urlTipo.toUpperCase();
    } else {
        aplicarTipo(navigator.onLine ? CODIGO : 'offline');
    }
    actualizarOffline(!navigator.onLine);

    window.addEventListener('offline', () => actualizarOffline(true));
    window.addEventListener('online',  () => actualizarOffline(false));

    const p = document.getElementById('errPath');
    if (p) p.textContent = '📍 ' + location.pathname;

    const th = localStorage.getItem('dantojitos_theme') || 'light';
    document.documentElement.setAttribute('data-theme', th);

    const foods = ['🍩','🧁','🍰','🍫','🍪','🍭','🍬','🍮','🎂','🥐','🍓','🍑'];
    for (let i = 0; i < 12; i++) {
        const el = document.createElement('div');
        el.className = 'particle';
        el.textContent = foods[i % foods.length];
        el.style.cssText = `left:${Math.random()*100}vw;animation-duration:${7+Math.random()*8}s;animation-delay:${Math.random()*8}s;font-size:${1.2+Math.random()*1.5}rem`;
        document.body.appendChild(el);
    }

    const colors = ['#d35400','#e67e22','#f39c12','#27ae60','#3498db','#9b59b6','#e74c3c'];
    for (let i = 0; i < 18; i++) {
        const d = document.createElement('div');
        d.className = 'dot';
        const sz = (6 + Math.random() * 10) + 'px';
        d.style.cssText = `left:${Math.random()*100}vw;background:${colors[i%colors.length]};width:${sz};height:${sz};animation-duration:${5+Math.random()*10}s;animation-delay:${Math.random()*10}s`;
        document.body.appendChild(d);
    }

    window.irA = function(url) {
        window.location.href = url;
    };

    window.filtrarSugg = function(q) {
        const box = document.getElementById('suggestions');
        if (!q.trim()) { box.innerHTML = ''; return; }
        const res = PAGES.filter(p => p.label.toLowerCase().includes(q.toLowerCase())).slice(0, 5);
        box.innerHTML = res.map(p => `<button class="sugg-item" onclick="irA('${p.url}')"><i class="bi ${p.icon}"></i>${p.label}</button>`).join('');
    };

    window.irAlBuscar = function() {
        const q = document.getElementById('searchQ').value.trim();
        if (!q) return;
        const match = PAGES.find(p => p.label.toLowerCase().includes(q.toLowerCase()));
        if (match) irA(match.url);
    };
})();
