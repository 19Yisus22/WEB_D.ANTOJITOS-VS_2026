let metodosPagoArray = [];
let editIndex = -1;
let audioCtx = null;

const IMG_DEFAULT = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAJQAAACUCAYAAAB1OacDAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAJBSURBVHgB7d0xbhNREIDh90YpSClpSInS06ByAnp6SByBk9ByAnp6ChonSInS06ByApSClpSClpSChv9vYScbe9be9Xp3Z76Pst6stZun8f72zZunMREp6vUf97ZOfn64fP9scfH+mYgG9fbt+6f7n8/vXrz6eC6isfrz5p8mIkW9e/dhIu6IKOp8+SyiqPP7DyIa9PHe2XfTjMREpKgzmYh9Ihp0/vEisS+isfrtHxEfXkU06uXFpyciGrW9efZ0Ihp0t3k6EQ26ubqbiCtiIjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIynL17/wEunS4O3C+hNwAAAABJRU5ErkJggg==";

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
        container.style.cssText = "position: fixed; top: 20px; right: 20px; z-index: 10000; display: flex; flex-direction: column; gap: 10px;";
        document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    const color = isError ? "#ff4757" : "#00b894";
    const icon = isError ? 'bi-exclamation-triangle-fill' : 'bi-check-circle-fill';
    toast.style.cssText = `
        background: #121212; color: white; padding: 12px 20px; border-radius: 10px;
        display: flex; align-items: center; min-width: 300px; border-left: 5px solid ${color};
        box-shadow: 0 5px 15px rgba(0,0,0,0.3); transition: 0.3s; transform: translateX(120%);
    `;
    toast.innerHTML = `
        <i class="bi ${icon} me-3" style="color: ${color}; font-size: 1.2rem;"></i>
        <div class="flex-grow-1" style="font-size: 0.9rem;">${msg}</div>
    `;
    container.appendChild(toast);
    setTimeout(() => { toast.style.transform = "translateX(0)"; }, 10);
    setTimeout(() => {
        toast.style.transform = "translateX(120%)";
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

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
                        <p style="color: #666; font-size: 1rem; margin-bottom: 2rem;">Este módulo requiere privilegios de administrador. Tu sesión será redirigida.</p>
                        <div class="spinner-border text-danger mb-4" role="status" style="width: 2.5rem; height: 2.5rem;"></div>
                        <br>
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

document.addEventListener('DOMContentLoaded', async () => {
    const acceso = await verificarAccesoAdmin();
    if (!acceso) return;

    cargarMetodosDesdeHTML();

    const archivoQR = document.getElementById('archivoQR');
    const previewImg = document.getElementById('previewPagoImg');
    if (archivoQR) {
        archivoQR.addEventListener('change', function() {
            if (this.files && this.files[0]) {
                const reader = new FileReader();
                reader.onload = (e) => { previewImg.src = e.target.result; };
                reader.readAsDataURL(this.files[0]);
            }
        });
    }

    const btnGuardar = document.getElementById('btnGuardarPagos');
    if (btnGuardar) btnGuardar.addEventListener('click', guardarCambiosPagos);
    
    const btnAgregar = document.getElementById('btnAgregarTemporal');
    if (btnAgregar) btnAgregar.addEventListener('click', agregarMetodoPago);

    document.addEventListener('click', () => initAudioContext(), { once: true });
});

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
}

function renderizarLista() {
    const lista = document.getElementById('listaMetodosPago');
    const preview = document.getElementById('previewContenedorFinal');
    if (!lista || !preview) return;
    
    lista.innerHTML = "";
    preview.innerHTML = "";
    
    metodosPagoArray.forEach((m, index) => {
        const imgSrc = m.file ? URL.createObjectURL(m.file) : (m.url_actual || IMG_DEFAULT);
        const badge = getBadgeClass(m.entidad);
        
        lista.innerHTML += `
            <div class="col-12 col-md-6">
                <div class="metodo-card p-3 d-flex align-items-center justify-content-between border rounded bg-white shadow-sm">
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
            <div class="col-6 text-center">
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
    renderizarLista();
    if (editIndex === index) resetearFormulario();
}

async function guardarCambiosPagos() {
    const btn = document.getElementById('btnGuardarPagos');
    if (metodosPagoArray.length === 0) return showMessage("La lista está vacía", true);
    
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
    document.getElementById('previewPagoImg').src = "https://via.placeholder.com/200?text=Subir+QR";
    const btn = document.getElementById('btnAgregarTemporal');
    btn.innerHTML = `<i class="bi bi-node-plus-fill"></i> Agregar a Lista`;
    btn.className = "btn btn-primary w-100 py-3 shadow-sm";
}

function getBadgeClass(entidad) {
    const map = { 'Nequi': 'nequi-bg', 'Daviplata': 'daviplata-bg', 'Bancolombia': 'bancolombia-bg', 'NuBank': 'nubank-bg' };
    return map[entidad] || 'bg-secondary text-white';
}

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/static/js/workers/service-worker-zona_pagos.js')
        .then(() => console.log('SW OK'))
        .catch(() => console.log('SW Error'));
    });
}