let facturasActuales = [];
let estadosFacturasPrevios = {};
let paginaActual = 1;
const itemsPorPagina = 10;
let facturasLocalesCache = [];
let metodosPagoCache = [];

function showConfirmToast(msg, callback) {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const t = document.createElement('div');
    t.className = 'custom-toast bg-dark text-white p-3 shadow-lg mb-2';
    t.style.cssText = `
        border-left: 4px solid #ffc107;
        min-width: 300px;
        border-radius: 8px;
        pointer-events: auto !important;
        opacity: 1;
        display: block;
    `;

    t.innerHTML = `
        <div class="mb-3">
            <i class="bi bi-exclamation-triangle text-warning me-2"></i>
            <strong>${msg}</strong>
        </div>
        <div class="d-flex gap-2 justify-content-end">
            <button class="btn btn-sm btn-outline-light border-0 btn-cancelar-confirm">Cancelar</button>
            <button class="btn btn-sm btn-warning fw-bold px-3 btn-aceptar-confirm">Confirmar</button>
        </div>
    `;

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
    toast.style.cssText = `
        border-left: 4px solid ${isError ? '#dc3545' : '#198754'};
        min-width: 300px;
        border-radius: 8px;
        pointer-events: auto !important;
    `;

    toast.innerHTML = `
        <div class="d-flex align-items-center justify-content-between">
            <div class="d-flex align-items-center">
                <i class="bi ${isError ? 'bi-x-circle text-danger' : 'bi-check-circle text-success'} me-3 fs-5"></i>
                <span>${msg}</span>
            </div>
            <i class="bi bi-x-lg ms-3 btn-close-toast" style="cursor:pointer; font-size: 0.7rem;"></i>
        </div>
    `;

    container.appendChild(toast);

    const remove = () => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 400);
    };

    toast.querySelector('.btn-close-toast').onclick = (e) => {
        e.stopPropagation();
        remove();
    };

    setTimeout(remove, 3500);
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
        oscillator.frequency.exponentialRampToValueAtTime(440, audioCtx.currentTime + 0.1);
        gainNode.gain.setValueAtTime(0.05, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.2);
    } catch (e) {}
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
        configuracion = { color: "danger", icono: "bi-x-circle-fill", titulo: "Pedido Anulado" };
    } else if (["pagada", "pagado", "completado", "completada"].includes(estadoL)) {
        configuracion = { color: "success", icono: "bi-check-circle-fill", titulo: "Pago Confirmado" };
    } else if (["emitida", "emitido"].includes(estadoL)) {
        configuracion = { color: "info", icono: "bi-send-fill", titulo: "Pedido Emitido" };
    } else if (estadoL === "enviado") {
        configuracion = { color: "warning", icono: "bi-truck", titulo: "Pedido en Camino" };
    } else if (["finalizado", "entregado"].includes(estadoL)) {
        configuracion = { color: "info", icono: "bi-house-check-fill", titulo: "Pedido Entregado" };
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
    t.style.minWidth = "300px";
    t.style.transition = "opacity 0.4s ease";
    t.innerHTML = `
        <div class="d-flex align-items-center p-2">
            <i class="bi ${configuracion.icono} text-${configuracion.color} fs-4 me-3"></i>
            <div class="flex-grow-1">
                <strong style="font-size: 0.85rem;" class="d-block">${configuracion.titulo}</strong>
                <small class="text-white-50">Factura ${facturaFormateada}: </small>
                <span class="badge bg-${configuracion.color} text-dark" style="font-size: 0.65rem;">${estado.toUpperCase()}</span>
            </div>
            <i class="bi bi-x-lg ms-2 btn-close-toast" style="cursor:pointer; font-size: 0.7rem;"></i>
        </div>`;

    cont.appendChild(t);
    const remove = () => {
        t.style.opacity = '0';
        setTimeout(() => t.remove(), 400);
    };
    t.querySelector('.btn-close-toast').onclick = remove;
    setTimeout(remove, 7000);
}

async function monitorearCambiosFacturas() {
    const inputBuscar = document.getElementById("buscarFactura");
    const cedula = inputBuscar ? inputBuscar.value.trim() : "";
    if (!cedula || cedula.length < 6) return;

    try {
        const res = await fetch(`/buscar_facturas_page?cedula=${encodeURIComponent(cedula)}`);
        if (!res.ok) return;
        
        const facturasServidor = await res.json();
        const ocultas = JSON.parse(localStorage.getItem('facturas_ocultas') || "[]");

        if (facturasLocalesCache.length > 0) {
            facturasServidor.forEach(fServ => {
                const fLocal = facturasLocalesCache.find(l => l.numero_factura === fServ.numero_factura);
                if (fLocal && fLocal.estado !== fServ.estado) {
                    lanzarNotificacionMultidispositivo(fServ, fServ.estado);
                }
            });
        }

        facturasLocalesCache = facturasServidor;
        facturasActuales = facturasServidor
            .filter(f => !ocultas.includes(f.numero_factura))
            .sort((a, b) => new Date(b.fecha_emision) - new Date(a.fecha_emision));

        mostrarFacturasBuscadas();
    } catch (e) {
        console.error("Error en sincronización:", e);
    }
}

