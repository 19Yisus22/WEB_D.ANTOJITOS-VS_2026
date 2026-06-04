import json
from flask import Blueprint, request, jsonify, session, render_template

import helpers.models as db
from helpers.auth import sin_cache, admin_required
from helpers.cloudinary import upload_image, delete_image
from helpers.validators import ENTIDADES_PAGO, TIPOS_CUENTA

facturacion_bp = Blueprint("facturacion", __name__)


@facturacion_bp.route("/facturacion_page", methods=["GET", "POST"])
@sin_cache
@admin_required
def facturacion_page():
    if request.method == "POST":
        try:
            actuales    = db.metodo_pago_get_all()
            urls_viejas = [r["qr_url"] for r in actuales if r.get("qr_url")]
            ids_viejos  = [r["id_pago"] for r in actuales]

            nuevos = []
            en_uso = []
            metadata = json.loads(request.form.get("metadata_pagos", "[]"))
            archivos = request.files.getlist("imagenes_qr")
            f_idx    = 0

            for item in metadata:
                url_qr = item.get("url_actual", "")
                if item.get("cambio_img") and f_idx < len(archivos):
                    if url_qr:
                        delete_image(url_qr)
                    url_qr = upload_image(archivos[f_idx], folder="pagos_qr") or ""
                    f_idx += 1

                entidad    = item.get("entidad", "")
                tipo_cuenta = item.get("tipo_cuenta", "")

                if entidad not in ENTIDADES_PAGO or tipo_cuenta not in TIPOS_CUENTA:
                    continue

                nuevos.append({
                    "entidad":     entidad,
                    "tipo_cuenta": tipo_cuenta,
                    "numero":      item.get("numero", ""),
                    "titular":     item.get("titular", ""),
                    "qr_url":      url_qr,
                    "estado":      True,
                })
                if url_qr:
                    en_uso.append(url_qr)

            if ids_viejos:
                db.metodo_pago_delete_many(ids_viejos)
            if nuevos:
                db.metodo_pago_create_many(nuevos)

            for u in urls_viejas:
                if u not in en_uso:
                    delete_image(u)

            return jsonify({"ok": True})
        except Exception as e:
            return jsonify({"error": str(e)}), 500

    metodos = db.metodo_pago_get_all()
    return render_template("admin_modules/facturacion.html", metodos=metodos)


@facturacion_bp.route("/actualizar_metodo_pago/<id_pago>", methods=["POST"])
@admin_required
def actualizar_metodo_pago(id_pago):
    try:
        entidad     = request.form.get("entidad", "")
        tipo_cuenta = request.form.get("tipo_cuenta", "")
        numero      = request.form.get("numero", "")
        titular     = request.form.get("titular", "")
        url_actual  = request.form.get("url_actual", "")
        archivo_qr  = request.files.get("imagen_qr")

        nueva_url = url_actual
        if archivo_qr:
            if url_actual:
                delete_image(url_actual)
            nueva_url = upload_image(archivo_qr, folder="pagos_qr") or url_actual

        data = {}
        if entidad in ENTIDADES_PAGO:
            data["entidad"] = entidad
        if tipo_cuenta in TIPOS_CUENTA:
            data["tipo_cuenta"] = tipo_cuenta
        if numero:
            data["numero"] = numero
        if titular:
            data["titular"] = titular
        data["qr_url"] = nueva_url

        result = db.metodo_pago_update(id_pago, data)
        return jsonify({"ok": True, "data": result})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@facturacion_bp.route("/eliminar_metodo_pago/<id_pago>", methods=["DELETE"])
@admin_required
def eliminar_metodo_pago(id_pago):
    try:
        metodo = db.metodo_pago_get(id_pago)
        if metodo and metodo.get("qr_url"):
            delete_image(metodo["qr_url"])
        db.metodo_pago_delete(id_pago)
        return jsonify({"ok": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
