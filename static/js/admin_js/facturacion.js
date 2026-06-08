let metodosPagoArray = [];
let editIndex = -1;
let audioCtx = null;

const IMG_PLACEHOLDER_HTML = `<div style="width:50px;height:50px;display:flex;align-items:center;justify-content:center;background:#f8f9fa;border-radius:8px;border:1px solid #dee2e6;color:#adb5bd;font-size:1.2rem;"><i class="bi bi-image-slash"></i></div>`;

async function actualizarAlmacenamiento() {
    try {
        const res = await fetch(`/cloudinary_storage_info?t=${Date.now()}`);
        if (!res.ok) return;
        const data = await res.json();
        const circle = document.getElementById("storageCircle");
        const text = document.getElementById("storageText");
        if (!circle || !text) return;
        const used = parseFloat(data.used_gb) || 0;
        const limit = parseFloat(data.limit_gb) || 25;
        const percent = Math.min((used / limit) * 100, 100);
        const circumference = 2 * Math.PI * circle.r.baseVal.value;
        circle.style.strokeDasharray = `${circumference}`;
        circle.style.strokeDashoffset = circumference - (percent / 100) * circumference;
        const label = used < 0.1 ? (used * 1024).toFixed(1) + " MB" : used.toFixed(2) + " GB";
        text.textContent = `${label} / ${limit} GB`;
        const wrapper = document.getElementById("storageWrapper");
        if (wrapper) {
            const tooltipText = `Uso: ${label} / ${limit} GB (${percent.toFixed(1)}%)`;
            wrapper.setAttribute("title", tooltipText);
            const tooltip = bootstrap.Tooltip.getInstance(wrapper) || new bootstrap.Tooltip(wrapper);
            tooltip.setContent({ ".tooltip-inner": tooltipText });
        }
    } catch (e) {
        console.error("Error al obtener storage:", e);
    }
}

document.addEventListener('DOMContentLoaded', async () => {

    const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    tooltipTriggerList.map(function (tooltipTriggerEl) {
        return new bootstrap.Tooltip(tooltipTriggerEl);
    });

    await actualizarAlmacenamiento();
    setInterval(actualizarAlmacenamiento, 300000);

    cargarMetodosDesdeHTML();

    const archivoQR = document.getElementById('archivoQR');
    if (archivoQR) {
        archivoQR.addEventListener('change', async function() {
            if (this.files && this.files[0]) {
                const optimizedFile = await procesarImagenOptimizada(this.files[0]);

                const dt = new DataTransfer();
                dt.items.add(optimizedFile);
                this.files = dt.files;

                const reader = new FileReader();
                reader.onload = (e) => {
                    const previewImg = document.getElementById('previewPagoImg');
                    const placeholder = document.getElementById('placeholderQR');
                    if (previewImg) {
                        previewImg.src = e.target.result;
                        previewImg.classList.remove('d-none');
                    }
                    if (placeholder) placeholder.classList.add('d-none');
                };
                reader.readAsDataURL(optimizedFile);
            }
        });
    }

    document.getElementById('btnGuardarPagos')?.addEventListener('click', guardarCambiosPagos);
    document.getElementById('btnAgregarTemporal')?.addEventListener('click', agregarMetodoPago);
    document.addEventListener('click', () => initAudioContext(), { once: true });
});

async function procesarImagenOptimizada(file) {
    const MAX_WIDTH = 800;
    const QUALITY = 0.7;
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                if (width > MAX_WIDTH) {
                    height = Math.round((height * MAX_WIDTH) / width);
                    width = MAX_WIDTH;
                }
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                canvas.toBlob((blob) => {
                    resolve(new File([blob], file.name.split('.')[0] + ".jpg", {
                        type: "image/jpeg",
                        lastModified: Date.now()
                    }));
                }, "image/jpeg", QUALITY);
            };
        };
    });
}

function initAudioContext() {
    if (!audioCtx) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (AudioContextClass) audioCtx = new AudioContextClass();
    }
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
}

