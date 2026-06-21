from datetime import datetime, timezone, timedelta
from flask import Blueprint, current_app, request, jsonify, session, redirect, url_for, render_template

import database.models as db
from helpers.auth import sin_cache, login_required
from extensions import socketio

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

def _cutoff_from_modo(modo: str):
    ahora = datetime.now(timezone.utc)
    if modo == "1min":
        return (ahora - timedelta(minutes=1)).isoformat()
    elif modo == "24h":
        return (ahora - timedelta(hours=24)).isoformat()
    elif modo == "7d":
        return (ahora - timedelta(days=7)).isoformat()
    elif modo == "mensual":
        return (ahora - timedelta(days=30)).isoformat()
    return None

def _get_admin_cedulas() -> list:
    try:
        return [
            u["cedula"] for u in db.usuario_get_all()
            if (u.get("roles") or {}).get("nombre_role") == "admin"
        ]
    except Exception:
        return []

def _auto_cleanup_chat():
    try:
        cfg  = db.inicio_config_get()
        modo = cfg.get("chat_temporal_modo_publico") or cfg.get("chat_temporal_modo", "desactivado")
        if modo == "desactivado":
            return
        cutoff = _cutoff_from_modo(modo)
        if not cutoff:
            return
        db.comentario_delete_non_admin_before(cutoff, _get_admin_cedulas())
    except Exception:
        pass

def _auto_cleanup_privados():
    try:
        cfg  = db.inicio_config_get()
        modo = cfg.get("chat_temporal_modo_privado", "desactivado")
        if modo == "desactivado":
            return
        cutoff = _cutoff_from_modo(modo)
        if not cutoff:
            return
        db.mp_delete_non_admin_before(cutoff, _get_admin_cedulas())
    except Exception:
        pass

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
        _auto_cleanup_chat()
        comentarios = db.comentario_get_all()
        usuarios    = db.usuario_get_all()
        ahora       = datetime.now(timezone.utc)
        usuarios_dict = {}
        for u in usuarios:
            conectado  = False
            ultima_con = u.get("ultima_conexion")
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
        data      = request.get_json() or {}
        mensaje   = (data.get("mensaje") or "").strip()
        adjuntos  = data.get("adjuntos") or []
        if not mensaje and not adjuntos:
            return jsonify({"error": "Mensaje vacío"}), 400
        if not isinstance(adjuntos, list):
            adjuntos = []
        adjuntos = [a for a in adjuntos if isinstance(a, dict) and len(str(a.get("data","")))<= 3_000_000]
        usuario = db.usuario_get(session["user_id"])
        if not usuario:
            return jsonify({"error": "Usuario no encontrado"}), 404
        result = db.comentario_create({
            "cedula":         usuario["cedula"],
            "nombre_usuario": f"{usuario.get('nombre','')} {usuario.get('apellido','')}".strip(),
            "correo_usuario": usuario.get("correo", ""),
            "foto_perfil":    usuario.get("imagen_url"),
            "mensaje":        mensaje or "",
            "likes_usuarios": [],
            "adjuntos":       adjuntos,
        })
        resp = result[0] if result else {}
        socketio.emit("chat_new_msg", {"id": resp.get("id"), "cedula": str(usuario["cedula"])})
        return jsonify(resp)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


_MODOS_VALIDOS = ("desactivado", "1min", "24h", "7d", "mensual")

@comentarios_bp.route("/comentarios/config_temporal", methods=["GET"])
@login_required
def get_config_temporal():
    cfg = db.inicio_config_get()
    modo = cfg.get("chat_temporal_modo_publico") or cfg.get("chat_temporal_modo", "desactivado")
    activado_en = cfg.get("chat_temporal_pub_activado_en") or None
    if modo == "desactivado":
        activado_en = None
    habilitado_1min = bool(current_app.config.get("CHAT_1MIN_HABILITADO", True))
    return jsonify({"modo": modo, "activado_en": activado_en, "chat_1min_habilitado": habilitado_1min})

