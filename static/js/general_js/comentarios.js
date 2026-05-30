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
                indicador.innerHTML = `<i class="bi bi-people-fill me-1"></i> ${total} Usuarios Activos`;
            } else {
                indicador.innerHTML = `<i class="bi bi-people-fill me-1"></i> 0 Usuarios Activos`;
            }
        } catch (e) {
            const indicador = document.getElementById("statusCounter");
            if (indicador) {
                indicador.innerHTML = `<i class="bi bi-people-fill me-1"></i> 0 Usuarios Activos`;
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

function insertEmoji(emoji) {
    const start = mensajeInput.selectionStart;
    const end = mensajeInput.selectionEnd;
    mensajeInput.value = mensajeInput.value.substring(0, start) + emoji + mensajeInput.value.substring(end);
    mensajeInput.focus();
    ajustarAlturaInput();
    const panel = document.getElementById('emojiPanel');
    if (panel) panel.style.display = 'none';
}

function insertFormat(startTag, endTag) {
    const start = mensajeInput.selectionStart;
    const end = mensajeInput.selectionEnd;
    const text = mensajeInput.value;
    const selectedText = text.substring(start, end);
    let replacement = startTag + selectedText + endTag;
    
    if (startTag === "\n- ") {
        replacement = selectedText.length > 0 
            ? selectedText.split('\n').map(line => line.trim() ? `\n- ${line}` : line).join('')
            : "\n- ";
    }
    
    mensajeInput.value = text.substring(0, start) + replacement + text.substring(end);
    const newCursorPos = start + replacement.length;
    mensajeInput.setSelectionRange(newCursorPos, newCursorPos);
    mensajeInput.focus();
    ajustarAlturaInput();
}

function ajustarAlturaInput() {
    mensajeInput.style.height = 'auto';
    mensajeInput.style.height = Math.min(mensajeInput.scrollHeight, 150) + 'px';
}

mensajeInput.addEventListener("input", ajustarAlturaInput);

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
    
    const mensajeFormateado = c.mensaje
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/_(.*?)_/g, '<em>$1</em>')
        .replace(/<u>(.*?)<\/u>/g, '<u>$1</u>');

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
            <!-- Corazón fuera de la burbuja, estilo Instagram -->
            <div class="btn-like-mini d-flex align-items-center gap-1 mt-1"
                 onclick="toggleLike('${c.id}')"
                 style="cursor:pointer;padding:3px 10px;border-radius:20px;background:rgba(255,255,255,0.85);
                        box-shadow:0 1px 6px rgba(0,0,0,0.1);backdrop-filter:blur(4px);width:fit-content;">
                <i class="bi ${haDadoLike ? 'bi-heart-fill text-danger' : 'bi-heart'}" style="font-size:0.9rem;${haDadoLike ? '' : 'color:#888;'}"></i>
                <small class="fw-bold" style="font-size:0.72rem;color:#555;">${(c.likes_usuarios || []).length}</small>
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
    mensajeInput.value = msg;
    editandoComentario = id;
    sendBtn.innerHTML = `<span>Guardar</span><i class="bi bi-check-lg ms-2"></i>`;
    ajustarAlturaInput();
    mensajeInput.focus();
}

sendBtn.onclick = async () => {
    const mensaje = mensajeInput.value.trim();
    if(!mensaje) return;
    sendBtn.disabled = true;
    try {
        let url = "/comentarios", method = "POST";
        if(editandoComentario) {
            url = `/comentarios/${editandoComentario}`;
            method = "PUT";
        }
        const res = await fetch(url, {
            method: method,
            headers: {"Content-Type":"application/json"},
            body: JSON.stringify({mensaje})
        });
        if(res.ok) {
            mensajeInput.value = "";
            mensajeInput.style.height = 'auto';
            editandoComentario = null;
            sendBtn.innerHTML = `<span>Enviar Sugerencia</span><i class="bi bi-send-fill ms-2"></i>`;
            await cargarComentarios();
        }
    } catch(e) { showMessage("Error al procesar", true); }
    finally { sendBtn.disabled = false; }
};

window.onload = () => {
    cargarComentarios();
    monitorConexion.iniciar();
    setInterval(cargarComentarios, 15000);
};

(function() {
    window.history.pushState(null, "", window.location.href);
    window.onpopstate = () => window.history.pushState(null, "", window.location.href);
})();

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {navigator.serviceWorker.register('/static/js/workers/service-worker-comentarios.js') .then(() => console.log('SW OK')) .catch(err => console.error('SW Error', err));});
}