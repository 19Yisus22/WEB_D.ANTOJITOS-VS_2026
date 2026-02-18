const toastContainer = document.getElementById('toastContainer');
const itemsPorPagina = 5;
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

const sonidoNuevoPedido = new Audio('https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3');
sonidoNuevoPedido.volume = 0.7;

async function verificarAccesoAdmin() {
    try {
        const res = await fetch("/gestionar_productos");
        if (res.status === 401 || res.status === 403) {
            document.documentElement.innerHTML = `
                <head>
                    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
                    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.css">
                    <style>
                        body { background: #000; color: white; height: 100vh; display: flex; align-items: center; justify-content: center; font-family: sans-serif; overflow: hidden; }
                        .lock-box { text-align: center; border: 1px solid #333; padding: 3rem; border-radius: 20px; background: #0a0a0a; }
                        .shield-icon { font-size: 5rem; color: #ff4757; animation: pulse 2s infinite; }
                        @keyframes pulse { 0% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.1); opacity: 0.7; } 100% { transform: scale(1); opacity: 1; } }
                    </style>
                </head>
                <body>
                    <div class="lock-box shadow-lg">
                        <i class="bi bi-shield-slash-fill shield-icon"></i>
                        <h1 class="fw-bold mt-3">MÓDULO PROTEGIDO</h1>
                        <p class="text-secondary">Se requiere nivel de acceso administrativo para esta sección.</p>
                        <div class="spinner-border text-danger my-3" role="status"></div>
                        <br>
                        <button onclick="window.location.href='/'" class="btn btn-outline-danger mt-2 px-5">SALIR</button>
                    </div>
                </body>
            `;
            setTimeout(() => { window.location.href = "/"; }, 4000);
            return false;
        }
        return true;
    } catch {
        return false;
    }
}

function mostrarAlerta(mensaje, esError = false, duracionMs = 3500) {
    let container = document.getElementById('toastContainer');
    if (!container) {
        container = document.createElement("div");
        container.id = "toastContainer";
        container.style.cssText = "position: fixed; top: 20px; right: 20px; z-index: 9999;";
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = 'custom-toast';
    toast.innerHTML = `
        <div class="d-flex align-items-center">
            <i class="bi ${esError ? 'bi-x-circle text-danger' : 'bi-check-circle text-success'} me-2 fs-6"></i>
            <span style="font-size: 0.85rem;">${mensaje}</span>
        </div>
        <i class="bi bi-x-lg ms-2 btn-close-toast" style="cursor:pointer; font-size: 0.65rem;"></i>
    `;
    
    container.appendChild(toast);

    const eliminar = () => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 400);
    };

    toast.querySelector('.btn-close-toast').onclick = eliminar;
    setTimeout(eliminar, duracionMs);
}

function escucharEventosTiempoReal() {
    window.addEventListener('storage', (e) => {
        if (e.key === 'nuevoPedidoDetectado') {
            cargarPedidos();
        }
        if (e.key === 'pedidoAnuladoRecientemente') {
            const data = JSON.parse(e.newValue);
            mostrarAlerta(`⚠️ EL CLIENTE ${data.nombre.toUpperCase()} HA ANULADO EL PEDIDO #${data.id}`, true, 6000);
            cargarPedidos();
        }
    });
}

async function iniciarModuloPedidos() {
    const tieneAcceso = await verificarAccesoAdmin();
    if (!tieneAcceso) return;

    inicializarSelectAnios();
    await cargarPedidos();
    escucharEventosTiempoReal();
    
    setInterval(() => cargarPedidos(true), 15000);

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

    for (let i = 1; i <= totalPaginas; i++) {
        const li = document.createElement("li");
        li.className = `page-item ${i === paginaActual ? 'active' : ''}`;
        li.innerHTML = `<a class="page-link" href="#">${i}</a>`;
        li.addEventListener("click", (e) => { 
            e.preventDefault(); 
            paginaActual = i;
            mostrarPagina(lista, i);
            renderizarPaginacion(lista);
        });
        pagUl.appendChild(li);
    }
    actualizarTituloTabla();
    mostrarPagina(lista, paginaActual);
}