@comentarios_bp.route("/comentarios/config_temporal", methods=["POST"])
@login_required
def set_config_temporal():
    if session.get("rol") != "admin":
        return jsonify({"error": "Sin permiso"}), 403
    data = request.get_json() or {}
    modo = data.get("modo", "desactivado")
    if modo not in _MODOS_VALIDOS:
        return jsonify({"error": "Modo inválido"}), 400
    cfg = db.inicio_config_get()
    modo_actual = cfg.get("chat_temporal_modo_publico") or cfg.get("chat_temporal_modo", "desactivado")
    save_data = {"chat_temporal_modo_publico": modo}
    activado_en = None
    if modo != "desactivado":
        existing = cfg.get("chat_temporal_pub_activado_en") or ""
        if modo_actual == "desactivado" or not existing:
            activado_en = datetime.now(timezone.utc).isoformat()
            save_data["chat_temporal_pub_activado_en"] = activado_en
        else:
            activado_en = existing
    else:
        save_data["chat_temporal_pub_activado_en"] = ""
    db.inicio_config_save(save_data)
    if modo != "desactivado":
        # Borrar TODOS los mensajes no-admin hasta este instante (sin filtro de ventana)
        cutoff_ahora = datetime.now(timezone.utc).isoformat()
        protegidos = _get_admin_cedulas() or [session["user_id"]]
        db.comentario_delete_non_admin_before(cutoff_ahora, protegidos)
        socketio.emit("chat_cleanup", {})
    return jsonify({"ok": True, "activado_en": activado_en})

@comentarios_bp.route("/mensajes_privados/config_temporal", methods=["GET"])
@login_required
def get_config_temporal_privado():
    cfg = db.inicio_config_get()
    modo = cfg.get("chat_temporal_modo_privado", "desactivado")
    activado_en = cfg.get("chat_temporal_priv_activado_en") or None
    if modo == "desactivado":
        activado_en = None
    habilitado_1min = bool(current_app.config.get("CHAT_1MIN_HABILITADO", True))
    return jsonify({"modo": modo, "activado_en": activado_en, "chat_1min_habilitado": habilitado_1min})

@comentarios_bp.route("/mensajes_privados/config_temporal", methods=["POST"])
@login_required
def set_config_temporal_privado():
    if session.get("rol") != "admin":
        return jsonify({"error": "Sin permiso"}), 403
    data = request.get_json() or {}
    modo = data.get("modo", "desactivado")
    if modo not in _MODOS_VALIDOS:
        return jsonify({"error": "Modo inválido"}), 400
    cfg = db.inicio_config_get()
    modo_actual = cfg.get("chat_temporal_modo_privado", "desactivado")
    save_data = {"chat_temporal_modo_privado": modo}
    activado_en = None
    if modo != "desactivado":
        existing = cfg.get("chat_temporal_priv_activado_en") or ""
        if modo_actual == "desactivado" or not existing:
            activado_en = datetime.now(timezone.utc).isoformat()
            save_data["chat_temporal_priv_activado_en"] = activado_en
        else:
            activado_en = existing
    else:
        save_data["chat_temporal_priv_activado_en"] = ""
    db.inicio_config_save(save_data)
    if modo != "desactivado":
        # Borrar TODOS los mensajes privados no-admin hasta este instante (sin filtro de ventana)
        cutoff_ahora = datetime.now(timezone.utc).isoformat()
        protegidos = _get_admin_cedulas() or [session["user_id"]]
        db.mp_delete_non_admin_before(cutoff_ahora, protegidos)
        socketio.emit("priv_cleanup", {})
    return jsonify({"ok": True, "activado_en": activado_en})


@comentarios_bp.route("/comentarios/bulk", methods=["DELETE"])
@login_required
def bulk_eliminar_comentarios():
    if session.get("rol") != "admin":
        return jsonify({"error": "Sin permiso"}), 403
    data = request.get_json() or {}
    ids  = data.get("ids") or []
    if not isinstance(ids, list) or not ids:
        return jsonify({"error": "ids requeridos"}), 400
    try:
        db.comentario_delete_many(ids)
        return jsonify({"ok": True, "eliminados": len(ids)})
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
        if session.get("rol") != "admin" and comentario.get("es_editado"):
            return jsonify({"error": "Solo se puede editar una vez"}), 409
        ahora  = datetime.now(timezone.utc).isoformat()
        result = db.comentario_update(id, {"mensaje": mensaje, "updated_at": ahora, "es_editado": True})
        return jsonify(result[0] if result else {})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@comentarios_bp.route("/comentarios/<id>", methods=["DELETE"])
