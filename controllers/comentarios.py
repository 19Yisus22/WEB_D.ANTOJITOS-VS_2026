from datetime import datetime, timezone, timedelta
from flask import Blueprint, request, jsonify, session, redirect, url_for, render_template

import helpers.models as db
from helpers.auth import sin_cache, login_required

# Mensajes predeterminados que el cliente puede enviar al vendedor
MENSAJES_PREDETERMINADOS = [
    {"id": 1, "icono": "🚚", "texto": "Mi pedido no ha llegado"},
    {"id": 2, "icono": "❌", "texto": "He cancelado mi pedido"},
    {"id": 3, "icono": "🔄", "texto": "Quiero modificar o cambiar mi pedido"},
    {"id": 4, "icono": "💳", "texto": "Tuve un problema con el pago"},
    {"id": 5, "icono": "📦", "texto": "Mi pedido llegó incompleto o dañado"},
    {"id": 6, "icono": "⏰", "texto": "¿Cuándo llegará mi pedido?"},
    {"id": 7, "icono": "📍", "texto": "Necesito cambiar mi dirección de entrega"},
    {"id": 8, "icono": "❓", "texto": "Tengo una pregunta sobre un producto"},
    {"id": 9, "icono": "🤔", "texto": "No puedo completar mi compra"},
    {"id": 10,"icono": "⭐", "texto": "Quiero dejar una reseña de mi experiencia"},
]

comentarios_bp = Blueprint("comentarios", __name__)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


@comentarios_bp.route("/comentarios_page")
@sin_cache
@login_required
def comentarios_page():
    try:
        user_id  = session.get("user_id")
        usuario  = db.usuario_get(user_id)
        if not usuario:
            return redirect(url_for("auth.login"))

        comentarios  = db.comentario_get_all()
        usuarios_res = db.usuario_get_all()
        usuarios_dict = {
            u["cedula"]: {
                "nombre_usuario": f"{u.get('nombre','')} {u.get('apellido','')}".strip(),
                "foto_perfil":    u.get("imagen_url"),
            }
            for u in usuarios_res
        }
        for c in comentarios:
            info = usuarios_dict.get(c.get("cedula") or "", {"nombre_usuario": "Usuario", "foto_perfil": None})
            c["usuario_info"] = info
            if not c.get("foto_perfil"):
                c["foto_perfil"] = info["foto_perfil"]

        return render_template("general_modules/comentarios.html",
                               comentarios=comentarios, user_id=user_id)
    except Exception:
        return render_template("general_modules/comentarios.html",
                               comentarios=[], user_id=session.get("user_id"))


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
    try:
        data    = request.get_json() or {}
        mensaje = (data.get("mensaje") or "").strip()
        if not mensaje:
            return jsonify({"error": "Mensaje vacío"}), 400

        usuario = db.usuario_get(session["user_id"])
        if not usuario:
            return jsonify({"error": "Usuario no encontrado"}), 404

        result = db.comentario_create({
            "cedula":         usuario["cedula"],
            "nombre_usuario": f"{usuario.get('nombre','')} {usuario.get('apellido','')}".strip(),
            "correo_usuario": usuario.get("correo", ""),
            "foto_perfil":    usuario.get("imagen_url"),
            "mensaje":        mensaje,
            "likes_usuarios": [],
        })
        return jsonify(result[0] if result else {})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@comentarios_bp.route("/comentarios/<id>", methods=["PUT"])
@login_required
def editar_comentario(id):
    try:
        data    = request.get_json() or {}
        mensaje = (data.get("mensaje") or "").strip()
        if not mensaje:
            return jsonify({"error": "Mensaje requerido"}), 400

        comentario = db.comentario_get(id)
        if not comentario:
            return jsonify({"error": "Comentario no encontrado"}), 404
        if comentario.get("cedula") != session.get("user_id"):
            return jsonify({"error": "Sin permiso"}), 403

        result = db.comentario_update(id, {"mensaje": mensaje})
        return jsonify(result[0] if result else {})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@comentarios_bp.route("/comentarios/<id>", methods=["DELETE"])
