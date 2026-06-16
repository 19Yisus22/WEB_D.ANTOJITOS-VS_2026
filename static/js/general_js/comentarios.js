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

function showEmojiCat(cat, btn) {
    document.querySelectorAll('.ep-cat-panel').forEach(p => p.style.display = 'none');
    document.querySelectorAll('.ep-cat-btn').forEach(b => b.classList.remove('active'));
    const panel = document.getElementById('ep-' + cat);
    if (panel) panel.style.display = 'grid';
    if (btn) btn.classList.add('active');
}

document.addEventListener('click', (e) => {
    const panel = document.getElementById('emojiPanel');
    const btn = document.getElementById('btnToggleEmojis');
    if (panel && btn && !btn.contains(e.target) && !panel.contains(e.target)) {
        panel.style.display = 'none';
    }
});

let _pendingImages = [];

function _actualizarPreviewImagenes() {
    const area = document.getElementById('imagenesPreview');
    if (!area) return;
    if (_pendingImages.length === 0) {
        area.style.display = 'none';
        area.innerHTML = '';
        return;
    }
    area.style.display = 'flex';
    area.innerHTML = _pendingImages.map((img, i) => `
        <div class="chat-img-thumb">
            <img src="${img.data}" alt="imagen">
            <button class="chat-img-thumb-remove" onclick="_removerImagenPendiente(${i})" title="Quitar">
                <i class="bi bi-x"></i>
            </button>
        </div>`).join('');
}

function _removerImagenPendiente(idx) {
    _pendingImages.splice(idx, 1);
    _actualizarPreviewImagenes();
}

function _agregarImagenAlChat(file) {
    if (!file || !file.type.startsWith('image/')) return;
    if (file.size > 2 * 1024 * 1024) {
        showMessage('La imagen supera el límite de 2 MB', true);
        return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
        _pendingImages.push({ data: ev.target.result, nombre: file.name, size: file.size });
        _actualizarPreviewImagenes();
    };
    reader.readAsDataURL(file);
}

function adjuntarImagenDesdeArchivo(input) {
    if (input.files && input.files[0]) {
        _agregarImagenAlChat(input.files[0]);
        input.value = '';
    }
}

function _abrirImagenAmpliada(src) {
    let modal = document.getElementById('chatImgModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'chatImgModal';
        modal.innerHTML = '<img src="" alt="imagen">';
        modal.onclick = () => modal.style.display = 'none';
        document.body.appendChild(modal);
    }
    modal.querySelector('img').src = src;
    modal.style.display = 'flex';
}

function _getParentListItem(node) {
    while (node && node !== mensajeInput) {
        if (node.nodeType === 1 && node.classList?.contains('chat-list-item')) return node;
        node = node.parentNode;
    }
    return null;
}

function applyRichFormat(command) {
    mensajeInput.focus();
    document.execCommand(command, false, null);
    _updateToolbarState();
}

function insertListItem() {
    mensajeInput.focus();
    const sel = window.getSelection();
    if (!sel.rangeCount) return;

    const range = sel.getRangeAt(0);
    const existingItem = _getParentListItem(range.startContainer);

    if (existingItem) {

        const text = document.createTextNode(
            existingItem.textContent
        );
        existingItem.replaceWith(text);

        const newRange = document.createRange();
        newRange.setStartAfter(text);
        newRange.collapse(true);
        sel.removeAllRanges();
        sel.addRange(newRange);
    } else {

        const selectedText = range.toString();

        range.deleteContents();
        const div = document.createElement('div');
        div.className = 'chat-list-item';
        div.textContent = selectedText;
        range.insertNode(div);

        const newRange = document.createRange();
        newRange.setStart(div, div.childNodes.length || 0);
        newRange.collapse(true);
        sel.removeAllRanges();
        sel.addRange(newRange);
    }
    _updateToolbarState();
}

mensajeInput.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' || e.shiftKey) return;

    const sel = window.getSelection();
    if (!sel.rangeCount) return;
    const listItem = _getParentListItem(sel.getRangeAt(0).startContainer);
    if (!listItem) return;

    e.preventDefault();

    if (listItem.textContent.trim() === '') {

        listItem.replaceWith(document.createElement('br'));
    } else {

        const newItem = document.createElement('div');
        newItem.className = 'chat-list-item';
        newItem.innerHTML = '&#8203;';
        listItem.after(newItem);
        const range = document.createRange();
        range.setStart(newItem, 0);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
    }
});

function _updateToolbarState() {
    ['bold', 'italic', 'underline'].forEach(cmd => {
        const btn = document.querySelector(`[data-format="${cmd}"]`);
        if (btn) btn.classList.toggle('is-active', document.queryCommandState(cmd));
    });

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

mensajeInput.addEventListener('paste', function(e) {
    const clipData = e.clipboardData || window.clipboardData;

    const items = clipData.items || [];
    for (const item of items) {
        if (item.type.startsWith('image/')) {
            e.preventDefault();
            const file = item.getAsFile();
            if (file) _agregarImagenAlChat(file);
            return;
        }
    }

    e.preventDefault();
    let text = clipData.getData('text/plain') || '';
    text = text.replace(/<[^>]*>/g, '');
    document.execCommand('insertText', false, text);
    ajustarAlturaInput();
});

function insertEmoji(emoji) {
    mensajeInput.focus();
    document.execCommand('insertText', false, emoji);
    ajustarAlturaInput();
    const panel = document.getElementById('emojiPanel');
    if (panel) panel.style.display = 'none';
}

function ajustarAlturaInput() {
    mensajeInput.style.height = 'auto';
    mensajeInput.style.height = Math.min(mensajeInput.scrollHeight, 150) + 'px';
}

function _getEditorContent() {
    return mensajeInput.innerHTML.trim();
}

function _clearEditor() {
    mensajeInput.innerHTML = '';
    ajustarAlturaInput();
}

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
    if (!container) return;
    const icon = container.querySelector('.btn-like-mini i');
    const span = container.querySelector('.btn-like-mini small');
    const wasLiked = icon.classList.contains('bi-heart-fill');
    icon.classList.toggle('bi-heart-fill', !wasLiked);
    icon.classList.toggle('bi-heart', wasLiked);
    icon.classList.toggle('text-danger', !wasLiked);
    span.innerText = !wasLiked ? parseInt(span.innerText) + 1 : Math.max(0, parseInt(span.innerText) - 1);
    try {
        const res = await fetch(`/comentarios/${id}/like`, { method: "POST" });
        if (res.ok) {
            const data = await res.json();
            const likes = data.likes || [];
            const liked = likes.map(String).includes(String(USER_CONFIG.userId));
            icon.classList.toggle('bi-heart-fill', liked);
            icon.classList.toggle('bi-heart', !liked);
            icon.classList.toggle('text-danger', liked);
            span.innerText = likes.length;
        } else {
            await cargarComentarios();
        }
    } catch {
        await cargarComentarios();
    }
}

