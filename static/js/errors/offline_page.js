(function(){
    const TIPOS = {
        offline: {
            codigo:'!',emoji:'📡',claseEmoji:'sin-internet',
            titulo:'Sin conexión a internet',
            desc:'No se detecta conexión a internet.<br>Revisá tu red Wi-Fi o datos móviles e intentá de nuevo.',
            botones:[
                {label:'Reintentar',fn:"location.reload()",primary:true},
            ]
        },
        server: {
            codigo:'!',emoji:'⚙️',claseEmoji:'',
            titulo:'Servidor no disponible',
            desc:'El servidor no está respondiendo en este momento.<br>Puede ser una interrupción temporal. Intentá de nuevo en unos momentos.',
            botones:[
                {label:'Reintentar',fn:"location.reload()",primary:true},
                {label:'Inicio',fn:"irA('/inicio')",primary:false},
            ]
        },
        404: {
            codigo:'404',emoji:'🍩',claseEmoji:'',
            titulo:'¡Ups! Página no encontrada',
            desc:'Al parecer esta página se la comieron los postres.<br>La ruta que buscas no existe o fue movida.',
            botones:[
                {label:'Inicio',fn:"irA('/inicio')",primary:true},
                {label:'Catálogo',fn:"irA('/catalogo_page')",primary:false},
                {label:'Volver',fn:"history.back()",primary:false},
            ]
        },
        403: {
            codigo:'403',emoji:'🔒',claseEmoji:'',
            titulo:'Acceso denegado',
            desc:'No tenés permiso para ver esta sección.<br>Iniciá sesión con una cuenta autorizada.',
            botones:[
                {label:'Inicio',fn:"irA('/inicio')",primary:true},
                {label:'Iniciar sesión',fn:"irA('/login')",primary:false},
            ]
        },
        500: {
            codigo:'500',emoji:'⚙️',claseEmoji:'',
            titulo:'Error interno del servidor',
            desc:'Algo falló en el servidor.<br>Intentalo de nuevo en unos momentos.',
            botones:[
                {label:'Reintentar',fn:"location.reload()",primary:true},
                {label:'Inicio',fn:"irA('/inicio')",primary:false},
            ]
        },
        401: {
            codigo:'401',emoji:'🔑',claseEmoji:'',
            titulo:'Sesión expirada',
            desc:'Tu sesión ha expirado o no tenés autorización para ver este contenido.<br>Volvé a iniciar sesión para continuar.',
            botones:[
                {label:'Iniciar sesión',fn:"irA('/login')",primary:true},
                {label:'Inicio',fn:"irA('/inicio')",primary:false},
            ]
        },
    };

    function aplicarTipo(clave) {
        const t = TIPOS[clave] || TIPOS['offline'];
        document.getElementById('errCodigo').textContent = t.codigo;
        const em = document.getElementById('errEmoji');
        em.textContent = t.emoji;
        em.className = 'error-emoji' + (t.claseEmoji ? ' ' + t.claseEmoji : '');
        document.getElementById('errTitulo').textContent = t.titulo;
        document.getElementById('errDesc').innerHTML = t.desc;
        document.getElementById('btnGroup').innerHTML = t.botones.map(b =>
            `<button class="btn ${b.primary ? 'btn-primary' : 'btn-outline'}" onclick="${b.fn}">${b.label}</button>`
        ).join('');
    }

    function detectarTipo() {
        const params = new URLSearchParams(location.search);
        const tipo = params.get('tipo');
        if (tipo && TIPOS[tipo]) return tipo;
        if (!navigator.onLine) return 'offline';
        return 'server';
    }

    const tipo = detectarTipo();
    aplicarTipo(tipo);

    const p = document.getElementById('errPath');
    const ruta = location.pathname === '/offline' ? '' : location.pathname;
    if (p && ruta) p.textContent = '📍 ' + ruta;
    else if (p) p.style.display = 'none';

    const th = localStorage.getItem('dantojitos_theme') || 'light';
    document.documentElement.setAttribute('data-theme', th);

    window.addEventListener('online',  () => aplicarTipo(new URLSearchParams(location.search).get('tipo') || 'server'));
    window.addEventListener('offline', () => aplicarTipo('offline'));

    window.irA = function(url) { window.location.href = url; };

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
})();
