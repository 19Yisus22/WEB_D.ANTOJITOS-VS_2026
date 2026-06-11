
import logging
from enum import Enum
from functools import wraps

from flask import (
    g, jsonify, make_response, redirect,
    render_template, request, session,
)

from helpers.token_manager import (
    AT_COOKIE, RT_COOKIE,
    clear_auth_cookies,
    has_active_session,
    get_current_rol,
    verify_access_token,
)

_logger = logging.getLogger(__name__)

class Acceso(Enum):
    PUBLICO  = "publico"
    LOGIN    = "login"
    VENDEDOR = "vendedor"
    ADMIN    = "admin"

def _es_api() -> bool:
    return (
        request.path.startswith("/api/")
        or request.headers.get("X-Requested-With") == "XMLHttpRequest"
        or request.method in ("POST", "PUT", "PATCH", "DELETE", "OPTIONS")
        or "application/json" in (request.headers.get("Accept") or "")
    )

def _tiene_cookies_auth() -> bool:
    return bool(request.cookies.get(AT_COOKIE) or request.cookies.get(RT_COOKIE))

def _resp_sin_sesion():
    if _es_api():
        return jsonify({
            "error":    "Debes iniciar sesión para acceder",
            "code":     "UNAUTHENTICATED",
            "redirect": "/login",
        }), 401

    destino = request.path
    resp = make_response(redirect(f"/login?next={destino}"))
    clear_auth_cookies(resp)
    return resp

def _resp_sesion_expirada():
    if _es_api():
        return jsonify({
            "error":    "Tu sesión ha expirado. Inicia sesión de nuevo.",
            "code":     "SESSION_EXPIRED",
            "redirect": "/login",
        }), 401

    resp = make_response(
        render_template("errors/404.html",
                        codigo=401,
                        mensaje="Tu sesión ha expirado. Inicia sesión de nuevo."),
        401,
    )
    clear_auth_cookies(resp)
    return resp

def _resp_sin_permiso(rol_requerido: str):
    rol_actual = session.get("rol", "sin rol")
    _logger.info(
        "Acceso denegado a %s — rol=%s requiere=%s",
        request.path, rol_actual, rol_requerido,
    )
    if _es_api():
        return jsonify({
            "error": "No tienes permiso para realizar esta acción",
            "code":  "FORBIDDEN",
        }), 403

    return render_template("errors/404.html",
                           codigo=403,
                           mensaje="Acceso denegado — no tienes permiso para ver esta página"), 403

def _resp_bloqueado():
    if _es_api():
        return jsonify({
            "error":    "Debes iniciar sesión para acceder",
            "code":     "UNAUTHENTICATED",
            "redirect": "/login",
        }), 401

    resp = make_response(
        render_template("errors/blocked.html", metodos=[], login_required=True)
    )
    clear_auth_cookies(resp)
    return resp

def _verificar_nivel(nivel: Acceso):
    if nivel == Acceso.PUBLICO:
        return None

    activo = has_active_session()

    if not activo:
        if _tiene_cookies_auth():
            return _resp_sesion_expirada()
        if nivel in (Acceso.LOGIN, Acceso.VENDEDOR, Acceso.ADMIN):
            return _resp_bloqueado()
        return _resp_sin_sesion()

    rol = session.get("rol", "cliente")

    if nivel == Acceso.LOGIN:
        return None

    if nivel == Acceso.VENDEDOR:
        if rol not in ("admin", "vendedor"):
            return _resp_sin_permiso("vendedor o admin")
        return None

    if nivel == Acceso.ADMIN:
        if rol != "admin":
            return _resp_sin_permiso("admin")
        return None

    return None

