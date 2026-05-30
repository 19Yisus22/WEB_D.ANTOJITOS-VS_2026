const toastContainer = document.getElementById('toastContainer');
const itemsPorPagina = 10;
let pedidosGlobal = [];
let pedidosDatosRaw = [];
let pedidosFiltrados = [];
let ultimosIdsCancelados = [];
let pedidosCanceladosVerificados = JSON.parse(localStorage.getItem("pedidosCanceladosVerificados") || "[]");
let estadosPagoGuardados = JSON.parse(localStorage.getItem("estadosPagoItems") || "{}");
let pedidosFijados = JSON.parse(localStorage.getItem("pedidosFijados") || "[]");
let paginaActual = 1;
let contadorFacturasPorAnio = JSON.parse(localStorage.getItem("contadorFacturasPorAnio") || "{}");
let ultimoIdPedidoNotificado = parseInt(localStorage.getItem("ultimoIdPedidoNotificado") || "0");
let debounceTimer;

const sonidoNuevoPedido = new Audio('https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3');
sonidoNuevoPedido.volume = 0.9;

function debouncedCargarPedidos(isAutoRefresh = false) {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => cargarPedidos(isAutoRefresh), 800);
}

function escucharEventosTiempoReal() {
    window.addEventListener('storage', (e) => {
        if (e.key === 'nuevoPedidoDetectado' || e.key === 'facturaActualizada' || e.key === 'pedidoAnuladoRecientemente') {
            debouncedCargarPedidos(true);
        }
    });

    document.addEventListener('pedidosActualizados', () => {
        debouncedCargarPedidos(true);
    });

    window.addEventListener('focus', () => {
        debouncedCargarPedidos(true);
    });
}

function mostrarNotificacionBienvenida() {
    const yaNotificado = sessionStorage.getItem("notificacionBienvenidaMostrada");
    if (yaNotificado) return;

    try {
        if (pedidosDatosRaw.length === 0) {
            mostrarAlerta("Sistema listo. No hay pedidos pendientes.", false, 3000);
        } else {
            const maxIdActual = Math.max(...pedidosDatosRaw.map(p => p.id_pedido));
            const ultimoPedido = pedidosDatosRaw.find(p => p.id_pedido === maxIdActual);
            if (ultimoPedido) {
                const numFactura = generarNumeroFactura(ultimoPedido.id_pedido, ultimoPedido.fecha_pedido);
                const cliente = `${ultimoPedido.usuarios?.nombre || 'Cliente'} ${ultimoPedido.usuarios?.apellido || ''}`;
                mostrarAlerta(`✓ Bienvenido. Último pedido: ${numFactura} (${cliente})`, false, 5000);
            }
        }
        sessionStorage.setItem("notificacionBienvenidaMostrada", "true");
    } catch (e) {}
}

function notificarNuevoPedido(pedidos) {
    if (!Array.isArray(pedidos) || pedidos.length === 0) return;

    const maxIdActual = Math.max(...pedidos.map(p => p.id_pedido));
    if (maxIdActual > ultimoIdPedidoNotificado) {
        const nuevoP = pedidos.find(p => p.id_pedido === maxIdActual);
        if (nuevoP) {
            const nombreFull = `${nuevoP.usuarios?.nombre || 'Nuevo'} ${nuevoP.usuarios?.apellido || 'Usuario'}`;
            mostrarAlerta(`🛒 NUEVO PEDIDO: ${nombreFull.toUpperCase()} (#${maxIdActual})`, false, 8000);
            if (typeof addNotifLog === 'function')
                addNotifLog('nuevo', `Nuevo pedido de ${nombreFull} — Ref #${maxIdActual}`);
            sonidoNuevoPedido.play().catch(() => {});
        }
        ultimoIdPedidoNotificado = maxIdActual;
        localStorage.setItem("ultimoIdPedidoNotificado", ultimoIdPedidoNotificado);
    }
}

function ajustarBarraBusqueda() {
    const row = document.querySelector('.search-box-container');
    if (row) {
        row.style.cssText = `
            background: #ffffff; 
            padding: 30px; 
            border-radius: 22px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.08); 
            margin-bottom: 40px;
            border: 1px solid #edf2f7;
            display: flex;
            flex-wrap: wrap;
            gap: 15px;
            align-items: center;
            justify-content: center;
        `;
    }
    const inputs = document.querySelectorAll('.search-box-container input, .search-box-container select');
    inputs.forEach(el => {
        el.style.cssText = `
            border-radius: 14px;
            border: 1.5px solid #e2e8f0;
            padding: 12px 18px;
            font-size: 0.95rem;
            transition: all 0.3s ease;
            outline: none;
            box-shadow: 0 2px 4px rgba(0,0,0,0.02);
        `;
        el.onfocus = () => {
            el.style.borderColor = "#3498db";
            el.style.boxShadow = "0 0 0 4px rgba(52, 152, 219, 0.15)";
        };
        el.onblur = () => {
            el.style.borderColor = "#e2e8f0";
            el.style.boxShadow = "0 2px 4px rgba(0,0,0,0.02)";
        };
    });
}

