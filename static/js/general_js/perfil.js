const toastContainer = document.getElementById('toastContainer');
let allUsers = [];
let filteredUsers = [];
let currentPage = 1;
const recordsPerPage = 7;

function showMessage(msg, isError = false) {
    const toastEl = document.createElement('div');
    toastEl.className = `toast show align-items-center text-white ${isError ? 'bg-danger' : 'bg-dark'} border-0 mb-2 fade-in`;
    toastEl.style.minWidth = "250px";
    toastEl.innerHTML = `
        <div class="d-flex">
            <div class="toast-body"><i class="bi ${isError ? 'bi-exclamation-triangle' : 'bi-check-circle'} me-2"></i>${msg}</div>
            <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
        </div>`;
    toastContainer.appendChild(toastEl);
    setTimeout(() => toastEl.remove(), 4000);
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

const passInput = document.getElementById("nuevaContrasena");
const confirmInput = document.getElementById("confirmarContrasena");

function validarPass() {
    if (typeof USER_AUTH_GOOGLE !== 'undefined' && USER_AUTH_GOOGLE) return;
    const p = passInput.value;
    const c = confirmInput.value;
    if (!c) {
        confirmInput.style.borderColor = "#ddd";
        return;
    }
    if (p === c && p !== "") {
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
        if (!p || p !== c) {
            showMessage("Las contraseñas no coinciden o están vacías", true);
            return;
        }
        const originalText = btnCambiarContrasena.innerHTML;
        setLoading(btnCambiarContrasena, true, originalText);
        try {
            const res = await fetch("/cambiar_contrasena_perfil", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ nueva_contrasena: p })
            });
            const data = await res.json();
            if (res.ok && data.ok) {
                showMessage("Contraseña actualizada correctamente");
                passInput.value = "";
                confirmInput.value = "";
                confirmInput.style.borderColor = "#ddd";
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

const btnEditarPerfil = document.getElementById("btnEditarPerfil");
const btnActualizarPerfil = document.getElementById("btnActualizarPerfil");
const inputs = document.querySelectorAll('#formPerfil input, #formPerfil textarea, #formPerfil select');

inputs.forEach(input => {
    const idName = (input.id || input.name || '').toLowerCase();
    const isCorreo = idName.includes('correo');
    const isCedula = idName.includes('cedula');

    if (isCorreo || isCedula) {
        input.addEventListener('input', function() {
            let val = this.value.toLowerCase();
            if (isCorreo) {
                val = val.replace(/[^a-z0-9.\-@]/g, '');
            } else {
                val = val.replace(/[^a-z0-9.\-]/g, '');
            }
            this.value = val;

            if (allUsers.length > 0) {
                const isDup = allUsers.some(u => {
                    if (String(u.id_cliente) === String(USER_ID)) return false;
                    if (isCorreo && u.correo && u.correo.toLowerCase() === val) return true;
                    if (isCedula && u.cedula && String(u.cedula).toLowerCase() === val) return true;
                    return false;
                });
                if (isDup && val !== '') {
                    this.style.borderColor = "#dc3545";
                    this.style.boxShadow = "0 0 0 0.25rem rgba(220, 53, 69, 0.25)";
                } else {
                    this.style.borderColor = "";
                    this.style.boxShadow = "";
                }
            }
        });
    }
});

if (btnEditarPerfil) {
    btnEditarPerfil.addEventListener("click", () => {
        inputs.forEach(i => {
            if (i.id !== "correoPerfil" && !i.readOnly) i.disabled = false;
        });
        document.getElementById("imagen_url").disabled = false;
        btnActualizarPerfil.style.display = "inline-block";
        btnEditarPerfil.style.display = "none";
        showMessage("Edición habilitada");
    });
}

document.getElementById("formPerfil").addEventListener("submit", async e => {
    e.preventDefault();
    const btn = document.getElementById("btnActualizarPerfil");
    const originalText = btn.innerHTML;
    setLoading(btn, true, originalText);

    let hasDuplicate = false;
    if (allUsers.length > 0) {
        inputs.forEach(i => {
            const idName = (i.id || i.name || '').toLowerCase();
            const isC = idName.includes('correo');
            const isCed = idName.includes('cedula');
            if ((isC || isCed) && i.value) {
                const dup = allUsers.some(u => {
                    if (String(u.id_cliente) === String(USER_ID)) return false;
                    if (isC && u.correo && u.correo.toLowerCase() === i.value.toLowerCase()) return true;
                    if (isCed && u.cedula && String(u.cedula).toLowerCase() === i.value.toLowerCase()) return true;
                    return false;
                });
                if (dup) hasDuplicate = true;
            }
        });
    }

    if (hasDuplicate) {
        showMessage("La cédula o correo ya están registrados", true);
        setLoading(btn, false, originalText);
        return;
    }

    inputs.forEach(i => i.disabled = false);
    const formData = new FormData(e.target);
    try {
        const res = await fetch(`/actualizar_perfil/${USER_ID}`, { 
            method: "PUT", 
            body: formData 
        });
        const data = await res.json();
        if (res.ok && data.ok) {
            showMessage("Perfil actualizado");
            setTimeout(() => location.reload(), 1000);
        } else {
            showMessage(data.error || "Error al guardar cambios", true);
            inputs.forEach(i => {
                if (i.id === "correoPerfil" || i.readOnly) i.disabled = true;
            });
        }
    } catch (error) {
        showMessage("Error de comunicación", true);
    } finally {
        setLoading(btn, false, originalText);
    }
});

async function eliminarUsuarioPorCorreo() {
    const input = document.getElementById('correoEliminar');
    if (!input) return;
    
    const correo = input.value.trim().toLowerCase();
    if (!correo) {
        showMessage("Ingrese el correo para eliminar", true);
        return;
    }
    
    const btn = document.getElementById("btnEliminarUsuario");
    const originalText = btn.innerHTML;
    setLoading(btn, true, originalText);
    
    try {
        const res = await fetch("/eliminar_usuario_admin", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ correo: correo })
        });
        const data = await res.json();
        if (res.ok && data.ok) {
            showMessage("Usuario eliminado correctamente");
            input.value = "";
            fetchUsuarios();
        } else {
            showMessage(data.error || "Error al eliminar", true);
        }
    } catch (error) {
        showMessage("Error de conexión", true);
    } finally {
        setLoading(btn, false, originalText);
    }
}

