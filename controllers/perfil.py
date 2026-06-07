from datetime import datetime, timezone, timedelta
from flask import Blueprint, request, jsonify, session, redirect, url_for, render_template
import helpers.models as db
from helpers.auth import sin_cache, login_required, admin_required, hash_password
from helpers.validators import is_valid_name, is_valid_numeric, is_valid_email
from helpers.cloudinary import upload_image, delete_image

perfil_bp = Blueprint("perfil", __name__)

COOLDOWN_DIAS = 10


def _birthday_pct() -> int:
    try:
        cfg = db.inicio_config_get() or {}
        val = cfg.get("descuento_cumpleanos")
        if val is not None:
            return int(round(max(0.0, min(float(val), 100.0))))
    except Exception:
        pass
    return 5

def _ahora_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

def _ultima_edicion(usuario: dict):
    """Retorna el datetime de la edición de perfil más reciente."""
    fechas = []
    for campo in ("nombre", "apellido", "cedula", "username"):
        v = usuario.get(f"last_change_{campo}")
        if v:
            try:
                fechas.append(datetime.fromisoformat(str(v).replace("Z", "+00:00")))
            except Exception:
                pass
    return max(fechas) if fechas else None

def _puede_editar_perfil(usuario: dict) -> tuple:
    """Retorna (puede_editar, disponible_en_iso)."""
    cedula = str(usuario.get("cedula") or "")
    if cedula.startswith("G-"):
        return True, None

    ultima = _ultima_edicion(usuario)
    if not ultima:
        return True, None
    siguiente = ultima + timedelta(days=COOLDOWN_DIAS)
    if datetime.now(timezone.utc) >= siguiente:
        return True, None
    return False, siguiente.isoformat()

def _puede_cambiar_contrasena(cedula: str) -> tuple:
    """Retorna (puede_cambiar, disponible_en_iso) para el cooldown de contraseña."""
    v = db.usuario_get_pass_cooldown(str(cedula))
    if not v:
        return True, None
    try:
        ultima = datetime.fromisoformat(str(v).replace("Z", "+00:00"))
    except Exception:
        return True, None
    siguiente = ultima + timedelta(days=COOLDOWN_DIAS)
    if datetime.now(timezone.utc) >= siguiente:
        return True, None
    return False, siguiente.isoformat()

def _dias_restantes(siguiente_iso: str) -> int:
    try:
        sig = datetime.fromisoformat(siguiente_iso.replace("Z", "+00:00"))
        return max(1, (sig - datetime.now(timezone.utc)).days + 1)
    except Exception:
        return COOLDOWN_DIAS


@perfil_bp.route("/mi_perfil", methods=["GET", "POST"])
@sin_cache
@login_required
def perfil_usuarios():
    user_id = session.get("user_id")

    usuario = db.usuario_get(user_id) or {}
    img = usuario.get("imagen_url") or "/static/uploads/default_icon_profile.png"
    if isinstance(img, str) and img.startswith("static/"):
        img = "/" + img
    usuario["imagen_url"] = img

    if request.method == "POST":
        updates = {}
        for campo in ["nombre", "apellido", "telefono", "correo", "direccion", "metodo_pago"]:
            v = request.form.get(campo)
            if v:
                updates[campo] = v.strip().lower() if campo == "correo" else v.strip()

        _pct = _birthday_pct()
        if "nombre" in updates and not is_valid_name(updates["nombre"]):
            return render_template("general_modules/perfil.html", user=usuario, error="Nombre inválido.", descuento_pct=_pct)
        if "apellido" in updates and not is_valid_name(updates["apellido"]):
            return render_template("general_modules/perfil.html", user=usuario, error="Apellido inválido.", descuento_pct=_pct)
        if "telefono" in updates and not is_valid_numeric(updates["telefono"], 7, 15):
            return render_template("general_modules/perfil.html", user=usuario, error="Teléfono inválido.", descuento_pct=_pct)
        if "correo" in updates and not is_valid_email(updates["correo"]):
            return render_template("general_modules/perfil.html", user=usuario, error="Correo inválido.", descuento_pct=_pct)

        archivo = request.files.get("imagen_url")
        eliminar = request.form.get("eliminar_foto") == "1"

        if archivo and archivo.filename:
            old_url = usuario.get("imagen_url", "")
            if old_url and "default_icon_profile" not in old_url:
                delete_image(old_url)
            nueva_url = upload_image(archivo, folder="usuarios/perfiles", public_id=f"user_{user_id}")
            if nueva_url:
                updates["imagen_url"] = nueva_url
        elif eliminar:
            old_url = usuario.get("imagen_url", "")
            if old_url and "default_icon_profile" not in old_url:
                delete_image(old_url)
            updates["imagen_url"] = "/static/uploads/default_icon_profile.png"

        if updates:
            db.usuario_update(user_id, updates)
        return redirect(url_for("perfil.perfil_usuarios"))

    return render_template("general_modules/perfil.html", user=usuario, descuento_pct=_birthday_pct())


