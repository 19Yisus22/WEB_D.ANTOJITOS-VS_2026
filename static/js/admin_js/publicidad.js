let carruselIndex = 0, seccionIndex = 0, cintaIndex = 0, inicioCintaIndex = 0;
let procesamientoEnCurso = false;

async function actualizarAlmacenamiento() {
    try {
        const res = await fetch(`/cloudinary_storage_info?t=${Date.now()}`);
        if (!res.ok) return;
        const data = await res.json();
        const circle = document.getElementById("storageCircle");
        const text = document.getElementById("storageText");
        if (!circle || !text) return;
        const used = parseFloat(data.used_gb) || 0;
        const limit = parseFloat(data.limit_gb) || 25;
        const percent = Math.min((used / limit) * 100, 100);
        const circumference = 2 * Math.PI * circle.r.baseVal.value;
        circle.style.strokeDasharray = `${circumference}`;
        circle.style.strokeDashoffset = circumference - (percent / 100) * circumference;
        const label = used < 0.1 ? (used * 1024).toFixed(1) + " MB" : used.toFixed(2) + " GB";
        text.textContent = `${label} / ${limit} GB`;
        const wrapper = document.getElementById("storageWrapper");
        if (wrapper) {
            const tooltipText = `Uso: ${label} / ${limit} GB (${percent.toFixed(1)}%)`;
            wrapper.setAttribute("title", tooltipText);
            const tooltip = bootstrap.Tooltip.getInstance(wrapper) || new bootstrap.Tooltip(wrapper);
            tooltip.setContent({ ".tooltip-inner": tooltipText });
        }
    } catch (e) {
        console.error("Error al obtener storage:", e);
    }
}

function toast(msg, tipo = "success") {
    mostrarAlerta(msg, tipo === "danger");
}

async function comprimirImagen(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement("canvas");
                const MAX_WIDTH = 1920, MAX_HEIGHT = 1080;
                let width = img.width, height = img.height;
                if (width > height) {
                    if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
                } else {
                    if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; }
                }
                canvas.width = width;
                canvas.height = height;
                canvas.getContext("2d").drawImage(img, 0, 0, width, height);
                const quality = file.size > 5 * 1024 * 1024 ? 0.75 : file.size > 1024 * 1024 ? 0.80 : 0.85;
                canvas.toBlob((blob) => {
                    resolve(new File([blob], file.name.replace(/\.[^.]+$/, ".webp"), { type: "image/webp", lastModified: Date.now() }));
                }, "image/webp", quality);
            };
        };
    });
}

function actualizarPreview() {
    const pCar = document.querySelector("#previewCarrusel .carousel-inner");
    if (pCar) {
        pCar.innerHTML = "";
        const itemsCar = document.querySelectorAll("#carruselContainer .section-preview");
        itemsCar.forEach((div, i) => {
            const item = document.createElement("div");
            item.className = "carousel-item" + (i === 0 ? " active" : "");
            const img = div.querySelector("img").src;
            const tit = div.querySelector(".t-tit").value;
            const des = div.querySelector(".t-des")?.value || "";
            item.innerHTML = `
                <div class="d-block w-100 position-relative overflow-hidden" style="height:450px;">
                    <div class="position-absolute w-100 h-100" style="background:url('${img}') center/cover;filter:blur(20px);transform:scale(1.1);z-index:1;"></div>
                    <img src="${img}" class="position-relative d-block h-100 mx-auto shadow-lg" style="object-fit:contain;z-index:2;">
                </div>
                <div class="carousel-caption rounded-4 p-3 mb-3 mx-auto" style="max-width:80%;z-index:3;">
                    <h5 class="mb-1 fw-bold text-uppercase" style="text-shadow:2px 2px 10px rgba(0,0,0,0.8);">${tit}</h5>
                    <p class="small mb-0" style="text-shadow:1px 1px 8px rgba(0,0,0,0.8);">${des}</p>
                </div>`;
            pCar.appendChild(item);
        });
        if (itemsCar.length > 0) {
            bootstrap.Carousel.getOrCreateInstance(document.querySelector("#previewCarrusel")).to(0);
        }
    }

    const pCinta = document.getElementById("previewCintaMarquee");
    if (pCinta) {
        pCinta.innerHTML = "";
        let trackContent = "";
        document.querySelectorAll("#cintaContainer .section-preview").forEach(div => {
            const img = div.querySelector("img").src;
            const tit = div.querySelector(".t-tit").value;
            trackContent += `
                <div class="promo-item">
                    <div class="promo-item-image"><img src="${img}" alt="${tit}"></div>
                    <span class="promo-item-text">${tit}</span>
                    <div class="promo-item-separator"></div>
                </div>`;
        });
        if (trackContent) {
            pCinta.innerHTML = trackContent + trackContent + trackContent;
            pCinta.classList.remove("paused");
        }
    }

    const pSec = document.getElementById("previewSecciones");
    if (pSec) {
        pSec.innerHTML = "";
        document.querySelectorAll("#seccionesContainer .section-preview").forEach(div => {
            const d = document.createElement("div");
            d.className = "col-4 col-md-2 text-center mb-4";
            const img = div.querySelector("img").src;
            const tit = div.querySelector(".t-tit").value;
            d.innerHTML = `
                <div style="width:65px;height:65px;margin:0 auto;background:#f8f9fa;" class="rounded-circle overflow-hidden shadow-sm mb-2 border">
                    <img src="${img}" class="w-100 h-100" style="object-fit:contain;">
                </div>
                <div class="small fw-bold text-dark text-truncate px-1">${tit}</div>`;
            pSec.appendChild(d);
        });
    }
}

