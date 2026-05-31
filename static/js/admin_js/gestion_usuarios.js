let _usuarios = [];
let _cedula_modal = null;
let _sortCol = '';
let _sortAsc = true;
let _paginaUsuarios = 1;
const _ITEMS_PAG = 10;

const ROLES_CLASS = { admin:'role-admin', vendedor:'role-vendedor', cliente:'role-cliente', visitante:'role-cliente' };

function _fecha(iso) {
    if (!iso) return '-';
    try { return new Date(iso).toLocaleDateString('es-CO', { day:'2-digit', month:'short', year:'numeric' }); } catch { return '-'; }
}

async function cargarUsuarios() {
    try {
        const res  = await fetch('/listar_usuarios');
        _usuarios  = await res.json();
        _actualizarStats();
        filtrarUsuarios();
    } catch { mostrarAlerta('Error al cargar usuarios', true); }
}

function _actualizarStats() {
    document.getElementById('statTotal').textContent     = _usuarios.length;
    document.getElementById('statAdmins').textContent    = _usuarios.filter(u => u.rol === 'admin').length;
    document.getElementById('statVendedores').textContent= _usuarios.filter(u => u.rol === 'vendedor').length;
    document.getElementById('statClientes').textContent  = _usuarios.filter(u => u.rol === 'cliente').length;
    document.getElementById('statGoogle').textContent    = _usuarios.filter(u => u.auth_method === 'google').length;
}

function filtrarUsuarios() {
    const q    = (document.getElementById('buscarUsuario').value || '').toLowerCase();
    const rol  = document.getElementById('filtroRol').value;
    const auth = document.getElementById('filtroAuth').value;
    const filtrados = _usuarios.filter(u => {
        const texto = `${u.nombre_completo} ${u.correo} ${u.cedula}`.toLowerCase();
        return (!q || texto.includes(q)) && (!rol || u.rol === rol) && (!auth || u.auth_method === auth);
    });
    _paginaUsuarios = 1;
    _renderTabla(filtrados);
    const inicio = Math.min((_paginaUsuarios - 1) * _ITEMS_PAG + 1, filtrados.length);
    const fin    = Math.min(_paginaUsuarios * _ITEMS_PAG, filtrados.length);
    document.getElementById('conteoResultados').textContent =
        filtrados.length > 0
        ? `Mostrando ${inicio}–${fin} de ${filtrados.length} usuarios`
        : `0 resultados de ${_usuarios.length} usuarios`;
}

function sortTabla(col) {
    if (_sortCol === col) { _sortAsc = !_sortAsc; }
    else { _sortCol = col; _sortAsc = true; }
    document.querySelectorAll('.sort-icon').forEach(el => {
        el.className = 'bi bi-chevron-expand sort-icon';
        el.closest('.sortable-col')?.classList.remove('sort-asc','sort-desc');
    });
    const iconEl = document.getElementById('sort-' + col);
    if (iconEl) {
        iconEl.className = `bi bi-chevron-${_sortAsc ? 'up' : 'down'} sort-icon`;
        iconEl.closest('.sortable-col')?.classList.add(_sortAsc ? 'sort-asc' : 'sort-desc');
    }
    filtrarUsuarios();
}

function _avatarHTML(u) {
    if (u.imagen_url) {
        return `<div class="user-avatar-cell">
                    <img src="${u.imagen_url}" alt="Avatar"
                         onerror="this.closest('.user-avatar-cell').outerHTML='<div class=\\'user-avatar-broken\\'><i class=\\'bi bi-person-fill\\'></i></div>'">
                </div>`;
    }
    const initials = ((u.nombre_completo || u.nombre || '') + ' ').charAt(0).toUpperCase();
    return `<div class="user-avatar-broken" style="font-weight:800;font-size:1rem;color:#d35400;background:rgba(211,84,0,0.1);border-color:rgba(211,84,0,0.2);">${initials || '<i class="bi bi-person-fill"></i>'}</div>`;
}

function _renderPaginacion(total, pagina) {
    let nav = document.getElementById('paginacionUsuarios');
    if (!nav) {
        nav = document.createElement('nav');
        nav.id = 'paginacionUsuarios';
        nav.className = 'mt-3';
        document.getElementById('conteoResultados').after(nav);
    }
    const maxPag = Math.ceil(total / _ITEMS_PAG);
    if (maxPag <= 1) { nav.innerHTML = ''; return; }
    let html = '<ul class="pagination pagination-sm justify-content-center mb-0">';
    for (let i = 1; i <= maxPag; i++) {
        html += `<li class="page-item ${i === pagina ? 'active' : ''}">
                    <a class="page-link" href="#" onclick="event.preventDefault();_paginaUsuarios=${i};filtrarUsuarios();">${i}</a>
                 </li>`;
    }
    html += '</ul>';
    nav.innerHTML = html;
}

