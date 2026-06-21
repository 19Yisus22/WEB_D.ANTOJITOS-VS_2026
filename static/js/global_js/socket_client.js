(function () {
    if (typeof io === 'undefined') return;
    if (!window.USER_CONFIG || !window.USER_CONFIG.isLogged) return;

    const _RECONNECT_LIMIT = 6;
    const _POLL_FAST  = 8000;
    const _POLL_SLOW  = 45000;

    window.SOCKET_CONNECTED = false;

    const socket = io({
        transports: ['polling'],
        upgrade: false,
        reconnectionAttempts: _RECONNECT_LIMIT,
        reconnectionDelay: 1200,
        reconnectionDelayMax: 8000,
        timeout: 20000,
    });

    function _setPollingSpeed(fast) {
        document.dispatchEvent(new CustomEvent('socket:polling_mode', { detail: { fast } }));
    }

    socket.on('connect', function () {
        window.SOCKET_CONNECTED = true;
        _setPollingSpeed(false);
        document.dispatchEvent(new Event('socket:connected'));
    });

    socket.on('disconnect', function () {
        window.SOCKET_CONNECTED = false;
        _setPollingSpeed(true);
        document.dispatchEvent(new Event('socket:disconnected'));
    });

    socket.on('connect_error', function () {
        window.SOCKET_CONNECTED = false;
        _setPollingSpeed(true);
    });

    var _FORWARD = [
        'factura_update',
        'pedido_update',
        'chat_new_msg',
        'priv_new_msg',
        'chat_cleanup',
        'priv_cleanup',
        'logro_new',
        'notificacion',
        'pong_alive',
    ];

    _FORWARD.forEach(function (evt) {
        socket.on(evt, function (data) {
            document.dispatchEvent(new CustomEvent('socket:' + evt, { detail: data || {} }));
        });
    });

    setInterval(function () {
        if (socket.connected) socket.emit('ping_alive');
    }, 30000);

    window.DA_SOCKET = socket;
}());
