let facturasActuales = [];
let paginaActual = 1;
const itemsPorPagina = 10;
let facturasLocalesCache = [];
let metodosPagoCache = [];
let ultimaSincronizacion = new Date();
let mostrarArchivadas = false;

const FormateadorCosto = new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0
});

function obtenerFacturasArchivadas() {
    return JSON.parse(localStorage.getItem('facturas_ocultas') || "[]");
}

function guardarFacturasArchivadas(lista) {
    localStorage.setItem('facturas_ocultas', JSON.stringify(lista));
}

function archivarFactura(numeroFactura) {
    const archivadas = obtenerFacturasArchivadas();

    if (!archivadas.includes(numeroFactura)) {
        archivadas.push(numeroFactura);
        guardarFacturasArchivadas(archivadas);
    }
}

function estaArchivada(numeroFactura) {
    return obtenerFacturasArchivadas().includes(numeroFactura);
}

function esFacturaFinalizada(f) {
    const estado = (f.estado || "").toLowerCase();

    return [
        "pagada",
        "pagado",
        "completado",
        "completada",
        "finalizado",
        "entregado",
        "anulada",
        "cancelado",
        "cancelada"
    ].includes(estado);
}

function esFacturaEmitida(f) {
    const estado = (f.estado || "").toLowerCase();

    return [
        "emitida",
        "emitido",
        "pendiente",
        "en proceso",
        "enviado"
    ].some(e => estado.includes(e));
}

function ordenarFacturas(lista) {
    return [...lista].sort((a, b) => {

        const aArchivada = estaArchivada(a.numero_factura);
        const bArchivada = estaArchivada(b.numero_factura);

        if (aArchivada !== bArchivada) {
            return aArchivada ? 1 : -1;
        }

        const aEmitida = esFacturaEmitida(a);
        const bEmitida = esFacturaEmitida(b);

        if (aEmitida !== bEmitida) {
            return aEmitida ? -1 : 1;
        }

        const aFinalizada = esFacturaFinalizada(a);
        const bFinalizada = esFacturaFinalizada(b);

        if (aFinalizada !== bFinalizada) {
            return aFinalizada ? 1 : -1;
        }

        return new Date(b.fecha_emision || b.created_at) - new Date(a.fecha_emision || a.created_at);
    });
}

function showConfirmToast(msg, callback) {
    mostrarConfirmacionApp('Confirmar acción', msg, callback);
}

function showMessage(msg, isError = false) {
    mostrarAlerta(msg, isError);
}

function playNotificationSound() {
    try {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;

        if (!AudioContextClass) return;

        const audioCtx = new AudioContextClass();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();

        oscillator.type = 'sine';

        oscillator.frequency.setValueAtTime(880, audioCtx.currentTime);

        oscillator.frequency.exponentialRampToValueAtTime(
            440,
            audioCtx.currentTime + 0.1
        );

        gainNode.gain.setValueAtTime(0.05, audioCtx.currentTime);

        gainNode.gain.exponentialRampToValueAtTime(
            0.01,
            audioCtx.currentTime + 0.2
        );

        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);

        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.2);

    } catch (e) {
        console.warn(e);
    }
}