const btnEliminar = document.getElementById("btnEliminarUsuario");
if (btnEliminar) btnEliminar.addEventListener("click", eliminarUsuarioPorCorreo);

async function fetchUsuarios() {
    try {
        const res = await fetch("/listar_usuarios");
        if (res.ok) {
            let data = await res.json();
            allUsers = data.sort((a, b) => {
                const nombreA = `${a.nombre} ${a.apellido}`.toLowerCase();
                const nombreB = `${b.nombre} ${b.apellido}`.toLowerCase();
                return nombreA.localeCompare(nombreB);
            });
            filteredUsers = [...allUsers];
            renderUserTable();
        }
    } catch (e) {
        console.error("Error fetching users", e);
    }
}

function renderUserTable() {
    const list = document.getElementById("usuariosList");
    if (!list) return;
    list.innerHTML = "";

    const start = (currentPage - 1) * recordsPerPage;
    const pageItems = filteredUsers.slice(start, start + recordsPerPage);

    const admins = pageItems.filter(u => (u.roles?.nombre_role || u.rol) === 'admin');
    const clientes = pageItems.filter(u => (u.roles?.nombre_role || u.rol) !== 'admin');

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
            const esYo = String(u.id_cliente) === String(USER_ID);
            const esGoogle = u.google_id || u.metodo_auth === 'google' || (u.correo && u.correo.includes('gmail.com'));

            div.innerHTML = `
                <div class="d-flex align-items-center">
                    <div class="position-relative">
                        <img src="${u.imagen_url || '/static/default_icon_profile.png'}" class="rounded-circle border shadow-sm me-3" width="50" height="50" style="object-fit:cover;">
                        <div class="position-absolute bottom-0 end-0 bg-white rounded-circle shadow-sm d-flex align-items-center justify-content-center border" style="width:22px; height:22px; transform: translate(-10px, 2px); padding: 2px;">
                            ${esGoogle ? '<img src="/static/uploads/googlogo.ico" style="width:14px; height:14px; object-fit:contain;">' : '<i class="bi bi-envelope-at-fill text-primary" style="font-size: 0.75rem;"></i>'}
                        </div>
                    </div>
                    <div>
                        <h6 class="mb-0 fw-bold">${u.nombre} ${u.apellido} ${esYo ? '<span class="badge bg-success ms-1" style="font-size: 0.6rem;">TÚ</span>' : ''}</h6>
                        <small class="text-muted">${u.correo}</small>
                    </div>
                </div>
                <div class="d-flex align-items-center gap-3">
                    <div class="d-flex gap-2">
                        <button class="btn btn-sm btn-outline-dark shadow-sm" ${esYo ? 'disabled' : ''} id="btnRol-${u.id_cliente}"><i class="bi bi-person-up"></i></button>
                        <button class="btn btn-sm btn-light border shadow-sm" id="btnVer-${u.id_cliente}"><i class="bi bi-eye"></i></button>
                    </div>
                </div>`;
            list.appendChild(div);
            
            document.getElementById(`btnVer-${u.id_cliente}`).onclick = () => mostrarModalDetalles(u);
            const btnR = document.getElementById(`btnRol-${u.id_cliente}`);
            if (!esYo && btnR) {
                btnR.onclick = async () => {
                    const originalText = btnR.innerHTML;
                    setLoading(btnR, true, originalText);
                    await cambiarRol(u.id_cliente, rol === 'admin' ? 'cliente' : 'admin');
                    setLoading(btnR, false, originalText);
                };
            }
        });
    };

    renderSection(admins, "Administradores", "bg-danger");
    renderSection(clientes, "Clientes", "bg-primary");

    document.getElementById("countVisible").textContent = pageItems.length;
    document.getElementById("countUsers").textContent = filteredUsers.length;
    renderPagination();
}

