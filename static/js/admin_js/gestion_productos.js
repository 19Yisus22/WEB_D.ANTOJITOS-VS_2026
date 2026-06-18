const toastContainer = document.getElementById("toastContainer");
const btnAgregarPostre = document.getElementById("btnAgregarPostre");
const btnCancelar = document.getElementById("btnCancelar");
const formAgregarPostre = document.getElementById("formAgregarPostre");
const agregarPostreForm = document.getElementById("agregarPostreForm");
const listaPostresDisponibles = document.getElementById("listaPostresDisponibles");
const listaPostresAgotados = document.getElementById("listaPostresAgotados");
const avisoAgotados = document.getElementById("avisoAgotados");
const modalElement = document.getElementById("modalPostre");
const modal = modalElement ? new bootstrap.Modal(modalElement) : null;
const btnSubmitForm = document.getElementById("btnSubmitForm");
const searchInput = document.getElementById("searchProductos");

let postres = [];
let categorias = [];
let indexActual = null;
let _sortableInstances = [];
const PRODUCTOS_POR_PAG = 10;
let _paginaDisp = 1;
let _paginaAgot = 1;
let _listaDisp  = [];
let _listaAgot  = [];
let isUpdating = false;
let audioCtx = null;

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
        if (type === 'error' || type === 'delete') {
            oscillator.type = 'sawtooth';
            oscillator.frequency.setValueAtTime(330, audioCtx.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(110, audioCtx.currentTime + 0.3);
            gainNode.gain.setValueAtTime(0.03, audioCtx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.4);
        } else {
            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(880, audioCtx.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(440, audioCtx.currentTime + 0.1);
            gainNode.gain.setValueAtTime(0.05, audioCtx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
        }
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.4);
    } catch (e) {}
}

async function cargarCategorias() {
    try {
        const res = await fetch('/api/categorias');
        const data = await res.json();
        categorias = data.categorias || [];
    } catch (_) {
        categorias = [];
    }
    actualizarSelectCategorias();
    renderGestorCategorias();
}

function actualizarSelectCategorias(valorActual = null) {
    const sel = document.getElementById('categoriaPostre');
    if (!sel) return;
    sel.innerHTML = '';
    const lista = categorias.length > 0 ? categorias : ['Sin categoría'];
    lista.forEach(cat => {
        const opt = document.createElement('option');
        opt.value = cat;
        opt.textContent = cat;
        sel.appendChild(opt);
    });
    if (valorActual) {
        const match = [...sel.options].find(o => o.value === valorActual);
        if (match) {
            sel.value = valorActual;
        } else {
            const extra = document.createElement('option');
            extra.value = valorActual;
            extra.textContent = valorActual;
            sel.insertBefore(extra, sel.firstChild);
            sel.value = valorActual;
        }
    }
}

function renderGestorCategorias() {
    const lista = document.getElementById('listaCategoriasAdmin');
    if (!lista) return;
    if (categorias.length === 0) {
        lista.innerHTML = '<span class="text-muted small">Sin categorías. Agrega la primera.</span>';
        return;
    }
    lista.innerHTML = '';
    categorias.forEach(cat => {
        const tag = document.createElement('span');
        tag.className = 'd-inline-flex align-items-center gap-1 px-2 py-1';
        tag.style.cssText = 'background:rgba(52,152,219,0.1);color:#1a6896;border:1px solid rgba(52,152,219,0.3);border-radius:8px;font-size:0.82rem;font-weight:600;';
        tag.innerHTML = `
            <i class="bi bi-tag" style="font-size:0.75rem;"></i>
            <span class="cat-label" style="cursor:pointer;" title="Clic para renombrar">${cat}</span>
            <button class="btn btn-link p-0 ms-1" title="Eliminar" data-cat="${cat}"
                style="color:#c0392b;font-size:0.65rem;line-height:1;text-decoration:none;">
                <i class="bi bi-x-lg"></i>
            </button>`;
        tag.querySelector('.cat-label').addEventListener('click', () => _iniciarRenombrarCategoria(cat, tag));
        tag.querySelector('button').addEventListener('click', (e) => {
            e.stopPropagation();
            _eliminarCategoria(cat);
        });
        lista.appendChild(tag);
    });
}

function _mostrarFeedbackCategorias(msg, isError = false) {
    const fb = document.getElementById('categoriasFeedback');
    if (!fb) return;
    fb.textContent = msg;
    fb.className = `small mt-2 ${isError ? 'text-danger' : 'text-success'}`;
    setTimeout(() => fb.className += ' d-none', 3000);
}

