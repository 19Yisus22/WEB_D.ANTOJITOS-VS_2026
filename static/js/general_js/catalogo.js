const catalogoContainer = document.getElementById("catalogoProductos");
const publicidadContainer = document.getElementById("publicidadContainer");
const btnFiltrar = document.getElementById("btnFiltrar");
const searchInput = document.getElementById("searchInput");
const toastContainer = document.getElementById("toastContainer");
const btnCarrito = document.getElementById("btnCarrito");
const badgeCarrito = document.getElementById("contadorCarritoBadge");

let productos = [];
let filtroIndex = 0;
let contadorCarrito = 0;
let isFirstLoad = true;
let isProcessingPurchase = false;
let searchTimeout = null;
let cintaPublicitariaItems = [];
let notificacionesActivas = [];
const productosNotificados = new Set();
const filtros = ['Recientes', 'Antiguos', 'Favoritos'];
const userLogged = window.userLogged || false;

let favoritos = JSON.parse(localStorage.getItem('mis_favoritos_postres')) || [];
let audioCtx = null;

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
        if (type === 'error' || type === 'agotado') {
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
    } catch (e) {
        console.warn("Audio bloqueado");
    }
}

function mostrarAlerta({
    mensaje = "",
    titulo = "",
    descripcion = "",
    imagen = "/static/uploads/logo.png",
    tipo = "info",
    duracion = 4000,
    idUnico = null,
    sonido = true
} = {}) {
    if (idUnico && productosNotificados.has(idUnico)) return;
    if (idUnico) {
        productosNotificados.add(idUnico);
        setTimeout(() => productosNotificados.delete(idUnico), duracion + 1000);
    }

    let cont = document.getElementById("toastContainer");
    if (!cont) {
        cont = document.createElement("div");
        cont.id = "toastContainer";
        cont.style.cssText = "position: fixed; top: 20px; right: 20px; z-index: 10000; display: flex; flex-direction: column; gap: 10px;";
        document.body.appendChild(cont);
    }

    if (sonido) {
        const soundType = (tipo === 'error' || tipo === 'agotado' || tipo === 'warning') ? 'error' : 'default';
        playNotificationSound(soundType);
    }

    const esError = tipo === 'error' || tipo === 'agotado' || tipo === 'warning';
    const colorPrimario = esError ? "#ff4757" : "#ff9800";
    const iconClass = esError ? 'bi-exclamation-triangle-fill' : 
                      tipo === 'bienvenida' ? 'bi-emoji-smile-fill' : 
                      tipo === 'favorito' ? 'bi-heart-fill' : 'bi-stars';

    const toast = document.createElement("div");
    toast.style.cssText = `
        background: #121212;
        color: #ffffff;
        padding: 14px 18px;
        border-radius: 12px;
        box-shadow: 0 8px 25px rgba(0,0,0,0.5);
        display: flex;
        align-items: center;
        min-width: 320px;
        max-width: 400px;
        border-left: 5px solid ${colorPrimario};
        transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        transform: translateX(120%);
        opacity: 0;
    `;

    const textoContenido = descripcion || mensaje;
    const tituloFinal = titulo || (esError ? "Sistema" : "Catálogo");

    toast.innerHTML = `
        <div class="d-flex align-items-center w-100">
            <div style="position: relative; flex-shrink: 0;">
                <img src="${imagen}" style="width:50px; height:50px; object-fit:cover; border-radius:8px;" onerror="this.src='/static/uploads/logo.png'">
                <div style="position: absolute; bottom: -4px; right: -4px; background: ${colorPrimario}; width: 20px; height: 20px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 2px solid #121212;">
                    <i class="bi ${iconClass} text-white" style="font-size: 0.65rem;"></i>
                </div>
            </div>
            <div class="ms-3 flex-grow-1">
                <strong style="display: block; font-size: 0.7rem; text-transform: uppercase; color: ${colorPrimario}; letter-spacing: 0.8px;">${tituloFinal}</strong>
                <div style="font-size: 0.85rem; font-weight: 400; color: #f0f0f0; line-height: 1.2;">${textoContenido}</div>
            </div>
            <button class="btn-close-toast ms-2" style="background: none; border: none; color: #888; cursor: pointer; font-size: 1rem;">
                <i class="bi bi-x-lg"></i>
            </button>
        </div>
    `;

    cont.appendChild(toast);

    setTimeout(() => {
        toast.style.transform = "translateX(0)";
        toast.style.opacity = "1";
    }, 50);

    const remove = () => {
        toast.style.transform = "translateX(120%)";
        toast.style.opacity = "0";
        setTimeout(() => toast.remove(), 400);
    };

    toast.querySelector('.btn-close-toast').onclick = remove;
    setTimeout(remove, duracion);
}

