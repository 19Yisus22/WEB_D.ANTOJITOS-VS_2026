let productosCarrito = [];
let catalogoLocalCache = [];
let isRequesting = false;
let _descPct = 0;

const fmt = n => Number(n).toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });

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

/* ── Recalcula el total sumando los subtotales de cada fila ── */
function recalcularTotal() {
    let total = 0;
    document.querySelectorAll('.cart-item[data-subtotal]').forEach(r => {
        total += parseFloat(r.dataset.subtotal) || 0;
    });

    const totalEl    = document.getElementById('totalCarritoFinal');
    const subtotalEl = document.getElementById('cartSubtotalDisplay');
    const discEl     = document.getElementById('cartDiscountDisplay');

    if (_descPct > 0) {
        const descMonto  = Math.round(total * _descPct / 100);
        const totalFinal = total - descMonto;
        if (subtotalEl) subtotalEl.textContent = fmt(total);
        if (discEl)     discEl.textContent     = '-' + fmt(descMonto);
        if (totalEl)    totalEl.textContent    = fmt(totalFinal);
    } else {
        if (totalEl) totalEl.textContent = fmt(total);
    }

    let totalQty = 0;
    document.querySelectorAll('.cart-qty-badge').forEach(b => { totalQty += parseInt(b.textContent) || 0; });
    actualizarContadorBadge(totalQty);
}