async function crearNotificacion() {
    if (procesamientoEnCurso) return;
    const t = document.getElementById("tituloNotificacion");
    const d = document.getElementById("descNotificacion");
    const a = document.getElementById("archivoNotificacion");
    const previewImg = document.getElementById("previewNotificacionImg");
    if (!t.value.trim() || !d.value.trim()) { toast("¡Título y mensaje son obligatorios!", true); return; }
    procesamientoEnCurso = true;
    const formData = new FormData();
    formData.append("titulo", t.value);
    formData.append("descripcion", d.value);
    if (a.files[0]) formData.append("archivo", await comprimirImagen(a.files[0]));
    try {
        const res = await fetch("/api/admin/notificaciones", { method: "POST", body: formData });
        const data = await res.json();
        if (data.ok) {
            toast("¡Notificación publicada con éxito!");
            t.value = ""; d.value = ""; a.value = "";
            if (previewImg) previewImg.src = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAJQAAACUCAYAAAB1OacDAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAJBSURBVHgB7d0xbhNREIDh90YpSClpSInS06ByAnp6SByBk9ByAnp6ChonSInS06ByApSClpSClpSChv9vYScbe9be9Xp3Z76Pst6stZun8f72zZunMREp6vUf97ZOfn64fP9scfH+mYgG9fbt+6f7n8/vXrz6eC6isfrz5p8mIkW9e/dhIu6IKOp8+SyiqPP7DyIa9PHe2XfTjMREpKgzmYh9Ihp0/vEisS+isfrtHxEfXkU06uXFpyciGrW9efZ0Ihp0t3k6EQ26ubqbiCtiIjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIynL17/wEunS4O3C+hNwAAAABJRU5ErkJggg==";
            cargarAlertasActivas();
        } else {
            toast(data.error || "Error al procesar", "danger");
        }
    } catch {
        toast("Error de conexión", "danger");
    } finally {
        procesamientoEnCurso = false;
    }
}

