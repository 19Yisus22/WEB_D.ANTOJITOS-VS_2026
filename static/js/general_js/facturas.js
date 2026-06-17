let facturasActuales = [];
let paginaActual = 1;
const itemsPorPagina = 5;
let facturasLocalesCache = [];
let metodosPagoCache = [];
let ultimaSincronizacion = new Date();
let mostrarArchivadas = false;
let ordenAscendente = false;
const expandedFacturas = new Set();

const _filtroNumFac = { anio: '', numero: '' };

function _extraerAnioFactura(numFac) {
    const partes = (numFac || '').split('-');
    const segAnio = partes[1] || '';
    return segAnio.slice(0, 4);
}

function _extraerNumFactura(numFac) {
    const partes = (numFac || '').split('-');
    return partes[partes.length - 1] || '';
}

function _poblarAniosSelect() {
    const sel = document.getElementById('filtroAnioFactura');
    if (!sel) return;
    const valorActual = sel.value;
    const actual = new Date().getFullYear();
    const años = new Set();
    for (let y = actual; y >= actual - 5; y--) años.add(String(y));
    facturasActuales.forEach(f => {
        const a = _extraerAnioFactura(f.numero_factura);
        if (/^\d{4}$/.test(a)) años.add(a);
    });
    sel.innerHTML = '<option value="">Todos los años</option>';
    [...años].sort((a, b) => Number(b) - Number(a)).forEach(a => {
        const op = document.createElement('option');
        op.value = a;
        op.textContent = a;
        if (a === valorActual) op.selected = true;
        sel.appendChild(op);
    });
}

async function _aplicarFiltroNum() {
    const panel = document.getElementById('filtroFacturaNumPanel');
    const activo = _filtroNumFac.anio || _filtroNumFac.numero;
    if (panel) panel.classList.toggle('fnf-active', !!activo);
    paginaActual = 1;
    if (activo) {
        const params = new URLSearchParams();
        if (_filtroNumFac.anio)   params.set('anio',   _filtroNumFac.anio);
        if (_filtroNumFac.numero) params.set('numero', _filtroNumFac.numero);
        try {
            const res = await fetch(`/buscar_facturas_por_numero_page?${params}`);
            if (res.ok) {
                const data = await res.json();
                if (Array.isArray(data)) {
                    facturasActuales = ordenarFacturas(data);
                    _poblarAniosSelect();
                }
            }
        } catch (e) { console.error(e); }
        mostrarFacturasBuscadas();
    } else {
        const _rol = (window.FACTURA_ROLE || 'cliente').toLowerCase();
        if (_rol === 'vendedor' || _rol === 'admin') {
            await cargarTodasFacturasPage();
        } else {
            await cargarFacturasCliente();
        }
    }
}

async function _limpiarFiltroNum() {
    _filtroNumFac.anio = '';
    _filtroNumFac.numero = '';
    const selAnio = document.getElementById('filtroAnioFactura');
    const inputNum = document.getElementById('filtroNumeroFactura');
    if (selAnio) selAnio.value = '';
    if (inputNum) inputNum.value = '';
    await _aplicarFiltroNum();
}

const FormateadorCosto = new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0
});

async function toggleArchivarFactura(numeroFactura) {
    try {
        const res  = await fetch(`/archivar_factura_page/${numeroFactura}`, { method: 'PUT' });
        if (!res.ok) throw new Error();
        const data = await res.json();
        const f = facturasActuales.find(x => x.numero_factura === numeroFactura);
        if (f) f.archivada = data.archivada;
        mostrarFacturasBuscadas();
    } catch {
        showMessage(t('notif.error_conn'), true);
    }
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
        if (a.archivada !== b.archivada) return a.archivada ? 1 : -1;
        if (esFacturaEmitida(a) !== esFacturaEmitida(b)) return esFacturaEmitida(a) ? -1 : 1;
        if (esFacturaFinalizada(a) !== esFacturaFinalizada(b)) return esFacturaFinalizada(a) ? 1 : -1;
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
            icon: "/static/uploads/logo.ico"
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
        'Nequi':       {
            color: '#9c27b0', bg: '#f3e5f5', icon: 'bi-phone-fill',
            initials: 'N',
            gradient: 'linear-gradient(135deg,#9c27b0 0%,#e91e8c 100%)',
            textColor: '#fff'
        },
        'Daviplata':   {
            color: '#e53935', bg: '#ffebee', icon: 'bi-credit-card-2-front-fill',
            initials: 'DA',
            gradient: '#e53935',
            textColor: '#fff'
        },
        'Bancolombia': {
            color: '#1a1a1a', bg: '#fff8e1', icon: 'bi-bank2',
            initials: 'BC',
            gradient: 'linear-gradient(135deg,#1a1a1a 0%,#2d2d2d 100%)',
            textColor: '#f9a825'
        },
        'NuBank':      {
            color: '#6200ea', bg: '#ede7f6', icon: 'bi-wallet2',
            initials: 'Nu',
            gradient: '#6200ea',
            textColor: '#fff'
        },
        'Efecty':      {
            color: '#ff6f00', bg: '#fff3e0', icon: 'bi-currency-dollar',
            initials: 'EF',
            gradient: '#ff6f00',
            textColor: '#fff'
        },
        'Movii':       {
            color: '#0d47a1', bg: '#e3f2fd', icon: 'bi-phone',
            initials: 'MV',
            gradient: '#0d47a1',
            textColor: '#fff'
        },
        'PSE':         {
            color: '#1565c0', bg: '#e8f5e9', icon: 'bi-building',
            initials: 'PSE',
            gradient: '#1565c0',
            textColor: '#fff'
        },
    };
    return MAP[entidad] || {
        color: '#d35400', bg: '#fff5e1', icon: 'bi-wallet-fill',
        initials: entidad ? entidad.slice(0,2).toUpperCase() : '?',
        gradient: '#d35400',
        textColor: '#fff'
    };
}

