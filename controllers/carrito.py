import uuid
from datetime import datetime, timezone

from flask import Blueprint, request, jsonify, session, render_template

import helpers.models as db
from helpers.auth import sin_cache, login_required
from helpers.validators import METODOS_PAGO_VALIDOS

carrito_bp = Blueprint("carrito", __name__)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


@carrito_bp.route("/carrito_page")
@sin_cache
@login_required
def carrito_page():
    user_id    = session.get("user_id")
    userLogged = bool(user_id)
    return render_template("general_modules/carrito.html", userLogged=userLogged)


@carrito_bp.route("/obtener_carrito")
@login_required
def obtener_carrito():
    user_id = session.get("user_id")
    try:
        items = db.carrito_get(user_id)
        if not items:
            return jsonify({"productos": []})

        ids_prods  = [i["id_producto"] for i in items if i.get("id_producto")]
        prods_dict = {str(p["id_producto"]): p for p in db.producto_get_muchos(ids_prods)}

        resultado = []
        for item in items:
            prod = prods_dict.get(str(item["id_producto"]), {})
            try:
                cantidad = int(item.get("cantidad", 1))
                precio   = float(prod.get("precio", 0) or 0)
                stock    = int(prod.get("stock", 0) or 0)
                resultado.append({
                    "id_carrito":      item["id_carrito"],
                    "id_producto":     item["id_producto"],
                    "nombre_producto": str(prod.get("nombre") or item.get("nombre_producto") or "Sin nombre"),
                    "descripcion":     str(prod.get("descripcion") or ""),
                    "cantidad":        cantidad,
                    "precio_unitario": precio,
                    "subtotal":        precio * cantidad,
                    "imagen":          str(prod.get("imagen_url") or "") if (prod.get("imagen_url") or "").startswith("http") else "",
                    "stock":           stock,
                    "agotado":         stock <= 0,
                })
            except (ValueError, TypeError):
                continue

        return jsonify({"productos": resultado})
    except Exception as e:
        return jsonify({"productos": [], "message": str(e)}), 500


@carrito_bp.route("/guardar_catalogo", methods=["POST"])
@carrito_bp.route("/agregar_al_carrito", methods=["POST"])
@login_required
def agregar_al_carrito():
    user_id   = session.get("user_id")
    data      = request.get_json() or {}
    productos = data.get("productos", [])
    if not productos:
        return jsonify({"error": "Sin productos"}), 400

    try:
        for p in productos:
            prod = db.producto_get(p["id_producto"])
            if not prod:
                return jsonify({"error": "Producto no existe"}), 400
            cantidad = int(p["cantidad"])
            stock_actual = int(prod.get("stock", 0) or 0)
            if stock_actual < cantidad:
                return jsonify({"error": f"Stock insuficiente para {prod.get('nombre')}"}), 400

            # Agregar al carrito
            db.carrito_add(
                cedula=user_id,
                id_producto=p["id_producto"],
                nombre=prod["nombre"],
                cantidad=cantidad,
                precio=float(prod["precio"]),
            )
            # Descontar stock inmediatamente (reserva)
            db.producto_update(
                str(p["id_producto"]),
                {"stock": max(0, stock_actual - cantidad)}
            )
        return jsonify({"message": "Carrito actualizado"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@carrito_bp.route("/carrito_quitar/<id_carrito>", methods=["DELETE"])
@login_required
def carrito_quitar(id_carrito):
    user_id = session.get("user_id")
    try:
        # Obtener el ítem antes de eliminarlo para restaurar su stock
        carrito_items = db.carrito_get(user_id)
        item = next(
            (i for i in carrito_items if str(i.get("id_carrito")) == str(id_carrito)),
            None
        )
        if item:
            prod = db.producto_get(item["id_producto"])
            if prod:
                cantidad_devolver = int(item.get("cantidad", 1) or 1)
                stock_actual      = int(prod.get("stock", 0) or 0)
                db.producto_update(
                    str(item["id_producto"]),
                    {"stock": stock_actual + cantidad_devolver}
                )

        db.carrito_delete_item(id_carrito, user_id)
        return jsonify({"ok": True}), 200
    except Exception as e:
        return jsonify({"ok": False, "message": str(e)}), 500


@carrito_bp.route("/finalizar_compra", methods=["POST"])
@login_required
def finalizar_compra():
    user_id = session.get("user_id")
    try:
        usuario = db.usuario_get(user_id)
        if not usuario:
            return jsonify({"message": "Usuario no encontrado", "ok": False}), 404
        if str(user_id).startswith("G-"):
            return jsonify({"message": "Actualiza tu cédula en el perfil antes de realizar pedidos.", "completar_perfil": True, "ok": False}), 400
        if not usuario.get("direccion"):
            return jsonify({"message": "Complete su perfil (dirección requerida)", "completar_perfil": True, "ok": False}), 400

        carrito = db.carrito_get(user_id)
        if not carrito:
            return jsonify({"message": "Carrito vacío", "ok": False}), 400

        # El stock ya fue descontado al agregar al carrito (reserva inmediata).
        # Solo verificamos que los productos aún existan.
        for item in carrito:
            prod = db.producto_get(item["id_producto"])
            if not prod:
                return jsonify({"message": f"Producto no disponible: {item.get('nombre_producto')}", "ok": False}), 400

        metodo = usuario.get("metodo_pago", "Efectivo")
        if metodo not in METODOS_PAGO_VALIDOS:
            metodo = "Efectivo"

        total_compra = sum(int(i["cantidad"]) * float(i["precio_unitario"]) for i in carrito)
        id_pedido    = str(uuid.uuid4())

        db.pedido_create({
            "id_pedido":         id_pedido,
            "cedula":            user_id,
            "direccion_entrega": usuario["direccion"],
            "metodo_pago":       metodo,
            "estado":            "Pendiente",
            "pagado":            False,
        })

        db.detalle_create_many([{
            "id_pedido":       id_pedido,
            "id_producto":     i["id_producto"],
            "nombre_producto": i.get("nombre_producto", "Sin nombre"),
            "cantidad":        int(i["cantidad"]),
            "precio_unitario": float(i["precio_unitario"]),
        } for i in carrito])

        year   = datetime.now().strftime("%Y")
        seq    = db.factura_next_seq(year)
        numero = f"F-{year}-{seq:06d}"

        id_pago = None
        metodos_activos = db.metodo_pago_get_activos()
        if metodos_activos:
            id_pago = metodos_activos[0]["id_pago"]

        db.factura_create({
            "numero_factura": numero,
            "id_pedido":      id_pedido,
            "cedula":         user_id,
            "subtotal":       total_compra,
            "total":          total_compra,
            "metodo_pago":    metodo,
            "estado":         "Emitida",
            **({"id_pago": id_pago} if id_pago else {}),
        })

        db.pedido_update(id_pedido, {"numero_factura": numero})
        db.carrito_clear(user_id)

        return jsonify({"message": "Éxito", "ok": True, "numero_factura": numero})
    except Exception as e:
        return jsonify({"message": str(e), "ok": False}), 500