async function _agregarCategoria() {
    const inp = document.getElementById('inputNuevaCategoria');
    const nombre = (inp?.value || '').trim();
    if (!nombre) return _mostrarFeedbackCategorias('Escribe un nombre para la categoría', true);
    try {
        const r = await fetch('/api/categorias', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nombre })
        });
        const data = await r.json();
        if (data.ok) {
            categorias = data.categorias;
            inp.value = '';
            actualizarSelectCategorias();
            renderGestorCategorias();
            _mostrarFeedbackCategorias(`Categoría "${nombre}" creada`);
        } else {
            _mostrarFeedbackCategorias(data.error || 'Error', true);
        }
    } catch { _mostrarFeedbackCategorias('Error de red', true); }
}

async function _iniciarRenombrarCategoria(catActual, tagEl) {
    const labelEl = tagEl.querySelector('.cat-label');
    const input = document.createElement('input');
    input.type = 'text';
    input.value = catActual;
    input.className = 'form-control form-control-sm shadow-none d-inline-block';
    input.style.cssText = 'width:120px;height:24px;padding:0 4px;font-size:0.8rem;';
    labelEl.replaceWith(input);
    input.focus();
    input.select();

    const guardar = async () => {
        const nuevo = input.value.trim();
        if (!nuevo || nuevo === catActual) {
            await cargarCategorias();
            return;
        }
        try {
            const r = await fetch('/api/categorias/rename', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nombre: catActual, nuevo })
            });
            const data = await r.json();
            if (data.ok) {
                categorias = data.categorias;
                actualizarSelectCategorias();
                renderGestorCategorias();
                _mostrarFeedbackCategorias(`Renombrada a "${nuevo}"`);
            } else {
                _mostrarFeedbackCategorias(data.error || 'Error', true);
                await cargarCategorias();
            }
        } catch { await cargarCategorias(); }
    };

    input.addEventListener('blur', guardar);
    input.addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
        if (e.key === 'Escape') { input.value = catActual; input.blur(); }
    });
}

async function _eliminarCategoria(nombre) {
    mostrarConfirmacionApp('Eliminar Categoría', `¿Eliminar la categoría "${nombre}"? Los productos asignados quedarán sin categoría válida.`, async () => {
        try {
            const r = await fetch('/api/categorias/delete', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nombre })
            });
            const data = await r.json();
            if (data.ok) {
                categorias = data.categorias;
                actualizarSelectCategorias();
                renderGestorCategorias();
                _mostrarFeedbackCategorias(`Categoría "${nombre}" eliminada`);
            } else {
                _mostrarFeedbackCategorias(data.error || 'Error', true);
            }
        } catch { _mostrarFeedbackCategorias('Error de red', true); }
    });
}

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
    } catch (e) {}
}

async function cargarPostres(silent = false) {
    if (isUpdating && !silent) return;
    isUpdating = true;
    try {
        const res = await fetch("/gestionar_productos", { cache: 'no-store' });
        if (!res.ok) return;
        const nuevosPostres = await res.json();

        if (JSON.stringify(nuevosPostres) !== JSON.stringify(postres)) {
            const prevAgotados  = new Set(postres.filter(p => parseInt(p.stock) <= 0).map(p => p.id_producto));
            const prevDisponibles = new Set(postres.filter(p => parseInt(p.stock) > 0).map(p => p.id_producto));
            postres = nuevosPostres;
            localStorage.setItem('postresCache', JSON.stringify(postres));
            renderPostres();
            nuevosPostres.forEach(p => {
                const ahoraAgotado = parseInt(p.stock) <= 0;
                if (ahoraAgotado && !prevAgotados.has(p.id_producto)) {

                    mostrarAlerta(`Agotado: ${p.nombre.toUpperCase()}`, true, 5000);
                    playNotificationSound('error');
                } else if (!ahoraAgotado && prevAgotados.has(p.id_producto)) {

                    mostrarAlerta(`Disponible de nuevo: ${p.nombre}`, false, 5000);
                    playNotificationSound('default');
                }
            });
        }
        await actualizarAlmacenamiento();
    } catch (error) {
    } finally {
        isUpdating = false;
    }
}

function actualizarEstadisticas(listaAMostrar) {
    const total = listaAMostrar.length;
    const disponibles = listaAMostrar.filter(p => parseInt(p.stock) > 0).length;
    const agotados = total - disponibles;
    document.getElementById("statTotalNum").textContent = total;
    document.getElementById("statDispNum").textContent = disponibles;
    document.getElementById("statAgotNum").textContent = agotados;
}