function _renderTabla(lista) {
    const tbody = document.getElementById('tablaUsuarios');
    if (!lista.length) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center py-5 text-muted"><i class="bi bi-search display-6 d-block mb-2"></i>Sin resultados</td></tr>';
        _renderPaginacion(0, 1);
        return;
    }
    let ordenada = [...lista];
    if (_sortCol) {
        ordenada.sort((a,b) => {
            const va = (a[_sortCol] || '').toString().toLowerCase();
            const vb = (b[_sortCol] || '').toString().toLowerCase();
            return _sortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
        });
    }
    _renderPaginacion(ordenada.length, _paginaUsuarios);
    const inicio = (_paginaUsuarios - 1) * _ITEMS_PAG;
    const paginada = ordenada.slice(inicio, inicio + _ITEMS_PAG);
    tbody.innerHTML = '';
    paginada.forEach(u => {
        const tr = document.createElement('tr');
        tr.className = 'user-row';
        tr.innerHTML = `
            <td>${_avatarHTML(u)}</td>
            <td>
                <div class="fw-semibold" style="font-size:0.9rem;">${u.nombre_completo || '-'}</div>
                ${u.username ? `<small class="text-muted">@${u.username}</small>` : ''}
            </td>
            <td><small class="text-muted">${u.cedula || '-'}</small></td>
            <td>
                <div class="d-flex align-items-center gap-1">
                    <small>${u.correo || '-'}</small>
                    <button class="btn btn-sm p-0 border-0 text-muted ms-1 btn-copiar-correo" title="Copiar correo" data-correo="${u.correo || ''}">
                        <i class="bi bi-clipboard" style="font-size:0.75rem;"></i>
                    </button>
                </div>
            </td>
            <td><span class="role-badge ${ROLES_CLASS[u.rol] || 'role-cliente'}">${u.rol || 'cliente'}</span></td>
            <td>
                <span class="role-badge ${u.auth_method === 'google' ? 'method-google' : 'method-email'}">
                    <i class="bi bi-${u.auth_method === 'google' ? 'google' : 'envelope-fill'} me-1"></i>
                    ${u.auth_method === 'google' ? 'Google' : 'Correo'}
                </span>
            </td>
            <td><small class="text-muted">${_fecha(u.fecha_creacion)}</small></td>
            <td class="text-center">
                <div class="d-flex gap-1 justify-content-center">
                    <button class="btn btn-outline-secondary action-btn btn-ver-usuario" title="Ver detalles" data-idx="${_usuarios.indexOf(u)}">
                        <i class="bi bi-eye"></i>
                    </button>
                    <button class="btn btn-outline-primary action-btn"
                            onclick="abrirModalRol('${u.cedula}','${u.nombre_completo}','${u.rol}')"
                            title="Cambiar rol">
                        <i class="bi bi-shield-lock"></i>
                    </button>
                    <button class="btn btn-outline-danger action-btn"
                            onclick="eliminarUsuario('${u.correo}','${u.nombre_completo}')"
                            title="Eliminar usuario">
                        <i class="bi bi-trash"></i>
                    </button>
                </div>
            </td>`;
        tr.querySelector('.btn-ver-usuario').onclick = () => mostrarDetalleUsuario(u);
        tr.querySelector('.btn-copiar-correo').onclick = async (e) => {
            const btn = e.currentTarget;
            const correo = btn.dataset.correo;
            try {
                await navigator.clipboard.writeText(correo);
                btn.innerHTML = '<i class="bi bi-clipboard-check text-success" style="font-size:0.75rem;"></i>';
                setTimeout(() => { btn.innerHTML = '<i class="bi bi-clipboard" style="font-size:0.75rem;"></i>'; }, 2000);
                mostrarAlerta('Correo copiado al portapapeles');
            } catch { mostrarAlerta('No se pudo copiar el correo', true); }
        };
        tbody.appendChild(tr);
    });
}