function mostrarToastFavorito(mensaje, isAdd) {
    mostrarAlerta({
        mensaje: mensaje,
        titulo: "Favoritos",
        tipo: isAdd ? "favorito" : "info",
        imagen: "/static/uploads/logo.png",
        duracion: 3000
    });
}

function showMessage(msg, isError = false) {
    mostrarAlerta({ 
        mensaje: msg, 
        tipo: isError ? "error" : "success", 
        titulo: isError ? "Conexión de Servidor" : "Éxito",
        duracion: 3000 
    });
}

function mostrarToastPublicidad(imagen, titulo, descripcion, isError = false) {
    mostrarAlerta({ imagen, titulo, descripcion, tipo: isError ? "agotado" : "info", duracion: 4000 });
}

function mostrarToastActualizacion(imagen, titulo, descripcion, idUnico, isError = false) {
    mostrarAlerta({ imagen, titulo, descripcion, idUnico, tipo: isError ? "agotado" : "info", duracion: 4500 });
}

function mostrarBienvenida(nombre) {
    mostrarAlerta({ 
        titulo: "Bienvenida", 
        descripcion: `¡Hola, ${nombre}! Explora nuestro catálogo.`, 
        imagen: "/static/uploads/logo.png", 
        tipo: "bienvenida", 
        duracion: 5000 
    });
}

async function sincronizarContadorCarrito() {
    try {
        const res = await fetch("/obtener_carrito");
        const data = await res.json();
        if (data && data.productos) {
            contadorCarrito = data.productos.reduce((total, item) => total + item.cantidad, 0);
            localStorage.setItem('cant_carrito', contadorCarrito);
            actualizarInterfazContador();
        }
    } catch (e) {
        const guardado = localStorage.getItem('cant_carrito');
        if (guardado) {
            contadorCarrito = parseInt(guardado);
            actualizarInterfazContador();
        }
    }
}

function actualizarContadorCarrito(cantidad) {
    contadorCarrito += cantidad;
    if (contadorCarrito < 0) contadorCarrito = 0;
    localStorage.setItem('cant_carrito', contadorCarrito);
    actualizarInterfazContador();
}

function actualizarInterfazContador() {
    if (badgeCarrito) {
        if (contadorCarrito > 0) {
            badgeCarrito.style.display = "flex";
            badgeCarrito.textContent = contadorCarrito;
        } else {
            badgeCarrito.style.display = "none";
        }
    }
}

