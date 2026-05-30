from datetime import datetime, timezone, timedelta
from flask import Blueprint, request, jsonify, session, redirect, url_for, render_template

import models as db
from helpers.auth import sin_cache, login_required

comentarios_bp = Blueprint("comentarios", __name__)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


@comentarios_bp.route("/comentarios_page")
@sin_cache
@login_required
def comentarios_page():
    user_id  = session.get("user_id")
    usuario  = db.usuario_get(user_id)
    if not usuario:
        return redirect(url_for("auth.login"))

    comentarios = db.comentario_get_all()
    usuarios_res = db.usuario_get_all()
    usuarios_dict = {
        u["cedula"]: {
            "nombre_usuario": f"{u.get('nombre','')} {u.get('apellido','')}".strip(),
            "foto_perfil":    u.get("imagen_url"),
        }
        for u in usuarios_res
    }

    for c in comentarios:
        info = usuarios_dict.get(c["cedula"], {"nombre_usuario": "Usuario", "foto_perfil": None})
        c["usuario_info"] = info
        if not c.get("foto_perfil"):
            c["foto_perfil"] = info["foto_perfil"]

    return render_template("general_modules/comentarios.html",
                           comentarios=comentarios, user_id=user_id)


@comentarios_bp.route("/comentarios", methods=["GET"])
def obtener_comentarios():
    try:
        comentarios = db.comentario_get_all()
        usuarios    = db.usuario_get_all()
        ahora       = datetime.now(timezone.utc)

        usuarios_dict = {}
        for u in usuarios:
            conectado     = False
            ultima_con    = u.get("ultima_conexion")
            if ultima_con:
                try:
                    fc = datetime.fromisoformat(ultima_con.replace("Z", "+00:00"))
                    conectado = (ahora - fc).total_seconds() < 60
                except Exception:
                    pass
            usuarios_dict[u["cedula"]] = {
                "nombre":    u.get("nombre", ""),
                "apellido":  u.get("apellido", ""),
                "foto_perfil": u.get("imagen_url"),
                "conectado": conectado,
            }

        for c in comentarios:
            c["usuario_info"] = usuarios_dict.get(c["cedula"], {
                "nombre": "Usuario", "apellido": "", "foto_perfil": None, "conectado": False
            })
            if c.get("likes_usuarios") is None:
                c["likes_usuarios"] = []

        return jsonify(comentarios)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@comentarios_bp.route("/comentarios", methods=["POST"])
@login_required
def crear_comentario():
    data    = request.get_json() or {}
    mensaje = (data.get("mensaje") or "").strip()
    if not mensaje:
        return jsonify({"error": "Mensaje vacío"}), 400

    usuario = db.usuario_get(session["user_id"])
    if not usuario:
        return jsonify({"error": "Usuario no encontrado"}), 404

    result = db.comentario_create({
        "cedula":         usuario["cedula"],
        "nombre_usuario": f"{usuario['nombre']} {usuario['apellido']}",
        "correo_usuario": usuario["correo"],
        "foto_perfil":    usuario.get("imagen_url"),
        "mensaje":        mensaje,
        "likes_usuarios": [],
    })
    return jsonify(result[0] if result else {})


@comentarios_bp.route("/comentarios/<id>", methods=["PUT"])
@login_required
def editar_comentario(id):
    data    = request.get_json() or {}
    mensaje = (data.get("mensaje") or "").strip()
    if not mensaje:
        return jsonify({"error": "Mensaje requerido"}), 400

    comentario = db.comentario_get(id)
    if not comentario:
        return jsonify({"error": "Comentario no encontrado"}), 404
    if comentario["cedula"] != session["user_id"]:
        return jsonify({"error": "Sin permiso"}), 403

    result = db.comentario_update(id, {"mensaje": mensaje})
    return jsonify(result[0] if result else {})


@comentarios_bp.route("/comentarios/<id>", methods=["DELETE"])
@login_required
def eliminar_comentario(id):
    comentario = db.comentario_get(id)
    if not comentario:
        return jsonify({"error": "Comentario no encontrado"}), 404
    if comentario["cedula"] != session["user_id"]:
        return jsonify({"error": "Sin permiso"}), 403
    db.comentario_delete(id)
    return jsonify({"ok": True})


@comentarios_bp.route("/comentarios/<id>/like", methods=["POST"])
@login_required
def toggle_like(id):
    user_id = session.get("user_id")
    try:
        comentario = db.comentario_get(id)
        if not comentario:
            return jsonify({"error": "No encontrado"}), 404
        likes = comentario.get("likes_usuarios") or []
        if not isinstance(likes, list):
            likes = []
        if user_id in likes:
            likes.remove(user_id)
        else:
            likes.append(user_id)
        db.comentario_update_likes(id, likes)
        return jsonify({"status": "ok", "likes": likes})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@comentarios_bp.route("/usuarios_activos_conteo")
def usuarios_activos_conteo():
    try:
        hace_poco = (datetime.now(timezone.utc) - timedelta(minutes=2)).isoformat()
        total     = db.usuarios_activos_desde(hace_poco)
        return jsonify({"total": total}), 200
    except Exception as e:
        return jsonify({"total": 0}), 200


@comentarios_bp.route("/actualizar_estado_comentarios", methods=["POST"])
@login_required
def actualizar_estado_comentarios():
    user_id = session.get("user_id")
    try:
        db.usuario_touch(user_id, _now())
        return jsonify({"status": "ok"}), 200
    except Exception:
        return jsonify({"error": "server_error"}), 500
