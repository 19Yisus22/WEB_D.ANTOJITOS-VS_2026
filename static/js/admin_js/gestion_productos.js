const catalogoContainer = document.getElementById("catalogoProductos");
const btnFiltrar = document.getElementById("btnFiltrar");
const searchInput = document.getElementById("searchInput");
const toastContainer = document.getElementById("toastContainer");

let postres = [];
let indexActual = null;
let isUpdating = false;
let audioCtx = null;

const btnAgregarPostre = document.getElementById("btnAgregarPostre");
const btnCancelar = document.getElementById("btnCancelar");
const formAgregarPostre = document.getElementById("formAgregarPostre");
const agregarPostreForm = document.getElementById("agregarPostreForm");
const listaPostresDisponibles = document.getElementById("listaPostresDisponibles");
const listaPostresAgotados = document.getElementById("listaPostresAgotados");
const avisoAgotados = document.getElementById("avisoAgotados");
const modalElement = document.getElementById("modalPostre");
const modal = modalElement ? new bootstrap.Modal(modalElement) : null;
const btnSubmitForm = document.getElementById("btnSubmitForm");

function initAudioContext() {
    if (!audioCtx) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (AudioContextClass) audioCtx = new AudioContextClass();
    }
    if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
}

function playNotificationSound(type = 'default') {
    try {
        initAudioContext();
        if (!audioCtx) return;
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        if (type === 'error' || type === 'delete') {
            oscillator.type = 'sawtooth';
            oscillator.frequency.setValueAtTime(330, audioCtx.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(110, audioCtx.currentTime + 0.3);
            gainNode.gain.setValueAtTime(0.03, audioCtx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.4);
            oscillator.start();
            oscillator.stop(audioCtx.currentTime + 0.4);
        } else {
            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(880, audioCtx.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(440, audioCtx.currentTime + 0.1);
            gainNode.gain.setValueAtTime(0.05, audioCtx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
            oscillator.start();
            oscillator.stop(audioCtx.currentTime + 0.2);
        }
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
    } catch (e) {}
}

function showMessage(msg, isError = false) {
    if (!toastContainer) return;
    playNotificationSound(isError ? 'error' : 'default');
    
    const toast = document.createElement('div');
    const colorPrimario = isError ? "#ff4757" : "#2ed573";
    
    toast.style.cssText = `
        background: #121212;
        color: #ffffff;
        padding: 14px 18px;
        border-radius: 12px;
        box-shadow: 0 8px 25px rgba(0,0,0,0.5);
        display: flex;
        align-items: center;
        min-width: 320px;
        margin-bottom: 10px;
        border-left: 5px solid ${colorPrimario};
        transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        transform: translateX(120%);
        opacity: 0;
    `;

    toast.innerHTML = `
        <div class="d-flex align-items-center w-100">
            <div style="background: ${colorPrimario}22; width: 35px; height: 35px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                <i class="bi ${isError ? 'bi-x-circle-fill' : 'bi-check-circle-fill'}" style="color: ${colorPrimario};"></i>
            </div>
            <div class="ms-3 flex-grow-1">
                <strong style="display: block; font-size: 0.7rem; text-transform: uppercase; color: ${colorPrimario}; letter-spacing: 0.8px;">Sistema Admin</strong>
                <div style="font-size: 0.85rem; color: #f0f0f0;">${msg}</div>
            </div>
        </div>
    `;

    toastContainer.appendChild(toast);
    setTimeout(() => {
        toast.style.transform = "translateX(0)";
        toast.style.opacity = "1";
    }, 10);

    const remove = () => {
        toast.style.transform = "translateX(120%)";
        toast.style.opacity = "0";
        setTimeout(() => toast.remove(), 400);
    };

    setTimeout(remove, 3000);
}

function showConfirmToast(msg, callback) {
    if (!toastContainer) return;
    playNotificationSound('error');

    const t = document.createElement('div');
    t.style.cssText = `
        background: #1a1a1a;
        color: #ffffff;
        padding: 20px;
        border-radius: 15px;
        box-shadow: 0 10px 30px rgba(0,0,0,0.6);
        min-width: 320px;
        border-left: 5px solid #ffc107;
        margin-bottom: 10px;
        animation: slideInRight 0.3s ease forwards;
    `;

    t.innerHTML = `
        <div class="d-flex flex-column">
            <div class="d-flex align-items-start mb-3">
                <i class="bi bi-exclamation-triangle-fill text-warning me-3 fs-4"></i>
                <div>
                    <strong class="d-block" style="color: #ffc107;">Confirmar Acción</strong>
                    <span class="small text-white-50">${msg}</span>
                </div>
            </div>
            <div class="d-flex gap-2 justify-content-end">
                <button class="btn btn-sm btn-link text-white text-decoration-none btn-cancelar-confirm">Cancelar</button>
                <button class="btn btn-sm btn-warning fw-bold px-4 rounded-pill btn-aceptar-confirm">Confirmar</button>
            </div>
        </div>
    `;

    toastContainer.appendChild(t);

    t.querySelector('.btn-cancelar-confirm').onclick = () => {
        t.style.opacity = '0';
        setTimeout(() => t.remove(), 300);
    };

    t.querySelector('.btn-aceptar-confirm').onclick = () => {
        callback();
        t.remove();
    };
}

async function verificarAccesoAdmin() {
    try {
        const res = await fetch("/gestionar_productos");
        if (res.status === 401 || res.status === 403) {
            document.documentElement.innerHTML = `
                <head>
                    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
                    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.css">
                    <style>
                        body { background: #000; color: white; height: 100vh; display: flex; align-items: center; justify-content: center; font-family: sans-serif; overflow: hidden; }
                        .lock-box { text-align: center; border: 1px solid #333; padding: 3rem; border-radius: 20px; background: #0a0a0a; }
                        .shield-icon { font-size: 5rem; color: #ff4757; animation: pulse 2s infinite; }
                        @keyframes pulse { 0% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.1); opacity: 0.7; } 100% { transform: scale(1); opacity: 1; } }
                    </style>
                </head>
                <body>
                    <div class="lock-box shadow-lg">
                        <i class="bi bi-shield-slash-fill shield-icon"></i>
                        <h1 class="fw-bold mt-3">MÓDULO PROTEGIDO</h1>
                        <p class="text-secondary">Acceso administrativo requerido.</p>
                        <div class="spinner-border text-danger my-3" role="status"></div>
                        <br>
                        <button onclick="window.location.href='/'" class="btn btn-outline-danger mt-2 px-5">SALIR</button>
                    </div>
                </body>
            `;
            setTimeout(() => { window.location.href = "/"; }, 3000);
            return false;
        }
        return true;
    } catch (e) {
        return false;
    }
}

function ajustarAtributosPrecio() {
    const precioInput = document.getElementById("precioPostre");
    if (precioInput) {
        precioInput.setAttribute("step", "0.01");
        precioInput.setAttribute("min", "0");
    }
}

async function cargarPostres(silent = false) {
    if (isUpdating && !silent) return;
    isUpdating = true;
    try {
        const res = await fetch("/gestionar_productos", { cache: 'no-store' });
        if (!res.ok) return;
        const nuevosPostres = await res.json();
        const dataNueva = JSON.stringify(nuevosPostres);
        const dataVieja = JSON.stringify(postres);

        if (dataNueva !== dataVieja) {
            postres = nuevosPostres;
            localStorage.setItem('postresCache', dataNueva);
            renderPostres();
        }
    } catch (error) {
        console.error("Sync error");
    } finally {
        isUpdating = false;
    }
}

function renderPostres() {
    if (!listaPostresDisponibles || !listaPostresAgotados) return;
    listaPostresDisponibles.innerHTML = "";
    listaPostresAgotados.innerHTML = "";
    let hayAgotados = false;

    postres.forEach((p, index) => {
        const card = document.createElement("div");
        card.className = "col-md-4 col-sm-6 mb-3 d-flex align-items-stretch animate__animated animate__fadeIn";
        const imgUrl = p.imagen_url || "/static/uploads/default.png";
        const stockActual = parseInt(p.stock) || 0;
        const isAgotado = stockActual <= 0;
        
        card.innerHTML = `
        <div class="card w-100 cursor-pointer ${isAgotado ? 'opacity-75 grayscale' : ''}" data-id="${p.id_producto}">
            <div class="position-relative">
                <img src="${imgUrl}" class="card-img-top postre-img" alt="${p.nombre}" style="height: 200px; object-fit: cover;">
                ${isAgotado ? '<div class="position-absolute top-50 start-50 translate-middle badge bg-danger fs-6 shadow-lg">AGOTADO</div>' : ''}
            </div>
            <div class="card-body">
                <div class="d-flex justify-content-between align-items-start mb-1">
                    <h5 class="card-title mb-0 text-truncate" title="${p.nombre}">${p.nombre}</h5>
                    <span class="badge ${stockActual <= 5 ? 'bg-danger animate__animated animate__pulse animate__infinite' : 'bg-success'}">${stockActual}</span>
                </div>
                <p class="card-text fw-bold text-primary">${Number(p.precio).toLocaleString('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 })}</p>
                <small class="text-muted d-block">${p.categoria || 'Postre'}</small>
            </div>
        </div>`;

        card.querySelector(".card").onclick = () => {
            initAudioContext();
            abrirModalPostre(index);
        };

        if (!isAgotado) {
            listaPostresDisponibles.appendChild(card);
        } else {
            listaPostresAgotados.appendChild(card);
            hayAgotados = true;
        }
    });
    if (avisoAgotados) avisoAgotados.classList.toggle("d-none", !hayAgotados);
}

function abrirModalPostre(index) {
    indexActual = index;
    const p = postres[index];
    document.getElementById("modalNombre").textContent = p.nombre;
    document.getElementById("modalFoto").src = p.imagen_url || "/static/uploads/default.png";
    document.getElementById("modalDescripcion").textContent = p.descripcion || "Sin descripción disponible";
    document.getElementById("modalPrecio").textContent = Number(p.precio).toLocaleString('es-CO', { style: 'currency', currency: 'COP' });
    document.getElementById("modalStock").textContent = p.stock;
    if (modal) modal.show();
}

document.addEventListener("DOMContentLoaded", async () => {
    const tieneAcceso = await verificarAccesoAdmin();
    if (!tieneAcceso) return;

    ajustarAtributosPrecio();
    const cached = localStorage.getItem('postresCache');
    if (cached) {
        postres = JSON.parse(cached);
        renderPostres();
    }
    
    await cargarPostres();
    setInterval(() => cargarPostres(true), 3000);

    if (btnAgregarPostre) {
        btnAgregarPostre.addEventListener("click", () => {
            initAudioContext();
            indexActual = null;
            agregarPostreForm.reset();
            btnSubmitForm.innerHTML = '<i class="bi bi-check-lg me-2"></i>Guardar Nuevo Postre';
            formAgregarPostre.classList.remove("d-none");
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }

    if (btnCancelar) {
        btnCancelar.addEventListener("click", () => {
            formAgregarPostre.classList.add("d-none");
            agregarPostreForm.reset();
            indexActual = null;
        });
    }

    const btnEliminar = document.getElementById("btnEliminar");
    if (btnEliminar) {
        btnEliminar.onclick = () => {
            if (indexActual === null) return;
            const p = postres[indexActual];
            showConfirmToast(`¿Eliminar ${p.nombre}?`, async () => {
                try {
                    const res = await fetch(`/eliminar_producto/${p.id_producto}`, { method: "DELETE" });
                    if (res.ok) {
                        showMessage("Producto eliminado");
                        modal.hide();
                        await cargarPostres();
                    } else {
                        const err = await res.json();
                        showMessage(err.error || "Error al eliminar", true);
                    }
                } catch (e) {
                    showMessage("Error de conexión", true);
                }
            });
        };
    }

    const btnEditar = document.getElementById("btnEditar");
    if (btnEditar) {
        btnEditar.onclick = () => {
            if (indexActual === null) return;
            const p = postres[indexActual];
            document.getElementById("nombrePostre").value = p.nombre;
            document.getElementById("precioPostre").value = p.precio;
            document.getElementById("descripcionPostre").value = p.descripcion || "";
            document.getElementById("stockPostre").value = p.stock;
            btnSubmitForm.innerHTML = '<i class="bi bi-pencil-square me-2"></i>Actualizar Cambios';
            formAgregarPostre.classList.remove("d-none");
            modal.hide();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        };
    }
});

if (agregarPostreForm) {
    agregarPostreForm.onsubmit = async (e) => {
        e.preventDefault();
        const fileInput = document.getElementById("fotoPostre");
        const file = fileInput.files[0];
        const formData = new FormData();
        
        formData.append("nombre", document.getElementById("nombrePostre").value);
        formData.append("precio", document.getElementById("precioPostre").value);
        formData.append("descripcion", document.getElementById("descripcionPostre").value);
        formData.append("stock", document.getElementById("stockPostre").value);
        formData.append("categoria", "Postre");

        if (file) {
            const reader = new FileReader();
            reader.onloadend = async () => {
                formData.append("foto_base64", reader.result.split(",")[1]);
                formData.append("foto_name", file.name);
                await enviarFormulario(formData);
            };
            reader.readAsDataURL(file);
        } else {
            await enviarFormulario(formData);
        }
    };
}

async function enviarFormulario(formData) {
    const esEdicion = indexActual !== null;
    const metodo = esEdicion ? "PUT" : "POST";
    const url = esEdicion ? `/actualizar_producto/${postres[indexActual].id_producto}` : "/gestionar_productos";
    
    try {
        const res = await fetch(url, { method: metodo, body: formData });
        if (res.ok) {
            formAgregarPostre.classList.add("d-none");
            agregarPostreForm.reset();
            indexActual = null;
            await cargarPostres();
            showMessage("Producto guardado exitosamente");
        } else {
            const errorData = await res.json();
            showMessage(errorData.error || "Error", true);
        }
    } catch (e) {
        showMessage("Error de red", true);
    }
}

document.addEventListener("click", () => initAudioContext(), { once: true });

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/static/js/workers/service-worker-catalogo.js')
        .then(() => { console.log('SW Operativo'); })
        .catch(() => { console.log('SW Fallo'); });
    });
}