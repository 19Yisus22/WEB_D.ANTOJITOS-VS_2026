new Swiper('.loginSwiper', {
    loop: true, autoplay: { delay: 4000, disableOnInteraction: false },
    effect: 'fade',
    pagination: { el: '.swiper-pagination', clickable: true },
    speed: 800,
});

(function() {
    const canvas = document.getElementById('bubblesCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let bubbles = [];

    function resize() {
        canvas.width  = canvas.offsetWidth;
        canvas.height = canvas.offsetHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    function createBubble() {
        return {
            x: Math.random() * canvas.width,
            y: canvas.height + 30,
            r: 6 + Math.random() * 22,
            speed: 0.5 + Math.random() * 1.2,
            opacity: 0.05 + Math.random() * 0.18,
            dx: (Math.random() - 0.5) * 0.6,
        };
    }

    for (let i = 0; i < 18; i++) {
        const b = createBubble();
        b.y = Math.random() * canvas.height;
        bubbles.push(b);
    }

    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        bubbles.forEach((b, i) => {
            b.y -= b.speed;
            b.x += b.dx;
            ctx.beginPath();
            ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(255,255,255,${b.opacity})`;
            ctx.lineWidth = 1.5;
            ctx.stroke();
            ctx.fillStyle = `rgba(255,255,255,${b.opacity * 0.3})`;
            ctx.fill();
            if (b.y + b.r < 0) bubbles[i] = createBubble();
        });
        if (bubbles.length < 20 && Math.random() < 0.02) bubbles.push(createBubble());
        requestAnimationFrame(animate);
    }
    animate();
})();

(function() {
    function syncThemeBtn() {
        const icon  = document.getElementById('loginThemeIcon');
        const label = document.getElementById('loginThemeLabel');
        const cur   = document.documentElement.getAttribute('data-theme') || 'light';
        if (icon)  icon.className  = cur === 'dark' ? 'bi bi-sun-fill' : 'bi bi-moon-fill';
        if (label) label.textContent = cur === 'dark' ? 'Claro' : 'Oscuro';
    }
    syncThemeBtn();
    new MutationObserver(syncThemeBtn).observe(
        document.documentElement,
        { attributes: true, attributeFilter: ['data-theme'] }
    );
})();

(function() {
    function syncLangLabel() {
        const lbl = document.getElementById('loginLangLabel');
        const cur = document.documentElement.getAttribute('lang') || 'es';
        if (lbl) lbl.textContent = cur === 'es' ? 'EN' : 'ES';
    }
    syncLangLabel();
    document.addEventListener('langChanged', syncLangLabel);
})();
