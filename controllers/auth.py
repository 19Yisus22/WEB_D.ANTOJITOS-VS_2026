import os
import uuid
from datetime import datetime, timezone

from flask import (Blueprint, request, jsonify, session,
                   redirect, render_template, make_response)
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
        return jsonify({"ok": False, "error": "Usuario no encontrado"}), 401

    stored_pw = user.get("contrasena", "")
    if stored_pw == "GOOGLE_AUTH_EXTERNAL":
        return jsonify({"ok": False, "error": "Esta cuenta usa Google. Ingresa con el botón de Google."}), 401
    if not verify_password(contrasena, stored_pw):
        return jsonify({"ok": False, "error": "Contraseña incorrecta"}), 401

    resp = make_response(jsonify({"ok": True, "redirect": "/inicio", "user": user}), 200)
    _emit_tokens_and_session(user, resp)
    session["just_logged_in"] = True
    db.usuario_touch(user["cedula"], _now())
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
        correo = idinfo["email"]
        ahora  = _now()

        user = db.usuario_get_by_correo(correo)
        if user:
            db.usuario_touch(user["cedula"], ahora)
        else:
            cedula_gen = f"G-{uuid.uuid4().hex[:8]}"
            db.usuario_create({
                "cedula":           cedula_gen,
                "nombre":           idinfo.get("given_name", ""),
                "apellido":         idinfo.get("family_name", ""),
                "correo":           correo,
                "contrasena":       "GOOGLE_AUTH_EXTERNAL",
                "metodo_pago":      "Efectivo",
                "imagen_url":       idinfo.get("picture") or "/static/uploads/default_icon_profile.png",
                "ultima_conexion":  ahora,
            })
            user = db.usuario_get_by_correo(correo)

        resp = make_response(jsonify({"ok": True, "user": user}))
        _emit_tokens_and_session(user, resp)
        return resp
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 401


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
        return jsonify({"ok": False, "error": "Contraseña inválida (mín. 5 caracteres)."}), 400
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
            "imagen_url":      "/static/uploads/default_icon_profile.png",
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
            db.usuario_touch(user_id, "2000-01-01T00:00:00Z")
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