function _abrirFormularioEdicion(index) {
    const p = postres[index];
    indexActual = index;
    document.getElementById("nombrePostre").value = p.nombre;
    document.getElementById("precioPostre").value = p.precio;
    document.getElementById("descripcionPostre").value = p.descripcion || "";
    document.getElementById("stockPostre").value = p.stock;
    actualizarSelectCategorias(p.categoria || null);
    const previewImg = document.getElementById("previewNotificacionImg");
    const placeholder = document.getElementById("placeholderNotif");
    if (p.imagen_url) {
        previewImg.src = p.imagen_url;
        previewImg.classList.remove("d-none");
        placeholder.classList.add("d-none");
    } else {
        resetPrevisualizador();
    }
    document.getElementById("formPanelTitle").textContent = t('prod.edit_title');
    btnSubmitForm.innerHTML = `<i class="bi bi-pencil-square me-2"></i>${t('prod.update')}`;
    formAgregarPostre.classList.remove("d-none");
    if (modal) modal.hide();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function _crearCardProducto(p) {
    const indexOriginal = postres.findIndex(pr => pr.id_producto === p.id_producto);
    const card = document.createElement("div");
    card.className = "col";
    card.dataset.prodId = String(p.id_producto);
    const stockActual = parseInt(p.stock) || 0;
    const isAgotado = stockActual <= 0;
    card.innerHTML = `
    <div class="card h-100 prod-card-selectable" data-id="${p.id_producto}" style="position:relative;">
        <div class="prod-drag-handle" title="Arrastrar para reorganizar"><i class="bi bi-grip-vertical"></i></div>
        <input type="checkbox" class="prod-select-check" data-id="${p.id_producto}"
               style="display:none;position:absolute;top:8px;left:8px;z-index:10;width:20px;height:20px;cursor:pointer;accent-color:#e67e22;">
        <div class="postre-img-wrapper ${isAgotado ? 'gris-img' : ''}">
            <img src="${p.imagen_url || '/static/uploads/default.png'}" class="postre-img" alt="${p.nombre}" loading="lazy"
                 onerror="this.src='/static/uploads/default.png'">
            ${isAgotado ? '<div class="postre-agotado-badge"><i class="bi bi-x-circle-fill me-1"></i>Agotado</div>' : ''}
        </div>
        <div class="card-body p-3">
            <h6 class="card-title text-truncate mb-1 fw-bold" style="font-size:0.88rem;">${p.nombre}</h6>
            <span class="prod-cat-badge mb-2 d-inline-block">
                <i class="bi bi-tag-fill me-1"></i>${p.categoria || 'Sin categoría'}
            </span>
            <p class="card-text fw-bold mb-2" style="color:var(--primary);font-size:0.95rem;">${Number(p.precio).toLocaleString('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 })}</p>
            <div class="d-flex justify-content-between align-items-center mt-auto">
                <span class="badge ${stockActual <= 0 ? 'badge-agotado' : stockActual <= 5 ? 'badge-bajo' : 'badge-ok'}">
                    <i class="bi bi-box-seam me-1"></i>Stock: ${stockActual}
                </span>
                <div class="d-flex gap-1">
                    <button class="btn-card-action btn-card-view" title="Ver detalle">
                        <i class="bi bi-eye"></i>
                    </button>
                    <button class="btn-card-action btn-card-edit" title="Editar producto">
                        <i class="bi bi-pencil-fill"></i>
                    </button>
                </div>
            </div>
        </div>
    </div>`;
    const cardEl = card.querySelector(".card");
    cardEl.onclick = (e) => {
        if (_modoSeleccionProd) {
            e.stopPropagation();
            const cb = card.querySelector('.prod-select-check');
            if (cb) {
                cb.checked = !cb.checked;
                card.classList.toggle('prod-selected', cb.checked);
            }
            _actualizarContadorProd();
            return;
        }
        abrirModalPostre(indexOriginal);
    };
    const selCb = card.querySelector('.prod-select-check');
    if (selCb) selCb.addEventListener('change', () => {
        card.classList.toggle('prod-selected', selCb.checked);
        _actualizarContadorProd();
    });
    card.querySelector(".btn-card-view").addEventListener('click', e => {
        e.stopPropagation();
        if (!_modoSeleccionProd) abrirModalPostre(indexOriginal);
    });
    card.querySelector(".btn-card-edit").addEventListener('click', e => {
        e.stopPropagation();
        if (!_modoSeleccionProd) _abrirFormularioEdicion(indexOriginal);
    });
    return card;
}

let _modoSeleccionProd = false;

function _actualizarContadorProd() {
    const n = document.querySelectorAll('.prod-select-check:checked').length;
    const el = document.getElementById('prodBulkCount');
    if (el) el.textContent = n > 0 ? `${n} seleccionado(s)` : 'Selecciona productos';
}

function _toggleModoSeleccionProd() {
    _modoSeleccionProd = !_modoSeleccionProd;
    _sortableInstances.forEach(s => s.option('disabled', _modoSeleccionProd));
    document.querySelectorAll('.prod-select-check').forEach(cb => {
        cb.style.display = _modoSeleccionProd ? 'block' : 'none';
        if (!_modoSeleccionProd) {
            cb.checked = false;
            cb.closest('.col')?.classList.remove('prod-selected');
        }
    });
    const toolbar = document.getElementById('prodBulkToolbar');
    if (toolbar) toolbar.classList.toggle('visible', _modoSeleccionProd);
}

async function _bulkEliminarProductos() {
    const ids = [...document.querySelectorAll('.prod-select-check:checked')].map(cb => cb.dataset.id);
    if (!ids.length) return mostrarAlerta('Selecciona al menos un producto', true);
    mostrarConfirmacionApp('Eliminar productos', `¿Eliminar permanentemente ${ids.length} producto(s)?`, async () => {
        try {
            const r = await fetch('/eliminar_productos_bulk', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids })
            });
            if (r.ok) {
                mostrarAlerta(`${ids.length} producto(s) eliminados`);
                playNotificationSound('delete');
                _toggleModoSeleccionProd();
                await cargarPostres();
            } else {
                const err = await r.json().catch(() => ({}));
                mostrarAlerta(err.error || 'Error al eliminar', true);
            }
        } catch { mostrarAlerta('Error de red', true); }
    });
}