async function cargarMetodosPago() {
    try {
        const res = await fetch("/obtener_metodos_pago");
        if (res.ok) {
            const data = await res.json();
            metodosPagoCache = data.metodos || [];
        }
    } catch (e) {
        console.error("Error cargando métodos de pago:", e);
    }
}

function abrirModalPago(facturaNum, total) {
    const modalElement = document.getElementById('modalPago');
    const modalBody = document.getElementById("modalPagoBody");
    if (!modalElement || !modalBody) return;

    if (!metodosPagoCache || metodosPagoCache.length === 0) {
        modalBody.innerHTML = `
            <div class="text-center p-5">
                <i class="bi bi-wallet2 fs-1 text-muted mb-3 d-block"></i>
                <h5 class="text-secondary">Sin métodos registrados</h5>
                <p class="small text-muted">No hay cuentas de pago disponibles en este momento.</p>
            </div>`;
    } else {
        modalBody.innerHTML = `
            <div class="text-center mb-4 border-bottom pb-3">
                <p class="text-muted mb-1 small text-uppercase fw-bold">Referencia de Pago</p>
                <h4 class="fw-bold text-dark mb-1">${facturaNum}</h4>
                <div class="fs-3 fw-bold text-primary">${total}</div>
            </div>
            <div class="row g-4 justify-content-center">
                ${metodosPagoCache.map(m => `
                    <div class="col-12 col-md-6">
                        <div class="card h-100 border-0 shadow-sm rounded-4 overflow-hidden">
                            <div class="card-header bg-dark text-white text-center py-2 border-0">
                                <span class="fw-bold small text-uppercase">${m.entidad} - ${m.tipo_cuenta}</span>
                            </div>
                            <div class="card-body p-3 text-center bg-white">
                                <div class="mb-3">
                                    <img src="${m.qr_url || '/static/uploads/no-qr.png'}" 
                                         class="img-fluid rounded-3 border p-2 bg-light shadow-sm"
                                         style="max-height: 200px; width: 100%; object-fit: contain;"
                                         onerror="this.src='/static/uploads/no-qr.png'">
                                </div>
                                <div class="bg-light rounded-3 p-3 border">
                                    <p class="text-muted small mb-1 text-uppercase fw-bold" style="font-size: 0.65rem;">Titular de la cuenta</p>
                                    <p class="mb-2 fw-semibold text-dark">${m.titular}</p>
                                    <hr class="my-2 opacity-25">
                                    <p class="text-muted small mb-1 text-uppercase fw-bold" style="font-size: 0.65rem;">Número / Celular</p>
                                    <div class="d-flex align-items-center justify-content-center gap-2">
                                        <span class="fs-5 fw-bold text-primary text-break">${m.numero}</span>
                                        <button class="btn btn-primary btn-sm rounded-circle d-flex align-items-center justify-content-center"
                                                style="width: 32px; height: 32px;"
                                                onclick="navigator.clipboard.writeText('${m.numero}').then(() => showMessage('Número copiado al portapapeles'))">
                                            <i class="bi bi-clipboard"></i>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
            <div class="mt-4 p-3 bg-primary bg-opacity-10 border border-primary border-dashed rounded-3 text-center">
                <p class="small text-primary mb-0 fw-medium">
                    <i class="bi bi-info-circle-fill me-2"></i>Realiza la transferencia y adjunta el comprobante vía WhatsApp o al correo <strong>d.antojitos1958@gmail.com</strong>
                </p>
            </div>`;
    }
    bootstrap.Modal.getOrCreateInstance(modalElement).show();
}

async function descargarPDF(f) {
    const { jsPDF } = window.jspdf || window.jsPDF;
    if (!jsPDF) {
        showMessage("Error al cargar generador de PDF", true);
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
        doc.addImage(canvas.toDataURL('image/png'), 'PNG', 15, 12, 22, 22);
    } catch (e) {}

    doc.setFontSize(22);
    doc.setTextColor(33, 37, 41);
    doc.text("D'Antojitos ©", 42, 25);
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Factura N°: ${f.numero_factura}`, 145, 20);
    doc.text(`Fecha: ${new Date(f.fecha_emision).toLocaleString()}`, 145, 25);
    doc.setFont("helvetica", "bold");
    
    const esAnulada = ["anulada", "cancelado", "cancelada"].includes(f.estado.toLowerCase());
    doc.setTextColor(esAnulada ? 220 : 40, esAnulada ? 53 : 167, esAnulada ? 69 : 69);
    doc.text(`ESTADO: ${f.estado.toUpperCase()}`, 145, 30);
    
    const tableData = (f.productos || []).map(p => [
        p.nombre_producto,
        `x${p.cantidad}`,
        Number(p.subtotal).toLocaleString('es-CO', { style: 'currency', currency: 'COP' })
    ]);

    doc.autoTable({
        startY: 45,
        head: [['Producto', 'Cantidad', 'Subtotal']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [33, 37, 41] }
    });

    const finalY = doc.lastAutoTable.finalY;
    const total = (f.productos || []).reduce((acc, curr) => acc + Number(curr.subtotal), 0);
    doc.setFontSize(14);
    doc.setTextColor(0);
    doc.text(`TOTAL: ${total.toLocaleString('es-CO', { style: 'currency', currency: 'COP' })}`, 195, finalY + 12, { align: 'right' });
    
    doc.save(`Factura_${f.numero_factura}.pdf`);
    showMessage("Descarga finalizada PDF");
}