function _escAttr(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function renderComentario(c) {
    const esAdmin = USER_CONFIG.userRol === 'admin';
    const esMio = String(c.cedula) === String(USER_CONFIG.userId);
    const yaEditado = c.updated_at && c.created_at && c.updated_at !== c.created_at;
    const puedeEditar = esMio && (esAdmin || !yaEditado);
    const mostrarOpciones = esAdmin || esMio;
    const bgGradient = getUserPastelColor(String(c.cedula));
    const info = c.usuario_info || {};
    const foto = info.foto_perfil || '';
    const nombre = info.nombre ? `${info.nombre} ${info.apellido || ''}` : 'Usuario';
    const fecha = new Date(c.updated_at || c.created_at).toLocaleString('es-CO', {day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'});
    const haDadoLike = (c.likes_usuarios || []).map(String).includes(String(USER_CONFIG.userId));
    const wrapper = document.createElement("div");
    wrapper.className = `d-flex mb-4 ${esMio ? 'flex-row-reverse' : 'flex-row'} align-items-end gap-2`;
    wrapper.id = `msg-${c.id}`;
    const estadoClase = info.conectado ? 'estado-conectado' : 'estado-desconectado';

    const mensajeFormateado = (c.mensaje || '')
        .replace(/\*\*(.*?)\*\*/gs, '<strong>$1</strong>')
        .replace(/_(.*?)_/gs, '<em>$1</em>');

    wrapper.innerHTML = `
        <div class="contenedor-foto-estado" style="width:28px;height:28px;flex-shrink:0;">
            <img src="" data-profile="${_escAttr(foto)}" data-profile-name="${_escAttr(nombre)}" data-profile-size="28"
                 alt="${_escAttr(nombre)}" class="rounded-circle border shadow-sm"
                 style="width:28px;height:28px;object-fit:cover;display:block;">
            <span class="punto-estado ${estadoClase}"></span>
        </div>
        <div style="max-width:75%;display:flex;flex-direction:column;${esMio ? 'align-items:flex-end;' : 'align-items:flex-start;'}">
            <div class="message ${esMio ? 'rounded-start-4 rounded-top-4' : 'rounded-end-4 rounded-top-4'} shadow-sm"
                 style="background:${bgGradient};position:relative;">
                <div class="d-flex justify-content-between align-items-center mb-1 gap-4">
                    <div class="d-flex align-items-center gap-2">
                        <span class="fw-bold" style="font-size:0.8rem;color:#2c3e50;">${esMio ? 'Tú' : _escAttr(nombre)}</span>
                        <span class="text-muted" style="font-size:0.65rem;opacity:0.8;">• ${_escAttr(fecha)}${yaEditado ? ' · <em style="font-size:0.6rem;opacity:0.75;">editado</em>' : ''}</span>
                    </div>
                    ${(esAdmin && esMio) ? '<i class="bi bi-three-dots-vertical btn-options text-muted" style="cursor:pointer;font-size:0.8rem;"></i>' :
                      esMio ? `<button class="btn-edit-inline btn p-0 border-0" style="line-height:1;font-size:0.82rem;${yaEditado ? 'color:#bbb;cursor:not-allowed;' : 'color:#7f8c8d;'}" ${yaEditado ? 'disabled title="Ya editaste este mensaje"' : 'title="Editar"'}><i class="bi bi-pencil-fill"></i></button>` : ''}
                </div>
                ${mensajeFormateado ? '<div class="mensaje-texto"></div>' : ''}
                ${(c.adjuntos && c.adjuntos.length > 0) ? '<div class="chat-bubble-images"></div>' : ''}
            </div>
            <div class="d-flex align-items-center gap-2 mt-1">
                <div class="btn-like-mini d-flex align-items-center gap-1"
                     style="cursor:pointer;padding:3px 10px;border-radius:20px;background:rgba(255,255,255,0.85);
                            box-shadow:0 1px 6px rgba(0,0,0,0.1);backdrop-filter:blur(4px);">
                    <i class="bi ${haDadoLike ? 'bi-heart-fill text-danger' : 'bi-heart'}" style="font-size:0.9rem;${haDadoLike ? '' : 'color:#888;'}"></i>
                    <small class="fw-bold" style="font-size:0.72rem;color:#555;">${(c.likes_usuarios || []).length}</small>
                </div>
                ${USER_CONFIG.userRol === 'admin' && !esMio ? `
                <div class="btn-reply-pub d-flex align-items-center gap-1"
                     title="Responder a este mensaje"
                     style="cursor:pointer;padding:3px 10px;border-radius:20px;background:rgba(255,255,255,0.85);
                            box-shadow:0 1px 6px rgba(0,0,0,0.1);backdrop-filter:blur(4px);">
                    <i class="bi bi-reply-fill" style="font-size:0.85rem;color:#d35400;"></i>
                    <small class="fw-bold" style="font-size:0.7rem;color:#d35400;">Responder</small>
                </div>` : ''}
            </div>
        </div>
    `;

    const msgTextoEl = wrapper.querySelector('.mensaje-texto');
    if (msgTextoEl && mensajeFormateado) {
        msgTextoEl.innerHTML = mensajeFormateado;
    }

    const adjuntosEl = wrapper.querySelector('.chat-bubble-images');
    if (adjuntosEl && c.adjuntos && c.adjuntos.length > 0) {
        c.adjuntos.forEach(a => {
            const img = document.createElement('img');
            img.src = a.data;
            img.className = 'chat-bubble-img';
            img.alt = a.nombre || 'imagen';
            img.addEventListener('click', () => _abrirImagenAmpliada(a.data));
            adjuntosEl.appendChild(img);
        });
    }

    const likeBtn = wrapper.querySelector('.btn-like-mini');
    if (likeBtn) likeBtn.addEventListener('click', () => toggleLike(c.id));

    const replyBtn = wrapper.querySelector('.btn-reply-pub');
    if (replyBtn) {
        replyBtn.addEventListener('click', () => {
            const extracto = (c.mensaje || '')
                .replace(/<[^>]*>/g, ' ')
                .replace(/\s+/g, ' ')
                .trim()
                .substring(0, 60);
            responderPublicamente(c.id, nombre, extracto);
        });
    }

    requestAnimationFrame(() => {
        const imgEl = wrapper.querySelector('img[data-profile]');
        if (imgEl && typeof loadProfileImg === 'function') {
            loadProfileImg(imgEl, foto, nombre, 28);
        }
    });

    if (esAdmin && esMio) {
        const btnOpt = wrapper.querySelector(".btn-options");
        if (btnOpt) btnOpt.onclick = (e) => {
            e.stopPropagation();
            document.querySelectorAll(".comentario-dropdown").forEach(d => d.remove());
            const dd = document.createElement("div");
            dd.className = "dropdown-menu show shadow border-0 comentario-dropdown p-1";
            dd.style.cssText = `position: fixed; top: ${e.clientY}px; left: ${e.clientX - 100}px; z-index: 2000; min-width: 140px; border-radius: 12px;`;

            if (puedeEditar) {
                const btnEditar = document.createElement('button');
                btnEditar.className = 'dropdown-item rounded-2 py-1';
                btnEditar.innerHTML = '<i class="bi bi-pencil me-2"></i>Editar';
                btnEditar.addEventListener('click', () => { dd.remove(); iniciarEdicion(c.id, c.mensaje); });
                dd.appendChild(btnEditar);
            }

            const btnEliminar = document.createElement('button');
            btnEliminar.className = 'dropdown-item rounded-2 py-1 text-danger';
            btnEliminar.innerHTML = '<i class="bi bi-trash me-2"></i>Eliminar';
            btnEliminar.addEventListener('click', () => { dd.remove(); abrirConfirmacion(c.id); });
            dd.appendChild(btnEliminar);

            const btnCheck = document.createElement('button');
            btnCheck.className = 'dropdown-item rounded-2 py-1';
            btnCheck.innerHTML = '<i class="bi bi-check2-square me-2"></i>Seleccionar';
            btnCheck.addEventListener('click', () => {
                dd.remove();
                _activarModoSeleccion();
                const cb = wrapper.querySelector('.chat-msg-check');
                if (cb) {
                    cb.checked = true;
                    const dot = wrapper.querySelector('.msg-sel-dot');
                    if (dot) { dot.style.background = '#e74c3c'; const ic = dot.querySelector('i'); if (ic) ic.style.display = 'inline'; }
                    wrapper.querySelector('.message')?.classList.add('msg-selected');
                    const countEl = document.getElementById('bulkSelectCount');
                    if (countEl) countEl.textContent = '1 seleccionado(s)';
                }
            });
            dd.appendChild(btnCheck);

            document.body.appendChild(dd);
            setTimeout(() => document.addEventListener("click", () => dd.remove(), {once:true}), 50);
        };
    } else if (esMio && !yaEditado) {
        const btnEdit = wrapper.querySelector('.btn-edit-inline');
        if (btnEdit) btnEdit.addEventListener('click', () => iniciarEdicion(c.id, c.mensaje));
    }

    if (esAdmin) {
        wrapper.style.position = 'relative';
        // Invisible checkbox — just for data storage, not in the flex flow
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.className = 'chat-msg-check';
        cb.dataset.id = c.id;
        cb.style.cssText = 'position:absolute;opacity:0;pointer-events:none;width:0;height:0;';
        wrapper.appendChild(cb);
        // Visible selection marker (circle with check)
        const dot = document.createElement('div');
        dot.className = 'msg-sel-dot';
        const side = esMio ? 'right:2px;' : 'left:2px;';
        dot.style.cssText = `display:none;position:absolute;top:2px;${side}width:22px;height:22px;border-radius:50%;border:2.5px solid #e74c3c;background:#fff;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,0.2);z-index:10;transition:all 0.12s ease;`;
        dot.innerHTML = '<i class="bi bi-check2" style="font-size:0.75rem;color:#fff;display:none;line-height:1;"></i>';
        wrapper.appendChild(dot);
    }

    return wrapper;
}

let _comentariosHash = '';

function _hashComentarios(arr) {
    return arr.map(c => c.id + ':' + (c.updated_at || c.created_at || '') + ':' + (c.likes_usuarios || []).length).join('|');
}

async function cargarComentarios(force = false) {
    try {
        const res = await fetch("/comentarios", { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        const hash = _hashComentarios(data);
        if (!force && hash === _comentariosHash) return;
        _comentariosHash = hash;
        const isAtBottom = chatBox.scrollHeight - chatBox.scrollTop <= chatBox.clientHeight + 100;
        comentariosActuales = data;
        chatBox.innerHTML = "";
        comentariosActuales.forEach(c => chatBox.appendChild(renderComentario(c)));
        if (isAtBottom) chatBox.scrollTop = chatBox.scrollHeight;
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
    const sinTexto = !mensaje || mensaje === '<br>' || mensaje === '&nbsp;' || mensaje === '&#8203;';
    if (sinTexto && _pendingImages.length === 0) return;
    sendBtn.disabled = true;
    try {
        let url = "/comentarios", method = "POST";
        if (editandoComentario) {
            url    = `/comentarios/${editandoComentario}`;
            method = "PUT";
        }
        const body = { mensaje: sinTexto ? '' : mensaje };
        if (!editandoComentario && _pendingImages.length > 0) {
            body.adjuntos = _pendingImages.map(i => ({data: i.data, nombre: i.nombre, size: i.size}));
        }
        const res = await fetch(url, {
            method,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body)
        });
        if (res.ok) {
            const data = await res.json();

            if (data.logros_nuevos && data.logros_nuevos.length > 0 && window.mostrarLogros) {
                window.mostrarLogros(data.logros_nuevos);
            }
            _clearEditor();
            _pendingImages = [];
            _actualizarPreviewImagenes();
            editandoComentario = null;
            sendBtn.innerHTML = `<span>Enviar Sugerencia</span><i class="bi bi-send-fill ms-2"></i>`;
            await cargarComentarios();
        } else {
            const err = await res.json().catch(() => ({}));
            showMessage(err.error || 'Error al procesar', true);
            if (res.status === 409) {
                editandoComentario = null;
                sendBtn.innerHTML = `<span>Enviar Sugerencia</span><i class="bi bi-send-fill ms-2"></i>`;
                _clearEditor();
                await cargarComentarios();
            }
        }
    } catch (e) { showMessage("Error al procesar", true); }
    finally { sendBtn.disabled = false; }
};

let _privFastPoller  = null;
let _privFastHash    = '';
let _clienteHiloHash = '';
let _cvConvHash      = '';
let _staffConvHash   = '';

function _iniciarPrivFastPoll(fn) {
    if (_privFastPoller) clearInterval(_privFastPoller);
    _privFastPoller = setInterval(async () => { if (!document.hidden) await fn(); }, 2000);
}

function _detenerPrivFastPoll() {
    if (_privFastPoller) { clearInterval(_privFastPoller); _privFastPoller = null; }
    _privFastHash = '';
}

window.onload = () => {
    cargarComentarios(true);
    monitorConexion.iniciar();

    setInterval(() => {
        if (document.hidden) return;
        const tabPub = document.getElementById('tabPublico');
        if (!tabPub || tabPub.classList.contains('active')) cargarComentarios();
    }, 2000);

    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) cargarComentarios();
    });

    if (USER_CONFIG.isLogged) {
        _iniciarPrivado();
        setInterval(_pollNoLeidos, 5000);
    }
};

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

const _origSendClick = sendBtn.onclick;
sendBtn.onclick = async function() {
    if (_replyTargetId) {
        const quoteText = document.getElementById('replyQuoteText')?.textContent || '';
        const contenido = _getEditorContent();
        const sinTexto = !contenido || contenido === '<br>';
        if (sinTexto && _pendingImages.length === 0) return;
        const withQuote = sinTexto ? '' : `<div class="pub-reply-quote">${quoteText}</div>${contenido}`;
        sendBtn.disabled = true;
        try {
            const body = { mensaje: withQuote };
            if (_pendingImages.length > 0) body.adjuntos = _pendingImages.map(i => ({data:i.data, nombre:i.nombre, size:i.size}));
            const res = await fetch('/comentarios', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            if (res.ok) {
                const data = await res.json().catch(() => ({}));
                if (data.logros_nuevos && data.logros_nuevos.length > 0 && window.mostrarLogros) window.mostrarLogros(data.logros_nuevos);
                _clearEditor();
                _pendingImages = [];
                _actualizarPreviewImagenes();
                cancelarRespuesta();
                await cargarComentarios();
            }
        } catch { showMessage('Error al procesar', true); }
        finally { sendBtn.disabled = false; }
        return;
    }
    _origSendClick.call(this);
};

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
        window._chatCV_abierto    = null;
        window._chatStaff_abierto = null;
        if (_convPoller) { clearInterval(_convPoller); _convPoller = null; }
    } else {
        panelPub?.style.setProperty('display', 'none');
        if (panelPriv) { panelPriv.style.display = 'flex'; panelPriv.style.flex = '1'; }
        tabPub?.classList.remove('active');
        tabPriv?.classList.add('active');
        if (titleEl) titleEl.textContent = 'Mensajes Privados';
        _cargarPanelPrivado();
    }
}

async function _pollNoLeidos() {
    try {
        if (USER_CONFIG.userRol !== 'cliente' && !_hiloSeleccionado) {
            const lista = document.getElementById('hilosLista');
            if (lista && lista.children.length > 0) await _cargarHilosVendedor();
        }
        if (!_staffSeleccionado) {
            const staffLista = document.getElementById('staffContactosLista');
            if (staffLista && staffLista.children.length > 0) await _cargarContactosStaff();
        }
    } catch {}
}

function _iniciarPrivado() {
    if (USER_CONFIG.userRol === 'cliente') {
        _cargarMensajesPredeterminados();
        _cargarHiloCliente();
        _iniciarConvPoller('clienteCV', _cargarHiloCliente);
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
    window._chatCV_abierto    = USER_CONFIG.userId;
    window._chatStaff_abierto = null;
    try {
        const r = await fetch('/mensajes_privados/mi_hilo', { cache: 'no-store' });
        if (!r.ok) return;
        const msgs = await r.json();
        const hash = msgs.map(m => m.id + ':' + (m.updated_at || m.created_at || '')).join('|');
        if (hash === _clienteHiloHash && box.children.length > 0) return;
        _clienteHiloHash = hash;
        const eraAbajo = box.scrollHeight - box.scrollTop <= box.clientHeight + 120;
        box.innerHTML = '';
        if (!msgs.length) {
            box.innerHTML = `<div class="priv-hilo-empty"><i class="bi bi-chat-dots"></i><p data-i18n="chat.priv_empty">${t('chat.priv_empty')}</p></div>`;
            return;
        }
        msgs.forEach(m => box.appendChild(_renderMsgPrivado(m, m.cedula_para === USER_CONFIG.userId, m.id)));
        if (eraAbajo) box.scrollTop = box.scrollHeight;
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
    const ta      = document.getElementById('clienteMensajeLibre');
    const sendBtn = ta?.closest('.priv-conv-input')?.querySelector('.priv-send-btn');
    const msg     = (ta?.value || '').trim();
    if (!msg && _pendingImages.length === 0) return;
    if (sendBtn?.disabled) return;
    if (sendBtn) sendBtn.disabled = true;
    try {
        if (_editandoMsgPrivado) {
            const r = await fetch(`/mensajes_privados/${_editandoMsgPrivado}`, {
                method:  'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mensaje: msg })
            });
            if (r.ok) {
                ta.value = '';
                _editandoMsgPrivado = null;
                if (sendBtn) sendBtn.innerHTML = `<i class="bi bi-send-fill"></i>`;
                await _cargarHiloCliente();
            } else {
                const err = await r.json().catch(() => ({}));
                showMessage(err.error || t('notif.error_conn') || 'Error al editar.', true);
                if (r.status === 409) {
                    ta.value = '';
                    _editandoMsgPrivado = null;
                    if (sendBtn) sendBtn.innerHTML = `<i class="bi bi-send-fill"></i>`;
                    _clienteHiloHash = '';
                    await _cargarHiloCliente();
                }
            }
            return;
        }
        const msgTexto = msg;
        const imgsOpt  = [..._pendingImages];
        const box      = document.getElementById('clienteHiloBox');
        ta.value = '';
        _pendingImages = [];
        _actualizarPreviewImagenes();
        const tempId = 'temp_' + Date.now();
        const tempEl = _renderMsgPrivado({ id: tempId, mensaje: msgTexto, adjuntos: imgsOpt.length > 0 ? imgsOpt.map(i => ({data:i.data, nombre:i.nombre})) : null, es_predeterminado: false, created_at: new Date().toISOString() }, true, tempId);
        tempEl.style.opacity = '0.55';
        tempEl.dataset.tempId = tempId;
        tempEl.querySelectorAll('button').forEach(b => b.disabled = true);
        if (box) { box.appendChild(tempEl); box.scrollTop = box.scrollHeight; }
        const body = { mensaje: msgTexto };
        if (imgsOpt.length > 0) body.adjuntos = imgsOpt.map(i => ({data:i.data, nombre:i.nombre, size:i.size}));
        const r = await fetch('/mensajes_privados/enviar', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        if (r.ok) {
            await _cargarHiloCliente();
        } else {
            document.querySelector(`[data-temp-id="${tempId}"]`)?.remove();
            ta.value = msgTexto;
            _pendingImages = imgsOpt;
            _actualizarPreviewImagenes();
            showMessage(t('notif.error_conn') || 'Error al enviar. Intenta de nuevo.', true);
        }
    } catch {
        showMessage(t('notif.error_conn'), true);
    } finally {
        if (sendBtn) sendBtn.disabled = false;
    }
}

let _hiloSeleccionado    = null;
let _editandoMsgPrivado  = null;
let _convPoller          = null;

window._chatCV_abierto    = null;
window._chatStaff_abierto = null;

function _iniciarConvPoller(tipo, recargarFn) {
    if (_convPoller) clearInterval(_convPoller);
    _convPoller = setInterval(() => _marcarLeidosConvAbierta(tipo), 8000);
    if (recargarFn) _iniciarPrivFastPoll(recargarFn);
}

async function _marcarLeidosConvAbierta(tipo) {
    try {
        if (tipo === 'cv' && _hiloSeleccionado) {
            await fetch('/mensajes_privados/marcar_leidos', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ cedula_cliente: _hiloSeleccionado })
            });
        } else if (tipo === 'clienteCV') {
            await fetch('/mensajes_privados/marcar_leidos', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({})
            });
        } else if (tipo === 'staff' && _staffSeleccionado) {
            await fetch('/mensajes_privados/staff/marcar_leidos', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ cedula_otro: _staffSeleccionado })
            });
        }
    } catch {}
}

