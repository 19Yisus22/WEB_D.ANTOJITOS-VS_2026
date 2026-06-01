const chatBox = document.getElementById("chatBox");
const sendBtn = document.getElementById("sendBtn");
const mensajeInput = document.getElementById("mensajeInput");
const toastContainer = document.getElementById('toastContainer');
let editandoComentario = null;
let comentariosActuales = [];

const monitorConexion = {
    intervalo: null,
    intervaloConteo: null,
    frecuencia: 30000,
    iniciar() {
        setTimeout(() => this.obtenerUsuariosActivos(), 500);
        this.intervaloConteo = setInterval(() => this.obtenerUsuariosActivos(), 15000);
        
        if (!USER_CONFIG.isLogged) return;
        
        this.enviarSenal();
        this.intervalo = setInterval(() => this.enviarSenal(), this.frecuencia);
    },
    detener() {
        if (this.intervalo) clearInterval(this.intervalo);
        if (this.intervaloConteo) clearInterval(this.intervaloConteo);
    },
    async enviarSenal() {
        try {
            await fetch("/actualizar_estado_comentarios", {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
        } catch (e) {
            console.warn("Señal de presencia no enviada");
        }
    },
    async obtenerUsuariosActivos() {
        try {
            const res = await fetch("/usuarios_activos_conteo");
            const indicador = document.getElementById("statusCounter");
            
            if (!indicador) return;

            if (res.ok) {
                const data = await res.json();
                const total = (data && typeof data.total !== 'undefined') ? data.total : 0;
                indicador.innerHTML = `<i class="bi bi-people-fill me-1"></i> ${total} ${t('chat.active')}`;
            } else {
                indicador.innerHTML = `<i class="bi bi-people-fill me-1"></i> 0 ${t('chat.active')}`;
            }
        } catch (e) {
            const indicador = document.getElementById("statusCounter");
            if (indicador) {
                indicador.innerHTML = `<i class="bi bi-people-fill me-1"></i> 0 ${t('chat.active')}`;
            }
            console.error("Error en la solicitud de conteo:", e);
        }
    }
};

function showConfirmCustom(titulo, mensaje, callback) {
    mostrarConfirmacionApp(titulo, mensaje, callback);
}

function toggleEmojiPanel() {
    const panel = document.getElementById('emojiPanel');
    if (!panel) return;
    panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
}

document.addEventListener('click', (e) => {
    const panel = document.getElementById('emojiPanel');
    const btn = document.getElementById('btnToggleEmojis');
    if (panel && btn && !btn.contains(e.target) && !panel.contains(e.target)) {
        panel.style.display = 'none';
    }
});

/* ── Helpers del editor WYSIWYG ── */

/** Devuelve el ancestro .chat-list-item del nodo dado, si existe dentro del editor */
function _getParentListItem(node) {
    while (node && node !== mensajeInput) {
        if (node.nodeType === 1 && node.classList?.contains('chat-list-item')) return node;
        node = node.parentNode;
    }
    return null;
}

/** Aplica/quita negrita, cursiva o subrayado sobre la selección con previsualización */
function applyRichFormat(command) {
    mensajeInput.focus();
    document.execCommand(command, false, null);
    _updateToolbarState();
}

/** Inserta un ítem de lista en la posición actual (sin newline previo, con indentación) */
function insertListItem() {
    mensajeInput.focus();
    const sel = window.getSelection();
    if (!sel.rangeCount) return;

    const range = sel.getRangeAt(0);
    const existingItem = _getParentListItem(range.startContainer);

    if (existingItem) {
        // Ya está en un list-item: quitar el formato de lista
        const text = document.createTextNode(
            existingItem.textContent           // quita el bullet del ::before
        );
        existingItem.replaceWith(text);
        // Colocar cursor al final del texto insertado
        const newRange = document.createRange();
        newRange.setStartAfter(text);
        newRange.collapse(true);
        sel.removeAllRanges();
        sel.addRange(newRange);
    } else {
        // Insertar un nuevo ítem de lista (el '•' viene del CSS ::before, no del texto)
        const selectedText = range.toString();
        // Borramos la selección primero
        range.deleteContents();
        const div = document.createElement('div');
        div.className = 'chat-list-item';
        div.textContent = selectedText;   // sin bullet en el DOM — lo pone CSS
        range.insertNode(div);
        // Poner cursor al final del ítem recién insertado
        const newRange = document.createRange();
        newRange.setStart(div, div.childNodes.length || 0);
        newRange.collapse(true);
        sel.removeAllRanges();
        sel.addRange(newRange);
    }
    _updateToolbarState();
}

/** Maneja Enter dentro de un list-item: continúa la lista o la termina si está vacía */
mensajeInput.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' || e.shiftKey) return;

    const sel = window.getSelection();
    if (!sel.rangeCount) return;
    const listItem = _getParentListItem(sel.getRangeAt(0).startContainer);
    if (!listItem) return;

    e.preventDefault();

    if (listItem.textContent.trim() === '') {
        // Ítem vacío → salir del modo lista
        listItem.replaceWith(document.createElement('br'));
    } else {
        // Crear nuevo ítem de lista (indentado, sin newline visible)
        const newItem = document.createElement('div');
        newItem.className = 'chat-list-item';
        newItem.innerHTML = '&#8203;'; // zero-width space para que el div no colapse
        listItem.after(newItem);
        const range = document.createRange();
        range.setStart(newItem, 0);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
    }
});

