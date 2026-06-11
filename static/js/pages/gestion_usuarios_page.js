document.getElementById('buscarUsuario').addEventListener('input', function() {
    const btn = document.getElementById('btnClearSearch');
    if (btn) btn.style.display = this.value.length > 0 ? 'flex' : 'none';
});
document.querySelectorAll('.gu-select-wrap').forEach(wrap => {
    wrap.addEventListener('mousedown', function(e) {
        if (e.target === this) {
            const sel = this.querySelector('select');
            if (sel) { e.preventDefault(); try { sel.showPicker(); } catch { sel.focus(); } }
        }
    });
});