function mostrarPagina(lista, pagina) {
    const cont = document.getElementById("tablaPedidos");
    if (!cont) return;
    cont.innerHTML = "";
    const inicio = (pagina - 1) * itemsPorPagina;
    const fin = inicio + itemsPorPagina;
    lista.slice(inicio, fin).forEach(card => {
        const tr = document.createElement("tr");
        const td = document.createElement("td");
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
        "Todos": "MOSTRANDO TODOS LOS PEDIDOS",
        "FiltroPagoPendiente": "Pedidos Activos (PAGOS O ENTREGAS PENDIENTES)",
        "Entregado": "Pedidos Finalizados (PAGADOS Y ENTREGADOS)",
        "Cancelado": "Pedidos Anulados"
    };
    titulo.textContent = titulos[filtro] || "Pedidos";
}

async function cargarPedidos(isAutoRefresh = false) {
    if (isAutoRefresh && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'SELECT')) return;

    try {
        const res = await fetch("/obtener_pedidos");
        const pedidos = await res.json();
        if (!Array.isArray(pedidos)) return;

        const nuevosCancelados = pedidos.filter(p => p.estado === 'Cancelado').map(p => String(p.id_pedido));
        
        if (isAutoRefresh && ultimosIdsCancelados.length > 0) {
            const detectados = nuevosCancelados.filter(id => !ultimosIdsCancelados.includes(id));
            if (detectados.length > 0) {
                const idNotificar = detectados[0];
                const pedido = pedidos.find(p => String(p.id_pedido) === idNotificar);
                if (pedido) {
                    const nombre = `${pedido.usuarios?.nombre || "UN"} ${pedido.usuarios?.apellido || "CLIENTE"}`;
                    mostrarAlerta(`⚠️ EL CLIENTE ${nombre.toUpperCase()} HA ANULADO EL PEDIDO DESDE EL CARRITO #${idNotificar}`, true, 7000);
                }
            }
        }
        ultimosIdsCancelados = nuevosCancelados;

        pedidosDatosRaw = pedidos;
        
        pedidosGlobal = pedidos.map(pedido => {
            const idStr = String(pedido.id_pedido);
            const factura = pedido.numero_factura || `ID-${pedido.id_pedido}`;
            const esFijado = pedidosFijados.includes(idStr);
            const user = pedido.usuarios || {};
            const cardExistente = document.getElementById(`pedido-${pedido.id_pedido}`);
            const estabaAbierta = cardExistente ? !cardExistente.classList.contains('card-collapsed') : false;

            let totalPendiente = 0;
            const itemsRows = (pedido.pedido_detalle || []).map((item, idx) => {
                const itemId = `${pedido.id_pedido}-${idx}`;
                const pagado = estadosPagoGuardados[itemId] ?? (item.pagado ?? pedido.pagado ?? false);
                if (!pagado) totalPendiente += Number(item.subtotal || 0);

                return `<tr>
                    <td class="text-start">${item.gestion_productos?.nombre || item.nombre_producto || 'Producto'}</td>
                    <td>${item.cantidad}</td>
                    <td>${Number(item.subtotal || 0).toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })}</td>
                    <td>
                        <i class="bi ${pagado ? 'bi-check-circle text-success' : 'bi-x-circle text-danger'} fs-4 toggle-pago-item" 
                           style="cursor:pointer" 
                           data-item-id="${itemId}" 
                           data-indice="${idx}"
                           data-pagado="${pagado}">
                        </i>
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
            card.className = `pedido-card col-12 mb-3 p-1 shadow-sm ${estadoClase} ${esFijado ? 'fijado border-primary' : ''} ${estabaAbierta ? '' : 'card-collapsed'}`;
            card.id = `pedido-${pedido.id_pedido}`;
            card.dataset.id_real = idStr;
            card.dataset.fecha_iso = pedido.fecha_pedido;
            card.dataset.factura = normalizarTexto(factura);
            card.dataset.estado = pedido.estado;
            card.dataset.todosPagos = todosPagos.toString();
            card.dataset.fijado = esFijado.toString();

            const fechaStr = pedido.fecha_pedido 
                ? new Date(pedido.fecha_pedido).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' }) 
                : '---';

            card.innerHTML = `
                <div class="card border-0 bg-transparent">
                    <div class="card-header d-flex justify-content-between align-items-center bg-transparent border-0 py-2">
                        <div class="d-flex align-items-center gap-2">
                            <i class="bi ${esFijado ? 'bi-pin-angle-fill text-primary' : 'bi-pin-angle'} fs-5 btn-fijar" style="cursor:pointer"></i>
                            <img src="${user.imagen_url || '/static/uploads/default.png'}" class="rounded-circle border" style="width:38px;height:38px;object-fit:cover;">
                            <div class="lh-1">
                                <strong class="d-block" style="font-size:0.9rem">${factura}</strong>
                                <small class="status-info ${esAnulado ? 'text-danger fw-bold' : 'text-muted'}" style="font-size:0.75rem">${pedido.estado} | ${fechaStr}</small>
                            </div>
                        </div>
                        <div class="d-flex gap-2">
                            <i class="bi bi-chevron-down icono fs-4 toggle-detalle"></i>
                            <i class="bi bi-trash icono text-danger fs-4 btn-eliminar-individual" style="cursor:pointer"></i>
                        </div>
                    </div>
                    <div class="card-body pt-0">
                        <div class="mb-2 border-top pt-2" style="font-size:0.85rem">
                            <div class="row">
                                <div class="col-md-6">
                                    <p class="mb-1"><strong>Cliente:</strong> ${user.nombre || ''} ${user.apellido || ''}</p>
                                    <p class="mb-1"><strong>Cédula:</strong> ${user.cedula || 'N/A'}</p>
                                    <p class="mb-1"><strong>Teléfono:</strong> ${user.telefono || 'N/A'}</p>
                                </div>
                                <div class="col-md-6">
                                    <p class="mb-1"><strong>Dirección:</strong> ${pedido.direccion_envio || user.direccion || 'N/A'}</p>
                                    <p class="mb-1"><strong>Método Pago:</strong> <span class="badge bg-info text-dark">${pedido.metodo_pago || 'No especificado'}</span></p>
                                </div>
                            </div>
                        </div>
                        <div class="table-responsive-container">
                            <table class="table table-sm text-center mb-0">
                                <thead><tr><th class="text-start">Productos</th><th>Cant.</th><th>Subtotal</th><th>Pago?</th></tr></thead>
                                <tbody>${itemsRows}</tbody>
                                <tfoot class="table-light">
                                    <tr>
                                        <td colspan="2" class="text-end fw-bold">Total Pendiente:</td>
                                        <td colspan="2" class="text-start fw-bold text-danger ps-3">
                                            ${totalPendiente.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })}
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                        <div class="d-flex gap-2 mt-3">
                            <select class="form-select form-select-sm estado-select" ${bloqueado ? 'disabled' : ''}>
                                <option value="Pendiente" ${pedido.estado === 'Pendiente' ? 'selected' : ''}>Pendiente</option>
                                <option value="Enviado" ${pedido.estado === 'Enviado' ? 'selected' : ''}>Enviado</option>
                                <option value="Entregado" ${pedido.estado === 'Entregado' ? 'selected' : ''}>Finalizado</option>
                                <option value="Cancelado" ${pedido.estado === 'Cancelado' ? 'selected' : ''}>Anulado</option>
                            </select>
                            <button class="btn btn-primary btn-sm actualizar-btn px-3" ${bloqueado ? 'disabled' : ''}>Actualizar</button>
                        </div>
                    </div>
                </div>`;

            card.querySelectorAll(".toggle-pago-item").forEach(icon => {
                icon.onclick = async () => {
                    if (bloqueado) return;
                    const itemId = icon.dataset.itemId;
                    const indice = parseInt(icon.dataset.indice);
                    const eraPagado = icon.dataset.pagado === 'true';
                    const ahoraPagado = !eraPagado;

                    icon.dataset.pagado = ahoraPagado.toString();
                    icon.className = `bi ${ahoraPagado ? 'bi-check-circle text-success' : 'bi-x-circle text-danger'} fs-4 toggle-pago-item`;

                    estadosPagoGuardados[itemId] = ahoraPagado;
                    localStorage.setItem("estadosPagoItems", JSON.stringify(estadosPagoGuardados));

                    actualizarCardLocalmente(card, pedido.id_pedido, pedido);

                    try {
                        const res = await fetch(`/actualizar_pago_item/${pedido.id_pedido}`, {
                            method: "PUT",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ indice, pagado: ahoraPagado })
                        });
                        if (!res.ok) throw new Error();
                        mostrarAlerta("Cobro actualizado");
                    } catch {
                        icon.dataset.pagado = eraPagado.toString();
                        icon.className = `bi ${eraPagado ? 'bi-check-circle text-success' : 'bi-x-circle text-danger'} fs-4 toggle-pago-item`;
                        delete estadosPagoGuardados[itemId];
                        localStorage.setItem("estadosPagoItems", JSON.stringify(estadosPagoGuardados));
                        actualizarCardLocalmente(card, pedido.id_pedido, pedido);
                        mostrarAlerta("Error al guardar pago", true);
                    }
                };
            });

            card.querySelector(".btn-fijar").onclick = () => {
                const id = card.dataset.id_real;
                const nuevoFijado = !pedidosFijados.includes(id);
                if (nuevoFijado) pedidosFijados.push(id);
                else pedidosFijados = pedidosFijados.filter(x => x !== id);
                
                localStorage.setItem("pedidosFijados", JSON.stringify(pedidosFijados));
                card.dataset.fijado = nuevoFijado.toString();
                const icon = card.querySelector(".btn-fijar");
                icon.className = `bi ${nuevoFijado ? 'bi-pin-angle-fill text-primary' : 'bi-pin-angle'} fs-5 btn-fijar`;
                card.classList.toggle('fijado', nuevoFijado);
                card.classList.toggle('border-primary', nuevoFijado);
                aplicarFiltros();
            };

            card.querySelector(".btn-eliminar-individual").onclick = async () => {
                const res = await fetch("/eliminar_pedidos", { 
                    method: "DELETE", 
                    headers: { "Content-Type": "application/json" }, 
                    body: JSON.stringify({ ids: [idStr] }) 
                });
                if (res.ok) {
                    mostrarAlerta("Pedido eliminado");
                    pedidosGlobal = pedidosGlobal.filter(c => c.dataset.id_real !== idStr);
                    pedidosDatosRaw = pedidosDatosRaw.filter(p => String(p.id_pedido) !== idStr);
                    aplicarFiltros();
                }
            };

            card.querySelector(".toggle-detalle").onclick = (e) => {
                e.stopPropagation();
                card.classList.toggle("card-collapsed");
            };

            card.querySelector(".actualizar-btn").onclick = async () => {
                const nuevoEstado = card.querySelector(".estado-select").value;
                const res = await fetch(`/actualizar_estado/${pedido.id_pedido}`, { 
                    method: "PUT", 
                    headers: { "Content-Type": "application/json" }, 
                    body: JSON.stringify({ estado: nuevoEstado }) 
                });
                if (res.ok) {
                    mostrarAlerta(`Estado: ${nuevoEstado}`);
                    card.dataset.estado = nuevoEstado;
                    actualizarCardLocalmente(card, pedido.id_pedido, pedido, nuevoEstado);
                }
            };

            return card;
        });

        aplicarFiltros();

    } catch (e) {
        console.error(e);
    }
}

function actualizarCardLocalmente(card, idPedido, pedidoData, nuevoEstado = null) {
    const icons = card.querySelectorAll(".toggle-pago-item");
    const todosPagos = Array.from(icons).every(i => i.dataset.pagado === 'true');
    card.dataset.todosPagos = todosPagos.toString();

    let totalPendiente = 0;
    icons.forEach((icon, idx) => {
        const pagado = icon.dataset.pagado === 'true';
        const subtotalStr = card.querySelector(`tbody tr:nth-child(${idx+1}) td:nth-child(3)`).textContent.replace(/[^0-9]/g, '');
        const subtotal = Number(subtotalStr) || 0;
        if (!pagado) totalPendiente += subtotal;
    });

    card.querySelector("tfoot td:nth-child(2)").textContent = 
        totalPendiente.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });

    const estado = nuevoEstado || card.dataset.estado;
    const esTerminado = estado === 'Entregado' && todosPagos;
    const esAnulado = estado === 'Cancelado';
    const bloqueado = esTerminado || esAnulado;

    card.classList.remove('pedido-anulado', 'border-danger', 'pedido-finalizado', 'pedido-activo');
    const clase = esAnulado ? "pedido-anulado border-danger" : (esTerminado ? "pedido-finalizado" : "pedido-activo");
    card.classList.add(...clase.split(' '));

    const status = card.querySelector(".status-info");
    status.textContent = `${estado} | ${new Date(pedidoData.fecha_pedido).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })}`;
    status.classList.toggle('text-danger', esAnulado);
    status.classList.toggle('fw-bold', esAnulado);
    status.classList.toggle('text-muted', !esAnulado);

    const select = card.querySelector(".estado-select");
    const btn = card.querySelector(".actualizar-btn");
    select.disabled = bloqueado;
    btn.disabled = bloqueado;

    aplicarFiltros();
}

function generarNumeroFactura(idPedido, fecha) {
    const year = new Date(fecha).getFullYear();
    const key = `${year}-${idPedido}`;
    if (!contadorFacturasPorAnio[key]) {
        contadorFacturasPorAnio[year] = (contadorFacturasPorAnio[year] || 0) + 1;
        contadorFacturasPorAnio[key] = contadorFacturasPorAnio[year];
        localStorage.setItem("contadorFacturasPorAnio", JSON.stringify(contadorFacturasPorAnio));
    }
    return `F-${year}-${contadorFacturasPorAnio[key]}`;
}

function aplicarFiltros() {
    const anio = document.getElementById("selectAnio")?.value;
    const numFact = document.getElementById("inputNumeroFactura")?.value.trim();
    const filtroEstado = document.getElementById("filtroEstado")?.value;
    const busqNombre = normalizarTexto(document.getElementById("inputBusquedaNombre")?.value);
    const busqCedula = normalizarTexto(document.getElementById("inputBusquedaCedula")?.value);
    
    let filtrados = pedidosGlobal.filter(card => {
        const id = card.dataset.id_real;
        const p = pedidosDatosRaw.find(x => String(x.id_pedido) === id);
        const user = p?.usuarios || {};
        
        if (busqNombre && !normalizarTexto(`${user.nombre||''}${user.apellido||''}`).includes(busqNombre)) return false;
        if (busqCedula && !normalizarTexto(user.cedula).includes(busqCedula)) return false;

        if (numFact && card.dataset.factura !== normalizarTexto(`f-${anio}-${numFact}`)) return false;

        const est = card.dataset.estado;
        const pagos = card.dataset.todosPagos === "true";
        const verif = pedidosCanceladosVerificados.includes(id);

        if (filtroEstado === "FiltroPagoPendiente") return !pagos && est !== "Cancelado";
        if (filtroEstado === "Pendiente") return est === "Pendiente";
        if (filtroEstado === "Entregado") return est === "Entregado" && pagos;
        if (filtroEstado === "Cancelado") return est === "Cancelado";
        if (est === "Cancelado" && verif && filtroEstado === "Todos") return false;

        return true;
    });

    const grupos = { pendientes: [], finalizados: [], anulados: [] };

    filtrados.forEach(card => {
        const est = card.dataset.estado;
        const pagos = card.dataset.todosPagos === "true";
        if (est === "Cancelado") grupos.anulados.push(card);
        else if (est === "Entregado" && pagos) grupos.finalizados.push(card);
        else grupos.pendientes.push(card);
    });

    const ordenadosP = grupos.pendientes.sort(ordenarPorFechaYFijado);
    const ordenadosF = grupos.finalizados.sort(ordenarPorFechaYFijado);
    const ordenadosA = grupos.anulados.sort(ordenarPorFechaYFijado);

    const listaFinal = [];

    if (ordenadosP.length) {
        listaFinal.push(crearSeparador("PEDIDOS PENDIENTES / ACTIVOS", "bg-primary"), ...ordenadosP);
    }
    if (ordenadosF.length) {
        listaFinal.push(crearSeparador("PEDIDOS FINALIZADOS", "bg-success"), ...ordenadosF);
    }
    if (ordenadosA.length) {
        listaFinal.push(crearSeparador("PEDIDOS ANULADOS", "bg-danger"), ...ordenadosA);
    }

    pedidosFiltrados = listaFinal;
    renderizarPaginacion(pedidosFiltrados);
}



function ordenarPorFechaYFijado(a, b) {
    const fijA = a.dataset.fijado === "true" ? 1 : 0;
    const fijB = b.dataset.fijado === "true" ? 1 : 0;
    if (fijA !== fijB) return fijB - fijA;
    return new Date(b.dataset.fecha_iso) - new Date(a.dataset.fecha_iso);
}

function crearSeparador(texto, claseColor) {
    const div = document.createElement("div");
    div.className = "col-12 my-3";
    div.innerHTML = `
        <div class="d-flex align-items-center">
            <div class="flex-grow-1 border-top border-2"></div>
            <span class="badge ${claseColor} mx-3 py-2 px-4 rounded-pill shadow-sm" style="font-size: 0.85rem; letter-spacing: 1px;">
                <i class="bi bi-funnel-fill me-2"></i>${texto}
            </span>
            <div class="flex-grow-1 border-top border-2"></div>
        </div>
    `;
    div.dataset.esSeparador = "true";
    return div;
}

function inicializarSelectAnios() {
    const s = document.getElementById("selectAnio");
    const r = document.getElementById("repoAnio");
    if (!s || !r) return;
    const actual = new Date().getFullYear();
    for (let i = actual; i >= actual - 5; i--) {
        const opt = document.createElement("option");
        opt.value = i;
        opt.textContent = i;
        s.appendChild(opt.cloneNode(true));
        r.appendChild(opt);
    }
}

async function generarReporteConfigurado() {
    const { jsPDF } = window.jspdf;
    const estado = document.getElementById("repoEstado").value;
    const anio = document.getElementById("repoAnio").value;
    const mes = document.getElementById("repoMes").value;
    const admin = document.getElementById("adminName").value;
    
    let lista = pedidosDatosRaw.filter(p => {
        const f = new Date(p.fecha_pedido);
        if (f.getFullYear().toString() !== anio) return false;
        if (mes !== "Todos" && f.getMonth().toString() !== mes) return false;
        if (estado !== "Todos" && p.estado !== estado) return false;
        return true;
    });

    if (!lista.length) return mostrarAlerta("No hay pedidos con esos criterios", true);

    lista.sort((a, b) => new Date(b.fecha_pedido) - new Date(a.fecha_pedido));

    const doc = new jsPDF();
    try {
        const img = new Image(); img.src = '/static/uploads/logo.png';
        await new Promise(r => img.onload = r);
        const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
        c.getContext('2d').drawImage(img, 0, 0);
        doc.addImage(c.toDataURL('image/png'), 'PNG', 15, 10, 20, 20);
    } catch {}

    const meses = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
    const subtMes = mes === "Todos" ? "Anual" : meses[parseInt(mes)];

    doc.setFontSize(18); doc.text("Reporte de Ventas D'Antojitos ©", 40, 20);
    doc.setFontSize(10); doc.text(`Periodo: ${subtMes} ${anio} | Estado: ${estado.toUpperCase()}`, 40, 26);
    doc.text(`Fecha Emisión: ${new Date().toLocaleString()}`, 140, 20);

    let total = 0;
    const stats = { Pendiente: 0, Entregado: 0, Cancelado: 0 };

    const body = lista.map(p => {
        const sub = (p.pedido_detalle || []).reduce((a, b) => a + b.subtotal, 0);
        total += sub;
        if (stats[p.estado] !== undefined) stats[p.estado]++;
        return [
            generarNumeroFactura(p.id_pedido, p.fecha_pedido),
            new Date(p.fecha_pedido).toLocaleDateString(),
            `${p.usuarios?.nombre || ''} ${p.usuarios?.apellido || ''}`,
            p.estado.toUpperCase(),
            sub.toLocaleString('es-CO', { style: 'currency', currency: 'COP' })
        ];
    });

    body.push([
        { content: 'TOTAL ACUMULADO', colSpan: 4, styles: { halign: 'right', fontStyle: 'bold', fillColor: [240, 240, 240] } },
        { content: total.toLocaleString('es-CO', { style: 'currency', currency: 'COP' }), styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } }
    ]);

    doc.autoTable({
        startY: 35,
        head: [['Factura', 'Fecha', 'Cliente', 'Estado', 'Subtotal']],
        body,
        theme: 'grid',
        headStyles: { fillColor: [33, 37, 41] }
    });

    let y = doc.lastAutoTable.finalY + 15;
    if (y > 220) { doc.addPage(); y = 20; }
    
    const centerX = 105, centerY = y + 40, radius = 25;
    doc.setFontSize(14); doc.text("Resumen Estadístico de Pedidos", 105, y, { align: "center" });

    if (Object.values(stats).reduce((a,b)=>a+b) > 0) {
        let angle = 0;
        Object.entries(stats).forEach(([label, count]) => {
            if (count > 0) {
                const slice = (count / Object.values(stats).reduce((a,b)=>a+b)) * 2 * Math.PI;
                doc.setFillColor(...(label === "Pendiente" ? [255,193,7] : label === "Entregado" ? [40,167,69] : [220,53,69]));
                
                let points = [{x:centerX,y:centerY}];
                for (let i = 0; i <= 40; i++) {
                    const a = angle + (i/40)*slice;
                    points.push({x: centerX + radius * Math.cos(a), y: centerY + radius * Math.sin(a)});
                }
                doc.lines(points.map((p,i)=> i===0 ? [p.x,p.y] : [p.x-points[i-1].x, p.y-points[i-1].y]).slice(1), points[0].x, points[0].y, [1,1], 'F');

                const mid = angle + slice/2;
                const tx = centerX + (radius+8)*Math.cos(mid);
                const ty = centerY + (radius+8)*Math.sin(mid);
                doc.setFontSize(8); doc.setTextColor(60);
                doc.text(`${(count/Object.values(stats).reduce((a,b)=>a+b)*100).toFixed(1)}%`, tx, ty, { align: tx > centerX ? "left" : "right" });

                angle += slice;
            }
        });

        let ly = centerY + radius + 15, lx = 65;
        Object.entries({Pendiente:[255,193,7], Entregado:[40,167,69], Cancelado:[220,53,69]}).forEach(([l,c]) => {
            doc.setFillColor(...c); doc.rect(lx, ly, 3, 3, 'F');
            doc.setFontSize(8); doc.setTextColor(0);
            doc.text(`${l}: ${stats[l]}`, lx+5, ly+2.5);
            lx += 30;
        });
    } else {
        doc.setFontSize(10); doc.text("No hay datos para representar", 105, y+20, { align: "center" });
    }

    const pg = doc.internal.getNumberOfPages();
    doc.setPage(pg);
    doc.setFontSize(9); doc.setTextColor(100);
    doc.text(`Generado por Administrador: ${admin}`, 15, 285);
    doc.text(`D'Antojitos © - Página ${pg}`, 170, 285);

    doc.save(`reporte_dantojitos_${new Date().toISOString().split('T')[0]}.pdf`);
    
    bootstrap.Modal.getInstance(document.getElementById('modalConfigReporte'))?.hide();
    mostrarAlerta("Reporte generado con éxito");
}

iniciarModuloPedidos();

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/static/js/workers/service-worker-pedidos.js')
            .then(() => console.log('SW OK'))
            .catch(err => console.error('SW Error', err));
    });
}