/** Actualiza el estado visual (is-active) de los botones de formato según la selección */
function _updateToolbarState() {
    ['bold', 'italic', 'underline'].forEach(cmd => {
        const btn = document.querySelector(`[data-format="${cmd}"]`);
        if (btn) btn.classList.toggle('is-active', document.queryCommandState(cmd));
    });
    // Estado botón de lista
    const sel = window.getSelection();
    const btnLista = document.getElementById('btnListado');
    if (btnLista && sel && sel.rangeCount) {
        const inList = !!_getParentListItem(sel.getRangeAt(0).startContainer);
        btnLista.classList.toggle('is-active', inList);
    }
}

mensajeInput.addEventListener('keyup',   _updateToolbarState);
mensajeInput.addEventListener('mouseup', _updateToolbarState);
mensajeInput.addEventListener('input',   ajustarAlturaInput);

/** Inserta emoji en la posición del cursor */
function insertEmoji(emoji) {
    mensajeInput.focus();
    document.execCommand('insertText', false, emoji);
    ajustarAlturaInput();
    const panel = document.getElementById('emojiPanel');
    if (panel) panel.style.display = 'none';
}

/** Ajusta altura del editor al contenido */
function ajustarAlturaInput() {
    mensajeInput.style.height = 'auto';
    mensajeInput.style.height = Math.min(mensajeInput.scrollHeight, 150) + 'px';
}

/** Devuelve el HTML limpio del editor para enviar al servidor */
function _getEditorContent() {
    return mensajeInput.innerHTML.trim();
}

/** Limpia el editor */
function _clearEditor() {
    mensajeInput.innerHTML = '';
    ajustarAlturaInput();
}

/** Carga contenido en el editor (al editar un mensaje existente) */
function _setEditorContent(html) {
    mensajeInput.innerHTML = html;
    ajustarAlturaInput();
}

function getUserPastelColor(userId) {
    const gradients = [
        'linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%)',
        'linear-gradient(135deg, #f1f8e9 0%, #dcedc8 100%)',
        'linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%)',
        'linear-gradient(135deg, #f3e5f5 0%, #e1bee7 100%)',
        'linear-gradient(135deg, #fce4ec 0%, #f8bbd0 100%)',
        'linear-gradient(135deg, #e0f7fa 0%, #b2ebf2 100%)',
        'linear-gradient(135deg, #fffde7 0%, #fff9c4 100%)',
        'linear-gradient(135deg, #efebe9 0%, #d7ccc8 100%)'
    ];
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
        hash = userId.charCodeAt(i) + ((hash << 5) - hash);
    }
    return gradients[Math.abs(hash) % gradients.length];
}

function showMessage(msg, isError = false) {
    mostrarAlertaPublica({ mensaje: msg, tipo: isError ? 'error' : 'success', titulo: 'Comentarios' });
}

async function toggleLike(id) {
    if (!USER_CONFIG.isLogged) return showMessage("Inicia sesión para dar like", true);
    const container = document.querySelector(`#msg-${id}`);
    if(!container) return;
    const icon = container.querySelector('.btn-like-mini i');
    const span = container.querySelector('.btn-like-mini small');
    let currentCount = parseInt(span.innerText);
    
    if (icon.classList.contains('bi-heart')) {
        icon.classList.replace('bi-heart', 'bi-heart-fill');
        icon.classList.add('text-danger');
        span.innerText = currentCount + 1;
    } else {
        icon.classList.replace('bi-heart-fill', 'bi-heart');
        icon.classList.remove('text-danger');
        span.innerText = Math.max(0, currentCount - 1);
    }

    try {
        const res = await fetch(`/comentarios/${id}/like`, { method: "POST" });
        if (!res.ok) await cargarComentarios(); 
    } catch (e) { 
        await cargarComentarios(); 
    }
}