function _initBulkToolbarProd() {
    const existing = document.getElementById('prodBulkToolbar');
    if (existing) return;
    const toolbar = document.createElement('div');
    toolbar.id = 'prodBulkToolbar';
    toolbar.className = 'bulk-float-toolbar';
    toolbar.innerHTML = `
        <span id="prodBulkCount" class="bulk-count">Selecciona productos</span>
        <button class="btn-bulk-delete" onclick="_bulkEliminarProductos()"><i class="bi bi-trash me-1"></i>Eliminar</button>
        <button class="btn-bulk-cancel" onclick="_toggleModoSeleccionProd()">Cancelar</button>
    `;
    document.body.appendChild(toolbar);
}

function _renderPaginacionProductos(containerId, lista, paginaActual, onCambio) {
    let nav = document.getElementById(containerId);
    if (!nav) {
        nav = document.createElement('nav');
        nav.id = containerId;
        nav.className = 'mt-3 mb-2';
        const parent = containerId.includes('Disp')
            ? listaPostresDisponibles.parentElement
            : listaPostresAgotados.parentElement;
        if (parent) parent.appendChild(nav);
    }
    const maxPag = Math.ceil(lista.length / PRODUCTOS_POR_PAG);
    if (maxPag <= 1) { nav.innerHTML = ''; return; }
    let html = '<ul class="pagination pagination-sm justify-content-center">';
    for (let i = 1; i <= maxPag; i++) {
        html += `<li class="page-item ${i === paginaActual ? 'active' : ''}">
                    <a class="page-link" href="#" onclick="event.preventDefault();(${onCambio})(${i});">${i}</a>
                 </li>`;
    }
    nav.innerHTML = html + '</ul>';
}

function renderPostres(filtro = "") {
    if (!listaPostresDisponibles || !listaPostresAgotados) return;
    const catContainer = document.getElementById('catalogoCategorizado');
    const secDisp = document.getElementById('sectionDisponibles');
    const secAgot = document.getElementById('sectionAgotados');

    const productosFiltrados = postres.filter(p =>
        p.nombre.toLowerCase().includes(filtro.toLowerCase())
    );
    actualizarEstadisticas(productosFiltrados);

    if (categorias.length > 0) {
        if (catContainer) catContainer.classList.remove('d-none');
        if (secDisp) secDisp.style.display = 'none';
        if (secAgot) secAgot.style.display = 'none';
        _renderCategoriaDragDrop(filtro);
    } else {
        if (catContainer) catContainer.classList.add('d-none');
        const onboarding = document.getElementById('prodEmptyOnboarding');
        if (postres.length === 0 && !filtro) {
            if (secDisp) secDisp.style.display = 'none';
            if (secAgot) secAgot.style.display = 'none';
            if (onboarding) {
                onboarding.classList.remove('d-none');
            } else {
                _insertarGuiaCategorias();
                setTimeout(() => {
                    const row = document.getElementById('categoriasManagerRow');
                    if (row) row.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    const inp = document.getElementById('inputNuevaCategoria');
                    if (inp) inp.focus();
                }, 400);
            }
        } else {
            if (onboarding) onboarding.classList.add('d-none');
            if (secDisp) secDisp.style.display = '';
            if (secAgot) secAgot.style.display = '';
            listaPostresDisponibles.innerHTML = "";
            listaPostresAgotados.innerHTML = "";
            _paginaDisp = 1;
            _paginaAgot = 1;
            _listaDisp  = productosFiltrados.filter(p => (parseInt(p.stock) || 0) > 0);
            _listaAgot  = productosFiltrados.filter(p => (parseInt(p.stock) || 0) <= 0);
            _renderSeccionProductos();
        }
    }
}

