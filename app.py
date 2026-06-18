from gevent import monkey as _gm
_gm.patch_all()
import sys
sys.dont_write_bytecode = True
import os
import socket
import secrets
import logging
import cloudinary

logging.getLogger('werkzeug').setLevel(logging.ERROR)
logging.getLogger('httpx').setLevel(logging.WARNING)
logging.getLogger('httpcore').setLevel(logging.WARNING)

class _ColorFormatter(logging.Formatter):
    _RESET = '\033[0m'
    _BOLD  = '\033[1m'
    _COLORS = {
        logging.DEBUG:    '\033[36m',
        logging.INFO:     '\033[32m',
        logging.WARNING:  '\033[33m',
        logging.ERROR:    '\033[31m',
        logging.CRITICAL: '\033[35m',
    }
    def format(self, record):
        color = self._COLORS.get(record.levelno, self._RESET)
        level = f'{color}{self._BOLD}{record.levelname:<8}{self._RESET}'
        module = f'\033[90m{record.name:<20}{self._RESET}'
        msg = super().format(record)
        msg_only = record.getMessage()
        time_str = self.formatTime(record, self.datefmt)
        return f'\033[90m[{time_str}]{self._RESET} {level} {module} {msg_only}'

_handler = logging.StreamHandler(sys.stdout)
_handler.setFormatter(_ColorFormatter(datefmt='%H:%M:%S'))
logging.basicConfig(level=logging.INFO, handlers=[_handler], force=True)
_logger = logging.getLogger('dantojitos')
try:
    import flask.cli
    flask.cli.show_server_banner = lambda *a, **kw: None
except Exception:
    pass
from dotenv import load_dotenv
from flask import Flask, redirect, request
from flask_cors import CORS
from datetime import timedelta
from extensions import socketio

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(BASE_DIR, ".env"))

_CLD_NAME   = os.getenv("CLOUDINARY_CLOUD_NAME")
_CLD_KEY    = os.getenv("CLOUDINARY_API_KEY")
_CLD_SECRET = os.getenv("CLOUDINARY_API_SECRET")

if _CLD_NAME and _CLD_KEY and _CLD_SECRET:
    cloudinary.config(cloud_name=_CLD_NAME, api_key=_CLD_KEY, api_secret=_CLD_SECRET)

TEMPLATES_DIR = os.path.join(BASE_DIR, "templates")
STATIC_DIR    = os.path.join(BASE_DIR, "static")
UPLOAD_DIR    = os.path.join(STATIC_DIR, "uploads")
try:
    os.makedirs(UPLOAD_DIR, exist_ok=True)
except OSError:
    pass

_IS_PROD = os.getenv("FLASK_DEBUG", "").lower() not in ("1", "true", "debug")

app = Flask(__name__, template_folder=TEMPLATES_DIR, static_folder=STATIC_DIR)
app.secret_key                        = os.getenv("FLASK_SECRET_KEY") or secrets.token_hex(24)
app.permanent_session_lifetime        = timedelta(days=1)
app.config["MAX_CONTENT_LENGTH"]      = 50 * 1024 * 1024
app.config["SESSION_COOKIE_HTTPONLY"] = True
app.config["SESSION_COOKIE_SECURE"]   = _IS_PROD
app.config["SESSION_COOKIE_SAMESITE"] = "Strict"
CORS(app, supports_credentials=True)

socketio.init_app(
    app,
    cors_allowed_origins="*",
    async_mode="gevent",
    ping_timeout=60,
    ping_interval=25,
    logger=False,
    engineio_logger=False,
)

from controllers.auth               import auth_bp
from controllers.perfil             import perfil_bp
from controllers.perfil_usuarios    import perfil_usuarios_bp
from controllers.gestion_productos  import gestion_productos_bp
from controllers.catalogo_productos import catalogo_productos_bp
from controllers.carrito            import carrito_bp
from controllers.pedidos_usuarios   import pedidos_usuarios_bp
from controllers.historial_facturas import historial_facturas_bp
from controllers.publicidad         import publicidad_bp
from controllers.inicio             import inicio_bp
from controllers.facturacion        import facturacion_bp
from controllers.comentarios        import comentarios_bp
from controllers.paginas_estaticas  import paginas_estaticas_bp
from controllers.logros             import logros_bp

app.register_blueprint(auth_bp)
app.register_blueprint(perfil_bp)
app.register_blueprint(perfil_usuarios_bp)
app.register_blueprint(gestion_productos_bp)
app.register_blueprint(catalogo_productos_bp)
app.register_blueprint(carrito_bp)
app.register_blueprint(pedidos_usuarios_bp)
app.register_blueprint(historial_facturas_bp)
app.register_blueprint(publicidad_bp)
app.register_blueprint(inicio_bp)
app.register_blueprint(facturacion_bp)
app.register_blueprint(comentarios_bp)
app.register_blueprint(paginas_estaticas_bp)
app.register_blueprint(logros_bp)