async function cargarCintaPublicitaria() {
    if (!publicidadContainer) return;
    try {
        const res = await fetch("/api/publicidad/activa");
        const data = await res.json();
        if (!Array.isArray(data)) return;
        notificacionesActivas = data.filter(item => item.tipo === 'notificacion' && item.estado);
        const itemsCinta = data.filter(item => item.tipo === 'cinta' && item.estado);
        if (itemsCinta.length > 0) {
            cintaPublicitariaItems = itemsCinta;
            publicidadContainer.innerHTML = `
                <div class="promo-banner shadow-sm overflow-hidden">
                    <div class="marquee-content">
                        ${itemsCinta.concat(itemsCinta, itemsCinta).map(item => `
                            <div class="promo-item mx-5 d-flex align-items-center" style="min-width: max-content;">
                                <div class="promo-img-container">
                                    <img src="${item.imagen_url || '/static/uploads/logo.png'}" class="promo-img-glow" onerror="this.src='/static/uploads/logo.png'">
                                </div>
                                <span class="promo-text">${item.titulo || ''}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>`;
            publicidadContainer.classList.remove("d-none");
        }
    } catch (e) {
        publicidadContainer.classList.add("d-none");
    }
}

function iniciarNotificacionesPeriodicas() {
    setInterval(() => {
        if (notificacionesActivas.length > 0 && !isProcessingPurchase) {
            const elegido = notificacionesActivas[Math.floor(Math.random() * notificacionesActivas.length)];
            mostrarAlerta({ imagen: elegido.imagen_url || '/static/uploads/logo.png', titulo: elegido.titulo, descripcion: elegido.descripcion, tipo: "info", duracion: 5000 });
        }
    }, 12000);
}

function toggleFavorito(id) {
    const idStr = id.toString();
    const index = favoritos.indexOf(idStr);
    if (index > -1) {
        favoritos.splice(index, 1);
        mostrarToastFavorito("Postre eliminado de favoritos", false);
    } else {
        favoritos.push(idStr);
        mostrarToastFavorito("Postre añadido a favoritos", true);
    }
    localStorage.setItem('mis_favoritos_postres', JSON.stringify(favoritos));
    renderProductos(searchInput.value);
}

async function cargarProductos() {
    try {
        const res = await fetch("/obtener_catalogo");
        const data = await res.json();
        const nuevosProductos = data.productos || [];
        let huboCambios = false;
        if (!isFirstLoad) {
            nuevosProductos.forEach(nuevo => {
                const viejo = productos.find(p => p.id_producto == nuevo.id_producto);
                if (viejo) {
                    if (viejo.stock > 0 && nuevo.stock <= 0) {
                        mostrarToastActualizacion(nuevo.imagen_url || '/static/uploads/logo.png', "¡Agotado!", `${nuevo.nombre} se ha terminado`, `agotado-${nuevo.id_producto}`, true);
                        huboCambios = true;
                    } else if (viejo.stock <= 0 && nuevo.stock > 0) {
                        mostrarToastActualizacion(nuevo.imagen_url || '/static/uploads/logo.png', "¡De Vuelta!", `${nuevo.nombre} disponible`, `disponible-${nuevo.id_producto}`, false);
                        huboCambios = true;
                    } else if (viejo.stock !== nuevo.stock || viejo.precio !== nuevo.precio) {
                        huboCambios = true;
                    }
                }
            });
            if (nuevosProductos.length !== productos.length) huboCambios = true;
        }
        if (huboCambios || productos.length === 0 || isFirstLoad) {
            productos = nuevosProductos;
            const spinner = document.getElementById("spinner");
            if (spinner) spinner.style.display = "none";
            catalogoContainer.classList.remove("d-none");
            renderProductos(searchInput.value);
        }
        isFirstLoad = false;
    } catch (e) {
        console.error("Sync error");
    }
}

function renderProductos(filterText = '') {
    catalogoContainer.innerHTML = '';
    let baseFiltrada = productos.filter(p => p.nombre.toLowerCase().includes(filterText.toLowerCase()));
    if (filtros[filtroIndex] === 'Recientes') {
        baseFiltrada.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
    } else if (filtros[filtroIndex] === 'Antiguos') {
        baseFiltrada.sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
    }
    const listaFavoritos = baseFiltrada.filter(p => favoritos.includes(p.id_producto.toString()));
    const disponibles = baseFiltrada.filter(p => p.stock > 0);
    const agotados = baseFiltrada.filter(p => p.stock <= 0);
    if (listaFavoritos.length > 0) {
        const col = document.createElement("div");
        col.className = "col-12 mb-5";
        col.innerHTML = `
            <div class="accordion border-0 shadow-sm" style="border-radius: 15px; overflow: hidden;">
                <div class="accordion-item border-0">
                    <h2 class="accordion-header">
                        <button class="accordion-button fw-bold text-dark collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#collapseFavoritosSec" style="background-color: #fff9f0;">
                            <i class="bi bi-heart-fill text-danger me-2"></i> TUS FAVORITOS (${listaFavoritos.length})
                        </button>
                    </h2>
                    <div id="collapseFavoritosSec" class="accordion-collapse collapse">
                        <div class="accordion-body px-0" style="background-color: #fffdfa;">
                            <div class="row g-4 px-3" id="contenedorInternoFavoritos"></div>
                        </div>
                    </div>
                </div>
            </div>`;
        catalogoContainer.appendChild(col);
        const inner = document.getElementById("contenedorInternoFavoritos");
        listaFavoritos.forEach(p => inner.appendChild(crearCardProductoHTML(p, "fav")));
    }
    if (disponibles.length > 0) {
        const headerDisp = document.createElement("div");
        headerDisp.className = "col-12 mt-2 mb-4";
        headerDisp.innerHTML = `
            <div class="seccion-titulo-contenedor">
                <h3 class="seccion-titulo"><i class="bi bi-check2-circle me-2 color-disponible"></i> Postres Disponibles</h3>
                <div class="linea-decorativa linea-disponible"></div>
            </div>
            <div class="row g-4 mt-1" id="gridDisponibles"></div>`;
        catalogoContainer.appendChild(headerDisp);
        const gridDisp = document.getElementById("gridDisponibles");
        disponibles.forEach(p => gridDisp.appendChild(crearCardProductoHTML(p, "disp")));
    }
    if (agotados.length > 0) {
        const headerAgot = document.createElement("div");
        headerAgot.className = "col-12 mt-5 mb-4";
        headerAgot.innerHTML = `
            <div class="seccion-titulo-contenedor">
                <h3 class="seccion-titulo"><i class="bi bi-x-circle me-2 color-agotado"></i> Postres Agotados</h3>
                <div class="linea-decorativa linea-disponible"></div>
            </div>
            <div class="row g-4 mt-1" id="gridAgotados"></div>`;
        catalogoContainer.appendChild(headerAgot);
        const gridAgot = document.getElementById("gridAgotados");
        agotados.forEach(p => gridAgot.appendChild(crearCardProductoHTML(p, "agot")));
    }
    if (baseFiltrada.length === 0) {
        catalogoContainer.innerHTML = '<div class="col-12 text-center py-5 text-muted">No se encontraron productos</div>';
    }
    agregarEventosProductos();
}

function crearCardProductoHTML(p, prefix = "") {
    const col = document.createElement("div");
    col.className = `col-md-6 col-lg-4 mb-2 fade-in`;
    col.dataset.id = p.id_producto;
    const isAgotado = p.stock <= 0;
    const esFav = favoritos.includes(p.id_producto.toString());
    const imgUrl = p.imagen_url || '/static/uploads/default.png';
    const uniqueId = `${prefix}-${p.id_producto}`;
    col.innerHTML = `
        <div class="card h-100 product-card shadow-sm ${isAgotado ? 'producto-gris' : ''}" style="border-radius: 20px; border: 1px solid rgba(0,0,0,0.05);">
            <div class="img-wrapper position-relative overflow-hidden" style="height: 200px; border-radius: 20px 20px 0 0;">
                <button class="btn-favorito-floating btn-fav-toggle" id="fav-btn-${uniqueId}" data-id="${p.id_producto}">
                    <i class="bi ${esFav ? 'bi-heart-fill text-danger' : 'bi-heart text-muted'}"></i>
                </button>
                <img src="${imgUrl}" alt="${p.nombre}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.src='/static/uploads/default.png'">
                ${isAgotado ? '<div class="letrero-agotado">AGOTADO</div>' : ''}
            </div>
            <div class="card-body p-3">
                <div class="d-flex justify-content-between align-items-start mb-2">
                    <h6 class="fw-bold mb-0">${p.nombre}</h6>
                    <span class="badge bg-light text-warning shadow-sm">$${p.precio.toLocaleString()}</span>
                </div>
                <div class="text-muted small mb-3">${p.description || p.descripcion || ''}</div>
                <div class="mb-3">
                    <small class="${p.stock < 5 ? 'text-danger' : 'text-success'} fw-bold">Stock: ${p.stock}</small>
                </div>
                ${!isAgotado ? `
                    <div class="d-flex gap-2 align-items-center">
                        <div class="modern-quantity-control">
                            <button class="qty-btn btn-disminuir">-</button>
                            <input type="number" readonly value="1" class="cantidad" style="width: 30px; border: none; text-align: center; background: transparent;">
                            <button class="qty-btn btn-aumentar">+</button>
                        </div>
                        <button class="btn btn-warning flex-grow-1 text-white fw-bold btn-agregar-modern">Añadir <i class="bi bi-cart-plus"></i></button>
                    </div>
                ` : `<button class="btn btn-secondary w-100 disabled" disabled>Agotado</button>`}
            </div>
        </div>`;
    col.querySelector(".btn-fav-toggle").onclick = (e) => {
        e.preventDefault();
        toggleFavorito(p.id_producto);
    };
    return col;
}

function agregarEventosProductos() {
    catalogoContainer.querySelectorAll(".btn-agregar-modern").forEach(btn => {
        btn.onclick = async () => {
            if (isProcessingPurchase) return;
            initAudioContext();
            if (!userLogged || userLogged === "false") {
                showMessage("Inicie sesión para comprar", true);
                return;
            }
            const wrapper = btn.closest('[data-id]');
            const id_producto = wrapper.dataset.id;
            const cantidadInput = wrapper.querySelector(".cantidad");
            const cantidadPedida = parseInt(cantidadInput.value);
            const productoArray = productos.find(p => p.id_producto == id_producto);
            if (!productoArray || cantidadPedida <= 0) return;
            isProcessingPurchase = true;
            const originalContent = btn.innerHTML;
            btn.disabled = true;
            btn.innerHTML = `<span class="spinner-border spinner-border-sm"></span>`;
            try {
                const res = await fetch("/guardar_catalogo", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ productos: [{ id_producto, cantidad: cantidadPedida }] })
                });
                if (res.ok) {
                    productoArray.stock -= cantidadPedida;
                    actualizarContadorCarrito(cantidadPedida);
                    mostrarToastPublicidad(productoArray.imagen_url || '/static/uploads/logo.png', "Carrito", `${productoArray.nombre} añadido`);
                    renderProductos(searchInput.value);
                } else {
                    const errorData = await res.json();
                    showMessage(errorData.message || "Error al añadir", true);
                    await cargarProductos();
                }
            } catch (error) {
                showMessage("Error de conexión", true);
            } finally {
                btn.disabled = false;
                btn.innerHTML = originalContent;
                isProcessingPurchase = false;
            }
        };
    });
    catalogoContainer.querySelectorAll(".btn-aumentar").forEach(btn => {
        btn.onclick = () => {
            const input = btn.parentElement.querySelector(".cantidad");
            const id = btn.closest('[data-id]').dataset.id;
            const p = productos.find(x => x.id_producto == id);
            if (p && parseInt(input.value) < p.stock) {
                input.value = parseInt(input.value) + 1;
            } else {
                showMessage("Sin stock suficiente", true);
            }
        };
    });
    catalogoContainer.querySelectorAll(".btn-disminuir").forEach(btn => {
        btn.onclick = () => {
            const input = btn.parentElement.querySelector(".cantidad");
            if (parseInt(input.value) > 1) input.value = parseInt(input.value) - 1;
        };
    });
}

window.addEventListener('stockActualizado', (e) => {
    const { id_producto, cambio } = e.detail;
    const prod = productos.find(p => p.id_producto == id_producto);
    if (prod) {
        prod.stock += cambio;
        renderProductos(searchInput.value);
    }
});

btnFiltrar.onclick = () => {
    filtroIndex = (filtroIndex + 1) % filtros.length;
    btnFiltrar.innerHTML = `<i class="bi bi-funnel-fill me-2"></i>${filtros[filtroIndex]}`;
    renderProductos(searchInput.value);
};

searchInput.oninput = () => {
    if (searchTimeout) clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => { renderProductos(searchInput.value); }, 200);
};

btnCarrito.onclick = () => {
    initAudioContext();
    if (!userLogged || userLogged === "false") {
        showMessage("Debes iniciar sesión", true);
        return;
    }
    btnCarrito.disabled = true;
    setTimeout(() => { window.location.href = "/carrito_page"; }, 200);
};

function resetBotonesEstado() {
    if (btnCarrito) btnCarrito.disabled = false;
}

window.onload = () => {
    cargarCintaPublicitaria().then(() => { iniciarNotificacionesPeriodicas(); });
    cargarProductos();
    resetBotonesEstado();
    setInterval(() => { if (!isProcessingPurchase) cargarProductos(); }, 3000);
    setInterval(() => { if (!isProcessingPurchase) cargarCintaPublicitaria(); }, 8000);
    if (userLogged && userLogged !== "false") {
        sincronizarContadorCarrito();
        setInterval(() => { if (!isProcessingPurchase) sincronizarContadorCarrito(); }, 3000);
    }
};

window.onpageshow = () => resetBotonesEstado();
document.addEventListener("click", () => initAudioContext(), { once: true });
document.addEventListener("DOMContentLoaded", () => {
    const userJson = sessionStorage.getItem("user");
    if (userJson) {
        const user = JSON.parse(userJson);
        if (!sessionStorage.getItem("welcomeAlertShown")) {
            setTimeout(() => {
                mostrarBienvenida(user.nombre);
                sessionStorage.setItem("welcomeAlertShown", "true");
            }, 1000);
        }
    }
});

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/static/js/workers/service-worker-catalogo.js').catch(() => {});
    });
}