function renderComentario(c) {
    const esMio = String(c.cedula) === String(USER_CONFIG.userId);
    const bgGradient = getUserPastelColor(String(c.cedula));
    const info = c.usuario_info || {};
    const foto = info.foto_perfil || 'https://cdn-icons-png.flaticon.com/512/149/149071.png';
    const nombre = info.nombre ? `${info.nombre} ${info.apellido || ''}` : 'Usuario';
    const fecha = new Date(c.updated_at || c.created_at).toLocaleString('es-CO', {day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'});
    const haDadoLike = (c.likes_usuarios || []).includes(USER_CONFIG.userId);
    const wrapper = document.createElement("div");
    wrapper.className = `d-flex mb-4 ${esMio ? 'flex-row-reverse' : 'flex-row'} align-items-end gap-2`;
    wrapper.id = `msg-${c.id}`;
    const estadoClase = info.conectado ? 'estado-conectado' : 'estado-desconectado';
    
    // Compatibilidad hacia atrás: convierte markdown antiguo a HTML;
    // los mensajes nuevos ya vienen como HTML del editor WYSIWYG.
    const mensajeFormateado = c.mensaje
        .replace(/\*\*(.*?)\*\*/gs, '<strong>$1</strong>')
        .replace(/_(.*?)_/gs,       '<em>$1</em>');

    wrapper.innerHTML = `
        <div class="contenedor-foto-estado">
            <img src="${foto}" class="rounded-circle border shadow-sm" width="38" height="38"
                 style="object-fit:cover;" onerror="this.src='https://cdn-icons-png.flaticon.com/512/149/149071.png'">
            <span class="punto-estado ${estadoClase}"></span>
        </div>
        <div style="max-width:75%;display:flex;flex-direction:column;${esMio ? 'align-items:flex-end;' : 'align-items:flex-start;'}">
            <div class="message ${esMio ? 'rounded-start-4 rounded-top-4' : 'rounded-end-4 rounded-top-4'} shadow-sm"
                 style="background:${bgGradient};position:relative;">
                <div class="d-flex justify-content-between align-items-center mb-1 gap-4">
                    <div class="d-flex align-items-center gap-2">
                        <span class="fw-bold" style="font-size:0.8rem;color:#2c3e50;">${esMio ? 'Tú' : nombre}</span>
                        <span class="text-muted" style="font-size:0.65rem;opacity:0.8;">• ${fecha}</span>
                    </div>
                    ${esMio ? `<i class="bi bi-three-dots-vertical btn-options text-muted" style="cursor:pointer;font-size:0.8rem;"></i>` : ''}
                </div>
                <div class="mensaje-texto">${mensajeFormateado}</div>
                ${c.updated_at ? '<span class="text-muted" style="font-size:0.6rem;">(editado)</span>' : ''}
            </div>
            <!-- Acciones bajo la burbuja: corazón + responder (independientes) -->
            <div class="d-flex align-items-center gap-2 mt-1">
                <!-- Like -->
                <div class="btn-like-mini d-flex align-items-center gap-1"
                     onclick="toggleLike('${c.id}')"
                     style="cursor:pointer;padding:3px 10px;border-radius:20px;background:rgba(255,255,255,0.85);
                            box-shadow:0 1px 6px rgba(0,0,0,0.1);backdrop-filter:blur(4px);">
                    <i class="bi ${haDadoLike ? 'bi-heart-fill text-danger' : 'bi-heart'}" style="font-size:0.9rem;${haDadoLike ? '' : 'color:#888;'}"></i>
                    <small class="fw-bold" style="font-size:0.72rem;color:#555;">${(c.likes_usuarios || []).length}</small>
                </div>
                <!-- Responder individualmente (visible para admin/vendedor, independiente del like) -->
                ${(USER_CONFIG.userRol === 'admin' || USER_CONFIG.userRol === 'vendedor') && !esMio ? `
                <div class="btn-reply-pub d-flex align-items-center gap-1"
                     onclick="responderPublicamente('${c.id}', \`${(nombre).replace(/`/g,"'")}\`, \`${(c.mensaje || '').replace(/`/g,"'").substring(0,60)}\`)"
                     title="Responder a este mensaje"
                     style="cursor:pointer;padding:3px 10px;border-radius:20px;background:rgba(255,255,255,0.85);
                            box-shadow:0 1px 6px rgba(0,0,0,0.1);backdrop-filter:blur(4px);">
                    <i class="bi bi-reply-fill" style="font-size:0.85rem;color:#d35400;"></i>
                    <small class="fw-bold" style="font-size:0.7rem;color:#d35400;">Responder</small>
                </div>` : ''}
            </div>
        </div>
    `;

    if(esMio) {
        const btnOpt = wrapper.querySelector(".btn-options");
        btnOpt.onclick = (e) => {
            e.stopPropagation();
            document.querySelectorAll(".comentario-dropdown").forEach(d => d.remove());
            const dd = document.createElement("div");
            dd.className = "dropdown-menu show shadow border-0 comentario-dropdown p-1";
            dd.style.cssText = `position: fixed; top: ${e.clientY}px; left: ${e.clientX - 100}px; z-index: 2000; min-width: 120px; border-radius: 12px;`;
            dd.innerHTML = `
                <button class="dropdown-item rounded-2 py-1" onclick="iniciarEdicion('${c.id}', \`${c.mensaje}\`)"><i class="bi bi-pencil me-2"></i>Editar</button>
                <button class="dropdown-item rounded-2 py-1 text-danger" onclick="abrirConfirmacion('${c.id}')"><i class="bi bi-trash me-2"></i>Eliminar</button>
            `;
            document.body.appendChild(dd);
            setTimeout(() => document.addEventListener("click", () => dd.remove(), {once:true}), 50);
        };
    }
    return wrapper;
}

async function cargarComentarios() {
    try {
        const res = await fetch("/comentarios");
        if(!res.ok) return;
        const data = await res.json();
        const isAtBottom = chatBox.scrollHeight - chatBox.scrollTop <= chatBox.clientHeight + 100;
        comentariosActuales = data;
        chatBox.innerHTML = "";
        comentariosActuales.forEach(c => chatBox.appendChild(renderComentario(c)));
        if(isAtBottom) chatBox.scrollTop = chatBox.scrollHeight;
    } catch(e) { console.error(e); }
}

function abrirConfirmacion(id) {
    showConfirmCustom(
        "Eliminar Comentario", 
        "¿Estás seguro de que deseas eliminar este mensaje?", 
        () => ejecutarEliminacionDirecta(id)
    );
}

async function ejecutarEliminacionDirecta(id) {
    try {
        const res = await fetch(`/comentarios/${id}`, {method:"DELETE"});
        if(res.ok) {
            await cargarComentarios();
            showMessage("Comentario eliminado");
        }
    } catch(e) { showMessage("Error al eliminar", true); }
}

function iniciarEdicion(id, msg) {
    _setEditorContent(msg);
    editandoComentario = id;
    sendBtn.innerHTML = `<span>Guardar</span><i class="bi bi-check-lg ms-2"></i>`;
    mensajeInput.focus();
    ajustarAlturaInput();
    mensajeInput.focus();
}

sendBtn.onclick = async () => {
    const mensaje = _getEditorContent();
    // Considera vacío si solo tiene un <br> o está realmente vacío
    if (!mensaje || mensaje === '<br>' || mensaje === '&nbsp;' || mensaje === '&#8203;') return;
    sendBtn.disabled = true;
    try {
        let url = "/comentarios", method = "POST";
        if (editandoComentario) {
            url  = `/comentarios/${editandoComentario}`;
            method = "PUT";
        }
        const res = await fetch(url, {
            method,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ mensaje })
        });
        if (res.ok) {
            _clearEditor();
            editandoComentario = null;
            sendBtn.innerHTML = `<span>Enviar Sugerencia</span><i class="bi bi-send-fill ms-2"></i>`;
            await cargarComentarios();
        }
    } catch (e) { showMessage("Error al procesar", true); }
    finally { sendBtn.disabled = false; }
};

