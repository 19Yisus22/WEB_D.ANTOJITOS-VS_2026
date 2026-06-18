const catalogoContainer = document.getElementById("catalogoProductos");
const btnFiltrar = document.getElementById("btnFiltrar");
const searchInput = document.getElementById("searchInput");
const toastContainer = document.getElementById("toastContainer");
const btnCarrito = document.getElementById("btnCarrito");
const badgeCarrito = document.getElementById("contadorCarritoBadge");

let productos = [];
let categorias = [];
let filtroCategoria = 'Todas';
let filtroIndex = 0; 
let contadorCarrito = 0;
let isFirstLoad = true;
let isProcessingPurchase = false;
let searchTimeout = null;
const productosNotificados = new Set();
const filtros = ['', 'Recientes', 'Antiguos', 'Favoritos']; 
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
        imagen: '/static/uploads/logo.ico',
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
        imagen: "/static/uploads/logo.ico",
        tipo: "bienvenida",
        duracion: 5000
    });
}

async function cargarCategorias() {
    try {
        const res = await fetch('/api/categorias');
        const data = await res.json();
        categorias = data.categorias || [];
    } catch (_) {
        categorias = [];
    }
    const sel = document.getElementById('selectCategoria');
    const row = document.getElementById('categoriasFilterRow');
    if (!sel) return;
    sel.innerHTML = '<option value="Todas">Todas las categorías</option>';
    categorias.forEach(cat => {
        const opt = document.createElement('option');
        opt.value = cat;
        opt.textContent = cat;
        sel.appendChild(opt);
    });
    if (row) row.style.display = categorias.length > 0 ? 'block' : 'none';
    sel.onchange = () => {
        filtroCategoria = sel.value;
        renderProductos(searchInput.value);
    };
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
                        mostrarToastActualizacion(nuevo.imagen_url || '/static/uploads/logo.ico', "¡Agotado!", `${nuevo.nombre} se ha terminado`, `agotado-${nuevo.id_producto}`, true);
                        huboCambios = true;
                    } else if (viejo.stock <= 0 && nuevo.stock > 0) {
                        mostrarToastActualizacion(nuevo.imagen_url || '/static/uploads/logo.ico', "¡De Vuelta!", `${nuevo.nombre} disponible`, `disponible-${nuevo.id_producto}`, false);
                        huboCambios = true;
                    } else if (viejo.stock !== nuevo.stock || viejo.precio !== nuevo.precio) {
                        huboCambios = true;
                    }
                }
            });
            const viejosIds = new Set(productos.map(p => p.id_producto));
            const nuevos = nuevosProductos.filter(p => !viejosIds.has(p.id_producto));
            nuevos.forEach(nuevo => {
                mostrarToastActualizacion(nuevo.imagen_url || '/static/uploads/logo.ico', "¡Nuevo!", `${nuevo.nombre} disponible`, `nuevo-${nuevo.id_producto}`, false);
                huboCambios = true;
            });
            const nuevosIds = new Set(nuevosProductos.map(p => p.id_producto));
            const eliminados = productos.filter(p => !nuevosIds.has(p.id_producto));
            eliminados.forEach(eliminado => {
                mostrarToastActualizacion(eliminado.imagen_url || '/static/uploads/logo.ico', "Eliminado", `${eliminado.nombre} ha sido eliminado`, `eliminado-${eliminado.id_producto}`, true);
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

    if (filtroCategoria !== 'Todas') {
        baseFiltrada = baseFiltrada.filter(p => (p.categoria || 'Sin categoría') === filtroCategoria);
    }

    const filtroActivo = filtros[filtroIndex];
    if (filtroActivo === 'Favoritos') {
        baseFiltrada = baseFiltrada.filter(p => favoritos.includes(p.id_producto.toString()));
    } else if (filtroActivo === 'Recientes') {
        baseFiltrada.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
    } else if (filtroActivo === 'Antiguos') {
        baseFiltrada.sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
    }

    const disponibles = baseFiltrada.filter(p => p.stock > 0);
    const agotados    = baseFiltrada.filter(p => p.stock <= 0);

    
    const usarGrupoCategorias = filtroCategoria === 'Todas'
        && categorias.length > 0
        && filtroIndex === 0;

    if (usarGrupoCategorias) {
        _renderProductosPorCategoria(disponibles, agotados);
    } else {
        if (disponibles.length > 0) {
            const headerDisp = document.createElement("div");
            headerDisp.className = "col-12 mt-2 mb-4";
            headerDisp.innerHTML = `
                <div class="seccion-titulo-contenedor">
                    <h3 class="seccion-titulo"><i class="bi bi-check2-circle me-2 color-disponible"></i> ${t('cat.available')}</h3>
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
                    <h3 class="seccion-titulo"><i class="bi bi-x-circle me-2 color-agotado"></i> ${t('cat.soldout')}</h3>
                    <div class="linea-decorativa linea-disponible"></div>
                </div>
                <div class="row g-4 mt-1" id="gridAgotados"></div>`;
            catalogoContainer.appendChild(headerAgot);
            const gridAgot = document.getElementById("gridAgotados");
            agotados.forEach(p => gridAgot.appendChild(crearCardProductoHTML(p, "agot")));
        }
        if (baseFiltrada.length === 0) {
            const msgVacio = filtroActivo === 'Favoritos' ? t('cat.no_favorites') : t('cat.no_results');
            catalogoContainer.innerHTML = `<div class="col-12 text-center py-5 text-muted">${msgVacio}</div>`;
        }
    }
    agregarEventosProductos();
}

function _renderProductosPorCategoria(disponibles, agotados) {
    const catOrden = [...categorias];
    const extraCats = [...new Set(disponibles.map(p => p.categoria || 'Sin categoría'))].filter(c => !catOrden.includes(c));
    extraCats.forEach(c => catOrden.push(c));

    let hayAlgo = false;
    catOrden.forEach(cat => {
        const prods = disponibles.filter(p => (p.categoria || 'Sin categoría') === cat);
        if (prods.length === 0) return;
        hayAlgo = true;
        const safeCat = cat.replace(/[^a-z0-9]/gi, '_');
        const sep = document.createElement('div');
        sep.className = 'col-12 cat-sep-wrapper';
        sep.innerHTML = `
            <div class="cat-sep-header">
                <div class="cat-sep-line"></div>
                <span class="cat-sep-label"><i class="bi bi-tag-fill me-2"></i>${cat}</span>
                <div class="cat-sep-line"></div>
            </div>
            <div class="row g-2 g-md-4 mt-1 justify-content-start" id="catGrid_${safeCat}"></div>`;
        catalogoContainer.appendChild(sep);
        const grid = sep.querySelector(`#catGrid_${safeCat}`);
        prods.forEach(p => grid.appendChild(crearCardProductoHTML(p)));
    });

    if (agotados.length > 0) {
        const headerAgot = document.createElement('div');
        headerAgot.className = 'col-12 mt-5 mb-4';
        headerAgot.innerHTML = `
            <div class="seccion-titulo-contenedor">
                <h3 class="seccion-titulo"><i class="bi bi-x-circle me-2 color-agotado"></i> ${t('cat.soldout')}</h3>
                <div class="linea-decorativa linea-disponible"></div>
            </div>
            <div class="row g-4 mt-1" id="gridAgotados"></div>`;
        catalogoContainer.appendChild(headerAgot);
        const gridAgot = headerAgot.querySelector('#gridAgotados');
        agotados.forEach(p => gridAgot.appendChild(crearCardProductoHTML(p, 'agot')));
        hayAlgo = true;
    }

    if (!hayAlgo) {
        catalogoContainer.innerHTML = `<div class="col-12 text-center py-5 text-muted">${t('cat.no_results')}</div>`;
    }
}

function crearCardProductoHTML(p, prefix = "") {
    const col = document.createElement("div");
    col.className = `col-6 col-md-4 col-lg-3 mb-3 fade-in`;
    col.dataset.id = p.id_producto;
    const isAgotado = p.stock <= 0;
    const imgUrl = (p.imagen_url && p.imagen_url.startsWith('http')) ? p.imagen_url : '';
    const imgHTML = imgUrl
        ? `<img src="${imgUrl}" alt="${p.nombre}" loading="lazy"
               style="width:100%;height:100%;object-fit:contain;opacity:0;transition:opacity .35s ease;"
               onload="this.style.opacity='1'"
               onerror="this.style.display='none';this.nextElementSibling&&(this.nextElementSibling.style.display='flex')">`
        : '';
    const isFav = favoritos.includes(p.id_producto.toString());
    col.innerHTML = `
        <div class="card product-card ${isAgotado ? 'producto-gris' : ''}" style="cursor:pointer;border-radius:20px;border:1px solid rgba(0,0,0,0.05);">
            <div class="img-wrapper position-relative overflow-hidden" style="border-radius:20px 20px 0 0;">
                ${imgHTML}
                <div class="img-not-available" style="${imgUrl ? 'display:none;' : ''}position:absolute;inset:0;">
                    <i class="bi bi-image-slash"></i><span>${t('status.no_image')}</span>
                </div>
                ${isAgotado ? `<div class="letrero-agotado">${t('cat.out_stock')}</div>` : ''}
                <button class="btn-favorito-floating ${isFav ? 'activo' : ''}" title="${isFav ? 'Quitar de favoritos' : 'Añadir a favoritos'}">
                    <i class="bi ${isFav ? 'bi-heart-fill' : 'bi-heart'}"></i>
                </button>
            </div>
            <div class="card-body p-2 d-flex flex-column gap-1 align-items-center text-center">
                <h6 class="fw-bold mb-0 w-100" style="font-size:0.85rem;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;line-height:1.3;">${p.nombre}</h6>
                <span class="badge mb-1" style="background:rgba(243,156,18,0.12);color:var(--primary-color,#d35400);font-size:0.82rem;font-weight:700;">${fmtCOP(p.precio)}</span>
                <span class="badge mb-1" style="background:${p.stock <= 0 ? 'rgba(231,76,60,0.1)' : p.stock < 5 ? 'rgba(243,156,18,0.1)' : 'rgba(39,174,96,0.1)'};color:${p.stock <= 0 ? '#c0392b' : p.stock < 5 ? '#e67e22' : '#27ae60'};font-size:0.72rem;font-weight:700;"><i class="bi bi-box-seam me-1"></i>${p.stock} uds.</span>
                ${!isAgotado ? `
                    <div class="modern-quantity-control mx-auto mt-1">
                        <button class="qty-btn btn-disminuir">-</button>
                        <input type="number" readonly value="1" class="cantidad" style="width:28px;border:none;text-align:center;background:transparent;font-size:0.85rem;">
                        <button class="qty-btn btn-aumentar">+</button>
                    </div>
                    <button class="btn btn-warning text-white fw-bold btn-agregar-modern py-1 mt-1" style="font-size:0.78rem;border-radius:12px;">
                        ${t('cat.add')} <i class="bi bi-cart-plus"></i>
                    </button>
                ` : `<button class="btn btn-secondary w-100 disabled py-1 mt-1" style="font-size:0.78rem;border-radius:12px;" disabled>${t('cat.out_stock')}</button>`}
            </div>
        </div>`;
    const card = col.querySelector('.product-card');
    card._prodData = p;
    card.addEventListener('click', function(e) {
        if (e.target.closest('.btn-agregar-modern,.qty-btn,.cantidad,.btn-disminuir,.btn-aumentar,.btn-secondary,.btn-favorito-floating')) return;
        abrirModalProducto(this._prodData);
    });
    const btnFavCard = col.querySelector('.btn-favorito-floating');
    if (btnFavCard) {
        btnFavCard.addEventListener('click', (e) => {
            e.stopPropagation();
            const idStr = p.id_producto.toString();
            const eraFav = favoritos.includes(idStr);
            const seraFav = !eraFav;
            // Update icon immediately (visual feedback before re-render)
            btnFavCard.classList.toggle('activo', seraFav);
            btnFavCard.querySelector('i').className = `bi ${seraFav ? 'bi-heart-fill' : 'bi-heart'}`;
            // Update data + persist + show toast (renderProductos called inside if Favoritos filter)
            if (eraFav) {
                favoritos.splice(favoritos.indexOf(idStr), 1);
                mostrarToastFavorito("Postre eliminado de favoritos", false);
            } else {
                favoritos.push(idStr);
                mostrarToastFavorito("Postre añadido a favoritos", true);
            }
            localStorage.setItem('mis_favoritos_postres', JSON.stringify(favoritos));
            if (filtros[filtroIndex] === 'Favoritos') renderProductos(searchInput.value);
        });
    }
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
                        productoArray.imagen_url || '/static/uploads/logo.ico',
                        '🛒 Añadido al carrito',
                        `${cantidadPedida}x ${productoArray.nombre} — ${fmtCOP(productoArray.precio * cantidadPedida)}`
                    );
                    if (productoArray.stock <= 0) {
                        mostrarAlertaPublica({
                            titulo:   '¡Producto Agotado!',
                            mensaje:  `${productoArray.nombre} ya no tiene stock disponible`,
                            imagen:   productoArray.imagen_url || '/static/uploads/logo.ico',
                            tipo:     'error',
                            duracion: 6000,
                            idUnico:  `agotado-${id_producto}-${Date.now()}`,
                            sonido:   true,
                        });
                    }
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

function _crearModalCatalogo() {
    if (document.getElementById('modalDetalleProd')) return;
    const el = document.createElement('div');
    el.id = 'modalDetalleProd';
    el.className = 'modal fade';
    el.setAttribute('tabindex', '-1');
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML = `
        <div class="modal-dialog modal-lg modal-dialog-centered">
            <div class="modal-content rounded-4 border-0">
                <div class="modal-header border-0 pb-0 px-4 pt-3">
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body p-4 pt-2">
                    <div class="row g-4">
                        <div class="col-md-5">
                            <div class="modal-prod-img-wrap">
                                <img id="mprodImg" alt="" style="width:100%;height:100%;object-fit:contain;">
                                <div id="mprodImgNo" class="mprod-no-img" style="display:none;">
                                    <i class="bi bi-image-slash" style="font-size:2.5rem;"></i>
                                    <small>Sin imagen</small>
                                </div>
                            </div>
                        </div>
                        <div class="col-md-7 d-flex flex-column gap-3">
                            <div>
                                <h4 id="mprodNombre" class="fw-bold mb-1"></h4>
                                <div id="mprodPrecio" class="fs-5 fw-bold" style="color:var(--primary-color,#d35400);"></div>
                            </div>
                            <small id="mprodStock" class="fw-bold"></small>
                            <p id="mprodDesc" class="text-muted mb-0" style="font-size:0.9rem;line-height:1.6;white-space:pre-wrap;"></p>
                            <div id="mprodCtrl" class="d-flex flex-column gap-2 mt-auto">
                                <div class="modern-quantity-control">
                                    <button class="qty-btn" id="mprodMenos">-</button>
                                    <input type="number" readonly value="1" id="mprodCant" class="cantidad" style="width:40px;border:none;text-align:center;background:transparent;font-weight:700;font-size:1rem;">
                                    <button class="qty-btn" id="mprodMas">+</button>
                                </div>
                                <div class="d-flex gap-2">
                                    <button id="mprodFav" class="btn btn-outline-danger flex-shrink-0" style="border-radius:12px;padding:0.5rem 0.9rem;">
                                        <i class="bi bi-heart"></i>
                                    </button>
                                    <button id="mprodAgregar" class="btn btn-warning text-white fw-bold flex-grow-1" style="border-radius:12px;font-size:0.9rem;">
                                        ${t('cat.add')} <i class="bi bi-cart-plus ms-1"></i>
                                    </button>
                                </div>
                            </div>
                            <div id="mprodAgotado" style="display:none;">
                                <button class="btn btn-secondary w-100 disabled" disabled>${t('cat.out_stock')}</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>`;
    document.body.appendChild(el);
    document.getElementById('mprodMenos').onclick = () => {
        const inp = document.getElementById('mprodCant');
        if (parseInt(inp.value) > 1) inp.value = parseInt(inp.value) - 1;
    };
    document.getElementById('mprodMas').onclick = () => {
        const inp = document.getElementById('mprodCant');
        const max = parseInt(inp.dataset.stock || 99);
        if (parseInt(inp.value) < max) inp.value = parseInt(inp.value) + 1;
        else showMessage(t('cat.no_stock') || 'Sin stock suficiente', true);
    };
}

function abrirModalProducto(p) {
    _crearModalCatalogo();
    const prod = productos.find(x => x.id_producto == p.id_producto) || p;
    const isAgotado = prod.stock <= 0;

    document.getElementById('mprodNombre').textContent = prod.nombre;
    document.getElementById('mprodPrecio').textContent = fmtCOP(prod.precio);
    document.getElementById('mprodDesc').textContent = prod.description || prod.descripcion || '';

    const stockEl = document.getElementById('mprodStock');
    stockEl.textContent = `${t('cat.stock')}: ${prod.stock}`;
    stockEl.className = `fw-bold ${prod.stock < 5 ? 'text-danger' : 'text-success'}`;

    const imgEl = document.getElementById('mprodImg');
    const imgNo  = document.getElementById('mprodImgNo');
    if (prod.imagen_url && prod.imagen_url.startsWith('http')) {
        imgEl.src = prod.imagen_url;
        imgEl.style.display = 'block';
        imgNo.style.display = 'none';
        imgEl.onerror = () => { imgEl.style.display = 'none'; imgNo.style.display = 'flex'; };
    } else {
        imgEl.style.display = 'none';
        imgNo.style.display = 'flex';
    }

    const cantEl = document.getElementById('mprodCant');
    cantEl.value = 1;
    cantEl.dataset.stock = prod.stock;

    document.getElementById('mprodCtrl').style.display   = isAgotado ? 'none' : 'flex';
    document.getElementById('mprodAgotado').style.display = isAgotado ? 'block' : 'none';

    const btnFav = document.getElementById('mprodFav');
    const esFav  = favoritos.includes(prod.id_producto.toString());
    btnFav.innerHTML = `<i class="bi ${esFav ? 'bi-heart-fill text-danger' : 'bi-heart'}"></i>`;
    btnFav.onclick = () => {
        toggleFavorito(prod.id_producto);
        const ahora = favoritos.includes(prod.id_producto.toString());
        btnFav.innerHTML = `<i class="bi ${ahora ? 'bi-heart-fill text-danger' : 'bi-heart'}"></i>`;
    };

    const btnAgregar = document.getElementById('mprodAgregar');
    btnAgregar.onclick = async () => {
        if (isProcessingPurchase) return;
        initAudioContext();
        if (!userLogged || userLogged === "false") {
            showMessage("Inicie sesión para comprar", true);
            return;
        }
        const cantidad = parseInt(cantEl.value);
        if (cantidad <= 0) return;
        isProcessingPurchase = true;
        const original = btnAgregar.innerHTML;
        btnAgregar.disabled = true;
        btnAgregar.innerHTML = `<span class="spinner-border spinner-border-sm"></span>`;
        try {
            const res = await fetch("/guardar_catalogo", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ productos: [{ id_producto: prod.id_producto, cantidad }] })
            });
            if (res.ok) {
                prod.stock -= cantidad;
                actualizarContadorCarrito(cantidad);
                mostrarToastPublicidad(
                    prod.imagen_url || '/static/uploads/logo.ico',
                    '🛒 Añadido al carrito',
                    `${cantidad}x ${prod.nombre} — ${fmtCOP(prod.precio * cantidad)}`
                );
                if (prod.stock <= 0) {
                    mostrarAlertaPublica({
                        titulo:   '¡Producto Agotado!',
                        mensaje:  `${prod.nombre} ya no tiene stock disponible`,
                        imagen:   prod.imagen_url || '/static/uploads/logo.ico',
                        tipo:     'error',
                        duracion: 6000,
                        idUnico:  `agotado-${prod.id_producto}-${Date.now()}`,
                        sonido:   true,
                    });
                }
                bootstrap.Modal.getInstance(document.getElementById('modalDetalleProd'))?.hide();
                renderProductos(searchInput.value);
            } else {
                const err = await res.json();
                showMessage(err.message || 'Error al añadir', true);
                await cargarProductos();
            }
        } catch {
            showMessage('Error de conexión', true);
        } finally {
            isProcessingPurchase = false;
            btnAgregar.disabled = false;
            btnAgregar.innerHTML = original;
        }
    };

    new bootstrap.Modal(document.getElementById('modalDetalleProd')).show();
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
    const etiqueta = filtros[filtroIndex];
    if (filtroIndex === 0) {
        btnFiltrar.innerHTML = `<i class="bi bi-funnel me-2"></i>Filtrar`;
        btnFiltrar.classList.remove('btn-warning');
        btnFiltrar.classList.add('btn-dark');
    } else {
        btnFiltrar.innerHTML = `<i class="bi bi-funnel-fill me-2"></i>${etiqueta}`;
        btnFiltrar.classList.remove('btn-dark');
        btnFiltrar.classList.add('btn-warning');
    }
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
    cargarCategorias().then(() => cargarProductos());
    resetBotonesEstado();
    setInterval(() => { if (!isProcessingPurchase) cargarProductos(); }, 20000);
    if (userLogged && userLogged !== "false") {
        sincronizarContadorCarrito();
        setInterval(() => { if (!isProcessingPurchase) sincronizarContadorCarrito(); }, 30000);
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
