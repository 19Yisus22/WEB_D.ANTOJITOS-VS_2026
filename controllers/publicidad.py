import json
from flask import Blueprint, request, jsonify, session, render_template

import helpers.models as db
from helpers.auth import sin_cache, admin_required, vendedor_required
from helpers.cloudinary import upload_image, upload_base64, delete_image, list_all_folders_images, delete_image_by_public_id
from helpers.validators import TIPOS_PUBLICIDAD

publicidad_bp = Blueprint("publicidad", __name__)

@publicidad_bp.route("/publicidad_page", methods=["GET", "POST"])
@sin_cache
@admin_required
def publicidad_page():
    if request.method == "POST":
        try:
            tipos_gestion = ["carrusel", "seccion", "cinta", "inicio_cinta"]
            actuales      = db.publicidad_get_by_tipos(tipos_gestion)
            urls_viejas   = [r["imagen_url"] for r in actuales if r.get("imagen_url")]
            ids_viejos    = [r["id_publicidad"] for r in actuales]

            nuevos    = []
            en_uso    = []

            def _procesar(meta_key, files_key, tipo_db):
                metadata = json.loads(request.form.get(meta_key, "[]"))
                archivos = request.files.getlist(files_key)
                f_idx    = 0
                for item in metadata:
                    url = item.get("url_actual", "") or ""
                    if url.startswith("data:"):
                        url = ""
                    if item.get("cambio_img") and f_idx < len(archivos):
                        if url:
                            delete_image(url)
                        url = upload_image(archivos[f_idx], folder="publicidad_DAntojitos") or ""
                        f_idx += 1
                    titulo = (item.get("titulo") or "").strip()
                    if url:
                        en_uso.append(url)
                    if titulo or url:
                        nuevos.append({
                            "tipo":        tipo_db,
                            "titulo":      titulo,
                            "descripcion": (item.get("descripcion") or "").strip(),
                            "imagen_url":  url or None,
                            "estado":      True,
                        })

            _procesar("metadata_carrusel", "imagenes_carrusel", "carrusel")
            _procesar("metadata_secciones", "imagenes_secciones", "seccion")
            _procesar("metadata_cinta", "imagenes_cinta", "cinta")
            _procesar("metadata_inicio_cinta", "imagenes_inicio_cinta", "inicio_cinta")

            for u in urls_viejas:
                if u not in en_uso:
                    delete_image(u)

            if ids_viejos:
                db.publicidad_delete_many(ids_viejos)
            if nuevos:
                db.publicidad_create_many(nuevos)

            return jsonify({"ok": True})
        except Exception as e:
            return jsonify({"error": str(e)}), 500

    return render_template("admin_modules/publicidad.html")

