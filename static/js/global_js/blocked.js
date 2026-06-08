document.addEventListener('DOMContentLoaded', () => {
    const card = document.querySelector('[data-redirect]');
    if (!card) return;
    const url   = card.dataset.redirect;
    const delay = parseInt(card.dataset.delay || '3000', 10);
    if (url) setTimeout(() => { window.location.href = url; }, delay);
});
