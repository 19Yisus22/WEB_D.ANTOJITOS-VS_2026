function toggleSidebar() {
    const aside   = document.querySelector('aside');
    const overlay = document.getElementById('sidebarOverlay');
    const icon    = document.getElementById('menuToggleIcon');
    if (!aside) return;
    const abierto = aside.classList.toggle('abierto');
    if (overlay) overlay.classList.toggle('activo', abierto);
    if (icon) {
        icon.className = abierto ? 'bi bi-x-lg' : 'bi bi-list';
    }
}

function cerrarSidebarMovil() {
    if (window.innerWidth > 768) return;
    const aside   = document.querySelector('aside');
    const overlay = document.getElementById('sidebarOverlay');
    const icon    = document.getElementById('menuToggleIcon');
    if (aside)   aside.classList.remove('abierto');
    if (overlay) overlay.classList.remove('activo');
    if (icon)    icon.className = 'bi bi-list';
}

function showSection(sectionId) {
    document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
        if (item.innerHTML.toLowerCase().includes(sectionId.toLowerCase())) {
            item.classList.add('active');
        }
    });
    const target = document.getElementById(sectionId);
    if (target) {
        target.classList.add('active');
        const main = document.querySelector('main');
        if (main) main.scrollTop = 0;
    }
    cerrarSidebarMovil();
}
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/static/js/workers/sw-ui.js').catch(() => {});
    });
}
