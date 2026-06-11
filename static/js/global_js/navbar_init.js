(function() {
    var nav = document.querySelector('#main-navbar-container .navbar');
    if (!nav) return;
    window.addEventListener('scroll', function() {
        nav.classList.toggle('scrolled', window.scrollY > 8);
    }, { passive: true });
})();

(function() {
    const INACTIVITY_LIMIT = 300000;
    const statusContainer = document.getElementById('statusContainer');
    const statusLabel = document.getElementById('userStatusLabel');
    let timeout;

    if (!statusContainer || !statusLabel) return;

    function updateStatusUI(isOnline) {
        if (isOnline) {
            statusLabel.textContent = 'Online';
            statusContainer.classList.remove('text-muted');
            statusContainer.classList.add('text-success');
            statusContainer.style.color = '';
        } else {
            statusLabel.textContent = 'Inactive';
            statusContainer.classList.remove('text-success');
            statusContainer.classList.add('text-muted');
            statusContainer.style.color = '#6c757d';
        }
    }

    function setInactive() {
        updateStatusUI(false);
        localStorage.setItem('user_status', 'inactive');
    }

    function resetTimer() {
        const lastStatus = localStorage.getItem('user_status');
        if (lastStatus === 'inactive' || statusLabel.textContent === 'Inactive') {
            updateStatusUI(true);
        }
        localStorage.setItem('user_status', 'online');
        localStorage.setItem('last_activity', Date.now());
        clearTimeout(timeout);
        timeout = setTimeout(setInactive, INACTIVITY_LIMIT);
    }

    function checkGlobalStatus() {
        const lastActivity = parseInt(localStorage.getItem('last_activity') || 0);
        const currentTime = Date.now();
        if (currentTime - lastActivity > INACTIVITY_LIMIT) {
            updateStatusUI(false);
        } else {
            updateStatusUI(true);
            const remaining = INACTIVITY_LIMIT - (currentTime - lastActivity);
            clearTimeout(timeout);
            timeout = setTimeout(setInactive, remaining);
        }
    }

    window.addEventListener('storage', (e) => {
        if (e.key === 'user_status') updateStatusUI(e.newValue === 'online');
    });

    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    events.forEach(name => document.addEventListener(name, resetTimer, true));

    checkGlobalStatus();
})();

(function() {
    var KEY = 'da_scroll_' + location.pathname;
    var navEntry = performance.getEntriesByType ? performance.getEntriesByType('navigation')[0] : null;
    var isReload = navEntry ? navEntry.type === 'reload' : (window.performance && window.performance.navigation.type === 1);
    if (isReload) {
        var y = parseInt(sessionStorage.getItem(KEY) || '0', 10);
        if (y > 0) {
            window.scrollTo(0, y);
            window.addEventListener('load', function() { window.scrollTo(0, y); }, { once: true });
        }
    } else {
        sessionStorage.removeItem(KEY);
    }
    window.addEventListener('beforeunload', function() {
        sessionStorage.setItem(KEY, String(window.scrollY));
    });
})();
