(function () {
    var _speed = 1;

    function _baseDuration(track) {
        var vw = window.innerWidth;
        if (track) {
            var tw = track.scrollWidth || vw * 2;
            // Keep each item visible ~35 s at speed=1 regardless of viewport width
            var raw = Math.round(35 * (vw + tw) / vw);
            return Math.min(200, Math.max(40, raw));
        }
        // Fallback breakpoints before track is available
        if (vw < 480)  return 120;
        if (vw < 768)  return 90;
        if (vw < 1024) return 70;
        return 55;
    }

    function buildHTML(items) {
        var sorted = items.slice().sort(function (a, b) {
            return new Date(a.created_at || 0) - new Date(b.created_at || 0);
        });
        var inner = sorted.map(function (item) {
            var validImg = item.imagen_url && item.imagen_url.startsWith('http');
            var img = validImg
                ? '<img src="' + item.imagen_url + '" alt="' + (item.titulo || '') + '" loading="lazy" onerror="this.style.display=\'none\'">'
                : '<i class="bi bi-megaphone ci-item-icon"></i>';
            var label = '<span class="ci-item-label">' + (item.titulo || '') + '</span>';
            return '<div class="ci-item">' + img + label + '</div>';
        }).join('');
        return '<div class="ci-track">' + inner + '</div>';
    }

    function setDuration(track, speed) {
        var base = _baseDuration(track);
        track.dataset.baseDuration = String(base);
        var dur = (base / speed).toFixed(2) + 's';
        track.style.animationDuration = dur;
        track.style.webkitAnimationDuration = dur;
    }

    function applySpeed(speed) {
        var el = document.getElementById('navbarCinta');
        var track = el ? el.querySelector('.ci-track') : null;
        if (!track) return;
        var base = parseFloat(track.dataset.baseDuration) || _baseDuration(track);
        var dur = (base / speed).toFixed(2) + 's';
        track.style.animationDuration = dur;
        track.style.webkitAnimationDuration = dur;
    }

    var _resizeTicker = null;
    window.addEventListener('resize', function () {
        clearTimeout(_resizeTicker);
        _resizeTicker = setTimeout(function () {
            var el = document.getElementById('navbarCinta');
            var track = el ? el.querySelector('.ci-track') : null;
            if (track) setDuration(track, _speed);
        }, 200);
    });

    function init() {
        var el = document.getElementById('navbarCinta');
        if (!el) return;

        Promise.all([
            fetch('/api/publicidad/activa', { cache: 'no-store' }).then(function (r) { return r.json(); }),
            fetch('/api/inicio/config', { cache: 'no-store' }).then(function (r) { return r.json(); })
        ]).then(function (results) {
            var arr = results[0];
            var cfg = results[1];
            _speed = parseFloat(cfg.velocidad_cinta || '1');
            window._tickerSpeedCurrent = _speed;

            var items = Array.isArray(arr)
                ? arr.filter(function (i) {
                    return (i.tipo === 'inicio_cinta' || i.tipo === 'cinta') && i.estado !== false;
                })
                : [];

            if (items.length > 0) {
                el.innerHTML = buildHTML(items);
                el.classList.add('ticker-active');
                document.body.classList.add('has-nav-ticker');

                requestAnimationFrame(function () {
                    var track = el.querySelector('.ci-track');
                    if (track) setDuration(track, _speed);
                });
            } else {
                el.classList.remove('ticker-active');
                document.body.classList.remove('has-nav-ticker');
            }
        }).catch(function () {
            var el2 = document.getElementById('navbarCinta');
            if (el2) el2.classList.remove('ticker-active');
            document.body.classList.remove('has-nav-ticker');
        });
    }

    window.setTickerSpeed = function (speed) {
        _speed = parseFloat(speed) || 1;
        window._tickerSpeedCurrent = _speed;
        applySpeed(_speed);
    };

    window.getTickerSpeed = function () { return _speed; };

    window.saveTickerSpeed = function (s) {
        _speed = parseFloat(s) || 1;
        window._tickerSpeedCurrent = _speed;
        applySpeed(_speed);
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
