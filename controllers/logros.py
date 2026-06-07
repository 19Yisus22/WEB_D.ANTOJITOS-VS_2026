from flask import Blueprint, jsonify, session
import helpers.models as db
from helpers.auth import login_required
from helpers.logros_utils import LOGROS_DEFINIDOS, verificar_y_otorgar

logros_bp = Blueprint("logros", __name__)


@logros_bp.route("/logros/todos")
def todos_los_logros():
    return jsonify(LOGROS_DEFINIDOS)


@logros_bp.route("/logros/mis_logros")
@login_required
def mis_logros():
    cedula = session.get("user_id")
    rol    = (session.get("rol") or "cliente").lower()
    if rol not in ("cliente", "vendedor", "admin"):
        rol = "cliente"
    logros_rol = [l for l in LOGROS_DEFINIDOS if rol in l.get("roles", [])]
    try:
        obtenidos = db.usuario_logros_get(cedula)
        stats     = db.usuario_stats_logros(cedula)
        rol_stats: dict = {}
        if rol in ("admin", "vendedor"):
            try:
                rol_stats = db.sistema_stats_logros()
            except Exception:
                rol_stats = {}
        return jsonify({
            "todos": logros_rol,
            "obtenidos": obtenidos,
            "stats": stats,
            "rol_stats": rol_stats,
        })
    except Exception as e:
        return jsonify({"todos": logros_rol, "obtenidos": [], "stats": {}, "rol_stats": {}, "error": str(e)})


@logros_bp.route("/logros/verificar", methods=["POST"])
@login_required
def verificar_logros():
    cedula = session.get("user_id")
    rol    = session.get("rol", "cliente")
    from flask import request
    contexto = request.get_json() or {}
    contexto["_rol"] = rol
    try:
        nuevos = verificar_y_otorgar(cedula, contexto)
        return jsonify({"nuevos": nuevos, "ok": True})
    except Exception as e:
        return jsonify({"nuevos": [], "ok": False, "error": str(e)})


@logros_bp.route("/logros/sembrar", methods=["POST"])
@login_required
def sembrar_logros():
    """Inserta todas las definiciones de logros en la BD (idempotente)."""
    if session.get("rol") != "admin":
        return jsonify({"error": "Sin permiso"}), 403
    try:
        db.logros_sembrar(LOGROS_DEFINIDOS)
        return jsonify({"ok": True, "total": len(LOGROS_DEFINIDOS)})
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500