@perfil_bp.route("/perfil/restricciones")
@login_required
def perfil_restricciones():
    user_id = session.get("user_id")
    try:
        usuario = db.usuario_get(user_id)
        if not usuario:
            return jsonify({"bloqueado": False, "disponible_en": None, "pass_bloqueado": False, "pass_disponible_en": None}), 200
        puede, siguiente           = _puede_editar_perfil(usuario)
        puede_pass, siguiente_pass = _puede_cambiar_contrasena(usuario.get("cedula", user_id))
        return jsonify({
            "bloqueado":       not puede,
            "disponible_en":   siguiente,
            "pass_bloqueado":  not puede_pass,
            "pass_disponible_en": siguiente_pass,
        })
    except Exception:
        return jsonify({"bloqueado": False, "disponible_en": None, "pass_bloqueado": False, "pass_disponible_en": None}), 200


@perfil_bp.route("/actualizar_perfil/<cedula>", methods=["PUT", "POST"])
@login_required
def actualizar_perfil(cedula):
    user_id = session.get("user_id")
    lookup_id = str(user_id or "").strip()

    if not lookup_id:
        return jsonify({"ok": False, "error": "Usuario no identificado"}), 400

    usuario_previo = db.usuario_get(lookup_id)

    if not usuario_previo:
        correo_sesion = (session.get("user") or {}).get("correo", "")
        if correo_sesion:
            usuario_previo = db.usuario_get_by_correo(correo_sesion)
        if usuario_previo:
            lookup_id = str(usuario_previo.get("cedula", lookup_id))
            session["user_id"] = lookup_id
            session.modified = True
        else:
            return jsonify({"ok": False, "error": "Sesión expirada. Recarga la página e intenta de nuevo."}), 404

    # Cooldown global: un solo check para todo el perfil
    puede, siguiente = _puede_editar_perfil(usuario_previo)
    if not puede:
        dias = _dias_restantes(siguiente)
        return jsonify({"ok": False, "error": f"Solo puedes editar tu perfil una vez cada {COOLDOWN_DIAS} días. Disponible en {dias} día(s).", "disponible_en": siguiente}), 429

    data = request.form if request.form else (request.json or {})

    campos = {
        "nombre":      (data.get("nombrePerfil") or "").strip(),
        "apellido":    (data.get("apellidoPerfil") or "").strip(),
        "telefono":    (data.get("telefonoPerfil") or "").strip(),
        "correo":      (data.get("correoPerfil") or "").strip().lower(),
        "direccion":   (data.get("direccionPerfil") or "").strip(),
        "metodo_pago": (data.get("metodoPagoPerfil") or "").strip(),
    }
    campos = {k: v for k, v in campos.items() if v}

    # Fecha de cumpleaños (no sujeta a cooldown, se puede editar siempre)
    fecha_nacimiento_raw = (data.get("fechaNacimientoPerfil") or "").strip()
    if fecha_nacimiento_raw:
        try:
            from datetime import date
            fn = date.fromisoformat(fecha_nacimiento_raw)
            # Validar rango razonable
            hoy = date.today()
            if date(1900, 1, 1) <= fn <= hoy:
                campos["fecha_nacimiento"] = fn.isoformat()
        except Exception:
            pass

    nuevo_username = (data.get("usernamePerfil") or "").strip().lower()
    if nuevo_username and nuevo_username != (usuario_previo.get("username") or ""):
        from helpers.validators import is_valid_username
        if not is_valid_username(nuevo_username):
            return jsonify({"ok": False, "error": "Nombre de usuario inválido (3-30 caracteres, debe incluir al menos una letra o número)."}), 400
        existente = db.usuario_get_by_username(nuevo_username)
        if existente and str(existente.get("cedula")) != lookup_id:
            return jsonify({"ok": False, "error": "El nombre de usuario ya está en uso."}), 409
        campos["username"] = nuevo_username

    nueva_cedula = (data.get("cedulaPerfil") or "").strip()
    if nueva_cedula and nueva_cedula != lookup_id:
        if not lookup_id.startswith("G-"):
            return jsonify({"ok": False, "error": "La cédula no puede modificarse una vez establecida."}), 403
        if not nueva_cedula.isdigit():
            return jsonify({"ok": False, "error": "La cédula debe contener únicamente números (sin letras ni guiones)."}), 400
        if len(nueva_cedula) < 6:
            return jsonify({"ok": False, "error": "Cédula inválida (mínimo 6 dígitos)."}), 400
        campos["cedula"] = nueva_cedula

    # Marcar timestamp en todos los campos de control al guardar
    ahora = _ahora_iso()
    for c in ("nombre", "apellido", "cedula", "username"):
        campos[f"last_change_{c}"] = ahora

    archivo = request.files.get("imagen_url")
    if archivo and archivo.filename:
        old_url = usuario_previo.get("imagen_url", "")
        if old_url and "default_icon_profile" not in old_url and "cloudinary" in old_url:
            delete_image(old_url)
        nueva_url = upload_image(archivo, folder="usuarios/perfiles", public_id=f"user_{lookup_id}")
        if nueva_url:
            campos["imagen_url"] = nueva_url
        else:
            return jsonify({"ok": False, "error": "No se pudo subir la imagen. Verifica el archivo e intenta de nuevo."}), 500

    if "nombre" in campos and not is_valid_name(campos["nombre"]):
        return jsonify({"ok": False, "error": "Nombre inválido."}), 400
    if "apellido" in campos and not is_valid_name(campos["apellido"]):
        return jsonify({"ok": False, "error": "Apellido inválido."}), 400
    if "telefono" in campos and not is_valid_numeric(campos["telefono"], 7, 15):
        return jsonify({"ok": False, "error": "Teléfono inválido."}), 400
    if "correo" in campos and not is_valid_email(campos["correo"]):
        return jsonify({"ok": False, "error": "Correo inválido."}), 400

    if not campos:
        return jsonify({"ok": False, "error": "Sin datos válidos"}), 400

    try:
        # ── Cascade para cambio de cédula ─────────────────────────────────
        # Cuando un usuario Google (G-) establece su cédula real, las FK de
        # las tablas dependientes apuntan a la cédula temporal.
        # Debemos actualizar esas referencias ANTES de cambiar la PK.
        nueva_cedula = campos.get("cedula")
        if nueva_cedula and lookup_id.startswith("G-"):
            db.cedula_cascade_update(lookup_id, nueva_cedula)

        db.usuario_update(lookup_id, campos)

        nueva_id = campos.get("cedula", lookup_id)
        usuario_final = db.usuario_get(nueva_id)

        if usuario_final is None:
            return jsonify({"ok": False, "error": "No se pudo recuperar el usuario actualizado"}), 500

        img = usuario_final.get("imagen_url") or None
        if isinstance(img, str) and img.startswith("static/"):
            img = "/" + img
        usuario_final["imagen_url"] = img

        if "cedula" in campos:
            session["user_id"] = nueva_id

        s = session.get("user") or {}
        s.update({k: usuario_final.get(k) for k in ["nombre", "apellido", "telefono", "correo", "direccion", "metodo_pago", "imagen_url", "cedula", "username"]})
        session["user"] = s
        session.modified = True

        # Verificar logros de perfil
        try:
            from helpers.logros_utils import verificar_y_otorgar
            nuevos_logros = verificar_y_otorgar(nueva_id, {"tipo": "perfil"})
        except Exception:
            nuevos_logros = []

        return jsonify({"ok": True, "usuario": usuario_final, "logros_nuevos": nuevos_logros})
    except Exception as e:
        msg = str(e)
        if "foreign key" in msg.lower() or "violates" in msg.lower():
            if lookup_id.startswith("G-"):
                return jsonify({"ok": False, "error": "Cédula en uso por otro registro. Elige otro número."}), 409
            return jsonify({"ok": False, "error": "No se puede cambiar la cédula porque tienes pedidos o facturas registrados con ella."}), 409
        return jsonify({"ok": False, "error": msg}), 500


