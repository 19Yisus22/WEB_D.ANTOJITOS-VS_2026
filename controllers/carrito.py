import uuid
from datetime import datetime, timezone, date, timedelta

from flask import Blueprint, request, jsonify, session, render_template

import helpers.models as db
from helpers.auth import sin_cache, login_required, admin_required
from helpers.validators import METODOS_PAGO_VALIDOS

# Colombia: UTC-5 (sin horario de verano)
_TZ_COL = timezone(timedelta(hours=-5))


def _hoy_colombia() -> date:
    return datetime.now(_TZ_COL).date()


def _get_descuento_pct() -> float:
    try:
        cfg = db.inicio_config_get()
        val = cfg.get("descuento_cumpleanos")
        if val is not None:
            return max(0.0, min(float(val), 100.0)) / 100.0
    except Exception:
        pass
    return 0.05


def _es_cumpleanos(usuario: dict) -> bool:
    fn = usuario.get("fecha_nacimiento")
    if not fn:
        return False
    try:
        if isinstance(fn, str):
            fn = date.fromisoformat(fn[:10])
        hoy = _hoy_colombia()
        return fn.month == hoy.month and fn.day == hoy.day
    except Exception:
        return False


def _ya_uso_descuento_hoy(user_id: str) -> bool:
    """Verifica si el usuario ya usó el descuento de cumpleaños hoy (hora Colombia)."""
    try:
        hoy = _hoy_colombia().isoformat()
        facturas = db.factura_get_by_user(user_id)
        return any(
            (f.get("fecha_emision") or "")[:10] == hoy
            and float(f.get("subtotal") or 0) > float(f.get("total") or 0) + 0.01
            for f in facturas
        )
    except Exception:
        return False

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


@carrito_bp.route("/carrito_cantidad/<id_carrito>", methods=["PATCH"])
@login_required
def carrito_ajustar_cantidad(id_carrito):
    """Incrementa o decrementa la cantidad de un ítem del carrito en ±1.
    Ajusta el stock del producto en tiempo real."""
    user_id = session.get("user_id")
    data    = request.get_json() or {}
    delta   = int(data.get("delta", 0))
    if delta not in (1, -1):
        return jsonify({"ok": False, "error": "delta debe ser 1 o -1"}), 400

    try:
        carrito_items = db.carrito_get(user_id)
        item = next(
            (i for i in carrito_items if str(i.get("id_carrito")) == str(id_carrito)),
            None
        )
        if not item:
            return jsonify({"ok": False, "error": "Ítem no encontrado"}), 404

        cantidad_actual = int(item.get("cantidad", 1) or 1)
        id_producto     = item["id_producto"]
        prod            = db.producto_get(id_producto)
        if not prod:
            return jsonify({"ok": False, "error": "Producto no encontrado"}), 404

        stock_actual = int(prod.get("stock", 0) or 0)

        if delta == 1:
            if stock_actual < 1:
                return jsonify({"ok": False, "error": "Sin stock disponible", "stock": 0}), 400
            nueva_cantidad = cantidad_actual + 1
            nuevo_stock    = stock_actual - 1
        else:
            if cantidad_actual <= 1:
                # Si llega a 0, eliminar el ítem y devolver el stock
                db.producto_update(str(id_producto), {"stock": stock_actual + 1})
                db.carrito_delete_item(id_carrito, user_id)
                return jsonify({"ok": True, "eliminado": True, "stock": stock_actual + 1}), 200
            nueva_cantidad = cantidad_actual - 1
            nuevo_stock    = stock_actual + 1

        db.producto_update(str(id_producto), {"stock": nuevo_stock})
        db.carrito_update_cantidad(str(id_carrito), user_id, nueva_cantidad)

        nuevo_subtotal = round(float(item.get("precio_unitario", 0) or 0) * nueva_cantidad, 2)
        return jsonify({
            "ok":        True,
            "eliminado": False,
            "cantidad":  nueva_cantidad,
            "subtotal":  nuevo_subtotal,
            "stock":     nuevo_stock,
        }), 200
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500


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

        subtotal = sum(int(i["cantidad"]) * float(i["precio_unitario"]) for i in carrito)

        es_cumple = _es_cumpleanos(usuario) and not _ya_uso_descuento_hoy(user_id)
        descuento_monto = round(subtotal * _get_descuento_pct()) if es_cumple else 0
        total_compra = subtotal - descuento_monto

        id_pedido = str(uuid.uuid4())

        db.pedido_create({
            "id_pedido":         id_pedido,
            "cedula":            user_id,
            "direccion_entrega": usuario["direccion"],
            "metodo_pago":       metodo,
            "estado":            "Pendiente",
            "pagado":            False,
            "total":             total_compra,
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
            "subtotal":       subtotal,
            "total":          total_compra,
            "metodo_pago":    metodo,
            "estado":         "Emitida",
            **({"id_pago": id_pago} if id_pago else {}),
        })

        db.pedido_update(id_pedido, {"numero_factura": numero, "total": total_compra})
        db.carrito_clear(user_id)

        # Verificar logros de compra
        try:
            from helpers.logros_utils import verificar_y_otorgar
            repite = db.usuario_pedido_repetido(user_id)
            nuevos_logros = verificar_y_otorgar(user_id, {
                "tipo": "compra",
                "repite_producto": repite,
            })
        except Exception:
            nuevos_logros = []

        return jsonify({
            "message":              "Éxito",
            "ok":                   True,
            "numero_factura":       numero,
            "descuento_cumpleanos": es_cumple,
            "descuento_monto":      descuento_monto,
            "total_final":          total_compra,
            "logros_nuevos":        nuevos_logros,
        })
    except Exception as e:
        return jsonify({"message": str(e), "ok": False}), 500


@carrito_bp.route("/carrito/cumpleanos")
@login_required
def cumpleanos_info():
    user_id = session.get("user_id")
    try:
        usuario = db.usuario_get(user_id) or {}
        es_cumple = _es_cumpleanos(usuario) and not _ya_uso_descuento_hoy(user_id)
        pct_real  = round(_get_descuento_pct() * 100)
        return jsonify({
            "es_cumpleanos": es_cumple,
            "descuento_pct": pct_real if es_cumple else 0,
        })
    except Exception:
        return jsonify({"es_cumpleanos": False, "descuento_pct": 0})


@carrito_bp.route("/api/config/descuento_cumpleanos", methods=["GET"])
@login_required
def get_descuento_config():
    try:
        cfg = db.inicio_config_get()
        val = float(cfg.get("descuento_cumpleanos", "5"))
        return jsonify({"pct": val})
    except Exception:
        return jsonify({"pct": 5.0})


@carrito_bp.route("/api/config/descuento_cumpleanos", methods=["PUT"])
@admin_required
def set_descuento_config():
    data = request.get_json() or {}
    try:
        pct = float(data.get("pct", 5))
        pct = max(0.0, min(pct, 100.0))
    except (TypeError, ValueError):
        return jsonify({"error": "Porcentaje inválido"}), 400
    db.inicio_config_save({"descuento_cumpleanos": str(pct)})
    return jsonify({"ok": True, "pct": pct})