function lanzarNotificacionMultidispositivo(fObj, estado) {
    playNotificationSound();

    const facturaFormateada = fObj.numero_factura;
    const estadoL = estado.toLowerCase();

    let configuracion = {
        color: "primary",
        icono: "bi-info-circle-fill",
        titulo: "Actualización de Pedido"
    };

    if (["anulada", "cancelado", "cancelada"].includes(estadoL)) {
        configuracion = {
            color: "danger",
            icono: "bi-x-circle-fill",
            titulo: "Pedido Anulado"
        };
    }

    else if (["pagada", "pagado", "completado", "completada"].includes(estadoL)) {
        configuracion = {
            color: "success",
            icono: "bi-check-circle-fill",
            titulo: "Pago Confirmado"
        };
    }

    else if (["emitida", "emitido"].includes(estadoL)) {
        configuracion = {
            color: "info",
            icono: "bi-send-fill",
            titulo: "Pedido Emitido"
        };
    }

    else if (estadoL === "enviado") {
        configuracion = {
            color: "warning",
            icono: "bi-truck",
            titulo: "Pedido en Camino"
        };
    }

    else if (["finalizado", "entregado"].includes(estadoL)) {
        configuracion = {
            color: "info",
            icono: "bi-house-check-fill",
            titulo: "Pedido Entregado"
        };
    }

    if (Notification.permission === "granted") {
        new Notification(configuracion.titulo, {
            body: `Tu factura ${facturaFormateada} ha pasado al estado: ${estado.toUpperCase()}`,
            icon: "/static/uploads/logo.png"
        });
    }

    const cont = document.getElementById("toastContainer");

    if (!cont) return;

    const t = document.createElement("div");

    t.className = `custom-toast bg-dark text-white border-0 shadow-lg mb-2`;

    t.style.borderLeft = `5px solid var(--bs-${configuracion.color})`;
    t.style.minWidth = "320px";
    t.style.transition = "all 0.4s ease";

    t.innerHTML = `
        <div class="d-flex align-items-center p-3">

            <div class="position-relative me-3">
                <i class="bi ${configuracion.icono} text-${configuracion.color} fs-3"></i>
                <span class="position-absolute top-0 start-100 translate-middle p-1 bg-${configuracion.color} border border-light rounded-circle"></span>
            </div>

            <div class="flex-grow-1">

                <strong style="font-size: 0.9rem;" class="d-block text-uppercase">
                    ${configuracion.titulo}
                </strong>

                <div class="d-flex align-items-center gap-1 mt-1">

                    <small class="text-white-50">
                        Factura ${facturaFormateada}
                    </small>

                    <span class="badge bg-${configuracion.color} text-dark ms-auto" style="font-size: 0.6rem;">
                        ${estado.toUpperCase()}
                    </span>

                </div>

            </div>

            <i class="bi bi-x-lg ms-3 btn-close-toast" style="cursor:pointer; font-size: 0.7rem;"></i>

        </div>
    `;

    cont.appendChild(t);

    const remove = () => {
        t.style.opacity = '0';
        t.style.transform = 'translateY(-10px)';
        setTimeout(() => t.remove(), 400);
    };

    t.querySelector('.btn-close-toast').onclick = remove;

    setTimeout(remove, 8000);
}

async function cargarMetodosPago() {
    try {
        const res = await fetch("/obtener_metodos_pago");

        if (res.ok) {
            const data = await res.json();
            metodosPagoCache = data.metodos || [];
        }

    } catch (e) {
        console.error(e);
    }
}

function _getBankConfig(entidad) {
    const MAP = {
        'Nequi':        { color: '#8e24aa', bg: '#f3e5f5', icon: 'bi-phone-fill' },
        'Daviplata':     { color: '#e53935', bg: '#ffebee', icon: 'bi-credit-card-2-front-fill' },
        'Bancolombia':   { color: '#f9a825', bg: '#fff8e1', icon: 'bi-bank2' },
        'NuBank':        { color: '#6200ea', bg: '#ede7f6', icon: 'bi-wallet2' },
        'Efecty':        { color: '#ff6f00', bg: '#fff3e0', icon: 'bi-currency-dollar' },
        'Movii':         { color: '#0d47a1', bg: '#e3f2fd', icon: 'bi-phone' },
        'PSE':           { color: '#1565c0', bg: '#e8f5e9', icon: 'bi-building' },
    };
    return MAP[entidad] || { color: '#d35400', bg: '#fff5e1', icon: 'bi-wallet-fill' };
}

