import os
import uuid
import math
import threading
from collections import defaultdict
from datetime import datetime, timezone, timedelta

from flask import (Blueprint, request, jsonify, session,
                   redirect, render_template, make_response)

_ip_login_log: dict[str, list] = defaultdict(list)
_ip_lock = threading.Lock()

def _ip_rate_ok(ip: str, max_req: int = 10, window_s: int = 60) -> bool:
    now    = datetime.now(timezone.utc)
    cutoff = now - timedelta(seconds=window_s)
    with _ip_lock:
        _ip_login_log[ip] = [t for t in _ip_login_log[ip] if t > cutoff]
        if len(_ip_login_log[ip]) >= max_req:
            return False
        _ip_login_log[ip].append(now)
        return True

from google.oauth2               import id_token
from google.auth.transport       import requests as google_requests

import helpers.models as db
from helpers.auth import (
    sin_cache, hash_password, verify_password,
    create_access_token, create_refresh_token,
    verify_refresh_token, hash_token,
    set_auth_cookies, clear_auth_cookies,
    _build_session_data,
)
from helpers.validators import (
    is_valid_name, is_valid_numeric, is_valid_email,
    is_valid_password, is_valid_username,
)

auth_bp = Blueprint("auth", __name__)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _emit_tokens_and_session(user: dict, response):
    cedula = str(user["cedula"])
    rol = "cliente"
    if user.get("roles") and isinstance(user["roles"], dict):
        rol = user["roles"].get("nombre_role", "cliente")

    access_token            = create_access_token(cedula, rol)
    refresh_token, exp_dt   = create_refresh_token(cedula)
    token_hash              = hash_token(refresh_token)

    db.usuario_set_web_token(cedula, token_hash, exp_dt.isoformat())
    _build_session_data(user)
    set_auth_cookies(response, access_token, refresh_token)


@auth_bp.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "GET":
        if "user_id" in session:
            return redirect("/inicio")
        try:
            slides = db.publicidad_get_by_tipo("login_slide")
        except Exception:
            slides = []
        return render_template("global_modules/login.html", slides=slides)

    client_ip = request.headers.get("X-Forwarded-For", request.remote_addr or "").split(",")[0].strip()
    if not _ip_rate_ok(client_ip):
        return jsonify({"ok": False, "error": "Demasiadas solicitudes. Espera un momento e intenta de nuevo."}), 429

    session.clear()
    data       = request.get_json() or {}
    identifier = (data.get("identifier") or data.get("correo") or "").strip()
    contrasena = data.get("contrasena", "")

    if not identifier:
        return jsonify({"ok": False, "error": "Ingresa tu correo, usuario o cédula"}), 400

    try:
        user = db.usuario_get_by_identifier(identifier)
    except Exception:
        return jsonify({"ok": False, "error": "Error de conexión con la base de datos"}), 500

    if not user:
        return jsonify({"ok": False, "error": "Credenciales incorrectas"}), 401

    cedula = str(user["cedula"])
    now    = datetime.now(timezone.utc)

    bloqueado_hasta_raw = user.get("bloqueado_hasta")
    intentos            = int(user.get("intentos_fallidos") or 0)

    if bloqueado_hasta_raw:
        bloqueado_hasta_dt = datetime.fromisoformat(
            bloqueado_hasta_raw.replace("Z", "+00:00")
        )
        if bloqueado_hasta_dt > now:
            segundos_restantes = int((bloqueado_hasta_dt - now).total_seconds())
            minutos            = math.ceil(segundos_restantes / 60)
            if minutos >= 1440:
                tiempo_str = f"{math.ceil(minutos / 1440)} día(s)"
            elif minutos >= 60:
                tiempo_str = f"{math.ceil(minutos / 60)} hora(s)"
            else:
                tiempo_str = f"{minutos} minuto(s)"
            return jsonify({
                "ok":             False,
                "error":          f"Cuenta bloqueada. Intenta en {tiempo_str}.",
                "bloqueado_hasta": bloqueado_hasta_raw,
                "segundos":        segundos_restantes,
            }), 429
        else:
            if intentos >= 20:
                db.usuario_reset_intentos(cedula)
                intentos = 0

    stored_pw = user.get("contrasena") or ""
    if not stored_pw:
        return jsonify({"ok": False, "error": "Esta cuenta solo puede ingresar con Google. Usa el botón 'Iniciar sesión con Google'."}), 401

    if not verify_password(contrasena, stored_pw):
        result = db.usuario_incrementar_intento(cedula)
        new_intentos    = result["intentos"]
        bloqueo_aplicado = result["bloqueado_hasta"]
        minutos_bloqueo  = result["minutos_bloqueo"]

        if bloqueo_aplicado:
            if minutos_bloqueo >= 1440:
                dur_str = f"{minutos_bloqueo // 1440} día(s)"
            elif minutos_bloqueo >= 60:
                dur_str = f"{minutos_bloqueo // 60} hora(s)"
            else:
                dur_str = f"{minutos_bloqueo} minuto(s)"
            return jsonify({
                "ok":             False,
                "error":          f"Demasiados intentos fallidos. Cuenta bloqueada por {dur_str}.",
                "bloqueado_hasta": bloqueo_aplicado,
                "segundos":        minutos_bloqueo * 60,
            }), 429

        next_threshold = next(
            (t for t in (5, 10, 15, 20) if t > new_intentos),
            None
        )
        if next_threshold is not None:
            faltan = next_threshold - new_intentos
            return jsonify({
                "ok":    False,
                "error": f"Contraseña incorrecta. {faltan} intento(s) más antes del próximo bloqueo.",
            }), 401

        return jsonify({"ok": False, "error": "Contraseña incorrecta"}), 401

    db.usuario_reset_intentos(cedula)
    resp = make_response(jsonify({"ok": True, "redirect": "/inicio", "user": user}), 200)
    _emit_tokens_and_session(user, resp)
    session["just_logged_in"] = True
    db.usuario_touch(cedula, _now())
    return resp


