let metodosPagoArray = [];
let editIndex = -1;
let audioCtx = null;

const IMG_DEFAULT = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAJQAAACUCAYAAAB1OacDAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAJBSURBVHgB7d0xbhNREIDh90YpSClpSInS06ByAnp6SByBk9ByAnp6ChonSInS06ByApSClpSClpSChv9vYScbe9be9Xp3Z76Pst6stZun8f72zZunMREp6vUf97ZOfn64fP9scfH+mYgG9fbt+6f7n8/vXrz6eC6isfrz5p8mIkW9e/dhIu6IKOp8+SyiqPP7DyIa9PHe2XfTjMREpKgzmYh9Ihp0/vEisS+isfrtHxEfXkU06uXFpyciGrW9efZ0Ihp0t3k6EQ26ubqbiCtiIjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIynL17/wEunS4O3C+hNwAAAABJRU5ErkJggg==";

document.addEventListener('DOMContentLoaded', async () => {
    const acceso = await verificarAccesoAdmin();
    if (!acceso) return;

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
                    document.getElementById('previewPagoImg').src = e.target.result; 
                };
                reader.readAsDataURL(optimizedFile);
            }
        });
    }

    const btnGuardar = document.getElementById('btnGuardarPagos');
    if (btnGuardar) btnGuardar.addEventListener('click', guardarCambiosPagos);

    const btnAgregar = document.getElementById('btnAgregarTemporal');
    if (btnAgregar) btnAgregar.addEventListener('click', agregarMetodoPago);

    document.addEventListener('click', () => initAudioContext(), { once: true });
});

async function verificarAccesoAdmin() {
    try {
        const res = await fetch("/facturacion_page", {
            headers: { 'X-Requested-With': 'XMLHttpRequest' }
        });
        
        if (res.status === 401 || res.status === 403) {
            document.body.innerHTML = `
                <div style="position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: #000; color: #fff; z-index: 99999; display: flex; align-items: center; justify-content: center; font-family: sans-serif;">
                    <div style="text-align: center; border: 1px solid #222; padding: 3rem; border-radius: 24px; background: #080808; box-shadow: 0 20px 50px rgba(0,0,0,0.5); max-width: 450px; width: 90%;">
                        <i class="bi bi-shield-lock-fill" style="font-size: 5rem; color: #ff4757; display: block; margin-bottom: 1.5rem; animation: pulse 2s infinite;"></i>
                        <h2 style="font-weight: 800; letter-spacing: -1px; margin-bottom: 0.5rem;">ACCESO RESTRINGIDO</h2>
                        <p style="color: #666; font-size: 1rem; margin-bottom: 2rem;">Este módulo requiere privilegios de administrador.</p>
                        <div class="spinner-border text-danger mb-4" role="status" style="width: 2.5rem; height: 2.5rem;"></div>
                        <br>
                        <i><small style="color: #555;">Redirigiendo...</small></i>
                        <br><br>
                        <button onclick="window.location.href='/inicio'" class="btn btn-danger w-100 py-2 fw-bold" style="border-radius: 12px;">VOLVER AL PANEL</button>
                    </div>
                </div>
                <style>
                    @keyframes pulse { 0% { opacity: 1; transform: scale(1); } 50% { opacity: 0.6; transform: scale(1.05); } 100% { opacity: 1; transform: scale(1); } }
                </style>`;
            setTimeout(() => { window.location.href = "/inicio"; }, 3500);
            return false;
        }
        return true;
    } catch (e) {
        return false;
    }
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
        if (isError) {
            oscillator.type = 'sawtooth';
            oscillator.frequency.setValueAtTime(300, audioCtx.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.2);
            gainNode.gain.setValueAtTime(0.05, audioCtx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3);
            oscillator.start();
            oscillator.stop(audioCtx.currentTime + 0.3);
        } else {
            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(1000, audioCtx.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(500, audioCtx.currentTime + 0.1);
            gainNode.gain.setValueAtTime(0.04, audioCtx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
            oscillator.start();
            oscillator.stop(audioCtx.currentTime + 0.15);
        }
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
    } catch (e) {}
}

function showMessage(msg, isError = false) {
    playNotificationSound(isError);
    let container = document.getElementById('toastContainer');
    if (!container) {
        container = document.createElement("div");
        container.id = "toastContainer";
        document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.className = 'custom-toast';
    const color = isError ? "#ff4757" : "#d35400";
    const icon = isError ? 'bi-exclamation-triangle-fill' : 'bi-check-circle-fill';
    
    toast.style.borderLeft = `6px solid ${color}`;
    toast.innerHTML = `
        <div class="toast-content">
            <div class="toast-icon-wrapper" style="color: ${color}">
                <i class="bi ${icon}"></i>
            </div>
            <div class="toast-text">
                <div class="toast-main-text">${msg}</div>
            </div>
        </div>
    `;
    container.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('hide');
        setTimeout(() => toast.remove(), 500);
    }, 4000);
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
                    const optimizedFile = new File([blob], file.name, {
                        type: "image/jpeg",
                        lastModified: Date.now()
                    });
                    actualizarIndicadorEspacio(blob.size);
                    resolve(optimizedFile);
                }, "image/jpeg", QUALITY);
            };
        };
    });
}

