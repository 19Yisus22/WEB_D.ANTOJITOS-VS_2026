import sys
sys.dont_write_bytecode = True

import os
import socket
import secrets
import logging
import cloudinary
from dotenv import load_dotenv
from waitress import serve
from flask import Flask, redirect, request
from flask_cors import CORS
from datetime import timedelta

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(BASE_DIR, ".env"))

_CLD_NAME   = os.getenv("CLOUDINARY_CLOUD_NAME")
_CLD_KEY    = os.getenv("CLOUDINARY_API_KEY")
_CLD_SECRET = os.getenv("CLOUDINARY_API_SECRET")

if not _CLD_NAME or not _CLD_KEY or not _CLD_SECRET:
    raise ValueError("Faltan credenciales de Cloudinary en .env")
cloudinary.config(cloud_name=_CLD_NAME, api_key=_CLD_KEY, api_secret=_CLD_SECRET,)

TEMPLATES_DIR = os.path.join(BASE_DIR, "templates")
STATIC_DIR    = os.path.join(BASE_DIR, "static")
UPLOAD_DIR    = os.path.join(STATIC_DIR, "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

app = Flask(__name__, template_folder=TEMPLATES_DIR, static_folder=STATIC_DIR)
app.secret_key                   = os.getenv("FLASK_SECRET_KEY") or secrets.token_hex(24)
app.permanent_session_lifetime   = timedelta(days=1)
app.config["MAX_CONTENT_LENGTH"] = 50 * 1024 * 1024
CORS(app, supports_credentials=True)
logging.getLogger("waitress").setLevel(logging.ERROR)

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

@app.after_request
def agregar_cabeceras(response):
    response.headers["Cross-Origin-Opener-Policy"]  = "same-origin-allow-popups"
    response.headers["Cross-Origin-Resource-Policy"] = "cross-origin"
    response.headers["Access-Control-Allow-Origin"]  = "*"
    return response

@app.before_request
def redirect_root():
    if request.path == "/":
        return redirect("/inicio")

def _get_local_ip() -> str:
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("8.8.8.8", 80))
        return s.getsockname()[0]
    except Exception:
        return "127.0.0.1"
    finally:
        s.close()

if __name__ == "__main__":
    host      = "0.0.0.0"
    port      = 8000
    local_ip  = _get_local_ip()
    debug_mode = False  # Cambia a True para desarrollo local

    if debug_mode:
        print("Ejecutando en modo DEBUG")
        print(f"  Local : http://localhost:{port}")
        print(f"  Red   : http://{local_ip}:{port}")
        app.run(host=host, port=port, debug=True, threaded=True)
    else:
        print("Servidor en produccion con Waitress")
        print(f"  Local : http://localhost:{port}")
        print(f"  Red   : http://{local_ip}:{port}")
        serve(app, host=host, port=port, threads=10)