document.addEventListener('DOMContentLoaded', function () {

    var AGENTES    = ['ResNet', 'CNN', 'KMeans', 'IsolationForest', 'Keras'];
    var ES_MEDICO  = (window.USER_ROL || '') === 'MEDICO';
    var ES_PACIENTE = (window.USER_ROL || '') === 'PACIENTE';

    var panelDetalle        = document.getElementById('panel-detalle-resultado');
    var contenedorMetricas  = document.getElementById('contenedor-metricas');
    var listadoResultadosDB = document.getElementById('listado-resultados-db');
    var panelListaLocal     = document.getElementById('panel-lista-local');
    var panelHistorial      = document.getElementById('panel-historial-entrenamiento');
    var panelVacio          = document.getElementById('panel-estado-vacio');
    var formBusqueda        = document.getElementById('form-busqueda-cedula');
    var btnLimpiar          = document.getElementById('btn-limpiar-busqueda');

    function ocultarMetricas() {
        contenedorMetricas && contenedorMetricas.classList.add('d-none');
    }

    function mostrarMetricas() {
        contenedorMetricas && contenedorMetricas.classList.remove('d-none');
    }

    function ocultarVacio() {
        panelVacio && panelVacio.classList.add('d-none');
    }

    function mostrarVacio() {
        panelVacio && panelVacio.classList.remove('d-none');
    }

    function crearBadgePatologia(pat) {
        var mapa = { MALIGNA: 'badge-maligna', BENIGNA: 'badge-benigna', NORMAL: 'badge-normal' };
        var cls  = mapa[(pat || '').toUpperCase()] || 'badge-normal';
        return '<span class="badge-patologia ' + cls + '">' + (pat || 'N/D') + '</span>';
    }

    function formatearFecha(iso) {
        if (!iso) return 'N/D';
        var d = new Date(iso);
        if (isNaN(d)) return iso;
        return d.toLocaleDateString('es-CO', { year: 'numeric', month: 'short', day: '2-digit' }) +
               ' ' + d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
    }

    function pct(val) {
        if (val === null || val === undefined || val === '') return 'N/D';
        return (parseFloat(val) * 100).toFixed(1) + '%';
    }

    function spinner(msg) {
        return '<div class="text-center text-muted py-5"><div class="spinner-border spinner-border-sm me-2"></div>' + (msg || 'Cargando...') + '</div>';
    }

    function barraProgreso(valor, color) {
        var v  = parseFloat(valor) || 0;
        var bg = color || (v >= 50 ? '#ef4444' : '#10b981');
        return '<div class="progress-custom"><div class="progress-bar" role="progressbar" style="width:' + v + '%;background:' + bg + ' !important;border-radius:9999px;height:100%;"></div></div>';
    }

    function infoMeta(label, value) {
        return '<div class="col-6 col-md-4 col-lg-3"><div class="info-meta-item"><span class="info-meta-label">' + label + '</span><span class="info-meta-value">' + (value || 'N/D') + '</span></div></div>';
    }

    function construirTablaResultados(items) {
        var html = '<div class="app-table-container"><table class="tabla-resultados w-100"><thead><tr>' +
            '<th>Fecha</th><th>Modelo IA</th><th>Patología</th><th>Prob. Malignidad</th>' +
            '<th>Estado análisis</th><th>Verificado</th><th class="text-center">Acciones</th>' +
            '</tr></thead><tbody>';
        items.forEach(function (item) {
            var pred = item.prediccion || {};
            var rep  = item.reporte   || {};
            var linea = item.linea    || {};
            var rid  = rep.id  || '';
            var pid  = pred.id || '';
            var probVal     = pred.probabilidad_malignidad;
            var probDisplay = probVal !== null && probVal !== undefined
                ? '<strong class="' + (parseFloat(probVal) >= 0.5 ? 'text-danger' : 'text-success') + '">' + pct(probVal) + '</strong>'
                : 'N/D';
            var btnEliminar = ES_PACIENTE ? '' :
                '<button class="btn btn-sm btn-outline-danger btn-eliminar-resultado ms-1" data-rid="' + rid + '"><i class="fas fa-trash-alt me-1"></i>Eliminar</button>';
            html += '<tr data-reporte-id="' + rid + '" data-pred-id="' + pid + '">' +
                '<td class="text-nowrap">' + formatearFecha(rep.creado_en) + '</td>' +
                '<td><span class="badge-agente">' + (pred.modelo_nombre || 'N/D') + '</span></td>' +
                '<td>' + crearBadgePatologia(pred.patologia_predicha) + '</td>' +
                '<td>' + probDisplay + '</td>' +
                '<td><span class="badge-estado estado-' + (linea.estado || 'pendiente').toLowerCase() + '">' + (linea.estado || 'PENDIENTE') + '</span></td>' +
                '<td>' + (rep.esta_verificado ? '<span class="text-success fw-semibold">&#10003; Sí</span>' : '<span class="text-muted">&#8212; No</span>') + '</td>' +
                '<td class="text-center" style="white-space:nowrap;">' +
                    '<button class="btn btn-sm btn-outline-primary btn-ver-resultado" data-rid="' + rid + '" data-pid="' + pid + '"><i class="fas fa-eye me-1"></i>Ver</button>' +
                    btnEliminar +
                '</td></tr>';
        });
        html += '</tbody></table></div>';
        return html;
    }

    function cargarResultadosDB(cedula) {
        if (!listadoResultadosDB) return;
        ocultarVacio();
        ocultarMetricas();
        listadoResultadosDB.innerHTML = spinner('Buscando resultados para cédula ' + cedula + '...');

        fetch('/api/resultados?cedula=' + encodeURIComponent(cedula))
            .then(function (r) { return r.json(); })
            .then(function (data) {
                var items = Array.isArray(data) ? data : (data.resultados || []);
                if (!items.length) {
                    listadoResultadosDB.innerHTML =
                        '<div class="card shadow-sm border-0 main-results-card p-4 text-center">' +
                        '<div class="empty-state-icon mb-3"><i class="fas fa-search text-muted"></i></div>' +
                        '<p class="text-muted mb-0">No se encontraron resultados para la cédula <strong>' + cedula + '</strong>.</p></div>';
                    return;
                }
                var titulo = ES_PACIENTE
                    ? 'Mi historial de escaneos'
                    : 'Resultados para cédula <strong>' + cedula + '</strong>';
                var cabecera = '<div class="card shadow-sm mb-4 border-0 main-results-card"><div class="card-body p-4">' +
                    '<div class="d-flex align-items-center justify-content-between mb-3">' +
                    '<h5 class="detail-section-title mb-0"><i class="fas fa-list-alt me-2"></i>' + titulo + '</h5>' +
                    '<span class="badge bg-secondary-subtle text-secondary-emphasis fs-6 font-monospace">' + items.length + ' registros</span>' +
                    '</div>';
                listadoResultadosDB.innerHTML = cabecera + construirTablaResultados(items) + '</div></div>';

                listadoResultadosDB.querySelectorAll('.btn-ver-resultado').forEach(function (btn) {
                    btn.addEventListener('click', function () {
                        cargarDetalle(this.dataset.rid, this.dataset.pid);
                    });
                });
                if (!ES_PACIENTE) {
                    listadoResultadosDB.querySelectorAll('.btn-eliminar-resultado').forEach(function (btn) {
                        btn.addEventListener('click', function () {
                            eliminarResultadoDB(this.dataset.rid, this.closest('tr'));
                        });
                    });
                }
            })
            .catch(function () {
                listadoResultadosDB.innerHTML = '<div class="alert alert-danger rounded-4 border-0 shadow-sm">Error al consultar la base de datos. Verifique su conexión.</div>';
            });
    }

    function cargarDetalle(reporteId, predId) {
        if (!panelDetalle) return;
        mostrarMetricas();
        panelDetalle.innerHTML = spinner('Cargando detalle del resultado...');
        panelDetalle.scrollIntoView({ behavior: 'smooth', block: 'start' });

        fetch('/api/detalle_resultado?reporte_id=' + encodeURIComponent(reporteId || '') + '&pred_id=' + encodeURIComponent(predId || ''))
            .then(function (r) { return r.json(); })
            .then(function (d) { renderDetalle(d); })
            .catch(function () {
                panelDetalle.innerHTML = '<div class="alert alert-danger rounded-4 border-0 shadow-sm">Error al cargar el detalle.</div>';
            });
    }

    function renderDetalle(d) {
        var pred    = d.prediccion || {};
        var rep     = d.reporte   || {};
        var linea   = d.linea     || {};
        var imagen  = d.imagen    || {};
        var estudio = d.estudio   || {};
        var paciente = d.paciente || {};
        var usuario  = d.usuario  || {};

        var probMal = pred.probabilidad_malignidad !== undefined ? parseFloat(pred.probabilidad_malignidad) * 100 : null;
        var probBen = probMal !== null ? (100 - probMal).toFixed(1) : null;
        probMal = probMal !== null ? probMal.toFixed(1) : null;

        var filtros = {};
        try {
            filtros = typeof linea.parametros_filtros_reduccion_ruido === 'string'
                ? JSON.parse(linea.parametros_filtros_reduccion_ruido)
                : (linea.parametros_filtros_reduccion_ruido || {});
        } catch (e) { filtros = {}; }

        var cajasStr = '';
        try {
            var cajas = typeof pred.cajas_delimitadoras_cnn === 'string'
                ? JSON.parse(pred.cajas_delimitadoras_cnn)
                : (pred.cajas_delimitadoras_cnn || []);
            cajasStr = cajas.slice(0, 8).map(function (c, i) {
                return '<li class="list-group-item px-0 py-1 border-0 text-muted" style="font-size:.82rem;">Caja ' + (i + 1) + ': [' + (Array.isArray(c) ? c.join(', ') : JSON.stringify(c)) + ']</li>';
            }).join('');
        } catch (e) {}

        var centroidesStr = '';
        try {
            var cents = typeof pred.centroides_kmeans === 'string'
                ? JSON.parse(pred.centroides_kmeans)
                : (pred.centroides_kmeans || []);
            centroidesStr = cents.slice(0, 8).map(function (c, i) {
                return '<li class="list-group-item px-0 py-1 border-0 text-muted" style="font-size:.82rem;">Centroide ' + (i + 1) + ': [' + (Array.isArray(c) ? c.join(', ') : JSON.stringify(c)) + ']</li>';
            }).join('');
        } catch (e) {}

        var filtrosStr = Object.keys(filtros).map(function (k) {
            return '<li class="list-group-item px-0 py-1 border-0 text-muted" style="font-size:.82rem;"><strong>' + k + ':</strong> ' + filtros[k] + '</li>';
        }).join('');

        var nota = rep.notas_clinicas || '';

        var pdfLink = rep.ruta_pdf_almacenamiento
            ? '<a href="/api/descargar_pdf?reporte_id=' + (rep.id || '') + '" class="btn btn-sm btn-success" target="_blank"><i class="fas fa-file-pdf me-1"></i>Descargar PDF</a>'
            : '<span class="text-muted" style="font-size:.85rem;">PDF no disponible</span>';

        var botonesAccion = '<div class="d-flex gap-2 flex-wrap">' +
            '<button class="btn btn-sm btn-outline-secondary" id="btn-cerrar-detalle"><i class="fas fa-times me-1"></i>Cerrar</button>' +
            pdfLink;

        if (!ES_PACIENTE) {
            botonesAccion +=
                '<button class="btn btn-sm btn-primary" id="btn-enviar-correo" data-rid="' + (rep.id || '') + '" data-pid="' + (pred.id || '') + '" data-correo="' + (usuario.correo || '') + '">' +
                '<i class="fas fa-envelope me-1"></i>Enviar correo</button>';
        }
        botonesAccion += '</div>';

        var html =
            '<div class="card shadow-sm border-0 main-results-card mb-4"><div class="card-body p-4">' +
            '<div class="d-flex align-items-center justify-content-between mb-4 flex-wrap gap-2">' +
            '<h5 class="detail-section-title mb-0"><i class="fas fa-microscope me-2"></i>Detalle del resultado</h5>' +
            botonesAccion +
            '</div>' +

            '<h6 class="text-muted fw-bold mb-3" style="font-size:.8rem;text-transform:uppercase;letter-spacing:.05em;">Paciente y estudio</h6>' +
            '<div class="row g-3 mb-4">' +
            infoMeta('Cédula', paciente.cedula || usuario.cedula) +
            infoMeta('Nombre', usuario.nombre_completo) +
            infoMeta('Correo', usuario.correo) +
            infoMeta('Sexo', paciente.sexo) +
            infoMeta('Fecha nacimiento', paciente.fecha_nacimiento) +
            infoMeta('Fecha estudio', formatearFecha(estudio.fecha_estudio)) +
            infoMeta('Tipo imagen', imagen.tipo_imagen) +
            infoMeta('Tiempo análisis', linea.tiempo_ejecucion_segundos ? linea.tiempo_ejecucion_segundos + ' seg' : null) +
            infoMeta('UID estudio', '<span style="font-size:.78rem;word-break:break-all;">' + (estudio.uid_instancia_estudio || 'N/D') + '</span>') +
            '</div>' +

            '<div class="row g-4 mb-4">' +
            '<div class="col-md-4"><div class="metric-card p-4 rounded-4">' +
            '<div class="metric-icon bg-light-primary mb-2"><i class="fas fa-robot"></i></div>' +
            '<h3>Modelo IA</h3><div class="metric-value" style="font-size:1.2rem;">' + (pred.modelo_nombre || 'N/D') + '</div>' +
            '</div></div>' +
            '<div class="col-md-4"><div class="metric-card p-4 rounded-4">' +
            '<div class="metric-icon bg-light-danger mb-2"><i class="fas fa-dna"></i></div>' +
            '<h3>Patología predicha</h3><div class="metric-value">' + crearBadgePatologia(pred.patologia_predicha) + '</div>' +
            '</div></div>' +
            '<div class="col-md-4"><div class="metric-card p-4 rounded-4">' +
            '<div class="metric-icon bg-light-warning mb-2"><i class="fas fa-percent"></i></div>' +
            '<h3>Prob. malignidad</h3><div class="metric-value ' + (probMal !== null && parseFloat(probMal) >= 50 ? 'text-danger' : 'text-success') + '">' + (probMal !== null ? probMal + '%' : 'N/D') + '</div>' +
            '</div></div>' +
            '</div>' +

            (probMal !== null ?
            '<div class="row g-3 mb-4">' +
            '<div class="col-md-6"><div class="probability-box prob-maligno-box p-3 rounded-3">' +
            '<div class="d-flex justify-content-between mb-2"><span class="fw-semibold text-danger">Maligno</span><span class="fw-bold text-danger">' + probMal + '%</span></div>' +
            barraProgreso(probMal, '#ef4444') +
            '</div></div>' +
            '<div class="col-md-6"><div class="probability-box prob-benigno-box p-3 rounded-3">' +
            '<div class="d-flex justify-content-between mb-2"><span class="fw-semibold text-success">Benigno / Normal</span><span class="fw-bold text-success">' + probBen + '%</span></div>' +
            barraProgreso(probBen, '#10b981') +
            '</div></div>' +
            '</div>' : '') +

            '<div class="row g-4 mb-4">' +
            '<div class="col-md-6"><div class="info-detail-card p-4 rounded-4 h-100">' +
            '<h6 class="detail-section-title mb-3">Cajas delimitadoras (CNN)</h6>' +
            (cajasStr ? '<ul class="list-group list-group-flush">' + cajasStr + '</ul>' : '<p class="text-muted" style="font-size:.88rem;">Sin datos de cajas.</p>') +
            '<h6 class="detail-section-title mt-4 mb-3">Centroides (K-Means)</h6>' +
            (centroidesStr ? '<ul class="list-group list-group-flush">' + centroidesStr + '</ul>' : '<p class="text-muted" style="font-size:.88rem;">Sin datos de centroides.</p>') +
            '</div></div>' +
            '<div class="col-md-6"><div class="info-detail-card p-4 rounded-4 h-100">' +
            '<h6 class="detail-section-title mb-3">Parámetros filtros / reducción de ruido</h6>' +
            (filtrosStr ? '<ul class="list-group list-group-flush">' + filtrosStr + '</ul>' : '<p class="text-muted" style="font-size:.88rem;">Sin parámetros registrados.</p>') +
            (linea.registros_preprocesamiento ?
                '<h6 class="detail-section-title mt-4 mb-2">Preprocesamiento</h6><pre class="text-muted" style="font-size:.8rem;white-space:pre-wrap;">' + linea.registros_preprocesamiento + '</pre>' : '') +
            '</div></div>' +
            '</div>' +

            (nota ?
            '<div class="nota-clinica-wrapper mb-4">' +
            '<div class="nota-label"><i class="fas fa-notes-medical me-1"></i>Nota clínica</div>' +
            '<div id="nota-clinica-resultado" style="font-size:.93rem;color:#78350f;line-height:1.6;white-space:pre-wrap;">' + nota + '</div>' +
            '</div>' : '') +

            '<div class="row g-3 mb-2">' +
            infoMeta('Verificado', rep.esta_verificado ? '<span class="text-success">Sí</span>' : '<span class="text-muted">No</span>') +
            infoMeta('Estado análisis', '<span class="badge-estado estado-' + (linea.estado || 'pendiente').toLowerCase() + '">' + (linea.estado || 'N/D') + '</span>') +
            infoMeta('Reporte PDF', pdfLink) +
            '</div>' +

            '</div></div>';

        panelDetalle.innerHTML = html;

        var btnCerrar = document.getElementById('btn-cerrar-detalle');
        if (btnCerrar) btnCerrar.addEventListener('click', function () {
            ocultarMetricas();
            panelDetalle.innerHTML = '';
        });

        var btnEnviar = document.getElementById('btn-enviar-correo');
        if (btnEnviar) {
            btnEnviar.addEventListener('click', function () {
                var rid         = this.dataset.rid;
                var pid         = this.dataset.pid;
                var correo      = this.dataset.correo;
                var correoInput = prompt('Correo destino:', correo || '');
                if (!correoInput || !correoInput.trim()) return;
                this.disabled = true;
                this.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Enviando...';
                var btn = this;
                fetch('/api/enviar_correo', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ reporte_id: rid, pred_id: pid, correo_destino: correoInput.trim() })
                })
                    .then(function (r) { return r.json(); })
                    .then(function (data) {
                        btn.disabled = false;
                        btn.innerHTML = '<i class="fas fa-envelope me-1"></i>Enviar correo';
                        if (data.ok) {
                            alert('Correo enviado correctamente a ' + data.correo);
                        } else {
                            alert('Error al enviar: ' + (data.error || 'Error desconocido'));
                        }
                    })
                    .catch(function () {
                        btn.disabled = false;
                        btn.innerHTML = '<i class="fas fa-envelope me-1"></i>Enviar correo';
                        alert('Error de comunicación al enviar el correo.');
                    });
            });
        }
    }

    function eliminarResultadoDB(reporteId, filaEl) {
        if (!confirm('¿Eliminar este resultado de la base de datos? Esta acción no se puede deshacer.')) return;
        fetch('/api/eliminar_resultado', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reporte_id: reporteId })
        })
            .then(function (r) { return r.json(); })
            .then(function (data) {
                if (data.ok) {
                    filaEl && filaEl.remove();
                    ocultarMetricas();
                    if (panelDetalle) panelDetalle.innerHTML = '';
                    var tbody = listadoResultadosDB && listadoResultadosDB.querySelector('tbody');
                    if (tbody && !tbody.querySelector('tr')) {
                        listadoResultadosDB.innerHTML = '<div class="card shadow-sm border-0 main-results-card p-4 text-center"><p class="text-muted mb-0">No quedan resultados para esta cédula.</p></div>';
                    }
                } else {
                    alert(data.error || 'No se pudo eliminar el resultado.');
                }
            })
            .catch(function () { alert('Error de comunicación al eliminar.'); });
    }

    function cargarArchivosLocales() {
        if (!panelListaLocal) return;
        panelListaLocal.innerHTML = spinner('Cargando archivos locales...');
        fetch('/api/archivos_locales')
            .then(function (r) { return r.json(); })
            .then(function (data) {
                var archivos = Array.isArray(data) ? data : (data.archivos || []);
                if (!archivos.length) {
                    panelListaLocal.innerHTML = '<p class="text-muted text-center py-2" style="font-size:.88rem;">No hay archivos en <code>uploads/reports</code>.</p>';
                    return;
                }
                var html = '<div class="app-table-container"><table class="tabla-resultados w-100"><thead><tr>' +
                    '<th>Nombre del archivo</th><th>Tamaño</th><th>Fecha modificación</th><th class="text-center">Eliminar</th>' +
                    '</tr></thead><tbody>';
                archivos.forEach(function (a) {
                    html += '<tr>' +
                        '<td style="font-size:.85rem;word-break:break-all;"><i class="fas fa-file-pdf text-danger me-2"></i>' + a.nombre + '</td>' +
                        '<td style="font-size:.85rem;">' + (a.tamanio || 'N/D') + '</td>' +
                        '<td style="font-size:.85rem;">' + formatearFecha(a.fecha) + '</td>' +
                        '<td class="text-center"><button class="btn btn-sm btn-outline-danger btn-eliminar-local" data-archivo="' + a.nombre + '"><i class="fas fa-trash-alt"></i></button></td>' +
                        '</tr>';
                });
                html += '</tbody></table></div>';
                panelListaLocal.innerHTML = html;
                panelListaLocal.querySelectorAll('.btn-eliminar-local').forEach(function (btn) {
                    btn.addEventListener('click', function () {
                        eliminarArchivoLocal(this.dataset.archivo, this.closest('tr'));
                    });
                });
            })
            .catch(function () {
                panelListaLocal.innerHTML = '<p class="text-muted" style="font-size:.88rem;">No se pudo cargar la lista de archivos locales.</p>';
            });
    }

    function eliminarArchivoLocal(nombre, filaEl) {
        if (!confirm('¿Eliminar el archivo "' + nombre + '" del almacenamiento local?')) return;
        fetch('/api/eliminar_archivo_local', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nombre: nombre })
        })
            .then(function (r) { return r.json(); })
            .then(function (data) {
                if (data.ok) {
                    filaEl && filaEl.remove();
                } else {
                    alert(data.error || 'No se pudo eliminar el archivo.');
                }
            })
            .catch(function () { alert('Error de comunicación al eliminar el archivo.'); });
    }

    function cargarHistorialEntrenamiento() {
        if (!panelHistorial) return;
        panelHistorial.innerHTML = spinner('Cargando historial de entrenamiento...');
        fetch('/api/historial_entrenamiento')
            .then(function (r) { return r.json(); })
            .then(function (data) {
                var porAgente = data.historial || {};
                var agentes   = data.agentes   || AGENTES;
                var hayDatos  = agentes.some(function (a) { return (porAgente[a] || []).length > 0; });
                if (!hayDatos) {
                    panelHistorial.innerHTML = '<p class="text-muted text-center py-3" style="font-size:.88rem;">Sin historial disponible. Suba un JSON de entrenamiento en el módulo de Entrenamiento.</p>';
                    return;
                }
                var html = '';
                var kerasData = porAgente['Keras'] || [];
                if (kerasData.length) html += bloqueHistorialKeras(kerasData);
                ['ResNet', 'CNN', 'IsolationForest', 'KMeans'].forEach(function (ag) {
                    var lista = porAgente[ag] || [];
                    if (lista.length) html += bloqueHistorialAgente(ag, lista);
                });
                panelHistorial.innerHTML = html || '<p class="text-muted text-center py-3">Sin métricas registradas.</p>';
            })
            .catch(function () {
                panelHistorial.innerHTML = '<p class="text-muted text-center py-3">No se pudo cargar el historial.</p>';
            });
    }

    function bloqueHistorialKeras(lista) {
        var html = '<div class="historial-agente-bloque mb-4">' +
            '<div class="historial-agente-header mb-3">' +
            '<span class="badge-agente badge-agente-keras">Keras / InceptionResNetV2</span>' +
            '<span class="historial-agente-label ms-2">Historial de entrenamiento por época</span>' +
            '</div>' +
            '<div class="app-table-container"><table class="tabla-resultados w-100"><thead><tr>' +
            '<th>#</th><th>Época</th><th>Pérdida</th><th>Accuracy</th><th>Val Loss</th><th>Val Accuracy</th><th>Archivo</th><th>Fecha</th>' +
            '</tr></thead><tbody>';
        lista.forEach(function (r, i) {
            var acc  = r.accuracy     !== undefined ? (parseFloat(r.accuracy) * 100).toFixed(2) + '%'     : 'N/D';
            var vacc = r.val_accuracy !== undefined ? (parseFloat(r.val_accuracy) * 100).toFixed(2) + '%' : 'N/D';
            html += '<tr>' +
                '<td class="text-muted">' + (i + 1) + '</td>' +
                '<td class="fw-bold">' + (r.epoch || 'N/D') + '</td>' +
                '<td class="font-monospace text-danger">' + (r.perdida !== undefined ? parseFloat(r.perdida).toFixed(4) : 'N/D') + '</td>' +
                '<td class="font-monospace text-success fw-semibold">' + acc + '</td>' +
                '<td class="font-monospace text-warning">' + (r.val_loss !== undefined ? parseFloat(r.val_loss).toFixed(4) : 'N/D') + '</td>' +
                '<td class="font-monospace fw-semibold">' + vacc + '</td>' +
                '<td class="text-muted" style="font-size:.78rem;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + (r.run || '') + '</td>' +
                '<td style="font-size:.78rem;">' + formatearFecha(r.fecha) + '</td>' +
                '</tr>';
        });
        html += '</tbody></table></div></div>';
        return html;
    }

    function bloqueHistorialAgente(ag, lista) {
        var clsMap = { ResNet: 'resnet', CNN: 'cnn', KMeans: 'kmeans', IsolationForest: 'isolation' };
        var cls    = clsMap[ag] || 'resnet';
        var esProb = ag === 'ResNet' || ag === 'CNN';
        var html = '<div class="historial-agente-bloque mb-4">' +
            '<div class="historial-agente-header mb-3">' +
            '<span class="badge-agente badge-agente-' + cls + '">' + ag + '</span>' +
            '<span class="historial-agente-label ms-2">Valores por muestra de entrenamiento</span>' +
            '</div>' +
            '<div class="app-table-container"><table class="tabla-resultados w-100"><thead><tr>' +
            '<th># Muestra</th>' +
            (esProb ? '<th>Probabilidad</th>' : '<th>Valor</th>') +
            '<th>Etiqueta</th><th>Prob. malignidad</th><th>Archivo</th><th>Fecha</th>' +
            '</tr></thead><tbody>';
        lista.slice(0, 100).forEach(function (r) {
            var val        = r.valor;
            var valDisplay = val !== null && val !== undefined
                ? (esProb ? (parseFloat(val) * 100).toFixed(2) + '%' : val)
                : 'N/D';
            var probM = r.probabilidad_malignidad !== undefined && r.probabilidad_malignidad !== null
                ? (parseFloat(r.probabilidad_malignidad) * 100).toFixed(1) + '%'
                : 'N/D';
            html += '<tr>' +
                '<td class="font-monospace text-muted">' + (r.id_muestra || 'N/D') + '</td>' +
                '<td class="font-monospace fw-semibold ' + (esProb && parseFloat(val) >= 0.5 ? 'text-danger' : esProb ? 'text-success' : '') + '">' + valDisplay + '</td>' +
                '<td>' + crearBadgePatologia(r.label) + '</td>' +
                '<td class="font-monospace">' + probM + '</td>' +
                '<td class="text-muted" style="font-size:.78rem;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + (r.run || '') + '</td>' +
                '<td style="font-size:.78rem;">' + formatearFecha(r.fecha) + '</td>' +
                '</tr>';
        });
        html += '</tbody></table></div></div>';
        return html;
    }

    if (formBusqueda) {
        formBusqueda.addEventListener('submit', function (e) {
            e.preventDefault();
            var inp    = document.getElementById('input-busqueda-cedula');
            var cedula = inp ? inp.value.trim() : '';
            if (!cedula) { inp && inp.focus(); return; }
            ocultarMetricas();
            if (panelDetalle) panelDetalle.innerHTML = '';
            cargarResultadosDB(cedula);
        });
    }

    if (btnLimpiar) {
        btnLimpiar.addEventListener('click', function () {
            var inp = document.getElementById('input-busqueda-cedula');
            if (inp) inp.value = '';
            listadoResultadosDB && (listadoResultadosDB.innerHTML = '');
            ocultarMetricas();
            if (panelDetalle) panelDetalle.innerHTML = '';
            mostrarVacio();
        });
    }

    if (ES_PACIENTE && window.USER_CEDULA) {
        ocultarVacio();
        cargarResultadosDB(window.USER_CEDULA);
    } else if (!ES_PACIENTE) {
        cargarArchivosLocales();
        cargarHistorialEntrenamiento();
    }
});