function abrirModalPago(facturaNum, total) {
    const modalElement = document.getElementById('modalPago');
    const modalBody    = document.getElementById("modalPagoBody");
    if (!modalElement || !modalBody) return;

    if (!metodosPagoCache || metodosPagoCache.length === 0) {
        modalBody.innerHTML = `
            <div class="text-center py-5">
                <i class="bi bi-bank2 display-4 text-muted opacity-25 d-block mb-3"></i>
                <h6 class="text-muted fw-bold">Canales de pago no disponibles</h6>
                <p class="small text-muted">Estamos actualizando nuestras cuentas.</p>
            </div>`;
    } else {
        const bancoActivo = 0;
        modalBody.innerHTML = `
            <div class="payment-modal-header">
                <div class="payment-secure-badge">
                    <i class="bi bi-shield-fill-check me-1"></i>Pago 100% Seguro
                </div>
                <div class="payment-ref-box">
                    <div class="payment-ref-label">Referencia de Pago</div>
                    <div class="payment-ref-num font-monospace">${facturaNum}</div>
                    <div class="payment-ref-total">${total}</div>
                </div>
            </div>

            <div class="payment-bank-tabs" id="paymentBankTabs">
                ${metodosPagoCache.map((m, i) => {
                    const cfg = _getBankConfig(m.entidad);
                    return `
                    <button class="payment-bank-tab ${i === 0 ? 'active' : ''}"
                            onclick="_selectBanco(${i})" id="ptab-${i}"
                            style="--bank-color:${cfg.color};">
                        <div class="payment-bank-tab-img" style="background:${cfg.bg};">
                            ${m.qr_url
                                ? `<img src="${m.qr_url}" alt="${m.entidad}"
                                        style="border-radius:6px;"
                                        onerror="this.outerHTML='<i class=\\'bi ${cfg.icon}\\' style=\\'color:${cfg.color};font-size:1.4rem;\\'></i>'">`
                                : `<i class="bi ${cfg.icon}" style="color:${cfg.color};font-size:1.4rem;"></i>`}
                        </div>
                        <span>${m.entidad}</span>
                    </button>`;
                }).join('')}
            </div>

            <div id="paymentBankDetail">
                ${metodosPagoCache.map((m, i) => `
                    <div class="payment-bank-panel ${i === 0 ? 'active' : ''}" id="bpanel-${i}">
                        <div class="payment-qr-container">
                            <div class="payment-qr-box">
                                ${m.qr_url
                                    ? `<img src="${m.qr_url}" alt="QR ${m.entidad}"
                                            onerror="this.outerHTML='<div class=payment-qr-ph><i class=bi.bi-qr-code-scan></i></div>'">`
                                    : `<div class="payment-qr-ph"><i class="bi bi-qr-code-scan"></i></div>`}
                            </div>
                            <div class="payment-qr-instructions">
                                <i class="bi bi-phone me-1 text-muted"></i>
                                Escanea con la app de <strong>${m.entidad}</strong>
                            </div>
                        </div>
                        <div class="payment-account-info">
                            <div class="payment-account-row">
                                <span class="payment-account-label">${m.tipo_cuenta || 'Tipo de cuenta'}</span>
                                <span class="payment-account-val">${m.titular}</span>
                            </div>
                            <div class="payment-number-row">
                                <span class="payment-number font-monospace">${m.numero}</span>
                                <button class="payment-copy-btn"
                                        onclick="navigator.clipboard.writeText('${m.numero}').then(()=>showMessage('Número copiado'))">
                                    <i class="bi bi-copy me-1"></i>Copiar
                                </button>
                            </div>
                        </div>
                    </div>`).join('')}
            </div>

            <div class="payment-notice">
                <i class="bi bi-info-circle-fill me-2"></i>
                Envía tu comprobante por
                <a href="https://wa.me/573115699825" target="_blank">WhatsApp</a>
                o
                <a href="mailto:terugag@hotmail.com">correo</a>
                tras realizar la transferencia.
            </div>`;
    }

    bootstrap.Modal.getOrCreateInstance(modalElement).show();
}

window._selectBanco = function(idx) {
    document.querySelectorAll('.payment-bank-tab').forEach((t, i) => t.classList.toggle('active', i === idx));
    document.querySelectorAll('.payment-bank-panel').forEach((p, i) => p.classList.toggle('active', i === idx));
};

