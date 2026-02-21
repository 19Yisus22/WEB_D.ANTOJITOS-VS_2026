let productosCarrito = [];
let catalogoLocalCache = [];
let isRequesting = false;

function showConfirmToast(msg, callback) {
    let container = document.getElementById('toastContainer');
    if (!container) {
        container = document.createElement("div");
        container.id = "toastContainer";
        container.style.cssText = "position: fixed; top: 25px; right: 25px; z-index: 10000; display: flex; flex-direction: column; gap: 12px;";
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.style.cssText = `
        background: #121212; 
        color: #ffffff; 
        padding: 20px; 
        border-radius: 15px; 
        box-shadow: 0 15px 35px rgba(0,0,0,0.4); 
        min-width: 350px; 
        max-width: 450px;
        border-left: 6px solid #ff9800; 
        transition: all 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        transform: translateX(120%);
        opacity: 0;
        pointer-events: auto;
    `;

    toast.innerHTML = `
        <div class="d-flex align-items-start mb-3">
            <div style="background: #ff9800; width: 38px; height: 38px; border-radius: 10px; display: flex; align-items: center; justify-content: center; margin-right: 15px; flex-shrink: 0;">
                <i class="bi bi-exclamation-triangle-fill text-white fs-5"></i>
            </div>
            <div class="flex-grow-1">
                <strong style="display: block; font-size: 0.8rem; text-transform: uppercase; color: #ff9800; letter-spacing: 1px;">Confirmación</strong>
                <span style="font-size: 0.95rem; font-weight: 500; line-height: 1.4;">${msg}</span>
            </div>
        </div>
        <div class="d-flex gap-2 justify-content-end">
            <button class="btn btn-sm btn-cancelar-confirm" style="color: #a4b0be; font-weight: 600; border: none; background: transparent;">CANCELAR</button>
            <button class="btn btn-sm btn-aceptar-confirm" style="background: #ff9800; color: white; font-weight: 700; border-radius: 8px; padding: 6px 15px; border: none; box-shadow: 0 4px 10px rgba(255, 152, 0, 0.3);">CONFIRMAR</button>
        </div>
    `;

    container.appendChild(toast);

    requestAnimationFrame(() => {
        toast.style.transform = "translateX(0)";
        toast.style.opacity = "1";
    });

    const cerrar = () => {
        toast.style.transform = "translateX(120%)";
        toast.style.opacity = "0";
        setTimeout(() => toast.remove(), 500);
    };

    toast.querySelector('.btn-cancelar-confirm').onclick = cerrar;
    toast.querySelector('.btn-aceptar-confirm').onclick = () => {
        callback();
        cerrar();
    };
}

function showMessage(msg, isError = false) {
    let container = document.getElementById('toastContainer');
    if (!container) {
        container = document.createElement("div");
        container.id = "toastContainer";
        container.style.cssText = "position: fixed; top: 25px; right: 25px; z-index: 10000; display: flex; flex-direction: column; gap: 12px;";
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    const colorBorde = isError ? "#ff4757" : "#ff9800";
    
    toast.style.cssText = `
        background: #121212; 
        color: #ffffff; 
        padding: 16px 24px; 
        border-radius: 12px; 
        box-shadow: 0 10px 30px rgba(0,0,0,0.3); 
        display: flex; 
        justify-content: space-between; 
        align-items: center; 
        min-width: 350px; 
        max-width: 450px;
        border-left: 6px solid ${colorBorde}; 
        transition: all 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        transform: translateX(120%);
        opacity: 0;
    `;

    toast.innerHTML = `
        <div class="d-flex align-items-center">
            <div style="background: ${colorBorde}; width: 35px; height: 35px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-right: 15px; flex-shrink: 0;">
                <i class="bi ${isError ? 'bi-x-lg' : 'bi-check-lg'} text-white fs-5"></i>
            </div>
            <div>
                <strong style="display: block; font-size: 0.75rem; text-transform: uppercase; color: ${colorBorde}; opacity: 0.9;">Carrito</strong>
                <span style="font-size: 0.95rem; font-weight: 600;">${msg}</span>
            </div>
        </div>
        <i class="bi bi-x-lg ms-3 btn-close-toast" style="cursor:pointer; font-size: 1rem; color: #57606f;"></i>
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
    setTimeout(eliminar, 4000);
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
    let container = document.getElementById("toastContainer");
    if (!container) {
        container = document.createElement("div");
        container.id = "toastContainer";
        container.style.cssText = "position: fixed; top: 25px; right: 25px; z-index: 10000; display: flex; flex-direction: column; gap: 12px;";
        document.body.appendChild(container);
    }

    playNotificationSound();
    const toast = document.createElement("div");
    const colorStatus = isError ? "#ff4757" : "#ff9800";

    toast.style.cssText = `
        background: #121212; 
        color: #ffffff; 
        padding: 12px; 
        border-radius: 15px; 
        box-shadow: 0 12px 25px rgba(0,0,0,0.4); 
        min-width: 350px; 
        max-width: 450px;
        border-left: 6px solid ${colorStatus}; 
        transition: all 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        transform: translateX(120%);
        opacity: 0;
    `;

    toast.innerHTML = `
        <div class="d-flex align-items-center">
            <div style="position: relative; margin-right: 15px; flex-shrink: 0;">
                <img src="${imagen}" style="width:65px; height:65px; object-fit:cover; border-radius:12px; border: 1px solid #333;">
                <div style="position: absolute; bottom: -5px; right: -5px; background: ${colorStatus}; width: 22px; height: 22px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 2px solid #121212;">
                    <i class="bi ${isError ? 'bi-x' : 'bi-check'} text-white" style="font-size: 0.8rem;"></i>
                </div>
            </div>
            <div class="flex-grow-1" style="overflow: hidden;">
                <strong style="display: block; color: ${colorStatus}; font-size: 0.85rem; text-transform: uppercase;">${titulo}</strong>
                <p style="margin: 0; font-size: 0.9rem; color: #ecf0f1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${descripcion}</p>
            </div>
            <button class="btn-close-toast" style="background: transparent; border: none; color: #57606f; padding-left: 10px;">
                <i class="bi bi-x-lg"></i>
            </button>
        </div>
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
    setTimeout(eliminar, 5000);
}

async function cargarCarrito() {
    const container = document.getElementById("carritoContainer");
    const btn = document.getElementById("btnFinalizarCompra");
    
    try {
        const res = await fetch("/obtener_carrito");
        if (!res.ok) return;
        const data = await res.json();
        const productos = data.productos || [];

        let cantidadTotalItems = 0;
        productos.forEach(item => cantidadTotalItems += item.cantidad);
        actualizarContadorBadge(cantidadTotalItems);

        if (!container) return;
        container.innerHTML = "";

        if (productos.length === 0) {
            if (btn) btn.style.display = "none";
            container.innerHTML = '<div class="p-5 text-center text-muted"><i class="bi bi-cart-x fs-1"></i><p class="mt-2">El carrito está vacío</p></div>';
            return;
        }

        if (btn) {
            btn.style.display = "inline-block";
            btn.innerHTML = '<i class="bi bi-send me-2"></i> Enviar Pedido';
            btn.disabled = false;
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

        productos.forEach(item => {
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
                if (isRequesting) return;
                
                showConfirmToast(`¿Deseas eliminar "${item.nombre_producto}" del carrito?`, async () => {
                    isRequesting = true;
                    const idProd = item.id_producto;
                    const cantRetornar = item.cantidad;

                    tr.style.opacity = '0.5';
                    tr.style.pointerEvents = 'none';

                    try {
                        const r = await fetch(`/carrito_quitar/${item.id_carrito}`, { method: "DELETE" });
                        if (r.ok) {
                            const event = new CustomEvent('stockActualizado', { 
                                detail: { id_producto: idProd, cambio: cantRetornar } 
                            });
                            window.dispatchEvent(event);
                            
                            await cargarCarrito();
                            showMessage("Producto eliminado correctamente");
                        }
                    } catch (err) {
                        showMessage("Error al eliminar el producto", true);
                        tr.style.opacity = '1';
                        tr.style.pointerEvents = 'auto';
                    } finally {
                        isRequesting = false;
                    }
                });
            };
            tbody.appendChild(tr);
        });

        document.getElementById("totalCarritoFinal").textContent = totalGeneral.toLocaleString('es-CO',{style:'currency',currency:'COP', maximumFractionDigits: 0});
    } catch(e) {}
}

function actualizarContadorBadge(total) {
    const badge = document.getElementById('contadorCarritoBadge');
    const totalInt = parseInt(total) || 0;
    localStorage.setItem('cant_carrito', totalInt);
    if (badge) {
        if (totalInt > 0) {
            badge.textContent = totalInt > 99 ? '99+' : totalInt;
            badge.style.display = "flex";
        } else {
            badge.style.display = "none";
        }
    }
}

async function finalizarCompra() {
    const btn = document.getElementById("btnFinalizarCompra");
    if (!btn || isRequesting) return;
    isRequesting = true;
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner-border spinner-border-sm"></span>`;
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
                showMessage(data.message || "Error procesando pedido", true);
            }
            btn.disabled = false;
            btn.innerHTML = originalText;
            return;
        }
        showMessage("¡Pedido enviado con éxito!");
        actualizarContadorBadge(0);
        const modal = bootstrap.Modal.getInstance(document.getElementById('modalCarrito'));
        if (modal) modal.hide();
        await cargarCarrito();
        if (typeof monitorearCambiosFacturas === 'function') monitorearCambiosFacturas();
    } catch (error) {
        showMessage("Error de conexión con el servidor", true);
        btn.disabled = false;
        btn.innerHTML = originalText;
    } finally {
        isRequesting = false;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const btnFinalizar = document.getElementById("btnFinalizarCompra");
    if (btnFinalizar) {
        btnFinalizar.style.display = "none";
        btnFinalizar.onclick = finalizarCompra;
    }
    const savedCount = localStorage.getItem('cant_carrito');
    if (savedCount) actualizarContadorBadge(savedCount);
    cargarCarrito();
});

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/static/js/workers/service-worker-carrito.js')
            .then(reg => console.log('SW OK'))
            .catch(err => console.error('SW Error', err));
    });
}