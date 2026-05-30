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
        mostrarAlerta("⚠️ Ingrese número de cuenta y nombre del titular", true);
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
            <div class="col-12 col-md-6 mb-3">
                <div class="metodo-card p-3 d-flex align-items-center justify-content-between">
                    <div class="d-flex align-items-center gap-3">
                        ${imgTag}
                        <div>
                            <span class="bank-badge ${badge} mb-1">${m.entidad}</span>
                            <h6 class="m-0 fw-bold">${m.titular}</h6>
                            <small class="text-muted">${m.numero}</small>
                        </div>
                    </div>
                    <div class="d-flex gap-1">
                        <button class="btn btn-light btn-sm" onclick="editarMetodo(${index})"><i class="bi bi-pencil"></i></button>
                        <button class="btn btn-light btn-sm text-danger" onclick="eliminarFila(${index})"><i class="bi bi-trash"></i></button>
                    </div>
                </div>
            </div>`;

        previewHTML += `
            <div class="col-6 text-center mb-3">
                <div class="p-2 border rounded bg-light">
                    ${previewTag}
                    <p class="small fw-bold m-0" style="font-size:10px;">${m.entidad}</p>
                    <p class="text-muted m-0" style="font-size:9px;">${m.numero}</p>
                </div>
            </div>`;
    });

    lista.innerHTML = listaHTML;
    preview.innerHTML = previewHTML;
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