async function iniciarModuloPedidos() {
    ajustarBarraBusqueda();
    inicializarSelectAnios();
    localStorage.setItem("moduloPedidosIniciado", "true");
    await cargarPedidos();
    mostrarNotificacionBienvenida();
    escucharEventosTiempoReal();
    document.getElementById("btnGenerarPDF")?.addEventListener("click", generarReporteConfigurado);

    const inputsFiltro = ["inputBusquedaNombre", "inputBusquedaCedula", "inputNumeroFactura", "selectAnio", "filtroEstado"];
    inputsFiltro.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            const evento = (id.includes("select") || id.includes("filtro")) ? "change" : "input";
            el.addEventListener(evento, () => {
                paginaActual = 1;
                aplicarFiltros();
            });
        }
    });

    setInterval(() => {
        if (document.visibilityState === "visible") debouncedCargarPedidos(true);
    }, 7000);
}

async function cargarPedidos(isAutoRefresh = false) {
    if (isAutoRefresh && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'SELECT')) return;

    try {
        const res = await fetch("/obtener_pedidos");
        if (!res.ok) throw new Error("Error de conexión");
        const pedidos = await res.json();
        if (!Array.isArray(pedidos)) return;

        notificarNuevoPedido(pedidos);

        const idsActualesCancelados = pedidos.filter(p => p.estado === 'Cancelado').map(p => String(p.id_pedido));
        if (ultimosIdsCancelados.length > 0) {
            const nuevosBajas = idsActualesCancelados.filter(id => !ultimosIdsCancelados.includes(id));
            if (nuevosBajas.length > 0) {
                const pBaja = pedidos.find(p => String(p.id_pedido) === nuevosBajas[0]);
                if (pBaja) {
                    const cli = `${pBaja.usuarios?.nombre || "CLIENTE"} ${pBaja.usuarios?.apellido || ""}`;
                    mostrarAlerta(`⚠️ PEDIDO ANULADO: ${cli.toUpperCase()} — Ref #${pBaja.id_pedido}`, true, 9000);
                    if (typeof addNotifLog === 'function') addNotifLog('cancelado', `Pedido anulado: ${cli} — Ref #${pBaja.id_pedido}`);
                    sonidoNuevoPedido.play().catch(() => {});
                }
            }
        }
        ultimosIdsCancelados = idsActualesCancelados;

        pedidosDatosRaw = pedidos;
        pedidosGlobal = pedidos.map(pedido => {
            const idStr = String(pedido.id_pedido);
            const numFacturaCompuesta = generarNumeroFactura(pedido.id_pedido, pedido.fecha_pedido);
            const facturaAMostrar = pedido.numero_factura || numFacturaCompuesta;
            const esFijado = pedidosFijados.includes(idStr);
            const user = pedido.usuarios || {};
            
            const cardExistente = document.getElementById(`pedido-${pedido.id_pedido}`);
            const estabaAbierta = cardExistente ? !cardExistente.classList.contains('card-collapsed') : false;

            let totalPendiente = 0;
            const itemsRows = (pedido.pedido_detalle || []).map((item, idx) => {
                const itemId = `${pedido.id_pedido}-${idx}`;
                const pagado = estadosPagoGuardados[itemId] ?? (item.pagado ?? pedido.pagado ?? false);
                const subtotalItem = Number(item.subtotal || 0);
                if (!pagado) totalPendiente += subtotalItem;

                return `
                <tr style="vertical-align: middle;">
                    <td class="text-start ps-3 fw-medium">${item.gestion_productos?.nombre || item.nombre_producto || 'Producto'}</td>
                    <td class="fw-bold">${item.cantidad}</td>
                    <td class="text-primary">${subtotalItem.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })}</td>
                    <td>
                        <div class="form-check form-switch d-flex justify-content-center">
                            <input class="form-check-input toggle-pago-item-switch" type="checkbox" role="switch" 
                                   ${pagado ? 'checked' : ''}
                                   data-item-id="${itemId}" 
                                   data-indice="${idx}"
                                   data-subtotal="${subtotalItem}"
                                   style="cursor:pointer; width: 40px; height: 20px;">
                        </div>
                    </td>
                </tr>`;
            }).join("");

            const todosPagos = (pedido.pedido_detalle || []).every((_, i) => {
                const id = `${pedido.id_pedido}-${i}`;
                return estadosPagoGuardados[id] ?? (pedido.pedido_detalle[i]?.pagado ?? pedido.pagado ?? false);
            });

            const esTerminado = pedido.estado === 'Entregado' && todosPagos;
            const esAnulado = pedido.estado === 'Cancelado';
            const bloqueado = esTerminado || esAnulado;
            const estadoClase = esAnulado ? "pedido-anulado border-danger" : (esTerminado ? "pedido-finalizado" : "pedido-activo");

            const card = document.createElement("div");
            card.className = `pedido-card col-12 mb-4 p-2 shadow-sm rounded-4 bg-white border-start border-5 ${estadoClase} ${esFijado ? 'fijado border-primary' : ''} ${estabaAbierta ? '' : 'card-collapsed'}`;
            card.id = `pedido-${pedido.id_pedido}`;
            card.dataset.id_real = idStr;
            card.dataset.fecha_iso = pedido.fecha_pedido;
            card.dataset.factura = normalizarTexto(facturaAMostrar);
            card.dataset.estado = pedido.estado;
            card.dataset.todosPagos = todosPagos.toString();
            card.dataset.fijado = esFijado.toString();

            const fechaFormat = pedido.fecha_pedido 
                ? new Date(pedido.fecha_pedido).toLocaleString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) 
                : 'Sin fecha';

            card.innerHTML = `
                <div class="card border-0 bg-transparent">
                    <div class="card-header d-flex justify-content-between align-items-center bg-transparent border-0 py-3">
                        <div class="d-flex align-items-center gap-3">
                            <div class="btn-fijar-wrapper">
                                <i class="bi ${esFijado ? 'bi-pin-angle-fill text-primary' : 'bi-pin-angle text-muted'} fs-4 btn-fijar" style="cursor:pointer transition: 0.3s;"></i>
                            </div>
                            <div class="position-relative">
                                <img src="${user.imagen_url || '/static/uploads/default.png'}" class="rounded-circle border border-2 border-white shadow-sm" style="width:45px;height:45px;object-fit:cover;">
                                <span class="position-absolute bottom-0 end-0 p-1 bg-success border border-light rounded-circle" style="${pedido.estado === 'Entregado' ? '' : 'display:none'}"></span>
                            </div>
                            <div class="lh-sm">
                                <strong class="d-block text-dark" style="font-size:1.05rem">${facturaAMostrar}</strong>
                                <small class="status-info ${esAnulado ? 'text-danger fw-bold' : 'text-muted'}" style="font-size:0.8rem">
                                    <i class="bi bi-clock-history me-1"></i>${fechaFormat} | <span class="badge ${esAnulado ? 'bg-danger' : 'bg-secondary'}">${pedido.estado}</span>
                                </small>
                            </div>
                        </div>
                        <div class="d-flex align-items-center gap-3">
                            <div class="d-flex flex-column align-items-end me-2">
                                <small class="text-muted fw-bold" style="font-size: 0.75rem; text-transform: uppercase;">
                                    Saldo:
                                </small>
                                <span class="saldo-header fw-bolder ${totalPendiente === 0 ? 'text-success' : 'text-danger'} d-flex align-items-center justify-content-end" style="font-size: 0.95rem; gap:0.35rem;">
                                    <i class="bi bi-wallet2 me-1"></i>
                                    ${totalPendiente === 0 ? 'PAGADO' : totalPendiente.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })}
                                </span>
                            </div>
                            <button class="btn btn-light btn-sm rounded-circle toggle-detalle" style="width:35px; height:35px; display:flex; align-items:center; justify-content:center;">
                                <i class="bi bi-chevron-down icono transition-all"></i>
                            </button>
                            <button class="btn btn-outline-danger btn-sm border-0 rounded-circle btn-eliminar-individual" style="width:35px; height:35px;">
                                <i class="bi bi-trash3-fill"></i>
                            </button>
                        </div>
                    </div>
                    <div class="card-body pt-0 collapse-content">
                        <div class="p-3 mb-3 bg-light rounded-3 border-0" style="font-size:0.9rem">
                            <div class="row g-3">
                                <div class="col-md-4">
                                    <div class="text-muted mb-1"><i class="bi bi-person-fill me-1"></i> Datos del Cliente</div>
                                    <div class="fw-bold">${user.nombre || ''} ${user.apellido || ''}</div>
                                    <div class="text-secondary">${user.cedula || 'Documento N/A'}</div>
                                </div>
                                <div class="col-md-4">
                                    <div class="text-muted mb-1"><i class="bi bi-geo-alt-fill me-1"></i> Destino de Entrega</div>
                                    <div class="fw-bold">${pedido.direccion_envio || user.direccion || 'Entrega en Local'}</div>
                                    <div class="text-secondary">${user.telefono || 'Sin teléfono'}</div>
                                </div>
                                <div class="col-md-4">
                                    <div class="text-muted mb-1"><i class="bi bi-credit-card-fill me-1"></i> Transacción</div>
                                    <div class="fw-bold">${pedido.metodo_pago || 'Efectivo'}</div>
                                    <div class="badge bg-white text-dark border shadow-sm mt-1">Ref: ${pedido.id_pedido}</div>
                                </div>
                            </div>
                        </div>
                        <div class="table-responsive rounded-3 border">
                            <table class="table table-hover text-center mb-0">
                                <thead class="table-dark">
                                    <tr>
                                        <th class="text-start ps-3 py-3">Detalles del Producto</th>
                                        <th class="py-3">Cant.</th>
                                        <th class="py-3">Precio</th>
                                        <th class="py-3">¿Pagó?</th>
                                    </tr>
                                </thead>
                                <tbody>${itemsRows}</tbody>
                                <tfoot class="bg-white border-top-2">
                                    <tr style="height: 60px;">
                                        <td colspan="2" class="text-end align-middle fw-bold fs-6">SALDO PENDIENTE:</td>
                                        <td colspan="2" class="text-start align-middle fw-bolder ${totalPendiente === 0 ? 'text-success' : 'text-danger'} fs-5 ps-3 saldo-pendiente-valor">
                                            ${totalPendiente === 0 ? 'PAGADO' : totalPendiente.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })}
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                        <div class="d-flex justify-content-between align-items-center mt-4 bg-light p-3 rounded-3">
                            <div class="d-flex align-items-center gap-2 flex-grow-1">
                                <label class="fw-bold text-muted small text-uppercase">Cambiar Estado:</label>
                                <select class="form-select estado-select shadow-none" style="max-width:200px;" ${bloqueado ? 'disabled' : ''}>
                                    <option value="Pendiente" ${pedido.estado === 'Pendiente' ? 'selected' : ''}>Pendiente</option>
                                    <option value="Enviado" ${pedido.estado === 'Enviado' ? 'selected' : ''}>Enviado</option>
                                    <option value="Entregado" ${pedido.estado === 'Entregado' ? 'selected' : ''}>Finalizado</option>
                                    <option value="Cancelado" ${pedido.estado === 'Cancelado' ? 'selected' : ''}>Anular</option>
                                </select>
                            </div>
                            <button class="btn btn-primary actualizar-btn px-4 py-2 rounded-pill fw-bold shadow-sm" ${bloqueado ? 'disabled' : ''}>
                                <i class="bi bi-arrow-repeat me-2"></i>GUARDAR CAMBIOS
                            </button>
                        </div>
                    </div>
                </div>`;

            // Eventos
            card.querySelectorAll(".toggle-pago-item-switch").forEach(sw => {
                sw.onchange = async () => {
                    if (bloqueado) { sw.checked = !sw.checked; return; }
                    // ... (mantengo tu lógica original de pago)
                    const itemId = sw.dataset.itemId;
                    const indice = parseInt(sw.dataset.indice);
                    const subtotalValor = parseFloat(sw.dataset.subtotal);
                    const ahoraPagado = sw.checked;

                    const saldoElement = card.querySelector(".saldo-pendiente-valor");
                    const saldoHeader = card.querySelector(".saldo-header");
                    let saldoActual = parseFloat(saldoElement.innerText.replace(/[^0-9]/g, '')) || 0;
                    
                    if (ahoraPagado) saldoActual -= subtotalValor;
                    else saldoActual += subtotalValor;

                    const estaPagado = saldoActual <= 0;
                    const saldoFormato = estaPagado ? 'PAGADO' : saldoActual.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });

                    saldoElement.innerText = saldoFormato;
                    saldoElement.classList.toggle('text-success', estaPagado);
                    saldoElement.classList.toggle('text-danger', !estaPagado);

                    if (saldoHeader) {
                        saldoHeader.innerText = saldoFormato;
                        saldoHeader.classList.toggle('text-success', estaPagado);
                        saldoHeader.classList.toggle('text-danger', !estaPagado);
                    }

                    estadosPagoGuardados[itemId] = ahoraPagado;
                    localStorage.setItem("estadosPagoItems", JSON.stringify(estadosPagoGuardados));

                    try {
                        const res = await fetch(`/actualizar_pago_item/${pedido.id_pedido}`, {
                            method: "PUT",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ indice, pagado: ahoraPagado })
                        });
                        if (res.ok) {
                        mostrarAlerta(ahoraPagado ? `✅ Ítem marcado como pagado` : `↩️ Ítem marcado como pendiente de pago`);
                        if (typeof addNotifLog === 'function') addNotifLog('pago', `Pago ${ahoraPagado ? 'registrado' : 'revertido'} — ítem del pedido #${pedido.id_pedido}`);
                    }
                        else throw new Error();
                    } catch {
                        sw.checked = !ahoraPagado;
                        delete estadosPagoGuardados[itemId];
                        localStorage.setItem("estadosPagoItems", JSON.stringify(estadosPagoGuardados));
                        mostrarAlerta("Error al sincronizar con el servidor", true);
                    }
                    debouncedCargarPedidos(true);
                };
            });

            card.querySelector(".btn-fijar").onclick = () => {
                const id = card.dataset.id_real;
                const nuevoF = !pedidosFijados.includes(id);
                if (nuevoF) pedidosFijados.push(id);
                else pedidosFijados = pedidosFijados.filter(x => x !== id);
                localStorage.setItem("pedidosFijados", JSON.stringify(pedidosFijados));
                card.dataset.fijado = nuevoF.toString();
                card.querySelector(".btn-fijar").className = `bi ${nuevoF ? 'bi-pin-angle-fill text-primary' : 'bi-pin-angle text-muted'} fs-4 btn-fijar`;
                card.classList.toggle('fijado', nuevoF);
                card.classList.toggle('border-primary', nuevoF);
                aplicarFiltros();
            };

            card.querySelector(".btn-eliminar-individual").onclick = () => {
                mostrarConfirmacionApp("ELIMINAR REGISTRO", "¿Eliminar este pedido permanentemente? Esta acción no se puede deshacer.", async () => {
                    const res = await fetch("/eliminar_pedidos", { 
                        method: "DELETE", 
                        headers: { "Content-Type": "application/json" }, 
                        body: JSON.stringify({ ids: [idStr] }) 
                    });
                    if (res.ok) {
                        mostrarAlerta("🗑️ Pedido eliminado permanentemente del sistema", true);
                        if (typeof addNotifLog === 'function') addNotifLog('cancelado', `Pedido eliminado — Ref #${idStr}`);
                        pedidosGlobal = pedidosGlobal.filter(c => c.dataset.id_real !== idStr);
                        pedidosDatosRaw = pedidosDatosRaw.filter(p => String(p.id_pedido) !== idStr);
                        aplicarFiltros();
                    }
                });
            };

            const toggleBtn = card.querySelector(".toggle-detalle");
            toggleBtn.onclick = (e) => {
                e.stopPropagation();
                card.classList.toggle("card-collapsed");
                toggleBtn.querySelector("i").style.transform = card.classList.contains("card-collapsed") ? "rotate(0deg)" : "rotate(180deg)";
            };

            card.querySelector(".actualizar-btn").onclick = async () => {
                const nuevoEstado = card.querySelector(".estado-select").value;
                const ICONOS_ESTADO = { Pendiente: '⏳', Enviado: '🚚', Entregado: '✅', Cancelado: '❌' };
                const res = await fetch(`/actualizar_estado/${pedido.id_pedido}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ estado: nuevoEstado })
                });
                if (res.ok) {
                    const icon = ICONOS_ESTADO[nuevoEstado] || '📋';
                    const cliente = `${pedido.usuarios?.nombre || ''} ${pedido.usuarios?.apellido || ''}`.trim();
                    mostrarAlerta(`${icon} Pedido de ${cliente} → ${nuevoEstado.toUpperCase()}`);
                    if (typeof addNotifLog === 'function') addNotifLog('estado', `Estado cambiado a ${nuevoEstado} — ${cliente} Ref #${pedido.id_pedido}`);
                    card.dataset.estado = nuevoEstado;
                    debouncedCargarPedidos(true);
                } else {
                    mostrarAlerta("❌ Error al actualizar el estado del pedido", true);
                }
            };

            return card;
        });

        aplicarFiltros();
        actualizarStatsVentas(pedidos);

    } catch (e) {
        console.error("Fallo en carga de pedidos:", e);
    }
}