function _insertarGuiaCategorias() {
    const anchor = document.getElementById('catalogoCategorizado');
    if (!anchor || !anchor.parentNode) return;
    const el = document.createElement('div');
    el.id = 'prodEmptyOnboarding';
    el.className = 'prod-empty-onboarding animate-in';
    el.innerHTML = `
        <div class="prod-empty-icon"><i class="bi bi-tags-fill"></i></div>
        <h5 class="fw-bold mb-2">¡Empieza configurando tus categorías!</h5>
        <p class="text-muted mb-4">Antes de agregar productos, crea al menos una categoría para organizar tu catálogo.</p>
        <div class="prod-empty-arrow"><i class="bi bi-arrow-up-circle-fill"></i></div>
        <p class="text-muted small mt-1">Usa el gestor de categorías justo arriba <strong>↑</strong></p>`;
    anchor.parentNode.insertBefore(el, anchor);
}

function _renderCategoriaDragDrop(filtro = '') {
    const container = document.getElementById('catalogoCategorizado');
    if (!container) return;
    container.innerHTML = '';
    _sortableInstances = [];

    const productosFiltrados = postres.filter(p =>
        p.nombre.toLowerCase().includes(filtro.toLowerCase())
    );

    const sortedCats = [...categorias].sort((a, b) => a.localeCompare(b, 'es'));

    const catMap = {};
    sortedCats.forEach(cat => { catMap[cat] = []; });
    catMap['__sin__'] = [];

    productosFiltrados.forEach(p => {
        const cat = categorias.includes(p.categoria) ? p.categoria : '__sin__';
        catMap[cat].push(p);
    });

    sortedCats.forEach(cat => _renderCatGrupo(container, cat, cat, catMap[cat]));

    if (catMap['__sin__'].length > 0 || productosFiltrados.length === 0) {
        _renderCatGrupo(container, '__sin__', 'Sin categoría', catMap['__sin__']);
    }
}

function _renderCatGrupo(container, catKey, catLabel, prods) {
    const safeCat = catKey.replace(/[^a-z0-9]/gi, '_');
    const grupo = document.createElement('div');
    grupo.className = 'cat-drag-grupo mb-5 animate-in';
    grupo.innerHTML = `
        <div class="section-header mb-3">
            <h5 class="fw-bold text-dark m-0 d-flex align-items-center gap-2">
                <i class="bi bi-tag-fill text-primary" style="font-size:0.85rem;"></i>
                <span>${catLabel}</span>
                <span class="badge bg-light text-muted border cat-drag-count" style="font-size:0.73rem;font-weight:600;">${prods.length}</span>
                <small class="text-muted ms-auto fw-normal" style="font-size:0.7rem;font-weight:400;">
                    <i class="bi bi-arrows-move me-1"></i>Arrastra para cambiar categoría
                </small>
            </h5>
            <div class="header-line"></div>
        </div>
        <div class="row row-cols-1 row-cols-sm-2 row-cols-md-3 row-cols-lg-4 row-cols-xl-5 g-3 cat-drag-grid"
             id="catDragGrid_${safeCat}"
             data-categoria="${catKey}"
             style="min-height:60px;"></div>
        ${prods.length === 0 ? `
        <div class="cat-drag-empty text-center text-muted py-3 mt-1" style="border:2px dashed rgba(0,0,0,0.12);border-radius:12px;font-size:0.8rem;">
            <i class="bi bi-arrow-down me-1"></i>Arrastra productos aquí
        </div>` : ''}`;
    container.appendChild(grupo);

    const grid = grupo.querySelector(`#catDragGrid_${safeCat}`);
    prods.forEach(p => grid.appendChild(_crearCardProducto(p)));

    if (typeof Sortable !== 'undefined') {
        const s = Sortable.create(grid, {
            group: 'productos_drag',
            animation: 200,
            handle: '.prod-drag-handle',
            ghostClass: 'prod-drag-ghost',
            chosenClass: 'prod-drag-chosen',
            disabled: _modoSeleccionProd,
            onEnd: async (evt) => {
                if (evt.from === evt.to) return;
                const cardEl = evt.item;
                const prodId = cardEl.dataset.prodId;
                const newCatKey = evt.to.dataset.categoria;
                const newCat = newCatKey === '__sin__' ? 'Sin categoría' : newCatKey;
                if (!prodId) return;

                const fromGrupo = evt.from.closest('.cat-drag-grupo');
                const toGrupo   = evt.to.closest('.cat-drag-grupo');
                if (fromGrupo) fromGrupo.querySelector('.cat-drag-count').textContent = evt.from.querySelectorAll(':scope > .col').length;
                if (toGrupo)   toGrupo.querySelector('.cat-drag-count').textContent   = evt.to.querySelectorAll(':scope > .col').length;

                const fromEmpty = fromGrupo?.querySelector('.cat-drag-empty');
                if (evt.from.querySelectorAll(':scope > .col').length === 0 && !fromEmpty) {
                    const hint = document.createElement('div');
                    hint.className = 'cat-drag-empty text-center text-muted py-3 mt-1';
                    hint.style.cssText = 'border:2px dashed rgba(0,0,0,0.12);border-radius:12px;font-size:0.8rem;';
                    hint.innerHTML = '<i class="bi bi-arrow-down me-1"></i>Arrastra productos aquí';
                    fromGrupo.appendChild(hint);
                }
                const toEmpty = toGrupo?.querySelector('.cat-drag-empty');
                if (toEmpty) toEmpty.remove();

                await _guardarCategoriaDrop(prodId, newCat);
            }
        });
        _sortableInstances.push(s);
    }
}