function playNotificationSound(isError = false) {
    try {
        initAudioContext();
        if (!audioCtx) return;
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        oscillator.type = isError ? 'sawtooth' : 'sine';
        oscillator.frequency.setValueAtTime(isError ? 300 : 1000, audioCtx.currentTime);
        gainNode.gain.setValueAtTime(0.04, audioCtx.currentTime);
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.15);
    } catch (e) {}
}

function cargarMetodosDesdeHTML() {
    const res = document.getElementById('metodos_iniciales_data');
    if (res && res.value && res.value !== 'None' && res.value !== '') {
        try {
            const data = JSON.parse(res.value);
            metodosPagoArray = data.map(m => ({
                entidad: m.entidad, tipo_cuenta: m.tipo_cuenta,
                numero: m.numero, titular: m.titular,
                url_actual: m.qr_url, cambio_img: false, file: null
            }));
            renderizarLista();
        } catch (e) {
            metodosPagoArray = [];
        }
    }
}

function agregarMetodoPago() {
    const entidad = document.getElementById('entidadBancaria').value;
    const tipo = document.getElementById('tipoCuenta').value;
    const numero = document.getElementById('numeroCuenta').value.trim();
    const titular = document.getElementById('titularCuenta').value.trim();
    const fileInput = document.getElementById('archivoQR');

    if (!numero || !titular) {
        mostrarAlerta("Ingrese número de cuenta y nombre del titular", true);
        return;
    }

    const file = fileInput.files[0];
    const datos = {
        entidad, tipo_cuenta: tipo, numero, titular,
        url_actual: editIndex !== -1 ? metodosPagoArray[editIndex].url_actual : "",
        cambio_img: !!file,
        file: file || (editIndex !== -1 ? metodosPagoArray[editIndex].file : null)
    };

    if (editIndex !== -1) {
        metodosPagoArray[editIndex] = datos;
        mostrarAlerta(`✏️ Método de pago "${datos.entidad}" actualizado en la lista`);
    } else {
        metodosPagoArray.push(datos);
        mostrarAlerta(`➕ "${datos.entidad}" agregado a la lista de métodos de pago`);
    }
    resetearFormulario();
    renderizarLista();
}