window.onload = () => {
    cargarComentarios();
    monitorConexion.iniciar();
    setInterval(cargarComentarios, 15000);
    if (USER_CONFIG.isLogged) {
        _iniciarPrivado();
        setInterval(_pollNoLeidos, 20000);
    }
};

/* ══════════════════════════════════════════════════
   RESPUESTA PÚBLICA INDIVIDUAL (admin / vendedor)
   Coloca una cita en el editor del chat público
   ══════════════════════════════════════════════════ */
let _replyTargetId = null;

function responderPublicamente(id, nombre, extracto) {
    _replyTargetId = id;
    const quoteEl = document.getElementById('replyQuote');
    const textEl  = document.getElementById('replyQuoteText');
    if (quoteEl && textEl) {
        textEl.textContent = `${nombre}: ${extracto}…`;
        quoteEl.style.display = 'flex';
    }
    mensajeInput.focus();
}

function cancelarRespuesta() {
    _replyTargetId = null;
    const quoteEl = document.getElementById('replyQuote');
    if (quoteEl) quoteEl.style.display = 'none';
}

// Override sendBtn para incluir la cita si hay respuesta activa
const _origSendClick = sendBtn.onclick;
sendBtn.onclick = async function() {
    if (_replyTargetId) {
        const quoteText = document.getElementById('replyQuoteText')?.textContent || '';
        const contenido = _getEditorContent();
        if (!contenido || contenido === '<br>') return;
        // Arma el mensaje con la cita (HTML)
        const withQuote = `<div class="pub-reply-quote">${quoteText}</div>${contenido}`;
        sendBtn.disabled = true;
        try {
            const res = await fetch('/comentarios', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mensaje: withQuote })
            });
            if (res.ok) {
                _clearEditor();
                cancelarRespuesta();
                await cargarComentarios();
            }
        } catch { showMessage('Error al procesar', true); }
        finally { sendBtn.disabled = false; }
        return;
    }
    _origSendClick.call(this);
};