@login_required
def eliminar_comentario(id):
    try:
        comentario = db.comentario_get(id)
        if not comentario:
            return jsonify({"error": "Comentario no encontrado"}), 404
        if comentario.get("cedula") != session.get("user_id"):
            return jsonify({"error": "Sin permiso"}), 403
        db.comentario_delete(id)
        return jsonify({"ok": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


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


# ════════════════════════════════════════════════════
#  MENSAJES PRIVADOS  (clientes ↔ vendedores)
# ════════════════════════════════════════════════════

@comentarios_bp.route("/mensajes_privados/predeterminados")
@login_required
def mensajes_predeterminados():
    return jsonify(MENSAJES_PREDETERMINADOS)


@comentarios_bp.route("/mensajes_privados/mi_hilo")
@login_required
def mi_hilo():
    """Cliente: obtiene su propia conversación y marca mensajes del vendedor como leídos."""
    cedula = session.get("user_id")
    rol    = session.get("rol", "")
    if rol not in ("cliente",):
        return jsonify({"error": "Solo para clientes"}), 403
    try:
        mensajes = db.mp_get_conversacion(cedula)
        db.mp_marcar_leidos(cedula, es_vendedor_leyendo=False)
        return jsonify(mensajes)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@comentarios_bp.route("/mensajes_privados/hilos")
@login_required
def todos_los_hilos():
    """Vendedor: obtiene todos los hilos con info del cliente."""
    rol = session.get("rol", "")
    if rol not in ("vendedor", "admin"):
        return jsonify({"error": "Sin permiso"}), 403
    try:
        mensajes = db.mp_get_todos_hilos()
        # Obtener info de clientes
        cedulas  = list({m["cedula_cliente"] for m in mensajes})
        usuarios = db.usuario_get_all()
        info_map = {
            u["cedula"]: {
                "nombre":   f"{u.get('nombre','')} {u.get('apellido','')}".strip(),
                "imagen":   u.get("imagen_url"),
            }
            for u in usuarios if u["cedula"] in cedulas
        }
        # Agrupa en hilos (último mensaje por cedula_cliente)
        hilos = {}
        for m in mensajes:
            cc = m["cedula_cliente"]
            if cc not in hilos:
                hilos[cc] = {
                    "cedula_cliente":   cc,
                    "info_cliente":     info_map.get(cc, {"nombre": cc, "imagen": None}),
                    "ultimo_mensaje":   m["mensaje"],
                    "ultimo_at":        m["created_at"],
                    "no_leidos":        0,
                }
            if not m["es_vendedor"] and not m["leido"]:
                hilos[cc]["no_leidos"] += 1
        return jsonify(list(hilos.values()))
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@comentarios_bp.route("/mensajes_privados/hilo/<cedula_cliente>")
@login_required
def hilo_detalle(cedula_cliente):
    """Vendedor: obtiene la conversación de un cliente específico y la marca leída."""
    rol = session.get("rol", "")
    if rol not in ("vendedor", "admin"):
        return jsonify({"error": "Sin permiso"}), 403
    try:
        mensajes = db.mp_get_conversacion(cedula_cliente)
        db.mp_marcar_leidos(cedula_cliente, es_vendedor_leyendo=True)
        return jsonify(mensajes)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@comentarios_bp.route("/mensajes_privados/enviar", methods=["POST"])
@login_required
def enviar_mensaje_privado():
    data   = request.get_json() or {}
    cedula = session.get("user_id")
    rol    = session.get("rol", "")
    msg    = (data.get("mensaje") or "").strip()

    if not msg:
        return jsonify({"error": "Mensaje vacío"}), 400

    es_vendedor = rol in ("vendedor", "admin")

    if es_vendedor:
        # Vendedor responde → cedula_cliente viene del body
        cedula_cliente = (data.get("cedula_cliente") or "").strip()
        if not cedula_cliente:
            return jsonify({"error": "cedula_cliente requerida"}), 400
        es_pred = False
    else:
        # Cliente → es su propio hilo
        cedula_cliente = cedula
        es_pred = bool(data.get("es_predeterminado", False))

    try:
        nuevo = db.mp_create(
            cedula_cliente    = cedula_cliente,
            cedula_remitente  = cedula,
            es_vendedor       = es_vendedor,
            mensaje           = msg,
            es_predeterminado = es_pred,
        )
        return jsonify({"ok": True, "mensaje": nuevo})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@comentarios_bp.route("/mensajes_privados/no_leidos")
@login_required
def no_leidos_count():
    cedula = session.get("user_id")
    rol    = session.get("rol", "")
    try:
        if rol == "cliente":
            n = db.mp_no_leidos(cedula, para_vendedor=False)
        else:
            n = db.mp_total_no_leidos_vendedor()
        return jsonify({"count": n})
    except Exception:
        return jsonify({"count": 0})