function abrirModalRol(cedula, nombre, rolActual) {
    _cedula_modal = cedula;
    document.getElementById('modalRolNombre').textContent = nombre;
    document.getElementById('selectNuevoRol').value       = rolActual || 'cliente';
    document.getElementById('btnGuardarRol').onclick      = guardarRol;
    // Limpiar error previo y spinner al reabrir
    const errorEl = document.getElementById('modalRolError');
    if (errorEl) errorEl.style.display = 'none';
    const btn = document.getElementById('btnGuardarRol');
    if (btn) { btn.disabled = false; btn.innerHTML = 'Guardar'; }
    bootstrap.Modal.getOrCreateInstance(document.getElementById('modalRol')).show();
}

async function guardarRol() {
    const nuevoRol  = document.getElementById('selectNuevoRol').value;
    const btnGuardar = document.getElementById('btnGuardarRol');
    const errorEl    = document.getElementById('modalRolError');

    if (errorEl) errorEl.style.display = 'none';
    if (btnGuardar) { btnGuardar.disabled = true; btnGuardar.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Guardando...'; }

    try {
        const res  = await fetch('/actualizar_rol_usuario', {
            method:  'PUT',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ cedula: _cedula_modal, rol: nuevoRol })
        });
        const data = await res.json();
        if (data.ok) {
            mostrarAlerta('Rol actualizado correctamente');
            bootstrap.Modal.getInstance(document.getElementById('modalRol'))?.hide();
            cargarUsuarios();
        } else {
            // Mostrar error dentro del modal
            if (errorEl) {
                errorEl.textContent    = data.error || 'Error al actualizar';
                errorEl.style.display  = 'block';
            } else {
                mostrarAlerta(data.error || 'Error al actualizar', true);
            }
        }
    } catch {
        mostrarAlerta('Error de conexión', true);
    } finally {
        if (btnGuardar) { btnGuardar.disabled = false; btnGuardar.innerHTML = 'Guardar'; }
    }
}

function eliminarUsuario(correo, nombre) {
    mostrarConfirmacionApp(
        'Eliminar Usuario',
        `¿Deseas eliminar permanentemente a <strong>${nombre}</strong>? Esta acción no se puede deshacer.`,
        async () => {
            try {
                const res  = await fetch('/eliminar_usuario_admin', {
                    method: 'DELETE',
                    headers: {'Content-Type':'application/json'},
                    body: JSON.stringify({ correo })
                });
                const data = await res.json();
                if (data.ok) { mostrarAlerta('Usuario eliminado'); cargarUsuarios(); }
                else mostrarAlerta(data.error || 'Error', true);
            } catch { mostrarAlerta('Error de conexión', true); }
        }
    );
}

