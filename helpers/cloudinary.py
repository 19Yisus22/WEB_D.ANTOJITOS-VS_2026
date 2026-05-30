from __future__ import annotations
import time
import secrets
import cloudinary
import cloudinary.uploader
from cloudinary import api as _api

_LIMIT_BYTES = 25 * 1024 ** 3

_cache: dict = {
    "used_bytes":   0,
    "limit_bytes":  _LIMIT_BYTES,
    "last_updated": 0.0,
}


def get_storage_info() -> dict:
    now = time.monotonic()
    if now - _cache["last_updated"] > 60:
        try:
            usage   = _api.usage()
            storage = usage.get("storage", {})
            _cache["used_bytes"]   = storage.get("usage", 0)
            limit = storage.get("limit", 0)
            _cache["limit_bytes"]  = limit if limit else _LIMIT_BYTES
            _cache["last_updated"] = now
        except Exception:
            pass
    return {
        "used_gb":  round(_cache["used_bytes"] / (1024 ** 3), 4),
        "limit_gb": round(_cache["limit_bytes"] / (1024 ** 3), 2),
    }


def _invalidate_cache():
    _cache["last_updated"] = 0.0


def upload_image(file, folder: str = "mi_app", public_id: str | None = None) -> str | None:
    if not public_id:
        public_id = secrets.token_hex(8)
    try:
        result = cloudinary.uploader.upload(
            file,
            folder=folder,
            public_id=public_id,
            overwrite=True,
            resource_type="image",
            quality="auto",
            fetch_format="auto",
        )
        _invalidate_cache()
        url = result.get("secure_url") or result.get("url")
        return url if url and url.startswith("http") else None
    except Exception as e:
        import logging
        logging.getLogger(__name__).warning("upload_image error: %s", e)
        return None


def upload_base64(data_uri: str, folder: str = "mi_app") -> str | None:
    try:
        result = cloudinary.uploader.upload(
            data_uri,
            folder=folder,
            resource_type="image",
            quality="auto",
            fetch_format="auto",
        )
        _invalidate_cache()
        url = result.get("secure_url") or result.get("url")
        return url if url and url.startswith("http") else None
    except Exception as e:
        import logging
        logging.getLogger(__name__).warning("upload_base64 error: %s", e)
        return None


def delete_image(public_url: str) -> bool:
    if not public_url:
        return False
    parts = public_url.split("/")[-2:]
    public_id = "/".join(parts).split(".")[0]
    try:
        cloudinary.uploader.destroy(public_id, resource_type="image")
        _invalidate_cache()
        return True
    except Exception:
        return False


def allowed_extension(filename: str) -> bool:
    allowed = {"png", "jpg", "jpeg", "gif", "ico", "webp"}
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    return ext in allowed


def list_images_by_folder(folder: str, max_results: int = 50) -> list:
    """Lista imágenes de una carpeta Cloudinary. Devuelve lista de dicts con url, nombre, tamaño."""
    try:
        result = _api.resources(
            type="upload",
            prefix=folder + "/",
            max_results=max_results,
            resource_type="image",
        )
        resources = result.get("resources", [])
        images = []
        for r in resources:
            images.append({
                "url":       r.get("secure_url", ""),
                "public_id": r.get("public_id", ""),
                "name":      r.get("public_id", "").split("/")[-1],
                "size_kb":   round(r.get("bytes", 0) / 1024, 1),
                "width":     r.get("width", 0),
                "height":    r.get("height", 0),
                "created":   r.get("created_at", ""),
                "format":    r.get("format", ""),
            })
        return images
    except Exception:
        return []


def list_all_folders_images() -> dict:
    """Lista imágenes de las carpetas reales en Cloudinary."""
    return {
        "publicidad": list_images_by_folder("publicidad_DAntojitos"),
        "pagos_qr":   list_images_by_folder("pagos_qr"),
        "perfiles":   list_images_by_folder("usuarios/perfiles"),
        "productos":  list_images_by_folder("productos"),
    }