async function _guardarCategoriaDrop(prodId, categoria) {
    const formData = new FormData();
    formData.append('categoria', categoria);
    try {
        const res = await fetch(`/actualizar_producto/${prodId}`, { method: 'PUT', body: formData });
        if (res.ok) {
            const p = postres.find(x => String(x.id_producto) === String(prodId));
            if (p) p.categoria = categoria;
            mostrarAlerta(`Movido a "${categoria}"`, false, 2000);
        } else {
            mostrarAlerta('Error al cambiar categoría', true);
            await cargarPostres();
        }
    } catch {
        mostrarAlerta('Error de red', true);
        await cargarPostres();
    }
}

function _renderSeccionProductos() {
    listaPostresDisponibles.innerHTML = "";
    listaPostresAgotados.innerHTML = "";

    const inicioDisp = (_paginaDisp - 1) * PRODUCTOS_POR_PAG;
    _listaDisp.slice(inicioDisp, inicioDisp + PRODUCTOS_POR_PAG).forEach(p =>
        listaPostresDisponibles.appendChild(_crearCardProducto(p))
    );

    const inicioAgot = (_paginaAgot - 1) * PRODUCTOS_POR_PAG;
    _listaAgot.slice(inicioAgot, inicioAgot + PRODUCTOS_POR_PAG).forEach(p =>
        listaPostresAgotados.appendChild(_crearCardProducto(p))
    );

    document.getElementById("emptyDisponibles").classList.toggle("d-none", _listaDisp.length > 0);
    document.getElementById("emptyAgotados").classList.toggle("d-none", _listaAgot.length > 0);
    if (avisoAgotados) avisoAgotados.classList.toggle("d-none", _listaAgot.length === 0);

    _renderPaginacionProductos('pagDisponibles', _listaDisp, _paginaDisp, 'window._cambiarPagDisp');
    _renderPaginacionProductos('pagAgotados',    _listaAgot, _paginaAgot, 'window._cambiarPagAgot');
}

window._cambiarPagDisp = (p) => { _paginaDisp = p; _renderSeccionProductos(); window.scrollTo({top:0,behavior:'smooth'}); };
window._cambiarPagAgot = (p) => { _paginaAgot = p; _renderSeccionProductos(); };

function abrirModalPostre(index) {
    indexActual = index;
    const p = postres[index];
    document.getElementById("modalNombre").textContent = "Ficha de Producto";
    document.getElementById("modalNombreH3").textContent = p.nombre;
    const modalFoto = document.getElementById("modalFoto");
    const validUrl = p.imagen_url && p.imagen_url.startsWith('http');
    if (validUrl) {
        modalFoto.src = p.imagen_url;
        modalFoto.style.display = 'block';
        modalFoto.onerror = () => {
            modalFoto.style.display = 'none';
            const placeholder = document.createElement('div');
            placeholder.className = 'd-flex align-items-center justify-content-center bg-light rounded-4';
            placeholder.style.cssText = 'height:100%;min-height:200px;';
            placeholder.innerHTML = '<i class="bi bi-image-slash text-muted fs-1"></i>';
            modalFoto.parentNode.insertBefore(placeholder, modalFoto.nextSibling);
        };
    } else {
        modalFoto.style.display = 'none';
        const placeholder = document.createElement('div');
        placeholder.id = 'modalFotoPlaceholder';
        placeholder.className = 'd-flex align-items-center justify-content-center bg-light rounded-4';
        placeholder.style.cssText = 'height:100%;min-height:200px;';
        placeholder.innerHTML = '<i class="bi bi-image-slash text-muted fs-1"></i>';
        if (modalFoto.parentNode) modalFoto.parentNode.insertBefore(placeholder, modalFoto.nextSibling);
    }
    document.getElementById("modalDescripcion").textContent = p.descripcion || "Sin descripción";
    document.getElementById("modalPrecio").textContent = Number(p.precio).toLocaleString('es-CO', { style: 'currency', currency: 'COP' });
    document.getElementById("modalStock").textContent = `Existencias: ${p.stock}`;
    if (modal) modal.show();
}

function resetPrevisualizador() {
    const previewImg = document.getElementById("previewNotificacionImg");
    const placeholder = document.getElementById("placeholderNotif");
    if (previewImg && placeholder) {
        previewImg.src = "";
        previewImg.classList.add("d-none");
        placeholder.classList.remove("d-none");
    }
}