function mostrarDetalleUsuario(u) {
    const esGoogle = u.auth_method === 'google';
    const rol      = u.rol || 'cliente';
    const rolClass = ROLES_CLASS[rol] || 'role-cliente';
    const fmtDate  = iso => iso
        ? new Date(iso).toLocaleDateString('es-CO',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})
        : '—';
    const ROL_ICONS  = { admin:'bi-shield-fill-check', vendedor:'bi-shop', cliente:'bi-person-fill', visitante:'bi-eye' };
    const ROL_COLORS = { admin:'#856404', vendedor:'#084298', cliente:'#0a3622' };
    const ROL_BKGS   = { admin:'#fff3cd', vendedor:'#cfe2ff', cliente:'#d1e7dd' };
    const metodo = esGoogle
        ? `<img src="/static/uploads/googlogo.ico" style="width:14px;height:14px;margin-right:4px;">Google`
        : `<i class="bi bi-envelope-fill" style="margin-right:4px;color:#0277bd;"></i>Correo D'Antojitos`;
    const infoRow = (icon, label, value, accent='') => `
        <div class="udet-info-card${accent ? ' udet-'+accent : ''}">
            <div class="udet-info-label"><i class="bi ${icon}"></i>${label}</div>
            <div class="udet-info-value">${value || '<span style="opacity:.45">—</span>'}</div>
        </div>`;
    const existing = document.getElementById('modalDetalleUsuario');
    if (existing) existing.remove();
    const modal = document.createElement('div');
    modal.id = 'modalDetalleUsuario';
    modal.className = 'modal fade';
    modal.setAttribute('tabindex', '-1');
    modal.innerHTML = `
        <div class="modal-dialog modal-dialog-centered modal-lg">
            <div class="modal-content udet-content">
                <div class="udet-hero">
                    <div class="udet-hero-bg"></div>
                    <button type="button" class="btn-close btn-close-white udet-close" data-bs-dismiss="modal"></button>
                    <div class="udet-avatar-wrap">
                        <div class="udet-avatar-ring">
                            <img src="${u.imagen_url || '/static/uploads/default_icon_profile.png'}"
                                 onerror="this.src='/static/uploads/default_icon_profile.png'"
                                 class="udet-avatar">
                        </div>
                        <div class="udet-auth-badge">
                            ${esGoogle
                                ? '<img src="/static/uploads/googlogo.ico" style="width:16px;height:16px;">'
                                : '<i class="bi bi-envelope-fill" style="color:#d35400;font-size:.85rem;"></i>'}
                        </div>
                    </div>
                    <div class="udet-hero-info">
                        <h3 class="udet-name">${u.nombre_completo || '—'}</h3>
                        ${u.username ? `<div class="udet-username">@${u.username}</div>` : ''}
                        <div class="udet-badges">
                            <span class="udet-rol-badge" style="background:${ROL_BKGS[rol]||'#eee'};color:${ROL_COLORS[rol]||'#555'};">
                                <i class="bi ${ROL_ICONS[rol]||'bi-person'} me-1"></i>${rol.charAt(0).toUpperCase()+rol.slice(1)}
                            </span>
                            <span class="udet-method-badge">${metodo}</span>
                        </div>
                    </div>
                </div>
                <div class="udet-body">
                    <div class="udet-section-title"><i class="bi bi-person-lines-fill"></i>Información Personal</div>
                    <div class="udet-grid">
                        ${infoRow('bi-card-text', 'Cédula / ID', `<strong class="font-monospace">${u.cedula||'—'}</strong>`)}
                        ${infoRow('bi-telephone-fill', 'Teléfono', u.telefono)}
                        ${infoRow('bi-envelope-fill', 'Correo', `<span style="word-break:break-all;font-size:.88rem;">${u.correo||'—'}</span>`)}
                        ${infoRow('bi-geo-alt-fill', 'Dirección', `<span style="font-size:.88rem;">${u.direccion||'—'}</span>`)}
                    </div>
                    <div class="udet-section-title mt-3"><i class="bi bi-activity"></i>Actividad de Cuenta</div>
                    <div class="udet-grid">
                        ${infoRow('bi-calendar-plus-fill', 'Registro', `<span style="font-size:.85rem;">${fmtDate(u.fecha_creacion)}</span>`, 'warm')}
                        ${infoRow('bi-clock-history', 'Última Conexión', `<span style="font-size:.85rem;">${fmtDate(u.ultima_conexion)}</span>`, 'green')}
                    </div>
                    <div class="udet-section-title mt-3"><i class="bi bi-gear-fill"></i>Preferencias</div>
                    <div class="udet-grid">
                        ${infoRow('bi-wallet2', 'Método de Pago', u.metodo_pago)}
                        ${infoRow('bi-shield-lock-fill', 'Autenticación', metodo)}
                    </div>
                </div>
                <div class="udet-footer">
                    <button class="udet-btn udet-btn-ghost"
                            onclick="navigator.clipboard.writeText('${u.correo||''}').then(()=>mostrarAlerta('Correo copiado'))">
                        <i class="bi bi-clipboard-fill"></i>Copiar Correo
                    </button>
                    <button class="udet-btn udet-btn-warning"
                            onclick="abrirModalRol('${u.cedula}','${u.nombre_completo}','${u.rol}');bootstrap.Modal.getInstance(document.getElementById('modalDetalleUsuario'))?.hide()">
                        <i class="bi bi-shield-shaded"></i>Cambiar Rol
                    </button>
                    <button class="udet-btn udet-btn-danger"
                            onclick="eliminarUsuario('${u.correo}','${u.nombre_completo}');bootstrap.Modal.getInstance(document.getElementById('modalDetalleUsuario'))?.hide()">
                        <i class="bi bi-trash3-fill"></i>Eliminar
                    </button>
                    <button type="button" class="udet-btn udet-btn-close" data-bs-dismiss="modal">
                        <i class="bi bi-x-lg"></i>Cerrar
                    </button>
                </div>
            </div>
        </div>`;
    document.body.appendChild(modal);
    new bootstrap.Modal(modal).show();
    modal.addEventListener('hidden.bs.modal', () => modal.remove());
}

document.addEventListener('DOMContentLoaded', cargarUsuarios);
