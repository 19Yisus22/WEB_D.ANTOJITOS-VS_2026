const ALLOWED_PW_CHARS = /^[A-Za-z0-9_*+\-.@$%&]+$/;

function setLoading(btnId, loaderId, active) {
    const btn  = document.getElementById(btnId);
    const load = document.getElementById(loaderId);
    if (btn)  btn.disabled = active;
    if (load) load.style.display = active ? 'inline-flex' : 'none';
    const text = btn && btn.querySelector('span:not(.spinner-border)');
    if (text && text.id) {
        const textEl = document.getElementById(text.id.replace('Loader','Text'));
        if (textEl) textEl.style.display = active ? 'none' : '';
    }
}

function showMessage(titulo, msg, isSuccess = true) {
    mostrarAlertaPublica({ titulo, mensaje: msg, tipo: isSuccess ? 'success' : 'error' });
}

function passwordStrength(pw) {
    if (!pw || pw.length < 5) return 0;
    let score = 0;
    if (/[A-Z]/.test(pw)) score++;
    if (/[a-z]/.test(pw)) score++;
    if (/[0-9]/.test(pw)) score++;
    if (/[_*+\-.@$%&]/.test(pw)) score++;
    return score;
}

function renderStrength(pw) {
    const fill  = document.getElementById('pwFill');
    const label = document.getElementById('pwLabel');
    if (!fill || !label) return;
    const s = passwordStrength(pw);
    const map = [
        { w: '0%',   c: '#eee',    t: 'Sin contraseña' },
        { w: '25%',  c: '#ff4757', t: 'Muy débil' },
        { w: '50%',  c: '#ff9800', t: 'Débil' },
        { w: '75%',  c: '#f1c40f', t: 'Aceptable' },
        { w: '100%', c: '#2ed573', t: 'Fuerte' },
    ];
    const entry = map[Math.min(s, 4)];
    fill.style.width      = entry.w;
    fill.style.background = entry.c;
    label.style.color     = entry.c;
    label.textContent     = entry.t;
}

function setWrap(inputId, state) {
    const inp  = document.getElementById(inputId);
    if (!inp) return;
    const wrap = inp.closest('.field-wrap');
    if (!wrap) return;
    wrap.classList.remove('ok', 'error');
    if (state) wrap.classList.add(state);
}

function validateOnBlur(inputId, validator) {
    const el = document.getElementById(inputId);
    if (!el) return;
    el.addEventListener('blur', () => setWrap(inputId, validator(el.value) ? 'ok' : 'error'));
    el.addEventListener('input', () => { if (el.value) setWrap(inputId, validator(el.value) ? 'ok' : 'error'); });
}

function initTogglePw(toggleId, inputId) {
    const btn = document.getElementById(toggleId);
    const inp = document.getElementById(inputId);
    if (!btn || !inp) return;
    btn.addEventListener('click', () => {
        const show = inp.type === 'password';
        inp.type = show ? 'text' : 'password';
        btn.className = btn.className.replace(/bi-eye\S*/g, '') + (show ? ' bi-eye-slash' : ' bi-eye');
    });
}

function initCapsLock(inputId, warnId) {
    const inp  = document.getElementById(inputId);
    const warn = document.getElementById(warnId);
    if (!inp || !warn) return;
    const check = e => { warn.style.display = e.getModifierState('CapsLock') ? 'flex' : 'none'; };
    inp.addEventListener('keyup',  check);
    inp.addEventListener('keydown', check);
    inp.addEventListener('focus',  check);
}

async function handleCredentialResponse(response) {
    try {
        const res  = await fetch('/registro-google', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ credential: response.credential })
        });
        const data = await res.json();
        if (data.ok) {
            showMessage('¡Bienvenido!', `Hola, ${data.user.nombre}`, true);
            setTimeout(() => { window.location.href = '/inicio'; }, 1200);
        } else {
            showMessage('Error', data.error || 'Error con Google', false);
        }
    } catch {
        showMessage('Error', 'Error de conexión', false);
    }
}

let _googleClientId = null;

function _getGoogleTheme() {
    return (document.documentElement.getAttribute('data-theme') || 'light') === 'dark'
        ? 'filled_black' : 'outline';
}

function _getGoogleLocale() {
    return (localStorage.getItem('dantojitos_lang') || 'es') === 'en' ? 'en' : 'es_419';
}

function renderGoogleButton(clientId) {
    const container = document.getElementById('buttonDiv');
    if (!window.google || !container) return;
    _googleClientId = clientId;

    google.accounts.id.initialize({
        client_id:   clientId,
        callback:    handleCredentialResponse,
        auto_select: false,
    });

    container.innerHTML = '';
    const loading = document.getElementById('googleLoading');
    if (loading) loading.style.display = 'none';

    google.accounts.id.renderButton(container, {
        theme:          _getGoogleTheme(),
        size:           'large',
        width:          320,
        locale:         _getGoogleLocale(),
        shape:          'rectangular',
        logo_alignment: 'left',
        text:           'continue_with',
    });
}

