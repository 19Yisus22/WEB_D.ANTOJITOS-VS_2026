let productosCarrito = [];
let catalogoLocalCache = [];

function showConfirmToast(msg, callback) {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const t = document.createElement('div');
    t.className = 'custom-toast bg-dark text-white p-3 shadow-lg mb-2';
    t.style.cssText = 'border-left: 4px solid #ffc107; min-width: 300px; border-radius: 8px; pointer-events: auto !important; opacity: 1; display: block;';

    t.innerHTML = `
        <div class="mb-3">
            <i class="bi bi-exclamation-triangle text-warning me-2"></i>
            <strong>${msg}</strong>
        </div>
        <div class="d-flex gap-2 justify-content-end">
            <button class="btn btn-sm btn-outline-light border-0 btn-cancelar-confirm">Cancelar</button>
            <button class="btn btn-sm btn-warning fw-bold px-3 btn-aceptar-confirm">Confirmar</button>
        </div>`;

    container.appendChild(t);

    t.querySelector('.btn-cancelar-confirm').onclick = (e) => {
        e.stopPropagation();
        t.style.opacity = '0';
        setTimeout(() => t.remove(), 400);
    };

    t.querySelector('.btn-aceptar-confirm').onclick = (e) => {
        e.stopPropagation();
        callback();
        t.remove();
    };
}

function showMessage(msg, isError = false) {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'custom-toast bg-dark text-white p-3 shadow-lg mb-2';
    toast.style.cssText = `border-left: 4px solid ${isError ? '#dc3545' : '#198754'}; min-width: 300px; border-radius: 8px; pointer-events: auto !important;`;

    toast.innerHTML = `
        <div class="d-flex align-items-center justify-content-between">
            <div class="d-flex align-items-center">
                <i class="bi ${isError ? 'bi-x-circle text-danger' : 'bi-check-circle text-success'} me-3 fs-5"></i>
                <span>${msg}</span>
            </div>
            <i class="bi bi-x-lg ms-3 btn-close-toast" style="cursor:pointer; font-size: 0.7rem;"></i>
        </div>`;

    container.appendChild(toast);

    const remove = () => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 400);
    };

    toast.querySelector('.btn-close-toast').onclick = remove;
    setTimeout(remove, 3500);
}

function playNotificationSound() {
    try {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) return;
        const audioCtx = new AudioContextClass();
        if (audioCtx.state === 'suspended') return;
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(880, audioCtx.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(440, audioCtx.currentTime + 0.1);
        gainNode.gain.setValueAtTime(0.05, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.2);
    } catch (e) {}
}

function mostrarToastPublicidad(imagen, titulo, descripcion, isError = false) {
    const cont = document.getElementById("toastContainer");
    if (!cont) return;
    playNotificationSound();

    const t = document.createElement("div");
    t.className = "toast show bg-dark text-white border-light mb-2";
    t.style.display = "block";
    t.style.minWidth = "320px";

    const textColor = isError ? '#dc3545' : '#198754';
    const iconClass = isError ? 'bi-x-circle-fill' : 'bi-check-circle-fill';

    t.innerHTML = `
        <div class="d-flex align-items-center p-2">
            <img src="${imagen}" style="width:55px;height:55px;object-fit:cover;border-radius:8px;" class="me-3 shadow-sm">
            <div class="flex-grow-1">
                <div class="d-flex align-items-center mb-1">
                    <i class="bi ${iconClass} me-2" style="color: ${textColor};"></i>
                    <strong style="color: ${textColor};" class="mb-0">${titulo}</strong>
                </div>
                <small class="text-white-50">${descripcion}</small>
            </div>
            <button class="btn-close btn-close-white ms-2" style="font-size: 0.7rem;"></button>
        </div>`;

    cont.appendChild(t);

    const remove = () => {
        t.style.opacity = '0';
        t.style.transition = 'opacity 0.5s ease';
        setTimeout(() => t.remove(), 500);
    };

    t.querySelector('.btn-close').onclick = remove;
    setTimeout(remove, 5000);
}

