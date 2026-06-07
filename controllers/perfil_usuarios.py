from datetime import datetime, timezone
from functools import wraps
from flask import Blueprint, request, jsonify, session, render_template, Response

import helpers.models as db
from helpers.auth import sin_cache, admin_required, login_required
from helpers.cloudinary import delete_image, upload_raw_file, delete_raw_file

LIMITE_ALMACENAMIENTO = 100 * 1024 * 1024  # 100 MB por usuario

perfil_usuarios_bp = Blueprint("perfil_usuarios", __name__)


def _archivo_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        cedula  = str(kwargs.get("cedula") or "").strip()
        user_id = str(session.get("user_id") or "").strip()
        rol     = session.get("rol", "")
        if not user_id:
            return jsonify({"error": "No autorizado"}), 401
        if rol != "admin" and cedula != user_id:
            return jsonify({"error": "Acceso denegado"}), 403
        return f(*args, **kwargs)
    return decorated


@perfil_usuarios_bp.route("/gestion_usuarios_page")
@sin_cache
@admin_required
def gestion_usuarios_page():
    return render_template("admin_modules/gestion_usuarios.html")


@perfil_usuarios_bp.route("/listar_usuarios")
@login_required
def listar_usuarios():
    try:
        usuarios = db.usuario_get_all()
        resultado = []
        for u in usuarios:
            u["nombre_completo"] = f"{u.get('nombre','')} {u.get('apellido','')}".strip()
            u["rol"]             = u.get("roles", {}).get("nombre_role") if u.get("roles") else None
            contrasena           = u.pop("contrasena", "")
            letra_acc            = str(u.get("letraAcc") or "").upper()
            is_google            = (
                letra_acc == "G"
                or str(contrasena).upper() == "GOOGLE_AUTH_EXTERNAL"
                or str(u.get("cedula", "")).startswith("G-")
            )
            u["auth_method"]     = "google" if is_google else "email"
            resultado.append(u)
        return jsonify(resultado)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# Límites máximos por rol
_LIMITES_ROL = {
    "admin":    2,
    "vendedor": 3,
}
_NOMBRES_ROL = {
    "admin":    "administrador",
    "vendedor": "vendedor",
}

@perfil_usuarios_bp.route("/actualizar_rol_usuario", methods=["PUT"])
@admin_required
def actualizar_rol_usuario():
    data      = request.get_json() or {}
    cedula    = str(data.get("cedula") or data.get("id") or "").strip()
    nuevo_rol = (data.get("rol") or "").strip().lower()

    if not cedula or not nuevo_rol:
        return jsonify({"ok": False, "error": "Datos incompletos"}), 400

    id_role = db.rol_get_id(nuevo_rol)
    if not id_role:
        return jsonify({"ok": False, "error": "Rol no encontrado"}), 404

    # Verificar límite antes de asignar
    limite = _LIMITES_ROL.get(nuevo_rol)
    if limite is not None:
        # Excluir al propio usuario del conteo (por si ya tenía ese rol)
        conteo_actual = db.usuario_count_por_rol(nuevo_rol, excluir_cedula=cedula)
        if conteo_actual >= limite:
            nombre_rol = _NOMBRES_ROL.get(nuevo_rol, nuevo_rol)
            plural     = "es" if nuevo_rol == "admin" else "es"
            return jsonify({
                "ok":    False,
                "error": f"Límite alcanzado: el sistema solo permite {limite} {nombre_rol}{plural}."
            }), 409

    db.usuario_set_role(cedula, id_role)
    return jsonify({"ok": True})


@perfil_usuarios_bp.route("/api/usuarios/<cedula>/archivos", methods=["GET"])
@login_required
@_archivo_required
def get_archivos_usuario(cedula):
    if not db.usuario_get(cedula):
        return jsonify({"error": "Usuario no encontrado"}), 404
    return jsonify({"cedula": cedula, "archivos": db.usuario_get_block_folder(cedula)})


