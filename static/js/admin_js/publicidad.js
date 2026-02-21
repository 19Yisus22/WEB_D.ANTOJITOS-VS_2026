let carruselIndex = 0, seccionIndex = 0, cintaIndex = 0;
let procesamientoEnCurso = false;
let audioCtx = null;
const productosNotificados = new Set();

function initAudioContext() {
    if (!audioCtx) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (AudioContextClass) audioCtx = new AudioContextClass();
    }
    if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
}

function playNotificationSound(type = 'default') {
    try {
        initAudioContext();
        if (!audioCtx) return;
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        if (type === 'error' || type === 'agotado' || type === 'danger' || type === 'warning') {
            oscillator.type = 'sawtooth';
            oscillator.frequency.setValueAtTime(330, audioCtx.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(110, audioCtx.currentTime + 0.3);
            gainNode.gain.setValueAtTime(0.03, audioCtx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.4);
            oscillator.start();
            oscillator.stop(audioCtx.currentTime + 0.4);
        } else {
            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(880, audioCtx.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(440, audioCtx.currentTime + 0.1);
            gainNode.gain.setValueAtTime(0.05, audioCtx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
            oscillator.start();
            oscillator.stop(audioCtx.currentTime + 0.2);
        }
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
    } catch (e) {
        console.warn("Audio bloqueado");
    }
}

function mostrarAlerta({
    mensaje = "",
    titulo = "",
    descripcion = "",
    imagen = "/static/uploads/logo.png",
    tipo = "info",
    duracion = 4000,
    idUnico = null,
    sonido = true
} = {}) {
    if (idUnico && productosNotificados.has(idUnico)) return;
    if (idUnico) {
        productosNotificados.add(idUnico);
        setTimeout(() => productosNotificados.delete(idUnico), duracion + 1000);
    }

    let cont = document.getElementById("toastContainer");
    if (!cont) {
        cont = document.createElement("div");
        cont.id = "toastContainer";
        cont.style.cssText = "position: fixed; top: 20px; right: 20px; z-index: 10000; display: flex; flex-direction: column; gap: 10px;";
        document.body.appendChild(cont);
    }

    if (sonido) {
        const soundType = (tipo === 'error' || tipo === 'agotado' || tipo === 'warning' || tipo === 'danger') ? 'error' : 'default';
        playNotificationSound(soundType);
    }

    const esError = tipo === 'error' || tipo === 'agotado' || tipo === 'warning' || tipo === 'danger';
    const colorPrimario = esError ? "#ff4757" : "#ff9800";
    const iconClass = esError ? 'bi-exclamation-triangle-fill' : 
                      tipo === 'bienvenida' ? 'bi-emoji-smile-fill' : 
                      tipo === 'favorito' ? 'bi-heart-fill' : 
                      tipo === 'success' ? 'bi-check-circle-fill' : 'bi-stars';

    const toast = document.createElement("div");
    toast.style.cssText = `
        background: #121212;
        color: #ffffff;
        padding: 14px 18px;
        border-radius: 12px;
        box-shadow: 0 8px 25px rgba(0,0,0,0.5);
        display: flex;
        align-items: center;
        min-width: 320px;
        max-width: 400px;
        border-left: 5px solid ${colorPrimario};
        transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        transform: translateX(120%);
        opacity: 0;
        margin-bottom: 8px;
    `;

    const textoContenido = descripcion || mensaje;
    const tituloFinal = titulo || (esError ? "Sistema" : "Notificación");

    toast.innerHTML = `
        <div class="d-flex align-items-center w-100">
            <div style="position: relative; flex-shrink: 0;">
                <img src="${imagen}" style="width:50px; height:50px; object-fit:cover; border-radius:8px;" onerror="this.src='/static/uploads/logo.png'">
                <div style="position: absolute; bottom: -4px; right: -4px; background: ${colorPrimario}; width: 20px; height: 20px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 2px solid #121212;">
                    <i class="bi ${iconClass} text-white" style="font-size: 0.65rem;"></i>
                </div>
            </div>
            <div class="ms-3 flex-grow-1">
                <strong style="display: block; font-size: 0.7rem; text-transform: uppercase; color: ${colorPrimario}; letter-spacing: 0.8px;">${tituloFinal}</strong>
                <div style="font-size: 0.85rem; font-weight: 400; color: #f0f0f0; line-height: 1.2;">${textoContenido}</div>
            </div>
            <button class="btn-close-toast ms-2" style="background: none; border: none; color: #888; cursor: pointer; font-size: 1rem;">
                <i class="bi bi-x-lg"></i>
            </button>
        </div>
    `;

    cont.appendChild(toast);
    setTimeout(() => {
        toast.style.transform = "translateX(0)";
        toast.style.opacity = "1";
    }, 50);

    const remove = () => {
        toast.style.transform = "translateX(120%)";
        toast.style.opacity = "0";
        setTimeout(() => toast.remove(), 400);
    };

    toast.querySelector('.btn-close-toast').onclick = remove;
    setTimeout(remove, duracion);
}

function toast(msg, tipo = "success") {
    mostrarAlerta({
        mensaje: msg,
        tipo: tipo,
        titulo: tipo === "success" ? "Éxito" : "Atención",
        duracion: 3500
    });
}

async function verificarAccesoAdmin() {
    try {
        const res = await fetch("/gestionar_productos");
        if (res.status === 401 || res.status === 403) {
            document.documentElement.innerHTML = `
                <head>
                    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
                    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.css">
                    <style>
                        body { background: #000; color: white; height: 100vh; display: flex; align-items: center; justify-content: center; font-family: sans-serif; overflow: hidden; }
                        .lock-box { text-align: center; border: 1px solid #333; padding: 3rem; border-radius: 20px; background: #0a0a0a; }
                        .shield-icon { font-size: 5rem; color: #ff4757; animation: pulse 2s infinite; }
                        @keyframes pulse { 0% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.1); opacity: 0.7; } 100% { transform: scale(1); opacity: 1; } }
                    </style>
                </head>
                <body>
                    <div class="lock-box shadow-lg">
                        <i class="bi bi-shield-slash-fill shield-icon"></i>
                        <h1 class="fw-bold mt-3">MÓDULO PROTEGIDO</h1>
                        <p class="text-secondary">Se requiere nivel de acceso administrativo para esta sección.</p>
                        <div class="spinner-border text-danger my-3" role="status"></div>
                        <br>
                        <button onclick="window.location.href='/'" class="btn btn-outline-danger mt-2 px-5">SALIR</button>
                    </div>
                </body>
            `;
            setTimeout(() => { window.location.href = "/"; }, 4000);
            return false;
        }
        return true;
    } catch (e) {
        return false;
    }
}

function validarArchivo(file) {
    if (!file) return false;
    const extensionesPermitidas = /(\.jpg|\.jpeg|\.png|\.webp|\.gif|\.avif)$/i;
    if (!extensionesPermitidas.exec(file.name)) {
        toast("Formato no soportado (JPG, PNG, WEBP, GIF, AVIF)", "danger");
        return false;
    }
    if (file.size > 10 * 1024 * 1024) {
        toast("Imagen demasiado pesada (Máx 10MB)", "danger");
        return false;
    }
    return true;
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
                const MAX_WIDTH = 1280;
                const MAX_HEIGHT = 720;
                let width = img.width;
                let height = img.height;
                if (width > height) {
                    if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
                } else {
                    if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; }
                }
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext("2d");
                ctx.drawImage(img, 0, 0, width, height);
                canvas.toBlob((blob) => {
                    resolve(new File([blob], file.name, { type: "image/jpeg", lastModified: Date.now() }));
                }, "image/jpeg", 0.7);
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
                    <div class="position-absolute w-100 h-100" style="background: url('${img}') center/cover; filter: blur(20px); transform: scale(1.1); z-index: 1;"></div>
                    <img src="${img}" class="position-relative d-block h-100 mx-auto shadow-lg" style="object-fit: contain; z-index: 2;">
                </div>
                <div class="carousel-caption rounded-4 p-3 mb-3 mx-auto" style="max-width: 80%; z-index:3;">
                    <h5 class="mb-1 fw-bold text-uppercase" style="text-shadow: 2px 2px 10px rgba(0,0,0,0.8);">${tit}</h5>
                    <p class="small mb-0" style="text-shadow: 1px 1px 8px rgba(0,0,0,0.8);">${des}</p>
                </div>`;
            pCar.appendChild(item);
        });
        const carElem = document.querySelector("#previewCarrusel");
        if (itemsCar.length > 0 && carElem) {
            const bsCarousel = bootstrap.Carousel.getOrCreateInstance(carElem);
            bsCarousel.to(0);
        }
    }

    const pCinta = document.getElementById("previewCintaMarquee");
    if (pCinta) {
        pCinta.innerHTML = "";
        const items = document.querySelectorAll("#cintaContainer .section-preview");
        let trackContent = "";
        items.forEach(div => {
            const img = div.querySelector("img").src;
            const tit = div.querySelector(".t-tit").value;
            trackContent += `
                <div class="d-inline-flex align-items-center gap-3 px-4">
                    <img src="${img}" style="width:32px; height:32px; border-radius:50%; object-fit:cover; border: 2px solid rgba(255,255,255,0.3);">
                    <span class="fw-bold text-white text-uppercase" style="letter-spacing:1px; font-size: 0.9rem;">${tit}</span>
                </div>`;
        });

        if (trackContent) {
            pCinta.style.display = "flex";
            pCinta.style.justifyContent = "flex-start";
            pCinta.style.overflow = "hidden";
            pCinta.innerHTML = `
                <div class="marquee-track" style="display: flex; white-space: nowrap; animation: marquee 25s linear infinite;">
                    ${trackContent} ${trackContent} ${trackContent}
                </div>`;
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
                <div style="width:65px; height:65px; margin: 0 auto; background:#f8f9fa;" class="rounded-circle overflow-hidden shadow-sm mb-2 border">
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
    if (!t.value.trim() || !d.value.trim()) {
        toast("Título y mensaje son obligatorios", "warning");
        return;
    }
    procesamientoEnCurso = true;
    const formData = new FormData();
    formData.append("titulo", t.value);
    formData.append("descripcion", d.value);
    if (a.files[0]) {
        const fileComprimido = await comprimirImagen(a.files[0]);
        formData.append("archivo", fileComprimido);
    }
    try {
        const res = await fetch("/api/admin/notificaciones", { method: "POST", body: formData });
        const data = await res.json();
        if (data.ok) {
            toast("Notificación publicada");
            t.value = ""; d.value = ""; a.value = "";
            if (previewImg) previewImg.src = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAJQAAACUCAYAAAB1OacDAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAJBSURBVHgB7d0xbhNREIDh90YpSClpSInS06ByAnp6SByBk9ByAnp6ChonSInS06ByApSClpSClpSChv9vYScbe9be9Xp3Z76Pst6stZun8f72zZunMREp6vUf97ZOfn64fP9scfH+mYgG9fbt+6f7n8/vXrz6eC6isfrz5p8mIkW9e/dhIu6IKOp8+SyiqPP7DyIa9PHe2XfTjMREpKgzmYh9Ihp0/vEisS+isfrtHxEfXkU06uXFpyciGrW9efZ0Ihp0t3k6EQ26ubqbiCtiIjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIynL17/wEunS4O3C+hNwAAAABJRU5ErkJggg==";
            cargarAlertasActivas();
        } else {
            toast(data.error || "Error al procesar", "danger");
        }
    } catch (e) {
        toast("Error de conexión", "danger");
    } finally {
        procesamientoEnCurso = false;
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
            div.className = "alert-admin-lista mb-2 d-flex align-items-center justify-content-between";
            div.innerHTML = `
                <div class="d-flex align-items-center gap-2 overflow-hidden">
                    ${alerta.imagen_url ? `<img src="${alerta.imagen_url}" class="img-notificacion-lista" style="width:35px;height:35px;border-radius:4px;object-fit:cover;">` : '<i class="bi bi-bell p-2"></i>'}
                    <div class="text-truncate">
                        <div class="small text-truncate fw-bold">${alerta.titulo}</div>
                        <div class="extra-small text-muted text-truncate">${alerta.descripcion}</div>
                    </div>
                </div>
                <button class="btn btn-sm text-danger border-0" onclick="eliminarAlerta('${alerta.id_publicidad}')">
                    <i class="bi bi-trash3-fill"></i>
                </button>`;
            cont.appendChild(div);
        });
    } catch (e) {
        console.error(e);
    }
}

async function eliminarAlerta(id) {
    if (!id || id === "undefined") return toast("ID no válido", "danger");
    try {
        const res = await fetch(`/api/admin/notificaciones/${id}`, { method: "DELETE" });
        const data = await res.json();
        if (data.ok) {
            toast("Eliminada", "success");
            cargarAlertasActivas();
        }
    } catch (e) {
        toast("Error de conexión", "danger");
    }
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
                <div class="preview-img-box mb-2 border rounded overflow-hidden shadow-sm" style="height: 120px; background: #f8f9fa;">
                    <img src="${url || 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAJQAAACUCAYAAAB1OacDAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAJBSURBVHgB7d0xbhNREIDh90YpSClpSInS06ByAnp6SByBk9ByAnp6ChonSInS06ByApSClpSClpSChv9vYScbe9be9Xp3Z76Pst6stZun8f72zZunMREp6vUf97ZOfn64fP9scfH+mYgG9fbt+6f7n8/vXrz6eC6isfrz5p8mIkW9e/dhIu6IKOp8+SyiqPP7DyIa9PHe2XfTjMREpKgzmYh9Ihp0/vEisS+isfrtHxEfXkU06uXFpyciGrW9efZ0Ihp0t3k6EQ26ubqbiCtiIjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIynL17/wEunS4O3C+hNwAAAABJRU5ErkJggg=='}" class="w-100 h-100" style="object-fit: cover;">
                </div>
                <input type="file" class="form-control form-control-sm mt-2" accept=".jpg,.jpeg,.png,.webp,.gif,.avif" onchange="cambioImg(this)">
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
            <div class="preview-img-box shadow-sm border" style="width:90px; height:90px; border-radius: 50%; min-width: 90px; overflow: hidden; background: #f8f9fa;">
                <img src="${url || 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAJQAAACUCAYAAAB1OacDAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAJBSURBVHgB7d0xbhNREIDh90YpSClpSInS06ByAnp6SByBk9ByAnp6ChonSInS06ByApSClpSClpSChv9vYScbe9be9Xp3Z76Pst6stZun8f72zZunMREp6vUf97ZOfn64fP9scfH+mYgG9fbt+6f7n8/vXrz6eC6isfrz5p8mIkW9e/dhIu6IKOp8+SyiqPP7DyIa9PHe2XfTjMREpKgzmYh9Ihp0/vEisS+isfrtHxEfXkU06uXFpyciGrW9efZ0Ihp0t3k6EQ26ubqbiCtiIjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIynL17/wEunS4O3C+hNwAAAABJRU5ErkJggg=='}" class="w-100 h-100" style="object-fit: cover;">
            </div>
            <div class="flex-grow-1">
                <div class="row g-2 align-items-end">
                    <div class="col-md-5"><label class="extra-small fw-bold text-muted text-uppercase">Imagen</label><input type="file" class="form-control form-control-sm" accept=".jpg,.jpeg,.png,.webp,.gif,.avif" onchange="cambioImg(this)"></div>
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
            <div class="preview-img-box shadow-sm border" style="width:50px; height:50px; border-radius: 50%; min-width: 50px; overflow: hidden; background: #f8f9fa;">
                <img src="${url || 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAJQAAACUCAYAAAB1OacDAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAJBSURBVHgB7d0xbhNREIDh90YpSClpSInS06ByAnp6SByBk9ByAnp6ChonSInS06ByApSClpSClpSChv9vYScbe9be9Xp3Z76Pst6stZun8f72zZunMREp6vUf97ZOfn64fP9scfH+mYgG9fbt+6f7n8/vXrz6eC6isfrz5p8mIkW9e/dhIu6IKOp8+SyiqPP7DyIa9PHe2XfTjMREpKgzmYh9Ihp0/vEisS+isfrtHxEfXkU06uXFpyciGrW9efZ0Ihp0t3k6EQ26ubqbiCtiIjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIynL17/wEunS4O3C+hNwAAAABJRU5ErkJggg=='}" class="w-100 h-100" style="object-fit: cover;">
            </div>
            <div class="flex-grow-1">
                <div class="row g-2 align-items-center">
                    <div class="col-md-5"><input type="file" class="form-control form-control-sm" accept=".jpg,.jpeg,.png,.webp,.gif,.avif" onchange="cambioImg(this)"></div>
                    <div class="col-md-7"><input type="text" class="form-control form-control-sm t-tit fw-bold" placeholder="Texto..." value="${titulo}" oninput="actualizarPreview()"></div>
                </div>
            </div>
            <button class="btn btn-sm text-danger border-0" onclick="borrarSec(this)"><i class="bi bi-x-circle-fill fs-5"></i></button>
        </div>`;
    document.getElementById("cintaContainer").appendChild(div);
    actualizarPreview();
}

async function guardarMarketing() {
    if (procesamientoEnCurso) return;
    const btn = document.getElementById("btnGuardarMarketing");
    const originalText = btn.innerHTML;
    procesamientoEnCurso = true;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> GUARDANDO...';
    const formData = new FormData();
    const extraerSeccion = async (containerId, metaKey, filePrefix) => {
        const metadata = [];
        const items = document.querySelectorAll(`#${containerId} .section-preview`);
        for (let index = 0; index < items.length; index++) {
            const div = items[index];
            const fileInput = div.querySelector('input[type="file"]');
            if (fileInput.files[0]) {
                formData.append(`${filePrefix}_${index}`, await comprimirImagen(fileInput.files[0]));
            }
            metadata.push({
                index,
                titulo: div.querySelector(".t-tit")?.value || "",
                descripcion: div.querySelector(".t-des")?.value || "",
                url_actual: div.querySelector("img").src,
                cambio_img: div.dataset.cambioImagen === "true",
                db_id: div.dataset.dbId || null
            });
        }
        formData.append(metaKey, JSON.stringify(metadata));
    };
    await extraerSeccion("carruselContainer", "metadata_carrusel", "file_carrusel");
    await extraerSeccion("seccionesContainer", "metadata_secciones", "file_secciones");
    await extraerSeccion("cintaContainer", "metadata_cinta", "file_cinta");
    try {
        const res = await fetch("/publicidad_page", { method: "POST", body: formData });
        const data = await res.json();
        if (data.ok) { toast("Publicidad actualizada"); setTimeout(() => location.reload(), 1000); }
        else toast(data.error || "Error al guardar", "danger");
    } catch (e) { toast("Error de conexión", "danger"); }
    finally { procesamientoEnCurso = false; btn.disabled = false; btn.innerHTML = originalText; }
}

function initDrag(containerId) {
    const container = document.getElementById(containerId);
    if(!container) return;
    container.addEventListener('dragstart', e => { if(e.target.classList.contains('section-preview')) e.target.classList.add('dragging'); });
    container.addEventListener('dragend', e => { 
        if(e.target.classList.contains('section-preview')) { e.target.classList.remove('dragging'); actualizarPreview(); } 
    });
    container.addEventListener('dragover', e => {
        e.preventDefault();
        const dragging = container.querySelector('.dragging');
        const afterElement = [...container.querySelectorAll('.section-preview:not(.dragging)')].reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = e.clientY - box.top - box.height / 2;
            if (offset < 0 && offset > closest.offset) return { offset: offset, element: child };
            return closest;
        }, { offset: Number.NEGATIVE_INFINITY }).element;
        if (dragging && afterElement == null) container.appendChild(dragging); 
        else if (dragging) container.insertBefore(dragging, afterElement);
    });
}