function actualizarIndicadorEspacio(nuevoTamanoBytes = 0) {
    const limiteTotal = 5 * 1024 * 1024;
    let usado = 0;
    try {
        const datosCargados = JSON.stringify(metodosPagoArray);
        usado = new Blob([datosCargados]).size + nuevoTamanoBytes;
    } catch (e) {
        usado = nuevoTamanoBytes;
    }
    const restante = Math.max(0, limiteTotal - usado);
    const porcentaje = (usado / limiteTotal) * 100;
    const infoEspacio = document.getElementById('infoEspacioAlmacenamiento');
    if (infoEspacio) {
        const restanteMB = (restante / (1024 * 1024)).toFixed(2);
        infoEspacio.innerHTML = `
            <div class="mt-3 p-3 border rounded bg-white shadow-sm" style="animation: slideInUp 0.4s ease;">
                <div class="d-flex justify-content-between mb-2">
                    <small class="fw-bold text-dark">ALMACENAMIENTO DISPONIBLE</small>
                    <small class="text-muted fw-bold">${restanteMB} MB</small>
                </div>
                <div class="progress" style="height: 8px; border-radius: 10px; background: #eee;">
                    <div class="progress-bar ${porcentaje > 80 ? 'bg-danger' : 'bg-success'}" 
                         role="progressbar" style="width: ${porcentaje}%; transition: width 0.6s cubic-bezier(0.4, 0, 0.2, 1);"></div>
                </div>
            </div>`;
    }
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
            actualizarIndicadorEspacio();
        } catch (e) { metodosPagoArray = []; }
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
    actualizarIndicadorEspacio();
}

function renderizarLista() {
    const lista = document.getElementById('listaMetodosPago');
    const preview = document.getElementById('previewContenedorFinal');
    if (!lista || !preview) return;

    lista.innerHTML = "";
    preview.innerHTML = "";

    if (metodosPagoArray.length === 0) {
        lista.innerHTML = `<div class="col-12 text-center text-muted py-3"><i class="bi bi-inbox fs-4"></i><p class="mt-2 mb-0">No hay métodos de pago</p></div>`;
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
    document.getElementById('previewPagoImg').src = m.file ? URL.createObjectURL(m.file) : (m.url_actual || IMG_DEFAULT);

    const btn = document.getElementById('btnAgregarTemporal');
    btn.innerHTML = `<i class="bi bi-check-circle"></i> ACTUALIZAR EN LISTA`;
    btn.className = "btn btn-warning w-100 py-3 shadow-sm";
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function eliminarFila(index) {
    metodosPagoArray.splice(index, 1);
    if (editIndex === index) resetearFormulario();
    renderizarLista();
    actualizarIndicadorEspacio();
}

async function guardarCambiosPagos() {
    const btn = document.getElementById('btnGuardarPagos');
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
    document.getElementById('previewPagoImg').src = IMG_DEFAULT;
    const btn = document.getElementById('btnAgregarTemporal');
    btn.innerHTML = `<i class="bi bi-node-plus-fill"></i> Agregar a Lista`;
    btn.className = "btn btn-primary w-100 py-3 shadow-sm";
}

function getBadgeClass(entidad) {
    const map = { 'Nequi': 'nequi-bg', 'Daviplata': 'daviplata-bg', 'Bancolombia': 'bancolombia-bg', 'NuBank': 'nubank-bg' };
    return map[entidad] || 'bg-secondary text-white';
}

(function() {
    window.history.pushState(null, "", window.location.href);
    window.onpopstate = function() {
        window.history.pushState(null, "", window.location.href);
    };
    window.onpageshow = function(event) {
        if (event.persisted || (window.performance && window.performance.navigation.type === 2)) {
            window.location.reload();
        }
    };
})();

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/static/js/workers/service-worker-zona_pagos.js')
        .then(() => console.log('SW OK'))
        .catch(() => console.log('SW Error'));
    });
}