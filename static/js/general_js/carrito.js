let productosCarrito = [];
let catalogoLocalCache = [];
let isRequesting = false;

function showConfirmToast(msg, callback) {
    mostrarConfirmacionApp('Confirmación', msg, callback);
}

function showMessage(msg, isError = false) {
    mostrarAlertaPublica({ mensaje: msg, tipo: isError ? 'error' : 'success', titulo: 'Carrito' });
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
    mostrarAlertaPublica({ imagen, titulo, mensaje: descripcion, tipo: isError ? 'error' : 'info' });
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
            const validImg = imgPath && imgPath.startsWith('http');
            const fotoHtml = validImg
                ? `<img src="${imgPath}" class="img-preview" loading="lazy"
                       style="display:block;"
                       onerror="this.style.display='none';this.nextElementSibling&&(this.nextElementSibling.style.display='flex')">
                   <div class="img-placeholder" style="display:none;"><i class="bi bi-box"></i></div>`
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
                            showMessage(`🗑️ "${item.nombre_producto}" eliminado del carrito`);
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
        showMessage("🎉 ¡Pedido enviado con éxito! Pronto te contactaremos.");
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
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/static/js/workers/service-worker-carrito.js')
            .then(reg => console.log('SW OK'))
            .catch(err => console.error('SW Error', err));
    });
}