document.addEventListener('DOMContentLoaded', function () {
    var form      = document.getElementById('form-entrenamiento-json');
    var barWrap   = document.getElementById('train-progress-wrapper');
    var bar       = document.getElementById('train-overlay-bar');
    var text      = document.getElementById('train-overlay-text');
    var listado   = document.getElementById('listado-json-train');
    var btnRef    = document.getElementById('btn-refrescar-json');

    function spinner(msg) {
        return '<div class="text-center text-muted py-4"><div class="spinner-border spinner-border-sm me-2"></div>' + (msg || 'Cargando...') + '</div>';
    }

    function formatearFecha(iso) {
        if (!iso) return 'N/D';
        var d = new Date(iso);
        if (isNaN(d)) return iso;
        return d.toLocaleDateString('es-CO', { year: 'numeric', month: 'short', day: '2-digit' }) +
               ' ' + d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
    }

    function cargarListado() {
        if (!listado) return;
        listado.innerHTML = spinner('Cargando registros...');
        fetch('/api/json_entrenamientos')
            .then(function (r) { return r.json(); })
            .then(function (data) {
                if (!data.length) {
                    listado.innerHTML = '<p class="text-muted text-center py-4" style="font-size:.9rem;">No hay JSONs registrados. Sube un archivo para comenzar.</p>';
                    return;
                }
                var html = '<div class="app-table-container"><table class="tabla-json w-100"><thead><tr>' +
                    '<th>Nombre del archivo</th><th>Total registros</th><th>Fecha importación</th>' +
                    '<th class="text-center" style="width:80px;">Eliminar</th>' +
                    '</tr></thead><tbody>';
                data.forEach(function (item) {
                    html += '<tr data-id="' + item.id + '">' +
                        '<td><i class="fas fa-file-code text-warning me-2"></i>' +
                        '<span style="font-size:.88rem;">' + (item.nombre || 'sin nombre') + '</span></td>' +
                        '<td class="font-monospace text-secondary" style="font-size:.85rem;">' + (item.total_registros || '—') + '</td>' +
                        '<td style="font-size:.85rem;">' + formatearFecha(item.fecha) + '</td>' +
                        '<td class="text-center">' +
                        '<button class="btn btn-sm btn-outline-danger btn-eliminar-json" data-id="' + item.id + '" title="Eliminar">' +
                        '<i class="fas fa-trash-alt"></i></button>' +
                        '</td></tr>';
                });
                html += '</tbody></table></div>';
                listado.innerHTML = html;

                listado.querySelectorAll('.btn-eliminar-json').forEach(function (btn) {
                    btn.addEventListener('click', function () {
                        var id   = this.dataset.id;
                        var fila = this.closest('tr');
                        eliminarJson(id, fila);
                    });
                });
            })
            .catch(function () {
                listado.innerHTML = '<p class="text-danger text-center py-3" style="font-size:.88rem;">Error al cargar la lista. Verifique su conexión.</p>';
            });
    }

    function eliminarJson(id, filaEl) {
        if (!confirm('¿Eliminar este JSON de la base de datos? Esta acción no se puede deshacer.')) return;
        fetch('/api/eliminar_json_entrenamiento', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: id })
        })
            .then(function (r) { return r.json(); })
            .then(function (data) {
                if (data.ok) {
                    filaEl && filaEl.remove();
                    var tbody = listado && listado.querySelector('tbody');
                    if (tbody && !tbody.querySelector('tr')) {
                        listado.innerHTML = '<p class="text-muted text-center py-4" style="font-size:.9rem;">No hay JSONs registrados.</p>';
                    }
                } else {
                    alert(data.error || 'No se pudo eliminar el registro.');
                }
            })
            .catch(function () { alert('Error de comunicación al eliminar.'); });
    }

    if (form) {
        form.addEventListener('submit', function (event) {
            event.preventDefault();
            var archivo = form.querySelector('[name="json_file"]');
            if (!archivo || archivo.files.length === 0) {
                alert('Seleccione un archivo JSON para entrenamiento.');
                return;
            }
            if (!/\.json$/i.test(archivo.files[0].name)) {
                alert('El archivo debe tener extensión .json.');
                return;
            }

            if (barWrap) barWrap.classList.remove('d-none');
            if (bar)  bar.style.width  = '2%';
            if (text) text.textContent = 'Preparando carga...';

            var formData = new FormData(form);
            var xhr = new XMLHttpRequest();
            xhr.open('POST', form.action || window.location.pathname, true);

            xhr.upload.addEventListener('progress', function (e) {
                if (e.lengthComputable) {
                    var pct = Math.max(2, Math.round((e.loaded / e.total) * 80));
                    if (bar)  bar.style.width  = pct + '%';
                    if (text) text.textContent = 'Subiendo archivo: ' + pct + '%';
                }
            });

            xhr.upload.addEventListener('load', function () {
                if (bar)  bar.style.width  = '85%';
                if (text) text.textContent = 'Procesando JSON e iniciando entrenamiento en segundo plano...';
            });

            xhr.addEventListener('load', function () {
                if (bar)  bar.style.width  = '100%';
                if (text) text.textContent = 'Listo. Recargando...';
                setTimeout(function () { document.location.reload(); }, 600);
            });

            xhr.addEventListener('error', function () {
                if (barWrap) barWrap.classList.add('d-none');
                alert('Error de red durante la carga del archivo.');
            });

            xhr.send(formData);
        });
    }

    if (btnRef) {
        btnRef.addEventListener('click', function () { cargarListado(); });
    }

    cargarListado();
});
