import os
import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from functools import wraps

import jwt
from flask import session, request, jsonify, redirect, render_template, make_response, g

_ACCESS_SECRET  = os.getenv("ACCESS_TOKEN_SECRET",  secrets.token_hex(32))
_REFRESH_SECRET = os.getenv("REFRESH_TOKEN_SECRET", secrets.token_hex(32))

ACCESS_TOKEN_TTL_MINUTES  = 5
REFRESH_TOKEN_TTL_DAYS    = 7

_AT_COOKIE = "_at"
_RT_COOKIE = "_rt"


def _is_https() -> bool:
    return not os.getenv("FLASK_DEBUG", "").lower() in ("1", "true", "debug")


def sin_cache(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        response = make_response(f(*args, **kwargs))
        response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
        response.headers["Pragma"]        = "no-cache"
        response.headers["Expires"]       = "0"
        return response
    return decorated


def _is_ajax_or_api():
    return (
        request.headers.get("X-Requested-With") == "XMLHttpRequest"
        or request.path.startswith("/api/")
        or request.method in ("POST", "PUT", "DELETE", "PATCH")
    )


def create_access_token(cedula: str, rol: str) -> str:
    payload = {
        "sub":  str(cedula),
        "rol":  rol,
        "type": "access",
        "iat":  datetime.now(timezone.utc),
        "exp":  datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_TTL_MINUTES),
    }
    return jwt.encode(payload, _ACCESS_SECRET, algorithm="HS256")


def create_refresh_token(cedula: str) -> tuple[str, datetime]:
    expires_at = datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_TTL_DAYS)
    payload = {
        "sub":  str(cedula),
        "jti":  secrets.token_hex(16),
        "type": "refresh",
        "iat":  datetime.now(timezone.utc),
        "exp":  expires_at,
    }
    token = jwt.encode(payload, _REFRESH_SECRET, algorithm="HS256")
    return token, expires_at


def verify_access_token(token: str) -> dict | None:
    try:
        return jwt.decode(token, _ACCESS_SECRET, algorithms=["HS256"])
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None


def verify_refresh_token(token: str) -> dict | None:
    try:
        return jwt.decode(token, _REFRESH_SECRET, algorithms=["HS256"])
    except jwt.InvalidTokenError:
        return None


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def set_auth_cookies(response, access_token: str, refresh_token: str) -> None:
    secure = _is_https()
    response.set_cookie(
        _AT_COOKIE, access_token,
        max_age=ACCESS_TOKEN_TTL_MINUTES * 60,
        httponly=True,
        secure=secure,
        samesite="Strict",
        path="/"
    )
    response.set_cookie(
        _RT_COOKIE, refresh_token,
        max_age=REFRESH_TOKEN_TTL_DAYS * 24 * 3600,
        httponly=True,
        secure=secure,
        samesite="Strict",
        path="/"
    )


def clear_auth_cookies(response) -> None:
    response.delete_cookie(_AT_COOKIE, path="/")
    response.delete_cookie(_RT_COOKIE, path="/")


def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if session.get("user_id"):
            return f(*args, **kwargs)
        if _try_rebuild_session_from_at():
            return f(*args, **kwargs)
        if _is_ajax_or_api():
            return jsonify({"error": "No autorizado", "code": "UNAUTHENTICATED"}), 401
        return render_template("global_modules/blocked.html", metodos=[], login_required=True)
    return decorated


def admin_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if not _ensure_authenticated():
            if _is_ajax_or_api():
                return jsonify({"error": "No autorizado", "code": "UNAUTHENTICATED"}), 401
            return render_template("global_modules/blocked.html", metodos=[])
        if session.get("rol") != "admin":
            if _is_ajax_or_api():
                return jsonify({"error": "Acceso denegado", "code": "FORBIDDEN"}), 403
            return render_template("global_modules/blocked.html", metodos=[])
        return f(*args, **kwargs)
    return decorated


def vendedor_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if not _ensure_authenticated():
            if _is_ajax_or_api():
                return jsonify({"error": "No autorizado", "code": "UNAUTHENTICATED"}), 401
            return render_template("global_modules/blocked.html", metodos=[])
        if session.get("rol") not in ("admin", "vendedor"):
            if _is_ajax_or_api():
                return jsonify({"error": "Acceso denegado", "code": "FORBIDDEN"}), 403
            return render_template("global_modules/blocked.html", metodos=[])
        return f(*args, **kwargs)
    return decorated


def api_token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        at = request.cookies.get(_AT_COOKIE)
        if not at:
            at = (request.headers.get("Authorization") or "").removeprefix("Bearer ").strip() or None
        if not at:
            return jsonify({"error": "Token requerido", "code": "NO_TOKEN"}), 401
        payload = verify_access_token(at)
        if not payload or payload.get("type") != "access":
            return jsonify({"error": "Token inválido o expirado", "code": "INVALID_TOKEN"}), 401
        g.token_cedula = payload["sub"]
        g.token_rol    = payload.get("rol", "cliente")
        return f(*args, **kwargs)
    return decorated


def _try_rebuild_session_from_at() -> bool:
    at = request.cookies.get(_AT_COOKIE)
    if not at:
        return False
    payload = verify_access_token(at)
    if not payload or payload.get("type") != "access":
        return False
    try:
        import helpers.models as db
        user = db.usuario_get(payload["sub"])
        if not user:
            return False
        _build_session_data(user)
        return True
    except Exception:
        return False


def _ensure_authenticated() -> bool:
    if session.get("user_id"):
        return True
    return _try_rebuild_session_from_at()


def _build_session_data(user: dict) -> None:
    rol = "cliente"
    if user.get("roles") and isinstance(user["roles"], dict):
        rol = user["roles"].get("nombre_role", "cliente")
    img = user.get("imagen_url") or "/static/uploads/default_icon_profile.png"
    if isinstance(img, str) and img.startswith("static/"):
        img = "/" + img
    user["imagen_url"] = img
    session.permanent = False
    session["user_id"] = str(user["cedula"])
    session["rol"]     = rol
    session["user"]    = user
    session.modified   = True


def hash_password(password: str, salt: str | None = None) -> str:
    if not salt:
        salt = os.urandom(16).hex()
    import hashlib
    hashed = hashlib.sha256((salt + password).encode()).hexdigest()
    return f"{salt}${hashed}"


def verify_password(plain: str, hashed: str) -> bool:
    try:
        salt, hash_val = hashed.split("$", 1)
        import hashlib
        return hashlib.sha256((salt + plain).encode()).hexdigest() == hash_val
    except Exception:
        return False
