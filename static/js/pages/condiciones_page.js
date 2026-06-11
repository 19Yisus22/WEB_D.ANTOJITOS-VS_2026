function acceptTerms() {
    const btn = document.querySelector('.btn-accept');
    btn.innerHTML = '<i class="bi bi-heart-fill me-2 animate-beat"></i>¡Gracias!';
    btn.style.background = '#27ae60';
    btn.disabled = true;
    setTimeout(() => { window.location.href = "/login"; }, 1200);
}
(function() {
    function syncLegal() {
        const theme = document.documentElement.getAttribute('data-theme') || 'light';
        const icon  = document.getElementById('legalThemeIcon');
        const lbl   = document.getElementById('legalThemeLabel');
        const llbl  = document.getElementById('legalLangLabel');
        const lang  = document.documentElement.getAttribute('lang') || 'es';
        if (icon) icon.className = theme === 'dark' ? 'bi bi-sun-fill' : 'bi bi-moon-fill';
        if (lbl)  lbl.textContent = theme === 'dark' ? 'Claro' : 'Oscuro';
        if (llbl) llbl.textContent = lang === 'es' ? 'EN' : 'ES';
    }
    syncLegal();
    new MutationObserver(syncLegal).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme','lang'] });
    document.addEventListener('langChanged', syncLegal);
})();