const _BANCO_LOGOS = {
    'Nequi':       '/static/uploads/nequi.logo.png',
    'Daviplata':   '/static/uploads/daviplata.logo.png',
    'Bancolombia': '/static/uploads/bancolombia.logo.png',
    'NuBank':      '/static/uploads/nu.logo.png',
};

function _getBancoLogoTag(entidad, size) {
    const src = _BANCO_LOGOS[entidad];
    if (!src) return '';
    return `<img src="${src}" alt="${entidad}" style="width:${size}px;height:${size}px;object-fit:contain;" onerror="this.style.display='none'">`;
}

function abrirModalPago(facturaNum, total) {
    const modalElement = document.getElementById('modalPago');
    const modalBody    = document.getElementById("modalPagoBody");
    if (!modalElement || !modalBody) return;

    if (!metodosPagoCache || metodosPagoCache.length === 0) {
        modalBody.innerHTML = `
            <div class="text-center py-5">
                <i class="bi bi-bank2 display-4 text-muted opacity-25 d-block mb-3"></i>
                <h6 class="text-muted fw-bold">${t('pay.unavailable')}</h6>
                <p class="small text-muted">${t('pay.updating')}</p>
            </div>`;
    } else {
        const first = metodosPagoCache[0];
        const firstCfg = _getBankConfig(first.entidad);

        modalBody.innerHTML = `
            <div class="payment-modal-header">
                <div class="payment-secure-badge">
                    <i class="bi bi-shield-fill-check me-1"></i>${t('pay.secure')}
                </div>
                <div class="payment-ref-box">
                    <div class="payment-ref-label">${t('pay.ref')}</div>
                    <div class="payment-ref-num font-monospace">${facturaNum}</div>
                    <div class="payment-ref-total">${total}</div>
                </div>
            </div>

            <div class="payment-qr-area">
                <div class="payment-qr-box" id="paymentQrBox">
                    ${first.qr_url
                        ? `<img src="${first.qr_url}" alt="QR ${first.entidad}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';">
                           <div class="payment-qr-ph" style="display:none;"><i class="bi bi-qr-code-scan"></i></div>`
                        : `<div class="payment-qr-ph"><i class="bi bi-qr-code-scan"></i></div>`}
                </div>
            </div>

            <div class="payment-bank-subtitle" id="paymentBankSubtitle">
                ${t('pay.with')} <strong>${first.entidad}</strong>
            </div>

            ${metodosPagoCache.length > 1 ? `
            <div class="payment-bank-pager" id="paymentBankPager">
                ${metodosPagoCache.map((m, i) => {
                    const cfg    = _getBankConfig(m.entidad);
                    const logoSrc = _BANCO_LOGOS[m.entidad];
                    return `
                    <button class="payment-pager-btn ${i === 0 ? 'active' : ''}"
                            onclick="_selectBanco(${i})" id="ptab-${i}" title="${m.entidad}">
                        <div class="payment-pager-initials"
                             style="background:${cfg.gradient};color:${cfg.textColor};border-color:${i === 0 ? cfg.color : 'rgba(0,0,0,0.08)'};">
                            ${logoSrc
                                ? `<img src="${logoSrc}" alt="${m.entidad}" style="width:100%;height:100%;object-fit:contain;padding:5px;" onerror="this.style.display='none'">`
                                : cfg.initials}
                        </div>
                        <span>${m.entidad}</span>
                    </button>`;
                }).join('')}
            </div>` : ''}

            <div id="paymentAccountPanels">
                ${metodosPagoCache.map((m, i) => {
                const _cfg = _getBankConfig(m.entidad);
                const _logo = _BANCO_LOGOS[m.entidad];
                return `
                    <div class="payment-account-panel ${i === 0 ? 'active' : ''}" id="bpanel-${i}">
                        <div class="payment-account-info">
                            <div class="payment-account-row">
                                <div class="d-flex align-items-center gap-2">
                                    ${_logo
                                        ? `<img src="${_logo}" alt="${m.entidad}" style="height:20px;width:auto;object-fit:contain;" onerror="this.style.display='none'">`
                                        : `<span class="payment-bank-initials-sm" style="background:${_cfg.gradient};color:${_cfg.textColor};">${_cfg.initials}</span>`}
                                    <span class="payment-account-label">${tDB(m.tipo_cuenta) || t('bill.account')}</span>
                                </div>
                                <span class="payment-account-val">${m.titular}</span>
                            </div>
                            <div class="payment-number-row">
                                <span class="payment-number font-monospace">${m.numero}</span>
                                <button class="payment-copy-btn"
                                        onclick="navigator.clipboard.writeText('${m.numero}').then(()=>showMessage(t('notif.copied')))">
                                    <i class="bi bi-copy me-1"></i>${t('btn.copy')}
                                </button>
                            </div>
                            ${m.clave_pago ? `
                            <div class="payment-clave-row">
                                <img src="/static/uploads/.png" alt="BRE-B"
                                     class="payment-clave-icon"
                                     style="height:18px;width:auto;object-fit:contain;flex-shrink:0;border-radius:3px;"
                                     onerror="this.parentElement.querySelector('.payment-clave-fallback').style.display='inline-flex';this.style.display='none'">
                                <span class="payment-clave-fallback" style="display:none;align-items:center;justify-content:center;width:18px;height:18px;background:#2d9e5f;border-radius:3px;font-size:0.6rem;font-weight:900;color:#fff;flex-shrink:0;">B</span>
                                <span class="payment-clave-label">BRE-B</span>
                                <span class="payment-number font-monospace">${m.clave_pago}</span>
                                <button class="payment-copy-btn"
                                        onclick="navigator.clipboard.writeText('${m.clave_pago}').then(()=>showMessage(t('notif.copied')))">
                                    <i class="bi bi-copy me-1"></i>${t('btn.copy')}
                                </button>
                            </div>` : ''}
                        </div>
                    </div>`;
            }).join('')}
            </div>

            <div class="payment-notice">
                <i class="bi bi-info-circle-fill me-2"></i>
                ${t('pay.send_receipt')}
                <a href="https://wa.me/573115699825" target="_blank">WhatsApp</a>
                ${t('pay.send_or') || 'o'}
                <a href="mailto:terugag@hotmail.com">${t('state.email') || 'correo'}</a>
                ${t('pay.after')}.
            </div>`;
    }

    bootstrap.Modal.getOrCreateInstance(modalElement).show();
}

