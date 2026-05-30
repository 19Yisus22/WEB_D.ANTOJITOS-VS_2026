
//  D'Antojitos — Sistema Global de Widgets Reordenables
//  Aplica a TODOS los módulos con un botón de modo edición.
//  Usa SortableJS para drag-and-drop con scroll simultáneo.

(function() {
    const MODULE_ID = (() => {
        const path = window.location.pathname.replace(/\//g, '_').replace(/^_/, '') || 'index';
        return path;
    })();

    const ORDER_KEY   = `dantojitos_widget_order_${MODULE_ID}`;
    const HIDDEN_KEY  = `dantojitos_widget_hidden_${MODULE_ID}`;
    let   _editMode   = false;
    let   _sortable   = null;

    function getContainer() {
        return document.querySelector('main') || document.querySelector('.page-wrapper') || document.body;
    }

    function getWidgets() {
        const container = getContainer();

        // 1. Buscar data-widget explícitos directos en main
        const explicit = [...container.querySelectorAll(':scope > [data-widget]')];
        if (explicit.length > 0) return explicit;

        // 2. Buscar data-widget dentro de container-fluid
        const inContainer = [...container.querySelectorAll(':scope > * > [data-widget]')];
        if (inContainer.length > 0) return inContainer;

        // 3. Auto-detectar: .card hijos directos del primer div/container-fluid
        const innerContainer = container.querySelector('.container-fluid, .container, .container-central');
        const source = innerContainer || container;
        const cards = [...source.children].filter(el => {
            const tag = el.tagName.toLowerCase();
            return (tag === 'div' || tag === 'section') && el.children.length > 0;
        });

        if (cards.length >= 2) {
            return cards.map((el, i) => {
                if (!el.dataset.widget) {
                    el.dataset.widget = `auto-${i}`;
                    el.dataset.widgetLabel = el.querySelector('h1,h2,h3,h4,h5,h6')
                        ?.textContent?.trim()?.slice(0, 28) || `Sección ${i + 1}`;
                }
                return el;
            });
        }

        return [];
    }

    function getWidgetContainer() {
        const widgets = getWidgets();
        return widgets.length > 0 ? widgets[0].parentElement : getContainer();
    }

    function saveOrder() {
        const ids = getWidgets().map(w => w.dataset.widget);
        localStorage.setItem(ORDER_KEY, JSON.stringify(ids));
    }

    function saveHidden(panelId, hidden) {
        const list = JSON.parse(localStorage.getItem(HIDDEN_KEY) || '[]');
        const idx  = list.indexOf(panelId);
        if (hidden && idx === -1) list.push(panelId);
        else if (!hidden && idx > -1) list.splice(idx, 1);
        localStorage.setItem(HIDDEN_KEY, JSON.stringify(list));
    }

    function isHidden(panelId) {
        return JSON.parse(localStorage.getItem(HIDDEN_KEY) || '[]').includes(panelId);
    }

    function restoreOrder() {
        const saved = JSON.parse(localStorage.getItem(ORDER_KEY) || '[]');
        if (!saved.length) return;
        // Primero inicializar widgets para que tengan dataset.widget
        getWidgets();
        const container = getWidgetContainer();
        saved.forEach(id => {
            const el = document.querySelector(`[data-widget="${id}"]`);
            if (el && el.parentElement === container) container.appendChild(el);
        });
    }

    function restoreVisibility() {
        getWidgets().forEach(w => {
            const id = w.dataset.widget;
            if (isHidden(id)) {
                const content = w.querySelector('.widget-content');
                if (content) content.style.display = 'none';
                w.classList.add('widget-collapsed');
                const eyeBtn = w.querySelector('.widget-eye-btn i');
                if (eyeBtn) eyeBtn.className = 'bi bi-eye-slash';
            }
        });
    }

    function toggleWidgetContent(btn) {
        const panel   = btn.closest('[data-widget]');
        const content = panel.querySelector('.widget-content');
        if (!content) return;
        const isVisible = content.style.display !== 'none';
        content.style.display = isVisible ? 'none' : '';
        panel.classList.toggle('widget-collapsed', isVisible);
        const icon = btn.querySelector('i');
        if (icon) icon.className = isVisible ? 'bi bi-eye-slash' : 'bi bi-eye';
        saveHidden(panel.dataset.widget, isVisible);
    }

    function buildEditBar() {
        const existing = document.getElementById('widgetEditBar');
        if (existing) return;
        const bar = document.createElement('div');
        bar.id = 'widgetEditBar';
        bar.style.cssText = `
            position:fixed;top:0;left:0;right:0;z-index:9990;
            background:linear-gradient(135deg,#1a0800,#d35400);
            color:#fff;padding:8px 20px;
            display:flex;align-items:center;justify-content:space-between;
            font-size:0.82rem;font-weight:700;letter-spacing:0.5px;
            box-shadow:0 4px 20px rgba(211,84,0,0.4);
            animation:slideDown 0.3s ease;
        `;
        bar.innerHTML = `
            <style>@keyframes slideDown{from{transform:translateY(-100%)}to{transform:translateY(0)}}</style>
            <span><i class="bi bi-arrows-move me-2"></i>MODO EDICIÓN — Arrastra los widgets para reorganizar</span>
            <div class="d-flex gap-2">
                <button onclick="resetWidgetLayout()" style="background:rgba(255,255,255,0.15);border:none;color:#fff;
                    padding:5px 14px;border-radius:20px;font-size:0.75rem;cursor:pointer;font-weight:600;">
                    <i class="bi bi-arrow-counterclockwise me-1"></i>Restablecer
                </button>
                <button onclick="window._widgetSystem.exitEditMode()" style="background:rgba(255,255,255,0.25);border:none;color:#fff;
                    padding:5px 14px;border-radius:20px;font-size:0.75rem;cursor:pointer;font-weight:700;">
                    <i class="bi bi-check-lg me-1"></i>Listo
                </button>
            </div>`;
        document.body.prepend(bar);
        document.body.style.paddingTop = '42px';
    }

    function removeEditBar() {
        const bar = document.getElementById('widgetEditBar');
        if (bar) bar.remove();
        document.body.style.paddingTop = '';
    }

    function addWidgetHandles() {
        getWidgets().forEach(w => {
            if (w.querySelector('.widget-handle-bar')) return;
            const label = w.dataset.widgetLabel || w.dataset.widget;

            // Detectar el border-radius del widget para que el handle lo herede
            const computedStyle = window.getComputedStyle(w);
            const br = computedStyle.borderRadius || '0';
            const topBr = computedStyle.borderTopLeftRadius || br;
            const topBrR = computedStyle.borderTopRightRadius || br;

            const handleBar = document.createElement('div');
            handleBar.className = 'widget-handle-bar';
            handleBar.style.cssText = `
                display:flex;align-items:center;justify-content:space-between;
                padding:5px 10px 5px 8px;
                cursor:grab;user-select:none;
                background:linear-gradient(90deg,rgba(211,84,0,0.1),rgba(211,84,0,0.05));
                border-bottom:2px solid rgba(211,84,0,0.2);
                font-size:0.68rem;font-weight:800;
                text-transform:uppercase;letter-spacing:1px;
                color:rgba(211,84,0,0.9);
                border-radius:${topBr} ${topBrR} 0 0;
                margin:-1px -1px 0 -1px;
                transition:background 0.15s;
                position:sticky;top:0;z-index:10;
                backdrop-filter:blur(8px);
                -webkit-backdrop-filter:blur(8px);
                box-shadow:0 1px 6px rgba(211,84,0,0.08);
            `;
            handleBar.innerHTML = `
                <div style="display:flex;align-items:center;gap:6px;">
                    <i class="bi bi-grip-horizontal" style="font-size:0.85rem;opacity:0.5;"></i>
                    <span>${label}</span>
                </div>
                <button class="widget-eye-btn" style="background:none;border:none;cursor:pointer;
                    padding:1px 5px;color:rgba(211,84,0,0.5);font-size:0.8rem;line-height:1;" title="Mostrar/Ocultar">
                    <i class="bi ${isHidden(w.dataset.widget) ? 'bi-eye-slash' : 'bi-eye'}"></i>
                </button>`;
            handleBar.onmouseenter = () => {
                handleBar.style.background = 'linear-gradient(90deg,rgba(211,84,0,0.15),rgba(211,84,0,0.08))';
                handleBar.style.cursor = 'grab';
            };
            handleBar.onmouseleave = () => {
                handleBar.style.background = 'linear-gradient(90deg,rgba(211,84,0,0.08),rgba(211,84,0,0.04))';
            };
            handleBar.querySelector('.widget-eye-btn').onclick = (e) => {
                e.stopPropagation();
                toggleWidgetContent(handleBar.querySelector('.widget-eye-btn'));
            };
            w.prepend(handleBar);
        });
    }

    function removeWidgetHandles() {
        document.querySelectorAll('.widget-handle-bar').forEach(h => h.remove());
    }

    function enterEditMode() {
        if (_editMode) return;
        _editMode = true;
        buildEditBar();
        addWidgetHandles();

        const container = getContainer();
        container.style.position = 'relative';

        if (typeof Sortable !== 'undefined') {
            const widgetContainer = getWidgetContainer();
            _sortable = Sortable.create(widgetContainer, {
                animation: 280,
                easing: 'cubic-bezier(0.2, 1, 0.3, 1)',
                handle: '.widget-handle-bar',
                ghostClass: 'sortable-ghost',
                chosenClass: 'sortable-chosen',
                dragClass: 'sortable-drag',
                scroll: true,
                scrollSensitivity: 60,
                scrollSpeed: 18,
                bubbleScroll: true,
                forceFallback: false,
                fallbackTolerance: 5,
                onStart() {
                    document.body.style.userSelect = 'none';
                    document.body.style.cursor = 'grabbing';
                },
                onEnd(evt) {
                    document.body.style.userSelect = '';
                    document.body.style.cursor = '';
                    saveOrder(evt);
                }
            });
        }

        const editBtn = document.getElementById('widgetEditModeBtn');
        if (editBtn) {
            editBtn.innerHTML = '<i class="bi bi-check-lg"></i>';
            editBtn.style.background = 'linear-gradient(135deg,#1e8449,#27ae60)';
            editBtn.title = 'Salir del modo edición';
        }
    }

    function exitEditMode() {
        if (!_editMode) return;
        _editMode = false;
        removeEditBar();
        removeWidgetHandles();
        if (_sortable) { _sortable.destroy(); _sortable = null; }
        const editBtn = document.getElementById('widgetEditModeBtn');
        if (editBtn) {
            editBtn.innerHTML = '<i class="bi bi-pencil-fill"></i>';
            editBtn.style.background = '';
            editBtn.title = 'Organizar widgets';
        }
    }

    window.resetWidgetLayout = function() {
        localStorage.removeItem(ORDER_KEY);
        localStorage.removeItem(HIDDEN_KEY);
        location.reload();
    };

    // Rutas donde NO aplica el sistema de widgets
    const EXCLUDED_PATHS = [
        '/inicio', '/', '/carrito_page', '/comentarios_page',
        '/mi_perfil', '/login', '/registro', '/pedidos_page',
        '/gestionar_facturas_page', '/gestion_usuarios_page',
        '/catalogo_page'   // el catálogo tiene galería de imágenes — no interferir
    ];

    function shouldRun() {
        return !EXCLUDED_PATHS.includes(window.location.pathname);
    }

    function createEditButton() {
        if (!shouldRun()) return;

        // Preferir el botón de la navbar; si no existe, crear uno flotante como respaldo
        const navBtn = document.getElementById('navWidgetEditBtn');
        if (navBtn) {
            navBtn.style.display = '';
            navBtn.onclick = () => _editMode ? exitEditMode() : enterEditMode();
            // registrar en DOM con el id que usa el resto del sistema
            navBtn.id = 'widgetEditModeBtn';
            return;
        }

        const existing = document.getElementById('widgetEditModeBtn');
        if (existing) return;

        const btn = document.createElement('button');
        btn.id = 'widgetEditModeBtn';
        btn.title = 'Organizar widgets';
        btn.innerHTML = '<i class="bi bi-pencil-fill"></i>';
        btn.style.cssText = `
            position:fixed;bottom:30px;right:85px;
            background:linear-gradient(135deg,#d35400,#e67e22);
            color:#fff;border:none;border-radius:50%;
            width:40px;height:40px;font-size:0.95rem;
            cursor:pointer;z-index:1300;
            transition:all 0.2s;display:flex;align-items:center;justify-content:center;
        `;
        btn.onmouseenter = () => { btn.style.transform = 'scale(1.1)'; };
        btn.onmouseleave = () => { btn.style.transform = ''; };
        btn.onclick = () => _editMode ? exitEditMode() : enterEditMode();
        document.body.appendChild(btn);
    }

    document.addEventListener('DOMContentLoaded', () => {
        if (!shouldRun()) return;
        if (!getWidgets().length) return;
        restoreOrder();
        restoreVisibility();
        createEditButton();
    });

    window._widgetSystem = { enterEditMode, exitEditMode, saveOrder };
})();