function actualizarStatsVentas(pedidos) {
    if (!Array.isArray(pedidos) || !pedidos.length) return;
    const total = pedidos.length;
    const entregados = pedidos.filter(p => p.estado === 'Entregado').length;
    const ventas = pedidos.filter(p => p.estado === 'Entregado').reduce((s, p) => s + Number(p.total || 0), 0);
    const porcentaje = total > 0 ? Math.round((entregados / total) * 100) : 0;

    const elTotal = document.getElementById('svTotalPedidos');
    const elVentas = document.getElementById('svTotalVentas');
    const elEntregados = document.getElementById('svEntregados');
    const elPorc = document.getElementById('svPorcentaje');

    if (elTotal)     elTotal.textContent = total;
    if (elEntregados) elEntregados.textContent = entregados;
    if (elVentas)    elVentas.textContent = ventas.toLocaleString('es-CO', { style:'currency', currency:'COP', maximumFractionDigits:0 });
    if (elPorc) {
        elPorc.textContent = `↑ ${porcentaje}%`;
        elPorc.className = `badge-porcentaje-verde${porcentaje < 50 ? ' badge-porcentaje-bajo' : ''}`;
    }
}

function normalizarTexto(texto) {
    if (!texto) return "";
    return texto.toString().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, '');
}