function _refreshGoogleButton() {
    if (_googleClientId && window.google) renderGoogleButton(_googleClientId);
}

async function loadGoogleButton() {
    try {
        const r = await fetch('/obtener-cliente-id');
        const d = await r.json();
        if (d.client_id) {
            if (window.google) renderGoogleButton(d.client_id);
            else window.addEventListener('load', () => renderGoogleButton(d.client_id));
        }
    } catch {}

    new MutationObserver(_refreshGoogleButton).observe(
        document.documentElement,
        { attributes: true, attributeFilter: ['data-theme'] }
    );
    document.addEventListener('langChanged', _refreshGoogleButton);
}

let _lockoutTimer = null;

function _formatSeconds(secs) {
    if (secs >= 86400) return `${Math.ceil(secs / 86400)} día(s)`;
    if (secs >= 3600)  return `${Math.ceil(secs / 3600)} hora(s)`;
    if (secs >= 60)    return `${Math.ceil(secs / 60)} minuto(s)`;
    return `${secs} segundo(s)`;
}

function _showLockoutBanner(segundos, bloqueadoHasta) {
    const bar  = document.getElementById('loginLockoutBar');
    const cdEl = document.getElementById('loginLockoutCd');
    const btn  = document.getElementById('btnLogin');
    if (btn) btn.disabled = true;

    let toastMsg = 'Demasiados intentos fallidos.';
    if (bloqueadoHasta) {
        try {
            const dt   = new Date(bloqueadoHasta);
            const opts = { weekday: 'long', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' };
            toastMsg = `Cuenta bloqueada. Se desbloquea el ${dt.toLocaleDateString('es-ES', opts)}.`;
        } catch {  }
    }
    mostrarAlertaPublica({ titulo: 'Cuenta bloqueada', mensaje: toastMsg, tipo: 'error' });

    if (bar) bar.classList.remove('d-none');

    let remaining = Math.max(0, Math.round(segundos));
    function tick() {
        if (remaining <= 0) {
            if (cdEl) cdEl.textContent = 'Ya puedes intentar de nuevo.';
            if (btn) btn.disabled = false;
            if (bar) bar.classList.add('d-none');
            clearInterval(_lockoutTimer);
            _lockoutTimer = null;
            return;
        }
        if (cdEl) cdEl.textContent = `Bloqueado — ${_formatSeconds(remaining)}`;
        remaining--;
    }
    tick();
    clearInterval(_lockoutTimer);
    _lockoutTimer = setInterval(tick, 1000);
}

function _hideLockoutBanner() {
    const bar = document.getElementById('loginLockoutBar');
    if (bar) bar.classList.add('d-none');
    clearInterval(_lockoutTimer);
    _lockoutTimer = null;
    const btn = document.getElementById('btnLogin');
    if (btn) btn.disabled = false;
}

function initLoginForm() {
    const form = document.getElementById('loginForm');
    if (!form) return;

    initTogglePw('togglePwLogin', 'contrasena');
    initCapsLock('contrasena', 'capsWarn');

    const identInput = document.getElementById('identifier');
    const identIcon  = document.getElementById('identifierIcon');
    if (identInput && identIcon) {
        identInput.addEventListener('input', () => {
            const v = identInput.value.trim();
            if (!v) {
                identIcon.className = 'bi bi-person-circle';
            } else if (v.includes('@')) {
                identIcon.className = 'bi bi-envelope-fill';
            } else if (/^\d+$/.test(v)) {
                identIcon.className = 'bi bi-card-text';
            } else {
                identIcon.className = 'bi bi-at';
            }
        });
    }

    form.addEventListener('submit', async e => {
        e.preventDefault();
        const identifier = (document.getElementById('identifier')?.value || '').trim();
        const contrasena = (document.getElementById('contrasena')?.value || '');
        if (!identifier || !contrasena) {
            showMessage('Atención', 'Completa todos los campos', false);
            return;
        }

        _hideLockoutBanner();

        const btn    = document.getElementById('btnLogin');
        const textEl = document.getElementById('btnLoginText');
        const loadEl = document.getElementById('btnLoginLoader');
        if (btn)    btn.disabled = true;
        if (textEl) textEl.style.display = 'none';
        if (loadEl) loadEl.style.display = 'inline-flex';

        try {
            const res  = await fetch('/login', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ identifier, contrasena })
            });
            const data = await res.json();

            if (data.ok) {
                try { showMessage('¡Bienvenido!', 'Sesión iniciada correctamente', true); } catch (_) {}
                const dest = data.redirect || '/inicio';
                if ('caches' in window) {
                    caches.keys().then(keys =>
                        keys.filter(k => k.startsWith('dantojitos-inicio'))
                            .forEach(k => caches.delete(k))
                    ).catch(() => {});
                }
                setTimeout(() => { window.location.href = dest; }, 900);
                return;
            }

            if (textEl) textEl.style.display = '';
            if (loadEl) loadEl.style.display = 'none';

            if (data.bloqueado_hasta && data.segundos) {
                _showLockoutBanner(data.segundos, data.bloqueado_hasta);
            } else {
                if (btn) btn.disabled = false;
                showMessage('Error', data.error || 'Credenciales incorrectas', false);
            }
        } catch {
            showMessage('Error', 'Error de conexión', false);
            if (btn)    btn.disabled = false;
            if (textEl) textEl.style.display = '';
            if (loadEl) loadEl.style.display = 'none';
        }
    });
}

