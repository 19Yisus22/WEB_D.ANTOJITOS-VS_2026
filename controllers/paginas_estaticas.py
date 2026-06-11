from flask import Blueprint, session, render_template, redirect

from helpers.auth import sin_cache, admin_required, vendedor_required

paginas_estaticas_bp = Blueprint("paginas_estaticas", __name__)

@paginas_estaticas_bp.route("/politicas_page")
def politicas_page():
    return render_template("global_modules/politicas.html")

@paginas_estaticas_bp.route("/condiciones_page")
def condiciones_page():
    return render_template("global_modules/condiciones.html")

@paginas_estaticas_bp.route("/manual_page")
@sin_cache
@vendedor_required
def manual_page():
    return render_template("admin_modules/manual_usuario.html")
