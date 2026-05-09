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
        } else {
            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(880, audioCtx.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(440, audioCtx.currentTime + 0.1);
            gainNode.gain.setValueAtTime(0.05, audioCtx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
        }
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.4);
    } catch (e) {}
}

function mostrarConfirmacionApp(titulo, mensaje, onConfirm) {
    const existing = document.getElementById('appModalConfirm');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'appModalConfirm';
    overlay.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.8); display: flex; align-items: center;
        justify-content: center; z-index: 20000; backdrop-filter: blur(5px);
        transition: opacity 0.3s ease;
    `;

    const modalBox = document.createElement('div');
    modalBox.style.cssText = `
        background: #ffffff; width: 95%; max-width: 420px; padding: 35px;
        border-radius: 25px; text-align: center; box-shadow: 0 25px 50px rgba(0,0,0,0.4);
        transform: scale(0.7); transition: transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    `;

    modalBox.innerHTML = `
        <div style="color: #ff4757; font-size: 4rem; margin-bottom: 20px; animation: pulse 1.5s infinite;">
            <i class="bi bi-exclamation-triangle-fill"></i>
        </div>
        <h2 style="margin-bottom: 12px; font-weight: 800; color: #1e272e; letter-spacing: -0.5px;">${titulo}</h2>
        <p style="color: #485460; margin-bottom: 30px; line-height: 1.6; font-size: 1.05rem;">${mensaje}</p>
        <div style="display: flex; gap: 12px; justify-content: center;">
            <button id="btnCancelModal" class="btn btn-light" style="padding: 12px 30px; border-radius: 15px; font-weight: 700; border: 2px solid #f1f2f6;">CANCELAR</button>
            <button id="btnConfirmModal" class="btn btn-danger" style="padding: 12px 30px; border-radius: 15px; font-weight: 700; background: #ff4757; border: none; box-shadow: 0 5px 15px rgba(255, 71, 87, 0.3);">CONFIRMAR</button>
        </div>
    `;

    overlay.appendChild(modalBox);
    document.body.appendChild(overlay);

    setTimeout(() => modalBox.style.transform = 'scale(1)', 10);

    const cerrar = () => {
        modalBox.style.transform = 'scale(0.7)';
        overlay.style.opacity = '0';
        setTimeout(() => overlay.remove(), 300);
    };

    document.getElementById('btnCancelModal').onclick = cerrar;
    document.getElementById('btnConfirmModal').onclick = () => {
        onConfirm();
        cerrar();
    };
}

function mostrarAlerta(mensaje, esError = false, duracionMs = 4000) {
    let container = document.getElementById('toastContainer');
    if (!container) {
        container = document.createElement("div");
        container.id = "toastContainer";
        container.style.cssText = "position: fixed; top: 25px; right: 25px; z-index: 10000; display: flex; flex-direction: column; gap: 12px;";
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = 'custom-toast-alert';
    const colorPrimario = esError ? "#ff4757" : "#2ed573";
    const sombraColor = esError ? "rgba(255, 71, 87, 0.2)" : "rgba(46, 213, 115, 0.2)";
    
    toast.style.cssText = `
        background: #ffffff; 
        color: #2f3542; 
        padding: 16px 24px; 
        border-radius: 12px; 
        box-shadow: 0 10px 30px ${sombraColor}; 
        display: flex; 
        justify-content: space-between; 
        align-items: center; 
        min-width: 350px; 
        max-width: 450px;
        border-left: 6px solid ${colorPrimario}; 
        transition: all 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        transform: translateX(100%);
        opacity: 0;
    `;
    
    toast.innerHTML = `
        <div class="d-flex align-items-center">
            <div style="background: ${colorPrimario}; width: 35px; height: 35px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-right: 15px;">
                <i class="bi ${esError ? 'bi-x-circle-fill' : 'bi-check-circle-fill'} text-white fs-5"></i>
            </div>
            <div>
                <strong style="display: block; font-size: 0.8rem; text-transform: uppercase; color: #747d8c;">Notificación de Sistema</strong>
                <span style="font-size: 0.95rem; font-weight: 600;">${mensaje}</span>
            </div>
        </div>
        <i class="bi bi-x-lg ms-3 btn-close-toast" style="cursor:pointer; font-size: 1rem; color: #a4b0be;"></i>
    `;
    
    container.appendChild(toast);

    requestAnimationFrame(() => {
        toast.style.transform = "translateX(0)";
        toast.style.opacity = "1";
    });

    const eliminar = () => {
        toast.style.transform = "translateX(120%)";
        toast.style.opacity = "0";
        setTimeout(() => toast.remove(), 500);
    };

    toast.querySelector('.btn-close-toast').onclick = eliminar;
    setTimeout(eliminar, duracionMs);
}

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
    } catch (e) {}
}

async function cargarPostres(silent = false) {
    if (isUpdating && !silent) return;
    isUpdating = true;
    try {
        const res = await fetch("/gestionar_productos", { cache: 'no-store' });
        if (!res.ok) return;
        const nuevosPostres = await res.json();

        if (JSON.stringify(nuevosPostres) !== JSON.stringify(postres)) {
            const prevAgotados = new Set(postres.filter(p => parseInt(p.stock) <= 0).map(p => p.id_producto));
            postres = nuevosPostres;
            localStorage.setItem('postresCache', JSON.stringify(postres));
            renderPostres();
            nuevosPostres.forEach(p => {
                if (parseInt(p.stock) <= 0 && !prevAgotados.has(p.id_producto)) {
                    mostrarAlerta(`¡Se ha agotado el producto! ${p.nombre.toUpperCase()}`, true, 4000);
                    playNotificationSound('error');
                }
            });
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
    await actualizarAlmacenamiento();
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
            btnSubmitForm.innerHTML = '<i class="bi bi-save2 me-2"></i>Agregar nuevo producto';
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
        mostrarConfirmacionApp("Eliminar Producto", `¿Eliminar permanentemente "${p.nombre}"?`, async () => {
            try {
                const res = await fetch(`/eliminar_producto/${p.id_producto}`, { method: "DELETE" });
                if (res.ok) {
                    mostrarAlerta("¡Producto eliminado con éxito!", true);
                    modal.hide();
                    await cargarPostres();
                } else {
                    const err = await res.json();
                    mostrarAlerta(err.error || "Error al eliminar", true);
                }
            } catch (e) { mostrarAlerta("Error de conexión", true); }
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
                    if (width > maxWidth) { height *= maxWidth / width; width = maxWidth; }
                } else {
                    if (height > maxHeight) { width *= maxHeight / height; height = maxHeight; }
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

async function enviarFormulario(formData) {
    const esEdicion = indexActual !== null;
    const metodo = esEdicion ? "PUT" : "POST";
    const url = esEdicion ? `/actualizar_producto/${postres[indexActual].id_producto}` : "/gestionar_productos";
    const stockNuevo = parseInt(formData.get("stock"));

    try {
        const res = await fetch(url, { method: metodo, body: formData });
        if (res.ok) {
            formAgregarPostre.classList.add("d-none");
            agregarPostreForm.reset();
            resetPrevisualizador();
            indexActual = null;
            await cargarPostres();
            mostrarAlerta(`¡Producto ${esEdicion ? 'actualizado' : 'creado'} con éxito!`);

            if (stockNuevo <= 0) {
                mostrarAlerta("¡PRODUCTO AGOTADO REGISTRADO!", true, 6000);
                playNotificationSound('error');
            }
            await actualizarAlmacenamiento();
        } else {
            const errorData = await res.json();
            mostrarAlerta(errorData.error || "Error en la operación", true);
        }
    } catch (e) { 
        mostrarAlerta("Error de red", true); 
    }
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
    window.addEventListener('load', () => {navigator.serviceWorker.register('/static/js/workers/service-worker-gestion_productos.js') .then(() => console.log('SW OK')) .catch(err => console.error('SW Error', err));});
}