function editarMsgPrivado(id) {
    const msgEl = document.querySelector(`.priv-msg[data-id="${id}"]`);
    if (!msgEl) return;
    const texto = msgEl.dataset.msgTexto || msgEl.querySelector('.priv-msg-text')?.textContent || '';
    _editandoMsgPrivado = id;
    let taId;
    if (msgEl.closest('#clienteHiloBox'))    taId = 'clienteMensajeLibre';
    else if (msgEl.closest('#privConvBox'))  taId = 'privRespuestaInput';
    else if (msgEl.closest('#staffConvBox')) taId = 'staffMensajeInput';
    const ta = taId ? document.getElementById(taId) : null;
    if (!ta) return;
    ta.value = texto;
    ta.focus();
    ta.select();
    const sendBtn = ta.closest('.priv-conv-input, .priv-client-wrap')?.querySelector('.priv-send-btn');
    if (sendBtn) sendBtn.innerHTML = `<i class="bi bi-check2"></i>`;
}

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

function _volverAListaCV() {
    document.getElementById('privPanelClientes')?.classList.remove('show-detail');
    _hiloSeleccionado = null;
    _cvConvHash = '';
    document.querySelectorAll('#hilosLista .priv-hilo-item').forEach(el => el.classList.remove('active'));
    ['privConvEmpty','privConvHeader','privConvBox','privConvInput'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = id === 'privConvEmpty' ? '' : 'none';
    });
    _detenerPrivFastPoll();
}

