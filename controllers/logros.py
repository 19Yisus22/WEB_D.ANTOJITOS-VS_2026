from flask import Blueprint, jsonify, session, request
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
        obtenidos  = db.usuario_logros_get(cedula)
        stats      = db.usuario_stats_logros(cedula)
        rol_stats: dict = {}
        if rol in ("admin", "vendedor"):
            try:
                rol_stats = db.sistema_stats_logros()
            except Exception:
                rol_stats = {}
        try:
            contadores = db.logros_contadores_get(cedula)
        except Exception:
            contadores = {}
        return jsonify({
            "todos":      logros_rol,
            "obtenidos":  obtenidos,
            "stats":      stats,
            "rol_stats":  rol_stats,
            "contadores": contadores,
        })
    except Exception as e:
        return jsonify({
            "todos": logros_rol, "obtenidos": [], "stats": {},
            "rol_stats": {}, "contadores": {}, "error": str(e),
        })


@logros_bp.route("/logros/verificar", methods=["POST"])
@login_required
def verificar_logros():
    cedula   = session.get("user_id")
    rol      = session.get("rol", "cliente")
    contexto = request.get_json() or {}
    contexto["_rol"] = rol
    try:
        nuevos = verificar_y_otorgar(cedula, contexto)
        return jsonify({"nuevos": nuevos, "ok": True})
    except Exception as e:
        return jsonify({"nuevos": [], "ok": False, "error": str(e)})


@logros_bp.route("/logros/contadores", methods=["GET"])
@login_required
def get_contadores():
    cedula = session.get("user_id")
    try:
        return jsonify(db.logros_contadores_get(cedula)), 200
    except Exception:
        return jsonify({}), 200


@logros_bp.route("/logros/contadores", methods=["POST"])
@login_required
def set_contadores():
    cedula = session.get("user_id")
    data   = request.get_json() or {}
    try:
        actuales = db.logros_contadores_get(cedula)
        fusionados = {k: max(int(v), int(actuales.get(k, 0))) for k, v in data.items() if isinstance(v, (int, float))}
        if fusionados:
            db.logros_contadores_upsert_many(cedula, fusionados)
        return jsonify({"ok": True, "guardados": len(fusionados)}), 200
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 200