@auth_bp.route("/registro-google", methods=["POST", "OPTIONS"])
def registro_google():
    if request.method == "OPTIONS":
        return jsonify({"ok": True}), 200

    data  = request.get_json()
    token = data.get("credential") if data else None
    if not token:
        return jsonify({"ok": False, "error": "Credencial ausente"}), 400

    client_id = os.getenv("GOOGLE_CLIENT_ID")
    try:
        idinfo = id_token.verify_oauth2_token(
            token, google_requests.Request(), client_id, clock_skew_in_seconds=60
        )
        correo = idinfo["email"].lower()
        ahora  = _now()
        now    = datetime.now(timezone.utc)

        user = db.usuario_get_by_google_account(correo)
        if not user:
            user = db.usuario_get_by_correo(correo)
            if user and not user.get("google_account"):
                db.usuario_update(str(user["cedula"]), {"google_account": correo})
                user = db.usuario_get(str(user["cedula"]))

        if user:
            cedula              = str(user["cedula"])
            bloqueado_hasta_raw = user.get("bloqueado_hasta")

            if bloqueado_hasta_raw:
                bloqueado_hasta_dt = datetime.fromisoformat(
                    bloqueado_hasta_raw.replace("Z", "+00:00")
                )
                if bloqueado_hasta_dt > now:
                    segundos_restantes = int((bloqueado_hasta_dt - now).total_seconds())
                    minutos            = math.ceil(segundos_restantes / 60)
                    if minutos >= 1440:
                        tiempo_str = f"{math.ceil(minutos / 1440)} día(s)"
                    elif minutos >= 60:
                        tiempo_str = f"{math.ceil(minutos / 60)} hora(s)"
                    else:
                        tiempo_str = f"{minutos} minuto(s)"
                    return jsonify({
                        "ok":              False,
                        "error":           f"Cuenta bloqueada. Intenta en {tiempo_str}.",
                        "bloqueado_hasta": bloqueado_hasta_raw,
                        "segundos":        segundos_restantes,
                    }), 429

            db.usuario_reset_intentos(cedula)
            db.usuario_touch(cedula, ahora)
        else:
            cedula_gen = f"G-{uuid.uuid4().hex[:8]}"
            db.usuario_create({
                "cedula":          cedula_gen,
                "nombre":          idinfo.get("given_name", ""),
                "apellido":        idinfo.get("family_name", ""),
                "google_account":  correo,
                "metodo_pago":     "Efectivo",
                "imagen_url":      idinfo.get("picture") or None,
                "ultima_conexion": ahora,
            })
            user = db.usuario_get_by_google_account(correo)

        resp = make_response(jsonify({"ok": True, "user": user}))
        _emit_tokens_and_session(user, resp)
        return resp
    except Exception:
        return jsonify({"ok": False, "error": "Error de autenticación. Verifica tu cuenta de Google."}), 401