@login_required
def eliminar_comentario(id):
    if session.get("rol") != "admin":
        return jsonify({"error": "Sin permiso"}), 403
    try:
        comentario = db.comentario_get(id)
        if not comentario:
            return jsonify({"error": "Comentario no encontrado"}), 404
        db.comentario_delete(id)
        return jsonify({"ok": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@comentarios_bp.route("/comentarios/limpiar_todo", methods=["DELETE"])
@login_required
def limpiar_todos_comentarios():
    if session.get("rol") != "admin":
        return jsonify({"error": "Sin permiso"}), 403
    try:
        db.comentario_delete_all()
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

@comentarios_bp.route("/desconectar_usuario", methods=["POST"])
@login_required
def desconectar_usuario():
    user_id = session.get("user_id")
    try:
        db.usuario_touch(user_id, "2000-01-01T00:00:00+00:00")
        return jsonify({"status": "ok"}), 200
    except Exception:
        return jsonify({"status": "ok"}), 200

@comentarios_bp.route("/mensajes_privados/predeterminados")
@login_required
def mensajes_predeterminados():
    return jsonify(MENSAJES_PREDETERMINADOS)

@comentarios_bp.route("/mensajes_privados/mi_hilo")
@login_required
def mi_hilo():
    cedula = session.get("user_id")
    rol    = session.get("rol", "")
    if rol != "cliente":
        return jsonify({"error": "Solo para clientes"}), 403
    try:
        _auto_cleanup_privados()
        mensajes = db.mp_get_conversacion(cedula)
        db.mp_marcar_leidos(cedula, es_vendedor_leyendo=False)
        return jsonify(mensajes)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@comentarios_bp.route("/mensajes_privados/hilos")
@login_required
def todos_los_hilos():
    rol = session.get("rol", "")
    if rol not in ("vendedor", "admin"):
        return jsonify({"error": "Sin permiso"}), 403
    try:
        mensajes = db.mp_get_todos_hilos()
        cedulas  = list({m["cedula_de"] for m in mensajes})
        usuarios = db.usuario_get_all()
        info_map = {
            u["cedula"]: {"nombre": f"{u.get('nombre','')} {u.get('apellido','')}".strip(), "imagen": u.get("imagen_url")}
            for u in usuarios if u["cedula"] in cedulas
        }
        hilos = {}
        for m in mensajes:
            cc = m["cedula_de"]
            if cc not in hilos:
                hilos[cc] = {
                    "cedula_cliente": cc,
                    "info_cliente":   info_map.get(cc, {"nombre": cc, "imagen": None}),
                    "ultimo_mensaje": m["mensaje"],
                    "ultimo_at":      m["created_at"],
                    "no_leidos":      0,
                }
            es_msg_cliente = m["cedula_para"] == m["cedula_de"]
            if es_msg_cliente and not m["leido"]:
                hilos[cc]["no_leidos"] += 1
        return jsonify(list(hilos.values()))
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@comentarios_bp.route("/mensajes_privados/hilo/<cedula_cliente>")
@login_required
def hilo_detalle(cedula_cliente):
    rol = session.get("rol", "")
    if rol not in ("vendedor", "admin"):
        return jsonify({"error": "Sin permiso"}), 403
    try:
        _auto_cleanup_privados()
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
    adjuntos = data.get("adjuntos") or []
    if not isinstance(adjuntos, list):
        adjuntos = []
    adjuntos = [a for a in adjuntos if isinstance(a, dict) and len(str(a.get("data","")))<= 3_000_000]
    if not msg and not adjuntos:
        return jsonify({"error": "Mensaje vacío"}), 400
    es_vendedor = rol in ("vendedor", "admin")
    if es_vendedor:
        cedula_cliente = (data.get("cedula_cliente") or "").strip()
        if not cedula_cliente:
            return jsonify({"error": "cedula_cliente requerida"}), 400
        es_pred = False
    else:
        cedula_cliente = cedula
        es_pred = bool(data.get("es_predeterminado", False))
    try:
        nuevo = db.mp_create(
            cedula_cliente    = cedula_cliente,
            cedula_remitente  = cedula,
            es_vendedor       = es_vendedor,
            mensaje           = msg or "",
            es_predeterminado = es_pred,
            adjuntos          = adjuntos,
        )
        destinatario = cedula_cliente if es_vendedor else None
        socketio.emit("priv_new_msg", {"cedula_de": cedula, "cedula_para": cedula_cliente}, room="staff")
        if destinatario:
            socketio.emit("priv_new_msg", {"cedula_de": cedula, "cedula_para": cedula_cliente}, room=f"user_{destinatario}")
        return jsonify({"ok": True, "mensaje": nuevo})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@comentarios_bp.route("/mensajes_privados/<id>", methods=["PUT"])
@login_required
def editar_mensaje_privado(id):
    cedula = session.get("user_id")
    data   = request.get_json() or {}
    msg    = (data.get("mensaje") or "").strip()
    if not msg:
        return jsonify({"error": "Mensaje vacío"}), 400
    try:
        registro = db.mp_get_by_id(id)
        if not registro:
            return jsonify({"error": "No encontrado"}), 404
        if registro.get("cedula_de") != cedula:
            return jsonify({"error": "Sin permiso"}), 403
        if session.get("rol") != "admin" and registro.get("es_editado"):
            return jsonify({"error": "Solo se puede editar una vez"}), 409
        db.mp_update(id, msg)
        return jsonify({"ok": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@comentarios_bp.route("/mensajes_privados/<id>", methods=["DELETE"])
@login_required
def eliminar_mensaje_privado(id):
    if session.get("rol") != "admin":
        return jsonify({"error": "Sin permiso"}), 403
    try:
        msg = db.mp_get_by_id(id)
        if not msg:
            return jsonify({"error": "No encontrado"}), 404
        db.mp_delete(id)
        return jsonify({"ok": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@comentarios_bp.route("/mensajes_privados/hilo/<cedula_hilo>/limpiar", methods=["DELETE"])
@login_required
def limpiar_hilo_cv(cedula_hilo):
    rol = session.get("rol", "")
    if rol not in ("vendedor", "admin"):
        return jsonify({"error": "Sin permiso"}), 403
    try:
        db.mp_delete_hilo(cedula_hilo, "cv")
        return jsonify({"ok": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@comentarios_bp.route("/mensajes_privados/no_leidos")
@login_required
def no_leidos_count():
    cedula = session.get("user_id")
    rol    = session.get("rol", "")
    ecv    = request.args.get("ecv",  "").strip()
    estf   = request.args.get("estf", "").strip()
    try:
        cv_n    = 0
        staff_n = 0
        if rol == "cliente":
            cv_n = db.mp_no_leidos(cedula) if not ecv else 0
        elif rol == "vendedor":
            cv_n    = db.mp_total_no_leidos_vendedor(excluir=ecv)
            staff_n = db.mp_staff_no_leidos(cedula, excluir=estf)
        elif rol == "admin":
            staff_n = db.mp_staff_no_leidos(cedula, excluir=estf)
        return jsonify({"count": cv_n + staff_n, "cv": cv_n, "staff": staff_n})
    except Exception:
        return jsonify({"count": 0, "cv": 0, "staff": 0})

@comentarios_bp.route("/mensajes_privados/marcar_leidos", methods=["POST"])
@login_required
def marcar_leidos():
    cedula = session.get("user_id")
    rol    = session.get("rol", "")
    data   = request.get_json() or {}
    try:
        if rol == "cliente":
            db.mp_marcar_leidos(cedula, es_vendedor_leyendo=False)
        elif rol in ("vendedor", "admin"):
            cc = (data.get("cedula_cliente") or "").strip()
            if cc:
                db.mp_marcar_leidos(cc, es_vendedor_leyendo=True)
        return jsonify({"ok": True})
    except Exception:
        return jsonify({"ok": False})

@comentarios_bp.route("/mensajes_privados/staff/marcar_leidos", methods=["POST"])
@login_required
def staff_marcar_leidos():
    cedula = session.get("user_id")
    rol    = session.get("rol", "")
    if rol not in ("vendedor", "admin"):
        return jsonify({"error": "Sin permiso"}), 403
    data       = request.get_json() or {}
    cedula_otro = (data.get("cedula_otro") or "").strip()
    try:
        if cedula_otro:
            db.mp_staff_marcar_leidos(cedula_otro, cedula, lector=cedula)
        return jsonify({"ok": True})
    except Exception:
        return jsonify({"ok": False})

@comentarios_bp.route("/mensajes_privados/staff/contactos")
@login_required
def staff_contactos():
    rol    = session.get("rol", "")
    cedula = session.get("user_id")
    if rol not in ("vendedor", "admin"):
        return jsonify({"error": "Sin permiso"}), 403
    try:
        todos = db.usuario_get_all()
        contactos = []
        for u in todos:
            if (u.get("roles") or {}).get("nombre_role") not in ("vendedor", "admin"):
                continue
            if u["cedula"] == cedula:
                continue
            try:
                no_leidos = db.mp_staff_no_leidos_por_cedula(cedula, u["cedula"])
            except Exception:
                no_leidos = 0
            contactos.append({
                "cedula":    u["cedula"],
                "nombre":    f"{u.get('nombre','')} {u.get('apellido','')}".strip(),
                "imagen":    u.get("imagen_url"),
                "rol":       (u.get("roles") or {}).get("nombre_role", "cliente"),
                "no_leidos": no_leidos,
            })
        return jsonify(contactos)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@comentarios_bp.route("/mensajes_privados/staff/hilo/<cedula_otro>")
@login_required
def staff_hilo(cedula_otro):
    rol    = session.get("rol", "")
    cedula = session.get("user_id")
    if rol not in ("vendedor", "admin"):
        return jsonify({"error": "Sin permiso"}), 403
    try:
        mensajes = db.mp_staff_get_conversacion(cedula, cedula_otro)
        db.mp_staff_marcar_leidos(cedula_otro, cedula, lector=cedula)
        return jsonify(mensajes)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@comentarios_bp.route("/mensajes_privados/staff/enviar", methods=["POST"])
@login_required
def staff_enviar():
    rol    = session.get("rol", "")
    cedula = session.get("user_id")
    if rol not in ("vendedor", "admin"):
        return jsonify({"error": "Sin permiso"}), 403
    data      = request.get_json() or {}
    msg       = (data.get("mensaje") or "").strip()
    cedula_to = (data.get("cedula_dest") or "").strip()
    adjuntos  = data.get("adjuntos") or []
    if not isinstance(adjuntos, list):
        adjuntos = []
    adjuntos = [a for a in adjuntos if isinstance(a, dict) and len(str(a.get("data", ""))) <= 3_000_000]
    if not msg and not adjuntos:
        return jsonify({"error": "Datos incompletos"}), 400
    if not cedula_to:
        return jsonify({"error": "Datos incompletos"}), 400
    try:
        nuevo = db.mp_staff_create(cedula_from=cedula, cedula_to=cedula_to, mensaje=msg or "", adjuntos=adjuntos or None)
        return jsonify({"ok": True, "mensaje": nuevo})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@comentarios_bp.route("/mensajes_privados/staff/hilo/<cedula_otro>/limpiar", methods=["DELETE"])
@login_required
def limpiar_hilo_staff(cedula_otro):
    rol    = session.get("rol", "")
    cedula = session.get("user_id")
    if rol not in ("vendedor", "admin"):
        return jsonify({"error": "Sin permiso"}), 403
    try:
        from database.models import _staff_thread_key
        c1, c2 = _staff_thread_key(cedula, cedula_otro)
        db.mp_delete_hilo(c1, "staff")
        return jsonify({"ok": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
