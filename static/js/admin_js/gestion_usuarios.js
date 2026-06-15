let _usuarios = [];
let _cedula_modal = null;
let _sortCol = '';
let _sortAsc = true;
let _paginaUsuarios = 1;
const _ITEMS_PAG = 10;

const ROLES_CLASS = { admin:'role-admin', vendedor:'role-vendedor', cliente:'role-cliente', visitante:'role-cliente' };

function _fecha(iso) {
    if (!iso) return '-';
    try {
        const d = new Date(iso);
        if (d.getFullYear() < 2001) return '—';
        return d.toLocaleDateString('es-CO', { day:'2-digit', month:'short', year:'numeric' });
    } catch { return '-'; }
}

async function cargarUsuarios() {
    try {
        const res  = await fetch('/listar_usuarios');
        const raw  = await res.json();
        _usuarios  = raw.map(u => ({
            ...u,
            rol: u.rol || 'cliente',

            auth_method: u.auth_method || 'email',
        }));
        _actualizarStats();
        filtrarUsuarios();
    } catch { mostrarAlerta('Error al cargar usuarios', true); }
}

function _actualizarStats() {
    document.getElementById('statTotal').textContent     = _usuarios.length;
    document.getElementById('statAdmins').textContent    = _usuarios.filter(u => u.rol === 'admin').length;
    document.getElementById('statVendedores').textContent= _usuarios.filter(u => u.rol === 'vendedor').length;
    document.getElementById('statClientes').textContent  = _usuarios.filter(u => u.rol === 'cliente').length;
    document.getElementById('statGoogle').textContent    = _usuarios.filter(u => u.auth_method === 'google' || u.auth_method === 'both').length;
}