@auth_bp.route("/refresh", methods=["POST"])
def refresh_token():
    rt = request.cookies.get("_rt")
    if not rt:
        return jsonify({"ok": False, "error": "Sin refresh token", "code": "NO_REFRESH_TOKEN"}), 401

    payload = verify_refresh_token(rt)
    if not payload or payload.get("type") != "refresh":
        return jsonify({"ok": False, "error": "Refresh token inválido", "code": "INVALID_REFRESH_TOKEN"}), 401

    cedula = payload.get("sub")
    if not cedula:
        return jsonify({"ok": False, "error": "Token malformado", "code": "MALFORMED_TOKEN"}), 401

    try:
        stored = db.usuario_get_web_token(cedula)
        if not stored or not stored.get("web_token"):
            return jsonify({"ok": False, "error": "Sesión revocada", "code": "SESSION_REVOKED"}), 401

        if stored["web_token"] != hash_token(rt):
            return jsonify({"ok": False, "error": "Token no coincide", "code": "TOKEN_MISMATCH"}), 401

        exp_str = stored.get("expires_at")
        if exp_str:
            exp_dt = datetime.fromisoformat(exp_str.replace("Z", "+00:00"))
            if exp_dt < datetime.now(timezone.utc):
                db.usuario_clear_web_token(cedula)
                return jsonify({"ok": False, "error": "Sesión expirada", "code": "SESSION_EXPIRED"}), 401

        user = db.usuario_get(cedula)
        if not user:
            return jsonify({"ok": False, "error": "Usuario no encontrado", "code": "USER_NOT_FOUND"}), 401

        rol = "cliente"
        if user.get("roles") and isinstance(user["roles"], dict):
            rol = user["roles"].get("nombre_role", "cliente")

        new_at = create_access_token(cedula, rol)
        _build_session_data(user)

        is_secure = not os.getenv("FLASK_DEBUG", "").lower() in ("1", "true", "debug")
        resp = make_response(jsonify({"ok": True, "message": "Token renovado"}))
        resp.set_cookie(
            "_at", new_at,
            max_age=15 * 60,
            httponly=True,
            secure=is_secure,
            samesite="Strict",
            path="/"
        )
        return resp

    except Exception as e:
        return jsonify({"ok": False, "error": "Error interno"}), 500