function mostrarFacturasBuscadas() {
    const container = document.getElementById("facturasContainer");
    if (!container) return;
    container.innerHTML = "";

    const ocultas = JSON.parse(localStorage.getItem('facturas_ocultas') || "[]");
    let filtradas = facturasActuales.filter(f => !ocultas.includes(f.numero_factura));
    const paginadas = filtradas.slice((paginaActual - 1) * itemsPorPagina, paginaActual * itemsPorPagina);

    if (paginadas.length === 0) {
        container.innerHTML = `
            <div class="text-center p-5 text-muted bg-white rounded-4 shadow-sm">
                <i class="bi bi-search fs-1"></i>
                <p class="mt-2">No se encontraron facturas</p>
            </div>`;
        paginar(0);
        return;
    }

    paginadas.forEach(f => {
        const card = document.createElement("div");
        const estadoRaw = f.estado || "";
        const estadoLower = estadoRaw.toLowerCase();
        
        const esPagada = ["pagada", "pagado", "finalizado", "entregado", "completada", "completado"].includes(estadoLower);
        const esAnulada = ["anulada", "cancelado", "cancelada"].includes(estadoLower);
        const esEstadoFinal = esPagada || esAnulada;

        let totalCalculado = 0;
        let detalleHtml = (f.productos || []).map(p => {
            const sub = Number(p.subtotal || 0);
            totalCalculado += sub;
            return `
                <div class="d-flex justify-content-between border-bottom py-1">
                    <span class="text-dark text-truncate" style="max-width: 200px;">${p.nombre_producto}</span>
                    <span class="text-muted small">x${p.cantidad}</span>
                    <span class="fw-bold">${sub.toLocaleString('es-CO', {style: 'currency', currency: 'COP', maximumFractionDigits: 0})}</span>
                </div>`;
        }).join('');

        let colorBadge = "primary";
        let iconoEstado = "bi-clock-history";

        if (esAnulada) {
            colorBadge = "danger";
            iconoEstado = "bi-x-circle";
        } else if (esPagada) {
            colorBadge = "success";
            iconoEstado = "bi-check-circle-fill";
        } else if (estadoLower.includes("emitid")) {
            colorBadge = "info";
            iconoEstado = "bi-send";
        } else if (estadoLower === "enviado") {
            colorBadge = "warning";
            iconoEstado = "bi-truck";
        }

        card.className = `card card-factura mb-4 shadow-sm border-0 ${esEstadoFinal ? 'factura-finalizada' : ''}`;
        card.innerHTML = `
            <div class="factura-header p-3 border-bottom">
                <div class="d-flex justify-content-between align-items-center">
                    <div class="d-flex align-items-center">
                        <div class="rounded-circle bg-dark text-white d-flex align-items-center justify-content-center me-3" style="width:40px; height:40px;">
                            <i class="bi bi-receipt fs-5"></i>
                        </div>
                        <div>
                            <h6 class="fw-bold mb-0">${f.numero_factura}</h6>
                            <small class="text-primary fw-bold">CC: ${f.cedula || 'N/A'}</small>
                        </div>
                    </div>
                    <span class="badge bg-${colorBadge} d-flex align-items-center gap-1 py-2 px-3 rounded-pill">
                        <i class="bi ${iconoEstado}"></i> ${estadoRaw.toUpperCase()}
                    </span>
                </div>
            </div>
            <div class="card-body p-3">
                <div class="lista-productos mb-3">${detalleHtml}</div>
                <div class="text-end border-top pt-2">
                    <div class="small text-muted mb-0" style="font-size: 0.7rem;">TOTAL NETO: </div>
                    <div class="fw-bold fs-4 text-primary">${totalCalculado.toLocaleString('es-CO', {style: 'currency', currency: 'COP', maximumFractionDigits: 0})}</div>
                </div>
                <div class="mt-3">
                    ${(!esEstadoFinal) ? `
                        <button class="btn btn-primary w-100 fw-bold rounded-pill py-2 btn-pagar-main">
                            <i class="bi bi-qr-code me-2"></i>Pagar Ahora
                        </button>
                    ` : `
                        <div class="p-2 border rounded-3 bg-light text-center ${esAnulada ? 'text-danger' : 'text-success'} small fw-bold">
                            <i class="bi ${esAnulada ? 'bi-x-octagon' : 'bi-shield-check'} me-1"></i> 
                            ${esAnulada ? 'PEDIDO ANULADO' : 'PAGO CONFIRMADO'}
                        </div>
                    `}
                </div>
            </div>
            <div class="card-footer bg-transparent border-top-0 p-3">
                <div class="d-flex gap-2">
                    <button class="btn btn-sm btn-dark flex-grow-1 btn-pdf-action">
                        <i class="bi bi-file-earmark-pdf"></i> PDF
                    </button>
                    ${(!esEstadoFinal) ?
                        `<button class="btn btn-sm btn-outline-danger flex-grow-1 btn-anular-action">Anular</button>` :
                        `<button class="btn btn-sm btn-link text-muted text-decoration-none flex-grow-1 btn-eliminar-action"><i class="bi bi-trash"></i> Quitar</button>`
                    }
                </div>
            </div>`;

        const btnPagar = card.querySelector('.btn-pagar-main');
        if (btnPagar) {
            btnPagar.onclick = () => abrirModalPago(f.numero_factura, totalCalculado.toLocaleString('es-CO', {style: 'currency', currency: 'COP', maximumFractionDigits: 0}));
        }

        card.querySelector('.btn-pdf-action').onclick = () => descargarPDF(f);
        
        const btnAnular = card.querySelector('.btn-anular-action');
        if (btnAnular) {
            btnAnular.onclick = () => anularFactura(f.numero_factura);
        }

        const btnEliminar = card.querySelector('.btn-eliminar-action');
        if (btnEliminar) {
            btnEliminar.onclick = () => {
                const actualesOcultas = JSON.parse(localStorage.getItem('facturas_ocultas') || "[]");
                actualesOcultas.push(f.numero_factura);
                localStorage.setItem('facturas_ocultas', JSON.stringify(actualesOcultas));
                monitorearCambiosFacturas();
                showMessage("Factura removida de la lista");
            };
        }

        container.appendChild(card);
    });
    paginar(filtradas.length);
}