function cambioImg(input) {
    const file = input.files[0];
    if (!validarArchivo(file)) { input.value = ""; return; }
    const container = input.closest(".section-preview");
    const r = new FileReader();
    r.onload = e => { container.querySelector("img").src = e.target.result; container.dataset.cambioImagen = "true"; actualizarPreview(); };
    r.readAsDataURL(file);
}

async function borrarSec(btn) {
    const container = btn.closest(".section-preview");
    const dbId = container.dataset.dbId;
    if (!dbId || dbId === "null") { container.remove(); actualizarPreview(); return; }
    try {
        const r = await fetch(`/api/admin/publicidad/delete/${dbId}`, { method: "DELETE" });
        if ((await r.json()).ok) { container.remove(); actualizarPreview(); toast("Eliminado", "info"); }
    } catch (e) { toast("Error", "danger"); }
}

function cargarPublicidadActiva() {
    fetch("/api/publicidad/activa").then(r => r.json()).then(data => {
        if (!Array.isArray(data)) return;
        data.forEach(item => {
            if (item.tipo === 'carrusel') agregarCarrusel(item.imagen_url, item.titulo, item.descripcion, item.id_publicidad);
            else if (item.tipo === 'seccion') agregarSeccion(item.imagen_url, item.titulo, item.id_publicidad);
            else if (item.tipo === 'cinta') agregarCinta(item.imagen_url, item.titulo, item.id_publicidad);
        });
        actualizarPreview();
    });
}

document.addEventListener("DOMContentLoaded", () => {
    if (document.getElementById("carruselContainer")) {
        cargarPublicidadActiva();
        cargarAlertasActivas();
        initDrag("carruselContainer");
        initDrag("seccionesContainer");
        initDrag("cintaContainer");
        document.getElementById("btnGuardarMarketing")?.addEventListener("click", guardarMarketing);
        document.addEventListener("click", () => initAudioContext(), { once: true });
    }
});

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/static/js/workers/service-worker-publicidad.js')
        .then(reg => { console.log('SW OK'); })
        .catch(err => { console.error('SW Error', err); });
    });
}