/* ── Ajusta la cantidad de un ítem (+1 / -1) sin recargar la página ── */
async function ajustarCantidad(id_carrito, delta, row, idProducto) {
    if (isRequesting) return;
    isRequesting = true;

    const btnPlus  = row.querySelector('.cart-qty-btn.plus');
    const btnMinus = row.querySelector('.cart-qty-btn.minus');
    if (btnPlus)  btnPlus.disabled  = true;
    if (btnMinus) btnMinus.disabled = true;

    try {
        const r = await fetch(`/carrito_cantidad/${id_carrito}`, {
            method:  'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ delta }),
        });
        const data = await r.json();

        if (!data.ok) {
            showMessage(data.error || 'Error al actualizar cantidad', true);
            if (btnPlus)  btnPlus.disabled  = false;
            if (btnMinus) btnMinus.disabled = false;
            return;
        }

        if (data.eliminado) {
            row.style.transition = 'opacity 0.3s, transform 0.3s';
            row.style.opacity    = '0';
            row.style.transform  = 'translateX(20px)';
            setTimeout(() => {
                row.remove();
                recalcularTotal();
                if (!document.querySelector('.cart-item')) cargarCarrito();
            }, 300);
            window.dispatchEvent(new CustomEvent('stockActualizado', {
                detail: { id_producto: idProducto, cambio: 1 },
            }));
        } else {
            const qtyBadge = row.querySelector('.cart-qty-badge');
            const subEl    = row.querySelector('.cart-item-sub');
            if (qtyBadge) qtyBadge.textContent = data.cantidad;
            if (subEl)    subEl.textContent    = fmt(data.subtotal);
            row.dataset.subtotal = data.subtotal;
            if (btnPlus)  btnPlus.disabled  = data.stock <= 0;
            if (btnMinus) btnMinus.disabled = false;
            if (delta > 0 && data.stock <= 0) {
                const nomProducto = row.querySelector('.cart-item-name')?.textContent || 'Producto';
                const imgEl       = row.querySelector('.cart-item-img img');
                mostrarAlertaPublica({
                    titulo:   '¡Producto Agotado!',
                    mensaje:  `${nomProducto} ya no tiene stock disponible`,
                    imagen:   (imgEl && imgEl.src) || '/static/uploads/logo.png',
                    tipo:     'error',
                    duracion: 6000,
                    idUnico:  `agotado-cart-${id_carrito}-${Date.now()}`,
                    sonido:   true,
                });
            }
            recalcularTotal();
            window.dispatchEvent(new CustomEvent('stockActualizado', {
                detail: { id_producto: idProducto, cambio: delta > 0 ? -1 : 1 },
            }));
        }
    } catch {
        showMessage('Error de conexión al actualizar cantidad', true);
        if (row.isConnected) {
            if (btnPlus)  btnPlus.disabled  = false;
            if (btnMinus) btnMinus.disabled = false;
        }
    } finally {
        isRequesting = false;
    }
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

        const wrap = document.createElement('div');
        wrap.className = 'cart-list-wrap';

        const header = document.createElement('div');
        header.className = 'cart-list-header';
        header.innerHTML = `
            <span class="cart-h-product">Producto</span>
            <span class="cart-h-qty">Cant.</span>
            <span class="cart-h-price">Subtotal</span>
            <span class="cart-h-del"></span>`;
        wrap.appendChild(header);

        const list = document.createElement('div');
        list.className = 'cart-items-list';

        productos.forEach(item => {
            const sub  = Number(item.precio_unitario) * Number(item.cantidad);
            totalGeneral += sub;
            const imgPath  = item.imagen || item.imagen_url;
            const validImg = imgPath && imgPath.startsWith('http');

            const row = document.createElement('div');
            row.className        = 'cart-item';
            row.dataset.subtotal = sub;

            row.innerHTML = `
                <div class="cart-item-img">
                    ${validImg
                        ? `<img src="${imgPath}" alt="${item.nombre_producto}" loading="lazy"
                                onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
                           <div class="cart-img-ph" style="display:none;"><i class="bi bi-box-seam"></i></div>`
                        : `<div class="cart-img-ph"><i class="bi bi-box-seam"></i></div>`}
                </div>
                <div class="cart-item-info">
                    <div class="cart-item-name">${item.nombre_producto}</div>
                    <div class="cart-item-unit">${fmt(Number(item.precio_unitario))} / unidad</div>
                </div>
                <div class="cart-item-qty">
                    <div class="cart-qty-ctrl">
                        <button class="cart-qty-btn minus" title="Reducir">−</button>
                        <span class="cart-qty-badge">${item.cantidad}</span>
                        <button class="cart-qty-btn plus" title="Aumentar"${item.agotado ? ' disabled' : ''}>+</button>
                    </div>
                </div>
                <div class="cart-item-sub">${fmt(sub)}</div>
                <div class="cart-item-del">
                    <button class="cart-del-btn" title="Eliminar">
                        <i class="bi bi-trash3-fill"></i>
                    </button>
                </div>`;

            row.querySelector('.cart-qty-btn.plus').onclick  = () => ajustarCantidad(item.id_carrito,  1, row, item.id_producto);
            row.querySelector('.cart-qty-btn.minus').onclick = () => ajustarCantidad(item.id_carrito, -1, row, item.id_producto);

            row.querySelector('.cart-del-btn').onclick = () => {
                if (isRequesting) return;
                showConfirmToast(`¿Eliminar "${item.nombre_producto}" del carrito?`, async () => {
                    isRequesting = true;
                    row.style.opacity = '0.4';
                    row.style.pointerEvents = 'none';
                    try {
                        const r = await fetch(`/carrito_quitar/${item.id_carrito}`, { method: 'DELETE' });
                        if (r.ok) {
                            window.dispatchEvent(new CustomEvent('stockActualizado', {
                                detail: { id_producto: item.id_producto, cambio: item.cantidad }
                            }));
                            await cargarCarrito();
                            showMessage(`"${item.nombre_producto}" eliminado del carrito`);
                        }
                    } catch { showMessage('Error al eliminar', true); row.style.opacity='1'; row.style.pointerEvents='auto'; }
                    finally { isRequesting = false; }
                });
            };

            list.appendChild(row);
        });

        wrap.appendChild(list);

        const footer = document.createElement('div');
        footer.className = 'cart-list-footer';

        _descPct = 0;
        try {
            const cumplRes = await fetch('/carrito/cumpleanos');
            if (cumplRes.ok) {
                const cumplData = await cumplRes.json();
                if (cumplData.es_cumpleanos && cumplData.descuento_pct > 0) {
                    _descPct = cumplData.descuento_pct;
                }
            }
        } catch (_) {}

        let footerHtml = `<div class="cart-footer-items">${productos.length} producto(s)</div>`;

        if (_descPct > 0) {
            const descMonto  = Math.round(totalGeneral * _descPct / 100);
            const totalFinal = totalGeneral - descMonto;
            footerHtml += `
                <div class="cart-footer-right">
                    <div class="cart-footer-subtotal">
                        <span>Subtotal</span><span id="cartSubtotalDisplay">${fmt(totalGeneral)}</span>
                    </div>
                    <div class="cart-footer-discount">
                        <span>🎂 Desc. cumpleaños (${_descPct}%)</span>
                        <span class="text-success fw-bold" id="cartDiscountDisplay">-${fmt(descMonto)}</span>
                    </div>
                    <div class="cart-footer-total">
                        <span>Total</span>
                        <strong id="totalCarritoFinal">${fmt(totalFinal)}</strong>
                    </div>
                </div>`;
        } else {
            footerHtml += `
                <div class="cart-footer-total">
                    <span>Total</span>
                    <strong id="totalCarritoFinal">${fmt(totalGeneral)}</strong>
                </div>`;
        }

        footer.innerHTML = footerHtml;
        wrap.appendChild(footer);
        container.appendChild(wrap);

        if (typeof verificarLogros === 'function') {
            let cantTotal = 0;
            productos.forEach(p => { cantTotal += (p.cantidad || 0); });
            verificarLogros({ tipo: 'carrito', num_productos_carrito: cantTotal, valor_carrito: totalGeneral });
        }
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
        let msg = "🎉 ¡Pedido enviado con éxito! Pronto te contactaremos.";
        if (data.descuento_cumpleanos && data.descuento_monto > 0) {
            msg += ` Se aplicó descuento de cumpleaños de ${fmt(data.descuento_monto)}.`;
        }
        showMessage(msg);
        if (data.logros_nuevos && data.logros_nuevos.length > 0 && window.mostrarLogros) {
            window.mostrarLogros(data.logros_nuevos);
        }
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

async function verificarCumpleanos() {
    try {
        const res = await fetch('/carrito/cumpleanos');
        if (!res.ok) return;
        const data = await res.json();
        if (data.es_cumpleanos) {
            const banner = document.getElementById('bannerCumpleanos');
            const texto  = document.getElementById('bannerCumpleanosTexto');
            if (banner && texto) {
                const pct = data.descuento_pct || 5;
                texto.textContent = `¡Feliz cumpleaños! Tienes un ${pct}% de descuento en tu pedido de hoy 🎂`;
                banner.classList.remove('d-none');
            }
        }
    } catch (_) {}
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
    verificarCumpleanos();
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