function initRegistroForm() {
    const form = document.getElementById('formRegistro');
    if (!form) return;

    initTogglePw('togglePw', 'contrasena');
    initCapsLock('contrasena', 'capsWarnReg');

    const pwInp = document.getElementById('contrasena');
    if (pwInp) pwInp.addEventListener('input', () => renderStrength(pwInp.value));

    validateOnBlur('nombre',    v => /^[A-Za-zÁÉÍÓÚáéíóúÑñ\s\-\.]{1,50}$/.test(v.trim()));
    validateOnBlur('apellido',  v => /^[A-Za-zÁÉÍÓÚáéíóúÑñ\s\-\.]{1,50}$/.test(v.trim()));
    validateOnBlur('cedula',    v => /^\d{7,15}$/.test(v.trim()));
    validateOnBlur('telefono',  v => /^\d{7,15}$/.test(v.trim()));
    validateOnBlur('correo',    v => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()));
    validateOnBlur('username',  v => !v.trim() || /^[A-Za-z0-9@#$%&*]{3,30}$/.test(v.trim()));
    validateOnBlur('contrasena',v => v.length >= 5);

    form.addEventListener('submit', async e => {
        e.preventDefault();
        const nombre     = (document.getElementById('nombre')?.value || '').trim();
        const apellido   = (document.getElementById('apellido')?.value || '').trim();
        const cedula     = (document.getElementById('cedula')?.value || '').trim();
        const telefono   = (document.getElementById('telefono')?.value || '').trim();
        const correo     = (document.getElementById('correo')?.value || '').trim().toLowerCase();
        const username   = (document.getElementById('username')?.value || '').trim();
        const contrasena = (document.getElementById('contrasena')?.value || '');

        if (!nombre || !apellido || !cedula || !telefono || !correo || !contrasena) {
            showMessage('Atención', 'Completa todos los campos obligatorios', false);
            return;
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(correo)) {
            showMessage('Correo inválido', 'Ingresa un correo con formato válido (ej: usuario@gmail.com)', false);
            setWrap('correo', 'error');
            return;
        }
        if (contrasena.length < 5) {
            showMessage('Contraseña', 'La contraseña debe tener al menos 5 caracteres', false);
            return;
        }

        const btn = document.getElementById('btnRegistrar');
        if (btn) btn.disabled = true;
        const txtEl  = document.getElementById('btnRegText');
        const loadEl = document.getElementById('btnRegLoader');
        if (txtEl)  txtEl.style.display  = 'none';
        if (loadEl) loadEl.style.display = 'inline-flex';

        try {
            const res  = await fetch('/registro', {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({ nombre, apellido, cedula, telefono, correo, username, contrasena }),
            });
            const data = await res.json();
            if (data.ok) {
                showMessage('¡Bienvenido!', data.mensaje || 'Cuenta creada con éxito', true);
                setTimeout(() => { window.location.href = '/login'; }, 1500);
            } else {
                showMessage('Error', data.error || 'No se pudo crear la cuenta', false);
                if (btn)    btn.disabled    = false;
                if (txtEl)  txtEl.style.display  = '';
                if (loadEl) loadEl.style.display = 'none';
            }
        } catch {
            showMessage('Error', 'Error de conexión. Verifica tu internet.', false);
            if (btn)    btn.disabled    = false;
            if (txtEl)  txtEl.style.display  = '';
            if (loadEl) loadEl.style.display = 'none';
        }
    });
}

document.addEventListener('DOMContentLoaded', () => {
    loadGoogleButton();
    initLoginForm();
    initRegistroForm();
    initStep2();
});

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        const swFile = location.pathname.includes('registro')
            ? '/static/js/workers/service-worker-registro.js'
            : '/static/js/workers/service-worker-login.js';
        navigator.serviceWorker.register(swFile).catch(() => {});
    });
}