function renderizarPaginacion(lista) {
    const totalPaginas = Math.ceil(lista.length / itemsPorPagina) || 1;
    const pagUl = document.getElementById("pagination");
    if (!pagUl) return;
    pagUl.innerHTML = "";
    if (paginaActual > totalPaginas) paginaActual = totalPaginas;

    const crearLink = (num, texto, activo = false, deshabilitado = false) => {
        const li = document.createElement("li");
        li.className = `page-item ${activo ? 'active' : ''} ${deshabilitado ? 'disabled' : ''}`;
        li.innerHTML = `<a class="page-link shadow-sm mx-1 rounded" href="#">${texto}</a>`;
        if (!deshabilitado) {
            li.addEventListener("click", (e) => {
                e.preventDefault();
                paginaActual = num;
                mostrarPagina(lista, num);
                renderizarPaginacion(lista);
            });
        }
        return li;
    };

    pagUl.appendChild(crearLink(paginaActual - 1, '<i class="bi bi-chevron-left"></i>', false, paginaActual === 1));

    for (let i = 1; i <= totalPaginas; i++) {
        if (i === 1 || i === totalPaginas || (i >= paginaActual - 1 && i <= paginaActual + 1)) {
            pagUl.appendChild(crearLink(i, i, i === paginaActual));
        } else if (i === paginaActual - 2 || i === paginaActual + 2) {
            const dots = document.createElement("li");
            dots.className = "page-item disabled";
            dots.innerHTML = '<span class="page-link border-0">...</span>';
            pagUl.appendChild(dots);
        }
    }

    pagUl.appendChild(crearLink(paginaActual + 1, '<i class="bi bi-chevron-right"></i>', false, paginaActual === totalPaginas));

    actualizarTituloTabla();
    mostrarPagina(lista, paginaActual);
}