async function verificarCambiosCatalogoYCarrito() {
    try {
        const resCatalogo = await fetch("/obtener_catalogo");
        if (!resCatalogo.ok) return;
        const dataCatalogo = await resCatalogo.json();
        const catalogo = dataCatalogo.productos || [];

        const resCarrito = await fetch("/obtener_carrito");
        if (!resCarrito.ok) return;
        const miCarrito = await resCarrito.json();
        const productosEnCarrito = miCarrito.productos || [];

        const cartHash = JSON.stringify(productosEnCarrito.map(p => ({ id: p.id_producto, cant: p.cantidad })));
        const lastHash = localStorage.getItem('last_cart_hash');

        if (productosEnCarrito.length > 0) {
            productosEnCarrito.forEach(itemCarrito => {
                const productoReal = catalogo.find(p => p.id_producto == itemCarrito.id_producto);
                if (productoReal) {
                    const itemAnterior = productosCarrito.find(p => p.id_producto == itemCarrito.id_producto);

                    if (itemAnterior) {
                        if (itemAnterior.stock_disponible > 0 && productoReal.stock <= 0) {
                            mostrarToastPublicidad(
                                itemCarrito.imagen || itemCarrito.imagen_url || '/static/uploads/default.png',
                                "Producto Agotado",
                                `${itemCarrito.nombre_producto} ya no está disponible`,
                                true
                            );
                            cargarCarrito();
                        } else if (itemAnterior.stock_disponible <= 0 && productoReal.stock > 0) {
                            mostrarToastPublicidad(
                                itemCarrito.imagen || itemCarrito.imagen_url || '/static/uploads/default.png',
                                "Producto Disponible",
                                `${itemCarrito.nombre_producto} vuelve a tener existencias`
                            );
                            cargarCarrito();
                        } else if (itemAnterior.stock_disponible > productoReal.stock && productoReal.stock > 0 && itemCarrito.cantidad > productoReal.stock) {
                            mostrarToastPublicidad(
                                itemCarrito.imagen || itemCarrito.imagen_url || '/static/uploads/default.png',
                                "Stock Insuficiente",
                                `${itemCarrito.nombre_producto} redujo su stock a ${productoReal.stock} unidades`,
                                true
                            );
                            cargarCarrito();
                        }
                    }

                    const index = productosCarrito.findIndex(p => p.id_producto == itemCarrito.id_producto);
                    if (index !== -1) {
                        productosCarrito[index].stock_disponible = productoReal.stock;
                    } else {
                        productosCarrito.push({ id_producto: itemCarrito.id_producto, stock_disponible: productoReal.stock });
                    }
                }
            });

            if (lastHash && lastHash !== cartHash) cargarCarrito();
            localStorage.setItem('last_cart_hash', cartHash);

            productosCarrito = productosCarrito.filter(p => 
                productosEnCarrito.some(c => c.id_producto == p.id_producto)
            );
        } else if (lastHash && lastHash !== "[]") {
            localStorage.setItem('last_cart_hash', "[]");
            cargarCarrito();
        }

        catalogoLocalCache = catalogo;
    } catch (e) {
        console.error("Error en verificación de catálogo y carrito:", e);
    }
}

