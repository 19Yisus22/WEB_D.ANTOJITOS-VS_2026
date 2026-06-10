let _notifLog = JSON.parse(localStorage.getItem('pedidos_notif_log') || '[]');

const PEDIDOS_ICONS = {
    nuevo:     'bi-cart-plus text-success',
    cancelado: 'bi-x-circle text-danger',
    estado:    'bi-arrow-repeat text-primary',
    pago:      'bi-cash-coin text-warning',
    info:      'bi-info-circle text-muted'
};

function addNotifLog(tipo, mensaje, datos = {}) {
    const esAdmin = !!document.getElementById('navPubBtn');
    if (esAdmin  && !['pago', 'cancelado'].includes(tipo)) return;
    if (!esAdmin && tipo === 'pago') return;

    const entry = {
        id:     Date.now(),
        tipo, mensaje, datos,
        hora:   new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }),
        activa: true
    };
    _notifLog.unshift(entry);
    if (_notifLog.length > 30) _notifLog.pop();
    localStorage.setItem('pedidos_notif_log', JSON.stringify(_notifLog));
    _syncNavBell();
    _renderNavSistemPanel();
}

let _prevBellCount = 0;

function _syncNavBell() {
    const total = _notifLog.length;
    const cnt   = total > 9 ? '9+' : String(total);
    const badge = document.getElementById('navBellBadge');
    const count = document.getElementById('sistemCount');
    const empty = document.getElementById('sistemEmpty');
    if (badge) {
        badge.textContent = cnt;
        badge.style.display = total > 0 ? 'flex' : 'none';
        if (total > _prevBellCount && typeof _animateBadge === 'function') _animateBadge(badge);
    }
    if (count) { count.textContent = cnt; count.style.display = total > 0 ? 'inline-flex' : 'none'; }
    if (empty) empty.style.display = total === 0 ? 'flex' : 'none';
    _prevBellCount = total;
}

function _renderNavSistemPanel() {
    const list  = document.getElementById('sistemList');
    const empty = document.getElementById('sistemEmpty');
    if (!list) return;
    if (_notifLog.length === 0) {
        list.innerHTML = '';
        if (empty) empty.style.display = 'flex';
        return;
    }
    if (empty) empty.style.display = 'none';
    list.innerHTML = _notifLog.map(n => `
        <li class="notif-item" data-notif-id="${n.id}" style="cursor:pointer;"
            onclick="_pedidosNotifNav(event,${n.id})">
            <div class="notif-item-img">
                <i class="bi ${PEDIDOS_ICONS[n.tipo] || PEDIDOS_ICONS.info}" style="font-size:1rem;"></i>
            </div>
            <div class="notif-item-info">
                <strong>${n.mensaje}</strong>
                <small>${n.hora}</small>
            </div>
            <div class="notif-item-actions">
                <button class="btn-notif-visto"
                        onclick="event.stopPropagation();_pedidosMarcarVisto(${n.id})"
                        title="Marcar como visto">
                    <i class="bi bi-check2"></i>
                </button>
            </div>
        </li>`).join('');
}

window._pedidosNotifNav = function(e, notifId) {
    if (e.target.closest('.btn-notif-visto')) return;
    _notifLog = _notifLog.filter(x => x.id !== notifId);
    localStorage.setItem('pedidos_notif_log', JSON.stringify(_notifLog));
    window.location.href = '/pedidos_page';
};

window._pedidosMarcarVisto = function(id) {
    const li = document.querySelector(`[data-notif-id="${id}"]`);
    if (li) {
        li.style.transition = 'opacity 0.22s, transform 0.22s';
        li.style.opacity    = '0';
        li.style.transform  = 'translateX(18px)';
        setTimeout(() => {
            _notifLog = _notifLog.filter(x => x.id !== id);
            localStorage.setItem('pedidos_notif_log', JSON.stringify(_notifLog));
            _syncNavBell();
            _renderNavSistemPanel();
        }, 240);
    }
};

window._pedidosMarcarTodo = function() {
    const items = [...document.querySelectorAll('#sistemList .notif-item')];
    items.forEach((li, i) => {
        setTimeout(() => {
            li.style.transition = 'opacity 0.2s, transform 0.2s';
            li.style.opacity    = '0';
            li.style.transform  = 'translateX(18px)';
        }, i * 40);
    });
    setTimeout(() => {
        _notifLog = [];
        localStorage.setItem('pedidos_notif_log', JSON.stringify(_notifLog));
        _syncNavBell();
        _renderNavSistemPanel();
    }, items.length * 40 + 250);
    const readAllBtn = document.getElementById('sistemReadAllBtn');
    if (readAllBtn) {
        readAllBtn.innerHTML = '<i class="bi bi-check2-all"></i><span class="notif-read-label">Listo ✓</span>';
        readAllBtn.disabled  = true;
        readAllBtn.classList.add('did-read');
        setTimeout(() => {
            readAllBtn.innerHTML = '<i class="bi bi-check2-all"></i><span class="notif-read-label">Leído</span>';
            readAllBtn.disabled  = false;
            readAllBtn.classList.remove('did-read');
        }, 3000);
    }
};

window.addNotifLog = addNotifLog;

document.addEventListener('DOMContentLoaded', () => {
    _syncNavBell();
    _renderNavSistemPanel();
    window.cargarNotificacionesSistema = function() { _renderNavSistemPanel(); };
});