/* ══════════════════════════════════════════════════
   SISTEMA DE TABS
   ══════════════════════════════════════════════════ */
function switchTab(tab) {
    const panelPub  = document.getElementById('panelPublico');
    const panelPriv = document.getElementById('panelPrivado');
    const tabPub    = document.getElementById('tabPublico');
    const tabPriv   = document.getElementById('tabPrivado');
    const titleEl   = document.getElementById('chatTitleLabel');

    if (tab === 'publico') {
        panelPub?.style.setProperty('display', '');
        panelPriv && (panelPriv.style.display = 'none');
        tabPub?.classList.add('active');
        tabPriv?.classList.remove('active');
        if (titleEl) titleEl.textContent = 'Muro de Sugerencias';
    } else {
        panelPub?.style.setProperty('display', 'none');
        if (panelPriv) { panelPriv.style.display = 'flex'; panelPriv.style.flex = '1'; }
        tabPub?.classList.remove('active');
        tabPriv?.classList.add('active');
        if (titleEl) titleEl.textContent = 'Mensajes Privados';
        _cargarPanelPrivado();
        // Limpiar badge al abrir
        _setBadgePrivado(0);
    }
}

function _setBadgePrivado(n) {
    const badge = document.getElementById('tabPrivadoBadge');
    if (!badge) return;
    badge.textContent = n > 9 ? '9+' : n;
    badge.style.display = n > 0 ? 'inline-flex' : 'none';
}

async function _pollNoLeidos() {
    try {
        const r = await fetch('/mensajes_privados/no_leidos');
        if (!r.ok) return;
        const d = await r.json();
        _setBadgePrivado(d.count || 0);
    } catch {}
}

function _iniciarPrivado() {
    _pollNoLeidos();
    if (USER_CONFIG.userRol === 'cliente') {
        _cargarMensajesPredeterminados();
    }
}

async function _cargarPanelPrivado() {
    if (USER_CONFIG.userRol === 'cliente') {
        await _cargarHiloCliente();
    } else if (USER_CONFIG.userRol === 'vendedor') {
        await _cargarHilosVendedor();
        await _cargarContactosStaff();
    } else if (USER_CONFIG.userRol === 'admin') {
        await _cargarContactosStaff();
    }
}

function switchPrivSubtab(tab) {
    const panelC = document.getElementById('privPanelClientes');
    const panelE = document.getElementById('privPanelEquipo');
    const btnC   = document.getElementById('subtabClientes');
    const btnE   = document.getElementById('subtabEquipo');
    if (tab === 'clientes') {
        if (panelC) panelC.style.display = '';
        if (panelE) panelE.style.display = 'none';
        btnC?.classList.add('active');
        btnE?.classList.remove('active');
    } else {
        if (panelC) panelC.style.display = 'none';
        if (panelE) { panelE.style.display = ''; panelE.style.flex = '1'; }
        btnC?.classList.remove('active');
        btnE?.classList.add('active');
    }
}

async function _cargarMensajesPredeterminados() {
    const cont = document.getElementById('predefinedBtns');
    if (!cont) return;
    try {
        const r = await fetch('/mensajes_privados/predeterminados');
        const lista = await r.json();
        cont.innerHTML = lista.map(m => `
            <button class="priv-predefined-btn" onclick="enviarMensajePredeterminado(${m.id}, \`${m.texto}\`)">
                <span class="priv-pred-icon">${m.icono}</span>
                <span>${m.texto}</span>
            </button>
        `).join('');
    } catch {}
}

