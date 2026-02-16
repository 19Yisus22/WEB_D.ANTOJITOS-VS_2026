const catalogoContainer = document.getElementById("catalogoProductos");
const btnFiltrar = document.getElementById("btnFiltrar");
const searchInput = document.getElementById("searchInput");
const toastContainer = document.getElementById("toastContainer");

let postres = [];
let indexActual = null;
let isUpdating = false;

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
            setTimeout(() => { window.location.href = "/"; }, 4000);
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

function showMessage(msg, isError = false) {
    if (!toastContainer) return;
    const toast = document.createElement('div');
    toast.className = 'custom-toast';
    toast.innerHTML = `
        <div class="d-flex align-items-center">
            <i class="bi ${isError ? 'bi-x-circle text-danger' : 'bi-check-circle text-success'} me-3 fs-5"></i>
            <span>${msg}</span>
        </div>
        <i class="bi bi-x-lg ms-3 btn-close-toast" style="cursor:pointer; font-size: 0.7rem;"></i>
    `;
    toastContainer.appendChild(toast);
    const remove = () => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(-20px)';
        setTimeout(() => toast.remove(), 400);
    };
    toast.querySelector('.btn-close-toast').onclick = remove;
    setTimeout(remove, 3500);
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
        console.error("Error en sincronización:", error);
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

        card.querySelector(".card").onclick = () => abrirModalPostre(index);

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
    setInterval(() => cargarPostres(true), 5000);

    if (btnAgregarPostre) {
        btnAgregarPostre.addEventListener("click", () => {
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
        btnEliminar.onclick = async () => {
            if (indexActual === null) return;
            const p = postres[indexActual];
            if (!confirm(`¿Eliminar ${p.nombre}? Esta acción no se puede deshacer.`)) return;
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
            showMessage("Prodcuto guardado exitosamente");
        } else {
            const errorData = await res.json();
            showMessage(errorData.error || "Error", true);
        }
    } catch (e) {
        showMessage("Error de red", true);
    }
}

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/static/js/workers/service-worker-catalogo.js')
        .then(() => { console.log('SW Operativo'); })
        .catch(() => { console.log('SW Fallo'); });
    });
}