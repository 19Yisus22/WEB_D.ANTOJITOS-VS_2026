from flask import Blueprint, request, jsonify, session, render_template

import models as db
from helpers.auth import sin_cache, admin_required, login_required
from helpers.cloudinary import delete_image

perfil_usuarios_bp = Blueprint("perfil_usuarios", __name__)


@perfil_usuarios_bp.route("/gestion_usuarios_page")
@sin_cache
@admin_required
def gestion_usuarios_page():
    return render_template("admin_modules/gestion_usuarios.html")


@perfil_usuarios_bp.route("/listar_usuarios")
@login_required
def listar_usuarios():
    usuarios = db.usuario_get_all()
    resultado = []
    for u in usuarios:
        u["nombre_completo"] = f"{u.get('nombre','')} {u.get('apellido','')}".strip()
        u["rol"]             = u.get("roles", {}).get("nombre_role") if u.get("roles") else None
        contrasena           = u.pop("contrasena", "")
        u["auth_method"]     = "google" if str(contrasena).upper() == "GOOGLE_AUTH_EXTERNAL" else "email"
        resultado.append(u)
    return jsonify(resultado)


@perfil_usuarios_bp.route("/actualizar_rol_usuario", methods=["PUT"])
@admin_required
def actualizar_rol_usuario():
    data      = request.get_json() or {}
    cedula    = data.get("cedula") or data.get("id")
    nuevo_rol = data.get("rol")

    id_role = db.rol_get_id(nuevo_rol)
    if not id_role:
        return jsonify({"ok": False, "error": "Rol no encontrado"}), 404

    db.usuario_set_role(cedula, id_role)
    return jsonify({"ok": True})


@perfil_usuarios_bp.route("/eliminar_usuario_admin", methods=["DELETE"])
@admin_required
def eliminar_usuario_admin():
    data   = request.get_json() or {}
    correo = (data.get("correo") or "").strip().lower()
    if not correo:
        return jsonify({"ok": False, "error": "Correo requerido"}), 400

    try:
        usuario = db.usuario_get_by_correo(correo)
        if not usuario:
            return jsonify({"ok": False, "error": "Usuario no encontrado"}), 404

        img = usuario.get("imagen_url", "")
        if img and "default_icon_profile" not in img:
            delete_image(img)

        db.usuario_delete(usuario["cedula"])
        return jsonify({"ok": True})
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500
