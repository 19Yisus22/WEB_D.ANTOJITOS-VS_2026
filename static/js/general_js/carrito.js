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
        const fmt = n => n.toLocaleString('es-CO',{style:'currency',currency:'COP',maximumFractionDigits:0});

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
            const imgPath = item.imagen || item.imagen_url;
            const validImg = imgPath && imgPath.startsWith('http');

            const row = document.createElement('div');
            row.className = 'cart-item';

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
                    <span class="cart-qty-badge">${item.cantidad}</span>
                </div>
                <div class="cart-item-sub">${fmt(sub)}</div>
                <div class="cart-item-del">
                    <button class="cart-del-btn" title="Eliminar">
                        <i class="bi bi-trash3-fill"></i>
                    </button>
                </div>`;

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

        let footerHtml = `<div class="cart-footer-items">${productos.length} producto(s)</div>`;

        let descPct = 0;
        try {
            const cumplRes = await fetch('/carrito/cumpleanos');
            if (cumplRes.ok) {
                const cumplData = await cumplRes.json();
                if (cumplData.es_cumpleanos && cumplData.descuento_pct > 0) {
                    descPct = cumplData.descuento_pct;
                }
            }
        } catch (_) {}

        if (descPct > 0) {
            const descMonto = Math.round(totalGeneral * descPct / 100);
            const totalFinal = totalGeneral - descMonto;
            footerHtml += `
                <div class="cart-footer-subtotal">
                    <span>Subtotal</span><span>${fmt(totalGeneral)}</span>
                </div>
                <div class="cart-footer-discount">
                    <span>🎂 Desc. cumpleaños (${descPct}%)</span>
                    <span class="text-success fw-bold">-${fmt(descMonto)}</span>
                </div>
                <div class="cart-footer-total">
                    <span>Total</span>
                    <strong id="totalCarritoFinal">${fmt(totalFinal)}</strong>
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
            const fmt = n => n.toLocaleString('es-CO',{style:'currency',currency:'COP',maximumFractionDigits:0});
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