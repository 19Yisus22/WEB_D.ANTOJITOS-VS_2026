from flask import Blueprint, request, jsonify, session, render_template
import helpers.models as db
from helpers.auth import sin_cache, login_required, vendedor_required
from helpers.cloudinary import upload_image, upload_base64, delete_image

gestion_productos_bp = Blueprint("gestion_productos", __name__)

@gestion_productos_bp.route("/gestionar_productos_page")
@sin_cache
@vendedor_required
def gestionar_productos_page():
    return render_template("admin_modules/gestion_productos.html")

@gestion_productos_bp.route("/gestionar_productos", methods=["GET", "POST"])
@login_required
def gestionar_productos():
    if request.method == "GET":
        productos = db.producto_get_all()
        for p in productos:
            p["imagen_url"] = p.get("imagen_url") or ""
        return jsonify(productos)

    try:
        nombre      = (request.form.get("nombre") or "").strip()
        descripcion = (request.form.get("descripcion") or "").strip()
        precio      = float(request.form.get("precio", 0))
        stock       = int(request.form.get("stock", 0))
        categoria   = (request.form.get("categoria") or "Postre").strip() or "Postre"
        foto_b64    = request.form.get("foto_base64")

        imagen_url = None
        if foto_b64:
            imagen_url = upload_base64(f"data:image/png;base64,{foto_b64}", folder="productos")

        result = db.producto_create({
            "nombre":      nombre,
            "descripcion": descripcion,
            "precio":      precio,
            "stock":       stock,
            "imagen_url":  imagen_url,
            "categoria":   categoria,
            "estado":      True,
        })
        return jsonify({"ok": True, "producto": result[0] if result else None})
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500

@gestion_productos_bp.route("/actualizar_producto/<id_producto>", methods=["PUT", "OPTIONS"])
@login_required
def actualizar_producto(id_producto):
    if request.method == "OPTIONS":
        return "", 200

    try:
        updates = {}
        for campo in ["nombre", "descripcion", "precio", "stock", "categoria"]:
            if campo in request.form:
                updates[campo] = (
                    float(request.form[campo]) if campo == "precio"
                    else int(request.form[campo]) if campo == "stock"
                    else request.form[campo].strip()
                )
        if "estado" in request.form:
            updates["estado"] = str(request.form["estado"]).lower() in ("true", "1", "on", "sí", "si")

        foto_b64 = request.form.get("foto_base64")
        if foto_b64:
            prod = db.producto_get(id_producto)
            if prod and prod.get("imagen_url"):
                delete_image(prod["imagen_url"])
            url = upload_base64(f"data:image/png;base64,{foto_b64}", folder="productos")
            if url:
                updates["imagen_url"] = url

        result = db.producto_update(id_producto, updates)
        prod   = result[0] if result else {"id_producto": id_producto, **updates}
        return jsonify({"ok": True, "producto": prod})
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500

@gestion_productos_bp.route("/eliminar_producto/<id_producto>", methods=["DELETE", "OPTIONS"])
@login_required
def eliminar_producto(id_producto):
    if request.method == "OPTIONS":
        return "", 200
    try:
        prod = db.producto_get(id_producto)
        if prod and prod.get("imagen_url"):
            delete_image(prod["imagen_url"])
        db.producto_delete(id_producto)
        return jsonify({"ok": True})
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500
