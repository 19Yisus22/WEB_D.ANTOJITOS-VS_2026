
import hashlib
import logging
import os
import secrets
from datetime import datetime, timedelta, timezone
from enum import Enum

import jwt
from flask import g, request, session

_logger = logging.getLogger(__name__)

_ACCESS_SECRET  = os.getenv("ACCESS_TOKEN_SECRET",  secrets.token_hex(32))
_REFRESH_SECRET = os.getenv("REFRESH_TOKEN_SECRET", secrets.token_hex(32))

ACCESS_TTL_MINUTES  = 15
REFRESH_TTL_DAYS    = 7

AT_COOKIE = "_at"
RT_COOKIE = "_rt"

class TokenStatus(Enum):
    VALID    = "valid"
    EXPIRED  = "expired"
    REVOKED  = "revoked"
    MISMATCH = "mismatch"
    INVALID  = "invalid"
    MISSING  = "missing"

class TokenResult:

    __slots__ = ("status", "payload", "error")

    def __init__(
        self,
        status:  TokenStatus,
        payload: dict | None = None,
        error:   str         = "",
    ):
        self.status  = status
        self.payload = payload or {}
        self.error   = error

    @property
    def ok(self) -> bool:
        return self.status == TokenStatus.VALID

    @property
    def expired(self) -> bool:
        return self.status == TokenStatus.EXPIRED

    @property
    def revoked(self) -> bool:
        return self.status in (TokenStatus.REVOKED, TokenStatus.MISMATCH)

    @property
    def session_ended(self) -> bool:
        return self.status in (
            TokenStatus.EXPIRED, TokenStatus.REVOKED, TokenStatus.MISMATCH
        )

    def __bool__(self) -> bool:
        return self.ok

    def __repr__(self) -> str:
        return f"<TokenResult {self.status.value!r} error={self.error!r}>"

def _is_https() -> bool:
    return os.getenv("FLASK_DEBUG", "").lower() not in ("1", "true", "debug")

def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()

def create_access_token(cedula: str, rol: str) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub":  str(cedula),
        "rol":  rol,
        "type": "access",
        "iat":  now,
        "exp":  now + timedelta(minutes=ACCESS_TTL_MINUTES),
    }
    return jwt.encode(payload, _ACCESS_SECRET, algorithm="HS256")

def create_refresh_token(cedula: str) -> tuple[str, datetime]:
    now        = datetime.now(timezone.utc)
    expires_at = now + timedelta(days=REFRESH_TTL_DAYS)
    payload = {
        "sub":  str(cedula),
        "jti":  secrets.token_hex(16),
        "type": "refresh",
        "iat":  now,
        "exp":  expires_at,
    }
    return jwt.encode(payload, _REFRESH_SECRET, algorithm="HS256"), expires_at

def verify_access_token(token: str | None) -> TokenResult:
    if not token:
        return TokenResult(TokenStatus.MISSING, error="Access token ausente")
    try:
        payload = jwt.decode(token, _ACCESS_SECRET, algorithms=["HS256"])
        if payload.get("type") != "access":
            return TokenResult(TokenStatus.INVALID, error="Tipo de token incorrecto")
        return TokenResult(TokenStatus.VALID, payload=payload)
    except jwt.ExpiredSignatureError:
        return TokenResult(TokenStatus.EXPIRED, error="Access token expirado")
    except jwt.InvalidTokenError as exc:
        return TokenResult(TokenStatus.INVALID, error=str(exc))

def verify_refresh_token_raw(token: str | None) -> TokenResult:
    if not token:
        return TokenResult(TokenStatus.MISSING, error="Refresh token ausente")
    try:
        payload = jwt.decode(token, _REFRESH_SECRET, algorithms=["HS256"])
        if payload.get("type") != "refresh":
            return TokenResult(TokenStatus.INVALID, error="Tipo de token incorrecto")
        return TokenResult(TokenStatus.VALID, payload=payload)
    except jwt.ExpiredSignatureError:
        return TokenResult(TokenStatus.EXPIRED, error="Refresh token expirado — sesión caducada")
    except jwt.InvalidTokenError as exc:
        return TokenResult(TokenStatus.INVALID, error=str(exc))

def verify_refresh_token_full(token: str) -> TokenResult:
    raw = verify_refresh_token_raw(token)
    if not raw.ok:
        return raw

    cedula = raw.payload.get("sub")
    if not cedula:
        return TokenResult(TokenStatus.INVALID, error="Token sin campo 'sub'")

    try:
        import helpers.models as db

        stored = db.usuario_get_web_token(cedula)

        if not stored or not stored.get("web_token"):
            return TokenResult(
                TokenStatus.REVOKED,
                error="Sesión revocada — el usuario cerró sesión previamente",
            )

        if stored["web_token"] != hash_token(token):
            _logger.warning(
                "Refresh token MISMATCH para cedula=%s — posible reutilización", cedula
            )
            return TokenResult(
                TokenStatus.MISMATCH,
                error="Token de sesión no coincide con el registrado (inicio de sesión más reciente)",
            )

        exp_str = stored.get("expires_at")
        if exp_str:
            exp_dt = datetime.fromisoformat(exp_str.replace("Z", "+00:00"))
            if exp_dt < datetime.now(timezone.utc):
                db.usuario_clear_web_token(cedula)
                return TokenResult(
                    TokenStatus.EXPIRED,
                    error="Sesión expirada por tiempo (superó los 7 días de inactividad)",
                )

        user = db.usuario_get(cedula)
        if not user:
            return TokenResult(TokenStatus.INVALID, error="Usuario no encontrado")

        return TokenResult(TokenStatus.VALID, payload={**raw.payload, "_user": user})

    except Exception as exc:
        _logger.error("Error en verify_refresh_token_full cedula=%s: %s", cedula, exc)
        return TokenResult(TokenStatus.INVALID, error="Error interno al verificar sesión")