@perfil_bp.route("/eliminar_mi_cuenta", methods=["DELETE"])
@login_required
def eliminar_mi_cuenta():
    user_id = session.get("user_id")
    lookup_id = str(user_id or "").strip()
    if not lookup_id:
        return jsonify({"ok": False, "error": "Sesión no válida"}), 400

    try:
        usuario = db.usuario_get(lookup_id)
        if not usuario:
            correo_sesion = (session.get("user") or {}).get("correo", "")
            if correo_sesion:
                usuario = db.usuario_get_by_correo(correo_sesion)
        if not usuario:
            return jsonify({"ok": False, "error": "Usuario no encontrado"}), 404

        img = usuario.get("imagen_url", "")
        if img and "default_icon_profile" not in img and "cloudinary" in img:
            delete_image(img)

        db.usuario_delete(usuario["cedula"])
        session.clear()
        return jsonify({"ok": True})
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500


@perfil_bp.route("/cambiar_contrasena", methods=["PUT"])
@login_required
def cambiar_contrasena():
    user_id = session.get("user_id")
    data    = request.get_json() or {}
    nueva   = (data.get("nueva") or "").strip()
    if not nueva:
        return jsonify({"ok": False, "error": "Contraseña requerida"}), 400
    try:
        usuario = db.usuario_get(str(user_id))
        if usuario:
            puede_pass, siguiente_pass = _puede_cambiar_contrasena(usuario.get("cedula", str(user_id)))
            if not puede_pass:
                dias = _dias_restantes(siguiente_pass)
                return jsonify({
                    "ok": False,
                    "error": f"Solo puedes cambiar tu contraseña una vez cada {COOLDOWN_DIAS} días. Disponible en {dias} día(s).",
                    "pass_disponible_en": siguiente_pass,
                }), 429
        db.usuario_update(str(user_id), {
            "contrasena":           hash_password(nueva),
            "last_change_contrasena": _ahora_iso(),
        })
        return jsonify({"ok": True})
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500


@perfil_bp.route("/cloudinary_storage_info")
@login_required
def cloudinary_storage_info():
    if session.get("rol") != "admin":
        return jsonify({"error": "No autorizado"}), 403
    from helpers.cloudinary import get_storage_info
    return jsonify(get_storage_info())