function mostrarPagina(lista, pagina) {
    const cont = document.getElementById("tablaPedidos");
    if (!cont) return;
    cont.innerHTML = "";
    const inicio = (pagina - 1) * itemsPorPagina;
    const fin = inicio + itemsPorPagina;
    const items = lista.slice(inicio, fin);

    if (items.length === 0) {
        cont.innerHTML = `
            <tr>
                <td class="text-center py-5">
                    <i class="bi bi-search fs-1 text-muted d-block mb-3"></i>
                    <p class="text-muted fw-bold">No se encontraron pedidos que coincidan con la búsqueda.</p>
                </td>
            </tr>
        `;
        return;
    }

    items.forEach(card => {
        const tr = document.createElement("tr");
        const td = document.createElement("td");
        td.style.border = "none";
        td.appendChild(card);
        tr.appendChild(td);
        cont.appendChild(tr);
    });
}

function actualizarTituloTabla() {
    const titulo = document.getElementById("tituloTabla");
    if (!titulo) return;
    const filtro = document.getElementById("filtroEstado").value;
    const titulos = {
        "Todos": "LISTANDO TODOS LOS PEDIDOS",
        "FiltroPagoPendiente": "GESTIÓN DE PAGOS PENDIENTES",
        "Pendiente": "LISTANDO PEDIDOS PENDIENTES",
        "Entregado": "LISTANDO PEDIDOS FINALIZADOS",
        "Cancelado": "LISTANDO PEDIDOS ANULADOS"
    };
    titulo.innerHTML = `<i class="bi bi-journal-text me-2"></i> ${titulos[filtro] || "GESTIÓN DE PEDIDOS"}`;
}