def set_auth_cookies(response, access_token: str, refresh_token: str) -> None:
    secure = _is_https()
    response.set_cookie(
        AT_COOKIE, access_token,
        max_age=ACCESS_TTL_MINUTES * 60,
        httponly=True, secure=secure, samesite="Strict", path="/",
    )
    response.set_cookie(
        RT_COOKIE, refresh_token,
        max_age=REFRESH_TTL_DAYS * 24 * 3600,
        httponly=True, secure=secure, samesite="Strict", path="/",
    )

def clear_auth_cookies(response) -> None:
    response.delete_cookie(AT_COOKIE, path="/")
    response.delete_cookie(RT_COOKIE, path="/")

def rotate_access_token(response, cedula: str, rol: str) -> None:
    new_at = create_access_token(cedula, rol)
    secure = _is_https()
    response.set_cookie(
        AT_COOKIE, new_at,
        max_age=ACCESS_TTL_MINUTES * 60,
        httponly=True, secure=secure, samesite="Strict", path="/",
    )
    _logger.debug("Access token rotado para cedula=%s rol=%s", cedula, rol)

def build_session_data(user: dict) -> None:
    rol = "cliente"
    if user.get("roles") and isinstance(user["roles"], dict):
        rol = user["roles"].get("nombre_role", "cliente")

    img = user.get("imagen_url") or "/static/uploads/default_icon_profile.png"
    if isinstance(img, str) and img.startswith("static/"):
        img = "/" + img
    user["imagen_url"] = img

    session.permanent  = False
    session["user_id"] = str(user["cedula"])
    session["rol"]     = rol
    session["user"]    = user
    session.modified   = True

def emit_tokens_and_session(user: dict, response) -> None:
    import helpers.models as db

    cedula = str(user["cedula"])
    rol    = "cliente"
    if user.get("roles") and isinstance(user["roles"], dict):
        rol = user["roles"].get("nombre_role", "cliente")

    access_token          = create_access_token(cedula, rol)
    refresh_token, exp_dt = create_refresh_token(cedula)
    token_hash            = hash_token(refresh_token)

    db.usuario_set_web_token(cedula, token_hash, exp_dt.isoformat())
    build_session_data(user)
    set_auth_cookies(response, access_token, refresh_token)
    _logger.info("Sesión iniciada — cedula=%s rol=%s", cedula, rol)

def revoke_session(cedula: str) -> None:
    try:
        import helpers.models as db
        db.usuario_clear_web_token(cedula)
        _logger.info("Sesión revocada — cedula=%s", cedula)
    except Exception as exc:
        _logger.error("Error al revocar sesión de cedula=%s: %s", cedula, exc)

def rebuild_session_from_cookies() -> bool:
    at_cookie = request.cookies.get(AT_COOKIE)
    rt_cookie = request.cookies.get(RT_COOKIE)

    if at_cookie:
        at_res = verify_access_token(at_cookie)
        if at_res.ok:
            try:
                import helpers.models as db
                user = db.usuario_get(at_res.payload["sub"])
                if user:
                    build_session_data(user)
                    return True
            except Exception as exc:
                _logger.warning("Error reconstruyendo sesión desde AT: %s", exc)

    if rt_cookie:
        rt_res = verify_refresh_token_full(rt_cookie)

        if rt_res.ok:
            user = rt_res.payload.get("_user")
            if user:
                build_session_data(user)
                g._rotate_at     = True
                g._rotate_cedula = str(user["cedula"])
                g._rotate_rol    = session.get("rol", "cliente")
                return True

        elif rt_res.session_ended:
            _logger.info(
                "Sesión no reanudable (%s) para request %s: %s",
                rt_res.status.value, request.path, rt_res.error,
            )
            session.clear()

    return False

def has_active_session() -> bool:
    if session.get("user_id"):
        return True
    return rebuild_session_from_cookies()

def get_current_user_id() -> str | None:
    if has_active_session():
        return session.get("user_id")
    return None

def get_current_rol() -> str | None:
    if has_active_session():
        return session.get("rol")
    return None

def maybe_rotate_access_token(response):
    if getattr(g, "_rotate_at", False):
        cedula = getattr(g, "_rotate_cedula", None)
        rol    = getattr(g, "_rotate_rol", "cliente")
        if cedula:
            rotate_access_token(response, cedula, rol)
    return response

_build_session_data        = build_session_data
_emit_tokens_and_session   = emit_tokens_and_session
_try_rebuild_session       = rebuild_session_from_cookies
