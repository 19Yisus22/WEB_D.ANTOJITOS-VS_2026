from flask import Blueprint, request, jsonify, session, render_template

import helpers.models as db
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
        "archivada":      bool(f.get("archivada", False)),
    }


@historial_facturas_bp.route("/gestionar_facturas_page")
@sin_cache
@login_required
def gestionar_facturas_page():
    return render_template("general_modules/facturas.html")


@historial_facturas_bp.route("/obtener_facturas_page")
@login_required
def obtener_facturas_page():
    user_id   = session.get("user_id")
    user_data = session.get("user") or {}
    try:
        facturas = db.factura_get_by_user(user_id)
        resultado = []
        for f in facturas:
            enriquecida = _enriquecer_factura(f)
            enriquecida["cliente_nombre"]   = f"{user_data.get('nombre','')} {user_data.get('apellido','')}".strip()
            enriquecida["username_cliente"] = str(user_data.get("username") or "")
            enriquecida["telefono"]         = str(user_data.get("telefono") or "")
            enriquecida["direccion"]        = str(user_data.get("direccion") or "")
            resultado.append(enriquecida)
        return jsonify(resultado), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@historial_facturas_bp.route("/buscar_facturas_page")
@login_required
def buscar_facturas_page():
    termino   = (request.args.get("q", "") or request.args.get("cedula", "")).strip()
    user_id   = session.get("user_id")
    rol       = session.get("rol", "")
    user_data = session.get("user") or {}

    if not termino:
        return jsonify([]), 200

    # Normaliza: quita @ inicial (búsqueda por @username)
    term_norm = termino.lstrip("@").lower()

    try:
        # ── Clientes: solo pueden ver su propio historial ──────────────────
        if rol not in ("admin", "vendedor"):
            cedula_s   = str(user_id or "").lower()
            nombre_s   = f"{user_data.get('nombre', '')} {user_data.get('apellido', '')}".strip().lower()
            username_s = str(user_data.get("username") or "").lower()

            coincide = (
                term_norm == cedula_s
                or (nombre_s   and term_norm in nombre_s)
                or (username_s and term_norm in username_s)
            )
            if not coincide:
                return jsonify([]), 200

            facturas        = db.factura_get_by_user(str(user_id))
            nombre_completo = f"{user_data.get('nombre', '')} {user_data.get('apellido', '')}".strip()
            resultado = []
            for f in facturas:
                enr = _enriquecer_factura(f)
                enr["cliente_nombre"]   = nombre_completo
                enr["username_cliente"] = str(user_data.get("username") or "")
                enr["telefono"]         = str(user_data.get("telefono") or "")
                enr["direccion"]        = str(user_data.get("direccion") or "")
                resultado.append(enr)
            return jsonify(resultado), 200

        # ── Admin / Vendedor: pueden buscar cualquier usuario ──────────────
        usuario = db.usuario_get(termino)
        if not usuario:
            usuario = db.usuario_get_by_correo(termino)
        if not usuario:
            usuario = db.usuario_get_by_username(term_norm)
        if not usuario:
            usuario = db.usuario_buscar_por_nombre(termino)

        if not usuario:
            return jsonify([]), 200

        facturas        = db.factura_get_by_user(usuario["cedula"])
        nombre_completo = f"{usuario.get('nombre', '')} {usuario.get('apellido', '')}".strip()
        resultado = []
        for f in facturas:
            enr = _enriquecer_factura(f)
            enr["cliente_nombre"]   = nombre_completo
            enr["username_cliente"] = str(usuario.get("username") or "")
            enr["telefono"]         = str(usuario.get("telefono") or "")
            enr["direccion"]        = str(usuario.get("direccion") or "")
            resultado.append(enr)
        return jsonify(resultado), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@historial_facturas_bp.route("/archivar_factura_page/<numero_factura>", methods=["PUT"])
@login_required
def archivar_factura_page(numero_factura):
    user_id = session.get("user_id")
    rol     = session.get("rol")
    try:
        factura = db.factura_get_by_numero(numero_factura)
        if not factura:
            return jsonify({"message": "Factura no encontrada"}), 404
        if str(factura["cedula"]) != str(user_id) and rol not in ("admin", "vendedor"):
            return jsonify({"message": "Sin permiso"}), 403
        nuevo = not bool(factura.get("archivada", False))
        db.factura_update(numero_factura, {"archivada": nuevo})
        return jsonify({"archivada": nuevo}), 200
    except Exception as e:
        return jsonify({"message": str(e)}), 500


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

        # Restaurar stock de los productos del pedido anulado
        try:
            detalles = db.detalle_get(str(factura["id_pedido"]))
            for det in detalles:
                prod = db.producto_get(det["id_producto"])
                if prod:
                    stock_actual   = int(prod.get("stock", 0) or 0)
                    cantidad_devol = int(det.get("cantidad", 0) or 0)
                    db.producto_update(str(det["id_producto"]), {"stock": stock_actual + cantidad_devol})
        except Exception:
            pass  # La anulación ya se registró; no bloquear por error de stock

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
