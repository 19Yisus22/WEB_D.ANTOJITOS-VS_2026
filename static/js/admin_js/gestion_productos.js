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
const PRODUCTOS_POR_PAG = 10;
let _paginaDisp = 1;
let _paginaAgot = 1;
let _listaDisp  = [];
let _listaAgot  = [];
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
            const prevAgotados  = new Set(postres.filter(p => parseInt(p.stock) <= 0).map(p => p.id_producto));
            const prevDisponibles = new Set(postres.filter(p => parseInt(p.stock) > 0).map(p => p.id_producto));
            postres = nuevosPostres;
            localStorage.setItem('postresCache', JSON.stringify(postres));
            renderPostres();
            nuevosPostres.forEach(p => {
                const ahoraAgotado = parseInt(p.stock) <= 0;
                if (ahoraAgotado && !prevAgotados.has(p.id_producto)) {
                    /* Recién se agotó */
                    mostrarAlerta(`📦 Agotado: ${p.nombre.toUpperCase()}`, true, 5000);
                    playNotificationSound('error');
                } else if (!ahoraAgotado && prevAgotados.has(p.id_producto)) {
                    /* Volvió a estar disponible */
                    mostrarAlerta(`✅ Disponible de nuevo: ${p.nombre}`, false, 5000);
                    playNotificationSound('default');
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

function _abrirFormularioEdicion(index) {
    const p = postres[index];
    indexActual = index;
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
    document.getElementById("formPanelTitle").textContent = t('prod.edit_title');
    btnSubmitForm.innerHTML = `<i class="bi bi-pencil-square me-2"></i>${t('prod.update')}`;
    formAgregarPostre.classList.remove("d-none");
    if (modal) modal.hide();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function _crearCardProducto(p) {
    const indexOriginal = postres.findIndex(pr => pr.id_producto === p.id_producto);
    const card = document.createElement("div");
    card.className = "col";
    const stockActual = parseInt(p.stock) || 0;
    const isAgotado = stockActual <= 0;
    card.innerHTML = `
    <div class="card h-100 shadow-sm ${isAgotado ? 'gris' : ''}" data-id="${p.id_producto}">
        <img src="${p.imagen_url || '/static/uploads/default.png'}" class="postre-img card-img-top" alt="${p.nombre}" loading="lazy"
             onerror="this.src='/static/uploads/default.png'">
        <div class="card-body p-3">
            <h6 class="card-title text-truncate mb-1">${p.nombre}</h6>
            <p class="card-text text-primary fw-bold mb-2">${Number(p.precio).toLocaleString('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 })}</p>
            <div class="d-flex justify-content-between align-items-center">
                <span class="badge ${stockActual <= 5 ? 'bg-danger' : 'bg-success'}">Stock: ${stockActual}</span>
                <div class="d-flex gap-1">
                    <button class="btn-card-action btn-card-view" title="Ver detalle">
                        <i class="bi bi-eye"></i>
                    </button>
                    <button class="btn-card-action btn-card-edit" title="Editar producto">
                        <i class="bi bi-pencil-fill"></i>
                    </button>
                </div>
            </div>
        </div>
    </div>`;
    card.querySelector(".card").onclick = () => abrirModalPostre(indexOriginal);
    card.querySelector(".btn-card-view").addEventListener('click', e => {
        e.stopPropagation();
        abrirModalPostre(indexOriginal);
    });
    card.querySelector(".btn-card-edit").addEventListener('click', e => {
        e.stopPropagation();
        _abrirFormularioEdicion(indexOriginal);
    });
    return card;
}

function _renderPaginacionProductos(containerId, lista, paginaActual, onCambio) {
    let nav = document.getElementById(containerId);
    if (!nav) {
        nav = document.createElement('nav');
        nav.id = containerId;
        nav.className = 'mt-3 mb-2';
        const parent = containerId.includes('Disp')
            ? listaPostresDisponibles.parentElement
            : listaPostresAgotados.parentElement;
        if (parent) parent.appendChild(nav);
    }
    const maxPag = Math.ceil(lista.length / PRODUCTOS_POR_PAG);
    if (maxPag <= 1) { nav.innerHTML = ''; return; }
    let html = '<ul class="pagination pagination-sm justify-content-center">';
    for (let i = 1; i <= maxPag; i++) {
        html += `<li class="page-item ${i === paginaActual ? 'active' : ''}">
                    <a class="page-link" href="#" onclick="event.preventDefault();(${onCambio})(${i});">${i}</a>
                 </li>`;
    }
    nav.innerHTML = html + '</ul>';
}

function renderPostres(filtro = "") {
    if (!listaPostresDisponibles || !listaPostresAgotados) return;
    listaPostresDisponibles.innerHTML = "";
    listaPostresAgotados.innerHTML = "";

    const productosFiltrados = postres.filter(p =>
        p.nombre.toLowerCase().includes(filtro.toLowerCase())
    );

    actualizarEstadisticas(productosFiltrados);
    _paginaDisp = 1;
    _paginaAgot = 1;
    _listaDisp  = productosFiltrados.filter(p => (parseInt(p.stock) || 0) > 0);
    _listaAgot  = productosFiltrados.filter(p => (parseInt(p.stock) || 0) <= 0);

    _renderSeccionProductos();
}

function _renderSeccionProductos() {
    listaPostresDisponibles.innerHTML = "";
    listaPostresAgotados.innerHTML = "";

    const inicioDisp = (_paginaDisp - 1) * PRODUCTOS_POR_PAG;
    _listaDisp.slice(inicioDisp, inicioDisp + PRODUCTOS_POR_PAG).forEach(p =>
        listaPostresDisponibles.appendChild(_crearCardProducto(p))
    );

    const inicioAgot = (_paginaAgot - 1) * PRODUCTOS_POR_PAG;
    _listaAgot.slice(inicioAgot, inicioAgot + PRODUCTOS_POR_PAG).forEach(p =>
        listaPostresAgotados.appendChild(_crearCardProducto(p))
    );

    document.getElementById("emptyDisponibles").classList.toggle("d-none", _listaDisp.length > 0);
    document.getElementById("emptyAgotados").classList.toggle("d-none", _listaAgot.length > 0);
    if (avisoAgotados) avisoAgotados.classList.toggle("d-none", _listaAgot.length === 0);

    _renderPaginacionProductos('pagDisponibles', _listaDisp, _paginaDisp, 'window._cambiarPagDisp');
    _renderPaginacionProductos('pagAgotados',    _listaAgot, _paginaAgot, 'window._cambiarPagAgot');
}

window._cambiarPagDisp = (p) => { _paginaDisp = p; _renderSeccionProductos(); window.scrollTo({top:0,behavior:'smooth'}); };
window._cambiarPagAgot = (p) => { _paginaAgot = p; _renderSeccionProductos(); };

function abrirModalPostre(index) {
    indexActual = index;
    const p = postres[index];
    document.getElementById("modalNombre").textContent = "Ficha de Producto";
    document.getElementById("modalNombreH3").textContent = p.nombre;
    const modalFoto = document.getElementById("modalFoto");
    const validUrl = p.imagen_url && p.imagen_url.startsWith('http');
    if (validUrl) {
        modalFoto.src = p.imagen_url;
        modalFoto.style.display = 'block';
        modalFoto.onerror = () => {
            modalFoto.style.display = 'none';
            const placeholder = document.createElement('div');
            placeholder.className = 'd-flex align-items-center justify-content-center bg-light rounded-4';
            placeholder.style.cssText = 'height:100%;min-height:200px;';
            placeholder.innerHTML = '<i class="bi bi-image-slash text-muted fs-1"></i>';
            modalFoto.parentNode.insertBefore(placeholder, modalFoto.nextSibling);
        };
    } else {
        modalFoto.style.display = 'none';
        const placeholder = document.createElement('div');
        placeholder.id = 'modalFotoPlaceholder';
        placeholder.className = 'd-flex align-items-center justify-content-center bg-light rounded-4';
        placeholder.style.cssText = 'height:100%;min-height:200px;';
        placeholder.innerHTML = '<i class="bi bi-image-slash text-muted fs-1"></i>';
        if (modalFoto.parentNode) modalFoto.parentNode.insertBefore(placeholder, modalFoto.nextSibling);
    }
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

async function cargarDescuentoCumple() {
    try {
        const res  = await fetch('/api/config/descuento_cumpleanos');
        const data = await res.json();
        const inp  = document.getElementById('inputDescuentoCumple');
        if (inp) inp.value = data.pct ?? 5;
    } catch (_) {}
}

async function guardarDescuentoCumple() {
    const inp = document.getElementById('inputDescuentoCumple');
    const fb  = document.getElementById('descuentoFeedback');
    if (!inp) return;
    const pct = parseFloat(inp.value);
    if (isNaN(pct) || pct < 0 || pct > 100) {
        fb.textContent = 'Valor inválido (0–100)';
        fb.className   = 'small text-danger';
        fb.classList.remove('d-none');
        return;
    }
    try {
        const res  = await fetch('/api/config/descuento_cumpleanos', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pct }),
        });
        const data = await res.json();
        if (data.ok) {
            fb.textContent = `✓ Guardado: ${data.pct}%`;
            fb.className   = 'small text-success';
        } else {
            fb.textContent = data.error || 'Error al guardar';
            fb.className   = 'small text-danger';
        }
    } catch (_) {
        fb.textContent = 'Error de red';
        fb.className   = 'small text-danger';
    }
    fb.classList.remove('d-none');
    setTimeout(() => fb.classList.add('d-none'), 3000);
}

document.addEventListener("DOMContentLoaded", async () => {
    cargarDescuentoCumple();
    const btnDesc = document.getElementById('btnGuardarDescuento');
    if (btnDesc) btnDesc.addEventListener('click', guardarDescuentoCumple);

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
            document.getElementById("formPanelTitle").textContent = t('prod.new_title');
            btnSubmitForm.innerHTML = `<i class="bi bi-save2 me-2"></i>${t('prod.save')}`;
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
                    mostrarAlerta(`🗑️ "${p.nombre}" eliminado permanentemente`, true);
                    playNotificationSound('delete');
                    modal.hide();
                    await cargarPostres();
                } else {
                    const err = await res.json();
                    mostrarAlerta(`❌ Error al eliminar: ${err.error || 'intente de nuevo'}`, true);
                }
            } catch (e) { mostrarAlerta("Error de conexión", true); }
        });
    };

    document.getElementById("btnEditar").onclick = () => {
        if (indexActual === null) return;
        _abrirFormularioEdicion(indexActual);
    };
});

if (agregarPostreForm) {
    agregarPostreForm.onsubmit = async (e) => {
        e.preventDefault();
        btnSubmitForm.disabled = true;
        btnSubmitForm.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span>${t('status.processing')}`;
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
            const nombre = formData.get('nombre') || 'Producto';
            if (esEdicion) {
                mostrarAlerta(`✏️ "${nombre}" actualizado correctamente en el catálogo`);
                if (typeof verificarLogros === 'function') verificarLogros({ tipo: 'accion', accion: 'editar_producto' });
            } else {
                mostrarAlerta(`🎂 "${nombre}" agregado al catálogo con éxito`);
                playNotificationSound('default');
                if (typeof verificarLogros === 'function') verificarLogros({ tipo: 'accion', accion: 'crear_producto' });
            }
            if (stockNuevo <= 0) {
                mostrarAlerta(`⚠️ "${nombre}" registrado como AGOTADO`, true, 6000);
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