async function cargarDescuentoCumple() {
    try {
        const res  = await fetch('/api/config/descuento_cumpleanos');
        const data = await res.json();
        const inp  = document.getElementById('inputDescuentoCumple');
        if (inp) inp.value = data.pct ?? 5;
    } catch (_) {}
}

async function guardarDescuentoCumple() {
    const inp = document.getElementById('inputDescuentoCumple');
    const fb  = document.getElementById('descuentoFeedback');
    if (!inp) return;
    const pct = parseFloat(inp.value);
    if (isNaN(pct) || pct < 0 || pct > 100) {
        fb.textContent = 'Valor inválido (0–100)';
        fb.className   = 'small text-danger';
        fb.classList.remove('d-none');
        return;
    }
    try {
        const res  = await fetch('/api/config/descuento_cumpleanos', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pct }),
        });
        const data = await res.json();
        if (data.ok) {
            fb.textContent = `✓ Guardado: ${data.pct}%`;
            fb.className   = 'small text-success';
        } else {
            fb.textContent = data.error || 'Error al guardar';
            fb.className   = 'small text-danger';
        }
    } catch (_) {
        fb.textContent = 'Error de red';
        fb.className   = 'small text-danger';
    }
    fb.classList.remove('d-none');
    setTimeout(() => fb.classList.add('d-none'), 3000);
}

document.addEventListener("DOMContentLoaded", async () => {
    cargarDescuentoCumple();
    const btnDesc = document.getElementById('btnGuardarDescuento');
    if (btnDesc) btnDesc.addEventListener('click', guardarDescuentoCumple);

    _initBulkToolbarProd();

    // Ctrl+Click — selección múltiple en escritorio (capture para interceptar antes que cardEl.onclick)
    let _lpTimerProd = null, _lpMovedProd = false, _lpTargetProd = null;
    document.addEventListener('click', (e) => {
        if (!e.ctrlKey && !e.metaKey) return;
        const col = e.target.closest('[data-prod-id]');
        if (!col) return;
        e.preventDefault();
        e.stopPropagation();
        if (!_modoSeleccionProd) _toggleModoSeleccionProd();
        const cb = col.querySelector('.prod-select-check');
        if (cb) { cb.checked = !cb.checked; cb.dispatchEvent(new Event('change', { bubbles: true })); }
    }, true);

    // Long press — selección múltiple en móvil
    document.addEventListener('pointerdown', (e) => {
        _lpMovedProd = false;
        _lpTargetProd = e.target.closest('[data-prod-id]');
        if (!_lpTargetProd) return;
        _lpTimerProd = setTimeout(() => {
            if (_lpMovedProd) return;
            if (!_modoSeleccionProd) _toggleModoSeleccionProd();
            const cb = _lpTargetProd.querySelector('.prod-select-check');
            if (cb) { cb.checked = !cb.checked; cb.dispatchEvent(new Event('change', { bubbles: true })); }
            navigator.vibrate?.(50);
        }, 500);
    });
    document.addEventListener('pointermove', () => { _lpMovedProd = true; clearTimeout(_lpTimerProd); });
    document.addEventListener('pointerup',   () => clearTimeout(_lpTimerProd));
    document.addEventListener('pointercancel', () => clearTimeout(_lpTimerProd));

    await cargarCategorias();
    const btnAgregarCat = document.getElementById('btnAgregarCategoria');
    if (btnAgregarCat) btnAgregarCat.addEventListener('click', _agregarCategoria);
    const inputCat = document.getElementById('inputNuevaCategoria');
    if (inputCat) inputCat.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); _agregarCategoria(); } });

    await actualizarAlmacenamiento();
    const cached = localStorage.getItem('postresCache');
    if (cached) {
        postres = JSON.parse(cached);
        renderPostres();
    }
    await cargarPostres();
    setInterval(() => cargarPostres(true), 15000);

    const inputFoto = document.getElementById("fotoPostre");
    if (inputFoto) {
        inputFoto.addEventListener("change", function() {
            const previewImg = document.getElementById("previewNotificacionImg");
            const placeholder = document.getElementById("placeholderNotif");
            if (this.files && this.files[0]) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    previewImg.src = e.target.result;
                    previewImg.classList.remove("d-none");
                    placeholder.classList.add("d-none");
                };
                reader.readAsDataURL(this.files[0]);
            } else {
                resetPrevisualizador();
            }
        });
    }

    if (searchInput) searchInput.addEventListener("input", (e) => renderPostres(e.target.value));

    if (btnAgregarPostre) {
        btnAgregarPostre.onclick = () => {
            indexActual = null;
            agregarPostreForm.reset();
            resetPrevisualizador();
            document.getElementById("formPanelTitle").textContent = t('prod.new_title');
            btnSubmitForm.innerHTML = `<i class="bi bi-save2 me-2"></i>${t('prod.save')}`;
            formAgregarPostre.classList.remove("d-none");
            window.scrollTo({ top: 0, behavior: 'smooth' });
        };
    }

    if (btnCancelar) {
        btnCancelar.onclick = () => {
            formAgregarPostre.classList.add("d-none");
            agregarPostreForm.reset();
            resetPrevisualizador();
            indexActual = null;
        };
    }

    document.getElementById("btnEliminar").onclick = () => {
        if (indexActual === null) return;
        const p = postres[indexActual];
        mostrarConfirmacionApp("Eliminar Producto", `¿Eliminar permanentemente "${p.nombre}"?`, async () => {
            try {
                const res = await fetch(`/eliminar_producto/${p.id_producto}`, { method: "DELETE" });
                if (res.ok) {
                    mostrarAlerta(`"${p.nombre}" eliminado permanentemente`, true);
                    playNotificationSound('delete');
                    modal.hide();
                    await cargarPostres();
                } else {
                    const err = await res.json();
                    mostrarAlerta(`Error al eliminar: ${err.error || 'intente de nuevo'}`, true);
                }
            } catch (e) { mostrarAlerta("Error de conexión", true); }
        });
    };

    document.getElementById("btnEditar").onclick = () => {
        if (indexActual === null) return;
        _abrirFormularioEdicion(indexActual);
    };
});