async function toggleEstadoAlerta(id, estado) {
    if (!id || id === "undefined" || id === "null") return;
    try {
        const res = await fetch(`/api/admin/notificaciones/estado/${id}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ estado })
        });
        const data = await res.json();
    if (data.ok) toast(estado ? "¡Alerta activada!" : "¡Alerta desactivada!", "info");
        else { toast("Error en servidor", "danger"); cargarAlertasActivas(); }
    } catch {
        toast("Error de red", "danger");
        cargarAlertasActivas();
    }
}

async function cargarAlertasActivas() {
    const cont = document.getElementById("contenedorAlertas");
    if (!cont) return;
    try {
        const res = await fetch("/api/admin/notificaciones");
        const alertas = await res.json();
        cont.innerHTML = alertas.length ? "" : '<p class="text-muted small py-2 text-center">No hay alertas activas</p>';
        alertas.forEach(alerta => {
            const div = document.createElement("div");
            div.className = "alert-admin-lista mb-2 d-flex align-items-center justify-content-between p-2 border rounded";
            div.innerHTML = `
                <div class="d-flex align-items-center gap-2 overflow-hidden">
                    ${alerta.imagen_url ? `<img src="${alerta.imagen_url}" style="width:35px;height:35px;border-radius:4px;object-fit:cover;">` : '<i class="bi bi-bell p-2"></i>'}
                    <div class="text-truncate">
                        <div class="small text-truncate fw-bold">${alerta.titulo}</div>
                        <div class="extra-small text-muted text-truncate">${alerta.descripcion}</div>
                    </div>
                </div>
                <div class="d-flex align-items-center gap-3">
                    <div class="form-check form-switch">
                        <input class="form-check-input" type="checkbox" role="switch" ${alerta.estado ? "checked" : ""} onchange="toggleEstadoAlerta('${alerta.id_publicidad}', this.checked)">
                    </div>
                    <button class="btn btn-sm text-danger border-0" onclick="eliminarAlerta('${alerta.id_publicidad}')">
                        <i class="bi bi-trash3-fill"></i>
                    </button>
                </div>`;
            cont.appendChild(div);
        });
    } catch {}
}

async function eliminarAlerta(id) {
    if (!id || id === "undefined") return toast("ID no válido", "danger");
    mostrarConfirmacionApp("Eliminar Alerta", "¿Seguro que quieres eliminar esta alerta?", async () => {
        try {
            const res = await fetch(`/api/admin/notificaciones/${id}`, { method: "DELETE" });
            const data = await res.json();
            if (data.ok) { toast("¡Alerta eliminada con éxito!", true); cargarAlertasActivas(); }
            else toast("Error al eliminar", "danger");
        } catch {
            toast("Error de conexión", "danger");
        }
    });
}

function agregarCarrusel(url = "", titulo = "", desc = "", id = "") {
    const idx = carruselIndex++;
    const div = document.createElement("div");
    div.className = "col-12 section-preview mb-4";
    div.draggable = true;
    div.dataset.index = idx;
    div.dataset.dbId = id;
    div.dataset.cambioImagen = "false";
    div.innerHTML = `
        <div class="drag-handle"><i class="bi bi-grip-vertical fs-3"></i></div>
        <div class="section-content row g-3 m-0 w-100 align-items-center">
            <div class="col-md-3">
                <div class="preview-img-box mb-2 border rounded overflow-hidden shadow-sm d-flex align-items-center justify-content-center" style="height:120px;background:#f1f3f5;position:relative;">
                    <img src="${url}" class="w-100 h-100 ${!url ? "d-none" : ""}" style="object-fit:cover;"
                        onload="this.classList.remove('d-none');this.nextElementSibling.classList.add('d-none')"
                        onerror="this.classList.add('d-none');this.nextElementSibling.classList.remove('d-none')">
                    <div class="placeholder-icon text-center text-muted ${url ? "d-none" : ""}">
                        <i class="bi bi-image-fill" style="font-size:2.5rem;opacity:0.4;"></i>
                        <div style="font-size:0.6rem;font-weight:800;text-transform:uppercase;letter-spacing:0.5px;margin-top:-5px;">Sin Imagen</div>
                    </div>
                </div>
                <input type="file" class="form-control form-control-sm mt-2 shadow-none" accept="image/*" onchange="cambioImg(this)">
            </div>
            <div class="col-md-9">
                <div class="pe-3">
                    <label class="extra-small fw-bold text-muted text-uppercase mb-1">Título</label>
                    <input type="text" class="form-control mb-2 t-tit fw-bold" placeholder="Título..." value="${titulo}" oninput="actualizarPreview()">
                    <label class="extra-small fw-bold text-muted text-uppercase mb-1">Descripción</label>
                    <textarea class="form-control t-des" placeholder="Descripción..." rows="2" oninput="actualizarPreview()">${desc}</textarea>
                </div>
                <div class="d-flex justify-content-end mt-3">
                    <button class="btn btn-sm btn-danger px-4 rounded-pill" onclick="borrarSec(this)"><i class="bi bi-trash-fill me-2"></i> ELIMINAR</button>
                </div>
            </div>
        </div>`;
    document.getElementById("carruselContainer").appendChild(div);
    actualizarPreview();
}

function agregarSeccion(url = "", titulo = "", id = "") {
    const idx = seccionIndex++;
    const div = document.createElement("div");
    div.className = "col-12 section-preview mb-3";
    div.draggable = true;
    div.dataset.index = idx;
    div.dataset.dbId = id;
    div.dataset.cambioImagen = "false";
    div.innerHTML = `
        <div class="drag-handle"><i class="bi bi-grip-vertical fs-3"></i></div>
        <div class="section-content d-flex align-items-center gap-4 w-100 p-2">
            <div class="preview-img-box shadow-sm border d-flex align-items-center justify-content-center" style="width:90px;height:90px;border-radius:50%;min-width:90px;overflow:hidden;background:#f1f3f5;position:relative;">
                <img src="${url}" class="w-100 h-100 ${!url ? "d-none" : ""}" style="object-fit:cover;"
                    onload="this.classList.remove('d-none');this.nextElementSibling.classList.add('d-none')"
                    onerror="this.classList.add('d-none');this.nextElementSibling.classList.remove('d-none')">
                <div class="placeholder-icon text-center text-muted ${url ? "d-none" : ""}">
                    <i class="bi bi-image" style="font-size:1.8rem;opacity:0.4;"></i>
                </div>
            </div>
            <div class="flex-grow-1">
                <div class="row g-2 align-items-end">
                    <div class="col-md-5"><label class="extra-small fw-bold text-muted text-uppercase">Imagen</label><input type="file" class="form-control form-control-sm" accept="image/*" onchange="cambioImg(this)"></div>
                    <div class="col-md-7"><label class="extra-small fw-bold text-muted text-uppercase">Nombre</label><input type="text" class="form-control t-tit fw-bold" placeholder="Nombre..." value="${titulo}" oninput="actualizarPreview()"></div>
                </div>
            </div>
            <button class="btn btn-outline-danger border-0 flex-shrink-0" onclick="borrarSec(this)"><i class="bi bi-trash3-fill fs-5"></i></button>
        </div>`;
    document.getElementById("seccionesContainer").appendChild(div);
    actualizarPreview();
}

function agregarCinta(url = "", titulo = "", id = "") {
    const idx = cintaIndex++;
    const div = document.createElement("div");
    div.className = "col-12 section-preview mb-2";
    div.draggable = true;
    div.dataset.index = idx;
    div.dataset.dbId = id;
    div.dataset.cambioImagen = "false";
    div.innerHTML = `
        <div class="drag-handle"><i class="bi bi-grip-vertical fs-4"></i></div>
        <div class="section-content d-flex align-items-center gap-3 w-100 py-2 px-3 border rounded">
            <div class="preview-img-box shadow-sm border d-flex align-items-center justify-content-center" style="width:50px;height:50px;border-radius:50%;min-width:50px;overflow:hidden;background:#f1f3f5;position:relative;">
                <img src="${url}" class="w-100 h-100 ${!url ? "d-none" : ""}" style="object-fit:cover;"
                    onload="this.classList.remove('d-none');if(this.nextElementSibling)this.nextElementSibling.classList.add('d-none');"
                    onerror="this.classList.add('d-none');if(this.nextElementSibling)this.nextElementSibling.classList.remove('d-none');">
                <div class="placeholder-icon text-muted ${url ? "d-none" : ""}">
                    <i class="bi bi-card-image" style="font-size:1.2rem;opacity:0.5;"></i>
                </div>
            </div>
            <div class="flex-grow-1">
                <div class="row g-2 align-items-center">
                    <div class="col-md-5"><input type="file" class="form-control form-control-sm" accept="image/*" onchange="cambioImg(this)"></div>
                    <div class="col-md-7"><input type="text" class="form-control form-control-sm t-tit fw-bold" placeholder="Texto..." value="${titulo}" oninput="actualizarPreview()"></div>
                </div>
            </div>
            <button class="btn btn-sm text-danger border-0" onclick="borrarSec(this)"><i class="bi bi-x-circle-fill fs-5"></i></button>
        </div>`;
    document.getElementById("cintaContainer").appendChild(div);
    actualizarPreview();
}

function agregarInicioCinta(url = "", titulo = "", id = "") {
    const idx = inicioCintaIndex++;
    const div = document.createElement("div");
    div.className = "col-12 section-preview mb-2";
    div.draggable = true;
    div.dataset.index = idx;
    div.dataset.dbId = id;
    div.dataset.cambioImagen = "false";
    div.innerHTML = `
        <div class="drag-handle"><i class="bi bi-grip-vertical fs-4"></i></div>
        <div class="section-content d-flex align-items-center gap-3 w-100 py-2 px-3 border rounded" style="background:#fff8f0;">
            <div class="preview-img-box shadow-sm border d-flex align-items-center justify-content-center" style="width:56px;height:56px;border-radius:50%;min-width:56px;overflow:hidden;background:#fff3e0;position:relative;">
                <img src="${url}" class="w-100 h-100 ${!url ? "d-none" : ""}" style="object-fit:cover;"
                    onload="this.classList.remove('d-none');if(this.nextElementSibling)this.nextElementSibling.classList.add('d-none');"
                    onerror="this.classList.add('d-none');if(this.nextElementSibling)this.nextElementSibling.classList.remove('d-none');">
                <div class="placeholder-icon text-muted ${url ? "d-none" : ""}">
                    <i class="bi bi-image" style="font-size:1.4rem;opacity:0.5;color:#d35400;"></i>
                </div>
            </div>
            <div class="flex-grow-1">
                <div class="row g-2 align-items-center">
                    <div class="col-md-5"><input type="file" class="form-control form-control-sm" accept="image/*" onchange="cambioImg(this)"></div>
                    <div class="col-md-7"><input type="text" class="form-control form-control-sm t-tit fw-bold" placeholder="Nombre (ej: Nequi)..." value="${titulo}"></div>
                </div>
            </div>
            <button class="btn btn-sm text-danger border-0" onclick="borrarSec(this)"><i class="bi bi-x-circle-fill fs-5"></i></button>
        </div>`;
    document.getElementById("inicioCintaContainer").appendChild(div);
}

async function guardarMarketing() {
    if (procesamientoEnCurso) return;
    const btn = document.getElementById("btnGuardarMarketing");
    const originalText = btn.innerHTML;
    procesamientoEnCurso = true;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> GUARDANDO...';
    const progressContainer = document.getElementById("progressContainer");
    const progressBar = progressContainer.querySelector(".progress-bar");
    const progressText = document.getElementById("progressText");
    progressContainer.classList.remove("d-none");
    progressBar.style.width = "0%";
    progressText.textContent = "Preparando archivos...";
    const formData = new FormData();
    let totalFiles = 0, uploadedFiles = 0;

    const extraerSeccion = async (containerId, metaKey, filePrefix) => {
        const metadata = [];
        const items = document.querySelectorAll(`#${containerId} .section-preview`);
        for (let index = 0; index < items.length; index++) {
            const div = items[index];
            const fileInput = div.querySelector("input[type='file']");
            const imgEl = div.querySelector("img");
            const urlActual = (imgEl && imgEl.src && !imgEl.src.startsWith('data:')) ? imgEl.src : '';
            if (fileInput.files[0]) {
                totalFiles++;
                formData.append(filePrefix, await comprimirImagen(fileInput.files[0]));
                uploadedFiles++;
                progressBar.style.width = `${(uploadedFiles / totalFiles) * 50}%`;
                progressText.textContent = `Comprimiendo ${uploadedFiles}/${totalFiles} imágenes...`;
            }
            metadata.push({
                index,
                titulo: div.querySelector(".t-tit")?.value || "",
                descripcion: div.querySelector(".t-des")?.value || "",
                url_actual: urlActual,
                cambio_img: div.dataset.cambioImagen === "true",
                db_id: div.dataset.dbId || null
            });
        }
        formData.append(metaKey, JSON.stringify(metadata));
    };

    await extraerSeccion("carruselContainer", "metadata_carrusel", "imagenes_carrusel");
    await extraerSeccion("seccionesContainer", "metadata_secciones", "imagenes_secciones");
    await extraerSeccion("cintaContainer", "metadata_cinta", "imagenes_cinta");
    await extraerSeccion("inicioCintaContainer", "metadata_inicio_cinta", "imagenes_inicio_cinta");
    progressBar.style.width = "75%";
    progressText.textContent = "Subiendo al servidor...";
    try {
        const res = await fetch("/publicidad_page", { method: "POST", body: formData });
        const data = await res.json();
        progressBar.style.width = "100%";
        progressText.textContent = "Completado";
        if (data.ok) {
            toast("📢 Publicidad guardada y publicada en el sitio");
            actualizarAlmacenamiento();
            setTimeout(() => location.reload(), 1000);
        } else {
            toast(data.error || "Error al guardar", "danger");
        }
    } catch {
        toast("Error de conexión", "danger");
    } finally {
        procesamientoEnCurso = false;
        btn.disabled = false;
        btn.innerHTML = originalText;
        setTimeout(() => progressContainer.classList.add("d-none"), 2000);
    }
}

function initDrag(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.addEventListener("dragstart", e => {
        if (e.target.classList.contains("section-preview")) e.target.classList.add("dragging");
    });
    container.addEventListener("dragend", e => {
        if (e.target.classList.contains("section-preview")) {
            e.target.classList.remove("dragging");
            actualizarPreview();
        }
    });
    container.addEventListener("dragover", e => {
        e.preventDefault();
        const dragging = container.querySelector(".dragging");
        const afterElement = [...container.querySelectorAll(".section-preview:not(.dragging)")].reduce((closest, child) => {
            const offset = e.clientY - child.getBoundingClientRect().top - child.getBoundingClientRect().height / 2;
            return offset < 0 && offset > closest.offset ? { offset, element: child } : closest;
        }, { offset: Number.NEGATIVE_INFINITY }).element;
        if (dragging) afterElement ? container.insertBefore(dragging, afterElement) : container.appendChild(dragging);
    });
}

async function cambioImg(input) {
    const file = input.files[0];
    if (!file) return;
    const container = input.closest(".section-preview");
    const imgElement = container.querySelector("img");
    try {
        const comprimido = await comprimirImagen(file);
        const r = new FileReader();
        r.onload = e => {
            imgElement.src = e.target.result;
            container.dataset.cambioImagen = "true";
            actualizarPreview();
        };
        r.readAsDataURL(comprimido);
    } catch {
        toast("Error al comprimir imagen", "danger");
        input.value = "";
    }
}

async function borrarSec(btn) {
    const container = btn.closest(".section-preview");
    const dbId = container.dataset.dbId;
    if (!dbId || dbId === "null" || dbId === "") {
        container.remove();
        actualizarPreview();
        return;
    }
    mostrarConfirmacionApp("Eliminar Elemento", "¿Eliminar este elemento de la sección?", async () => {
        try {
            const r = await fetch(`/api/admin/publicidad/delete/${dbId}`, { method: "DELETE" });
            const res = await r.json();
            if (res.ok) { container.remove(); actualizarPreview(); toast("¡Publicidad eliminada con éxito!", true); }
            else toast("Error al eliminar", "danger");
        } catch {
            toast("Error al eliminar", "danger");
        }
    });
}

function cargarPublicidadActiva() {
    fetch("/api/publicidad/activa").then(r => r.json()).then(data => {
        if (!Array.isArray(data)) return;
        data.forEach(item => {
            if (item.tipo === "carrusel") agregarCarrusel(item.imagen_url, item.titulo, item.descripcion, item.id_publicidad);
            else if (item.tipo === "seccion") agregarSeccion(item.imagen_url, item.titulo, item.id_publicidad);
            else if (item.tipo === "cinta") agregarCinta(item.imagen_url, item.titulo, item.id_publicidad);
            else if (item.tipo === "inicio_cinta") agregarInicioCinta(item.imagen_url, item.titulo, item.id_publicidad);
        });
        actualizarPreview();
    }).catch(e => console.error("Error cargando publicidad:", e));
}

document.addEventListener("DOMContentLoaded", async () => {
    [].slice.call(document.querySelectorAll("[data-bs-toggle='tooltip']")).forEach(el => new bootstrap.Tooltip(el));
    await actualizarAlmacenamiento();
    const inputArchivo = document.getElementById("archivoNotificacion");
    if (inputArchivo) {
        inputArchivo.addEventListener("change", function () {
            const previewImg = document.getElementById("previewNotificacionImg");
            if (this.files?.[0] && previewImg) {
                const reader = new FileReader();
                reader.onload = e => previewImg.src = e.target.result;
                reader.readAsDataURL(this.files[0]);
            }
        });
    }
    if (document.getElementById("carruselContainer")) {
        cargarPublicidadActiva();
        cargarAlertasActivas();
        initDrag("carruselContainer");
        initDrag("seccionesContainer");
        initDrag("cintaContainer");
        initDrag("inicioCintaContainer");
        document.getElementById("btnGuardarMarketing")?.addEventListener("click", guardarMarketing);
        cargarGestorImagenes();
        _initLivePreviewScroll();
    }
});

function recargarPreviewInicio() {
    const iframe = document.getElementById('iframePreviewInicio');
    const badge  = document.getElementById('liveStatusBadge');
    if (!iframe) return;
    if (badge) { badge.textContent = 'ACTUALIZANDO...'; badge.className = 'badge bg-warning ms-1'; }
    iframe.src = iframe.src;
    iframe.onload = () => {
        if (badge) { badge.textContent = 'EN VIVO'; badge.className = 'badge bg-success ms-1'; }
    };
}

function _initLivePreviewScroll() {
    const wrapper = document.querySelector('.live-preview-wrapper');
    const overlay = document.querySelector('.live-preview-overlay');
    const iframe  = document.getElementById('iframePreviewInicio');
    if (!wrapper || !overlay || !iframe) return;

    const MAX_SCROLL = 2800;
    let scrollTop = 0;

    function applyScroll() {
        iframe.style.transform = `translateY(-${scrollTop}px)`;
    }

    wrapper.addEventListener('wheel', (e) => {
        e.preventDefault();
        scrollTop = Math.max(0, Math.min(MAX_SCROLL, scrollTop + e.deltaY));
        applyScroll();
    }, { passive: false });

    let touchStartY = 0;
    overlay.addEventListener('touchstart', (e) => {
        touchStartY = e.touches[0].clientY;
    }, { passive: true });

    overlay.addEventListener('touchmove', (e) => {
        const dy = touchStartY - e.touches[0].clientY;
        touchStartY = e.touches[0].clientY;
        scrollTop = Math.max(0, Math.min(MAX_SCROLL, scrollTop + dy));
        applyScroll();
    }, { passive: true });

    let isDragging = false, dragStartY = 0, dragStartScroll = 0;
    overlay.addEventListener('mousedown', (e) => { isDragging = true; dragStartY = e.clientY; dragStartScroll = scrollTop; });
    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const dy = dragStartY - e.clientY;
        scrollTop = Math.max(0, Math.min(MAX_SCROLL, dragStartScroll + dy));
        applyScroll();
    });
    document.addEventListener('mouseup', () => { isDragging = false; });
}