@publicidad_bp.route("/api/admin/publicidad/delete/<id_publicidad>", methods=["DELETE"])
@admin_required
def eliminar_publicidad(id_publicidad):
    try:
        pub = db.publicidad_get(id_publicidad)
        if not pub:
            return jsonify({"error": "No encontrado"}), 404
        if pub.get("imagen_url"):
            delete_image(pub["imagen_url"])
        db.publicidad_delete(id_publicidad)
        return jsonify({"ok": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@publicidad_bp.route("/api/admin/notificaciones", methods=["GET", "POST"])
@admin_required
def admin_notificaciones():
    if request.method == "POST":
        try:
            titulo      = request.form.get("titulo")
            descripcion = request.form.get("descripcion")
            archivo     = request.files.get("archivo")
            url         = upload_image(archivo, folder="publicidad_DAntojitos") if archivo else ""
            db.publicidad_create({
                "tipo":       "notificacion",
                "titulo":     titulo,
                "descripcion": descripcion,
                "imagen_url": url,
                "estado":     True,
            })
            return jsonify({"ok": True})
        except Exception as e:
            return jsonify({"error": str(e)}), 500

    try:
        return jsonify(db.publicidad_get_notificaciones())
    except Exception as e:
        import logging
        logging.getLogger(__name__).error("publicidad_get_notificaciones error: %s", e)
        return jsonify([]), 200

@publicidad_bp.route("/api/admin/notificaciones/estado/<id_publicidad>", methods=["POST"])
@admin_required
def cambiar_estado_notificacion(id_publicidad):
    data   = request.get_json() or {}
    estado = data.get("estado")
    try:
        db.publicidad_update(id_publicidad, {"estado": estado})
        return jsonify({"ok": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@publicidad_bp.route("/api/admin/notificaciones/<id_publicidad>", methods=["PUT", "DELETE"])
@admin_required
def gestionar_notificacion(id_publicidad):
    notif = db.publicidad_get(id_publicidad)
    if not notif:
        return jsonify({"error": "No encontrada"}), 404

    if request.method == "DELETE":
        if notif.get("imagen_url"):
            delete_image(notif["imagen_url"])
        db.publicidad_delete(id_publicidad)
        return jsonify({"ok": True})

    try:
        archivo   = request.files.get("archivo")
        nueva_url = notif.get("imagen_url", "")
        if archivo:
            if nueva_url:
                delete_image(nueva_url)
            nueva_url = upload_image(archivo, folder="publicidad_DAntojitos") or ""

        db.publicidad_update(id_publicidad, {
            "titulo":      request.form.get("titulo", notif.get("titulo")),
            "descripcion": request.form.get("descripcion", notif.get("descripcion")),
            "imagen_url":  nueva_url,
        })
        return jsonify({"ok": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@publicidad_bp.route("/api/publicidad/activa")
def publicidad_activa():
    try:
        return jsonify(db.publicidad_get_activa())
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@publicidad_bp.route("/api/publicidad/gestor")
@admin_required
def gestor_imagenes():
    try:
        todas = db.publicidad_get_all()
        por_tipo: dict = {}
        for item in todas:
            t = item.get("tipo", "otro")
            if t not in por_tipo:
                por_tipo[t] = []
            if item.get("imagen_url"):
                por_tipo[t].append({
                    "id":     item["id_publicidad"],
                    "url":    item["imagen_url"],
                    "titulo": item.get("titulo") or "",
                    "estado": item.get("estado", True),
                })
        return jsonify({"ok": True, "directorios": por_tipo})
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500

@publicidad_bp.route("/api/admin/notificaciones_sistema")
@vendedor_required
def notificaciones_sistema():
    try:
        rol     = session.get("rol", "")
        pedidos = db.pedido_get_all()[:50]

        estados_admin    = {"Pagado ✓", "Cancelado", "Anulada"}
        estados_vendedor = {"Emitida", "Emitido", "Cancelado", "Anulada"}
        estados_filter   = estados_admin if rol == "admin" else estados_vendedor

        resultado = []
        for p in pedidos:
            u          = p.get("usuarios") or {}
            nombre     = f"{u.get('nombre', '')} {u.get('apellido', '')}".strip() or str(p.get("cedula", "?"))
            estado     = p.get("estado", "Pendiente")
            pagado     = p.get("pagado", False)
            estado_str = "Pagado ✓" if pagado else estado
            if estado_str not in estados_filter:
                continue
            detalles  = p.get("pedido_detalle") or []
            total     = sum(float(d.get("subtotal") or 0) for d in detalles)
            num_items = sum(int(d.get("cantidad") or 0) for d in detalles)
            resultado.append({
                "id":          str(p.get("id_pedido", "")),
                "tipo":        "pedido",
                "estado":      estado_str,
                "pagado":      pagado,
                "titulo":      f"Pedido — {nombre}",
                "descripcion": f"{num_items} ítem(s) · ${total:,.0f} COP",
                "telefono":    u.get("telefono", ""),
                "direccion":   u.get("direccion", ""),
                "metodo_pago": u.get("metodo_pago", ""),
                "fecha":       str(p.get("fecha_pedido", ""))[:10],
                "cedula":      str(p.get("cedula", "")),
                "id_pedido":   str(p.get("id_pedido", "")),
            })
        return jsonify(resultado), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@publicidad_bp.route("/api/cloudinary/gestor")
@admin_required
def cloudinary_gestor():
    try:
        return jsonify({"ok": True, "carpetas": list_all_folders_images()})
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500

@publicidad_bp.route("/api/cloudinary/gestor/delete", methods=["DELETE"])
@admin_required
def cloudinary_gestor_delete():
    data      = request.get_json(silent=True) or {}
    public_id = (data.get("public_id") or "").strip()
    if not public_id:
        return jsonify({"ok": False, "error": "public_id requerido"}), 400
    try:
        delete_image_by_public_id(public_id)
        return jsonify({"ok": True})
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500
