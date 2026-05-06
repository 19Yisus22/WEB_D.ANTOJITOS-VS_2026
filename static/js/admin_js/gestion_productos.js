const toastContainer = document.getElementById("toastContainer");
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
const searchInput = document.getElementById("searchProductos");

let postres = [];
let indexActual = null;
let isUpdating = false;
let audioCtx = null;

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
    toast.className = "custom-toast";
    toast.style.borderLeftColor = colorPrimario;
    toast.innerHTML = `
        <div class="d-flex align-items-center w-100">
            <i class="bi ${isError ? 'bi-x-circle-fill' : 'bi-check-circle-fill'} me-3" style="color: ${colorPrimario}; font-size: 1.2rem;"></i>
            <div class="flex-grow-1">
                <div style="font-size: 0.9rem;">${msg}</div>
            </div>
        </div>`;
    toastContainer.appendChild(toast);
    setTimeout(() => {
        toast.style.transform = "translateX(120%)";
        toast.style.opacity = "0";
        setTimeout(() => toast.remove(), 400);
    }, 3000);
}

function showConfirmToast(msg, callback) {
    if (!toastContainer) return;
    playNotificationSound('error');
    const t = document.createElement('div');
    t.className = "custom-toast flex-column align-items-start";
    t.style.borderLeftColor = "#ffc107";
    t.style.background = "#1a1a1a";
    t.innerHTML = `
        <div class="mb-2"><strong>Confirmar</strong></div>
        <div class="small mb-3 text-white-50">${msg}</div>
        <div class="d-flex gap-2 w-100 justify-content-end">
            <button class="btn btn-sm btn-outline-light border-0 btn-cancelar-confirm">Cancelar</button>
            <button class="btn btn-sm btn-warning btn-aceptar-confirm">Confirmar</button>
        </div>`;
    toastContainer.appendChild(t);
    t.querySelector('.btn-cancelar-confirm').onclick = () => t.remove();
    t.querySelector('.btn-aceptar-confirm').onclick = () => {
        callback();
        t.remove();
    };
}

async function actualizarAlmacenamiento() {
    try {
        const res = await fetch("/cloudinary_storage_info");
        if (res.ok) {
            const data = await res.json();
            const progress = document.getElementById("storageProgressBar");
            const text = document.getElementById("storageText");
            if (progress && text) {
                const percent = (data.used_gb / data.limit_gb) * 100;
                const percentFixed = percent.toFixed(2);
                progress.style.width = `${percentFixed}%`;
                let usedDisplay = data.used_gb < 0.01 ? `${(data.used_gb * 1024).toFixed(2)} MB` : `${data.used_gb.toFixed(3)} GB`;
                text.textContent = `${usedDisplay} / ${data.limit_gb} GB (${percentFixed}%)`;
                progress.classList.remove("bg-success", "bg-warning", "bg-danger");
                if (percent > 85) progress.classList.add("bg-danger");
                else if (percent > 60) progress.classList.add("bg-warning");
                else progress.classList.add("bg-success");
            }
        }
    } catch (e) {}
}

async function compressImage(file, maxWidth = 800, maxHeight = 800, quality = 0.7) {
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
                if (width > height) {
                    if (width > maxWidth) {
                        height *= maxWidth / width;
                        width = maxWidth;
                    }
                } else {
                    if (height > maxHeight) {
                        width *= maxHeight / height;
                        height = maxHeight;
                    }
                }
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', quality).split(',')[1]);
            };
        };
    });
}

async function cargarPostres(silent = false) {
    if (isUpdating && !silent) return;
    isUpdating = true;
    try {
        const res = await fetch("/gestionar_productos", { cache: 'no-store' });
        if (!res.ok) return;
        const nuevosPostres = await res.json();
        if (JSON.stringify(nuevosPostres) !== JSON.stringify(postres)) {
            postres = nuevosPostres;
            localStorage.setItem('postresCache', JSON.stringify(postres));
            renderPostres();
        }
        await actualizarAlmacenamiento();
    } catch (error) {
    } finally {
        isUpdating = false;
    }
}