//  GESTOR DE IMÁGENES CLOUDINARY

let _gestorData = {};
let _carpetaActual = 'publicidad';
const _GESTOR_PAG = 10;
let _gestorPagina = 1;

async function cargarGestorImagenes() {
    const grid   = document.getElementById('gestorGrid');
    const badge  = document.getElementById('gestorTotalBadge');
    if (!grid) return;
    grid.innerHTML = `<div class="col-12 text-center py-5 text-muted">
        <div class="spinner-border spinner-border-sm me-2" style="color:#f59e0b;"></div>Cargando...</div>`;
    try {
        const res  = await fetch('/api/cloudinary/gestor');
        const data = await res.json();
        if (!data.ok) { grid.innerHTML = '<div class="col-12 text-muted text-center py-4">Error al cargar imágenes</div>'; return; }
        _gestorData = data.carpetas || {};
        const total = Object.values(_gestorData).reduce((s, arr) => s + arr.length, 0);
        if (badge) badge.textContent = total;
        mostrarCarpeta(_carpetaActual);
    } catch {
        grid.innerHTML = '<div class="col-12 text-muted text-center py-4">Error de conexión</div>';
    }
}

function mostrarCarpeta(carpeta) {
    _carpetaActual = carpeta;
    _gestorPagina  = 1;
    const grid = document.getElementById('gestorGrid');
    if (!grid) return;

    document.querySelectorAll('#gestorTabs .nav-link').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.carpeta === carpeta);
    });

    const imgs = _gestorData[carpeta] || [];
    if (!imgs.length) {
        grid.innerHTML = `<div class="col-12 text-center py-5 text-muted">
            <i class="bi bi-folder2-open display-4 d-block mb-2"></i>Carpeta vacía</div>`;
        return;
    }

    _renderGestorPagina(imgs);
}

