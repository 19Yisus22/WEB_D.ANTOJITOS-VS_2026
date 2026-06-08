from flask import Blueprint, request, jsonify, session, redirect, render_template

import helpers.models as db
from helpers.auth import sin_cache, login_required, vendedor_required
from helpers.validators import ESTADOS_PEDIDO, ESTADOS_FACTURA

pedidos_usuarios_bp = Blueprint("pedidos_usuarios", __name__)


@pedidos_usuarios_bp.route("/pedidos_page")
@sin_cache
@vendedor_required
def pedidos_page():
    return render_template("admin_modules/pedidos.html")


@pedidos_usuarios_bp.route("/obtener_pedidos")
@vendedor_required
def obtener_pedidos():
    try:
        pedidos = db.pedido_get_all()
        for p in pedidos:
            estado = p.get("estado")
            pagado = p.get("pagado")
            if estado == "Pendiente":
                p["estado_factura"] = "Emitida"
            elif estado in ("Entregado", "Enviado") and pagado:
                p["estado_factura"] = "Pagada"
            elif estado == "Cancelado":
                p["estado_factura"] = "Anulada"
            else:
                p["estado_factura"] = "Emitida"
        return jsonify(pedidos), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@pedidos_usuarios_bp.route("/actualizar_estado/<uuid:id_pedido>", methods=["PUT"])
@vendedor_required
def actualizar_estado(id_pedido):
    try:
        data        = request.get_json(silent=True) or {}
        nuevo_estado = data.get("estado")
        if nuevo_estado not in ESTADOS_PEDIDO:
            return jsonify({"error": f"Estado inválido. Válidos: {ESTADOS_PEDIDO}"}), 400

        id_str = str(id_pedido)
        pedido = db.pedido_get(id_str)
        if not pedido:
            return jsonify({"error": "Pedido no encontrado"}), 404

        db.pedido_update(id_str, {"estado": nuevo_estado})

        estado_factura = "Emitida"
        if nuevo_estado in ("Entregado", "Enviado") and pedido.get("pagado"):
            estado_factura = "Pagada"
        elif nuevo_estado == "Cancelado":
            estado_factura = "Anulada"

        factura = db.factura_get_by_numero(pedido.get("numero_factura", ""))
        if factura:
            db.factura_update(pedido["numero_factura"], {"estado": estado_factura})

        return jsonify({"ok": True, "nuevo_estado": nuevo_estado, "estado_factura": estado_factura}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@pedidos_usuarios_bp.route("/actualizar_pago_item/<uuid:id_pedido>", methods=["PUT"])
@vendedor_required
def actualizar_pago_item(id_pedido):
    try:
        data   = request.get_json(silent=True) or {}
        pagado = data.get("pagado")
        if pagado is None:
            return jsonify({"error": "Falta el valor de pago"}), 400
        id_str = str(id_pedido)
        if not db.pedido_get(id_str):
            return jsonify({"error": "Pedido no encontrado"}), 404
        db.pedido_update(id_str, {"pagado": bool(pagado)})
        return jsonify({"ok": True}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@pedidos_usuarios_bp.route("/actualizar_pago_general/<uuid:id_pedido>", methods=["PUT"])
@vendedor_required
def actualizar_pago_general(id_pedido):
    try:
        data          = request.get_json(silent=True) or {}
        pagado_general = data.get("pagado")
        if pagado_general is None:
            return jsonify({"error": "Falta el valor de pago"}), 400

        id_str = str(id_pedido)
        pedido = db.pedido_get(id_str)
        if not pedido:
            return jsonify({"error": "Pedido no encontrado"}), 404

        db.pedido_update(id_str, {"pagado": bool(pagado_general)})

        estado_factura = "Emitida"
        if pedido["estado"] in ("Entregado", "Enviado") and bool(pagado_general):
            estado_factura = "Pagada"
        elif pedido["estado"] == "Cancelado":
            estado_factura = "Anulada"

        if pedido.get("numero_factura"):
            db.factura_update(pedido["numero_factura"], {"estado": estado_factura})

        return jsonify({"ok": True, "pagado": pagado_general, "estado_factura": estado_factura}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@pedidos_usuarios_bp.route("/eliminar_pedidos", methods=["DELETE"])
@vendedor_required
def eliminar_pedidos():
    data = request.get_json(silent=True) or {}
    ids  = data.get("ids", [])
    if not ids:
        return jsonify({"success": False, "message": "Sin elementos seleccionados"}), 400

    for id_pedido in ids:
        try:
            detalles = db.detalle_get(str(id_pedido))
            for det in detalles:
                prod = db.producto_get(det["id_producto"])
                if prod:
                    stock_actual   = int(prod.get("stock", 0) or 0)
                    cantidad_devol = int(det.get("cantidad", 0) or 0)
                    db.producto_update(str(det["id_producto"]), {"stock": stock_actual + cantidad_devol})
        except Exception:
            pass

    result = db.pedido_delete_many(ids)
    if not result:
        return jsonify({"success": False, "message": "No se pudo eliminar"}), 404
    return jsonify({"success": True}), 200


@pedidos_usuarios_bp.route("/api/mis_pedidos/recientes")
@login_required
def mis_pedidos_recientes():
    cedula = session.get("user_id")
    if not cedula:
        return jsonify([]), 401
    try:
        pedidos   = db.pedido_get_by_cedula(str(cedula), limit=10)
        resultado = []
        for p in pedidos:
            detalles  = p.get("pedido_detalle") or []
            total     = sum(float(d.get("subtotal") or 0) for d in detalles)
            num_items = sum(int(d.get("cantidad")  or 0) for d in detalles)
            estado    = "Pagado ✓" if p.get("pagado") else p.get("estado", "Pendiente")
            resultado.append({
                "id_pedido":      str(p.get("id_pedido", "")),
                "estado":         estado,
                "fecha":          str(p.get("fecha_pedido", ""))[:10],
                "total":          total,
                "num_items":      num_items,
                "numero_factura": p.get("numero_factura", ""),
            })
        return jsonify(resultado), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