function actualizarEstadisticas(listaAMostrar) {
    const total = listaAMostrar.length;
    const disponibles = listaAMostrar.filter(p => parseInt(p.stock) > 0).length;
    const agotados = total - disponibles;
    document.getElementById("statTotalNum").textContent = total;
    document.getElementById("statDispNum").textContent = disponibles;
    document.getElementById("statAgotNum").textContent = agotados;
}

function renderPostres(filtro = "") {
    if (!listaPostresDisponibles || !listaPostresAgotados) return;
    listaPostresDisponibles.innerHTML = "";
    listaPostresAgotados.innerHTML = "";
    const productosFiltrados = postres.filter(p => 
        p.nombre.toLowerCase().includes(filtro.toLowerCase())
    );
    actualizarEstadisticas(productosFiltrados);
    let countDisp = 0;
    let countAgot = 0;
    productosFiltrados.forEach((p) => {
        const indexOriginal = postres.findIndex(pr => pr.id_producto === p.id_producto);
        const card = document.createElement("div");
        card.className = "col";
        const stockActual = parseInt(p.stock) || 0;
        const isAgotado = stockActual <= 0;
        card.innerHTML = `
        <div class="card h-100 shadow-sm ${isAgotado ? 'gris' : ''}" data-id="${p.id_producto}">
            <img src="${p.imagen_url || '/static/uploads/default.png'}" class="postre-img card-img-top" alt="${p.nombre}">
            <div class="card-body p-3">
                <h6 class="card-title text-truncate mb-1">${p.nombre}</h6>
                <p class="card-text text-primary fw-bold mb-2">${Number(p.precio).toLocaleString('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 })}</p>
                <div class="d-flex justify-content-between align-items-center">
                    <span class="badge ${stockActual <= 5 ? 'bg-danger' : 'bg-success'}">Stock: ${stockActual}</span>
                    <i class="bi bi-eye text-muted"></i>
                </div>
            </div>
        </div>`;
        card.querySelector(".card").onclick = () => abrirModalPostre(indexOriginal);
        if (!isAgotado) {
            listaPostresDisponibles.appendChild(card);
            countDisp++;
        } else {
            listaPostresAgotados.appendChild(card);
            countAgot++;
        }
    });
    document.getElementById("emptyDisponibles").classList.toggle("d-none", countDisp > 0);
    document.getElementById("emptyAgotados").classList.toggle("d-none", countAgot > 0);
    if (avisoAgotados) avisoAgotados.classList.toggle("d-none", countAgot === 0);
}

function abrirModalPostre(index) {
    indexActual = index;
    const p = postres[index];
    document.getElementById("modalNombre").textContent = "Ficha de Producto";
    document.getElementById("modalNombreH3").textContent = p.nombre;
    document.getElementById("modalFoto").src = p.imagen_url || "/static/uploads/default.png";
    document.getElementById("modalDescripcion").textContent = p.descripcion || "Sin descripción";
    document.getElementById("modalPrecio").textContent = Number(p.precio).toLocaleString('es-CO', { style: 'currency', currency: 'COP' });
    document.getElementById("modalStock").textContent = `Existencias: ${p.stock}`;
    if (modal) modal.show();
}

function resetPrevisualizador() {
    const previewImg = document.getElementById("previewNotificacionImg");
    const placeholder = document.getElementById("placeholderNotif");
    if (previewImg && placeholder) {
        previewImg.src = "";
        previewImg.classList.add("d-none");
        placeholder.classList.remove("d-none");
    }
}

