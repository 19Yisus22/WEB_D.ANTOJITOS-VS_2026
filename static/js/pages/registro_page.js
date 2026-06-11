(function() {
    function syncRegTheme() {
        const icon  = document.getElementById('regThemeIcon');
        const label = document.getElementById('regThemeLabel');
        const cur   = document.documentElement.getAttribute('data-theme') || 'light';
        if (icon)  icon.className   = cur === 'dark' ? 'bi bi-sun-fill' : 'bi bi-moon-fill';
        if (label) label.textContent = cur === 'dark' ? 'Claro' : 'Oscuro';
    }
    syncRegTheme();
    new MutationObserver(syncRegTheme).observe(
        document.documentElement,
        { attributes: true, attributeFilter: ['data-theme'] }
    );
})();

(function() {
    function syncRegLang() {
        const lbl = document.getElementById('regLangLabel');
        const cur = document.documentElement.getAttribute('lang') || 'es';
        if (lbl) lbl.textContent = cur === 'es' ? 'EN' : 'ES';
    }
    syncRegLang();
    document.addEventListener('langChanged', syncRegLang);
})();