import sockets_handlers

@app.after_request
def agregar_cabeceras(response):
    response.headers["Cross-Origin-Opener-Policy"]   = "same-origin-allow-popups"
    response.headers["Cross-Origin-Resource-Policy"] = "cross-origin"
    response.headers["Access-Control-Allow-Origin"]  = "*"
    response.headers["X-Content-Type-Options"]       = "nosniff"
    response.headers["X-Frame-Options"]              = "SAMEORIGIN"
    response.headers["Referrer-Policy"]              = "strict-origin-when-cross-origin"
    return response

from flask import render_template as _rt

@app.errorhandler(404)
def pagina_no_encontrada(_):
    _logger.warning("404 — %s %s", request.method, request.path)
    return _rt("errors/404.html", codigo=404, mensaje="Página no encontrada"), 404

@app.errorhandler(401)
def no_autorizado(_):
    _logger.warning("401 — %s %s — usuario: %s", request.method, request.path, request.remote_addr)
    return _rt("errors/404.html", codigo=401, mensaje="No autorizado"), 401

@app.errorhandler(403)
def acceso_denegado(_):
    _logger.warning("403 — %s %s — usuario: %s", request.method, request.path, request.remote_addr)
    return _rt("errors/404.html", codigo=403, mensaje="Acceso denegado"), 403

@app.errorhandler(500)
def error_servidor(e):
    _logger.error("500 — %s %s — %s", request.method, request.path, str(e), exc_info=True)
    return _rt("errors/404.html", codigo=500, mensaje="Error interno del servidor"), 500

@app.route("/offline")
def offline_page():
    return _rt("errors/offline.html"), 200

@app.route("/admin/preview-error")
def preview_error_page():
    from flask import session as _s, abort
    if _s.get('rol') != 'admin':
        abort(403)
    codigo = request.args.get('codigo', 404, type=int)
    mensajes = { 404: 'Página no encontrada', 403: 'Acceso denegado', 401: 'No autorizado', 500: 'Error interno del servidor',}
    return _rt("errors/404.html", codigo=codigo, mensaje=mensajes.get(codigo, 'Error'))

_RUTAS_PUBLICAS = frozenset({"/login", "/registro", "/registro-google", "/logout", "/refresh", "/obtener-cliente-id", "/offline",})

@app.before_request
def redirect_root():
    if request.path == "/":
        return redirect("/inicio")

@app.before_request
def auto_rebuild_session_from_token():
    from flask import session as _session
    from helpers.auth import verify_access_token, verify_refresh_token, hash_token, _build_session_data
    import database.models as db

    if request.path.startswith("/static/"):
        return
    if any(request.path.startswith(p) for p in _RUTAS_PUBLICAS):
        return
    if _session.get("user_id"):
        return

    at = request.cookies.get("_at")
    if at:
        payload = verify_access_token(at)
        if payload and payload.get("type") == "access":
            try:
                user = db.usuario_get(payload["sub"])
                if user:
                    _build_session_data(user)
            except Exception:
                pass
        return

    rt = request.cookies.get("_rt")
    if not rt:
        return

    rt_payload = verify_refresh_token(rt)
    if not rt_payload or rt_payload.get("type") != "refresh":
        return

    cedula = rt_payload.get("sub")
    if not cedula:
        return

    try:
        from datetime import datetime, timezone
        stored = db.usuario_get_web_token(cedula)
        if not stored or not stored.get("web_token"):
            return
        if stored["web_token"] != hash_token(rt):
            return
        exp_str = stored.get("expires_at")
        if exp_str:
            exp_dt = datetime.fromisoformat(exp_str.replace("Z", "+00:00"))
            if exp_dt < datetime.now(timezone.utc):
                db.usuario_clear_web_token(cedula)
                return
        user = db.usuario_get(cedula)
        if user:
            _build_session_data(user)
    except Exception:
        pass

def _get_local_ip() -> str:
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("8.8.8.8", 80))
        return s.getsockname()[0]
    except Exception:
        return "0.0.0.0"
    finally:
        s.close()

if __name__ == "__main__":
    host, port, local_ip, debug_mode = "0.0.0.0", 8000, _get_local_ip(), True

    if debug_mode:
        print("\033[93m" + "MODE DEVELOPMENT - DEBUG" + "\033[0m")
        print("\033[36m" + f"Local : http://localhost:{port}" + "\033[0m")
        print("\033[92m" + f"Red   : http://{local_ip}:{port}" + "\033[0m")
        socketio.run(app, host=host, port=port, debug=False, use_reloader=False)
    else:
        print("\033[92m" + "PRODUCTION MODE" + "\033[0m")
        print("\033[36m" + f"Local : http://localhost:{port}" + "\033[0m")
        print("\033[92m" + f"Red   : http://{local_ip}:{port}" + "\033[0m")
        socketio.run(app, host=host, port=port, debug=False)

# D'Antojitos© 2023 - Todos los derechos reservados