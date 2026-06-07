(function () {

    const MODULE_ID = window.location.pathname.replace(/\
    const ORDER_KEY  = `dantojitos_widget_order_${MODULE_ID}`;
    const HIDDEN_KEY = `dantojitos_widget_hidden_${MODULE_ID}`;

    let _editMode = false;
    let _sortable = null;

    const EXCLUDED = new Set([
        '/', '/inicio', '/login', '/registro',
        '/carrito_page', '/comentarios_page',
        '/mi_perfil', '/gestionar_facturas_page', '/catalogo_page',
        '/pedidos_page',
        '/publicidad_page', '/facturacion_page', '/gestionar_productos_page',
        '/manual_page', '/gestion_usuarios_page', '/zona_pagos',
    ]);
    const shouldRun = () => !EXCLUDED.has(window.location.pathname);

    function getContainer() {
        return document.querySelector('main') ||
               document.querySelector('.page-wrapper') ||
               document.body;
    }

    function getWidgets() {
        const cont  = getContainer();
        const expl  = [...cont.querySelectorAll(':scope > [data-widget]')];
        if (expl.length) return expl;
        const nest  = [...cont.querySelectorAll(':scope > * > [data-widget]')];
        if (nest.length) return nest;

        const inner = cont.querySelector('.container-fluid,.container,.container-central') || cont;
        const cards = [...inner.children].filter(el => {
            const tag = el.tagName.toLowerCase();
            return (tag === 'div' || tag === 'section') && el.children.length > 0;
        });
        if (cards.length >= 2) {
            return cards.map((el, i) => {
                if (!el.dataset.widget) {
                    el.dataset.widget = `auto-${i}`;
                    el.dataset.widgetLabel =
                        el.querySelector('h1,h2,h3,h4,h5,h6')?.textContent?.trim()?.slice(0, 32)
                        || `Sección ${i + 1}`;
                }
                return el;
            });
        }
        return [];
    }

    function getWidgetContainer() {
        const ws = getWidgets();
        return ws.length ? ws[0].parentElement : getContainer();
    }

    function saveOrder() {
        localStorage.setItem(ORDER_KEY,
            JSON.stringify(getWidgets().map(w => w.dataset.widget)));
    }

    function saveHidden(id, hidden) {
        const list = JSON.parse(localStorage.getItem(HIDDEN_KEY) || '[]');
        const idx  = list.indexOf(id);
        if (hidden && idx === -1) list.push(id);
        else if (!hidden && idx > -1) list.splice(idx, 1);
        localStorage.setItem(HIDDEN_KEY, JSON.stringify(list));
    }

    function isHidden(id) {
        return JSON.parse(localStorage.getItem(HIDDEN_KEY) || '[]').includes(id);
    }

    function restoreOrder() {
        const saved = JSON.parse(localStorage.getItem(ORDER_KEY) || '[]');
        if (!saved.length) return;
        getWidgets();
        const cont = getWidgetContainer();
        saved.forEach(id => {
            const el = document.querySelector(`[data-widget="${id}"]`);
            if (el && el.parentElement === cont) cont.appendChild(el);
        });
    }

    function toggleWidgetContent(w) {
        const content = w.querySelector('.widget-content');
        if (!content) return;
        const showing = content.style.display !== 'none';
        content.style.display = showing ? 'none' : '';
        w.classList.toggle('widget-collapsed', showing);
        saveHidden(w.dataset.widget, showing);

        const eyeBtn = w.querySelector('.wg-eye-btn');
        if (eyeBtn) {
            const icon = eyeBtn.querySelector('i');
            if (icon) icon.className = showing ? 'bi bi-eye-slash' : 'bi bi-eye';
            eyeBtn.title = showing ? 'Mostrar sección' : 'Ocultar sección';
        }
    }

    function findHeaderRow(w) {
        const body = w.querySelector('.card-body');
        if (body) {
            const firstFlex = body.querySelector(
                ':scope > div:first-child, :scope > .d-flex:first-child'
            );
            if (firstFlex && firstFlex.querySelector('h1,h2,h3,h4,h5,h6')) {
                return firstFlex;
            }
            const hdg = body.querySelector(':scope > h1,:scope > h2,:scope > h3,:scope > h4,:scope > h5,:scope > h6');
            if (hdg) {
                const wrap = document.createElement('div');
                wrap.style.cssText = 'display:flex;align-items:center;gap:8px;';
                body.insertBefore(wrap, hdg);
                wrap.appendChild(hdg);
                return wrap;
            }
        }
        const ch = w.querySelector('.card-header');
        if (ch) return ch;
        const sh = w.querySelector('.section-header');
        if (sh) return sh;
        return null;
    }

    function addWidgetControls() {
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        const eyeColor  = isDark ? 'rgba(240,136,62,0.5)'  : 'rgba(211,84,0,0.4)';
        const gripColor = isDark ? 'rgba(240,136,62,0.35)' : 'rgba(211,84,0,0.3)';

        getWidgets().forEach(w => {
            if (w.querySelector('.wg-ctrl-group')) return;

            const id     = w.dataset.widget;
            const hidden = isHidden(id);
            const content = w.querySelector('.widget-content');

            if (content && hidden) {
                content.style.display = 'none';
                w.classList.add('widget-collapsed');
            }

            const group = document.createElement('div');
            group.className = 'wg-ctrl-group';
            group.style.cssText = `
                display:inline-flex;align-items:center;gap:3px;
                margin-left:auto;flex-shrink:0;
            `;
            group.innerHTML = `
                <button class="wg-eye-btn"
                        title="${hidden ? 'Mostrar sección' : 'Ocultar sección'}"
                        style="display:flex;align-items:center;justify-content:center;
                               background:none;border:none;cursor:pointer;
                               width:24px;height:24px;border-radius:7px;
                               color:${eyeColor};font-size:0.82rem;line-height:1;
                               transition:color 0.15s,background 0.15s,transform 0.15s;">
                    <i class="bi ${hidden ? 'bi-eye-slash' : 'bi-eye'}"></i>
                </button>
                <span class="wg-grip-icon"
                      title="Arrastrar para reorganizar"
                      style="display:flex;align-items:center;justify-content:center;
                             width:22px;height:22px;border-radius:7px;
                             color:${gripColor};font-size:1rem;line-height:1;
                             opacity:0;cursor:grab;flex-shrink:0;
                             transition:opacity 0.2s ease,color 0.15s;">
                    <i class="bi bi-grip-vertical"></i>
                </span>`;

            const eye = group.querySelector('.wg-eye-btn');
            eye.addEventListener('mouseenter', () => {
                eye.style.color      = isDark ? '#f0883e' : '#d35400';
                eye.style.background = isDark ? 'rgba(240,136,62,0.12)' : 'rgba(211,84,0,0.08)';
                eye.style.transform  = 'scale(1.1)';
            });
            eye.addEventListener('mouseleave', () => {
                eye.style.color      = eyeColor;
                eye.style.background = 'none';
                eye.style.transform  = '';
            });
            eye.addEventListener('click', e => {
                e.stopPropagation();
                toggleWidgetContent(w);
            });

            const grip = group.querySelector('.wg-grip-icon');
            grip.addEventListener('mouseenter', () => {
                grip.style.color = isDark ? '#f0883e' : '#d35400';
            });
            grip.addEventListener('mouseleave', () => {
                grip.style.color = gripColor;
            });

            const headerRow = findHeaderRow(w);
            if (headerRow) {
                headerRow.style.display    = 'flex';
                headerRow.style.alignItems = 'center';
                headerRow.appendChild(group);
            } else {
                const strip = document.createElement('div');
                strip.style.cssText = 'display:flex;justify-content:flex-end;padding:6px 10px 2px;';
                strip.appendChild(group);
                const target = w.querySelector('.card-body') || w;
                target.insertBefore(strip, target.firstChild);
            }
        });
    }

    function _showGrip() {
        document.querySelectorAll('.wg-grip-icon').forEach(g => {
            g.style.opacity = '0.65';
            g.style.cursor  = 'grab';
        });
    }
    function _hideGrip() {
        document.querySelectorAll('.wg-grip-icon').forEach(g => {
            g.style.opacity = '0';
            g.style.cursor  = 'grab';
        });
    }

    function buildEditBar() {
        if (document.getElementById('widgetEditBar')) return;
        const bar = document.createElement('div');
        bar.id = 'widgetEditBar';
        bar.style.cssText = `
            position:fixed;bottom:0;left:0;right:0;z-index:9990;
            background:linear-gradient(90deg,#0e0400 0%,#8a2800 30%,#c25000 65%,#d35400 100%);
            color:#fff;
            display:flex;align-items:center;justify-content:space-between;
            gap:12px;padding:0 20px;
            height:52px;
            box-shadow:0 -4px 28px rgba(211,84,0,0.45),0 -1px 0 rgba(255,255,255,0.06);
            animation:wgBarIn 0.32s cubic-bezier(0.22,1,0.36,1) both;
            backdrop-filter:blur(12px);
            -webkit-backdrop-filter:blur(12px);`;
        bar.innerHTML = `
            <style>
                @keyframes wgBarIn{
                    from{transform:translateY(100%);opacity:0;}
                    to  {transform:translateY(0);   opacity:1;}
                }
                .wg-bar-label{
                    display:flex;align-items:center;gap:8px;
                    font-size:0.78rem;font-weight:700;letter-spacing:0.4px;
                    opacity:0.92;flex:1;min-width:0;
                    white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
                }
                .wg-bar-label i.bi-grip-vertical{
                    font-size:1rem;vertical-align:middle;
                    filter:drop-shadow(0 0 4px rgba(255,255,255,0.4));
                }
                .wg-bar-actions{display:flex;align-items:center;gap:8px;flex-shrink:0;}
                .wg-bar-btn{
                    display:inline-flex;align-items:center;gap:6px;
                    border:none;cursor:pointer;
                    font-size:0.74rem;font-weight:700;letter-spacing:0.2px;
                    padding:7px 16px;border-radius:24px;
                    transition:all 0.18s ease;
                    white-space:nowrap;
                }
                .wg-bar-btn:hover{transform:translateY(-2px);filter:brightness(1.12);}
                .wg-bar-btn:active{transform:scale(0.95);}
                .wg-bar-btn.reset{
                    background:rgba(255,255,255,0.12);
                    color:#fff;
                    border:1.5px solid rgba(255,255,255,0.22);
                }
                .wg-bar-btn.reset:hover{background:rgba(255,255,255,0.22);}
                .wg-bar-btn.save{
                    background:#fff;
                    color:#c25000;
                    font-weight:800;
                }
                .wg-bar-btn.save:hover{background:#fff3ee;}
            </style>
            <div class="wg-bar-label">
                <i class="bi bi-pencil-square"></i>
                <span>MODO EDICIÓN</span>
                <span style="opacity:0.55;font-weight:500;margin:0 4px;">—</span>
                <span style="opacity:0.8;font-weight:500;">
                    Arrastra
                    <i class="bi bi-grip-vertical"></i>
                    para reorganizar secciones
                </span>
            </div>
            <div class="wg-bar-actions">
                <button class="wg-bar-btn reset" onclick="resetWidgetLayout()">
                    <i class="bi bi-arrow-counterclockwise"></i>Restablecer
                </button>
                <button class="wg-bar-btn save"  onclick="window._widgetSystem.exitEditMode()">
                    <i class="bi bi-floppy-fill"></i>Guardar
                </button>
            </div>`;
        document.body.appendChild(bar);
        document.body.style.paddingBottom = '52px';
    }

    function removeEditBar() {
        const bar = document.getElementById('widgetEditBar');
        if (bar) {
            bar.style.animation = 'wgBarOut 0.22s ease forwards';
            if (!document.getElementById('_wgBarOutKF')) {
                const s = document.createElement('style');
                s.id = '_wgBarOutKF';
                s.textContent = '@keyframes wgBarOut{from{transform:translateY(0);opacity:1}to{transform:translateY(100%);opacity:0}}';
                document.head.appendChild(s);
            }
            setTimeout(() => bar.remove(), 230);
        }
        document.body.style.paddingBottom = '';
    }

    function enterEditMode() {
        if (_editMode) return;
        _editMode = true;
        buildEditBar();
        _showGrip();
        getContainer().style.position = 'relative';

        if (typeof Sortable !== 'undefined') {
            _sortable = Sortable.create(getWidgetContainer(), {
                animation: 300,
                easing: 'cubic-bezier(0.2,1,0.3,1)',
                handle: '.wg-grip-icon',
                ghostClass: 'sortable-ghost',
                chosenClass: 'sortable-chosen',
                dragClass: 'sortable-drag',
                scroll: true, scrollSensitivity: 60, scrollSpeed: 18, bubbleScroll: true,
                fallbackTolerance: 5,
                onStart() { document.body.style.userSelect = 'none'; document.body.style.cursor = 'grabbing'; },
                onEnd()   { document.body.style.userSelect = ''; document.body.style.cursor = ''; saveOrder(); },
            });
        }

        const btn = document.getElementById('widgetEditModeBtn');
        if (btn) {
            btn.innerHTML = '<i class="bi bi-check-lg"></i>';
            btn.style.background = 'linear-gradient(135deg,#1e8449,#27ae60)';
            btn.title = 'Salir del modo edición';
        }
    }

    function exitEditMode() {
        if (!_editMode) return;
        _editMode = false;
        removeEditBar();
        _hideGrip();
        if (_sortable) { _sortable.destroy(); _sortable = null; }

        const btn = document.getElementById('widgetEditModeBtn');
        if (btn) {
            btn.innerHTML = '<i class="bi bi-pencil-fill"></i>';
            btn.style.background = '';
            btn.title = 'Organizar secciones';
        }
    }

    window.resetWidgetLayout = () => {
        localStorage.removeItem(ORDER_KEY);
        localStorage.removeItem(HIDDEN_KEY);
        location.reload();
    };

    function createEditButton() {
        if (!shouldRun()) return;
        const navBtn = document.getElementById('navWidgetEditBtn');
        if (navBtn) {
            navBtn.style.display = '';
            navBtn.onclick = () => (_editMode ? exitEditMode() : enterEditMode());
            navBtn.id = 'widgetEditModeBtn';
            return;
        }
        if (document.getElementById('widgetEditModeBtn')) return;
        const btn = document.createElement('button');
        btn.id        = 'widgetEditModeBtn';
        btn.title     = 'Organizar secciones';
        btn.innerHTML = '<i class="bi bi-pencil-fill"></i>';
        btn.style.cssText = `
            position:fixed;bottom:30px;right:85px;
            background:linear-gradient(135deg,#d35400,#e67e22);
            color:#fff;border:none;border-radius:50%;
            width:42px;height:42px;font-size:0.95rem;
            cursor:pointer;z-index:1300;
            box-shadow:0 4px 16px rgba(211,84,0,0.35);
            transition:all 0.2s;display:flex;align-items:center;justify-content:center;`;
        btn.onmouseenter = () => { btn.style.transform = 'scale(1.12)'; btn.style.boxShadow = '0 6px 22px rgba(211,84,0,0.5)'; };
        btn.onmouseleave = () => { btn.style.transform = ''; btn.style.boxShadow = '0 4px 16px rgba(211,84,0,0.35)'; };
        btn.onclick = () => (_editMode ? exitEditMode() : enterEditMode());
        document.body.appendChild(btn);
    }

    document.addEventListener('DOMContentLoaded', () => {
        if (!shouldRun() || !getWidgets().length) return;
        restoreOrder();
        addWidgetControls();
        createEditButton();
    });

    window._widgetSystem = { enterEditMode, exitEditMode, saveOrder };

})();
