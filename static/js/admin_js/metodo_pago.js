let metodosPagoArray = [];
let editIndex = -1;
let audioCtx = null;

const IMG_DEFAULT = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAJQAAACUCAYAAAB1OacDAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAJBSURBVHgB7d0xbhNREIDh90YpSClpSInS06ByAnp6SByBk9ByAnp6ChonSInS06ByApSClpSClpSChv9vYScbe9be9Xp3Z76Pst6stZun8f72zZunMREp6vUf97ZOfn64fP9scfH+mYgG9fbt+6f7n8/vXrz6eC6isfrz5p8mIkW9e/dhIu6IKOp8+SyiqPP7DyIa9PHe2XfTjMREpKgzmYh9Ihp0/vEisS+isfrtHxEfXkU06uXFpyciGrW9efZ0Ihp0t3k6EQ26ubqbiCtiIjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIynL17/wEunS4O3C+hNwAAAABJRU5ErkJggg==";

async function actualizarAlmacenamiento() {
    try {
        const timestamp = new Date().getTime();
        const res = await fetch(`/cloudinary_storage_info?t=${timestamp}`, {
            method: 'GET',
            headers: {
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache'
            }
        });

        if (!res.ok) return;

        const data = await res.json();
        const circle = document.getElementById("storageCircle");
        const text = document.getElementById("storageText");

        if (circle && text) {
            const used = parseFloat(data.used_gb);
            const limit = parseFloat(data.limit_gb);

            let percent = (used / limit) * 100;
            if (used > 0 && percent < 0.5) percent = 0.5;

            let usedLabel;
            if (used < 0.1) {
                usedLabel = (used * 1024).toFixed(2) + " MB";
            } else {
                usedLabel = used.toFixed(2) + " GB";
            }

            const circumference = 125.66;
            const offset = circumference - (percent / 100 * circumference);
            circle.style.strokeDashoffset = offset;

            text.textContent = `${usedLabel} / ${limit.toFixed(1)} GB (${percent.toFixed(2)}%)`;

            circle.style.stroke = percent > 85 ? "#dc3545" : percent > 60 ? "#ffc107" : "#28a745";
        }
    } catch (e) {}
}

function showStorageDetails() {
    const text = document.getElementById("storageText");
    if (text) {
        alert(`Detalles del Almacenamiento:\n${text.textContent}`);
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    const acceso = await verificarAccesoAdmin();
    if (!acceso) return;
    const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    const tooltipList = tooltipTriggerList.map(function (tooltipTriggerEl) {
        return new bootstrap.Tooltip(tooltipTriggerEl);
    });
    await actualizarAlmacenamiento();
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

async function verificarAccesoAdmin() {
    try {
        const res = await fetch("/facturacion_page", {
            headers: { 'X-Requested-With': 'XMLHttpRequest' }
        });
        if (res.status === 401 || res.status === 403) {
            window.location.href = "/inicio";
            return false;
        }
        return true;
    } catch (e) {
        return false;
    }
}

async function actualizarAlmacenamiento() {
    try {
        const timestamp = new Date().getTime();
        const res = await fetch(`/cloudinary_storage_info?t=${timestamp}`);
        if (!res.ok) return;

        const data = await res.json();
        const progress = document.getElementById("storageProgressBar");
        const text = document.getElementById("storageText");

        if (progress && text) {
            const used = parseFloat(data.used_gb);
            const limit = parseFloat(data.limit_gb);
            let percent = (used / limit) * 100;

            if (used > 0 && percent < 0.5) percent = 0.5;

            let usedLabel = used < 0.1 ? (used * 1024).toFixed(2) + " MB" : used.toFixed(2) + " GB";

            progress.style.width = percent.toFixed(2) + "%";
            text.textContent = `${usedLabel} / ${limit.toFixed(1)} GB (${((used / limit) * 100).toFixed(2)}%)`;

            progress.classList.remove("bg-success", "bg-warning", "bg-danger");
            if (percent > 85) progress.classList.add("bg-danger");
            else if (percent > 60) progress.classList.add("bg-warning");
            else progress.classList.add("bg-success");
        }
    } catch (e) {}
}

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

function showMessage(msg, isError = false) {
    mostrarAlerta(msg, isError);
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
        showMessage("Ingrese número y titular", true);
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
        showMessage("Lista actualizada");
    } else {
        metodosPagoArray.push(datos);
        showMessage("Agregado a la lista");
    }
    resetearFormulario();
    renderizarLista();
}

function renderizarLista() {
    const lista = document.getElementById('listaMetodosPago');
    const preview = document.getElementById('previewContenedorFinal');
    if (!lista || !preview) return;

    lista.innerHTML = "";
    preview.innerHTML = "";

    if (metodosPagoArray.length === 0) {
        lista.innerHTML = `<div class="col-12 text-center text-muted py-3"><p class="mt-2 mb-0">No hay métodos de pago</p></div>`;
        return;
    }

    metodosPagoArray.forEach((m, index) => {
        const imgSrc = m.file ? URL.createObjectURL(m.file) : (m.url_actual || IMG_DEFAULT);
        const badge = getBadgeClass(m.entidad);

        lista.innerHTML += `
            <div class="col-12 col-md-6 mb-3">
                <div class="metodo-card p-3 d-flex align-items-center justify-content-between">
                    <div class="d-flex align-items-center gap-3">
                        <img src="${imgSrc}" style="width:50px; height:50px; object-fit:cover;" class="rounded border">
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

        preview.innerHTML += `
            <div class="col-6 text-center mb-3">
                <div class="p-2 border rounded bg-light">
                    <img src="${imgSrc}" class="img-fluid rounded mb-1" style="max-height:80px; object-fit:contain;">
                    <p class="small fw-bold m-0" style="font-size:10px;">${m.entidad}</p>
                    <p class="text-muted m-0" style="font-size:9px;">${m.numero}</p>
                </div>
            </div>`;
    });
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
        previewImg.src = m.file ? URL.createObjectURL(m.file) : (m.url_actual || IMG_DEFAULT);
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
            showMessage("¡Configuración guardada!");
            await actualizarAlmacenamiento();
            setTimeout(() => location.reload(), 1500);
        } else {
            throw new Error(data.error);
        }
    } catch (e) {
        showMessage(e.message, true);
        btn.disabled = false;
        btn.innerHTML = `<i class="bi bi-cloud-upload"></i> Guardar Canales de Pago`;
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