function actualizarCardLocalmente(card, idPedido, pedidoData, nuevoEstado = null) {
    const switches = card.querySelectorAll(".toggle-pago-item-switch");
    const todosPagos = Array.from(switches).every(s => s.checked);
    card.dataset.todosPagos = todosPagos.toString();

    let totalPendiente = 0;
    switches.forEach((sw, idx) => {
        if (!sw.checked) {
            const rows = card.querySelectorAll("tbody tr");
            const priceText = rows[idx].querySelector("td:nth-child(3)").textContent;
            const price = Number(priceText.replace(/[^0-9]/g, '')) || 0;
            totalPendiente += price;
        }
    });

    const estaPagado = totalPendiente <= 0;
    const textoSaldo = estaPagado ? 'PAGADO' : totalPendiente.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });

    const saldoFooter = card.querySelector("tfoot td:nth-child(2)");
    if (saldoFooter) {
        saldoFooter.textContent = textoSaldo;
        saldoFooter.classList.toggle('text-success', estaPagado);
        saldoFooter.classList.toggle('text-danger', !estaPagado);
    }

    const saldoHeader = card.querySelector('.saldo-header');
    if (saldoHeader) {
        saldoHeader.textContent = textoSaldo;
        saldoHeader.classList.toggle('text-success', estaPagado);
        saldoHeader.classList.toggle('text-danger', !estaPagado);
    }

    const estado = nuevoEstado || card.dataset.estado;
    const esTerminado = estado === 'Entregado' && todosPagos;
    const esAnulado = estado === 'Cancelado';
    const bloqueado = esTerminado || esAnulado;

    card.classList.remove('pedido-anulado', 'border-danger', 'pedido-finalizado', 'pedido-activo');
    if (esAnulado) card.classList.add('pedido-anulado', 'border-danger');
    else if (esTerminado) card.classList.add('pedido-finalizado');
    else card.classList.add('pedido-activo');

    const select = card.querySelector(".estado-select");
    const btn = card.querySelector(".actualizar-btn");
    if (select) select.disabled = bloqueado;
    if (btn) btn.disabled = bloqueado;
}

function generarNumeroFactura(idPedido, fecha) {
    const d = new Date(fecha);
    const anio = d.getFullYear();
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    const key = `${anio}-${idPedido}`;
    if (!contadorFacturasPorAnio[key]) {
        contadorFacturasPorAnio[anio] = (contadorFacturasPorAnio[anio] || 0) + 1;
        contadorFacturasPorAnio[key] = contadorFacturasPorAnio[anio];
        localStorage.setItem("contadorFacturasPorAnio", JSON.stringify(contadorFacturasPorAnio));
    }
    const correlativo = String(contadorFacturasPorAnio[key]).padStart(4, '0');
    return `FAC-${anio}${mes}-${correlativo}`;
}