function mostrarModalDetalles(u) {
    let modalEl = document.getElementById('imgModal');
    if (!modalEl) {
        const html = `
            <div class="modal fade" id="imgModal" tabindex="-1">
                <div class="modal-dialog modal-dialog-centered">
                    <div class="modal-content border-0 shadow-lg">
                        <div class="modal-header bg-dark text-white border-0">
                            <h5 class="modal-title fw-bold"><i class="bi bi-person-badge me-2"></i>Expediente de Usuario</h5>
                            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body p-0" id="modalDetallesBody"></div>
                        <div class="modal-footer border-0 p-3">
                            <button type="button" class="btn btn-outline-dark w-100 fw-bold" data-bs-dismiss="modal">Cerrar</button>
                        </div>
                    </div>
                </div>
            </div>`;
        document.body.insertAdjacentHTML('beforeend', html);
        modalEl = document.getElementById('imgModal');
    }
    const rol = u.roles?.nombre_role || u.rol || 'cliente';
    const esGoogle = u.google_id || u.metodo_auth === 'google' || (u.correo && u.correo.includes('gmail.com'));
    const fecha = u.fecha_creacion ? new Date(u.fecha_creacion).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' }) : 'No disponible';

    document.getElementById("modalDetallesBody").innerHTML = `
        <div class="text-center p-4 bg-light">
            <div class="position-relative d-inline-block">
                <img src="${u.imagen_url || '/static/default_icon_profile.png'}" class="rounded-circle border border-4 border-white shadow mb-3" width="120" height="120" style="object-fit:cover;">
                <div class="position-absolute top-0 end-0 bg-white rounded-circle shadow-sm border p-1" style="width:30px; height:30px; transform: translate(5px, 5px);">
                    ${esGoogle ? `<img src="/static/uploads/googlogo.ico" style="width:100%; height:100%; object-fit:contain;">` : '<i class="bi bi-envelope-at-fill text-primary" style="font-size: 1rem;"></i>'}
                </div>
            </div>
            <h4 class="fw-bold mb-1">${u.nombre} ${u.apellido}</h4>
            <span class="badge rounded-pill ${rol === 'admin' ? 'bg-danger' : 'bg-primary'} px-3 mb-2">${rol.toUpperCase()}</span>
            <div class="text-muted small">ID: ${u.id_cliente}</div>
        </div>
        <div class="p-4">
            <div class="row g-3">
                <div class="col-12 mb-2">
                    <small class="text-muted fw-bold text-uppercase d-block mb-1" style="font-size: 0.7rem;">Correo Electrónico</small>
                    <div class="p-2 bg-light rounded border fw-bold text-dark">${u.correo}</div>
                </div>
                <div class="col-6">
                    <small class="text-muted fw-bold text-uppercase d-block mb-1" style="font-size: 0.7rem;">Cédula / Documento</small>
                    <div class="fw-bold"><i class="bi bi-card-text me-2"></i>${u.cedula || '---'}</div>
                </div>
                <div class="col-6">
                    <small class="text-muted fw-bold text-uppercase d-block mb-1" style="font-size: 0.7rem;">Teléfono</small>
                    <div class="fw-bold"><i class="bi bi-telephone me-2"></i>${u.telefono || '---'}</div>
                </div>
                <div class="col-12">
                    <small class="text-muted fw-bold text-uppercase d-block mb-1" style="font-size: 0.7rem;">Dirección Física</small>
                    <div class="fw-bold text-wrap"><i class="bi bi-geo-alt me-2"></i>${u.direccion || 'No registrada'}</div>
                </div>
                <div class="col-6">
                    <small class="text-muted fw-bold text-uppercase d-block mb-1" style="font-size: 0.7rem;">Método de Pago</small>
                    <span class="badge bg-dark px-2">${u.metodo_pago || 'Efectivo'}</span>
                </div>
                <div class="col-6 text-end">
                    <small class="text-muted fw-bold text-uppercase d-block mb-1" style="font-size: 0.7rem;">Fecha de Creación</small>
                    <small class="fw-bold text-muted">${fecha}</small>
                </div>
            </div>
        </div>`;
    new bootstrap.Modal(modalEl).show();
}