async function descargarPDF(f) {

    const { jsPDF } = window.jspdf || window.jsPDF;

    if (!jsPDF) {
        showMessage("Librería PDF no detectada", true);
        return;
    }

    const doc = new jsPDF();

    const logoUrl = '/static/uploads/logo.png';

    try {

        const img = new Image();

        img.src = logoUrl;

        await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
        });

        const canvas = document.createElement('canvas');

        canvas.width = img.width;
        canvas.height = img.height;

        const ctx = canvas.getContext('2d');

        ctx.drawImage(img, 0, 0);

        doc.addImage(
            canvas.toDataURL('image/png'),
            'PNG',
            15,
            12,
            25,
            25
        );

    } catch (e) {
        console.warn(e);
    }

    doc.setFontSize(24);
    doc.setTextColor(20, 20, 20);

    doc.text("D'Antojitos ©", 45, 25);

    doc.setFontSize(9);
    doc.setTextColor(80);

    doc.text(`Documento: ${f.numero_factura}`, 140, 20);

    doc.text(
        `Emisión: ${new Date(f.fecha_emision || Date.now()).toLocaleString()}`,
        140,
        25
    );

    doc.text(`Cédula: ${f.cedula || 'Registrada'}`, 140, 30);

    doc.setDrawColor(200);

    doc.line(15, 40, 195, 40);

    const esAnulada = [
        "anulada",
        "cancelado",
        "cancelada"
    ].includes(f.estado.toLowerCase());

    doc.setFont("helvetica", "bold");

    doc.setFontSize(12);

    doc.setTextColor(
        esAnulada ? 200 : 0,
        esAnulada ? 0 : 150,
        esAnulada ? 0 : 0
    );

    doc.text(
        `ESTADO ACTUAL: ${f.estado.toUpperCase()}`,
        15,
        48
    );

    const dataFilas = (f.productos || []).map(p => [
        p.nombre_producto,
        `${p.cantidad} unidad(es)`,
        FormateadorCosto.format(Number(p.precio_unitario || 0)),
        FormateadorCosto.format(Number(p.subtotal || 0))
    ]);

    doc.autoTable({
        startY: 55,

        head: [[
            'Descripción',
            'Cant.',
            'Unitario',
            'Subtotal'
        ]],

        body: dataFilas,

        theme: 'striped',

        headStyles: {
            fillColor: [40, 40, 40],
            textColor: [255, 255, 255],
            fontStyle: 'bold'
        },

        columnStyles: {
            3: {
                halign: 'right',
                fontStyle: 'bold'
            }
        }
    });

    const finalY = doc.lastAutoTable.finalY;

    const totalVenta = (f.productos || []).reduce(
        (acc, curr) => acc + Number(curr.subtotal),
        0
    );

    doc.setFillColor(245, 245, 245);

    doc.rect(130, finalY + 5, 65, 15, 'F');

    doc.setFontSize(14);
    doc.setTextColor(0);

    doc.text(
        `TOTAL: ${FormateadorCosto.format(totalVenta)}`,
        190,
        finalY + 15,
        { align: 'right' }
    );

    doc.setFontSize(8);
    doc.setTextColor(150);

    doc.text(
        "Comprobante de operación digital.",
        105,
        285,
        { align: 'center' }
    );

    doc.save(`Factura_${f.numero_factura}.pdf`);
}

async function procesarAnulacion(numFactura) {

    showConfirmToast("¿Cancelar este pedido?", async () => {

        try {

            const res = await fetch(
                `/anular_factura_page/${numFactura}`,
                {
                    method: "PUT"
                }
            );

            if (res.status === 401) {
                window.location.reload();
                return;
            }

            if (res.ok) {

                await monitorearCambiosFacturas();

                showMessage("Pedido cancelado exitosamente");
            }

        } catch (e) {

            showMessage("Error de conexión", true);
        }
    });
}