function renderizarLista() {
    const lista = document.getElementById('listaMetodosPago');
    const preview = document.getElementById('previewContenedorFinal');
    if (!lista || !preview) return;

    if (metodosPagoArray.length === 0) {
        lista.innerHTML = `<div class="col-12 text-center text-muted py-3"><p class="mt-2 mb-0">No hay métodos de pago</p></div>`;
        preview.innerHTML = "";
        return;
    }

    let listaHTML = '';
    let previewHTML = '';

    metodosPagoArray.forEach((m, index) => {
        const imgSrc = m.file ? URL.createObjectURL(m.file) : (m.url_actual || '');
        const badge = getBadgeClass(m.entidad);

        const imgTag = imgSrc
            ? `<img src="${imgSrc}" style="width:50px;height:50px;object-fit:cover;" class="rounded border"
                    onerror="this.style.display='none';this.insertAdjacentHTML('afterend','<div style=\\'width:50px;height:50px;display:flex;align-items:center;justify-content:center;background:#f8f9fa;border-radius:8px;border:1px solid #dee2e6;color:#adb5bd;\\'><i class=\\'bi bi-image-slash\\'></i></div>')">`
            : `<div style="width:50px;height:50px;display:flex;align-items:center;justify-content:center;background:#f8f9fa;border-radius:8px;border:1px solid #dee2e6;color:#adb5bd;font-size:1.2rem;"><i class="bi bi-image-slash"></i></div>`;

        const previewTag = imgSrc
            ? `<img src="${imgSrc}" class="img-fluid rounded mb-1" style="max-height:80px;object-fit:contain;"
                    onerror="this.style.display='none'">`
            : `<div style="height:80px;display:flex;align-items:center;justify-content:center;background:#f8f9fa;border-radius:6px;color:#adb5bd;"><i class="bi bi-image-slash fs-4"></i></div>`;

        listaHTML += `
            <div class="col-12 mb-2">
                <div class="metodo-card p-3 d-flex align-items-center w-100">
                    <div class="d-flex align-items-center gap-3 flex-grow-1">
                        ${imgTag}
                        <div>
                            <span class="bank-badge ${badge} mb-1">${m.entidad}</span>
                            <h6 class="m-0 fw-bold">${m.titular}</h6>
                            <small class="text-muted">${m.numero}</small>
                        </div>
                    </div>
                    <div class="d-flex gap-2 ms-auto flex-shrink-0">
                        <button class="btn btn-outline-secondary btn-sm px-3" onclick="editarMetodo(${index})"><i class="bi bi-pencil me-1"></i>Editar</button>
                        <button class="btn btn-outline-danger btn-sm px-3" onclick="eliminarFila(${index})"><i class="bi bi-trash me-1"></i>Eliminar</button>
                    </div>
                </div>
            </div>`;

        previewHTML += `
            <div class="invoice-metodo-card">
                <div class="invoice-metodo-header">${m.entidad}</div>
                <div class="invoice-metodo-body">
                    <div class="invoice-qr-wrap">
                        ${imgSrc
                            ? `<img src="${imgSrc}" alt="QR" onerror="this.style.display='none'">`
                            : `<div class="invoice-qr-placeholder"><i class="bi bi-qr-code-scan"></i></div>`}
                    </div>
                    <div class="invoice-metodo-info">
                        <p class="invoice-tipo">${m.tipo_cuenta || 'Cuenta'}</p>
                        <p class="invoice-titular">${m.titular}</p>
                        <div class="invoice-numero-row">
                            <span class="invoice-numero">${m.numero}</span>
                            <button class="invoice-copy-btn" onclick="navigator.clipboard.writeText('${m.numero}').then(()=>mostrarAlerta('Número copiado'))">
                                <i class="bi bi-copy"></i>
                            </button>
                        </div>
                    </div>
                </div>
            </div>`;
    });

    lista.innerHTML = listaHTML;

    const now  = new Date();
    const fecha = now.toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' });
    const num   = 'FAC-' + String(now.getFullYear()).slice(-2) + '-' + String(now.getMonth()+1).padStart(2,'0') + '-XXXX';

    preview.innerHTML = `
        <div class="invoice-preview-card">
            <div class="invoice-preview-header">
                <div class="invoice-preview-logo">
                    <img src="/static/uploads/logo.ico" alt="Logo" onerror="this.style.display='none'">
                    <span>D'Antojitos©</span>
                </div>
                <div class="invoice-preview-meta">
                    <div class="invoice-preview-num">${num}</div>
                    <div class="invoice-preview-date">${fecha}</div>
                    <span class="invoice-status-badge">${(t('state.Emitida') || 'EMITIDA').toUpperCase()}</span>
                </div>
            </div>

            <div class="invoice-preview-products">
                <div class="invoice-product-row">
                    <div>
                        <strong>Producto de muestra</strong>
                        <small>${t('cart.qty')}: 2</small>
                    </div>
                    <strong>$25.000</strong>
                </div>
                <div class="invoice-product-row">
                    <div>
                        <strong>Otro producto</strong>
                        <small>${t('cart.qty')}: 1</small>
                    </div>
                    <strong>$15.000</strong>
                </div>
            </div>

            <div class="invoice-preview-total">
                <span>${t('ord.total').toUpperCase()}</span>
                <strong>$65.000</strong>
            </div>

            <div class="invoice-preview-pay-title">
                <i class="bi bi-qr-code-scan me-2"></i>${t('pay.official')}
            </div>

            <div class="invoice-metodos-grid">
                ${previewHTML || `<p class="text-center text-muted small py-3">${t('pay.unavailable')}</p>`}
            </div>

            <div class="invoice-preview-footer">
                <i class="bi bi-info-circle-fill me-1 text-warning"></i>
                ${t('pay.send_receipt')} WhatsApp ${t('pay.send_or') || 'o'} ${t('state.email') || 'correo'} ${t('pay.after')}.
            </div>
        </div>`;
}