async function cambiarRol(id, nuevo) {
    if (nuevo === 'admin' && allUsers.filter(u => (u.roles?.nombre_role || u.rol) === 'admin').length >= 3) {
        showMessage("Límite de administradores alcanzado (3)", true);
        return;
    }
    try {
        const res = await fetch("/actualizar_rol_usuario", {
            method: "PUT", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: id, rol: nuevo })
        });
        if (res.ok) { 
            showMessage(`Se cambió el rol a ${nuevo.toUpperCase()}`); 
            fetchUsuarios(); 
        }
    } catch (e) {
        showMessage("Error al procesar cambio", true);
    }
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

document.addEventListener("DOMContentLoaded", () => {
    const inputImagen = document.getElementById("imagen_url");
    if (inputImagen) {
        inputImagen.addEventListener("change", function () {
            const file = this.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function (e) {
                    const imgPerfil = document.querySelector("#formPerfil img");
                    if (imgPerfil) imgPerfil.src = e.target.result;
                }
                reader.readAsDataURL(file);
            }
        });
    }

    if (typeof USER_ROLE !== 'undefined' && USER_ROLE === 'admin') {
        const searchInput = document.getElementById('userSearch');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                const t = e.target.value.toLowerCase();
                filteredUsers = allUsers.filter(u => 
                    (u.nombre + " " + u.apellido).toLowerCase().includes(t) || 
                    u.correo.toLowerCase().includes(t) ||
                    (u.cedula && String(u.cedula).includes(t))
                );
                currentPage = 1;
                renderUserTable();
            });
        }
        fetchUsuarios();
    }
});