window._selectBanco = function(idx) {
    const m = metodosPagoCache[idx];
    if (!m) return;
    const cfg = _getBankConfig(m.entidad);

    const qrBox = document.getElementById('paymentQrBox');
    if (qrBox) {
        qrBox.style.opacity = '0';
        qrBox.style.transition = 'opacity 0.18s';
        setTimeout(() => {
            qrBox.innerHTML = m.qr_url
                ? `<img src="${m.qr_url}" alt="QR ${m.entidad}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';">
                   <div class="payment-qr-ph" style="display:none;"><i class="bi bi-qr-code-scan"></i></div>`
                : `<div class="payment-qr-ph"><i class="bi bi-qr-code-scan"></i></div>`;
            qrBox.style.opacity = '1';
        }, 180);
    }

    const subtitle = document.getElementById('paymentBankSubtitle');
    if (subtitle) subtitle.innerHTML = `${t('pay.with')} <strong>${m.entidad}</strong>`;

    document.querySelectorAll('.payment-pager-btn').forEach((t, i) => {
        t.classList.toggle('active', i === idx);
        const initEl = t.querySelector('.payment-pager-initials');
        if (initEl) {
            const c = _getBankConfig(metodosPagoCache[i].entidad);
            initEl.style.borderColor = i === idx ? c.color : 'rgba(0,0,0,0.08)';
            initEl.style.boxShadow   = i === idx ? `0 4px 14px ${c.color}55` : 'none';
        }
    });

    document.querySelectorAll('.payment-account-panel').forEach((p, i) => p.classList.toggle('active', i === idx));
};