async function monitorearCambiosFacturas() {

    const inputBuscar = document.getElementById("buscarFactura");

    const criterio = inputBuscar
        ? inputBuscar.value.trim()
        : "";

    if (!criterio) return;

    try {

        const res = await fetch(`/buscar_facturas_page?q=${encodeURIComponent(criterio)}`);

        if (res.status === 401) {
            window.location.reload();
            return;
        }

        if (!res.ok) return;

        const facturasServidor = await res.json();

        if (facturasLocalesCache.length > 0) {

            facturasServidor.forEach(fServ => {

                const fLocal = facturasLocalesCache.find(
                    l => l.numero_factura === fServ.numero_factura
                );

                if (fLocal && fLocal.estado !== fServ.estado) {
                    lanzarNotificacionMultidispositivo(fServ, fServ.estado);
                }
            });
        }

        facturasLocalesCache = JSON.parse(JSON.stringify(facturasServidor));

        const term = criterio.toLowerCase();

        const filtradas = facturasServidor.filter(f =>
            f.numero_factura.toLowerCase().includes(term) ||
            (f.cedula && f.cedula.toString().toLowerCase().includes(term)) ||
            (f.cliente_nombre && f.cliente_nombre.toLowerCase().includes(term)) ||
            (f.username_cliente && f.username_cliente.toLowerCase().includes(term))
        );

        facturasActuales = ordenarFacturas(filtradas);

        mostrarFacturasBuscadas();

        ultimaSincronizacion = new Date();

    } catch (e) {
        console.error(e);
    }
}

function _configVisual(estadoLower) {
    if (['anulada','cancelado','cancelada'].includes(estadoLower))
        return { color: 'danger',  icono: 'bi-x-octagon-fill',      label: 'ANULADA'   };
    if (['pagada','pagado','finalizado','entregado','completada','completado'].includes(estadoLower))
        return { color: 'success', icono: 'bi-patch-check-fill',     label: 'PAGADA'    };
    if (estadoLower.includes('emitid'))
        return { color: 'info',    icono: 'bi-file-earmark-arrow-up', label: 'EMITIDA'  };
    if (estadoLower === 'enviado')
        return { color: 'warning', icono: 'bi-truck-flatbed',         label: 'ENVIADO'  };
    return { color: 'primary', icono: 'bi-hourglass-split', label: estadoLower.toUpperCase() };
}

