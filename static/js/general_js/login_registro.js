document.addEventListener('DOMContentLoaded', () => {
    if (typeof loadGoogleButton === 'function')  loadGoogleButton();
    if (typeof initLoginForm === 'function')     initLoginForm();
    if (typeof initRegistroForm === 'function')  initRegistroForm();
    if (typeof initStep2 === 'function')         initStep2();
});
