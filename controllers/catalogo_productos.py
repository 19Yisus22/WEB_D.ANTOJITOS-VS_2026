from flask import Blueprint, request, jsonify, session, render_template

import helpers.models as db
from helpers.auth import sin_cache

catalogo_productos_bp = Blueprint("catalogo_productos", __name__)


@catalogo_productos_bp.route("/catalogo_page")
@sin_cache
def catalogo_page():
    try:
        user_id   = session.get("user_id")
        productos = db.producto_get_activos()
        for p in productos:
            p["agotado"] = int(p.get("stock", 0)) <= 0
        return render_template(
            "general_modules/catalogo.html",
            productos=productos,
            userLogged=bool(user_id),
        )
    except Exception as e:
        return f"Error cargando catálogo: {e}", 500


@catalogo_productos_bp.route("/obtener_catalogo")
def obtener_catalogo():
    try:
        productos = db.producto_get_activos()
        return jsonify({
            "productos": [{
                "id_producto": p["id_producto"],
                "nombre":      p.get("nombre") or "",
                "descripcion": p.get("descripcion") or "",
                "precio":      float(p.get("precio") or 0),
                "stock":       int(p.get("stock") or 0),
                "imagen_url":  p.get("imagen_url") or "",
                "categoria":   p.get("categoria") or "Postre",
                "fecha":       str(p.get("fecha_creacion") or ""),
            } for p in productos],
            "error": False,
        })
    except Exception as e:
        return jsonify({"error": True, "message": str(e)}), 500