function _renderGestorPagina(imgs) {
    const grid    = document.getElementById('gestorGrid');
    if (!grid) return;
    const maxPag  = Math.ceil(imgs.length / _GESTOR_PAG);
    const inicio  = (_gestorPagina - 1) * _GESTOR_PAG;
    const visibles = imgs.slice(inicio, inicio + _GESTOR_PAG);

    const liHtml = visibles.map((img, i) => {
        const idx = inicio + i;
        return `
        <li class="list-group-item d-flex align-items-center gap-3 py-2 px-2">
            <img src="${img.url || ''}" alt="${img.name}" loading="lazy"
                 style="width:48px;height:48px;object-fit:cover;border-radius:6px;flex-shrink:0;border:1px solid #dee2e6;cursor:pointer;"
                 onerror="this.outerHTML='<div style=\\'width:48px;height:48px;display:flex;align-items:center;justify-content:center;background:#f8f9fa;border-radius:6px;color:#adb5bd;\\'><i class=\\'bi bi-image-slash\\'></i></div>'"
                 onclick="abrirImagenGestor('${img.url}','${img.name}','${img.size_kb} KB','${img.width}x${img.height}')">
            <div class="flex-grow-1 overflow-hidden" onclick="abrirImagenGestor('${img.url}','${img.name}','${img.size_kb} KB','${img.width}x${img.height}')" style="cursor:pointer;">
                <div class="fw-semibold small text-truncate" title="${img.name}">${img.name}</div>
                <div class="text-muted" style="font-size:0.72rem;">${img.size_kb} KB · ${(img.format||'').toUpperCase()} · ${img.width}×${img.height}</div>
            </div>
            <div class="d-flex gap-1 flex-shrink-0">
                <button class="btn btn-sm btn-outline-secondary px-2" onclick="navigator.clipboard.writeText('${img.url}').then(()=>mostrarAlerta('URL copiada'))">
                    <i class="bi bi-clipboard"></i>
                </button>
                <button class="btn btn-sm btn-outline-danger px-2" onclick="eliminarImagenGestor('${img.public_id}',${idx})">
                    <i class="bi bi-trash"></i>
                </button>
            </div>
        </li>`;
    }).join('');

    const pagNav = maxPag > 1 ? `
        <nav class="mt-3">
            <ul class="pagination pagination-sm justify-content-center mb-0">
                ${Array.from({length: maxPag}, (_,i) => `
                    <li class="page-item ${i+1 === _gestorPagina ? 'active' : ''}">
                        <a class="page-link" href="#" onclick="event.preventDefault();_gestorPagina=${i+1};_renderGestorPagina(window._gestorImgsActuales||[]);">${i+1}</a>
                    </li>`).join('')}
            </ul>
        </nav>` : '';

    window._gestorImgsActuales = imgs;
    grid.innerHTML = `<div class="col-12"><ul class="list-group list-group-flush">${liHtml}</ul>${pagNav}</div>`;
}