@auth_bp.route("/registro", methods=["GET", "POST"])
def registro():
    if request.method == "GET":
        return render_template("global_modules/registro.html")

    p        = request.get_json() or {}
    nombre   = (p.get("nombre")     or "").strip()
    apellido = (p.get("apellido")   or "").strip()
    cedula   = (p.get("cedula")     or "").strip()
    telefono = (p.get("telefono")   or "").strip()
    correo   = (p.get("correo")     or "").strip().lower()
    username = (p.get("username")   or "").strip()
    password = (p.get("contrasena") or "")

    if not nombre or not apellido:
        return jsonify({"ok": False, "error": "Nombre y apellido son obligatorios."}), 400
    if not is_valid_name(nombre):
        return jsonify({"ok": False, "error": "Nombre inválido (solo letras, 1–50 caracteres)."}), 400
    if not is_valid_name(apellido):
        return jsonify({"ok": False, "error": "Apellido inválido (solo letras, 1–50 caracteres)."}), 400
    if not is_valid_numeric(cedula, 7, 15):
        return jsonify({"ok": False, "error": "Cédula inválida (7–15 dígitos)."}), 400
    if not is_valid_numeric(telefono, 7, 15):
        return jsonify({"ok": False, "error": "Teléfono inválido (7–15 dígitos)."}), 400
    if not is_valid_email(correo):
        return jsonify({"ok": False, "error": "Correo inválido. Usa el formato usuario@dominio.com"}), 400
    if not is_valid_password(password):
        return jsonify({"ok": False, "error": "Contraseña inválida (mín. 8 caracteres, debe incluir al menos una letra y un número)."}), 400
    if username and not is_valid_username(username):
        return jsonify({"ok": False, "error": "Username inválido (3–30 caracteres, letras/números)."}), 400

    if db.usuario_get_by_correo(correo):
        return jsonify({"ok": False, "error": "El correo ya está registrado."}), 400
    if db.usuario_get(cedula):
        return jsonify({"ok": False, "error": "La cédula ya está registrada."}), 400
    if username and db.usuario_get_by_username(username):
        return jsonify({"ok": False, "error": "El nombre de usuario ya está en uso."}), 400

    try:
        row = {
            "cedula":          cedula,
            "nombre":          nombre,
            "apellido":        apellido,
            "telefono":        telefono,
            "correo":          correo,
            "contrasena":      hash_password(password),
            "direccion":       "N/A",
            "metodo_pago":     "Efectivo",
            "imagen_url":      None,
            "ultima_conexion": _now(),
        }
        if username:
            row["username"] = username
        db.usuario_create(row)
        return jsonify({"ok": True, "mensaje": "¡Cuenta creada! Ahora puedes iniciar sesión."}), 201
    except Exception as e:
        err = str(e)
        if "23505" in err or "duplicate" in err.lower():
            if "correo"   in err: return jsonify({"ok": False, "error": "El correo ya está registrado."}), 400
            if "cedula"   in err: return jsonify({"ok": False, "error": "La cédula ya está registrada."}), 400
            if "username" in err: return jsonify({"ok": False, "error": "El username ya está en uso."}), 400
            return jsonify({"ok": False, "error": "El usuario ya existe."}), 400
        if "42501" in err or "row-level security" in err.lower():
            return jsonify({"ok": False, "error": "Error de permisos en la BD."}), 500
        return jsonify({"ok": False, "error": "Error interno al crear la cuenta."}), 500


@auth_bp.route("/inicio")
@sin_cache
def inicio():
    user_id = session.get("user_id")
    if not user_id:
        session.clear()
        return render_template("inicio.html", user=None)
    try:
        user = db.usuario_get(user_id)
        if not user:
            session.clear()
            return render_template("inicio.html", user=None)
        if user.get("roles"):
            user["rol"] = user["roles"].get("nombre_role")
        session["user"] = user
        just = session.pop("just_logged_in", False)
        return render_template("inicio.html", user=user, just_logged_in=just)
    except Exception:
        return render_template("inicio.html", user=None)


@auth_bp.route("/logout")
@sin_cache
def logout():
    user_id = session.get("user_id")
    if user_id:
        try:
            db.usuario_clear_web_token(user_id)
        except Exception:
            pass
    session.clear()
    resp = make_response(redirect("/inicio"))
    resp.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    clear_auth_cookies(resp)
    return resp


@auth_bp.route("/obtener-cliente-id")
def obtener_cliente_id():
    return jsonify({"client_id": os.getenv("GOOGLE_CLIENT_ID", "").strip()})