document.addEventListener("DOMContentLoaded", async () => {
    if (!await verificarAccesoAdmin()) return;
    const cached = localStorage.getItem('postresCache');
    if (cached) {
        postres = JSON.parse(cached);
        renderPostres();
    }
    await cargarPostres();
    setInterval(() => cargarPostres(true), 15000);
    const inputFoto = document.getElementById("fotoPostre");
    if (inputFoto) {
        inputFoto.addEventListener("change", function() {
            const previewImg = document.getElementById("previewNotificacionImg");
            const placeholder = document.getElementById("placeholderNotif");
            if (this.files && this.files[0]) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    previewImg.src = e.target.result;
                    previewImg.classList.remove("d-none");
                    placeholder.classList.add("d-none");
                };
                reader.readAsDataURL(this.files[0]);
            } else {
                resetPrevisualizador();
            }
        });
    }
    if (searchInput) searchInput.addEventListener("input", (e) => renderPostres(e.target.value));
    if (btnAgregarPostre) {
        btnAgregarPostre.onclick = () => {
            indexActual = null;
            agregarPostreForm.reset();
            resetPrevisualizador();
            document.getElementById("formPanelTitle").textContent = "Nuevo Postre";
            btnSubmitForm.innerHTML = '<i class="bi bi-save2 me-2"></i>Guardar Nuevo Postre';
            formAgregarPostre.classList.remove("d-none");
            window.scrollTo({ top: 0, behavior: 'smooth' });
        };
    }
    if (btnCancelar) {
        btnCancelar.onclick = () => {
            formAgregarPostre.classList.add("d-none");
            agregarPostreForm.reset();
            resetPrevisualizador();
            indexActual = null;
        };
    }
    document.getElementById("btnEliminar").onclick = () => {
        if (indexActual === null) return;
        const p = postres[indexActual];
        showConfirmToast(`¿Eliminar permanentemente "${p.nombre}"?`, async () => {
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
            } catch (e) { showMessage("Error de conexión", true); }
        });
    };
    document.getElementById("btnEditar").onclick = () => {
        if (indexActual === null) return;
        const p = postres[indexActual];
        document.getElementById("nombrePostre").value = p.nombre;
        document.getElementById("precioPostre").value = p.precio;
        document.getElementById("descripcionPostre").value = p.descripcion || "";
        document.getElementById("stockPostre").value = p.stock;
        const previewImg = document.getElementById("previewNotificacionImg");
        const placeholder = document.getElementById("placeholderNotif");
        if (p.imagen_url) {
            previewImg.src = p.imagen_url;
            previewImg.classList.remove("d-none");
            placeholder.classList.add("d-none");
        } else {
            resetPrevisualizador();
        }
        document.getElementById("formPanelTitle").textContent = "Editar Producto";
        btnSubmitForm.innerHTML = '<i class="bi bi-pencil-square me-2"></i>Actualizar Cambios';
        formAgregarPostre.classList.remove("d-none");
        modal.hide();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };
});

if (agregarPostreForm) {
    agregarPostreForm.onsubmit = async (e) => {
        e.preventDefault();
        btnSubmitForm.disabled = true;
        btnSubmitForm.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Procesando...';
        const fileInput = document.getElementById("fotoPostre");
        const file = fileInput.files[0];
        const formData = new FormData();
        formData.append("nombre", document.getElementById("nombrePostre").value);
        formData.append("precio", document.getElementById("precioPostre").value);
        formData.append("descripcion", document.getElementById("descripcionPostre").value);
        formData.append("stock", document.getElementById("stockPostre").value);
        formData.append("categoria", "Postre");
        if (file) {
            const compressedBase64 = await compressImage(file);
            formData.append("foto_base64", compressedBase64);
            formData.append("foto_name", file.name);
        }
        await enviarFormulario(formData);
        btnSubmitForm.disabled = false;
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
            resetPrevisualizador();
            indexActual = null;
            await cargarPostres();
            showMessage(`Producto ${esEdicion ? 'actualizado' : 'creado'} correctamente`);
        } else {
            const errorData = await res.json();
            showMessage(errorData.error || "Error en la operación", true);
        }
    } catch (e) { showMessage("Error de red", true); }
}

(function() {
    window.history.pushState(null, "", window.location.href);
    window.onpopstate = function() { window.history.pushState(null, "", window.location.href); };
    window.onpageshow = function(event) {
        if (event.persisted || (window.performance && window.performance.navigation.type === 2)) {
            window.location.reload();
        }
    };
})();

document.addEventListener("click", () => initAudioContext(), { once: true });

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/static/js/workers/service-worker-gestion_productos.js')
            .then(() => {})
            .catch(() => {});
    });
}