function aplicarFiltros() {
    const anioFiltro = document.getElementById("selectAnio")?.value;
    const numFactFiltro = document.getElementById("inputNumeroFactura")?.value.trim();
    const filtroEstado = document.getElementById("filtroEstado")?.value;
    const busqNombre = normalizarTexto(document.getElementById("inputBusquedaNombre")?.value);
    const busqCedula = normalizarTexto(document.getElementById("inputBusquedaCedula")?.value);
    
    let filtrados = pedidosGlobal.filter(card => {
        const id = card.dataset.id_real;
        const p = pedidosDatosRaw.find(x => String(x.id_pedido) === id);
        if (!p) return false;
        
        const user = p.usuarios || {};
        const nombreCompleto = normalizarTexto(`${user.nombre||''}${user.apellido||''}`);
        
        if (busqNombre && !nombreCompleto.includes(busqNombre)) return false;
        if (busqCedula && !normalizarTexto(user.cedula).includes(busqCedula)) return false;

        if (numFactFiltro) {
            const factCard = card.dataset.factura;
            if (!factCard.includes(numFactFiltro.toLowerCase())) return false;
        }
        
        const fechaObj = new Date(card.dataset.fecha_iso);
        if (anioFiltro && anioFiltro !== "Todos" && fechaObj.getFullYear().toString() !== anioFiltro) return false;

        const est = card.dataset.estado;
        const pagosOk = card.dataset.todosPagos === "true";
        const verificado = pedidosCanceladosVerificados.includes(id);

        if (filtroEstado === "FiltroPagoPendiente") return !pagosOk && est !== "Cancelado";
        if (filtroEstado === "Pendiente") return est === "Pendiente";
        if (filtroEstado === "Entregado") return est === "Entregado" && pagosOk;
        if (filtroEstado === "Cancelado") return est === "Cancelado";
        
        if (est === "Cancelado" && verificado && filtroEstado === "Todos") return false;

        return true;
    });

    const grupos = { urgentes: [], normales: [], finalizados: [], anulados: [] };

    filtrados.forEach(card => {
        const est = card.dataset.estado;
        const pagos = card.dataset.todosPagos === "true";
        const fijado = card.dataset.fijado === "true";

        if (est === "Cancelado") grupos.anulados.push(card);
        else if (est === "Entregado" && pagos) grupos.finalizados.push(card);
        else if (fijado) grupos.urgentes.push(card);
        else grupos.normales.push(card);
    });

    const sortFn = (a, b) => new Date(b.dataset.fecha_iso) - new Date(a.dataset.fecha_iso);

    const listaFinal = [];

    if (grupos.urgentes.length) listaFinal.push(crearSeparador("PEDIDOS PRIORITARIOS / FIJADOS", "bg-primary"), ...grupos.urgentes.sort(sortFn));
    if (grupos.normales.length) listaFinal.push(crearSeparador("PEDIDOS EN PROCESO", "bg-info text-dark"), ...grupos.normales.sort(sortFn));
    if (grupos.finalizados.length) listaFinal.push(crearSeparador("HISTORIAL DE VENTAS EXITOSAS", "bg-success"), ...grupos.finalizados.sort(sortFn));
    if (grupos.anulados.length) listaFinal.push(crearSeparador("PEDIDOS DESCARTADOS / ANULADOS", "bg-danger"), ...grupos.anulados.sort(sortFn));

    pedidosFiltrados = listaFinal;
    renderizarPaginacion(pedidosFiltrados);
}

function crearSeparador(texto, claseColor) {
    const div = document.createElement("div");
    div.className = "col-12 my-4";
    div.innerHTML = `
        <div class="d-flex align-items-center opacity-75">
            <div class="flex-grow-1 border-top border-2 border-secondary"></div>
            <span class="badge ${claseColor} mx-3 py-2 px-4 rounded-pill shadow-sm text-uppercase fw-bold" style="font-size: 0.75rem; letter-spacing: 2px;">
                ${texto}
            </span>
            <div class="flex-grow-1 border-top border-2 border-secondary"></div>
        </div>
    `;
    div.dataset.esSeparador = "true";
    return div;
}

function inicializarSelectAnios() {
    const s = document.getElementById("selectAnio");
    const r = document.getElementById("repoAnio");
    if (!s || !r) return;
    
    s.innerHTML = '<option value="Todos">Todos los años</option>';
    r.innerHTML = '';
    
    const actual = new Date().getFullYear();
    for (let i = actual; i >= actual - 4; i--) {
        const opt = document.createElement("option");
        opt.value = i;
        opt.textContent = i;
        s.appendChild(opt.cloneNode(true));
        r.appendChild(opt);
    }
}

