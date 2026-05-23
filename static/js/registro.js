document.addEventListener('DOMContentLoaded', function () {

    var ES_MEDICO = (window.USER_ROL || '') === 'MEDICO';

    var form = document.getElementById('form-registro');
    if (form) {
        form.addEventListener('submit', function (e) {
            var campos = ['nombre_completo', 'cedula', 'correo'];
            for (var i = 0; i < campos.length; i++) {
                var c = form.querySelector('[name="' + campos[i] + '"]');
                if (c && !c.value.trim()) {
                    e.preventDefault();
                    alert('Complete todos los campos obligatorios.');
                    c.focus();
                    return;
                }
            }
            var correoEl = form.querySelector('[name="correo"]');
            if (correoEl && !/^\S+@\S+\.\S+$/.test(correoEl.value.trim())) {
                e.preventDefault();
                alert('Ingrese un correo electrónico válido.');
                correoEl.focus();
            }
        });
    }

    if (!ES_MEDICO) return;

    var listadoEl        = document.getElementById('listado-usuarios');
    var badgeTotal       = document.getElementById('badge-total-usuarios');
    var inputFiltro      = document.getElementById('input-filtro-cedula');
    var btnBuscar        = document.getElementById('btn-buscar-usuario');
    var btnLimpiar       = document.getElementById('btn-limpiar-filtro');
    var btnRefrescar     = document.getElementById('btn-refrescar-usuarios');
    var modalEl          = document.getElementById('modal-cambiar-rol');
    var modalCedulaDisp  = document.getElementById('modal-cedula-display');
    var modalCedulaTgt   = document.getElementById('modal-cedula-target');
    var modalSelectRol   = document.getElementById('modal-select-rol');
    var btnConfirmarRol  = document.getElementById('btn-confirmar-cambio-rol');

    var bsModal = modalEl ? new bootstrap.Modal(modalEl) : null;

    function spinner() {
        return '<div class="text-center text-muted py-4"><div class="spinner-border spinner-border-sm me-2"></div>Cargando usuarios...</div>';
    }

    function badgeRol(rol) {
        if (rol === 'MEDICO') return '<span class="badge bg-primary-subtle text-primary border border-primary-subtle">Médico</span>';
        return '<span class="badge bg-success-subtle text-success border border-success-subtle">Paciente</span>';
    }

    function formatFecha(iso) {
        if (!iso) return '—';
        var d = new Date(iso);
        return isNaN(d) ? iso : d.toLocaleDateString('es-CO', { year: 'numeric', month: 'short', day: '2-digit' });
    }

    function renderTabla(usuarios) {
        if (!listadoEl) return;
        if (!usuarios.length) {
            listadoEl.innerHTML =
                '<div class="text-center text-muted py-4">' +
                '<i class="fas fa-user-slash fa-2x mb-3 d-block opacity-50"></i>' +
                'No se encontraron usuarios con ese criterio.' +
                '</div>';
            if (badgeTotal) badgeTotal.textContent = '0 usuarios';
            return;
        }
        if (badgeTotal) badgeTotal.textContent = usuarios.length + ' usuario' + (usuarios.length !== 1 ? 's' : '');
        var html =
            '<div class="app-table-container">' +
            '<table class="tabla-resultados w-100"><thead><tr>' +
            '<th>Cédula</th><th>Nombre completo</th><th>Correo</th>' +
            '<th>Rol</th><th>Registrado</th><th class="text-center">Acciones</th>' +
            '</tr></thead><tbody>';
        var cedulaPropia = window.USER_CEDULA || '';
        usuarios.forEach(function (u) {
            var cedula = u.cedula || '';
            var esPropio = cedula === cedulaPropia;
            html += '<tr>' +
                '<td class="font-monospace fw-semibold">' + cedula + '</td>' +
                '<td>' + (u.nombre_completo || '—') + '</td>' +
                '<td style="font-size:.85rem;">' + (u.correo || '—') + '</td>' +
                '<td>' + badgeRol(u.rol) + '</td>' +
                '<td style="font-size:.82rem;">' + formatFecha(u.creado_en) + '</td>' +
                '<td class="text-center" style="white-space:nowrap;">' +
                    (esPropio
                        ? '<span class="text-muted" style="font-size:.8rem;"><i class="fas fa-user-circle me-1"></i>Tu cuenta</span>'
                        : '<button class="btn btn-sm btn-outline-primary me-1 btn-cambiar-rol" ' +
                          'data-cedula="' + cedula + '" data-rol="' + (u.rol || 'PACIENTE') + '">' +
                          '<i class="fas fa-user-tag me-1"></i>Rol</button>' +
                          '<button class="btn btn-sm btn-outline-danger btn-eliminar-usuario" data-cedula="' + cedula + '">' +
                          '<i class="fas fa-trash-alt me-1"></i>Eliminar</button>'
                    ) +
                '</td></tr>';
        });
        html += '</tbody></table></div>';
        listadoEl.innerHTML = html;

        listadoEl.querySelectorAll('.btn-cambiar-rol').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var ced = this.dataset.cedula;
                var rolActual = this.dataset.rol || 'PACIENTE';
                if (modalCedulaDisp) modalCedulaDisp.textContent = ced;
                if (modalCedulaTgt)  modalCedulaTgt.value = ced;
                if (modalSelectRol)  modalSelectRol.value = rolActual;
                bsModal && bsModal.show();
            });
        });

        listadoEl.querySelectorAll('.btn-eliminar-usuario').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var ced = this.dataset.cedula;
                var fila = this.closest('tr');
                if (!confirm('¿Eliminar permanentemente al usuario con cédula ' + ced + '? Esta acción no se puede deshacer.')) return;
                btn.disabled = true;
                btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';
                fetch('/api/eliminar_usuario', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ cedula: ced })
                })
                    .then(function (r) { return r.json(); })
                    .then(function (data) {
                        if (data.ok) {
                            fila && fila.remove();
                            var filas = listadoEl.querySelectorAll('tbody tr');
                            if (badgeTotal) badgeTotal.textContent = filas.length + ' usuario' + (filas.length !== 1 ? 's' : '');
                        } else {
                            alert(data.error || 'No se pudo eliminar el usuario.');
                            btn.disabled = false;
                            btn.innerHTML = '<i class="fas fa-trash-alt me-1"></i>Eliminar';
                        }
                    })
                    .catch(function () {
                        alert('Error de comunicación.');
                        btn.disabled = false;
                        btn.innerHTML = '<i class="fas fa-trash-alt me-1"></i>Eliminar';
                    });
            });
        });
    }

    function cargarUsuarios(cedula) {
        if (!listadoEl) return;
        listadoEl.innerHTML = spinner();
        var url = '/api/listar_usuarios';
        if (cedula) url += '?cedula=' + encodeURIComponent(cedula);
        fetch(url)
            .then(function (r) { return r.json(); })
            .then(function (data) { renderTabla(Array.isArray(data) ? data : []); })
            .catch(function () {
                listadoEl.innerHTML = '<div class="alert alert-danger rounded-3 border-0">Error al cargar los usuarios.</div>';
            });
    }

    if (btnConfirmarRol) {
        btnConfirmarRol.addEventListener('click', function () {
            var ced      = modalCedulaTgt  ? modalCedulaTgt.value  : '';
            var nuevoRol = modalSelectRol  ? modalSelectRol.value  : '';
            if (!ced || !nuevoRol) return;
            btnConfirmarRol.disabled = true;
            btnConfirmarRol.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Guardando...';
            fetch('/api/cambiar_rol_usuario', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ cedula: ced, rol: nuevoRol })
            })
                .then(function (r) { return r.json(); })
                .then(function (data) {
                    btnConfirmarRol.disabled = false;
                    btnConfirmarRol.innerHTML = '<i class="fas fa-check me-1"></i>Confirmar';
                    if (data.ok) {
                        bsModal && bsModal.hide();
                        var fila = listadoEl && listadoEl.querySelector('[data-cedula="' + ced + '"]');
                        if (fila) {
                            var btnRolEl = fila.closest('tr') && fila.closest('tr').querySelector('.btn-cambiar-rol');
                            if (btnRolEl) btnRolEl.dataset.rol = nuevoRol;
                            var badgeCelda = fila.closest('tr') && fila.closest('tr').querySelector('td:nth-child(4)');
                            if (badgeCelda) badgeCelda.innerHTML = badgeRol(nuevoRol);
                        }
                    } else {
                        alert(data.error || 'No se pudo cambiar el rol.');
                    }
                })
                .catch(function () {
                    btnConfirmarRol.disabled = false;
                    btnConfirmarRol.innerHTML = '<i class="fas fa-check me-1"></i>Confirmar';
                    alert('Error de comunicación.');
                });
        });
    }

    if (btnBuscar) {
        btnBuscar.addEventListener('click', function () {
            var filtro = inputFiltro ? inputFiltro.value.trim() : '';
            cargarUsuarios(filtro);
        });
    }

    if (inputFiltro) {
        inputFiltro.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                cargarUsuarios(this.value.trim());
            }
        });
    }

    if (btnLimpiar) {
        btnLimpiar.addEventListener('click', function () {
            if (inputFiltro) inputFiltro.value = '';
            cargarUsuarios('');
        });
    }

    if (btnRefrescar) {
        btnRefrescar.addEventListener('click', function () {
            var filtro = inputFiltro ? inputFiltro.value.trim() : '';
            cargarUsuarios(filtro);
        });
    }

    cargarUsuarios('');
});