@perfil_usuarios_bp.route("/api/usuarios/<cedula>/archivos", methods=["POST"])
@login_required
@_archivo_required
def upload_archivo_usuario(cedula):
    if not db.usuario_get(cedula):
        return jsonify({"error": "Usuario no encontrado"}), 404

    if "archivo" not in request.files:
        return jsonify({"error": "No se recibió ningún archivo"}), 400

    file = request.files["archivo"]
    nombre_original = (file.filename or "").strip()
    if not nombre_original:
        return jsonify({"error": "Nombre de archivo inválido"}), 400

    raw = file.read()
    file.seek(0)
    archivos_actuales = db.usuario_get_block_folder(cedula)
    total_actual = sum(a.get("tamanio", 0) for a in archivos_actuales)
    if total_actual + len(raw) > LIMITE_ALMACENAMIENTO:
        return jsonify({"error": "Límite de almacenamiento de 100 MB alcanzado. Elimina archivos para liberar espacio."}), 413

    resultado = upload_raw_file(file, folder=f"archivos_privados/{cedula}")
    if not resultado:
        return jsonify({"error": "Error al subir el archivo"}), 500

    archivos = archivos_actuales
    entrada  = {
        "nombre":    nombre_original,
        "url":       resultado["url"],
        "public_id": resultado["public_id"],
        "tamanio":   resultado.get("bytes", 0),
        "tipo":      file.content_type or "application/octet-stream",
        "subido_en": datetime.now(timezone.utc).isoformat(),
    }
    archivos.append(entrada)
    db.usuario_set_block_folder(cedula, archivos)
    return jsonify({"ok": True, "archivo": entrada})


@perfil_usuarios_bp.route("/api/usuarios/<cedula>/archivos/<path:public_id>", methods=["PUT"])
@login_required
@_archivo_required
def rename_archivo_usuario(cedula, public_id):
    if not db.usuario_get(cedula):
        return jsonify({"error": "Usuario no encontrado"}), 404

    nuevo_nombre = (request.get_json() or {}).get("nombre", "").strip()
    if not nuevo_nombre:
        return jsonify({"error": "Nombre requerido"}), 400

    archivos = db.usuario_get_block_folder(cedula)
    archivo  = next((a for a in archivos if a.get("public_id") == public_id), None)
    if not archivo:
        return jsonify({"error": "Archivo no encontrado"}), 404

    archivo["nombre"] = nuevo_nombre
    db.usuario_set_block_folder(cedula, archivos)
    return jsonify({"ok": True, "archivo": archivo})


@perfil_usuarios_bp.route("/api/usuarios/<cedula>/archivos/<path:public_id>", methods=["DELETE"])
@login_required
@_archivo_required
def delete_archivo_usuario(cedula, public_id):
    if not db.usuario_get(cedula):
        return jsonify({"error": "Usuario no encontrado"}), 404

    archivos = db.usuario_get_block_folder(cedula)
    archivo  = next((a for a in archivos if a.get("public_id") == public_id), None)
    if not archivo:
        return jsonify({"error": "Archivo no encontrado"}), 404

    delete_raw_file(public_id)
    db.usuario_set_block_folder(cedula, [a for a in archivos if a.get("public_id") != public_id])
    return jsonify({"ok": True})


@perfil_usuarios_bp.route("/api/usuarios/<cedula>/descargar", methods=["GET"])
@login_required
@_archivo_required
def download_archivo_usuario(cedula):
    import requests as _req
    public_id = (request.args.get("pub") or "").strip()
    if not public_id:
        return jsonify({"error": "Parámetro pub requerido"}), 400
    if not db.usuario_get(cedula):
        return jsonify({"error": "Usuario no encontrado"}), 404
    archivos = db.usuario_get_block_folder(cedula)
    archivo  = next((a for a in archivos if a.get("public_id") == public_id), None)
    if not archivo:
        return jsonify({"error": "Archivo no encontrado"}), 404
    try:
        resp = _req.get(archivo["url"], timeout=30)
        resp.raise_for_status()
        nombre = archivo.get("nombre", "archivo")
        return Response(
            resp.content,
            headers={
                "Content-Disposition": f'attachment; filename="{nombre}"',
                "Content-Type": archivo.get("tipo", "application/octet-stream"),
            }
        )
    except Exception:
        return jsonify({"error": "Error al descargar el archivo"}), 500


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