def sin_cache(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        response = make_response(f(*args, **kwargs))
        response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
        response.headers["Pragma"]        = "no-cache"
        response.headers["Expires"]       = "0"
        return response
    return decorated

def requiere_login(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        bloqueo = _verificar_nivel(Acceso.LOGIN)
        if bloqueo is not None:
            return bloqueo
        return f(*args, **kwargs)
    return decorated

def requiere_vendedor(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        bloqueo = _verificar_nivel(Acceso.VENDEDOR)
        if bloqueo is not None:
            return bloqueo
        return f(*args, **kwargs)
    return decorated

def requiere_admin(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        bloqueo = _verificar_nivel(Acceso.ADMIN)
        if bloqueo is not None:
            return bloqueo
        return f(*args, **kwargs)
    return decorated

def requiere_token_api(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        at = request.cookies.get(AT_COOKIE)
        if not at:
            auth_header = request.headers.get("Authorization") or ""
            at = auth_header.removeprefix("Bearer ").strip() or None

        if not at:
            return jsonify({"error": "Token requerido", "code": "NO_TOKEN"}), 401

        result = verify_access_token(at)
        if not result.ok:
            if result.expired:
                return jsonify({
                    "error": "Token expirado — usa /refresh para renovarlo",
                    "code":  "TOKEN_EXPIRED",
                }), 401
            return jsonify({"error": "Token inválido", "code": "INVALID_TOKEN"}), 401

        g.token_cedula = result.payload["sub"]
        g.token_rol    = result.payload.get("rol", "cliente")
        return f(*args, **kwargs)
    return decorated

login_required     = requiere_login
admin_required     = requiere_admin
vendedor_required  = requiere_vendedor
api_token_required = requiere_token_api

RUTAS: dict[str, Acceso] = {

    "/login":                  Acceso.PUBLICO,
    "/registro":               Acceso.PUBLICO,
    "/registro-google":        Acceso.PUBLICO,
    "/refresh":                Acceso.PUBLICO,
    "/logout":                 Acceso.PUBLICO,
    "/inicio":                 Acceso.PUBLICO,
    "/obtener-cliente-id":     Acceso.PUBLICO,

    "/politicas_page":         Acceso.PUBLICO,
    "/condiciones_page":       Acceso.PUBLICO,
    "/manual_page":            Acceso.VENDEDOR,

    "/mi_perfil":                            Acceso.LOGIN,
    "/perfil/restricciones":                 Acceso.LOGIN,
    "/actualizar_perfil":                    Acceso.LOGIN,
    "/eliminar_mi_cuenta":                   Acceso.LOGIN,
    "/cambiar_contrasena":                   Acceso.LOGIN,
    "/perfil/vincular_google":               Acceso.LOGIN,
    "/cloudinary_storage_info":              Acceso.ADMIN,

    "/gestion_usuarios_page":                Acceso.ADMIN,
    "/listar_usuarios":                      Acceso.ADMIN,
    "/actualizar_rol_usuario":               Acceso.ADMIN,
    "/eliminar_usuario_admin":               Acceso.ADMIN,
    "/api/usuarios":                         Acceso.LOGIN,

    "/catalogo_page":          Acceso.PUBLICO,
    "/obtener_catalogo":       Acceso.PUBLICO,

    "/carrito_page":                         Acceso.LOGIN,
    "/obtener_carrito":                      Acceso.LOGIN,
    "/guardar_catalogo":                     Acceso.LOGIN,
    "/agregar_al_carrito":                   Acceso.LOGIN,
    "/carrito_quitar":                       Acceso.LOGIN,
    "/carrito_cantidad":                     Acceso.LOGIN,
    "/finalizar_compra":                     Acceso.LOGIN,
    "/carrito/cumpleanos":                   Acceso.LOGIN,
    "/api/carrito/cantidad":                 Acceso.LOGIN,
    "/api/config/descuento_cumpleanos":      Acceso.ADMIN,

    "/gestionar_productos_page":             Acceso.VENDEDOR,
    "/gestionar_productos":                  Acceso.VENDEDOR,
    "/actualizar_producto":                  Acceso.VENDEDOR,
    "/eliminar_producto":                    Acceso.VENDEDOR,

    "/pedidos_page":                         Acceso.VENDEDOR,
    "/obtener_pedidos":                      Acceso.VENDEDOR,
    "/actualizar_estado":                    Acceso.VENDEDOR,
    "/actualizar_pago_item":                 Acceso.VENDEDOR,
    "/actualizar_pago_general":              Acceso.VENDEDOR,
    "/eliminar_pedidos":                     Acceso.VENDEDOR,
    "/api/mis_pedidos/recientes":            Acceso.LOGIN,

    "/gestionar_facturas_page":              Acceso.LOGIN,
    "/todas_facturas_page":                  Acceso.ADMIN,
    "/obtener_facturas_page":                Acceso.LOGIN,
    "/buscar_facturas_page":                 Acceso.LOGIN,
    "/buscar_facturas_por_numero_page":      Acceso.LOGIN,
    "/archivar_factura_page":                Acceso.LOGIN,
    "/anular_factura_page":                  Acceso.ADMIN,
    "/actualizar_estado_factura_page":       Acceso.VENDEDOR,
    "/obtener_metodos_pago":                 Acceso.PUBLICO,

    "/facturacion_page":                     Acceso.ADMIN,
    "/actualizar_metodo_pago":               Acceso.ADMIN,
    "/eliminar_metodo_pago":                 Acceso.ADMIN,

    "/publicidad_page":                               Acceso.ADMIN,
    "/api/admin/publicidad":                          Acceso.ADMIN,
    "/api/admin/notificaciones":                      Acceso.ADMIN,
    "/api/publicidad/activa":                         Acceso.PUBLICO,
    "/api/publicidad/gestor":                         Acceso.ADMIN,
    "/api/admin/notificaciones_sistema":              Acceso.VENDEDOR,
    "/api/cloudinary/gestor":                         Acceso.ADMIN,
    "/api/cloudinary/gestor/delete":                  Acceso.ADMIN,

    "/api/inicio/config":      Acceso.PUBLICO,
    "/api/inicio/imagenes":    Acceso.PUBLICO,

    "/comentarios_page":                     Acceso.LOGIN,
    "/comentarios":                          Acceso.PUBLICO,
    "/comentarios/limpiar_todo":             Acceso.ADMIN,
    "/usuarios_activos_conteo":              Acceso.PUBLICO,
    "/actualizar_estado_comentarios":        Acceso.LOGIN,

    "/mensajes_privados/predeterminados":    Acceso.LOGIN,
    "/mensajes_privados/mi_hilo":            Acceso.LOGIN,
    "/mensajes_privados/enviar":             Acceso.LOGIN,
    "/mensajes_privados/no_leidos":          Acceso.LOGIN,
    "/mensajes_privados/marcar_leidos":      Acceso.LOGIN,

    "/mensajes_privados/hilos":              Acceso.VENDEDOR,
    "/mensajes_privados/hilo":               Acceso.VENDEDOR,
    "/mensajes_privados/staff":              Acceso.VENDEDOR,
    "/mensajes_privados/staff/marcar_leidos": Acceso.VENDEDOR,
    "/mensajes_privados/staff/contactos":    Acceso.VENDEDOR,
    "/mensajes_privados/staff/enviar":       Acceso.VENDEDOR,

    "/mensajes_privados":                    Acceso.LOGIN,

    "/logros/todos":       Acceso.PUBLICO,
    "/logros/mis_logros":  Acceso.LOGIN,
    "/logros/verificar":   Acceso.LOGIN,
    "/logros/contadores":  Acceso.LOGIN,
}

def _resolver_acceso(path: str) -> Acceso | None:
    if path in RUTAS:
        return RUTAS[path]

    candidatos = sorted(
        ((patron, nivel) for patron, nivel in RUTAS.items() if path.startswith(patron)),
        key=lambda x: len(x[0]),
        reverse=True,
    )
    if candidatos:
        return candidatos[0][1]

    return None

def verificar_ruta(path: str | None = None):
    ruta  = path or request.path
    nivel = _resolver_acceso(ruta)

    if nivel is None:
        return None

    return _verificar_nivel(nivel)

def before_request_access_check():
    if request.path.startswith("/static/"):
        return None

    return verificar_ruta(request.path)

def resumen_acceso() -> dict:
    activo = has_active_session()
    return {
        "sesion_activa": activo,
        "user_id":       session.get("user_id") if activo else None,
        "rol":           session.get("rol") if activo else None,
        "puede_admin":   session.get("rol") == "admin" if activo else False,
        "puede_vendedor": session.get("rol") in ("admin", "vendedor") if activo else False,
    }