async function _cargarHiloCliente() {
    const box = document.getElementById('clienteHiloBox');
    if (!box) return;
    try {
        const r = await fetch('/mensajes_privados/mi_hilo');
        if (!r.ok) return;
        const msgs = await r.json();
        box.innerHTML = '';
        if (!msgs.length) {
            box.innerHTML = `<div class="priv-hilo-empty"><i class="bi bi-chat-dots"></i><p data-i18n="chat.priv_empty">${t('chat.priv_empty')}</p></div>`;
            return;
        }
        msgs.forEach(m => box.appendChild(_renderMsgPrivado(m, !m.es_vendedor, m.id)));
        box.scrollTop = box.scrollHeight;
    } catch {}
}

async function enviarMensajePredeterminado(idMsg, texto) {
    try {
        const r = await fetch('/mensajes_privados/enviar', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mensaje: texto, es_predeterminado: true })
        });
        if (r.ok) {
            showMessage(t('notif.order_sent') || 'Mensaje enviado');
            await _cargarHiloCliente();
        }
    } catch { showMessage(t('notif.error_conn'), true); }
}

async function enviarMensajeLibreCliente() {
    const ta  = document.getElementById('clienteMensajeLibre');
    const msg = (ta?.value || '').trim();
    if (!msg) return;
    try {
        const r = await fetch('/mensajes_privados/enviar', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mensaje: msg })
        });
        if (r.ok) {
            ta.value = '';
            await _cargarHiloCliente();
        }
    } catch { showMessage(t('notif.error_conn'), true); }
}

let _hiloSeleccionado = null;

async function _cargarHilosVendedor() {
    const lista = document.getElementById('hilosLista');
    if (!lista) return;
    try {
        const r = await fetch('/mensajes_privados/hilos');
        const hilos = await r.json();
        if (!hilos.length) {
            lista.innerHTML = `<div class="priv-hilo-empty" style="padding:1.5rem;text-align:center;"><i class="bi bi-inbox" style="font-size:2rem;display:block;"></i>${t('status.empty')}</div>`;
            return;
        }
        lista.innerHTML = '';
        hilos.forEach(h => {
            const div  = document.createElement('div');
            div.className  = 'priv-hilo-item';
            div.dataset.cedula = h.cedula_cliente;
            if (h.no_leidos > 0) div.classList.add('has-unread');
            const foto = h.info_cliente?.imagen || '/static/uploads/default_icon_profile.png';
            div.innerHTML = `
                <div class="priv-hilo-avatar"><img src="${foto}" onerror="this.src='/static/uploads/default_icon_profile.png'"></div>
                <div class="priv-hilo-info">
                    <span class="priv-hilo-name">${h.info_cliente?.nombre || h.cedula_cliente}</span>
                    <span class="priv-hilo-last">${(h.ultimo_mensaje || '').substring(0, 50)}</span>
                </div>
                ${h.no_leidos > 0 ? `<span class="priv-hilo-badge">${h.no_leidos}</span>` : ''}
                <button class="priv-hilo-delete" title="Eliminar hilo" onclick="limpiarHiloCV('${h.cedula_cliente}', event)"><i class="bi bi-trash3"></i></button>
            `;
            div.onclick = (e) => {
                if (e.target.closest('.priv-hilo-delete')) return;
                abrirConversacion(h.cedula_cliente, h.info_cliente?.nombre || h.cedula_cliente, foto);
            };
            lista.appendChild(div);
        });
    } catch {}
}

