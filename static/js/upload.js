document.addEventListener('DOMContentLoaded', function () {
    var formularioEscaneo = document.getElementById('form-escaneo');
    if (!formularioEscaneo) {
        var notaGuardada = sessionStorage.getItem('dermaia_nota_clinica');
        if (notaGuardada) {
            var contenedor = document.getElementById('nota-clinica-resultado') ||
                             document.querySelector('[data-nota-clinica-resultado]');
            if (contenedor) {
                contenedor.textContent = notaGuardada;
                var bloque = document.getElementById('nota-clinica-bloque');
                if (bloque) bloque.classList.remove('d-none');
                sessionStorage.removeItem('dermaia_nota_clinica');
            }
        }
        return;
    }

    var inputCedula    = document.getElementById('input-cedula');
    var inputCorreo    = document.getElementById('input-correo');
    var btnEscanear    = document.getElementById('btn-escanear');
    var cedulaHint     = document.getElementById('cedula-hint');
    var cedulaFeedback = document.getElementById('cedula-feedback');
    var cedulaValidada = false;
    var debounceTimer  = null;

    function marcarInput(input, valido) {
        if (!input) return;
        input.classList.toggle('is-valid-db', !!valido);
        input.classList.toggle('is-invalid-db', !valido);
    }

    function resetCorreo() {
        if (!inputCorreo) return;
        inputCorreo.value = '';
        inputCorreo.classList.remove('is-valid-db', 'is-invalid-db', 'correo-autocompletado');
    }

    function setBotonEstado(valido) {
        if (!btnEscanear) return;
        btnEscanear.disabled = !valido;
        if (cedulaHint) cedulaHint.style.display = valido ? 'none' : '';
    }

    setBotonEstado(false);

    if (inputCedula) {
        inputCedula.addEventListener('input', function () {
            var cedula = this.value.trim();
            cedulaValidada = false;
            resetCorreo();
            setBotonEstado(false);
            clearTimeout(debounceTimer);

            if (!cedula) {
                this.classList.remove('is-valid-db', 'is-invalid-db');
                if (cedulaFeedback) cedulaFeedback.textContent = '';
                return;
            }

            if (cedulaFeedback) {
                cedulaFeedback.textContent = 'Verificando cedula...';
                cedulaFeedback.style.color = '#6b7280';
            }

            debounceTimer = setTimeout(function () {
                fetch('/verificar_cedula?cedula=' + encodeURIComponent(cedula))
                    .then(function (r) { return r.json(); })
                    .then(function (data) {
                        marcarInput(inputCedula, data.existe);
                        cedulaValidada = !!data.existe;
                        setBotonEstado(cedulaValidada);

                        if (data.existe) {
                            if (cedulaFeedback) {
                                cedulaFeedback.textContent = 'Cedula verificada correctamente.';
                                cedulaFeedback.style.color = '#10b981';
                            }
                            fetch('/obtener_perfil/' + encodeURIComponent(cedula))
                                .then(function (r) { return r.json(); })
                                .then(function (perfil) {
                                    var correo = perfil && perfil.usuario && perfil.usuario.correo;
                                    if (correo && inputCorreo) {
                                        inputCorreo.value = correo;
                                        marcarInput(inputCorreo, true);
                                        inputCorreo.classList.add('correo-autocompletado');
                                    }
                                })
                                .catch(function () {});
                        } else {
                            if (cedulaFeedback) {
                                cedulaFeedback.textContent = 'Cedula no encontrada. Debe registrar al paciente primero.';
                                cedulaFeedback.style.color = '#ef4444';
                            }
                        }
                    })
                    .catch(function () {
                        inputCedula.classList.remove('is-valid-db', 'is-invalid-db');
                        cedulaValidada = false;
                        setBotonEstado(false);
                        if (cedulaFeedback) {
                            cedulaFeedback.textContent = 'Error al verificar. Intente nuevamente.';
                            cedulaFeedback.style.color = '#ef4444';
                        }
                    });
            }, 500);
        });
    }

    var ETAPAS_AGENTES = [
        'Preprocesando (CLAHE + reduccion de ruido)',
        'ResNet-50: extrayendo caracteristicas',
        'CNN: segmentando regiones de interes',
        'IsolationForest: detectando anomalias',
        'KMeans: clasificando clusters'
    ];

    var simTimer  = null;
    var simActiva = false;

    function iniciarSimulacion(numImagenes, bar, text) {
        simActiva = true;
        var totalPasos = numImagenes * ETAPAS_AGENTES.length;
        var pasoActual = 0;
        var BASE       = 32;
        var RANGO      = 58;
        var delayPaso  = Math.max(180, Math.round(1400 / Math.max(numImagenes, 1)));

        function avanzarPaso() {
            if (!simActiva) return;

            if (pasoActual < totalPasos) {
                var imgIdx = Math.floor(pasoActual / ETAPAS_AGENTES.length);
                var agIdx  = pasoActual % ETAPAS_AGENTES.length;
                var etapa  = ETAPAS_AGENTES[agIdx];
                var pct    = Math.round(BASE + (pasoActual / totalPasos) * RANGO);
                var sufijo = numImagenes > 1 ? ' - Imagen ' + (imgIdx + 1) + '/' + numImagenes : '';

                if (bar)  bar.style.width  = pct + '%';
                if (text) text.textContent = etapa + sufijo;

                pasoActual++;
                simTimer = setTimeout(avanzarPaso, delayPaso);
            } else {
                var fasesFinales = [
                    [92, 'Calculando ensemble: ResNet x0.40 + CNN x0.35 + IsolationForest x0.15 + KMeans x0.10'],
                    [95, 'Generando reporte medico y guardando predicciones en base de datos...'],
                    [98, 'Finalizando - preparando vista de resultados...']
                ];
                var fi = 0;
                function pasarFase() {
                    if (!simActiva) return;
                    if (fi < fasesFinales.length) {
                        if (bar)  bar.style.width  = fasesFinales[fi][0] + '%';
                        if (text) text.textContent = fasesFinales[fi][1];
                        fi++;
                        simTimer = setTimeout(pasarFase, 750);
                    }
                }
                pasarFase();
            }
        }

        simTimer = setTimeout(avanzarPaso, 250);
    }

    function detenerSimulacion() {
        simActiva = false;
        if (simTimer) clearTimeout(simTimer);
    }

    formularioEscaneo.addEventListener('submit', function (event) {
        event.preventDefault();

        var cedula        = inputCedula ? inputCedula.value.trim() : '';
        var inputArchivos = formularioEscaneo.querySelector('[name="archivos[]"]');
        var numImagenes   = inputArchivos ? inputArchivos.files.length : 0;

        var archivosValidos = numImagenes > 0 &&
            Array.from(inputArchivos.files).every(function (f) {
                return /\.(png|jpg|jpeg|dcm|tif|tiff|bmp|gif)$/i.test(f.name);
            });

        if (!cedula) {
            alert('Ingrese la cedula del paciente.');
            if (inputCedula) inputCedula.focus();
            return;
        }
        if (!cedulaValidada) {
            alert('La cedula no existe en el sistema. Registre al paciente primero.');
            if (inputCedula) inputCedula.focus();
            return;
        }
        if (numImagenes === 0) {
            alert('Seleccione al menos una imagen medica.');
            return;
        }
        if (!archivosValidos) {
            alert('Solo se admiten formatos DICOM, PNG, JPG, JPEG, TIFF, BMP y GIF.');
            return;
        }

        var notaInput = document.getElementById('input-notas') ||
                        formularioEscaneo.querySelector('[name="notas_clinicas"]');
        var notaValor = notaInput ? notaInput.value.trim() : '';
        if (notaValor) {
            sessionStorage.setItem('dermaia_nota_clinica', notaValor);
        } else {
            sessionStorage.removeItem('dermaia_nota_clinica');
        }

        var overlay  = document.getElementById('upload-overlay');
        var bar      = document.getElementById('upload-overlay-bar');
        var text     = document.getElementById('upload-overlay-text');
        var formData = new FormData(formularioEscaneo);
        var xhr      = new XMLHttpRequest();

        xhr.open('POST', formularioEscaneo.action || window.location.pathname, true);
        xhr.responseType = 'document';

        xhr.upload.addEventListener('progress', function (e) {
            if (e.lengthComputable && !simActiva) {
                var pct = Math.max(2, Math.round((e.loaded / e.total) * 30));
                if (bar)  bar.style.width  = pct + '%';
                if (text) text.textContent = 'Subiendo ' + numImagenes +
                    (numImagenes === 1 ? ' imagen' : ' imagenes') + ' - ' + pct + '%';
            }
        });

        xhr.upload.addEventListener('load', function () {
            if (bar)  bar.style.width  = '31%';
            if (text) text.textContent = 'Carga completada. Iniciando analisis con agentes de IA...';
            iniciarSimulacion(numImagenes, bar, text);
        });

        xhr.addEventListener('load', function () {
            detenerSimulacion();
            if (bar)  bar.style.width  = '100%';
            if (text) text.textContent = 'Analisis completo. Cargando resultados...';

            setTimeout(function () {
                if (xhr.status >= 200 && xhr.status < 300) {
                    var html = xhr.response.documentElement.outerHTML;
                    document.open();
                    document.write(html);
                    document.close();
                    setTimeout(function () {
                        var notaPost = sessionStorage.getItem('dermaia_nota_clinica');
                        if (notaPost) {
                            var el = document.getElementById('nota-clinica-resultado') ||
                                     document.querySelector('[data-nota-clinica-resultado]');
                            if (el) {
                                el.textContent = notaPost;
                                var bloquePost = document.getElementById('nota-clinica-bloque');
                                if (bloquePost) bloquePost.classList.remove('d-none');
                                sessionStorage.removeItem('dermaia_nota_clinica');
                            }
                        }
                    }, 200);
                } else {
                    alert('Error en el procesamiento. Verifique los datos e intente de nuevo.');
                    if (overlay) overlay.style.display = 'none';
                }
            }, 400);
        });

        xhr.addEventListener('error', function () {
            detenerSimulacion();
            if (overlay) overlay.style.display = 'none';
            alert('Error de comunicacion con el servidor. Revise su conexion.');
        });

        if (overlay) overlay.style.display = 'flex';
        if (bar)  bar.style.width  = '2%';
        if (text) text.textContent = 'Conectando con el servidor clinico...';

        xhr.send(formData);
    });
});
