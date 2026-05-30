import os
import hashlib
from functools import wraps
from flask import session, request, jsonify, redirect, url_for, render_template, make_response

def sin_cache(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        response = make_response(f(*args, **kwargs))
        response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
        response.headers["Pragma"]        = "no-cache"
        response.headers["Expires"]       = "0"
        return response
    return decorated

def _is_ajax_or_api():
    return (
        request.headers.get("X-Requested-With") == "XMLHttpRequest"
        or request.path.startswith("/api/")
        or request.method in ("POST", "PUT", "DELETE", "PATCH")
    )

def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if not session.get("user_id"):
            if _is_ajax_or_api():
                return jsonify({"error": "No autorizado"}), 401
            return render_template("global_modules/blocked.html", metodos=[], login_required=True)
        return f(*args, **kwargs)
    return decorated

def admin_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if not session.get("user_id") or session.get("rol") != "admin":
            if _is_ajax_or_api():
                return jsonify({"error": "No autorizado", "status": "blocked"}), 401
            return render_template("global_modules/blocked.html", metodos=[])
        return f(*args, **kwargs)
    return decorated

def vendedor_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if not session.get("user_id") or session.get("rol") not in ("admin", "vendedor"):
            if _is_ajax_or_api():
                return jsonify({"error": "No autorizado", "status": "blocked"}), 401
            return render_template("global_modules/blocked.html", metodos=[])
        return f(*args, **kwargs)
    return decorated

def hash_password(password: str, salt: str | None = None) -> str:
    if not salt:
        salt = os.urandom(16).hex()
    hashed = hashlib.sha256((salt + password).encode()).hexdigest()
    return f"{salt}${hashed}"

def verify_password(plain: str, hashed: str) -> bool:
    try:
        salt, hash_val = hashed.split("$", 1)
        return hashlib.sha256((salt + plain).encode()).hexdigest() == hash_val
    except Exception:
        return False