async function abrirConversacion(cedulaCliente, nombreCliente, fotoCliente) {
    _hiloSeleccionado = cedulaCliente;
    const empty  = document.getElementById('privConvEmpty');
    const header = document.getElementById('privConvHeader');
    const box    = document.getElementById('privConvBox');
    const input  = document.getElementById('privConvInput');
    if (empty)  empty.style.display = 'none';
    if (header) {
        header.style.display = 'flex';
        header.innerHTML = `
            <img src="${fotoCliente}" class="priv-conv-avatar" onerror="this.src='/static/uploads/default_icon_profile.png'">
            <div><strong>${nombreCliente}</strong><small style="display:block;color:#888;font-size:0.72rem;">${t('state.cliente')}</small></div>
            <button class="btn btn-sm btn-outline-danger ms-auto" onclick="limpiarHiloCV('${cedulaCliente}', event)"><i class="bi bi-trash3 me-1"></i>${t('btn.delete')}</button>
        `;
    }
    if (box)   box.style.display = 'block';
    if (input) input.style.display = 'flex';
    document.querySelectorAll('#hilosLista .priv-hilo-item').forEach(el => {
        el.classList.toggle('active', el.dataset.cedula === cedulaCliente);
        if (el.dataset.cedula === cedulaCliente) {
            el.classList.remove('has-unread');
            el.querySelector('.priv-hilo-badge')?.remove();
        }
    });
    try {
        const r = await fetch(`/mensajes_privados/hilo/${cedulaCliente}`);
        const msgs = await r.json();
        box.innerHTML = '';
        msgs.forEach(m => box.appendChild(_renderMsgPrivado(m, m.es_vendedor, m.id)));
        box.scrollTop = box.scrollHeight;
    } catch {}
}

async function enviarRespuestaVendedor() {
    if (!_hiloSeleccionado) return;
    const textarea = document.getElementById('privRespuestaInput');
    const msg = (textarea?.value || '').trim();
    if (!msg) return;
    try {
        const r = await fetch('/mensajes_privados/enviar', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mensaje: msg, cedula_cliente: _hiloSeleccionado })
        });
        if (r.ok) {
            textarea.value = '';
            await abrirConversacion(_hiloSeleccionado,
                document.querySelector('#privConvHeader strong')?.textContent || '',
                document.querySelector('#privConvHeader .priv-conv-avatar')?.src || '');
        }
    } catch { showMessage(t('notif.error_conn'), true); }
}

async function limpiarHiloCV(cedulaCliente, ev) {
    ev?.stopPropagation();
    mostrarConfirmacionApp(t('confirm.title'), t('confirm.delete'), async () => {
        try {
            await fetch(`/mensajes_privados/hilo/${cedulaCliente}/limpiar`, { method: 'DELETE' });
            _hiloSeleccionado = null;
            await _cargarHilosVendedor();
            ['privConvEmpty','privConvHeader','privConvBox','privConvInput'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.style.display = id === 'privConvEmpty' ? '' : 'none';
            });
        } catch { showMessage(t('notif.error_conn'), true); }
    });
}

let _staffSeleccionado = null;

async function _cargarContactosStaff() {
    const lista = document.getElementById('staffContactosLista');
    if (!lista) return;
    try {
        const r = await fetch('/mensajes_privados/staff/contactos');
        const contactos = await r.json();
        lista.innerHTML = '';
        if (!contactos.length) {
            lista.innerHTML = `<div class="priv-hilo-empty" style="padding:1.5rem;text-align:center;"><i class="bi bi-people" style="font-size:2rem;display:block;"></i>${t('status.empty')}</div>`;
            return;
        }
        contactos.forEach(c => {
            const div  = document.createElement('div');
            div.className = 'priv-hilo-item';
            div.dataset.cedula = c.cedula;
            const foto = c.imagen || '/static/uploads/default_icon_profile.png';
            const rolLabel = c.rol === 'admin' ? t('state.admin') : t('state.vendedor');
            div.innerHTML = `
                <div class="priv-hilo-avatar"><img src="${foto}" onerror="this.src='/static/uploads/default_icon_profile.png'"></div>
                <div class="priv-hilo-info">
                    <span class="priv-hilo-name">${c.nombre}</span>
                    <span class="priv-hilo-last" style="color:${c.rol==='admin'?'#d35400':'#27ae60'};">${rolLabel}</span>
                </div>
            `;
            div.onclick = () => abrirConversacionStaff(c.cedula, c.nombre, foto, rolLabel);
            lista.appendChild(div);
        });
    } catch {}
}

async function abrirConversacionStaff(cedulaDest, nombre, foto, rolLabel) {
    _staffSeleccionado = cedulaDest;
    const empty  = document.getElementById('staffConvEmpty');
    const header = document.getElementById('staffConvHeader');
    const box    = document.getElementById('staffConvBox');
    const input  = document.getElementById('staffConvInput');
    if (empty)  empty.style.display = 'none';
    if (header) {
        header.style.display = 'flex';
        header.innerHTML = `
            <img src="${foto}" class="priv-conv-avatar" onerror="this.src='/static/uploads/default_icon_profile.png'">
            <div><strong>${nombre}</strong><small style="display:block;color:#888;font-size:0.72rem;">${rolLabel}</small></div>
            <button class="btn btn-sm btn-outline-danger ms-auto" onclick="limpiarHiloStaff('${cedulaDest}')"><i class="bi bi-trash3 me-1"></i>${t('btn.delete')}</button>
        `;
    }
    if (box)   box.style.display = 'block';
    if (input) input.style.display = 'flex';
    document.querySelectorAll('#staffContactosLista .priv-hilo-item').forEach(el =>
        el.classList.toggle('active', el.dataset.cedula === cedulaDest)
    );
    try {
        const r = await fetch(`/mensajes_privados/staff/hilo/${cedulaDest}`);
        const msgs = await r.json();
        box.innerHTML = '';
        msgs.forEach(m => box.appendChild(_renderMsgPrivado(m, m.cedula_remitente === USER_CONFIG.userId, m.id)));
        box.scrollTop = box.scrollHeight;
    } catch {}
}