function mostrarFacturasBuscadas() {

    const container = document.getElementById("facturasContainer");

    const filtroEstado = document.getElementById("filtroEstadoFactura");

    if (!container) return;

    const archivadas = obtenerFacturasArchivadas();

    let filtradas = [...facturasActuales];

    if (mostrarArchivadas) {

        filtradas = filtradas.filter(f =>
            archivadas.includes(f.numero_factura)
        );

    } else {

        filtradas = filtradas.filter(f => {

            const archivada = archivadas.includes(f.numero_factura);

            const emitida = esFacturaEmitida(f);

            if (emitida) {
                return true;
            }

            return !archivada;
        });
    }

    if (filtroEstado && filtroEstado.value !== "todos") {

        const valFiltro = filtroEstado.value.toLowerCase();

        filtradas = filtradas.filter(f => {

            const e = (f.estado || "").toLowerCase();

            if (valFiltro === "emitida") {
                return e.includes("emitid");
            }

            if (valFiltro === "pagado") {

                return [
                    "pagada",
                    "pagado",
                    "finalizado",
                    "entregado",
                    "completada",
                    "completado"
                ].includes(e);
            }

            if (valFiltro === "anulada") {

                return [
                    "anulada",
                    "cancelado",
                    "cancelada"
                ].includes(e);
            }

            return true;
        });
    }

    filtradas = [...filtradas].sort((a, b) =>
        new Date(b.fecha_emision || b.created_at) - new Date(a.fecha_emision || a.created_at)
    );

    const totalItems = filtradas.length;

    if (paginaActual > Math.ceil(totalItems / itemsPorPagina) && Math.ceil(totalItems / itemsPorPagina) > 0)
        paginaActual = Math.ceil(totalItems / itemsPorPagina);

    container.innerHTML = "";

    if (filtradas.length === 0) {
        container.innerHTML = `
            <div class="text-center p-5 rounded-4 border">
                <i class="bi bi-folder2-open display-4 text-muted opacity-25 d-block mb-3"></i>
                <h6 class="fw-bold">No se encontraron registros</h6>
                <p class="text-muted small">${mostrarArchivadas ? "No hay facturas archivadas." : "No se encontraron facturas."}</p>
            </div>`;
        paginar(0);
        return;
    }

    const inicio   = (paginaActual - 1) * itemsPorPagina;
    const paginadas = filtradas.slice(inicio, inicio + itemsPorPagina);

    const lista = document.createElement('div');
    lista.className = 'invoice-list';

    paginadas.forEach((f, idx) => {
        const globalIdx = inicio + idx;
        const estadoLower = (f.estado || 'emitida').toLowerCase();
        const cv          = _configVisual(estadoLower);
        const esFinal     = ['danger','success'].includes(cv.color);
        const fecha       = new Date(f.fecha_emision || f.created_at);
        const fechaStr    = fecha.toLocaleDateString('es-CO', { day:'2-digit', month:'short', year:'numeric' });

        let totalSuma = 0;
        const productosHtml = (f.productos || []).map(p => {
            totalSuma += Number(p.subtotal || 0);
            return `<div class="inv-product-row">
                        <div>
                            <span class="fw-semibold">${p.nombre_producto}</span>
                            <small class="text-muted ms-2">× ${p.cantidad}</small>
                        </div>
                        <span class="fw-bold">${FormateadorCosto.format(Number(p.subtotal || 0))}</span>
                    </div>`;
        }).join('');

        const item = document.createElement('div');
        item.className = `inv-item inv-${cv.color}`;
        item.id = `inv-item-${globalIdx}`;

        item.innerHTML = `
            <div class="inv-header" onclick="toggleInvItem(${globalIdx})">
                <div class="inv-header-left">
                    <i class="bi bi-receipt-cutoff inv-icon text-${cv.color}"></i>
                    <span class="inv-num font-monospace fw-bold">${f.numero_factura}</span>
                </div>
                <div class="inv-header-center text-muted small">${fechaStr}</div>
                <div class="inv-header-right">
                    <span class="badge inv-badge badge-${cv.color}">
                        <i class="bi ${cv.icono} me-1"></i>${cv.label}
                    </span>
                    <i class="bi bi-chevron-down inv-chevron ms-2"></i>
                </div>
            </div>

            <div class="inv-body" id="inv-body-${globalIdx}">
                <div class="inv-products-box">${productosHtml}</div>
                <div class="inv-total-row">
                    <span class="text-muted small fw-bold text-uppercase">Total</span>
                    <span class="inv-total-amount">${FormateadorCosto.format(totalSuma)}</span>
                </div>
                ${!esFinal ? `
                    <button class="btn btn-primary w-100 rounded-pill py-2 fw-bold inv-btn-pagar">
                        <i class="bi bi-qr-code-scan me-2"></i>PROCEDER AL PAGO
                    </button>` : `
                    <div class="alert alert-${cv.color === 'danger' ? 'secondary' : 'success'} border-0 rounded-pill py-2 text-center small fw-bold mb-0">
                        <i class="bi ${cv.color === 'danger' ? 'bi-slash-circle' : 'bi-shield-fill-check'} me-1"></i>
                        ${cv.color === 'danger' ? 'ANULADO' : 'COMPLETADO'}
                    </div>`}
                <div class="inv-actions mt-2">
                    <button class="btn btn-sm btn-outline-dark inv-btn-pdf flex-fill">
                        <i class="bi bi-file-earmark-pdf me-1"></i>PDF
                    </button>
                    ${!esFinal ? `
                        <button class="btn btn-sm btn-outline-danger inv-btn-anular flex-fill">
                            <i class="bi bi-x-circle me-1"></i>Anular
                        </button>` : `
                        <button class="btn btn-sm btn-outline-secondary inv-btn-archivar flex-fill">
                            <i class="bi bi-archive me-1"></i>Archivar
                        </button>`}
                </div>
            </div>`;

        const bp = item.querySelector('.inv-btn-pagar');
        if (bp) bp.onclick = () => abrirModalPago(f.numero_factura, FormateadorCosto.format(totalSuma));

        const ba = item.querySelector('.inv-btn-anular');
        if (ba) ba.onclick = () => procesarAnulacion(f.numero_factura);

        const bq = item.querySelector('.inv-btn-archivar');
        if (bq) bq.onclick = () => { archivarFactura(f.numero_factura); mostrarFacturasBuscadas(); };

        item.querySelector('.inv-btn-pdf').onclick = () => descargarPDF(f);

        lista.appendChild(item);
    });

    container.appendChild(lista);
    paginar(filtradas.length);
}