async function eliminarImagenGestor(publicId, idx) {
    mostrarConfirmacionApp('Eliminar imagen', '¿Eliminar esta imagen de Cloudinary? Esta acción no se puede deshacer.', async () => {
        try {
            const res = await fetch('/api/cloudinary/gestor/delete', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ public_id: publicId })
            });
            const data = await res.json();
            if (data.ok) {
                mostrarAlerta('Imagen eliminada correctamente');
                await cargarGestorImagenes();
            } else {
                mostrarAlerta(data.error || 'Error al eliminar', true);
            }
        } catch {
            mostrarAlerta('Error de conexión', true);
        }
    });
}

function abrirImagenGestor(url, nombre, size, dims) {
    const existing = document.getElementById('gestorModal');
    if (existing) existing.remove();
    const modal = document.createElement('div');
    modal.id = 'gestorModal';
    modal.innerHTML = `
        <div class="gestor-modal-overlay" onclick="this.parentElement.remove()">
            <div class="gestor-modal-box" onclick="event.stopPropagation()">
                <div class="gestor-modal-header">
                    <span class="fw-bold text-truncate">${nombre}</span>
                    <button class="btn btn-sm btn-close" onclick="document.getElementById('gestorModal').remove()"></button>
                </div>
                <img src="${url}" class="gestor-modal-img" alt="${nombre}"
                     onerror="this.outerHTML='<div class=gestor-img-broken><i class=bi bi-image-slash></i></div>'">
                <div class="gestor-modal-footer">
                    <span class="text-muted small">${dims} · ${size}</span>
                    <div class="d-flex gap-2">
                        <button class="btn btn-sm btn-outline-primary" onclick="navigator.clipboard.writeText('${url}').then(()=>mostrarAlerta('URL copiada al portapapeles'))">
                            <i class="bi bi-clipboard me-1"></i>Copiar URL
                        </button>
                        <a href="${url}" download="${nombre}" class="btn btn-sm btn-outline-success">
                            <i class="bi bi-download me-1"></i>Descargar
                        </a>
                    </div>
                </div>
            </div>
        </div>`;
    document.body.appendChild(modal);
}

(function () {
    window.history.pushState(null, "", window.location.href);
    window.onpopstate = () => window.history.pushState(null, "", window.location.href);
    window.onpageshow = (event) => {
        if (event.persisted || window.performance?.navigation.type === 2) window.location.reload();
    };
})();

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {navigator.serviceWorker.register('/static/js/workers/service-worker-publicidad.js') .then(() => console.log('SW OK')) .catch(err => console.error('SW Error', err));});
}

document.addEventListener('DOMContentLoaded', () => {
    const pubBtn = document.getElementById('navPubBtn');
    if (pubBtn) pubBtn.style.display = '';
});
