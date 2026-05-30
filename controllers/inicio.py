from flask import Blueprint, request, jsonify, render_template

import models as db
from helpers.auth import admin_required

inicio_bp = Blueprint("inicio", __name__)


@inicio_bp.route("/api/inicio/config", methods=["GET"])
def obtener_config():
    try:
        return jsonify(db.inicio_config_get()), 200
    except Exception:
        return jsonify({}), 200


@inicio_bp.route("/api/inicio/config", methods=["POST"])
@admin_required
def guardar_config():
    data = request.get_json() or {}
    try:
        db.inicio_config_save(data)
        return jsonify({"ok": True})
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500


@inicio_bp.route("/api/inicio/imagenes")
def imagenes_inicio():
    try:
        imagenes = db.publicidad_get_by_tipos(["carrusel", "seccion", "cinta"])
        return jsonify(imagenes), 200
    except Exception:
        return jsonify([]), 200
