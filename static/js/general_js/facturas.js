let facturasActuales = [];
let estadosFacturasPrevios = {};
let paginaActual = 1;
const itemsPorPagina = 10;
let facturasLocalesCache = [];
let metodosPagoCache = [];
let ultimaSincronizacion = new Date();

const FormateadorCosto = new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0
});

function showConfirmToast(msg, callback) {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const t = document.createElement('div');
    t.className = 'custom-toast bg-dark text-white p-4 shadow-lg mb-3';
    t.style.cssText = `
        border-left: 5px solid #ffc107;
        min-width: 350px;
        border-radius: 12px;
        pointer-events: auto !important;
        opacity: 1;
        display: block;
        animation: slideInRight 0.4s ease-out;
    `;

    t.innerHTML = `
        <div class="mb-3 d-flex align-items-start">
            <i class="bi bi-exclamation-triangle-fill text-warning me-3 fs-4"></i>
            <div>
                <strong class="d-block mb-1">Confirmación Requerida</strong>
                <span class="small opacity-75">${msg}</span>
            </div>
        </div>
        <div class="d-flex gap-2 justify-content-end">
            <button class="btn btn-sm btn-outline-light border-0 px-3 btn-cancelar-confirm">Descartar</button>
            <button class="btn btn-sm btn-warning fw-bold px-4 rounded-pill btn-aceptar-confirm">Confirmar Acción</button>
        </div>
    `;

    container.appendChild(t);

    t.querySelector('.btn-cancelar-confirm').onclick = (e) => {
        e.stopPropagation();
        t.style.opacity = '0';
        t.style.transform = 'translateX(20px)';
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
        animation: fadeIn 0.3s ease;
    `;

    toast.innerHTML = `
        <div class="d-flex align-items-center justify-content-between">
            <div class="d-flex align-items-center">
                <i class="bi ${isError ? 'bi-x-circle-fill text-danger' : 'bi-check-circle-fill text-success'} me-3 fs-5"></i>
                <span class="small fw-medium">${msg}</span>
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

    setTimeout(remove, 4000);
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
    t.style.minWidth = "320px";
    t.style.transition = "all 0.4s ease";
    t.innerHTML = `
        <div class="d-flex align-items-center p-3">
            <div class="position-relative me-3">
                <i class="bi ${configuracion.icono} text-${configuracion.color} fs-3"></i>
                <span class="position-absolute top-0 start-100 translate-middle p-1 bg-${configuracion.color} border border-light rounded-circle"></span>
            </div>
            <div class="flex-grow-1">
                <strong style="font-size: 0.9rem;" class="d-block text-uppercase">${configuracion.titulo}</strong>
                <div class="d-flex align-items-center gap-1 mt-1">
                    <small class="text-white-50">Factura ${facturaFormateada}</small>
                    <span class="badge bg-${configuracion.color} text-dark ms-auto" style="font-size: 0.6rem;">${estado.toUpperCase()}</span>
                </div>
            </div>
            <i class="bi bi-x-lg ms-3 btn-close-toast" style="cursor:pointer; font-size: 0.7rem;"></i>
        </div>`;

    cont.appendChild(t);
    const remove = () => {
        t.style.opacity = '0';
        t.style.transform = 'translateY(-10px)';
        setTimeout(() => t.remove(), 400);
    };
    t.querySelector('.btn-close-toast').onclick = remove;
    setTimeout(remove, 8000);
}

async function monitorearCambiosFacturas() {
    const inputBuscar = document.getElementById("buscarFactura");
    const cedula = inputBuscar ? inputBuscar.value.trim() : "";
    if (!cedula || cedula.length < 6) return;

    try {
        const res = await fetch(`/buscar_facturas_page?cedula=${encodeURIComponent(cedula)}`);
        if (!res.ok) return;
        
        const facturasServidor = await res.json();
        let huboCambio = false;

        if (facturasLocalesCache.length > 0) {
            if (facturasServidor.length !== facturasLocalesCache.length) {
                huboCambio = true;
            } else {
                facturasServidor.forEach(fServ => {
                    const fLocal = facturasLocalesCache.find(l => l.numero_factura === fServ.numero_factura);
                    if (!fLocal) {
                        huboCambio = true;
                    } else if (fLocal.estado !== fServ.estado) {
                        lanzarNotificacionMultidispositivo(fServ, fServ.estado);
                        huboCambio = true;
                    } else if (JSON.stringify(fLocal) !== JSON.stringify(fServ)) {
                        huboCambio = true;
                    }
                });
            }
        } else {
            huboCambio = true;
        }

        facturasLocalesCache = JSON.parse(JSON.stringify(facturasServidor));
        facturasActuales = facturasServidor.sort((a, b) => new Date(b.fecha_emision || b.created_at) - new Date(a.fecha_emision || a.created_at));

        if (huboCambio) {
            mostrarFacturasBuscadas();
        }
        
        ultimaSincronizacion = new Date();
    } catch (e) {
        console.error(e);
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
        console.error(e);
    }
}

function abrirModalPago(facturaNum, total) {
    const modalElement = document.getElementById('modalPago');
    const modalBody = document.getElementById("modalPagoBody");
    if (!modalElement || !modalBody) return;

    if (!metodosPagoCache || metodosPagoCache.length === 0) {
        modalBody.innerHTML = `
            <div class="text-center py-5">
                <div class="mb-3">
                    <i class="bi bi-bank2 fs-1 text-muted opacity-25"></i>
                </div>
                <h5 class="text-secondary fw-bold">Canales de pago no disponibles</h5>
                <p class="small text-muted mx-auto" style="max-width: 250px;">Estamos actualizando nuestras cuentas.</p>
            </div>`;
    } else {
        modalBody.innerHTML = `
            <div class="text-center mb-4 bg-light p-3 rounded-4">
                <span class="badge bg-primary px-3 mb-2 rounded-pill">REFERENCIA DE PAGO</span>
                <h4 class="fw-bold text-dark mb-1 font-monospace">${facturaNum}</h4>
                <div class="fs-2 fw-bold text-primary mt-2">${total}</div>
            </div>
            <div class="row g-4 justify-content-center">
                ${metodosPagoCache.map(m => `
                    <div class="col-12 col-md-6">
                        <div class="card h-100 border-0 shadow-sm rounded-4 overflow-hidden card-metodo-pago">
                            <div class="card-header bg-dark text-white text-center py-3 border-0">
                                <span class="fw-bold small text-uppercase letter-spacing-1">${m.entidad}</span>
                            </div>
                            <div class="card-body p-4 text-center bg-white">
                                <div class="mb-3 position-relative d-inline-block">
                                    <img src="${m.qr_url || '/static/uploads/no-qr.png'}" 
                                         class="img-fluid rounded-4 border p-2 bg-white shadow-sm"
                                         style="max-height: 180px; width: 100%; object-fit: contain;"
                                         onerror="this.src='/static/uploads/no-qr.png'">
                                </div>
                                <div class="bg-light rounded-4 p-3 border border-dashed mt-2">
                                    <p class="text-muted small mb-1 text-uppercase fw-bold" style="font-size: 0.65rem;">${m.tipo_cuenta || 'Cuenta'}</p>
                                    <p class="mb-3 fw-bold text-dark border-bottom pb-2">${m.titular}</p>
                                    <div class="d-flex align-items-center justify-content-between bg-white p-2 rounded-3 border">
                                        <span class="fs-5 fw-bold text-primary font-monospace">${m.numero}</span>
                                        <button class="btn btn-primary btn-sm rounded-3 px-3 d-flex align-items-center gap-2"
                                                onclick="navigator.clipboard.writeText('${m.numero}').then(() => showMessage('Copiado al portapapeles'))">
                                            <i class="bi bi-copy"></i>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
            <div class="mt-4 p-3 bg-warning bg-opacity-10 border border-warning border-dashed rounded-4 text-center">
                <p class="small text-dark mb-0 fw-medium">
                    <i class="bi bi-info-circle-fill me-2 text-warning"></i>Envía el comprobante vía WhatsApp al 3115699825 o vía correo a d.antojitos1968@gmail.com tras realizar la transferencia.
                </p>
            </div>`;
    }
    const bsModal = bootstrap.Modal.getOrCreateInstance(modalElement);
    bsModal.show();
}

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
        doc.addImage(canvas.toDataURL('image/png'), 'PNG', 15, 12, 25, 25);
    } catch (e) {
        console.warn(e);
    }

    doc.setFontSize(24);
    doc.setTextColor(20, 20, 20);
    doc.text("D'Antojitos ©", 45, 25);
    
    doc.setFontSize(9);
    doc.setTextColor(80);
    doc.text(`Documento: ${f.numero_factura}`, 140, 20);
    doc.text(`Emisión: ${new Date(f.fecha_emision || Date.now()).toLocaleString()}`, 140, 25);
    doc.text(`Cédula: ${f.cedula || 'Registrada'}`, 140, 30);
    
    doc.setDrawColor(200);
    doc.line(15, 40, 195, 40);

    const esAnulada = ["anulada", "cancelado", "cancelada"].includes(f.estado.toLowerCase());
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(esAnulada ? 200 : 0, esAnulada ? 0 : 150, esAnulada ? 0 : 0);
    doc.text(`ESTADO ACTUAL: ${f.estado.toUpperCase()}`, 15, 48);
    
    const dataFilas = (f.productos || []).map(p => [
        p.nombre_producto,
        `${p.cantidad} unidad(es)`,
        FormateadorCosto.format(Number(p.precio_unitario || 0)),
        FormateadorCosto.format(Number(p.subtotal || 0))
    ]);

    doc.autoTable({
        startY: 55,
        head: [['Descripción', 'Cant.', 'Unitario', 'Subtotal']],
        body: dataFilas,
        theme: 'striped',
        headStyles: { fillColor: [40, 40, 40], textColor: [255, 255, 255], fontStyle: 'bold' },
        columnStyles: { 3: { halign: 'right', fontStyle: 'bold' } }
    });

    const finalY = doc.lastAutoTable.finalY;
    const totalVenta = (f.productos || []).reduce((acc, curr) => acc + Number(curr.subtotal), 0);
    
    doc.setFillColor(245, 245, 245);
    doc.rect(130, finalY + 5, 65, 15, 'F');
    doc.setFontSize(14);
    doc.setTextColor(0);
    doc.text(`TOTAL: ${FormateadorCosto.format(totalVenta)}`, 190, finalY + 15, { align: 'right' });
    
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text("Comprobante de operación digital.", 105, 285, { align: 'center' });

    doc.save(`Factura_${f.numero_factura}.pdf`);
}

function mostrarFacturasBuscadas() {
    const container = document.getElementById("facturasContainer");
    const filtroEstado = document.getElementById("filtroEstadoFactura");
    if (!container) return;
    
    const ocultas = JSON.parse(localStorage.getItem('facturas_ocultas') || "[]");
    let filtradas = facturasActuales.filter(f => !ocultas.includes(f.numero_factura));
    
    if (filtroEstado && filtroEstado.value !== "todos") {
        const valFiltro = filtroEstado.value.toLowerCase();
        filtradas = filtradas.filter(f => {
            const e = f.estado.toLowerCase();
            if (valFiltro === "emitida") return e.includes("emitid");
            if (valFiltro === "pagado") return ["pagada", "pagado", "finalizado", "entregado", "completada", "completado"].includes(e);
            if (valFiltro === "anulada") return ["anulada", "cancelado", "cancelada"].includes(e);
            return true;
        });
    }
    
    const totalItems = filtradas.length;
    const totalPaginas = Math.ceil(totalItems / itemsPorPagina);
    if (paginaActual > totalPaginas && totalPaginas > 0) paginaActual = totalPaginas;

    container.innerHTML = "";
    const inicio = (paginaActual - 1) * itemsPorPagina;
    const paginadas = filtradas.slice(inicio, inicio + itemsPorPagina);

    if (paginadas.length === 0) {
        container.innerHTML = `
            <div class="text-center p-5 bg-white rounded-5 shadow-sm border">
                <div class="display-1 text-muted opacity-10 mb-3"><i class="bi bi-folder2-open"></i></div>
                <h5 class="fw-bold text-dark">Sin registros</h5>
                <p class="text-muted small">No hay facturas con los criterios seleccionados.</p>
            </div>`;
        paginar(0);
        return;
    }

    paginadas.forEach(f => {
        const card = document.createElement("div");
        const estadoActual = (f.estado || "Emitida").toUpperCase();
        const estadoLower = estadoActual.toLowerCase();
        
        const esPagada = ["pagada", "pagado", "finalizado", "entregado", "completada", "completado"].includes(estadoLower);
        const esAnulada = ["anulada", "cancelado", "cancelada"].includes(estadoLower);
        const esEstadoFinal = esPagada || esAnulada;

        let totalSuma = 0;
        let itemsListHtml = (f.productos || []).map(p => {
            const valSub = Number(p.subtotal || 0);
            totalSuma += valSub;
            return `
                <div class="d-flex justify-content-between align-items-center border-bottom border-light py-2">
                    <div class="me-2">
                        <div class="fw-semibold text-dark small text-truncate" style="max-width: 180px;">${p.nombre_producto}</div>
                        <div class="text-muted" style="font-size: 0.7rem;">Cant: ${p.cantidad}</div>
                    </div>
                    <div class="fw-bold text-dark">${FormateadorCosto.format(valSub)}</div>
                </div>`;
        }).join('');

        let configVisual = { color: "primary", icono: "bi-hourglass-split" };
        if (esAnulada) configVisual = { color: "danger", icono: "bi-x-octagon-fill" };
        else if (esPagada) configVisual = { color: "success", icono: "bi-patch-check-fill" };
        else if (estadoLower.includes("emitid")) configVisual = { color: "info", icono: "bi-file-earmark-arrow-up" };
        else if (estadoLower === "enviado") configVisual = { color: "warning", icono: "bi-truck-flatbed" };

        card.className = `card border-0 shadow-sm rounded-4 mb-4 overflow-hidden ${esEstadoFinal ? 'opacity-90' : 'border-start border-4 border-' + configVisual.color}`;
        card.innerHTML = `
            <div class="card-header bg-white border-bottom-0 p-4">
                <div class="d-flex justify-content-between align-items-start">
                    <div class="d-flex align-items-center">
                        <div class="rounded-4 bg-dark text-white d-flex align-items-center justify-content-center me-3 shadow" style="width:50px; height:50px;">
                            <i class="bi bi-receipt-cutoff fs-4"></i>
                        </div>
                        <div>
                            <h5 class="fw-bold mb-0 text-dark font-monospace">${f.numero_factura}</h5>
                            <span class="badge bg-light text-primary border border-primary-subtle fw-bold mt-1">
                                TITULAR: ${f.cedula || 'REGISTRADO'}
                            </span>
                        </div>
                    </div>
                    <div class="text-end">
                        <span class="badge bg-${configVisual.color} bg-opacity-10 text-${configVisual.color} px-3 py-2 rounded-pill fw-bold border border-${configVisual.color}">
                            <i class="bi ${configVisual.icono} me-1"></i> ${estadoActual}
                        </span>
                        <div class="text-muted mt-2 small">
                            ${new Date(f.fecha_emision || f.created_at).toLocaleDateString()}
                        </div>
                    </div>
                </div>
            </div>
            <div class="card-body px-4 py-2">
                <div class="bg-light rounded-4 p-3 mb-3" style="max-height: 180px; overflow-y: auto;">
                    ${itemsListHtml}
                </div>
                <div class="d-flex justify-content-between align-items-end mb-2">
                    <div class="text-muted small fw-bold text-uppercase">Total</div>
                    <div class="text-primary fw-bolder fs-3">${FormateadorCosto.format(totalSuma)}</div>
                </div>
                ${(!esEstadoFinal) ? `
                    <button class="btn btn-primary w-100 fw-bold rounded-pill py-3 btn-pagar-card mt-2 d-flex align-items-center justify-content-center gap-2">
                        <i class="bi bi-qr-code-scan"></i> PROCEDER AL PAGO
                    </button>` : `
                    <div class="alert alert-${esAnulada ? 'secondary' : 'success'} border-0 rounded-pill py-2 px-4 text-center mt-2 small fw-bold">
                        <i class="bi ${esAnulada ? 'bi-slash-circle' : 'bi-shield-fill-check'}"></i>
                        ${esAnulada ? 'ANULADO' : 'COMPLETADO'}
                    </div>`}
            </div>
            <div class="card-footer bg-light border-0 p-3">
                <div class="row g-2">
                    <div class="col-6">
                        <button class="bi bi-file-earmark-pdf btn btn-sm btn-dark w-100 rounded-3 py-2 btn-descargar-pdf"><strong> Descargar Factura</strong></button>
                    </div>
                    <div class="col-6">
                        ${(!esEstadoFinal) ?
                            `<button class="btn btn-sm btn-danger w-100 rounded-3 py-2 btn-anular-factura d-flex align-items-center justify-content-center shadow-sm">
                                <i class="bi bi-x-circle-fill me-2"></i>
                                <strong>ANULAR PEDIDO</strong>
                            </button>` :
                            `<button class="btn btn-sm btn-secondary w-100 rounded-3 py-2 btn-quitar-vista d-flex align-items-center justify-content-center shadow-sm">
                                <i class="bi bi-archive-fill me-2"></i>
                                <strong>ARCHIVAR FACTURA</strong>
                            </button>`
                        }
                    </div>
                </div>
            </div>`;

        const btnP = card.querySelector('.btn-pagar-card');
        if (btnP) btnP.onclick = () => abrirModalPago(f.numero_factura, FormateadorCosto.format(totalSuma));
        card.querySelector('.btn-descargar-pdf').onclick = () => descargarPDF(f);
        const btnA = card.querySelector('.btn-anular-factura');
        if (btnA) btnA.onclick = () => procesarAnulacion(f.numero_factura);
        const btnQ = card.querySelector('.btn-quitar-vista');
        if (btnQ) {
            btnQ.onclick = () => {
                const ocu = JSON.parse(localStorage.getItem('facturas_ocultas') || "[]");
                ocu.push(f.numero_factura);
                localStorage.setItem('facturas_ocultas', JSON.stringify(ocu));
                mostrarFacturasBuscadas();
            };
        }
        container.appendChild(card);
    });
    paginar(filtradas.length);
}

async function procesarAnulacion(numFactura) {
    showConfirmToast("¿Deseas anular este registro?", async () => {
        try {
            const res = await fetch(`/anular_factura_page/${numFactura}`, { method: "PUT" });
            if (res.ok) {
                await monitorearCambiosFacturas();
                showMessage("Anulado exitosamente");
            }
        } catch (e) {
            showMessage("Error de conexión", true);
        }
    });
}

function paginar(totalItems) {
    const nav = document.getElementById("paginacion");
    if (!nav) return;
    nav.innerHTML = "";
    const maxPaginas = Math.ceil(totalItems / itemsPorPagina);
    if (maxPaginas <= 1) return;
    const frag = document.createDocumentFragment();
    for (let i = 1; i <= maxPaginas; i++) {
        const item = document.createElement("li");
        item.className = `page-item ${i === paginaActual ? 'active' : ''} mx-1`;
        item.innerHTML = `<a class="page-link rounded-circle border-0 shadow-sm fw-bold" href="#">${i}</a>`;
        item.onclick = (e) => { 
            e.preventDefault(); 
            paginaActual = i; 
            window.scrollTo({ top: 0, behavior: 'smooth' });
            mostrarFacturasBuscadas(); 
        };
        frag.appendChild(item);
    }
    nav.appendChild(frag);
}

document.addEventListener('DOMContentLoaded', () => {
    cargarMetodosPago();
    if ("Notification" in window && Notification.permission !== "granted") {
        Notification.requestPermission();
    }
    const inputInput = document.getElementById("buscarFactura");
    const selectFiltro = document.getElementById("filtroEstadoFactura");
    if (inputInput) {
        let timerBusqueda;
        inputInput.addEventListener("input", function() {
            clearTimeout(timerBusqueda);
            const val = this.value.trim();
            if (val.length >= 6) {
                timerBusqueda = setTimeout(() => {
                    paginaActual = 1;
                    monitorearCambiosFacturas();
                }, 500);
            } else {
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
        if (facturasActuales.length > 0) monitorearCambiosFacturas();
    }, 12000);
});