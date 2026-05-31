const catalogoContainer = document.getElementById("catalogoProductos");
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

function mostrarAlerta(opciones = {}) {
    mostrarAlertaPublica(opciones);
}

function mostrarToastFavorito(mensaje, isAdd) {
    playNotificationSound(isAdd ? 'default' : 'agotado');
    mostrarAlertaPublica({
        mensaje,
        titulo: isAdd ? '❤️ Favoritos' : 'Favoritos',
        tipo: isAdd ? 'favorito' : 'info',
        duracion: 3000,
        imagen: '/static/uploads/logo.png',
        sonido: false
    });
}

function showMessage(msg, isError = false) {
    mostrarAlertaPublica({ mensaje: msg, tipo: isError ? 'error' : 'success', titulo: isError ? 'Error' : 'Éxito', duracion: 3000 });
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
        // Debug: verificar URLs de imágenes
        if (nuevosProductos.length > 0) {
            const conImg = nuevosProductos.filter(p => p.imagen_url && p.imagen_url.startsWith('http'));
            if (conImg.length === 0 && isFirstLoad) {
                console.warn('[D\'Antojitos] Ningún producto tiene imagen_url válida. Verifica Cloudinary.');
            }
        }
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
            // Detectar productos nuevos
            const viejosIds = new Set(productos.map(p => p.id_producto));
            const nuevos = nuevosProductos.filter(p => !viejosIds.has(p.id_producto));
            nuevos.forEach(nuevo => {
                mostrarToastActualizacion(nuevo.imagen_url || '/static/uploads/logo.png', "¡Nuevo!", `${nuevo.nombre} disponible`, `nuevo-${nuevo.id_producto}`, false);
                huboCambios = true;
            });
            // Detectar productos eliminados
            const nuevosIds = new Set(nuevosProductos.map(p => p.id_producto));
            const eliminados = productos.filter(p => !nuevosIds.has(p.id_producto));
            eliminados.forEach(eliminado => {
                mostrarToastActualizacion(eliminado.imagen_url || '/static/uploads/logo.png', "Eliminado", `${eliminado.nombre} ha sido eliminado`, `eliminado-${eliminado.id_producto}`, true);
                huboCambios = true;
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
    const disponibles = baseFiltrada.filter(p => p.stock > 0);
    const agotados = baseFiltrada.filter(p => p.stock <= 0);
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
    const imgUrl = (p.imagen_url && p.imagen_url.startsWith('http')) ? p.imagen_url : '';
    const uniqueId = `${prefix}-${p.id_producto}`;
    const imgHTML = imgUrl
        ? `<img src="${imgUrl}" alt="${p.nombre}" loading="lazy"
               style="width:100%;height:100%;object-fit:cover;display:block;"
               onerror="this.style.display='none';this.nextElementSibling&&(this.nextElementSibling.style.display='flex')">
           <div class="img-not-available" style="display:none;"><i class="bi bi-image-slash"></i><span>Sin imagen</span></div>`
        : `<div class="img-not-available"><i class="bi bi-image-slash"></i><span>Sin imagen</span></div>`;
    col.innerHTML = `
        <div class="card h-100 product-card shadow-sm ${isAgotado ? 'producto-gris' : ''}" style="border-radius: 20px; border: 1px solid rgba(0,0,0,0.05);">
            <div class="img-wrapper position-relative overflow-hidden" style="height: 200px; border-radius: 20px 20px 0 0;">
                <button class="btn-favorito-floating btn-fav-toggle" id="fav-btn-${uniqueId}" data-id="${p.id_producto}">
                    <i class="bi ${esFav ? 'bi-heart-fill text-danger' : 'bi-heart text-muted'}"></i>
                </button>
                ${imgHTML}
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
                    mostrarToastPublicidad(
                        productoArray.imagen_url || '/static/uploads/logo.png',
                        '🛒 Añadido al carrito',
                        `${cantidadPedida}x ${productoArray.nombre} — $${(productoArray.precio * cantidadPedida).toLocaleString()}`
                    );
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
    cargarProductos();
    resetBotonesEstado();
    setInterval(() => { if (!isProcessingPurchase) cargarProductos(); }, 3000);
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
    window.addEventListener('load', () => {navigator.serviceWorker.register('/static/js/workers/service-worker-catalogo.js') .then(() => console.log('SW OK')) .catch(err => console.error('SW Error', err));});
}