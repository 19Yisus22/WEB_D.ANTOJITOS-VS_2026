let productosMemoria = [];
let notificacionesDisponibles = [];
let isFirstLoad = true;
const productosNotificados = new Set();
let audioCtx = null;
let swiperInstance = null;

function initAudioContext() {
    if (!audioCtx) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (AudioContextClass) audioCtx = new AudioContextClass();
    }
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
}

function playNotificationSound(type = 'default') {
    try {
        initAudioContext();
        if (!audioCtx) return;
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        if (type === 'agotado') {
            oscillator.type = 'sawtooth';
            oscillator.frequency.setValueAtTime(330, audioCtx.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(110, audioCtx.currentTime + 0.3);
            gainNode.gain.setValueAtTime(0.03, audioCtx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.4);
            oscillator.start();
            oscillator.stop(audioCtx.currentTime + 0.4);
        } else {
            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(523.25, audioCtx.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(1046.50, audioCtx.currentTime + 0.15);
            gainNode.gain.setValueAtTime(0.02, audioCtx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.6);
            oscillator.start();
            oscillator.stop(audioCtx.currentTime + 0.6);
        }
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
    } catch (e) { console.warn("Audio bloqueado"); }
}

function mostrarToastPublicidad(imagen, titulo, descripcion, isError = false) {
    mostrarAlertaPublica({ imagen, titulo, mensaje: descripcion, tipo: isError ? 'error' : 'info', duracion: 6000 });
}

function mostrarToastActualizacion(imagen, titulo, descripcion, idUnico, isError = false) {
    mostrarAlertaPublica({ imagen, titulo, mensaje: descripcion, tipo: isError ? 'error' : 'info', idUnico, duracion: 6000 });
}

async function monitorearCambiosCatalogo() {
    try {
        const res = await fetch("/obtener_catalogo");
        const data = await res.json();
        const nuevosProductos = data.productos || [];
        if (!isFirstLoad) {
            nuevosProductos.forEach(nuevo => {
                const viejo = productosMemoria.find(p => p.id_producto == nuevo.id_producto);
                if (viejo) {
                    if (viejo.stock > 0 && nuevo.stock <= 0) {
                        mostrarToastActualizacion(nuevo.imagen_url || '/static/uploads/logo.ico', "¡Producto Agotado!", `Se acaba de terminar: ${nuevo.nombre}`, `agotado-${nuevo.id_producto}`, true);
                    } else if (viejo.stock <= 0 && nuevo.stock > 0) {
                        mostrarToastActualizacion(nuevo.imagen_url || '/static/uploads/logo.ico', "¡Nueva Disponibilidad!", `${nuevo.nombre} está listo para pedir nuevamente`, `disponible-${nuevo.id_producto}`, false);
                    }
                }
            });
        }
        productosMemoria = nuevosProductos;
        isFirstLoad = false;
    } catch (e) { console.error("Error monitoreo:", e); }
}

async function cargarMarketing() {
    try {
        const res = await fetch("/api/publicidad/activa", { cache: "no-store" });
        const publicidadArray = await res.json();
        if (!Array.isArray(publicidadArray)) return;
        const seccionesAlFrente = document.getElementById("seccionesAlFrente");
        const seccionesDebajo = document.getElementById("seccionesDebajo");
        const carouselInner = document.getElementById("carouselItems");
        if (seccionesAlFrente) seccionesAlFrente.innerHTML = "";
        if (seccionesDebajo) seccionesDebajo.innerHTML = "";
        if (carouselInner) carouselInner.innerHTML = "";
        notificacionesDisponibles = publicidadArray.filter(item => item.tipo === 'notificacion');
        const seccionesItems = publicidadArray.filter(item => item.tipo === 'seccion');
        seccionesItems.forEach((item, index) => {
            const delay = (index * 0.1).toFixed(2);
            const cardHtml = `
                <div class="seccion-card shadow-sm h-100 w-100" style="animation: fadeInSmooth 0.8s ease forwards; animation-delay: ${delay}s">
                    ${item.imagen_url
                        ? `<img src="${item.imagen_url}" class="postre-imagen-seccion w-100" onerror="this.outerHTML='<div class=\\'postre-imagen-seccion w-100 d-flex align-items-center justify-content-center bg-light text-muted\\'><i class=\\'bi bi-image-slash fs-1\\'></i></div>'">`
                        : `<div class="postre-imagen-seccion w-100 d-flex align-items-center justify-content-center bg-light text-muted"><i class="bi bi-image-slash fs-1"></i></div>`}
                    <div class="p-3 d-flex flex-column flex-grow-1">
                        <h6 class="fw-bold mb-1" style="color: #d6336c; font-size: 1.1rem;">${item.titulo || ''}</h6>
                        <p class="text-muted mb-0 small" style="line-height: 1.5;">${item.descripcion || ''}</p>
                    </div>
                </div>`;
            if (seccionesAlFrente && index < 2) {
                const wrap = document.createElement("div");
                wrap.className = "w-100 mb-3";
                wrap.innerHTML = cardHtml;
                seccionesAlFrente.appendChild(wrap);
            } else if (seccionesDebajo) {
                const col = document.createElement("div");
                col.className = "col-6 col-md-4 col-lg-3 mb-4";
                col.innerHTML = cardHtml;
                seccionesDebajo.appendChild(col);
            }
        });
        const carruselItems = publicidadArray.filter(item => item.tipo === 'carrusel');
        carruselItems.forEach((item, index) => {
            if (carouselInner) {
                const div = document.createElement("div");
                div.className = "swiper-slide";
                div.innerHTML = `
                    <div class="carousel-item active">
                        <div class="carousel-img-wrapper">
                            <img src="${item.imagen_url || ''}" class="carousel-background-blur"
                                 onerror="this.style.display='none'">
                            <img src="${item.imagen_url || ''}" class="d-block carousel-img-render"
                                 onerror="this.outerHTML='<div class=\\'d-flex align-items-center justify-content-center w-100 h-100 bg-dark text-muted\\'><i class=\\'bi bi-image-slash fs-1\\'></i></div>'">`
                            <div class="carousel-overlay"></div>
                        </div>
                        <div class="carousel-caption-custom">
                            <h6 class="carousel-title-animate">${item.titulo || ''}</h6>
                            <div class="carousel-divider"></div>
                            <p class="carousel-desc-animate">${item.descripcion || ''}</p>
                        </div>
                    </div>`;
                carouselInner.appendChild(div);
            }
        });
        if (swiperInstance) swiperInstance.destroy();
        swiperInstance = new Swiper('.swiperPromo', {
            loop: true,
            effect: 'fade',
            fadeEffect: { crossFade: true },
            autoplay: { delay: 5000, disableOnInteraction: false },
            pagination: { el: '.swiper-pagination', clickable: true },
            navigation: { nextEl: '.swiper-button-next', prevEl: '.swiper-button-prev' }
        });
    } catch (e) { console.error("Error al cargar publicidad", e); }
}

document.addEventListener("DOMContentLoaded", () => {
    cargarMarketing();
    setInterval(() => {
        if (notificacionesDisponibles.length > 0) {
            const indiceAleatorio = Math.floor(Math.random() * notificacionesDisponibles.length);
            const e = notificacionesDisponibles[indiceAleatorio];
            mostrarToastPublicidad(e.imagen_url, e.titulo, e.descripcion);
        }
    }, 15000);
    monitorearCambiosCatalogo();
    setInterval(monitorearCambiosCatalogo, 10000);

    const animarContadores = () => {
        document.querySelectorAll('.stat-number').forEach(el => {
            const target = +el.dataset.target;
            if (!target) return;
            const step = Math.ceil(target / 60);
            let current = 0;
            const timer = setInterval(() => {
                current += step;
                if (current >= target) { el.textContent = target; clearInterval(timer); }
                else el.textContent = current;
            }, 20);
        });
    };
    const statsSection = document.querySelector('.stats-section');
    if (statsSection) {
        new IntersectionObserver(entries => {
            entries.forEach(e => { if (e.isIntersecting) { animarContadores(); } });
        }, { threshold: 0.4 }).observe(statsSection);
    }
});

document.addEventListener("click", () => { initAudioContext(); }, { once: true });

(function() {
    window.history.pushState(null, "", window.location.href);
    window.onpopstate = function() { window.history.pushState(null, "", window.location.href); };
    window.onpageshow = function(event) {
        if (event.persisted || (window.performance && window.performance.navigation.type === 2)) {
            window.location.reload();
        }
    };
})();

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/static/js/workers/service-worker-carrito.js')
        .then(() => { console.log('SW OK'); })
        .catch(() => { console.log('SW Error'); });
    });
}
