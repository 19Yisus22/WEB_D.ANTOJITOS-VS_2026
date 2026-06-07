import sys
sys.dont_write_bytecode = True

import os
import socket
import secrets
import logging
import cloudinary

logging.getLogger('werkzeug').setLevel(logging.ERROR)
try:
    import flask.cli
    flask.cli.show_server_banner = lambda *a, **kw: None
except Exception:
    pass
from dotenv import load_dotenv
from flask import Flask, redirect, request
from flask_cors import CORS
from datetime import timedelta

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

app = Flask(__name__, template_folder=TEMPLATES_DIR, static_folder=STATIC_DIR)
app.secret_key                   = os.getenv("FLASK_SECRET_KEY") or secrets.token_hex(24)
app.permanent_session_lifetime   = timedelta(days=1)
app.config["MAX_CONTENT_LENGTH"] = 50 * 1024 * 1024
CORS(app, supports_credentials=True)

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

@app.after_request
def agregar_cabeceras(response):
    response.headers["Cross-Origin-Opener-Policy"]  = "same-origin-allow-popups"
    response.headers["Cross-Origin-Resource-Policy"] = "cross-origin"
    response.headers["Access-Control-Allow-Origin"]  = "*"
    response.headers["X-Content-Type-Options"]       = "nosniff"
    response.headers["X-Frame-Options"]              = "SAMEORIGIN"
    response.headers["Referrer-Policy"]              = "strict-origin-when-cross-origin"
    return response

_RUTAS_PUBLICAS = frozenset({
    "/login", "/registro", "/registro-google", "/logout",
    "/refresh", "/obtener-cliente-id",
})

@app.before_request
def redirect_root():
    if request.path == "/":
        return redirect("/inicio")

@app.before_request
def auto_rebuild_session_from_token():
    from flask import session as _session
    from helpers.auth import verify_access_token, verify_refresh_token, hash_token, _build_session_data
    import helpers.models as db

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
        app.run(host=host, port=port, debug=True, threaded=True)
    else:
        print("\033[92m" + "PRODUCTION MODE" + "\033[0m")
        print("\033[36m" + f"Local : http://localhost:{port}" + "\033[0m")
        print("\033[92m" + f"Red   : http://{local_ip}:{port}" + "\033[0m")
        app.run(host=host, port=port, debug=False, threaded=True)