async function generarReporteConfigurado() {
    const { jsPDF } = window.jspdf;
    const config = {
        estado: document.getElementById("repoEstado").value,
        anio: document.getElementById("repoAnio").value,
        mes: document.getElementById("repoMes").value,
        admin: document.getElementById("adminName")?.value || "Administrador"
    };
    
    let lista = pedidosDatosRaw.filter(p => {
        const f = new Date(p.fecha_pedido);
        if (f.getFullYear().toString() !== config.anio) return false;
        if (config.mes !== "Todos" && f.getMonth().toString() !== config.mes) return false;
        if (config.estado !== "Todos" && p.estado !== config.estado) return false;
        return true;
    });

    if (!lista.length) return mostrarAlerta("No existen datos para los filtros seleccionados", true);

    const doc = new jsPDF();
    const colorPrimario = [211, 84, 0];
    const colorOscuro = [44, 62, 80];

    try {
        const img = new Image(); 
        img.src = '/static/uploads/logo.png';
        await new Promise(r => { img.onload = r; img.onerror = r; });
        if (img.complete && img.naturalWidth !== 0) {
            const c = document.createElement('canvas'); 
            c.width = img.width; c.height = img.height;
            c.getContext('2d').drawImage(img, 0, 0);
            doc.addImage(c.toDataURL('image/png'), 'PNG', 15, 12, 22, 22);
        }
    } catch (e) { console.warn("Logo no disponible"); }

    doc.setFontSize(20);
    doc.setTextColor(colorPrimario[0], colorPrimario[1], colorPrimario[2]);
    doc.setFont(undefined, 'bold');
    doc.text("D'ANTOJITOS", 42, 20);
    
    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.setFont(undefined, 'normal');
    doc.text("SISTEMA DE GESTIÓN ADMINISTRATIVA Y VENTAS", 42, 26);
    doc.text(`RESPONSABLE: ${config.admin.toUpperCase()}`, 42, 31);
    
    doc.setDrawColor(200);
    doc.line(15, 38, 195, 38);

    let totalVendido = 0;
    const stats = { Pendiente: 0, Enviado: 0, Entregado: 0, Cancelado: 0 };

    const bodyTable = lista.map(p => {
        const sub = (p.pedido_detalle || []).reduce((acc, item) => acc + (item.subtotal || 0), 0);
        totalVendido += sub;
        if (stats[p.estado] !== undefined) stats[p.estado]++;
        
        return [
            generarNumeroFactura(p.id_pedido, p.fecha_pedido),
            new Date(p.fecha_pedido).toLocaleDateString('es-CO'),
            `${p.usuarios?.nombre || ''} ${p.usuarios?.apellido || ''}`.substring(0, 25),
            p.estado.toUpperCase(),
            sub.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })
        ];
    });

    doc.autoTable({
        startY: 45,
        head: [['Nº FACTURA', 'FECHA', 'CLIENTE', 'ESTADO', 'TOTAL']],
        body: bodyTable,
        theme: 'striped',
        headStyles: { fillColor: colorOscuro, textColor: 255, fontSize: 9, halign: 'center' },
        columnStyles: { 0: { halign: 'center' }, 1: { halign: 'center' }, 3: { halign: 'center' }, 4: { halign: 'right' } },
        styles: { fontSize: 8, cellPadding: 3 }
    });

    let finalY = doc.lastAutoTable.finalY + 15;
    if (finalY > 210) { doc.addPage(); finalY = 25; }

    const canvas = document.createElement('canvas');
    canvas.width = 600;
    canvas.height = 300;
    const ctx = canvas.getContext('2d');
    
    const dataStats = [
        { label: "PENDIENTE", val: stats.Pendiente, color: "#d4ac0d" },
        { label: "ENVIADO", val: stats.Enviado, color: "#2e86c1" },
        { label: "ENTREGADO", val: stats.Entregado, color: "#239b56" },
        { label: "ANULADO", val: stats.Cancelado, color: "#b03a2e" }
    ].filter(s => s.val > 0);

    const totalPedidos = dataStats.reduce((a, b) => a + b.val, 0);
    let startAngle = -Math.PI / 2;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, 600, 300);

    dataStats.forEach((slice) => {
        const sliceAngle = (slice.val / totalPedidos) * 2 * Math.PI;
        ctx.beginPath();
        ctx.moveTo(150, 150);
        ctx.arc(150, 150, 110, startAngle, startAngle + sliceAngle);
        ctx.closePath();
        ctx.fillStyle = slice.color;
        ctx.fill();
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2;
        ctx.stroke();
        startAngle += sliceAngle;
    });

    ctx.font = "bold 14px Arial";
    dataStats.forEach((slice, i) => {
        ctx.fillStyle = slice.color;
        ctx.fillRect(320, 80 + (i * 35), 15, 15);
        ctx.fillStyle = "#2c3e50";
        const porc = ((slice.val/totalPedidos)*100).toFixed(1);
        ctx.fillText(`${slice.label}: ${slice.val} Uds. (${porc}%)`, 345, 93 + (i * 35));
    });

    doc.setFontSize(11);
    doc.setTextColor(colorOscuro[0], colorOscuro[1], colorOscuro[2]);
    doc.text("ANÁLISIS DE RENDIMIENTO OPERATIVO", 15, finalY);
    doc.addImage(canvas.toDataURL('image/png'), 'PNG', 15, finalY + 5, 110, 55);

    const resX = 135;
    doc.setDrawColor(colorPrimario[0], colorPrimario[1], colorPrimario[2]);
    doc.setLineWidth(0.5);
    doc.line(resX, finalY + 15, resX + 55, finalY + 15);
    
    doc.setFont(undefined, 'bold');
    doc.setFontSize(10);
    doc.text("RESUMEN CONTABLE", resX, finalY + 22);
    doc.setFontSize(13);
    doc.setTextColor(colorPrimario[0], colorPrimario[1], colorPrimario[2]);
    doc.text(totalVendido.toLocaleString('es-CO', { style: 'currency', currency: 'COP' }), resX, finalY + 32);

    const paginas = doc.internal.getNumberOfPages();
    for(let i = 1; i <= paginas; i++) {
        doc.setPage(i);
        doc.setFontSize(7);
        doc.setTextColor(150);
        doc.text(`Documento de carácter oficial - Página ${i} de ${paginas}`, 105, 290, { align: "center" });
    }

    doc.save(`Reporte_Oficial_${config.anio}_${config.mes}.pdf`);
    mostrarAlerta("Reporte Corporativo generado correctamente");
}

window.onload = iniciarModuloPedidos;
document.addEventListener("DOMContentLoaded", iniciarModuloPedidos);

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
    window.addEventListener('load', () => {navigator.serviceWorker.register('/static/js/workers/service-worker-pedidos.js') .then(() => console.log('SW OK')) .catch(err => console.error('SW Error', err));});
}