async function anularFactura(numeroFactura) {
    showConfirmToast("¿Estás seguro de que deseas anular este pedido?", async () => {
        try {
            const res = await fetch(`/anular_factura_page/${numeroFactura}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" }
            });
            const data = await res.json();
            if (res.ok) {
                await monitorearCambiosFacturas();
                showMessage("Pedido anulado correctamente");
            } else {
                showMessage(data.message || "No se pudo anular", true);
            }
        } catch (error) {
            showMessage("Error de conexión", true);
        }
    });
}

function paginar(total) {
    const p = document.getElementById("paginacion");
    if (!p) return;
    p.innerHTML = "";
    const totalPag = Math.ceil(total / itemsPorPagina);
    if (totalPag <= 1) return;
    for (let i = 1; i <= totalPag; i++) {
        const li = document.createElement("li");
        li.className = `page-item ${i === paginaActual ? 'active' : ''}`;
        li.innerHTML = `<a class="page-link" href="#">${i}</a>`;
        li.onclick = (e) => { 
            e.preventDefault(); 
            paginaActual = i; 
            mostrarFacturasBuscadas(); 
        };
        p.appendChild(li);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    cargarMetodosPago();
    if (Notification.permission !== "granted" && Notification.permission !== "denied") {
        Notification.requestPermission();
    }

    const inputBuscar = document.getElementById("buscarFactura");
    if (inputBuscar) {
        inputBuscar.addEventListener("input", function() {
            if (this.value.trim().length >= 6) {
                paginaActual = 1;
                monitorearCambiosFacturas();
            } else {
                facturasActuales = [];
                mostrarFacturasBuscadas();
            }
        });
    }
    setInterval(monitorearCambiosFacturas, 5000);
});

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/static/js/workers/service-worker-facturas.js')
            .then(() => console.log("Worker activo"))
            .catch(err => console.error("Worker fallido", err));
    });
}