async function descargarPDF(f) {

    const { jsPDF } = window.jspdf || window.jsPDF;

    if (!jsPDF) {
        showMessage("Librería PDF no detectada", true);
        return;
    }

    const doc = new jsPDF();

    const logoUrl = '/static/uploads/logo.ico';

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

    const _pdfSub  = Number(f.subtotal || 0) || (f.productos || []).reduce((a, c) => a + Number(c.subtotal || 0), 0);
    const _pdfTot  = Number(f.total || 0) || _pdfSub;
    const _pdfDisc = (_pdfSub > 0 && _pdfTot > 0 && (_pdfSub - _pdfTot) >= 1) ? (_pdfSub - _pdfTot) : 0;
    const _pdfPct  = _pdfDisc > 0 ? Math.round((_pdfDisc / _pdfSub) * 100) : 0;

    let pdfY = finalY + 8;

    if (_pdfDisc > 0) {
        doc.setFillColor(252, 245, 235);
        doc.rect(120, pdfY - 3, 75, 30, 'F');

        doc.setFontSize(9);
        doc.setTextColor(120);
        doc.text(`SUBTOTAL:`, 125, pdfY + 3);
        doc.setFont(undefined, 'normal');
        doc.text(FormateadorCosto.format(_pdfSub), 190, pdfY + 3, { align: 'right' });

        pdfY += 8;
        doc.setTextColor(200, 80, 0);
        doc.setFont(undefined, 'bold');
        doc.text(`DESC. CUMPLEAÑOS (${_pdfPct}%):`, 125, pdfY + 3);
        doc.setFont(undefined, 'normal');
        doc.text(`-${FormateadorCosto.format(_pdfDisc)}`, 190, pdfY + 3, { align: 'right' });

        pdfY += 8;
        doc.setFillColor(235, 250, 235);
        doc.rect(120, pdfY - 3, 75, 12, 'F');
        doc.setFontSize(13);
        doc.setTextColor(20, 150, 20);
        doc.setFont(undefined, 'bold');
        doc.text(`TOTAL: ${FormateadorCosto.format(_pdfTot)}`, 190, pdfY + 6, { align: 'right' });
    } else {
        doc.setFillColor(245, 245, 245);
        doc.rect(130, pdfY, 65, 15, 'F');
        doc.setFontSize(14);
        doc.setTextColor(0);
        doc.setFont(undefined, 'bold');
        doc.text(`TOTAL: ${FormateadorCosto.format(_pdfTot)}`, 190, pdfY + 10, { align: 'right' });
    }

    doc.setFont(undefined, 'normal');

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

                const _role = (window.FACTURA_ROLE || 'cliente').toLowerCase();
                if (_role === 'vendedor' || _role === 'admin') {
                    await cargarTodasFacturasPage();
                } else {
                    await cargarFacturasCliente();
                }

                showMessage("Pedido cancelado exitosamente");
            }

        } catch (e) {

            showMessage("Error de conexión", true);
        }
    });
}

let _monitorFacturaLock = false;
const _facturaEstadosNotif = new Map();

async function monitorearCambiosFacturas() {
    if (_monitorFacturaLock) return;
    _monitorFacturaLock = true;

    const inputBuscar = document.getElementById("buscarFactura");

    const criterio = inputBuscar
        ? inputBuscar.value.trim()
        : "";

    if (!criterio) { _monitorFacturaLock = false; return; }

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

                    const key = `${fServ.numero_factura}__${fServ.estado}`;
                    if (!_facturaEstadosNotif.has(key)) {
                        _facturaEstadosNotif.set(key, true);
                        lanzarNotificacionMultidispositivo(fServ, fServ.estado);
                    }
                }
            });
        }

        facturasLocalesCache = JSON.parse(JSON.stringify(facturasServidor));

        const term = criterio.toLowerCase().replace(/^@/, '');

        const filtradas = facturasServidor.filter(f =>
            f.numero_factura.toLowerCase().includes(term) ||
            (f.cedula          && f.cedula.toString().toLowerCase().includes(term)) ||
            (f.cliente_nombre  && f.cliente_nombre.toLowerCase().includes(term))   ||
            (f.username_cliente && f.username_cliente.toLowerCase().includes(term))
        );

        facturasActuales = ordenarFacturas(filtradas);

        mostrarFacturasBuscadas();

        ultimaSincronizacion = new Date();

    } catch (e) {
        console.error(e);
    } finally {
        _monitorFacturaLock = false;
    }
}

