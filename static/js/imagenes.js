document.addEventListener('DOMContentLoaded', function () {
    var listado  = document.getElementById('listado-imagenes-local');
    var badge    = document.getElementById('img-count-badge');
    var btnRef   = document.getElementById('btn-refrescar-imgs');

    var IMG_EXTS = /\.(png|jpg|jpeg|gif|bmp|tif|tiff|dcm)$/i;

    function formatFecha(iso) {
        if (!iso) return 'N/D';
        var d = new Date(iso);
        if (isNaN(d)) return iso;
        return d.toLocaleDateString('es-CO', { year: 'numeric', month: 'short', day: '2-digit' }) +
               ' ' + d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
    }

    function spinner(msg) {
        return '<div class="text-center text-muted py-5"><div class="spinner-border spinner-border-sm me-2"></div>' + (msg || 'Cargando...') + '</div>';
    }

    function cargar() {
        if (!listado) return;
        listado.innerHTML = spinner('Cargando imagenes...');
        if (badge) badge.textContent = '';

        fetch('/api/imagenes_locales')
            .then(function (r) { return r.json(); })
            .then(function (data) {
                if (!data.length) {
                    if (badge) badge.textContent = '0 archivos';
                    listado.innerHTML = '<p class="text-muted text-center py-4" style="font-size:.9rem;">No hay imagenes almacenadas en <code>uploads/images</code>.</p>';
                    return;
                }
                if (badge) badge.textContent = data.length + ' archivo' + (data.length !== 1 ? 's' : '');

                var html = '<div class="app-table-container"><table class="tabla-resultados w-100"><thead><tr>' +
                    '<th style="width:50px;">Vista</th>' +
                    '<th>Nombre del archivo</th>' +
                    '<th>Tipo</th>' +
                    '<th>Tamaño</th>' +
                    '<th>Fecha modificación</th>' +
                    '<th class="text-center" style="width:80px;">Eliminar</th>' +
                    '</tr></thead><tbody>';

                data.forEach(function (item) {
                    var esImg = IMG_EXTS.test(item.nombre);
                    var isDcm = /\.dcm$/i.test(item.nombre);
                    var vistaHtml = isDcm
                        ? '<span class="badge bg-light text-secondary border" style="font-size:.7rem;">DICOM</span>'
                        : (esImg
                            ? '<img src="/uploads/images/' + encodeURIComponent(item.nombre) + '" style="width:40px;height:40px;object-fit:cover;border-radius:4px;" onerror="this.style.display=\'none\'">'
                            : '<i class="fas fa-file text-muted" style="font-size:1.3rem;"></i>');

                    var ext = (item.nombre.split('.').pop() || '').toUpperCase();
                    html += '<tr>' +
                        '<td class="text-center">' + vistaHtml + '</td>' +
                        '<td style="font-size:.85rem;word-break:break-all;">' + item.nombre + '</td>' +
                        '<td><span class="badge bg-light text-dark border" style="font-size:.75rem;">' + ext + '</span></td>' +
                        '<td style="font-size:.85rem;">' + (item.tamanio || 'N/D') + '</td>' +
                        '<td style="font-size:.85rem;">' + formatFecha(item.fecha) + '</td>' +
                        '<td class="text-center"><button class="btn btn-sm btn-outline-danger btn-eliminar-img" data-nombre="' + item.nombre + '" title="Eliminar"><i class="fas fa-trash-alt"></i></button></td>' +
                        '</tr>';
                });
                html += '</tbody></table></div>';
                listado.innerHTML = html;

                listado.querySelectorAll('.btn-eliminar-img').forEach(function (btn) {
                    btn.addEventListener('click', function () {
                        eliminar(this.dataset.nombre, this.closest('tr'));
                    });
                });
            })
            .catch(function () {
                listado.innerHTML = '<p class="text-danger text-center py-3" style="font-size:.88rem;">Error al cargar las imagenes.</p>';
            });
    }

    function eliminar(nombre, fila) {
        if (!confirm('Eliminar "' + nombre + '" del almacenamiento local?')) return;
        fetch('/api/eliminar_imagen_local', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nombre: nombre })
        })
            .then(function (r) { return r.json(); })
            .then(function (data) {
                if (data.ok) {
                    fila && fila.remove();
                    var tbody = listado && listado.querySelector('tbody');
                    var n = tbody ? tbody.querySelectorAll('tr').length : 0;
                    if (badge) badge.textContent = n + ' archivo' + (n !== 1 ? 's' : '');
                    if (!n) listado.innerHTML = '<p class="text-muted text-center py-4" style="font-size:.9rem;">No hay imagenes almacenadas.</p>';
                } else {
                    alert(data.error || 'No se pudo eliminar.');
                }
            })
            .catch(function () { alert('Error de comunicacion.'); });
    }

    if (btnRef) btnRef.addEventListener('click', cargar);
    cargar();
});
