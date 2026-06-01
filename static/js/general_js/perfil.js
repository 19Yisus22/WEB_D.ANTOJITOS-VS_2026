const toastContainer = document.getElementById('toastContainer');
let allUsers = [];
let filteredUsers = [];
let currentPage = 1;
const recordsPerPage = 7;

function showMessage(msg, isError = false) {
    mostrarAlerta(msg, isError);
}

function showConfirmCustom(titulo, mensaje, callback) {
    mostrarConfirmacionApp(titulo, mensaje, callback);
}

function setLoading(btn, isLoading, originalText) {
    if (isLoading) {
        btn.disabled = true;
        btn.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span>Procesando...`;
    } else {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}

function esCuentaGoogle(usuario) {
    const authMethod = String(usuario.auth_method || '').toLowerCase();
    if (authMethod) return authMethod === 'google';

    const contrasena = String(usuario.contrasena || '').trim();
    if (contrasena.toUpperCase() === 'GOOGLE_AUTH_EXTERNAL') return true;
    if (contrasena.includes('$') && /^[0-9a-f]{64}\$[0-9a-f]{64}$/i.test(contrasena)) return false;

    return Boolean(usuario.google_id || String(usuario.metodo_auth || '').toLowerCase() === 'google');
}

const passInput = document.getElementById("nuevaContrasena");
const confirmInput = document.getElementById("confirmarContrasena");

function updateStrengthBar(password) {
    const bar = document.getElementById("passwordStrengthBar");
    if (!bar) return;
    let width = 0;
    let color = "#e53e3e";
    if (password.length >= 6) { width = 33; color = "#e53e3e"; }
    if (password.length >= 10) { width = 66; color = "#f6e05e"; }
    if (password.length >= 15) { width = 100; color = "#48bb78"; }
    bar.style.width = width + "%";
    bar.style.backgroundColor = color;
}

function validarPass() {
    if (typeof USER_AUTH_GOOGLE !== 'undefined' && USER_AUTH_GOOGLE) return;
    const p = passInput.value;
    const c = confirmInput.value;
    updateStrengthBar(p);
    if (!c) {
        confirmInput.style.borderColor = "#ddd";
        return;
    }
    if (p === c && p.length >= 6) {
        confirmInput.style.borderColor = "#28a745";
        confirmInput.style.boxShadow = "0 0 0 0.25rem rgba(40, 167, 69, 0.25)";
    } else {
        confirmInput.style.borderColor = "#dc3545";
        confirmInput.style.boxShadow = "0 0 0 0.25rem rgba(220, 53, 69, 0.25)";
    }
}

if (passInput) passInput.addEventListener("input", validarPass);
if (confirmInput) confirmInput.addEventListener("input", validarPass);

const btnCambiarContrasena = document.getElementById("btnCambiarContrasena");
if (btnCambiarContrasena) {
    btnCambiarContrasena.addEventListener("click", async () => {
        const p = passInput.value;
        const c = confirmInput.value;
        if (!p || p.length < 6) {
            showMessage("La contraseña debe tener al menos 6 caracteres", true);
            return;
        }
        if (p !== c) {
            showMessage("Las contraseñas no coinciden", true);
            return;
        }
        const originalText = btnCambiarContrasena.innerHTML;
        setLoading(btnCambiarContrasena, true, originalText);
        try {
            const res = await fetch("/cambiar_contrasena", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ nueva: p })
            });
            const data = await res.json();
            if (res.ok && data.ok) {
                showMessage("Contraseña actualizada correctamente");
                passInput.value = "";
                confirmInput.value = "";
                confirmInput.style.borderColor = "#ddd";
                confirmInput.style.boxShadow = "none";
                updateStrengthBar("");
            } else {
                showMessage(data.error || "Error al cambiar contraseña", true);
            }
        } catch (e) {
            showMessage("Error de conexión", true);
        } finally {
            setLoading(btnCambiarContrasena, false, originalText);
        }
    });
}

const btnEliminarMiCuenta = document.getElementById("btnEliminarMiCuenta");
if (btnEliminarMiCuenta) {
    btnEliminarMiCuenta.addEventListener("click", () => {
        showConfirmCustom(
            "Eliminar Cuenta", 
            "¿Estás completamente seguro? Esta acción es irreversible.", 
            ejecutarAutoeleminacion
        );
    });
}

async function ejecutarAutoeleminacion() {
    const btn = document.getElementById("btnEliminarMiCuenta");
    const originalText = btn.innerHTML;
    const correoUsuario = document.getElementById("correoPerfil")?.value;
    if (!correoUsuario) {
        showMessage("No se pudo obtener el correo para eliminar la cuenta", true);
        return;
    }
    setLoading(btn, true, originalText);
    try {
        const res = await fetch("/eliminar_mi_cuenta", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" }
        });
        const data = await res.json();
        if (res.ok && data.ok) {
            showMessage("Cuenta eliminada. Redirigiendo...");
            setTimeout(() => window.location.href = "/logout", 2000);
        } else {
            showMessage(data.error || "No se pudo eliminar la cuenta", true);
            setLoading(btn, false, originalText);
        }
    } catch (e) {
        showMessage("Error de red", true);
        setLoading(btn, false, originalText);
    }
}

const onlyLettersRegex = /^[A-Za-zÁÉÍÓÚáéíóúÑñ\s]+$/;
const onlyDigitsRegex = /^\d+$/;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const inputs = document.querySelectorAll('#formPerfil input, #formPerfil textarea, #formPerfil select');
inputs.forEach(input => {
    const idName = (input.id || input.name || '').toLowerCase();
    const isCorreo = idName.includes('correo');
    const isCedula = idName.includes('cedula');
    const isTelefono = idName.includes('telefono');
    const isNombre = idName === 'nombreperfil';
    const isApellido = idName === 'apellidoperfil';

    input.addEventListener('input', function() {
        let val = this.value;
        if (isCorreo) {
            val = val.replace(/\s/g, '');
        } else if (isTelefono) {
            val = val.replace(/[^0-9]/g, '');
        } else if (isCedula) {
            val = val.replace(/[^A-Za-z0-9\-]/g, '');
        } else if (isNombre || isApellido) {
            val = val.replace(/[^A-Za-zÁÉÍÓÚáéíóúÑñ\s]/g, '');
        }
        this.value = val;

        const showInvalid = (condition) => {
            if (condition) {
                this.style.borderColor = "#dc3545";
                this.style.boxShadow = "0 0 0 0.25rem rgba(220, 53, 69, 0.25)";
            } else {
                this.style.borderColor = "";
                this.style.boxShadow = "";
            }
        };

        if (isCedula) {
            showInvalid(val !== '' && val.length < 6);
        } else if (isTelefono) {
            showInvalid(val !== '' && val.length < 10);
        } else if (isNombre || isApellido) {
            showInvalid(val !== '' && !onlyLettersRegex.test(val));
        } else if (isCorreo) {
            showInvalid(val !== '' && !emailPattern.test(val));
        }
    });
});

const btnEditarPerfil = document.getElementById("btnEditarPerfil");
let _restricciones = {};
let _countdownInterval = null;

const CAMPO_ID_MAP = {
    nombre:   "nombrePerfil",
    apellido: "apellidoPerfil",
    cedula:   "cedulaPerfil",
    username: "usernamePerfil",
};

async function cargarRestricciones() {
    try {
        const r = await fetch('/perfil/restricciones');
        if (!r.ok) return;
        _restricciones = await r.json();
        _aplicarCooldowns();
        _countdownInterval = setInterval(_actualizarCountdowns, 1000);
    } catch {}
}

function _aplicarCooldowns() {
    Object.entries(_restricciones).forEach(([campo, info]) => {
        const cdEl  = document.getElementById(`cooldown-${campo}`);
        const input = document.getElementById(CAMPO_ID_MAP[campo]);
        if (info.bloqueado) {
            if (cdEl) cdEl.style.display = 'flex';
            if (input) input.classList.add('cooldown-locked');
        } else {
            if (cdEl) cdEl.style.display = 'none';
            if (input) input.classList.remove('cooldown-locked');
        }
    });
    _actualizarCountdowns();
}

function _actualizarCountdowns() {
    Object.entries(_restricciones).forEach(([campo, info]) => {
        if (!info.bloqueado || !info.disponible_en) return;
        const timerEl = document.getElementById(`countdown-${campo}`);
        if (!timerEl) return;
        const diff = new Date(info.disponible_en) - new Date();
        if (diff <= 0) {
            _restricciones[campo].bloqueado = false;
            _aplicarCooldowns();
            return;
        }
        const d = Math.floor(diff / 86400000);
        const h = Math.floor((diff % 86400000) / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        const s = Math.floor((diff % 60000) / 1000);
        timerEl.textContent = `${d}d ${String(h).padStart(2,'0')}h ${String(m).padStart(2,'0')}m ${String(s).padStart(2,'0')}s`;
    });
}

const btnActualizarPerfil = document.getElementById("btnActualizarPerfil");
if (btnEditarPerfil) {
    btnEditarPerfil.addEventListener("click", () => {
        inputs.forEach(i => {
            if (i.id === "correoPerfil" || i.readOnly) return;
            const campo = Object.entries(CAMPO_ID_MAP).find(([, id]) => id === i.id)?.[0];
            const bloqueado = campo && _restricciones[campo]?.bloqueado;
            if (!bloqueado) i.disabled = false;
        });
        const imgInput = document.getElementById("imagen_url");
        if (imgInput) imgInput.disabled = false;
        btnActualizarPerfil.style.display = "inline-block";
        btnEditarPerfil.style.display = "none";
        showMessage("Edición habilitada");
    });
}

cargarRestricciones();

document.getElementById("formPerfil").addEventListener("submit", async e => {
    e.preventDefault();
    const btn = document.getElementById("btnActualizarPerfil");
    const originalText = btn.innerHTML;
    setLoading(btn, true, originalText);
    let hasDuplicate = false;
    inputs.forEach(i => {
        const idName = (i.id || i.name || '').toLowerCase();
        if ((idName.includes('correo') || idName.includes('cedula')) && i.value) {
            const dup = allUsers.some(u => {
                if (String(u.cedula) === String(USER_ID)) return false;
                if (idName.includes('correo') && u.correo && u.correo.toLowerCase() === i.value.toLowerCase()) return true;
                if (idName.includes('cedula') && u.cedula && String(u.cedula) === i.value) return true;
                return false;
            });
            if (dup) hasDuplicate = true;
        }
    });

    const nombreField = Array.from(inputs).find(i => (i.id || i.name || '').toLowerCase() === 'nombreperfil');
    const apellidoField = Array.from(inputs).find(i => (i.id || i.name || '').toLowerCase() === 'apellidoperfil');
    const cedulaField = Array.from(inputs).find(i => (i.id || i.name || '').toLowerCase().includes('cedula'));
    const telefonoField = Array.from(inputs).find(i => (i.id || i.name || '').toLowerCase().includes('telefono'));
    const correoField = Array.from(inputs).find(i => (i.id || i.name || '').toLowerCase().includes('correo'));

    if (telefonoField && !telefonoField.disabled) {
        telefonoField.value = telefonoField.value.replace(/[^0-9]/g, '');
    }

    if (nombreField) {
        const nombreValue = nombreField.value.trim();
        if (!nombreValue || !onlyLettersRegex.test(nombreValue)) {
            showMessage("Nombre inválido", true);
            setLoading(btn, false, originalText);
            return;
        }
    }
    if (apellidoField) {
        const apellidoValue = apellidoField.value.trim();
        if (!apellidoValue || !onlyLettersRegex.test(apellidoValue)) {
            showMessage("Apellido inválido", true);
            setLoading(btn, false, originalText);
            return;
        }
    }
    if (cedulaField) {
        const cedulaValue = cedulaField.value.trim();
        if (cedulaValue !== '' && cedulaValue.length < 6) {
            showMessage("Cédula inválida (mínimo 6 caracteres)", true);
            setLoading(btn, false, originalText);
            return;
        }
    }
    if (telefonoField) {
        const telefonoValue = telefonoField.value.trim();
        if (telefonoValue !== '' && (!onlyDigitsRegex.test(telefonoValue) || telefonoValue.length < 7)) {
            showMessage("Teléfono inválido", true);
            setLoading(btn, false, originalText);
            return;
        }
    }
    if (correoField) {
        const correoValue = correoField.value.trim();
        if (correoValue !== '' && !emailPattern.test(correoValue)) {
            showMessage("Correo inválido", true);
            setLoading(btn, false, originalText);
            return;
        }
    }
    if (hasDuplicate) {
        showMessage("La cédula o correo ya están registrados", true);
        setLoading(btn, false, originalText);
        return;
    }
    const formData = new FormData(e.target);
    try {
        const res = await fetch(`/actualizar_perfil/${USER_ID}`, { method: "PUT", body: formData });
        const data = await res.json();
        if (res.ok && data.ok) {
            showMessage("Perfil actualizado");
            setTimeout(() => location.reload(), 1000);
        } else {
            let errorMsg = data.error || "Error al guardar cambios";
            if (errorMsg.includes("23505")) {
                errorMsg = errorMsg.includes("correo") ? "El correo ya existe" : "La cédula ya existe";
            }
            showMessage(errorMsg, true);
        }
    } catch (error) {
        showMessage("Error de comunicación", true);
    } finally {
        setLoading(btn, false, originalText);
    }
});

function mostrarModalDetalles(u) {
    const modalId = 'modalDetalleUsuario';
    let modalEl = document.getElementById(modalId);
    
    if (modalEl) {
        modalEl.remove();
    }

    const esGoogle = esCuentaGoogle(u);
    const rol = u.roles?.nombre_role || u.rol || 'cliente';

    const formatearFecha = (fechaStr) => {
        if (!fechaStr) return 'Sin registro';
        const fecha = new Date(fechaStr);
        if (isNaN(fecha.getTime())) return 'Fecha inválida';
        
        return fecha.toLocaleDateString('es-CO', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        }) + ' ' + fecha.toLocaleTimeString('es-CO', { 
            hour: '2-digit', 
            minute: '2-digit', 
            hour12: true 
        });
    };

    modalEl = document.createElement('div');
    modalEl.id = modalId;
    modalEl.className = 'modal fade';
    modalEl.setAttribute('tabindex', '-1');
    modalEl.innerHTML = `
        <div class="modal-dialog modal-dialog-centered">
            <div class="modal-content border-0 shadow-lg" style="border-radius: 25px; overflow: hidden;">
                <div class="modal-header border-0 pb-0 pt-4 px-4 d-flex justify-content-between align-items-start">
                    <span class="badge ${rol === 'admin' ? 'bg-danger' : 'bg-primary'} text-uppercase p-2 px-3 shadow-sm" style="border-radius: 10px; font-size: 0.7rem; letter-spacing: 1px;">
                        ${rol}
                    </span>
                    <button type="button" class="btn-close shadow-none" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body p-4 text-center">
                    <div class="position-relative d-inline-block mb-3">
                        <img src="${u.imagen_url || '/static/uploads/default_icon_profile.png'}" 
                             class="rounded-circle border shadow" 
                             width="120" height="120" 
                             style="object-fit:cover; border: 4px solid #fff !important;">
                        <div class="position-absolute bottom-0 end-0 bg-white rounded-circle shadow d-flex align-items-center justify-content-center border" 
                             style="width:35px; height:35px; transform: translate(-5px, -5px);">
                            ${esGoogle ? 
                                '<img src="/static/uploads/googlogo.ico" style="width:20px; height:20px; object-fit:contain;">' : 
                                '<i class="bi bi-envelope-at-fill text-primary" style="font-size: 1.1rem;"></i>'}
                        </div>
                    </div>
                    
                    <h4 class="fw-bold mb-1 text-dark">${u.nombre} ${u.apellido}</h4>
                    <p class="text-muted mb-4 small"><i class="bi bi-person-badge me-1"></i>ID Usuario: ${u.cedula || 'N/A'}</p>
                    
                    <div class="row g-3 text-start bg-light p-3 rounded-4 mx-1">
                        <div class="col-12">
                            <label class="small text-muted d-block mb-1">Correo Electrónico:</label>
                            <div class="d-flex align-items-center text-dark fw-medium">
                                <i class="bi bi-envelope me-2 text-secondary"></i> ${u.correo}
                            </div>
                        </div>
                        <div class="col-6">
                            <label class="small text-muted d-block mb-1">Cédula:</label>
                            <div class="d-flex align-items-center text-dark fw-medium">
                                <i class="bi bi-card-text me-2 text-secondary"></i> ${u.cedula || 'No registrada'}
                            </div>
                        </div>
                        <div class="col-6">
                            <label class="small text-muted d-block mb-1">Teléfono:</label>
                            <div class="d-flex align-items-center text-dark fw-medium">
                                <i class="bi bi-telephone me-2 text-secondary"></i> ${u.telefono || 'No registrado'}
                            </div>
                        </div>
                        <div class="col-12">
                            <label class="small text-muted d-block mb-1">Dirección:</label>
                            <div class="d-flex align-items-center text-dark fw-medium">
                                <i class="bi bi-geo-alt me-2 text-secondary"></i> ${u.direccion || 'No registrada'}
                            </div>
                        </div>
                        
                        <div class="col-12 border-top pt-3 mt-3">
                            <div class="row">
                                <div class="col-6">
                                    <label class="small text-muted d-block mb-1">Fecha de Creación:</label>
                                    <div class="d-flex align-items-center text-dark small fw-medium">
                                        <i class="bi bi-calendar-check me-2 text-secondary"></i> ${formatearFecha(u.fecha_creacion)}
                                    </div>
                                </div>
                                <div class="col-6">
                                    <label class="small text-muted d-block mb-1">Última Conexión:</label>
                                    <div class="d-flex align-items-center text-dark small fw-medium">
                                        <i class="bi bi-clock-history me-2 text-secondary"></i> ${formatearFecha(u.ultima_conexion)}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div class="col-12 border-top pt-2 mt-3">
                            <label class="small text-muted d-block mb-1">Método de Registro:</label>
                            <div class="d-flex align-items-center text-dark fw-medium">
                                <i class="bi ${esGoogle ? 'bi-google' : 'bi-envelope-at-fill'} me-2 text-secondary"></i> 
                                ${esGoogle ? 'Cuenta de Google' : 'Cuenta de E-mail'}
                            </div>
                        </div>
                    </div>
                </div>
                <div class="modal-footer border-0 p-4 pt-0">
                    <button type="button" class="btn btn-dark w-100 rounded-pill py-2 fw-bold shadow-sm" data-bs-dismiss="modal">Cerrar</button>
                </div>
            </div>
        </div>`;

    document.body.appendChild(modalEl);
    const bootstrapModal = new bootstrap.Modal(modalEl);
    bootstrapModal.show();
}

async function fetchUsuarios() {
    try {
        const res = await fetch("/listar_usuarios");
        if (res.ok) {
            let data = await res.json();
            allUsers = data.sort((a, b) => `${a.nombre} ${a.apellido}`.toLowerCase().localeCompare(`${b.nombre} ${b.apellido}`.toLowerCase()));
            filteredUsers = [...allUsers];
            renderUserTable();
        }
    } catch (e) { console.error(e); }
}

function renderUserTable() {
    const list = document.getElementById("usuariosList");
    if (!list) return;
    list.innerHTML = "";
    const totalPages = Math.max(Math.ceil(filteredUsers.length / recordsPerPage), 1);
    if (currentPage > totalPages) currentPage = totalPages;
    const start = (currentPage - 1) * recordsPerPage;
    const pageItems = filteredUsers.slice(start, start + recordsPerPage);

    const countVisibleEl = document.getElementById("countVisible");
    const countUsersEl = document.getElementById("countUsers");
    if (countVisibleEl) countVisibleEl.textContent = pageItems.length;
    if (countUsersEl) countUsersEl.textContent = filteredUsers.length;

    const renderSection = (users, title, badgeClass) => {
        if (users.length === 0) return;
        const header = document.createElement("div");
        header.className = "p-2 bg-light border-bottom border-top mt-3 mb-2 fw-bold text-uppercase small text-muted d-flex justify-content-between align-items-center";
        header.innerHTML = `<span>${title}</span> <span class="badge ${badgeClass} opacity-75">${users.length}</span>`;
        list.appendChild(header);
        users.forEach(u => {
            const div = document.createElement("div");
            div.className = "list-group-item d-flex align-items-center justify-content-between py-3 border-0 border-bottom fade-in";
            const rol = u.roles?.nombre_role || u.rol || 'cliente';
            const esYo = String(u.cedula) === String(USER_ID);
            const esGoogle = esCuentaGoogle(u);
            const metodoRegistro = esGoogle ? 'Google' : 'Email';
            div.innerHTML = `
                <div class="d-flex align-items-center">
                    <div class="position-relative">
                        <img src="${u.imagen_url || '/static/uploads/default_icon_profile.png'}" class="rounded-circle border shadow-sm me-3" width="50" height="50" style="object-fit:cover;">
                        <div class="position-absolute bottom-0 end-0 bg-white rounded-circle shadow-sm d-flex align-items-center justify-content-center border" style="width:22px; height:22px; transform: translate(-10px, 2px); padding: 2px;">
                            ${esGoogle ? '<img src="/static/uploads/googlogo.ico" style="width:14px; height:14px; object-fit:contain;">' : '<i class="bi bi-envelope-at-fill text-primary" style="font-size: 0.75rem;"></i>'}
                        </div>
                    </div>
                    <div>
                        <h6 class="mb-0 fw-bold">${u.nombre} ${u.apellido} ${esYo ? '<span class="badge bg-success ms-1" style="font-size: 0.6rem;">TÚ</span>' : ''}</h6>
                        <small class="text-muted d-flex align-items-center gap-2">
                            <span>${u.correo}</span>
                            <span class="badge ${esGoogle ? 'bg-info text-white' : 'bg-secondary text-white'}" style="font-size: 0.55rem;">${metodoRegistro}</span>
                        </small>
                    </div>
                </div>
                <div class="d-flex align-items-center gap-3">
                    <div class="d-flex gap-2">
                        <button class="btn btn-sm btn-outline-primary shadow-sm" ${esYo ? 'disabled' : ''} id="btnRol-${u.cedula}" title="Cambiar rol">
                            <i class="bi bi-shield-lock-fill"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-secondary shadow-sm" id="btnCopiar-${u.cedula}" title="Copiar correo">
                            <i class="bi bi-clipboard-fill"></i>
                        </button>
                        <button class="btn btn-sm btn-light border shadow-sm" id="btnVer-${u.cedula}" title="Ver detalles"><i class="bi bi-eye"></i></button>
                    </div>
                </div>`;
            list.appendChild(div);
            const btnVer = document.getElementById(`btnVer-${u.cedula}`);
            if (btnVer) btnVer.onclick = () => mostrarModalDetalles(u);
            const btnCopiar = document.getElementById(`btnCopiar-${u.cedula}`);
            if (btnCopiar) {
                btnCopiar.onclick = async () => {
                    try {
                        await navigator.clipboard.writeText(u.correo || '');
                        showMessage('Correo copiado al portapapeles');
                    } catch (error) {
                        showMessage('No se pudo copiar el correo', true);
                    }
                };
            }
            const btnR = document.getElementById(`btnRol-${u.cedula}`);
            if (!esYo && btnR) {
                btnR.onclick = async () => {
                    const originalText = btnR.innerHTML;
                    setLoading(btnR, true, originalText);
                    await cambiarRol(u.cedula, rol === 'admin' ? 'cliente' : 'admin');
                    setLoading(btnR, false, originalText);
                };
            }
        });
    };
    renderSection(pageItems.filter(u => (u.roles?.nombre_role || u.rol) === 'admin'), "Administradores", "bg-danger");
    renderSection(pageItems.filter(u => (u.roles?.nombre_role || u.rol) !== 'admin'), "Clientes", "bg-primary");
    renderPagination();
}

async function cambiarRol(id, nuevo) {
    if (nuevo === 'admin' && allUsers.filter(u => (u.roles?.nombre_role || u.rol) === 'admin').length >= 3) {
        showMessage("Límite de administradores alcanzado (3)", true);
        return;
    }
    try {
        const res = await fetch("/actualizar_rol_usuario", {
            method: "PUT", 
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: id, rol: nuevo })
        });
        if (res.ok) { showMessage(`Se cambió el rol a ${nuevo.toUpperCase()}`); fetchUsuarios(); }
    } catch (e) { showMessage("Error al procesar cambio", true); }
}

function renderPagination() {
    const total = Math.ceil(filteredUsers.length / recordsPerPage);
    const nav = document.getElementById("paginationControls");
    if (!nav) return;
    nav.innerHTML = "";
    if (total <= 1) return;
    for (let i = 1; i <= total; i++) {
        const li = document.createElement("li");
        li.className = `page-item ${i === currentPage ? 'active' : ''}`;
        li.innerHTML = `<a class="page-link shadow-sm border-0 mx-1 rounded" href="#">${i}</a>`;
        li.onclick = (e) => { e.preventDefault(); currentPage = i; renderUserTable(); };
        nav.appendChild(li);
    }
}

(function() {
    window.history.pushState(null, "", window.location.href);
    window.onpopstate = () => window.history.pushState(null, "", window.location.href);
    window.onpageshow = (event) => { if (event.persisted || (window.performance && window.performance.navigation.type === 2)) window.location.reload(); };
})();

document.addEventListener("DOMContentLoaded", () => {
    const inputImagen = document.getElementById("imagen_url");
    if (inputImagen) {
        inputImagen.addEventListener("change", function () {
            const file = this.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const imgPerfil = document.querySelector("#formPerfil img");
                    if (imgPerfil) imgPerfil.src = e.target.result;
                };
                reader.readAsDataURL(file);
            }
        });
    }
    if (typeof USER_ROLE !== 'undefined' && USER_ROLE === 'admin') {
        const searchInput = document.getElementById('userSearch');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                const t = e.target.value.toLowerCase();
                filteredUsers = allUsers.filter(u => (u.nombre + " " + u.apellido).toLowerCase().includes(t) || u.correo.toLowerCase().includes(t) || (u.cedula && String(u.cedula).includes(t)));
                currentPage = 1;
                renderUserTable();
            });
        }
        fetchUsuarios();
    }
});

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {navigator.serviceWorker.register('/static/js/workers/service-worker-perfil.js') .then(() => console.log('SW OK')) .catch(err => console.error('SW Error', err));});
}