function editarMetodo(index) {
    const m = metodosPagoArray[index];
    editIndex = index;
    document.getElementById('entidadBancaria').value = m.entidad;
    document.getElementById('tipoCuenta').value = m.tipo_cuenta;
    document.getElementById('numeroCuenta').value = m.numero;
    document.getElementById('titularCuenta').value = m.titular;

    const previewImg = document.getElementById('previewPagoImg');
    const placeholder = document.getElementById('placeholderQR');

    if (previewImg) {
        previewImg.src = m.file ? URL.createObjectURL(m.file) : (m.url_actual || '');
        previewImg.classList.remove('d-none');
    }
    if (placeholder) placeholder.classList.add('d-none');

    const btn = document.getElementById('btnAgregarTemporal');
    if (btn) {
        btn.innerHTML = `<i class="bi bi-check-circle"></i> ACTUALIZAR EN LISTA`;
        btn.className = "btn btn-warning w-100 py-3 shadow-sm";
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function eliminarFila(index) {
    metodosPagoArray.splice(index, 1);
    if (editIndex === index) resetearFormulario();
    renderizarLista();
}

async function guardarCambiosPagos() {
    const btn = document.getElementById('btnGuardarPagos');
    if (!btn) return;

    btn.disabled = true;
    btn.innerHTML = `<span class="spinner-border spinner-border-sm"></span> GUARDANDO...`;

    const formData = new FormData();
    const metadata = metodosPagoArray.map(m => ({
        entidad: m.entidad, tipo_cuenta: m.tipo_cuenta,
        numero: m.numero, titular: m.titular,
        url_actual: m.url_actual, cambio_img: m.cambio_img
    }));

    formData.append("metadata_pagos", JSON.stringify(metadata));
    metodosPagoArray.forEach(m => {
        if (m.cambio_img && m.file) formData.append("imagenes_qr", m.file);
    });

    try {
        const res = await fetch("/facturacion_page", { method: "POST", body: formData });
        const data = await res.json();
        if (data.ok) {
            mostrarAlerta("💳 Métodos de pago guardados y publicados correctamente");
            await actualizarAlmacenamiento();
            setTimeout(() => location.reload(), 1500);
        } else {
            throw new Error(data.error);
        }
    } catch (e) {
        mostrarAlerta(e.message, true);
        btn.disabled = false;
        btn.innerHTML = `<i class="bi bi-cloud-arrow-up-fill"></i> Guardar Cambios en Servidor`;
    }
}

function resetearFormulario() {
    editIndex = -1;
    document.getElementById('numeroCuenta').value = "";
    document.getElementById('titularCuenta').value = "";
    document.getElementById('archivoQR').value = "";

    const previewImg = document.getElementById('previewPagoImg');
    const placeholder = document.getElementById('placeholderQR');
    const btn = document.getElementById('btnAgregarTemporal');

    if (previewImg) {
        previewImg.src = "";
        previewImg.classList.add('d-none');
    }
    if (placeholder) placeholder.classList.remove('d-none');
    if (btn) {
        btn.innerHTML = `<i class="bi bi-node-plus-fill"></i> Agregar a Lista`;
        btn.className = "btn btn-primary w-100 py-3 shadow-sm";
    }
}

function getBadgeClass(entidad) {
    const map = {
        'Nequi': 'nequi-bg',
        'Daviplata': 'daviplata-bg',
        'Bancolombia': 'bancolombia-bg',
        'NuBank': 'nubank-bg'
    };
    return map[entidad] || 'bg-secondary text-white';
}

(function() {
    window.history.pushState(null, "", window.location.href);
    window.onpopstate = function() {
        window.history.pushState(null, "", window.location.href);
    };
})();