function filtrarUsuarios() {
    const q    = (document.getElementById('buscarUsuario').value || '').toLowerCase();
    const rol  = document.getElementById('filtroRol').value;
    const auth = document.getElementById('filtroAuth').value;
    const filtrados = _usuarios.filter(u => {
        const texto = `${u.nombre_completo} ${u.correo} ${u.cedula}`.toLowerCase();
        const authMatch = !auth || u.auth_method === auth || u.auth_method === 'both';
        return (!q || texto.includes(q)) && (!rol || u.rol === rol) && authMatch;
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
    const name = (u.nombre_completo || u.nombre || '').trim();
    if (u.imagen_url && !u.imagen_url.includes('default_icon_profile')) {
        return `<div class="user-avatar-cell">
                    <img src=""
                         data-profile="${u.imagen_url}"
                         data-profile-name="${name}"
                         data-profile-size="80"
                         alt="${name}"
                         style="display:block;width:100%;height:100%;object-fit:cover;border-radius:50%;">
                </div>`;
    }
    const initial = name.charAt(0).toUpperCase() || '?';
    const paletas = [
        ['#d35400','#e67e22'],['#1a6fa8','#2980b9'],['#1a8f4c','#27ae60'],
        ['#6d28d9','#8b5cf6'],['#b91c1c','#ef4444'],['#0e7490','#06b6d4'],
        ['#92400e','#d97706'],['#065f46','#10b981'],['#1e40af','#3b82f6'],
        ['#9d174d','#ec4899'],['#4c1d95','#7c3aed'],['#374151','#6b7280'],
        ['#7f1d1d','#b45309'],['#064e3b','#059669'],['#1e3a5f','#2563eb'],
        ['#831843','#be185d'],['#134e4a','#0d9488'],['#1c1917','#57534e'],
        ['#422006','#a16207'],['#0c4a6e','#0284c7'],['#3b0764','#9333ea'],
        ['#14532d','#16a34a'],['#450a0a','#dc2626'],['#172554','#1d4ed8'],
    ];
    const idx = name.split('').reduce((h,c)=>(h<<5)-h+c.charCodeAt(0),0);
    const [c1,c2] = paletas[Math.abs(idx)%paletas.length];
    return `<div class="user-avatar-cell" style="background:linear-gradient(135deg,${c1},${c2});display:flex;align-items:center;justify-content:center;">
                <span style="color:#fff;font-weight:800;font-size:1rem;font-family:'DM Sans',sans-serif;">${initial}</span>
            </div>`;
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
    const _ORDEN_ROL = { admin: 0, vendedor: 1, cliente: 2 };
    let ordenada = [...lista];
    if (_sortCol) {
        ordenada.sort((a,b) => {
            const va = (a[_sortCol] || '').toString().toLowerCase();
            const vb = (b[_sortCol] || '').toString().toLowerCase();
            return _sortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
        });
    } else {
        ordenada.sort((a, b) => {
            const ra = _ORDEN_ROL[a.rol] ?? 3;
            const rb = _ORDEN_ROL[b.rol] ?? 3;
            if (ra !== rb) return ra - rb;
            return (a.nombre_completo || '').localeCompare(b.nombre_completo || '');
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
            <td><span class="font-monospace text-muted" style="font-size:0.78rem;">${u.cedula || '—'}</span></td>
            <td>
                <div class="d-flex align-items-center gap-1">
                    <span style="font-size:0.83rem;">${u.correo || u.google_account || '—'}</span>
                    <button class="btn btn-sm p-0 border-0 text-muted btn-copiar-correo" title="Copiar correo" data-correo="${u.correo || u.google_account || ''}">
                        <i class="bi bi-clipboard" style="font-size:0.72rem;"></i>
                    </button>
                </div>
            </td>
            <td><span class="role-badge ${ROLES_CLASS[u.rol] || 'role-cliente'}">${u.rol || 'cliente'}</span></td>
            <td>
                ${(() => {
                    const _sq = (img, border) =>
                        `<span style="display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:6px;background:#fff;border:1.5px solid ${border};box-shadow:0 1px 4px rgba(0,0,0,0.15);flex-shrink:0;">
                            <img src="${img}" style="width:15px;height:15px;object-fit:contain;" onerror="this.style.display='none'">
                        </span>`;
                    const _goo = _sq('/static/uploads/googlogo.ico', '#dadce0');
                    const _dan = _sq('/static/uploads/logo.ico',     '#e67e22');
                    if (u.auth_method === 'both')   return `<span style="display:inline-flex;align-items:center;gap:3px;">${_goo}${_dan}</span>`;
                    if (u.auth_method === 'google') return _goo;
                    return _dan;
                })()}
            </td>
            <td class="text-nowrap">
                <span class="badge text-bg-light border" style="font-size:0.72rem;font-weight:600;">
                    <i class="bi bi-calendar3 me-1 text-muted"></i>${_fecha(u.fecha_creacion)}
                </span>
            </td>
            <td class="text-center text-nowrap">
                <div class="btn-group btn-group-sm" role="group">
                    <button class="btn btn-outline-secondary action-btn btn-ver-usuario"
                            title="Ver perfil completo"
                            data-bs-toggle="tooltip" data-bs-placement="top"
                            data-idx="${_usuarios.indexOf(u)}">
                        <i class="bi bi-eye-fill"></i>
                    </button>
                    <button class="btn btn-outline-primary action-btn"
                            onclick="abrirModalRol('${u.cedula}','${u.nombre_completo}','${u.rol}')"
                            title="Cambiar rol"
                            data-bs-toggle="tooltip" data-bs-placement="top">
                        <i class="bi bi-shield-lock-fill"></i>
                    </button>
                    <button class="btn btn-outline-warning action-btn btn-archivos-usuario"
                            title="Archivos privados"
                            data-bs-toggle="tooltip" data-bs-placement="top"
                            data-cedula="${u.cedula}"
                            data-nombre="${u.nombre_completo}"
                            data-imagen="${u.imagen_url || ''}">
                        <i class="bi bi-folder2-open"></i>
                    </button>
                    <button class="btn btn-outline-danger action-btn"
                            onclick="eliminarUsuario('${u.cedula}','${u.nombre_completo}')"
                            title="Eliminar usuario"
                            data-bs-toggle="tooltip" data-bs-placement="top">
                        <i class="bi bi-trash-fill"></i>
                    </button>
                </div>
            </td>`;
        tr.querySelector('.btn-ver-usuario').onclick = () => mostrarDetalleUsuario(u);
        tr.querySelector('.btn-archivos-usuario').onclick = () => abrirFilesPanel(u.cedula, u.nombre_completo, u.imagen_url);
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
    if (typeof initAllProfileImages === 'function') initAllProfileImages();
    tbody.querySelectorAll('[data-bs-toggle="tooltip"]').forEach(el => {
        bootstrap.Tooltip.getOrCreateInstance(el, { trigger: 'hover' });
    });
}

function abrirModalRol(cedula, nombre, rolActual) {
    _cedula_modal = cedula;
    document.getElementById('modalRolNombre').textContent = nombre;
    document.getElementById('selectNuevoRol').value       = rolActual || 'cliente';
    document.getElementById('btnGuardarRol').onclick      = guardarRol;
    
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

function eliminarUsuario(cedula, nombre) {
    mostrarConfirmacionApp(
        'Eliminar Usuario',
        `¿Deseas eliminar permanentemente a <strong>${nombre}</strong>? Esta acción no se puede deshacer.`,
        async () => {
            try {
                const res  = await fetch('/eliminar_usuario_admin', {
                    method: 'DELETE',
                    headers: {'Content-Type':'application/json'},
                    body: JSON.stringify({ cedula })
                });
                const data = await res.json();
                if (data.ok) { mostrarAlerta('Usuario eliminado'); cargarUsuarios(); }
                else mostrarAlerta(data.error || 'Error', true);
            } catch { mostrarAlerta('Error de conexión', true); }
        }
    );
}

function mostrarDetalleUsuario(u) {
    const esGoogle = u.auth_method === 'google' || u.auth_method === 'both';
    const esAmbos  = u.auth_method === 'both';
    const rol      = u.rol || 'cliente';
    const ROL_ICONS  = { admin:'bi-shield-fill-check', vendedor:'bi-shop', cliente:'bi-person-fill' };
    const ROL_COLORS = { admin:'#856404', vendedor:'#084298', cliente:'#0a3622' };
    const ROL_BKGS   = { admin:'#fff3cd', vendedor:'#cfe2ff', cliente:'#d1e7dd' };
    const fmtDate  = iso => {
        if (!iso) return '—';
        const d = new Date(iso);
        if (d.getFullYear() < 2001) return '—';
        return d.toLocaleDateString('es-CO',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});
    };
    const row = (icon, label, value) => `
        <div class="udet-row">
            <span class="udet-row-label"><i class="bi ${icon}"></i>${label}</span>
            <span class="udet-row-value">${value || '<span class="text-muted">—</span>'}</span>
        </div>`;
    const _detName = (u.nombre_completo || '?');
    const _detIdx  = _detName.split('').reduce((h,c) => (h<<5)-h+c.charCodeAt(0), 0);
    const _detPals = [['#d35400','#e67e22'],['#1a6fa8','#2980b9'],['#1a8f4c','#27ae60'],['#6d28d9','#8b5cf6'],['#b91c1c','#ef4444'],['#0e7490','#06b6d4']];
    const [_dc1, _dc2] = _detPals[Math.abs(_detIdx) % _detPals.length];

    const existing = document.getElementById('modalDetalleUsuario');
    if (existing) existing.remove();
    const modal = document.createElement('div');
    modal.id = 'modalDetalleUsuario';
    modal.className = 'modal fade';
    modal.setAttribute('tabindex', '-1');
    modal.innerHTML = `
        <div class="modal-dialog modal-dialog-centered modal-md">
            <div class="modal-content udet-content">

                <div class="udet-header udet-header-centered">
                    <button type="button" class="btn-close udet-close" data-bs-dismiss="modal"></button>
                    <div class="udet-avatar-wrap udet-avatar-wrap-centered">
                        ${u.imagen_url && !u.imagen_url.includes('default_icon_profile')
                            ? `<img src=""
                                    data-profile="${u.imagen_url}"
                                    data-profile-name="${u.nombre_completo || ''}"
                                    data-profile-size="72"
                                    alt="${u.nombre_completo || ''}"
                                    class="udet-avatar udet-avatar-lg"
                                    style="display:block;object-fit:cover;border-radius:50%;"
                                    onerror="this.style.display='none'">`
                            : `<div class="udet-avatar-lg udet-avatar-initial" style="background:linear-gradient(135deg,${_dc1},${_dc2});">${_detName.charAt(0).toUpperCase()}</div>`}
                    </div>
                    <div class="udet-header-info text-center">
                        <div class="udet-name">${u.nombre_completo || '—'}</div>
                        ${u.username ? `<div class="udet-username">@${u.username}</div>` : ''}
                        <div class="d-flex gap-2 flex-wrap mt-1 justify-content-center">
                            <span class="udet-rol-badge" style="background:${ROL_BKGS[rol]||'#eee'};color:${ROL_COLORS[rol]||'#555'};">
                                <i class="bi ${ROL_ICONS[rol]||'bi-person'} me-1"></i>${rol.charAt(0).toUpperCase()+rol.slice(1)}
                            </span>
                            <span class="udet-method-badge">
                                ${esAmbos
                                    ? `<span style="display:inline-flex;align-items:center;gap:4px;">
                                           <img src="/static/uploads/googlogo.ico" style="width:14px;height:14px;" onerror="this.style.display='none'">
                                           <img src="/static/uploads/logo.ico" style="width:14px;height:14px;object-fit:contain;" onerror="this.style.display='none'">
                                       </span>`
                                    : esGoogle
                                        ? '<img src="/static/uploads/googlogo.ico" style="width:13px;height:13px;margin-right:4px;" onerror="this.style.display=\'none\'">Google'
                                        : '<img src="/static/uploads/logo.ico" style="width:13px;height:13px;object-fit:contain;margin-right:4px;" onerror="this.style.display=\'none\'">D\'Antojitos'}
                            </span>
                        </div>
                    </div>
                </div>

                <div class="udet-body">
                    ${row('bi-card-text',          'Cédula',              `<span class="font-monospace">${u.cedula||'—'}</span>`)}
                    ${row('bi-at',                 'Usuario',             u.username ? `@${u.username}` : null)}
                    ${row('bi-envelope-fill',       'Correo',              `<span style="word-break:break-all;">${u.correo||'—'}</span>`)}
                    ${u.google_account ? row('bi-google',              'Cuenta Google',       `<span style="word-break:break-all;">${u.google_account}</span>`) : ''}
                    ${row('bi-telephone-fill',      'Teléfono',            u.telefono)}
                    ${row('bi-geo-alt-fill',        'Dirección',           u.direccion)}
                    ${row('bi-wallet2',             'Método de Pago',      u.metodo_pago)}
                    ${row('bi-cake2-fill',          'Fecha de Nacimiento', u.fecha_nacimiento ? new Date(u.fecha_nacimiento + 'T12:00:00').toLocaleDateString('es-CO',{day:'2-digit',month:'long',year:'numeric'}) : null)}
                    ${row('bi-calendar-plus-fill',  'Registro',            fmtDate(u.fecha_creacion))}
                    ${row('bi-clock-history',       'Última Conexión',     fmtDate(u.ultima_conexion))}
                </div>

                <div class="udet-footer">
                    <button class="udet-btn udet-btn-ghost"
                            onclick="navigator.clipboard.writeText('${u.correo||u.google_account||''}').then(()=>mostrarAlerta('Correo copiado'))">
                        <i class="bi bi-clipboard-fill"></i>Copiar correo
                    </button>
                    <button class="udet-btn udet-btn-warning"
                            onclick="abrirModalRol('${u.cedula}','${u.nombre_completo}','${u.rol}');bootstrap.Modal.getInstance(document.getElementById('modalDetalleUsuario'))?.hide()">
                        <i class="bi bi-shield-shaded"></i>Cambiar rol
                    </button>
                    <button class="udet-btn udet-btn-danger"
                            onclick="eliminarUsuario('${u.cedula}','${u.nombre_completo}');bootstrap.Modal.getInstance(document.getElementById('modalDetalleUsuario'))?.hide()">
                        <i class="bi bi-trash3-fill"></i>Eliminar
                    </button>
                </div>

            </div>
        </div>`;
    document.body.appendChild(modal);
    new bootstrap.Modal(modal).show();
    modal.addEventListener('shown.bs.modal', () => {
        if (typeof initAllProfileImages === 'function') initAllProfileImages();
    });
    modal.addEventListener('hidden.bs.modal', () => modal.remove());
}

document.addEventListener('DOMContentLoaded', () => {
    cargarUsuarios();
    _initFilesPanelDrop();
});

let _fpCedulaActual = null;
let _fpArchivosActuales = [];
const _FP_LIMITE = 100 * 1024 * 1024;

const _FILE_ICONS = {
    pdf:  { icon: 'bi-file-earmark-pdf-fill',   color: '#e74c3c' },
    doc:  { icon: 'bi-file-earmark-word-fill',   color: '#2980b9' },
    docx: { icon: 'bi-file-earmark-word-fill',   color: '#2980b9' },
    xls:  { icon: 'bi-file-earmark-excel-fill',  color: '#27ae60' },
    xlsx: { icon: 'bi-file-earmark-excel-fill',  color: '#27ae60' },
    ppt:  { icon: 'bi-file-earmark-ppt-fill',    color: '#e67e22' },
    pptx: { icon: 'bi-file-earmark-ppt-fill',    color: '#e67e22' },
    zip:  { icon: 'bi-file-earmark-zip-fill',    color: '#8e44ad' },
    rar:  { icon: 'bi-file-earmark-zip-fill',    color: '#8e44ad' },
    '7z': { icon: 'bi-file-earmark-zip-fill',    color: '#8e44ad' },
    jpg:  { icon: 'bi-file-earmark-image-fill',  color: '#d35400' },
    jpeg: { icon: 'bi-file-earmark-image-fill',  color: '#d35400' },
    png:  { icon: 'bi-file-earmark-image-fill',  color: '#d35400' },
    gif:  { icon: 'bi-file-earmark-image-fill',  color: '#d35400' },
    mp4:  { icon: 'bi-file-earmark-play-fill',   color: '#c0392b' },
    mov:  { icon: 'bi-file-earmark-play-fill',   color: '#c0392b' },
    txt:  { icon: 'bi-file-earmark-text-fill',   color: '#7f8c8d' },
    pkt:  { icon: 'bi-diagram-3-fill',           color: '#2471a3' },
    sql:  { icon: 'bi-database-fill',            color: '#1a5276' },
    py:   { icon: 'bi-filetype-py',              color: '#2c9c47' },
    js:   { icon: 'bi-filetype-js',              color: '#f0c30f' },
    html: { icon: 'bi-filetype-html',            color: '#e44d26' },
    css:  { icon: 'bi-filetype-css',             color: '#264de4' },
};

function _fileInfo(nombre) {
    const ext = (nombre || '').split('.').pop().toLowerCase();
    return _FILE_ICONS[ext] || { icon: 'bi-file-earmark-fill', color: '#95a5a6' };
}

function _formatBytes(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

function _fmtDate(iso) {
    if (!iso) return '—';
    try {
        return new Date(iso).toLocaleDateString('es-CO', {
            day: '2-digit', month: 'short', year: 'numeric'
        });
    } catch { return '—'; }
}

function _totalBytes(archivos) {
    return archivos.reduce((acc, a) => acc + (a.tamanio || 0), 0);
}

function _fpCheckLimit(archivos) {
    const total = _totalBytes(archivos);
    const over  = total >= _FP_LIMITE;
    const lbl   = document.getElementById('fpUploadLabel');
    const input = document.getElementById('fpFileInput');
    const warn  = document.getElementById('fpLimitWarning');
    if (lbl) {
        lbl.style.opacity       = over ? '0.4' : '';
        lbl.style.pointerEvents = over ? 'none' : '';
        lbl.style.cursor        = over ? 'not-allowed' : '';
        lbl.title = over ? 'Límite de 100 MB alcanzado. Elimina archivos para subir más.' : 'Subir archivo';
    }
    if (input) input.disabled = over;
    if (warn)  warn.style.display = over ? 'flex' : 'none';
}

function abrirFilesPanel(cedula, nombre, imagen) {
    _fpCedulaActual = cedula;

    const layout = document.getElementById('guSplitLayout');
    const panel  = document.getElementById('guFilesPanel');
    layout?.classList.add('files-open');
    panel?.classList.add('is-open');

    const nameEl   = document.getElementById('fpHeaderName');
    const cedEl    = document.getElementById('fpHeaderCedula');
    const avatarEl = document.getElementById('fpHeaderAvatar');
    if (nameEl)   nameEl.textContent   = nombre || '—';
    if (cedEl)    cedEl.textContent    = cedula || '—';
    if (avatarEl) {
        if (imagen) {
            const _fpn  = nombre || '?';
            const _fpi  = _fpn.split('').reduce((h,c) => (h<<5)-h+c.charCodeAt(0), 0);
            const _fpp  = [['#d35400','#e67e22'],['#1a6fa8','#2980b9'],['#1a8f4c','#27ae60'],['#6d28d9','#8b5cf6'],['#b91c1c','#ef4444'],['#0e7490','#06b6d4']];
            const [_fc1,_fc2] = _fpp[Math.abs(_fpi) % _fpp.length];
            const _fallback = `<i class="bi bi-person-fill" style="display:none;"></i><div style="width:100%;height:100%;border-radius:50%;background:linear-gradient(135deg,${_fc1},${_fc2});display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:1rem;">${_fpn.charAt(0).toUpperCase()}</div>`;
            avatarEl.innerHTML = `<img src="${imagen}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';" style="width:100%;height:100%;object-fit:cover;border-radius:50%;"><div style="display:none;width:100%;height:100%;border-radius:50%;background:linear-gradient(135deg,${_fc1},${_fc2});align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:1.1rem;">${_fpn.charAt(0).toUpperCase()}</div>`;
        } else {
            const _fpn  = nombre || '?';
            const _fpi  = _fpn.split('').reduce((h,c) => (h<<5)-h+c.charCodeAt(0), 0);
            const _fpp  = [['#d35400','#e67e22'],['#1a6fa8','#2980b9'],['#1a8f4c','#27ae60'],['#6d28d9','#8b5cf6'],['#b91c1c','#ef4444'],['#0e7490','#06b6d4']];
            const [_fc1,_fc2] = _fpp[Math.abs(_fpi) % _fpp.length];
            avatarEl.innerHTML = `<div style="width:100%;height:100%;border-radius:50%;background:linear-gradient(135deg,${_fc1},${_fc2});display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:1.1rem;">${_fpn.charAt(0).toUpperCase()}</div>`;
        }
    }

    document.querySelectorAll('.btn-archivos-usuario').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.cedula === cedula);
    });

    cargarArchivos(cedula);
}

function cerrarFilesPanel() {
    _fpCedulaActual = null;
    _fpArchivosActuales = [];
    document.getElementById('guSplitLayout')?.classList.remove('files-open');
    document.getElementById('guFilesPanel')?.classList.remove('is-open');
    document.querySelectorAll('.btn-archivos-usuario').forEach(btn => btn.classList.remove('active'));
}

async function cargarArchivos(cedula) {
    const list  = document.getElementById('fpFileList');
    const empty = document.getElementById('fpEmpty');
    const count = document.getElementById('fpFileCount');
    const stor  = document.getElementById('fpStorageText');
    if (!list) return;

    list.innerHTML = `<li class="fp-loading"><div class="spinner-border spinner-border-sm me-2" style="color:#d35400;"></div>Cargando...</li>`;
    if (empty) empty.style.display = 'none';

    try {
        const res = await fetch(`/api/usuarios/${cedula}/archivos`);
        if (!res.ok) throw new Error('Error al cargar');
        const data = await res.json();
        _fpArchivosActuales = data.archivos || [];
        _renderArchivos(_fpArchivosActuales);
    } catch {
        list.innerHTML = '<li class="fp-loading text-danger"><i class="bi bi-exclamation-triangle me-1"></i>Error al cargar archivos</li>';
    }
}

function _renderArchivos(archivos) {
    const list  = document.getElementById('fpFileList');
    const empty = document.getElementById('fpEmpty');
    const count = document.getElementById('fpFileCount');
    const stor  = document.getElementById('fpStorageText');
    if (!list) return;

    if (count) count.textContent = `${archivos.length} archivo${archivos.length !== 1 ? 's' : ''}`;
    if (stor)  stor.textContent  = _formatBytes(_totalBytes(archivos)) + ' / 100 MB';
    _fpCheckLimit(archivos);

    if (archivos.length === 0) {
        list.innerHTML = '';
        if (empty) empty.style.display = 'flex';
        return;
    }

    if (empty) empty.style.display = 'none';
    list.innerHTML = '';

    archivos.forEach((a, idx) => {
        const info = _fileInfo(a.nombre);
        const li = document.createElement('li');
        li.className = 'fp-file-item';
        li.dataset.idx = idx;
        li.innerHTML = `
            <div class="fp-file-icon" style="color:${info.color};">
                <i class="bi ${info.icon}"></i>
            </div>
            <div class="fp-file-info">
                <a href="${a.url}" target="_blank" rel="noopener" class="fp-file-name" title="${a.nombre}">${a.nombre}</a>
                <div class="fp-file-meta">
                    <span>${_formatBytes(a.tamanio)}</span>
                    <span class="fp-meta-sep">·</span>
                    <span>${_fmtDate(a.subido_en)}</span>
                </div>
            </div>
            <div class="fp-file-actions">
                <a href="/api/usuarios/${_fpCedulaActual}/descargar?pub=${encodeURIComponent(a.public_id)}" class="fp-file-btn fp-btn-dl" title="Descargar">
                    <i class="bi bi-download"></i>
                </a>
                <button class="fp-file-btn fp-btn-del" title="Eliminar archivo" onclick="eliminarArchivo('${(a.public_id || '').replace(/'/g, "\\'")}', '${a.nombre.replace(/'/g, "\\'")}')">
                    <i class="bi bi-trash3-fill"></i>
                </button>
            </div>`;
        list.appendChild(li);
    });
}

async function subirArchivos() {
    if (!_fpCedulaActual) return;
    const input = document.getElementById('fpFileInput');
    if (!input || !input.files.length) return;
    if (_totalBytes(_fpArchivosActuales) >= _FP_LIMITE) {
        mostrarAlerta('El usuario ha alcanzado el límite de 100 MB. Elimina archivos primero.', true);
        input.value = '';
        return;
    }

    const uploading = document.getElementById('fpUploading');
    const upText    = document.getElementById('fpUploadingText');
    const label     = document.getElementById('fpUploadLabel');

    if (uploading) uploading.style.display = 'flex';
    if (label)     label.style.pointerEvents = 'none';

    const archivos = Array.from(input.files);
    let subidos = 0;

    for (const file of archivos) {
        if (upText) upText.textContent = `Subiendo ${file.name}... (${subidos + 1}/${archivos.length})`;
        const fd = new FormData();
        fd.append('archivo', file);
        try {
            const res = await fetch(`/api/usuarios/${_fpCedulaActual}/archivos`, { method: 'POST', body: fd });
            const data = await res.json();
            if (data.ok) {
                subidos++;
                _fpArchivosActuales.push(data.archivo);
            } else {
                mostrarAlerta(`Error subiendo ${file.name}: ${data.error || ''}`, true);
            }
        } catch {
            mostrarAlerta(`Error de conexión subiendo ${file.name}`, true);
        }
    }

    if (uploading) uploading.style.display = 'none';
    if (label)     label.style.pointerEvents = '';
    input.value = '';

    if (subidos > 0) {
        mostrarAlerta(`${subidos} archivo${subidos !== 1 ? 's' : ''} subido${subidos !== 1 ? 's' : ''} correctamente`);
        _renderArchivos(_fpArchivosActuales);
    }
}

function eliminarArchivo(publicId, nombre) {
    if (!_fpCedulaActual || !publicId) return;
    mostrarConfirmacionApp(
        'Eliminar Archivo',
        `¿Eliminar <strong>${nombre}</strong>? Esta acción no se puede deshacer.`,
        async () => {
            try {
                const res = await fetch(`/api/usuarios/${_fpCedulaActual}/archivos/${encodeURIComponent(publicId)}`, { method: 'DELETE' });
                const data = await res.json();
                if (data.ok) {
                    _fpArchivosActuales = _fpArchivosActuales.filter(a => a.public_id !== publicId);
                    _renderArchivos(_fpArchivosActuales);
                    mostrarAlerta('Archivo eliminado');
                } else {
                    mostrarAlerta(data.error || 'Error al eliminar', true);
                }
            } catch { mostrarAlerta('Error de conexión', true); }
        }
    );
}

function _initFilesPanelDrop() {
    const panel   = document.getElementById('guFilesPanel');
    const overlay = document.getElementById('fpDropOverlay');
    if (!panel) return;

    panel.addEventListener('dragover', (e) => {
        if (!_fpCedulaActual) return;
        e.preventDefault();
        overlay?.classList.add('visible');
    });
    panel.addEventListener('dragleave', (e) => {
        if (!panel.contains(e.relatedTarget)) overlay?.classList.remove('visible');
    });
    panel.addEventListener('drop', async (e) => {
        e.preventDefault();
        overlay?.classList.remove('visible');
        if (!_fpCedulaActual) return;
        const files = Array.from(e.dataTransfer?.files || []);
        if (!files.length) return;
        const input = document.getElementById('fpFileInput');
        if (input) {
            const dt = new DataTransfer();
            files.forEach(f => dt.items.add(f));
            input.files = dt.files;
            await subirArchivos();
        }
    });
}
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/static/js/workers/sw-ui.js').catch(() => {});
    });
}