function _configVisual(estadoLower, todosPagados) {
    if (['anulada','cancelado','cancelada'].includes(estadoLower))
        return { color: 'danger',  icono: 'bi-x-octagon-fill',       label: (t('state.Anulada') || 'ANULADA').toUpperCase() };
    if (['pagada','pagado','finalizado','entregado','completada','completado'].includes(estadoLower) && todosPagados)
        return { color: 'success', icono: 'bi-patch-check-fill',      label: (t('state.Pagada')  || 'PAGADA').toUpperCase() };
    if (estadoLower.includes('emitid'))
        return { color: 'info',    icono: 'bi-file-earmark-arrow-up', label: (t('state.Emitida') || 'EMITIDA').toUpperCase() };
    if (estadoLower === 'enviado')
        return { color: 'warning', icono: 'bi-truck-flatbed',         label: (t('state.Enviado') || 'ENVIADO').toUpperCase() };
    if (['pagada','pagado','finalizado','entregado','completada','completado'].includes(estadoLower))
        return { color: 'warning', icono: 'bi-hourglass-split',       label: (t('state.Emitida') || 'EN PROCESO').toUpperCase() };
    return { color: 'primary', icono: 'bi-hourglass-split', label: estadoLower.toUpperCase() };
}

function mostrarFacturasBuscadas() {

    const container = document.getElementById("facturasContainer");

    const filtroEstado = document.getElementById("filtroEstadoFactura");

    if (!container) return;

    let filtradas = [...facturasActuales];

    if (_filtroNumFac.anio || _filtroNumFac.numero) {
        filtradas = filtradas.filter(f => {
            const num = (f.numero_factura || '');
            if (_filtroNumFac.anio) {
                const anioFac = _extraerAnioFactura(num);
                if (anioFac !== _filtroNumFac.anio) return false;
            }
            if (_filtroNumFac.numero) {
                const segNum = _extraerNumFactura(num);
                if (parseInt(segNum, 10) !== parseInt(_filtroNumFac.numero, 10)) return false;
            }
            return true;
        });
    }

    if (mostrarArchivadas) {
        filtradas = filtradas.filter(f => f.archivada);
    } else {
        filtradas = filtradas.filter(f => esFacturaEmitida(f) || !f.archivada);
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
                ].includes(e) && f.todos_pagados === true;
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

    filtradas = [...filtradas].sort((a, b) => {
        const dA = new Date(a.fecha_emision || a.created_at);
        const dB = new Date(b.fecha_emision || b.created_at);
        return ordenAscendente ? dA - dB : dB - dA;
    });

    const totalItems = filtradas.length;

    if (paginaActual > Math.ceil(totalItems / itemsPorPagina) && Math.ceil(totalItems / itemsPorPagina) > 0)
        paginaActual = Math.ceil(totalItems / itemsPorPagina);

    container.innerHTML = "";

    const emptyEl = document.getElementById('facturasEmpty');
    if (filtradas.length === 0) {
        if (emptyEl) {
            emptyEl.style.display = 'block';
            const sub = emptyEl.querySelector('.facturas-empty-sub');
            if (sub) sub.textContent = mostrarArchivadas ? t('inv.no_archived') : t('inv.no_results_q');
        }
        paginar(0);
        return;
    }
    if (emptyEl) emptyEl.style.display = 'none';

    const inicio   = (paginaActual - 1) * itemsPorPagina;
    const paginadas = filtradas.slice(inicio, inicio + itemsPorPagina);

    const lista = document.createElement('div');
    lista.className = 'invoice-list';

    paginadas.forEach((f, idx) => {
        const globalIdx = inicio + idx;
        const estadoLower = (f.estado || 'emitida').toLowerCase();
        const cv          = _configVisual(estadoLower, f.todos_pagados === true);
        const esFinal     = ['danger','success'].includes(cv.color);
        const fecha       = new Date(f.fecha_emision || f.created_at);
        const fechaStr    = fecha.toLocaleDateString('es-CO', { day:'2-digit', month:'short', year:'numeric' });

        let totalSuma = 0;
        const productosHtml = (f.productos || []).map(p => {
            totalSuma += Number(p.subtotal || 0);
            return `<div class="inv-product-row">
                        <div class="inv-product-info">
                            <span class="inv-product-name">${p.nombre_producto}</span>
                            <span class="inv-product-qty">${t('cart.qty')} ${p.cantidad}</span>
                        </div>
                        <span class="inv-product-price">${FormateadorCosto.format(Number(p.subtotal || 0))}</span>
                    </div>`;
        }).join('');

        const item = document.createElement('div');
        item.className = `inv-item inv-${cv.color}`;
        item.id = `inv-item-${globalIdx}`;
        item.dataset.facturaNum = f.numero_factura;

        const clienteNombre  = f.cliente_nombre  || '—';
        const clienteCedula  = f.cedula         || '—';
        const clienteCorreo  = f.correo         || '—';
        const clienteTel     = f.telefono       || '—';
        const clienteDir     = f.direccion      || '—';
        const clienteMetodo  = f.metodo_pago    || '—';
        const clienteUser    = f.username_cliente ? `@${f.username_cliente}` : '';

        item.innerHTML = `
            <!-- ── Cabecera recibo: logo + marca | número + fecha + badge ── -->
            <div class="inv-header" onclick="toggleInvItem(${globalIdx})">
                <div class="inv-brand-side">
                    <div class="inv-brand-logo">
                        <img src="/static/uploads/logo.ico" alt="Logo D'Antojitos"
                             onerror="this.src='/static/uploads/logo.ico'">
                    </div>
                    <span class="inv-brand-name">D'Antojitos©</span>
                </div>
                <div class="inv-meta-side">
                    <span class="inv-num">${f.numero_factura}</span>
                    <span class="inv-date">${fechaStr}</span>
                    <span class="inv-badge badge-${cv.color}">
                        <i class="bi ${cv.icono} me-1"></i>${cv.label}
                    </span>
                </div>
                <i class="bi bi-chevron-down inv-chevron"></i>
            </div>
            <div class="inv-products-box">${productosHtml}</div>
            ${(() => {
                const _sub  = Number(f.subtotal || 0);
                const _tot  = Number(f.total    || 0);
                const _hasDisc = _sub > 0 && _tot > 0 && (_sub - _tot) >= 1;
                if (_hasDisc) {
                    const _descMonto = _sub - _tot;
                    const _descPct   = Math.round((_descMonto / _sub) * 100);
                    return `<div class="inv-total-row inv-total-birthday">
                        <span class="inv-total-label">${t('ord.total').toUpperCase()}</span>
                        <div class="inv-birthday-prices">
                            <span class="inv-original-price">${FormateadorCosto.format(_sub)}</span>
                            <span class="inv-birthday-badge"><i class="bi bi-cake2-fill me-1"></i>${_descPct}% desc. cumpleaños · -${FormateadorCosto.format(_descMonto)}</span>
                            <span class="inv-total-amount inv-total-discount">${FormateadorCosto.format(_tot)}</span>
                        </div>
                    </div>`;
                }
                return `<div class="inv-total-row">
                    <span class="inv-total-label">${t('ord.total').toUpperCase()}</span>
                    <span class="inv-total-amount">${FormateadorCosto.format(totalSuma)}</span>
                </div>`;
            })()}

            <div class="inv-body" id="inv-body-${globalIdx}">

                <div class="inv-client-section">
                    <div class="inv-client-title">
                        <i class="bi bi-person-vcard-fill me-1"></i>${t('ord.client_data')}
                    </div>
                    <div class="inv-client-grid">
                        <div class="inv-client-item">
                            <span class="inv-client-label"><i class="bi bi-person-fill"></i> ${t('prof.name')}</span>
                            <span class="inv-client-val">${clienteNombre}${clienteUser ? ` <span class="inv-client-user">${clienteUser}</span>` : ''}</span>
                        </div>
                        <div class="inv-client-item">
                            <span class="inv-client-label"><i class="bi bi-card-text"></i> ${t('prof.cedula')}</span>
                            <span class="inv-client-val font-monospace">${clienteCedula}</span>
                        </div>
                        <div class="inv-client-item">
                            <span class="inv-client-label"><i class="bi bi-telephone-fill"></i> ${t('prof.phone')}</span>
                            <span class="inv-client-val">${clienteTel}</span>
                        </div>
                        <div class="inv-client-item">
                            <span class="inv-client-label"><i class="bi bi-envelope-fill"></i> ${t('prof.email')}</span>
                            <span class="inv-client-val">${clienteCorreo}</span>
                        </div>
                        <div class="inv-client-item">
                            <span class="inv-client-label"><i class="bi bi-wallet2"></i> ${t('ord.payment')}</span>
                            <span class="inv-client-val">${tDB(clienteMetodo)}</span>
                        </div>
                        <div class="inv-client-item inv-client-full">
                            <span class="inv-client-label"><i class="bi bi-geo-alt-fill"></i> ${t('prof.address')}</span>
                            <span class="inv-client-val">${clienteDir}</span>
                        </div>
                    </div>
                </div>

                ${(() => {
                    const role = (window.FACTURA_ROLE || 'cliente').toLowerCase();
                    const esVendedor = role === 'vendedor';
                    const esAdmin    = role === 'admin';
                    const esCliente  = !esVendedor && !esAdmin;
                    const btnPagar = (!esFinal && !esVendedor)
                        ? `<button class="btn btn-primary w-100 rounded-pill py-2 fw-bold inv-btn-pagar">
                               <i class="bi bi-qr-code-scan me-2"></i>${t('inv.proceed')}
                           </button>`
                        : esFinal
                            ? `<div class="inv-final-estado inv-final-${cv.color === 'danger' ? 'anulada' : 'completada'}">
                                   <i class="bi ${cv.icono}"></i>
                                   <span>${cv.color === 'danger' ? t('inv.voided') : t('inv.completed')}</span>
                               </div>`
                            : '';

                    const btnAnularArchivo = esVendedor
                        ? (!esFinal
                            ? `<button class="btn btn-sm btn-outline-danger inv-btn-anular flex-fill"
                                       disabled title="El vendedor no puede anular desde aquí. Usa el módulo de Pedidos."
                                       style="opacity:0.45;cursor:not-allowed;">
                                   <i class="bi bi-x-circle me-1"></i>${t('inv.annul_btn')}
                               </button>`
                            : '')
                        : (!esFinal
                            ? `<button class="btn btn-sm btn-outline-danger inv-btn-anular flex-fill">
                                   <i class="bi bi-x-circle me-1"></i>${t('inv.annul_btn')}
                               </button>`
                            : `<button class="btn btn-sm btn-outline-secondary inv-btn-archivar flex-fill">
                                   <i class="bi bi-archive me-1"></i>${t('inv.archive')}
                               </button>`);

                    return `${btnPagar}
                    <div class="inv-actions mt-2">
                        <button class="btn btn-sm inv-btn-pdf flex-fill">
                            <i class="bi bi-file-earmark-pdf-fill me-1"></i>PDF
                        </button>
                        ${btnAnularArchivo}
                    </div>`;
                })()}
            </div>`;

        const bp = item.querySelector('.inv-btn-pagar');
        if (bp) bp.onclick = () => abrirModalPago(f.numero_factura, FormateadorCosto.format(totalSuma));

        const ba = item.querySelector('.inv-btn-anular');
        if (ba) ba.onclick = () => procesarAnulacion(f.numero_factura);

        const bq = item.querySelector('.inv-btn-archivar');
        if (bq) bq.onclick = () => toggleArchivarFactura(f.numero_factura);

        item.querySelector('.inv-btn-pdf').onclick = () => descargarPDF(f);

        lista.appendChild(item);
    });

    container.appendChild(lista);

    paginadas.forEach((f, idx) => {
        if (expandedFacturas.has(f.numero_factura)) {
            const gIdx    = inicio + idx;
            const body    = document.getElementById(`inv-body-${gIdx}`);
            const invItem = document.getElementById(`inv-item-${gIdx}`);
            const chevron = invItem?.querySelector('.inv-chevron');
            if (body)    body.classList.add('open');
            if (chevron) chevron.style.transform = 'rotate(180deg)';
            if (invItem) invItem.classList.add('expanded');
        }
    });

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
    const facturaNum = item?.dataset.facturaNum;
    if (facturaNum) {
        if (open) expandedFacturas.add(facturaNum);
        else      expandedFacturas.delete(facturaNum);
    }
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

async function cargarTodasFacturasPage(isBackground = false) {
    try {
        const res = await fetch('/todas_facturas_page');
        if (res.status === 401) { window.location.reload(); return; }
        if (!res.ok) return;
        const data = await res.json();
        if (!Array.isArray(data)) return;
        facturasLocalesCache = JSON.parse(JSON.stringify(data));
        facturasActuales     = ordenarFacturas(data);
        if (!isBackground) paginaActual = 1;
        _poblarAniosSelect();
        mostrarFacturasBuscadas();
    } catch (e) { console.error(e); }
}

async function cargarFacturasCliente(isBackground = false) {
    try {
        const res = await fetch('/obtener_facturas_page');
        if (res.status === 401) { window.location.reload(); return; }
        if (!res.ok) return;
        const data = await res.json();
        if (!Array.isArray(data)) return;
        facturasLocalesCache = JSON.parse(JSON.stringify(data));
        facturasActuales     = ordenarFacturas(data);
        if (!isBackground) paginaActual = 1;
        _poblarAniosSelect();
        mostrarFacturasBuscadas();
    } catch (e) { console.error(e); }
}

document.addEventListener('DOMContentLoaded', async () => {

    await cargarMetodosPago();

    _poblarAniosSelect();

    const _roleInit = (window.FACTURA_ROLE || 'cliente').toLowerCase();
    if (_roleInit === 'vendedor' || _roleInit === 'admin') {
        cargarTodasFacturasPage();
    } else {
        cargarFacturasCliente();
    }

    const btnOrden = document.getElementById('btnOrdenFechas');
    if (btnOrden) {
        btnOrden.addEventListener('click', () => {
            ordenAscendente = !ordenAscendente;
            btnOrden.innerHTML = ordenAscendente
                ? `<i class="bi bi-sort-up-alt"></i><span>Más antiguo</span>`
                : `<i class="bi bi-sort-down-alt"></i><span>Más reciente</span>`;
            btnOrden.classList.toggle('active', ordenAscendente);
            paginaActual = 1;
            mostrarFacturasBuscadas();
        });
    }

    const inputInput = document.getElementById("buscarFactura");

    const selectFiltro = document.getElementById("filtroEstadoFactura");

    const btnArchivadas = document.getElementById("btnToggleArchivadas");

    if (btnArchivadas) {

        btnArchivadas.addEventListener("click", () => {

            mostrarArchivadas = !mostrarArchivadas;

            btnArchivadas.innerHTML = mostrarArchivadas
                ? `<i class="bi bi-archive-fill"></i><span>${t('inv.hide_archived')}</span>`
                : `<i class="bi bi-archive-fill"></i><span>${t('inv.show_archived')}</span>`;

            btnArchivadas.classList.toggle('active', mostrarArchivadas);

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
                const _roleClear = (window.FACTURA_ROLE || 'cliente').toLowerCase();
                if (_roleClear === 'vendedor' || _roleClear === 'admin') {
                    cargarTodasFacturasPage();
                } else {

                    cargarFacturasCliente();
                }
            }
        });
    }

    if (selectFiltro) {

        selectFiltro.addEventListener("change", () => {

            paginaActual = 1;

            mostrarFacturasBuscadas();
        });
    }

    const selAnioFac = document.getElementById('filtroAnioFactura');
    const inputNumFac = document.getElementById('filtroNumeroFactura');
    const btnClearNum = document.getElementById('btnClearFiltroNum');

    if (selAnioFac) {
        selAnioFac.addEventListener('change', function() {
            _filtroNumFac.anio = this.value;
            _aplicarFiltroNum();
        });
    }

    if (inputNumFac) {
        let _timerNum;
        inputNumFac.addEventListener('input', function() {
            clearTimeout(_timerNum);
            const val = this.value.trim();
            _timerNum = setTimeout(() => {
                _filtroNumFac.numero = val;
                _aplicarFiltroNum();
            }, 300);
        });
    }

    if (btnClearNum) {
        btnClearNum.addEventListener('click', _limpiarFiltroNum);
    }

    let _facturasIntervalMs = 8000;
    let _facturasIntervalId = null;

    function _runFacturasInterval() {
        const inputBuscar = document.getElementById("buscarFactura");
        const criterio = inputBuscar ? inputBuscar.value.trim() : "";
        if (criterio) {
            monitorearCambiosFacturas();
        } else {
            const _roleInt = (window.FACTURA_ROLE || 'cliente').toLowerCase();
            if (_roleInt === 'vendedor' || _roleInt === 'admin') {
                cargarTodasFacturasPage(true);
            } else {
                cargarFacturasCliente(true);
            }
        }
    }

    function _resetFacturasInterval(ms) {
        if (_facturasIntervalId) clearInterval(_facturasIntervalId);
        _facturasIntervalMs = ms;
        _facturasIntervalId = setInterval(_runFacturasInterval, ms);
    }

    _resetFacturasInterval(_facturasIntervalMs);

    document.addEventListener('socket:factura_update', (e) => {
        const roleInt = (window.FACTURA_ROLE || 'cliente').toLowerCase();
        if (roleInt === 'vendedor' || roleInt === 'admin') {
            cargarTodasFacturasPage(true);
        } else {
            cargarFacturasCliente(true);
        }
    });

    document.addEventListener('socket:polling_mode', (e) => {
        _resetFacturasInterval(e.detail.fast ? 8000 : 40000);
    });
});
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/static/js/workers/sw-ui.js').catch(() => {});
    });
}