async function abrirConversacion(cedulaCliente, nombreCliente, fotoCliente) {
    _hiloSeleccionado             = cedulaCliente;
    _cvConvHash                   = '';
    window._chatCV_abierto        = cedulaCliente;
    window._chatStaff_abierto     = null;
    _iniciarConvPoller('cv', _refreshMensajesCV);
    document.getElementById('privPanelClientes')?.classList.add('show-detail');
    const empty  = document.getElementById('privConvEmpty');
    const header = document.getElementById('privConvHeader');
    const box    = document.getElementById('privConvBox');
    const input  = document.getElementById('privConvInput');
    if (empty)  empty.style.display = 'none';
    if (header) {
        header.style.display = 'flex';
        header.innerHTML = `
            <button class="priv-mobile-back" onclick="_volverAListaCV()" title="${t('btn.back') || 'Volver'}"><i class="bi bi-arrow-left"></i></button>
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
        const _clearKey = `cv_clear_${USER_CONFIG.userId}_${cedulaCliente}`;
        const _clearedAt = localStorage.getItem(_clearKey);
        const _filtrados = _clearedAt ? msgs.filter(m => new Date(m.created_at) > new Date(_clearedAt)) : msgs;
        box.innerHTML = '';
        _filtrados.forEach(m => box.appendChild(_renderMsgPrivado(m, m.cedula_para === USER_CONFIG.userId, m.id)));
        box.scrollTop = box.scrollHeight;
    } catch {}
}

async function enviarRespuestaVendedor() {
    if (!_hiloSeleccionado) return;
    const textarea = document.getElementById('privRespuestaInput');
    const sendBtn  = textarea?.closest('.priv-conv-input')?.querySelector('.priv-send-btn');
    const msg      = (textarea?.value || '').trim();
    if (!msg && _pendingImages.length === 0) return;
    if (sendBtn?.disabled) return;
    if (sendBtn) sendBtn.disabled = true;
    try {
        if (_editandoMsgPrivado) {
            const r = await fetch(`/mensajes_privados/${_editandoMsgPrivado}`, {
                method:  'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mensaje: msg })
            });
            if (r.ok) {
                textarea.value = '';
                _editandoMsgPrivado = null;
                if (sendBtn) sendBtn.innerHTML = `<i class="bi bi-send-fill"></i>`;
                await abrirConversacion(_hiloSeleccionado,
                    document.querySelector('#privConvHeader strong')?.textContent || '',
                    document.querySelector('#privConvHeader .priv-conv-avatar')?.src || '');
            } else {
                const err = await r.json().catch(() => ({}));
                showMessage(err.error || t('notif.error_conn') || 'Error al editar.', true);
                if (r.status === 409) {
                    textarea.value = '';
                    _editandoMsgPrivado = null;
                    if (sendBtn) sendBtn.innerHTML = `<i class="bi bi-send-fill"></i>`;
                    _cvConvHash = '';
                }
            }
            return;
        }
        const msgTexto = msg;
        const imgsOpt  = [..._pendingImages];
        const box      = document.getElementById('privConvBox');
        const nombre   = document.querySelector('#privConvHeader strong')?.textContent || '';
        const foto     = document.querySelector('#privConvHeader .priv-conv-avatar')?.src || '';
        textarea.value = '';
        _pendingImages = [];
        _actualizarPreviewImagenes();
        const tempId = 'temp_' + Date.now();
        const tempEl = _renderMsgPrivado({ id: tempId, mensaje: msgTexto, adjuntos: imgsOpt.length > 0 ? imgsOpt.map(i => ({data:i.data, nombre:i.nombre})) : null, es_predeterminado: false, created_at: new Date().toISOString() }, true, tempId);
        tempEl.style.opacity = '0.55';
        tempEl.dataset.tempId = tempId;
        tempEl.querySelectorAll('button').forEach(b => b.disabled = true);
        if (box) { box.appendChild(tempEl); box.scrollTop = box.scrollHeight; }
        const body = { mensaje: msgTexto, cedula_cliente: _hiloSeleccionado };
        if (imgsOpt.length > 0) body.adjuntos = imgsOpt.map(i => ({data:i.data, nombre:i.nombre, size:i.size}));
        const r = await fetch('/mensajes_privados/enviar', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        if (r.ok) {
            await abrirConversacion(_hiloSeleccionado, nombre, foto);
        } else {
            document.querySelector(`[data-temp-id="${tempId}"]`)?.remove();
            textarea.value = msgTexto;
            _pendingImages = imgsOpt;
            _actualizarPreviewImagenes();
            showMessage(t('notif.error_conn') || 'Error al enviar. Intenta de nuevo.', true);
        }
    } catch {
        showMessage(t('notif.error_conn'), true);
    } finally {
        if (sendBtn) sendBtn.disabled = false;
    }
}

function limpiarHiloCV(cedulaCliente, ev) {
    ev?.stopPropagation();
    mostrarConfirmacionApp(t('confirm.title'), t('confirm.delete'), () => {
        localStorage.setItem(`cv_clear_${USER_CONFIG.userId}_${cedulaCliente}`, new Date().toISOString());
        _hiloSeleccionado = null;
        _cvConvHash = '';
        document.getElementById('privPanelClientes')?.classList.remove('show-detail');
        _cargarHilosVendedor();
        ['privConvEmpty','privConvHeader','privConvBox','privConvInput'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.display = id === 'privConvEmpty' ? '' : 'none';
        });
    });
}

async function _refreshMensajesCV() {
    if (!_hiloSeleccionado) return;
    const box = document.getElementById('privConvBox');
    if (!box || box.style.display === 'none') return;
    try {
        const r = await fetch(`/mensajes_privados/hilo/${_hiloSeleccionado}`, { cache: 'no-store' });
        if (!r.ok) return;
        const msgs = await r.json();
        const _clearKey   = `cv_clear_${USER_CONFIG.userId}_${_hiloSeleccionado}`;
        const _clearedAt  = localStorage.getItem(_clearKey);
        const filtered    = _clearedAt ? msgs.filter(m => new Date(m.created_at) > new Date(_clearedAt)) : msgs;
        const hash        = filtered.map(m => m.id + ':' + (m.updated_at || m.created_at || '')).join('|');
        if (hash === _cvConvHash) return;
        _cvConvHash = hash;
        const eraAbajo = box.scrollHeight - box.scrollTop <= box.clientHeight + 100;
        box.innerHTML = '';
        filtered.forEach(m => box.appendChild(_renderMsgPrivado(m, m.cedula_para === USER_CONFIG.userId, m.id)));
        if (eraAbajo) box.scrollTop = box.scrollHeight;
    } catch {}
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
            if (c.no_leidos > 0) div.classList.add('has-unread');
            const foto = c.imagen || '/static/uploads/default_icon_profile.png';
            const rolLabel = c.rol === 'admin' ? t('state.admin') : t('state.vendedor');
            div.innerHTML = `
                <div class="priv-hilo-avatar"><img src="${foto}" onerror="this.src='/static/uploads/default_icon_profile.png'"></div>
                <div class="priv-hilo-info">
                    <span class="priv-hilo-name">${c.nombre}</span>
                    <span class="priv-hilo-last" style="color:${c.rol==='admin'?'#d35400':'#27ae60'};">${rolLabel}</span>
                </div>
                ${c.no_leidos > 0 ? `<span class="priv-hilo-badge">${c.no_leidos}</span>` : ''}
            `;
            div.onclick = () => abrirConversacionStaff(c.cedula, c.nombre, foto, rolLabel);
            lista.appendChild(div);
        });
    } catch {}
}

function _volverAListaStaff() {
    const panelId = document.getElementById('privPanelEquipo') ? 'privPanelEquipo' : null;
    const panel   = panelId ? document.getElementById(panelId) : document.querySelector('.priv-layout');
    panel?.classList.remove('show-detail');
    _staffSeleccionado = null;
    _staffConvHash = '';
    document.querySelectorAll('#staffContactosLista .priv-hilo-item').forEach(el => el.classList.remove('active'));
    ['staffConvEmpty','staffConvHeader','staffConvBox','staffConvInput'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = id === 'staffConvEmpty' ? '' : 'none';
    });
    _detenerPrivFastPoll();
}

async function abrirConversacionStaff(cedulaDest, nombre, foto, rolLabel) {
    _staffSeleccionado            = cedulaDest;
    _staffConvHash                = '';
    window._chatStaff_abierto     = cedulaDest;
    window._chatCV_abierto        = null;
    _iniciarConvPoller('staff', _refreshMensajesStaff);
    const panel  = document.getElementById('privPanelEquipo') || document.querySelector('.priv-layout');
    panel?.classList.add('show-detail');
    const empty  = document.getElementById('staffConvEmpty');
    const header = document.getElementById('staffConvHeader');
    const box    = document.getElementById('staffConvBox');
    const input  = document.getElementById('staffConvInput');
    if (empty)  empty.style.display = 'none';
    if (header) {
        header.style.display = 'flex';
        header.innerHTML = `
            <button class="priv-mobile-back" onclick="_volverAListaStaff()" title="${t('btn.back') || 'Volver'}"><i class="bi bi-arrow-left"></i></button>
            <img src="${foto}" class="priv-conv-avatar" onerror="this.src='/static/uploads/default_icon_profile.png'">
            <div><strong>${nombre}</strong><small style="display:block;color:#888;font-size:0.72rem;">${rolLabel}</small></div>
            <button class="btn btn-sm btn-outline-danger ms-auto" onclick="limpiarHiloStaff('${cedulaDest}')"><i class="bi bi-trash3 me-1"></i>${t('btn.delete')}</button>
        `;
    }
    if (box)   box.style.display = 'block';
    if (input) input.style.display = 'flex';
    document.querySelectorAll('#staffContactosLista .priv-hilo-item').forEach(el => {
        el.classList.toggle('active', el.dataset.cedula === cedulaDest);
        if (el.dataset.cedula === cedulaDest) {
            el.querySelector('.priv-hilo-badge')?.remove();
        }
    });
    try {
        const r = await fetch(`/mensajes_privados/staff/hilo/${cedulaDest}`);
        const msgs = await r.json();
        const _staffClearKey = `staff_clear_${USER_CONFIG.userId}_${cedulaDest}`;
        const _staffClearedAt = localStorage.getItem(_staffClearKey);
        const _staffFiltrados = _staffClearedAt ? msgs.filter(m => new Date(m.created_at) > new Date(_staffClearedAt)) : msgs;
        box.innerHTML = '';
        _staffFiltrados.forEach(m => box.appendChild(_renderMsgPrivado(m, m.cedula_de === USER_CONFIG.userId, m.id)));
        box.scrollTop = box.scrollHeight;
    } catch {}
}

async function enviarMensajeStaff() {
    if (!_staffSeleccionado) return;
    const ta      = document.getElementById('staffMensajeInput');
    const sendBtn = ta?.closest('.priv-conv-input')?.querySelector('.priv-send-btn');
    const msg     = (ta?.value || '').trim();
    if (!msg && _pendingImages.length === 0) return;
    if (sendBtn?.disabled) return;
    if (sendBtn) sendBtn.disabled = true;
    try {
        if (_editandoMsgPrivado) {
            const r = await fetch(`/mensajes_privados/${_editandoMsgPrivado}`, {
                method:  'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mensaje: msg })
            });
            if (r.ok) {
                ta.value = '';
                _editandoMsgPrivado = null;
                if (sendBtn) sendBtn.innerHTML = `<i class="bi bi-send-fill"></i>`;
                await abrirConversacionStaff(_staffSeleccionado,
                    document.querySelector('#staffConvHeader strong')?.textContent || '',
                    document.querySelector('#staffConvHeader .priv-conv-avatar')?.src || '',
                    '');
            } else {
                const err = await r.json().catch(() => ({}));
                showMessage(err.error || t('notif.error_conn') || 'Error al editar.', true);
                if (r.status === 409) {
                    ta.value = '';
                    _editandoMsgPrivado = null;
                    if (sendBtn) sendBtn.innerHTML = `<i class="bi bi-send-fill"></i>`;
                    _staffConvHash = '';
                }
            }
            return;
        }
        const msgTexto = msg;
        const imgsOpt  = [..._pendingImages];
        const box      = document.getElementById('staffConvBox');
        const nombre   = document.querySelector('#staffConvHeader strong')?.textContent || '';
        const foto     = document.querySelector('#staffConvHeader .priv-conv-avatar')?.src || '';
        ta.value = '';
        _pendingImages = [];
        _actualizarPreviewImagenes();
        const tempId = 'temp_' + Date.now();
        const tempEl = _renderMsgPrivado({ id: tempId, mensaje: msgTexto, adjuntos: imgsOpt.length > 0 ? imgsOpt.map(i => ({data:i.data, nombre:i.nombre})) : null, es_predeterminado: false, created_at: new Date().toISOString() }, true, tempId);
        tempEl.style.opacity = '0.55';
        tempEl.dataset.tempId = tempId;
        tempEl.querySelectorAll('button').forEach(b => b.disabled = true);
        if (box) { box.appendChild(tempEl); box.scrollTop = box.scrollHeight; }
        const body = { mensaje: msgTexto, cedula_dest: _staffSeleccionado };
        if (imgsOpt.length > 0) body.adjuntos = imgsOpt.map(i => ({data:i.data, nombre:i.nombre, size:i.size}));
        const r = await fetch('/mensajes_privados/staff/enviar', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        if (r.ok) {
            const data = await r.json().catch(() => ({}));
            if (data.logros_nuevos?.length > 0 && window.mostrarLogros) window.mostrarLogros(data.logros_nuevos);
            await abrirConversacionStaff(_staffSeleccionado, nombre, foto, '');
        } else {
            document.querySelector(`[data-temp-id="${tempId}"]`)?.remove();
            ta.value = msgTexto;
            _pendingImages = imgsOpt;
            _actualizarPreviewImagenes();
            showMessage(t('notif.error_conn') || 'Error al enviar. Intenta de nuevo.', true);
        }
    } catch {
        showMessage(t('notif.error_conn'), true);
    } finally {
        if (sendBtn) sendBtn.disabled = false;
    }
}

function limpiarHiloStaff(cedulaDest) {
    mostrarConfirmacionApp(t('confirm.title'), t('confirm.delete'), () => {
        localStorage.setItem(`staff_clear_${USER_CONFIG.userId}_${cedulaDest}`, new Date().toISOString());
        _staffSeleccionado = null;
        _staffConvHash = '';
        const panel = document.getElementById('privPanelEquipo') || document.querySelector('.priv-layout');
        panel?.classList.remove('show-detail');
        _cargarContactosStaff();
        ['staffConvEmpty','staffConvHeader','staffConvBox','staffConvInput'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.display = id === 'staffConvEmpty' ? '' : 'none';
        });
    });
}

async function _refreshMensajesStaff() {
    if (!_staffSeleccionado) return;
    const box = document.getElementById('staffConvBox');
    if (!box || box.style.display === 'none') return;
    try {
        const r = await fetch(`/mensajes_privados/staff/hilo/${_staffSeleccionado}`, { cache: 'no-store' });
        if (!r.ok) return;
        const msgs = await r.json();
        const _staffClearKey   = `staff_clear_${USER_CONFIG.userId}_${_staffSeleccionado}`;
        const _staffClearedAt  = localStorage.getItem(_staffClearKey);
        const filtered         = _staffClearedAt ? msgs.filter(m => new Date(m.created_at) > new Date(_staffClearedAt)) : msgs;
        const hash             = filtered.map(m => m.id + ':' + (m.updated_at || m.created_at || '')).join('|');
        if (hash === _staffConvHash) return;
        _staffConvHash = hash;
        const eraAbajo = box.scrollHeight - box.scrollTop <= box.clientHeight + 100;
        box.innerHTML = '';
        filtered.forEach(m => box.appendChild(_renderMsgPrivado(m, m.cedula_de === USER_CONFIG.userId, m.id)));
        if (eraAbajo) box.scrollTop = box.scrollHeight;
    } catch {}
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
    const esAdmin = USER_CONFIG.userRol === 'admin';
    const isTempId = String(msgId || '').startsWith('temp_');
    const yaEditado = !isTempId && !!m.es_editado;
    const puedeEditar = esMio && !m.es_predeterminado && (esAdmin || !yaEditado);
    const div = document.createElement('div');
    div.className = `priv-msg ${esMio ? 'priv-msg--mio' : 'priv-msg--otro'}`;
    div.dataset.id = msgId || '';
    div.dataset.msgTexto = m.mensaje || '';
    const hora = new Date(m.created_at).toLocaleTimeString('es-CO', {hour:'2-digit', minute:'2-digit'});
    const editadoTag = (!isTempId && m.es_editado) ? `<em class="priv-editado-tag">editado</em>` : '';
    const adjuntosHtml = (m.adjuntos && m.adjuntos.length > 0)
        ? `<div class="chat-bubble-images">${m.adjuntos.map(a =>
            `<img src="${a.data}" class="chat-bubble-img" alt="${a.nombre||'imagen'}" onclick="_abrirImagenAmpliada('${a.data}')">`
          ).join('')}</div>`
        : '';
    const editBtnHtml = !esMio || m.es_predeterminado ? '' :
        esAdmin ? `<button class="priv-msg-edit" onclick="editarMsgPrivado('${msgId}')" title="${t('btn.edit')}"><i class="bi bi-pencil"></i></button>` :
        yaEditado ? `<button class="priv-msg-edit" disabled title="Ya editado" style="opacity:0.4;cursor:not-allowed;"><i class="bi bi-pencil"></i></button>` :
        `<button class="priv-msg-edit" onclick="editarMsgPrivado('${msgId}')" title="${t('btn.edit')}"><i class="bi bi-pencil"></i></button>`;
    div.innerHTML = `
        <div class="priv-msg-bubble">
            ${m.es_predeterminado ? `<span class="priv-pred-tag"><i class="bi bi-list-check me-1"></i>${t('chat.list')}</span>` : ''}
            ${m.mensaje ? `<span class="priv-msg-text">${m.mensaje}</span>` : ''}
            ${adjuntosHtml}
            <div class="d-flex justify-content-between align-items-center gap-2 mt-1">
                <span class="priv-msg-time">${hora}${editadoTag}</span>
                <div class="d-flex gap-1">
                    ${editBtnHtml}
                    ${esAdmin ? `<button class="priv-msg-del" onclick="eliminarMsgPrivado('${msgId}', this)" title="${t('btn.delete')}"><i class="bi bi-trash3"></i></button>` : ''}
                </div>
            </div>
        </div>
    `;
    return div;
}

function eliminarMsgPrivado(id, btn) {
    mostrarConfirmacionApp(t('confirm.title'), t('confirm.delete'), async () => {
        try {
            const r = await fetch(`/mensajes_privados/${id}`, { method: 'DELETE' });
            if (r.ok) btn?.closest('.priv-msg')?.remove();
        } catch { showMessage(t('notif.error_conn'), true); }
    });
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

// ── Multi-select bulk delete (admin only) ──────────────────────────────────────

let _modoSeleccion = false;

function _activarModoSeleccion() {
    if (_modoSeleccion) return;
    _modoSeleccion = true;
    chatBox?.classList.add('modo-seleccion');
    document.querySelectorAll('.msg-sel-dot').forEach(d => { d.style.display = 'flex'; });
    _mostrarToolbarBulk(true);
}

function _desactivarModoSeleccion() {
    _modoSeleccion = false;
    chatBox?.classList.remove('modo-seleccion');
    document.querySelectorAll('.chat-msg-check').forEach(cb => { cb.checked = false; });
    document.querySelectorAll('.msg-sel-dot').forEach(dot => {
        dot.style.display = 'none';
        dot.style.background = '#fff';
        const icon = dot.querySelector('i');
        if (icon) icon.style.display = 'none';
    });
    document.querySelectorAll('.message.msg-selected').forEach(el => el.classList.remove('msg-selected'));
    _mostrarToolbarBulk(false);
}

function _toggleModoSeleccion() {
    _modoSeleccion ? _desactivarModoSeleccion() : _activarModoSeleccion();
}

function _selToggleWrapper(wrapper) {
    const cb = wrapper?.querySelector('.chat-msg-check');
    if (!cb) return;
    cb.checked = !cb.checked;
    const dot = wrapper.querySelector('.msg-sel-dot');
    if (dot) {
        dot.style.background = cb.checked ? '#e74c3c' : '#fff';
        const icon = dot.querySelector('i');
        if (icon) icon.style.display = cb.checked ? 'inline' : 'none';
    }
    wrapper.querySelector('.message')?.classList.toggle('msg-selected', cb.checked);
    const n = document.querySelectorAll('.chat-msg-check:checked').length;
    const countEl = document.getElementById('bulkSelectCount');
    if (countEl) countEl.textContent = n > 0 ? `${n} seleccionado(s)` : 'Toca un mensaje para seleccionarlo';
}

function _mostrarToolbarBulk(visible) {
    let toolbar = document.getElementById('bulkDeleteToolbar');
    if (!toolbar) {
        toolbar = document.createElement('div');
        toolbar.id = 'bulkDeleteToolbar';
        toolbar.style.cssText = 'display:none;position:fixed;bottom:0;left:0;right:0;background:#fff3cd;border-top:2px solid #f0ad4e;padding:10px 16px;gap:10px;align-items:center;z-index:9999;box-shadow:0 -4px 16px rgba(0,0,0,0.1);';
        const info = document.createElement('span');
        info.id = 'bulkSelectCount';
        info.style.cssText = 'font-size:0.85rem;color:#856404;flex:1;font-weight:600;';
        info.textContent = 'Toca un mensaje para seleccionarlo';
        const btnDel = document.createElement('button');
        btnDel.className = 'btn btn-danger btn-sm px-3';
        btnDel.innerHTML = '<i class="bi bi-trash me-1"></i>Eliminar';
        btnDel.onclick = _bulkEliminarSeleccionados;
        const btnCancel = document.createElement('button');
        btnCancel.className = 'btn btn-outline-secondary btn-sm px-3';
        btnCancel.innerHTML = '<i class="bi bi-x me-1"></i>Cancelar';
        btnCancel.onclick = _desactivarModoSeleccion;
        toolbar.appendChild(info);
        toolbar.appendChild(btnDel);
        toolbar.appendChild(btnCancel);
        document.body.appendChild(toolbar);
        // Click anywhere on a message to toggle selection
        chatBox?.addEventListener('click', (e) => {
            if (!_modoSeleccion) return;
            const wrapper = e.target.closest('[id^="msg-"]');
            if (wrapper) _selToggleWrapper(wrapper);
        });
    }
    toolbar.style.display = visible ? 'flex' : 'none';
    if (!visible) {
        const countEl = document.getElementById('bulkSelectCount');
        if (countEl) countEl.textContent = 'Toca un mensaje para seleccionarlo';
    }
}

async function _bulkEliminarSeleccionados() {
    const ids = [...document.querySelectorAll('.chat-msg-check:checked')].map(cb => cb.dataset.id);
    if (!ids.length) return showMessage('Selecciona al menos un mensaje', true);
    mostrarConfirmacionApp('Eliminar', `¿Eliminar ${ids.length} mensaje(s) permanentemente?`, async () => {
        try {
            const r = await fetch('/comentarios/bulk', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids })
            });
            if (r.ok) {
                showMessage(`${ids.length} mensaje(s) eliminados`);
                _desactivarModoSeleccion();
                await cargarComentarios(true);
            } else {
                showMessage('Error al eliminar', true);
            }
        } catch { showMessage('Error al eliminar', true); }
    });
}

// ── Chat temporal (admin only) ─────────────────────────────────────────────────

async function _cargarChatTemporalPublico() {
    if (USER_CONFIG.userRol !== 'admin') return;
    try {
        const r = await fetch('/comentarios/config_temporal');
        if (!r.ok) return;
        const { modo } = await r.json();
        const sel = document.getElementById('chatTemporalPublicoSelect');
        if (sel) sel.value = modo;
    } catch {}
}

async function _guardarChatTemporalPublico(modo) {
    try {
        await fetch('/comentarios/config_temporal', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ modo })
        });
        showMessage('Chat público actualizado');
    } catch { showMessage('Error al guardar', true); }
}

async function _cargarChatTemporalPrivado() {
    if (USER_CONFIG.userRol !== 'admin') return;
    try {
        const r = await fetch('/mensajes_privados/config_temporal');
        if (!r.ok) return;
        const { modo } = await r.json();
        const sel = document.getElementById('chatTemporalPrivadoSelect');
        if (sel) sel.value = modo;
    } catch {}
}

async function _guardarChatTemporalPrivado(modo) {
    try {
        await fetch('/mensajes_privados/config_temporal', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ modo })
        });
        showMessage('Chat privado actualizado');
    } catch { showMessage('Error al guardar', true); }
}

// Initialize admin-only features when DOM ready
document.addEventListener('DOMContentLoaded', () => {
    if (USER_CONFIG.userRol === 'admin') {
        _cargarChatTemporalPublico();
        _cargarChatTemporalPrivado();
        const selPub = document.getElementById('chatTemporalPublicoSelect');
        if (selPub) selPub.addEventListener('change', () => _guardarChatTemporalPublico(selPub.value));
        const selPriv = document.getElementById('chatTemporalPrivadoSelect');
        if (selPriv) selPriv.addEventListener('change', () => _guardarChatTemporalPrivado(selPriv.value));
        const btnSel = document.getElementById('btnModoSeleccion');
        if (btnSel) btnSel.addEventListener('click', _toggleModoSeleccion);
    }
});