window.toggleInvItem = function(idx) {
    const body    = document.getElementById(`inv-body-${idx}`);
    const item    = document.getElementById(`inv-item-${idx}`);
    const chevron = item?.querySelector('.inv-chevron');
    if (!body) return;
    const open = body.classList.toggle('open');
    if (chevron) chevron.style.transform = open ? 'rotate(180deg)' : '';
    if (item) item.classList.toggle('expanded', open);
};

function paginar(totalItems) {

    const nav = document.getElementById("paginacion");

    if (!nav) return;

    nav.innerHTML = "";

    const maxPaginas = Math.ceil(totalItems / itemsPorPagina);

    if (maxPaginas <= 1) return;

    const frag = document.createDocumentFragment();

    for (let i = 1; i <= maxPaginas; i++) {

        const item = document.createElement("li");

        item.className = `
            page-item
            ${i === paginaActual ? 'active' : ''}
            mx-1
        `;

        item.innerHTML = `
            <a class="page-link rounded-circle border-0 shadow-sm fw-bold" href="#">
                ${i}
            </a>
        `;

        item.onclick = (e) => {

            e.preventDefault();

            paginaActual = i;

            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });

            mostrarFacturasBuscadas();
        };

        frag.appendChild(item);
    }

    nav.appendChild(frag);
}

document.addEventListener('DOMContentLoaded', async () => {

    await cargarMetodosPago();

    const inputInput = document.getElementById("buscarFactura");

    const selectFiltro = document.getElementById("filtroEstadoFactura");

    const btnArchivadas = document.getElementById("btnToggleArchivadas");

    if (btnArchivadas) {

        btnArchivadas.addEventListener("click", () => {

            mostrarArchivadas = !mostrarArchivadas;

            const icono = '<i class="bi bi-archive-fill me-2"></i>';

            btnArchivadas.innerHTML = mostrarArchivadas
                ? `${icono}Ocultar archivadas`
                : `${icono}Mostrar archivadas`;

            btnArchivadas.classList.toggle(
                "btn-primary",
                mostrarArchivadas
            );

            btnArchivadas.classList.toggle(
                "btn-outline-primary",
                !mostrarArchivadas
            );

            paginaActual = 1;

            mostrarFacturasBuscadas();
        });
    }

    if (inputInput) {

        let timerBusqueda;

        inputInput.addEventListener("input", function() {

            clearTimeout(timerBusqueda);

            const val = this.value.trim();

            if (val.length >= 3) {

                timerBusqueda = setTimeout(() => {

                    paginaActual = 1;

                    monitorearCambiosFacturas();

                }, 300);
            }

            else if (val.length === 0) {

                facturasActuales = [];
                facturasLocalesCache = [];

                mostrarFacturasBuscadas();
            }
        });
    }

    if (selectFiltro) {

        selectFiltro.addEventListener("change", () => {

            paginaActual = 1;

            mostrarFacturasBuscadas();
        });
    }

    setInterval(() => {

        if (facturasActuales.length > 0) {
            monitorearCambiosFacturas();
        }

    }, 12000);
});