async function cargarCarrito() {
    const container = document.getElementById("carritoContainer");
    const btn = document.getElementById("btnFinalizarCompra");

    try {
        const res = await fetch("/obtener_carrito");
        if (!res.ok) return;
        const data = await res.json();

        let cantidadTotalItems = 0;
        if (data.productos && data.productos.length > 0) {
            data.productos.forEach(item => cantidadTotalItems += item.cantidad);
        }

        actualizarContadorBadge(cantidadTotalItems);

        if (!container) return;
        container.innerHTML = "";

        if (!data.productos || data.productos.length === 0) {
            container.innerHTML = '<div class="p-5 text-center text-muted"><i class="bi bi-cart-x fs-1"></i><p class="mt-2">El carrito está vacío</p></div>';
            if (btn) {
                btn.style.display = "none";
                btn.disabled = false;
                btn.innerHTML = '<i class="bi bi-send me-2"></i> Enviar Pedido';
            }
            return;
        }

        if (btn) {
            btn.style.display = "inline-block";
            if (!btn.innerHTML.includes("spinner-border")) {
                btn.disabled = false;
                btn.innerHTML = '<i class="bi bi-send me-2"></i> Enviar Pedido';
            }
        }

        let totalGeneral = 0;
        const tabla = document.createElement("table");
        tabla.className = "custom-table-carrito align-middle mb-0";
        tabla.innerHTML = `
            <thead>
                <tr>
                    <th class="col-img ps-3"></th>
                    <th class="col-prod">Producto</th>
                    <th class="col-cant">Cant.</th>
                    <th class="col-sub">Subtotal</th>
                    <th class="col-del text-center"></th>
                </tr>
            </thead>
            <tbody></tbody>
            <tfoot class="table-light">
                <tr>
                    <td colspan="3" class="text-end fw-bold py-3">Total:</td>
                    <td colspan="2" class="ps-3 py-3 fw-bold fs-5 text-primary" id="totalCarritoFinal"></td>
                </tr>
            </tfoot>`;

        container.appendChild(tabla);
        const tbody = tabla.querySelector("tbody");

        data.productos.forEach(item => {
            const sub = Number(item.precio_unitario) * Number(item.cantidad);
            totalGeneral += sub;
            const tr = document.createElement("tr");
            tr.className = "cart-item-row";

            const imgPath = item.imagen || item.imagen_url;
            const fotoHtml = imgPath 
                ? `<img src="${imgPath}" class="img-preview" onerror="this.onerror=null; this.parentElement.innerHTML='<div class=\\'img-placeholder\\'><i class=\\'bi bi-box\\'></i></div>';">`
                : `<div class="img-placeholder"><i class="bi bi-box"></i></div>`;

            tr.innerHTML = `
                <td class="ps-3 py-3 col-img">${fotoHtml}</td>
                <td class="col-prod"><strong>${item.nombre_producto}</strong></td>
                <td class="col-cant"><span class="badge-qty">${item.cantidad}</span></td>
                <td class="col-sub">${sub.toLocaleString('es-CO',{style:'currency',currency:'COP', maximumFractionDigits: 0})}</td>
                <td class="col-del text-center">
                    <button class="btn btn-sm btn-outline-danger btn-quitar border-0"><i class="bi bi-trash"></i></button>
                </td>`;

            tr.querySelector(".btn-quitar").onclick = async (e) => {
                const btnQuitar = e.currentTarget;
                btnQuitar.disabled = true;
                tr.classList.add("removing");

                const r = await fetch(`/carrito_quitar/${item.id_carrito}`, { method: "DELETE" });
                if (r.ok) {
                    setTimeout(() => {
                        cargarCarrito();
                        showMessage("Producto eliminado");
                    }, 400);
                } else {
                    tr.classList.remove("removing");
                    btnQuitar.disabled = false;
                }
            };
            tbody.appendChild(tr);
        });

        const totalEl = document.getElementById("totalCarritoFinal");
        if (totalEl) totalEl.textContent = totalGeneral.toLocaleString('es-CO',{style:'currency',currency:'COP', maximumFractionDigits: 0});

    } catch(e) {
        console.error(e);
    }
}

function actualizarContadorBadge(total) {
    const badge = document.getElementById('contadorCarritoBadge');
    const totalInt = parseInt(total) || 0;
    const countAnterior = localStorage.getItem('cant_carrito');
    localStorage.setItem('cant_carrito', totalInt);

    if (badge) {
        if (totalInt > 0) {
            badge.textContent = totalInt > 99 ? '99+' : totalInt;
            badge.style.display = "flex";
            if (countAnterior != totalInt) {
                badge.classList.remove('badge-bounce');
                void badge.offsetWidth;
                badge.classList.add('badge-bounce');
            }
        } else {
            badge.style.display = "none";
        }
    }
}

async function finalizarCompra() {
    const btn = document.getElementById("btnFinalizarCompra");
    if (!btn) return;

    const originalText = `<i class="bi bi-send me-2"></i> Enviar Pedido`;
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Procesando...`;

    try {
        const res = await fetch("/finalizar_compra", {
            method: "POST",
            headers: { "Content-Type": "application/json" }
        });

        const data = await res.json();

        if (!res.ok) {
            if (res.status === 400 && data.completar_perfil) {
                showMessage(data.message);
                setTimeout(() => { window.location.href = "/mi_perfil"; }, 1000);
            } else {
                showMessage(data.message || "Error al procesar el pedido");
            }
            btn.disabled = false;
            btn.innerHTML = originalText;
            return;
        }

        showMessage("¡Pedido enviado con éxito!");
        actualizarContadorBadge(0);

        const modalElement = document.getElementById('modalCarrito');
        if (modalElement) {
            const modalInstance = bootstrap.Modal.getInstance(modalElement);
            if (modalInstance) modalInstance.hide();
        }

        await cargarCarrito();

        if (typeof monitorearCambiosFacturas === 'function') {
            monitorearCambiosFacturas();
        }

    } catch (error) {
        showMessage("Error de conexión con el servidor");
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const savedCount = localStorage.getItem('cant_carrito');
    if (savedCount && parseInt(savedCount) > 0) {
        actualizarContadorBadge(savedCount);
    }

    cargarCarrito();

    const btnFinalizar = document.getElementById("btnFinalizarCompra");
    if (btnFinalizar) btnFinalizar.onclick = finalizarCompra;

    setInterval(verificarCambiosCatalogoYCarrito, 3000);
});

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/static/js/workers/service-worker-carrito.js')
            .then(reg => console.log('SW OK'))
            .catch(err => console.error('SW Error', err));
    });
}