if (agregarPostreForm) {
    agregarPostreForm.onsubmit = async (e) => {
        e.preventDefault();
        btnSubmitForm.disabled = true;
        btnSubmitForm.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span>${t('status.processing')}`;
        const fileInput = document.getElementById("fotoPostre");
        const file = fileInput.files[0];
        const formData = new FormData();
        formData.append("nombre", document.getElementById("nombrePostre").value);
        formData.append("precio", document.getElementById("precioPostre").value);
        formData.append("descripcion", document.getElementById("descripcionPostre").value);
        formData.append("stock", document.getElementById("stockPostre").value);
        const catSel = document.getElementById("categoriaPostre");
        formData.append("categoria", catSel ? catSel.value : (categorias[0] || "Sin categoría"));
        if (file) {
            const compressedBase64 = await compressImage(file);
            formData.append("foto_base64", compressedBase64);
            formData.append("foto_name", file.name);
        }
        await enviarFormulario(formData);
        btnSubmitForm.disabled = false;
    };
}

async function compressImage(file, maxWidth = 800, maxHeight = 800, quality = 0.7) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                if (width > height) {
                    if (width > maxWidth) { height *= maxWidth / width; width = maxWidth; }
                } else {
                    if (height > maxHeight) { width *= maxHeight / height; height = maxHeight; }
                }
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', quality).split(',')[1]);
            };
        };
    });
}

async function enviarFormulario(formData) {
    const esEdicion = indexActual !== null;
    const metodo = esEdicion ? "PUT" : "POST";
    const url = esEdicion ? `/actualizar_producto/${postres[indexActual].id_producto}` : "/gestionar_productos";
    const stockNuevo = parseInt(formData.get("stock"));

    try {
        const res = await fetch(url, { method: metodo, body: formData });
        if (res.ok) {
            formAgregarPostre.classList.add("d-none");
            agregarPostreForm.reset();
            resetPrevisualizador();
            indexActual = null;
            await cargarPostres();
            const nombre = formData.get('nombre') || 'Producto';
            if (esEdicion) {
                mostrarAlerta(`✏️ "${nombre}" actualizado correctamente en el catálogo`);
                if (typeof verificarLogros === 'function') verificarLogros({ tipo: 'accion', accion: 'editar_producto' });
            } else {
                mostrarAlerta(`"${nombre}" agregado al catálogo con éxito`);
                playNotificationSound('default');
                if (typeof verificarLogros === 'function') verificarLogros({ tipo: 'accion', accion: 'crear_producto' });
            }
            if (stockNuevo <= 0) {
                mostrarAlerta(`"${nombre}" registrado como AGOTADO`, true, 6000);
                playNotificationSound('error');
            }
            await actualizarAlmacenamiento();
        } else {
            const errorData = await res.json();
            mostrarAlerta(errorData.error || "Error en la operación", true);
        }
    } catch (e) {
        mostrarAlerta("Error de red", true);
    }
}

(function() {
    window.history.pushState(null, "", window.location.href);
    window.onpopstate = function() { window.history.pushState(null, "", window.location.href); };
    window.onpageshow = function(event) {
        if (event.persisted || (window.performance && window.performance.navigation.type === 2)) {
            window.location.reload();
        }
    };
})();

document.addEventListener("click", () => initAudioContext(), { once: true });

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {navigator.serviceWorker.register('/static/js/workers/service-worker-gestion_productos.js') .then(() => console.log('SW OK')) .catch(err => console.error('SW Error', err));});
}
