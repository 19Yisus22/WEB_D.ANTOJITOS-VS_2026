from flask import Blueprint, request, jsonify, session, render_template

import models as db
from helpers.auth import sin_cache, login_required, vendedor_required
from helpers.validators import ESTADOS_FACTURA

historial_facturas_bp = Blueprint("historial_facturas", __name__)


def _enriquecer_factura(f: dict) -> dict:
    detalles  = db.detalle_get(f.get("id_pedido", ""))
    productos = []
    for d in detalles:
        prod = d.get("gestion_productos") or {}
        productos.append({
            "nombre_producto": str(d.get("nombre_producto") or prod.get("nombre") or "Producto"),
            "cantidad":        int(d.get("cantidad") or 0),
            "precio_unitario": float(d.get("precio_unitario") or 0),
            "subtotal":        float(d.get("subtotal") or 0),
            "imagen":          str(prod.get("imagen_url") or "/static/uploads/default.png"),
        })
    return {
        "id_factura":     str(f.get("id_factura", "")),
        "numero_factura": str(f.get("numero_factura", "")),
        "fecha_emision":  str(f.get("fecha_emision", "")),
        "total":          float(f.get("total") or 0),
        "metodo_pago":    str(f.get("metodo_pago") or "No especificado"),
        "estado":         str(f.get("estado") or "Emitida"),
        "cedula":         str(f.get("cedula") or ""),
        "id_pedido":      str(f.get("id_pedido") or ""),
        "productos":      productos,
    }


@historial_facturas_bp.route("/gestionar_facturas_page")
@sin_cache
@login_required
def gestionar_facturas_page():
    return render_template("general_modules/facturas.html")


@historial_facturas_bp.route("/obtener_facturas_page")
@login_required
def obtener_facturas_page():
    user_id = session.get("user_id")
    try:
        facturas = db.factura_get_by_user(user_id)
        return jsonify([_enriquecer_factura(f) for f in facturas]), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@historial_facturas_bp.route("/buscar_facturas_page")
@login_required
def buscar_facturas_page():
    termino = request.args.get("q", "").strip() or request.args.get("cedula", "").strip()

    if not termino:
        return jsonify([]), 200

    try:
        usuario = None

        # 1. Buscar por cédula exacta
        usuario = db.usuario_get(termino)

        # 2. Buscar por correo
        if not usuario:
            usuario = db.usuario_get_by_correo(termino)

        # 3. Buscar por username
        if not usuario:
            usuario = db.usuario_get_by_username(termino)

        # 4. Buscar por nombre parcial
        if not usuario:
            usuario = db.usuario_buscar_por_nombre(termino)

        if not usuario:
            return jsonify([]), 200

        facturas = db.factura_get_by_user(usuario["cedula"])
        return jsonify([_enriquecer_factura(f) for f in facturas]), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@historial_facturas_bp.route("/anular_factura_page/<numero_factura>", methods=["PUT"])
@login_required
def anular_factura_page(numero_factura):
    user_id = session.get("user_id")
    rol     = session.get("rol")
    try:
        factura = db.factura_get_by_numero(numero_factura)
        if not factura:
            return jsonify({"message": "Factura no encontrada"}), 404
        if str(factura["cedula"]) != str(user_id) and rol not in ("admin", "vendedor"):
            return jsonify({"message": "Sin permiso"}), 403
        if factura["estado"].lower() in ("anulada", "pagada"):
            return jsonify({"message": f"No se puede anular en estado: {factura['estado']}"}), 400
        db.factura_update(numero_factura, {"estado": "Anulada"})
        db.pedido_update(factura["id_pedido"], {"estado": "Cancelado"})
        return jsonify({"message": "Factura anulada con éxito"}), 200
    except Exception as e:
        return jsonify({"message": str(e)}), 500


@historial_facturas_bp.route("/actualizar_estado_factura_page/<numero_factura>", methods=["PUT"])
@vendedor_required
def actualizar_estado_factura(numero_factura):
    data         = request.get_json(silent=True) or {}
    nuevo_estado = data.get("estado")
    if nuevo_estado not in ESTADOS_FACTURA:
        return jsonify({"message": "Estado no válido"}), 400
    try:
        factura = db.factura_get_by_numero(numero_factura)
        if not factura:
            return jsonify({"message": "Factura no encontrada"}), 404
        db.factura_update(numero_factura, {"estado": nuevo_estado})
        if nuevo_estado == "Pagada":
            db.pedido_update(factura["id_pedido"], {"pagado": True, "estado": "Entregado"})
        elif nuevo_estado == "Anulada":
            db.pedido_update(factura["id_pedido"], {"estado": "Cancelado"})
        return jsonify({"message": "Estado actualizado con éxito"}), 200
    except Exception as e:
        return jsonify({"message": str(e)}), 500


@historial_facturas_bp.route("/obtener_metodos_pago")
def obtener_metodos_pago():
    try:
        return jsonify({"metodos": db.metodo_pago_get_activos()}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