async function enviarMensajeStaff() {
    if (!_staffSeleccionado) return;
    const ta  = document.getElementById('staffMensajeInput');
    const msg = (ta?.value || '').trim();
    if (!msg) return;
    try {
        const r = await fetch('/mensajes_privados/staff/enviar', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mensaje: msg, cedula_dest: _staffSeleccionado })
        });
        if (r.ok) {
            ta.value = '';
            await abrirConversacionStaff(_staffSeleccionado,
                document.querySelector('#staffConvHeader strong')?.textContent || '',
                document.querySelector('#staffConvHeader .priv-conv-avatar')?.src || '',
                '');
        }
    } catch { showMessage(t('notif.error_conn'), true); }
}

async function limpiarHiloStaff(cedulaDest) {
    mostrarConfirmacionApp(t('confirm.title'), t('confirm.delete'), async () => {
        try {
            await fetch(`/mensajes_privados/staff/hilo/${cedulaDest}/limpiar`, { method: 'DELETE' });
            _staffSeleccionado = null;
            await _cargarContactosStaff();
            ['staffConvEmpty','staffConvHeader','staffConvBox','staffConvInput'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.style.display = id === 'staffConvEmpty' ? '' : 'none';
            });
        } catch { showMessage(t('notif.error_conn'), true); }
    });
}

document.addEventListener('DOMContentLoaded', () => {
    [
        { id: 'privRespuestaInput',  fn: enviarRespuestaVendedor },
        { id: 'staffMensajeInput',   fn: enviarMensajeStaff },
        { id: 'clienteMensajeLibre', fn: enviarMensajeLibreCliente },
    ].forEach(({ id, fn }) => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('keydown', e => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); fn(); }
        });
    });
});

function _renderMsgPrivado(m, esMio, msgId) {
    const div = document.createElement('div');
    div.className = `priv-msg ${esMio ? 'priv-msg--mio' : 'priv-msg--otro'}`;
    div.dataset.id = msgId || '';
    const hora = new Date(m.created_at).toLocaleTimeString('es-CO', {hour:'2-digit', minute:'2-digit'});
    div.innerHTML = `
        <div class="priv-msg-bubble">
            ${m.es_predeterminado ? `<span class="priv-pred-tag"><i class="bi bi-list-check me-1"></i>${t('chat.list')}</span>` : ''}
            <span class="priv-msg-text">${m.mensaje}</span>
            <div class="d-flex justify-content-between align-items-center gap-2 mt-1">
                <span class="priv-msg-time">${hora}</span>
                ${esMio || USER_CONFIG.userRol !== 'cliente' ? `<button class="priv-msg-del" onclick="eliminarMsgPrivado('${msgId}', this)" title="${t('btn.delete')}"><i class="bi bi-trash3"></i></button>` : ''}
            </div>
        </div>
    `;
    return div;
}

async function eliminarMsgPrivado(id, btn) {
    try {
        const r = await fetch(`/mensajes_privados/${id}`, { method: 'DELETE' });
        if (r.ok) btn?.closest('.priv-msg')?.remove();
    } catch { showMessage(t('notif.error_conn'), true); }
}

async function limpiarTodosMensajes() {
    mostrarConfirmacionApp(t('confirm.title'), t('confirm.delete'), async () => {
        try {
            await fetch('/comentarios/limpiar_todo', { method: 'DELETE' });
            await cargarComentarios();
        } catch { showMessage(t('notif.error_conn'), true); }
    });
}

(function() {
    window.history.pushState(null, "", window.location.href);
    window.onpopstate = () => window.history.pushState(null, "", window.location.href);
})();

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {navigator.serviceWorker.register('/static/js/workers/service-worker-comentarios.js') .then(() => console.log('SW OK')) .catch(err => console.error('SW Error', err));});
}