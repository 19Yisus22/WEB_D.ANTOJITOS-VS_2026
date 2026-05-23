document.addEventListener('DOMContentLoaded', function () {
    const botonDescargar = document.querySelector('#boton-descargar-history');
    if (!botonDescargar) {
        return;
    }
    botonDescargar.addEventListener('click', function () {
        botonDescargar.classList.add('loading');
        setTimeout(function () {
            botonDescargar.classList.remove('loading');
        }, 1200);
    });
    const formHist = document.getElementById('form-historico');
    if (formHist) {
        formHist.addEventListener('submit', function () {
            const btn = formHist.querySelector('button[type="submit"]');
            if (btn) {
                btn.classList.add('loading');
                btn.disabled = true;
                btn.textContent = ' Iniciando entrenamiento...';
            }
        });
    }
});
