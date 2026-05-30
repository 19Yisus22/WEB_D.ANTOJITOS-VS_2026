from flask import Blueprint, request, jsonify, session, redirect, url_for, render_template
import models as db
from helpers.auth import sin_cache, login_required, admin_required, hash_password
from helpers.validators import is_valid_name, is_valid_numeric, is_valid_email
from helpers.cloudinary import upload_image, delete_image

perfil_bp = Blueprint("perfil", __name__)


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

        if "nombre" in updates and not is_valid_name(updates["nombre"]):
            return render_template("general_modules/perfil.html", user=usuario, error="Nombre inválido.")
        if "apellido" in updates and not is_valid_name(updates["apellido"]):
            return render_template("general_modules/perfil.html", user=usuario, error="Apellido inválido.")
        if "telefono" in updates and not is_valid_numeric(updates["telefono"], 7, 15):
            return render_template("general_modules/perfil.html", user=usuario, error="Teléfono inválido.")
        if "correo" in updates and not is_valid_email(updates["correo"]):
            return render_template("general_modules/perfil.html", user=usuario, error="Correo inválido.")

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

    return render_template("general_modules/perfil.html", user=usuario)


@perfil_bp.route("/actualizar_perfil/<cedula>", methods=["PUT", "POST"])
@login_required
def actualizar_perfil(cedula):
    user_id = session.get("user_id")
    # Usar cedula de sesión si la de URL está vacía o es inválida
    if not cedula or cedula == "None":
        cedula = str(user_id or "")
    if not cedula:
        return jsonify({"ok": False, "error": "Usuario no identificado"}), 400
    usuario_previo = db.usuario_get(cedula)
    if not usuario_previo:
        return jsonify({"ok": False, "error": "Usuario no encontrado"}), 404

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

    archivo = request.files.get("imagen_url")
    if archivo and archivo.filename:
        old_url = usuario_previo.get("imagen_url", "")
        if old_url and "default_icon_profile" not in old_url:
            delete_image(old_url)
        nueva_url = upload_image(archivo, folder="usuarios/perfiles", public_id=f"user_{cedula}")
        if nueva_url:
            campos["imagen_url"] = nueva_url

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
        db.usuario_update(cedula, campos)
        usuario_final = db.usuario_get(cedula)
        img = usuario_final.get("imagen_url") or "/static/uploads/default_icon_profile.png"
        if isinstance(img, str) and img.startswith("static/"):
            img = "/" + img
        usuario_final["imagen_url"] = img

        if str(user_id) == str(cedula):
            s = session.get("user", {})
            s.update({k: usuario_final.get(k) for k in ["nombre", "apellido", "telefono", "correo", "direccion", "metodo_pago", "imagen_url"]})
            session["user"] = s
            session.modified = True

        return jsonify({"ok": True, "usuario": usuario_final})
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
    db.usuario_update(user_id, {"contrasena": hash_password(nueva)})
    return jsonify({"ok": True})


@perfil_bp.route("/cloudinary_storage_info")
@login_required
def cloudinary_storage_info():
    if session.get("rol") != "admin":
        return jsonify({"error": "No autorizado"}), 403
    from helpers.cloudinary import get_storage_info
    return jsonify(get_storage_info())
