
from __future__ import annotations
import logging
import os
import time
from dotenv import load_dotenv
from supabase import create_client, ClientOptions
from postgrest.types import CountMethod

_logger = logging.getLogger(__name__)
logger  = logging.getLogger(__name__)

_BASE_DIR     = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
load_dotenv(os.path.join(_BASE_DIR, ".env"), override=True)

_SUPABASE_URL = os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL")
_SUPABASE_KEY = os.getenv("SUPABASE_ANON_KEY")

supabase          = None
SUPABASE_REST_URL = ""

if _SUPABASE_URL and _SUPABASE_KEY:
    SUPABASE_REST_URL = (
        os.getenv("SUPABASE_REST_URL") or f"{_SUPABASE_URL.rstrip('/')}/rest/v1/"
    )
    _opts    = ClientOptions(postgrest_client_timeout=30, storage_client_timeout=60, schema="public")
    supabase = create_client(_SUPABASE_URL, _SUPABASE_KEY, options=_opts)
    try:
        import httpx
        _limits      = httpx.Limits(max_keepalive_connections=5, keepalive_expiry=10)
        _old_session = supabase.postgrest.session
        _new_session = httpx.Client(
            base_url=_old_session.base_url,
            headers=dict(_old_session.headers),
            http2=False,
            limits=_limits,
            timeout=30,
        )
        setattr(supabase.postgrest, "session", _new_session)
        del _old_session, _limits, _new_session
    except Exception as _e:
        _logger.warning("httpx reconfigure skipped: %s", _e)

_DATABASE_URL = os.getenv("DATABASE_URL")
_pool         = None


def _get_pool():
    global _pool
    if _pool is not None:
        return _pool
    if not _DATABASE_URL:
        return None
    try:
        from psycopg2 import pool as pg_pool
        _pool = pg_pool.ThreadedConnectionPool(minconn=1, maxconn=10, dsn=_DATABASE_URL)
        _logger.info("Transaction Pooler conectado: %s", _DATABASE_URL.split("@")[-1])
    except Exception as exc:
        _logger.warning("Transaction Pooler no disponible: %s", exc)
    return _pool


def execute_sql(query: str, params=None) -> list[dict]:
    from psycopg2.extras import RealDictCursor
    pool = _get_pool()
    if not pool:
        raise RuntimeError(
            "DATABASE_URL no configurado. Agrega la variable de entorno con la URL "
            "del Transaction Pooler de Supabase (puerto 6543)."
        )
    conn = pool.getconn()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(query, params)
            conn.commit()
            try:
                return [dict(row) for row in cur.fetchall()]
            except Exception:
                return []
    except Exception:
        conn.rollback()
        raise
    finally:
        pool.putconn(conn)


_RETRY_EXCEPTIONS   = ("RemoteProtocolError", "ReadError", "WriteError", "TimeoutException")
_NORETRY_EXCEPTIONS = ("ConnectError", "getaddrinfo", "WinError", "Network")


def _db():
    if supabase is None:
        raise RuntimeError(
            "Base de datos no configurada. "
            "Agrega SUPABASE_URL y SUPABASE_ANON_KEY en las variables de entorno."
        )
    return supabase


def _run(query) -> object:
    last_exc: Exception | None = None
    for attempt in range(4):
        try:
            return query.execute()
        except Exception as e:
            name = type(e).__name__
            msg  = str(e)
            if any(k in name or k in msg for k in _NORETRY_EXCEPTIONS):
                raise
            if any(k in name or k in msg for k in _RETRY_EXCEPTIONS):
                last_exc = e
                if attempt < 3:
                    time.sleep(1.0 * (attempt + 1))
                    logger.warning("DB retry %d after %s: %s", attempt + 1, name, msg)
                continue
            raise
    raise last_exc or RuntimeError("DB query failed after 4 retries")


def _run_safe(query) -> object | None:
    try:
        return _run(query)
    except Exception as e:
        logger.error("DB read error: %s", e)
        return None


def _single(result) -> dict | None:
    if result is None:
        return None
    data = result.data
    if not data:
        return None
    return data[0] if isinstance(data, list) else data


def _many(result) -> list:
    if result is None:
        return []
    return result.data if result.data else []


def _count(result) -> int:
    return int(getattr(result, "count", None) or 0)


def rol_get_all() -> list:
    return _many(_run(_db().table("roles").select("*")))


def rol_get_by_nombre(nombre: str) -> dict | None:
    return _single(_run(
        _db().table("roles").select("id_role,nombre_role,descripcion")
        .eq("nombre_role", nombre).limit(1)
    ))


def rol_get_id(nombre: str) -> str | None:
    r = rol_get_by_nombre(nombre)
    return r["id_role"] if r else None


_USR_SELECT = (
    'cedula,username,imagen_url,nombre,apellido,telefono,correo,id_role,'
    'direccion,metodo_pago,fecha_creacion,ultima_conexion,contrasena,roles(nombre_role),'
    'last_change_cedula,last_change_username,last_change_nombre,last_change_apellido,'
    'last_change_contrasena,fecha_nacimiento,intentos_fallidos,bloqueado_hasta,google_account'
)


def usuario_get(cedula: str) -> dict | None:
    return _single(_run(_db().table("usuarios").select(_USR_SELECT).eq("cedula", cedula).limit(1)))


def usuario_get_by_correo(correo: str) -> dict | None:
    return _single(_run(
        _db().table("usuarios").select(_USR_SELECT)
        .ilike("correo", correo.strip()).limit(1)
    ))


def usuario_get_by_username(username: str) -> dict | None:
    return _single(_run(
        _db().table("usuarios").select(_USR_SELECT)
        .ilike("username", username).limit(1)
    ))


def usuario_get_by_google_account(google_account: str) -> dict | None:
    return _single(_run(
        _db().table("usuarios").select(_USR_SELECT)
        .ilike("google_account", google_account.strip()).limit(1)
    ))


def usuario_get_by_identifier(identifier: str) -> dict | None:
    if not identifier:
        return None
    raw = identifier.strip()

    if '@' in raw:
        u = usuario_get_by_correo(raw.lower())
        if u:
            return u
        u = usuario_get_by_google_account(raw.lower())
        if u:
            return u
        return usuario_get_by_username(raw)

    if raw.isdigit():
        u = usuario_get(raw)
        if u:
            return u
        return usuario_get_by_username(raw)

    u = usuario_get_by_username(raw)
    if u:
        return u
    return usuario_get_by_correo(raw.lower())


def usuario_buscar_por_nombre(nombre: str) -> dict | None:
    partes = nombre.strip().split()
    if len(partes) >= 2:
        primer = partes[0]
        resto  = " ".join(partes[1:])
        u = _single(_run(
            _db().table("usuarios").select("cedula,nombre,apellido,username")
            .ilike("nombre", f"%{primer}%").ilike("apellido", f"%{resto}%").limit(1)
        ))
        if u:
            return u
    u = _single(_run(
        _db().table("usuarios").select("cedula,nombre,apellido,username")
        .ilike("nombre", f"%{nombre}%").limit(1)
    ))
    if u:
        return u
    return _single(_run(
        _db().table("usuarios").select("cedula,nombre,apellido,username")
        .ilike("apellido", f"%{nombre}%").limit(1)
    ))


def usuario_get_all() -> list:
    return _many(_run(
        _db().table("usuarios").select(
            'cedula,username,imagen_url,nombre,apellido,telefono,correo,id_role,'
            'direccion,metodo_pago,fecha_nacimiento,fecha_creacion,ultima_conexion,'
            'contrasena,google_account,roles(nombre_role)'
        )
    ))


def usuario_get_web_token(cedula: str) -> dict | None:
    return _single(_run(
        _db().table("usuarios")
        .select("web_token,expires_at")
        .eq("cedula", cedula)
        .limit(1)
    ))


def usuario_set_web_token(cedula: str, token_hash: str, expires_at: str) -> None:
    _run(_db().table("usuarios").update({
        "web_token":  token_hash,
        "expires_at": expires_at,
    }).eq("cedula", cedula))


def usuario_clear_web_token(cedula: str) -> None:
    _run(_db().table("usuarios").update({
        "web_token":  None,
        "expires_at": None,
    }).eq("cedula", cedula))


def usuario_get_block_folder(cedula: str) -> list:
    row = _single(_run(
        _db().table("usuarios").select("block_folder").eq("cedula", cedula).limit(1)
    ))
    if not row:
        return []
    bf = row.get("block_folder")
    if not bf:
        return []
    if isinstance(bf, list):
        return bf
    import json
    try:
        return json.loads(bf)
    except Exception:
        return []


def usuario_set_block_folder(cedula: str, archivos: list) -> None:
    _run(_db().table("usuarios").update({"block_folder": archivos}).eq("cedula", cedula))


def usuario_create(data: dict) -> list:
    return _many(_run(_db().table("usuarios").insert(data)))


def usuario_update(cedula: str, data: dict) -> list:
    return _many(_run(_db().table("usuarios").update(data).eq("cedula", cedula)))


def cedula_cascade_update(old_cedula: str, new_cedula: str) -> None:
    for table, col in [
        ("pedidos",           "cedula"),
        ("facturas",          "cedula"),
        ("comentarios",       "cedula"),
        ("mensajes_privados", "cedula_de"),
    ]:
        try:
            _run(_db().table(table).update({col: new_cedula}).eq(col, old_cedula))
        except Exception:
            pass

    for col in ("cedula_de", "cedula_para"):
        try:
            _run(_db().table("chats_privados").update({col: new_cedula}).eq(col, old_cedula))
        except Exception:
            pass

    try:
        _run(_db().table("carrito").delete().eq("cedula", old_cedula))
    except Exception:
        pass


def usuario_delete(cedula: str) -> list:
    return _many(_run(_db().table("usuarios").delete().eq("cedula", cedula)))


def usuario_set_role(cedula: str, id_role: str) -> list:
    return _many(_run(
        _db().table("usuarios").update({"id_role": id_role}).eq("cedula", cedula)
    ))


def usuario_count_por_rol(nombre_rol: str, excluir_cedula: str | None = None) -> int:
    id_role = rol_get_id(nombre_rol)
    if not id_role:
        return 0
    q = _db().table("usuarios").select("cedula", count=CountMethod.exact).eq("id_role", id_role)
    if excluir_cedula:
        q = q.neq("cedula", str(excluir_cedula))
    res = _run(q)
    cnt = getattr(res, "count", None)
    return int(cnt) if cnt is not None else 0


def usuario_get_pass_cooldown(cedula: str) -> str | None:
    try:
        row = _single(_run(
            _db().table("usuarios")
            .select("last_change_contrasena")
            .eq("cedula", cedula)
            .limit(1)
        ))
        return (row or {}).get("last_change_contrasena")
    except Exception:
        return None


def usuario_touch(cedula: str, ts: str) -> None:
    _run_safe(_db().table("usuarios").update({"ultima_conexion": ts}).eq("cedula", cedula))


_LOCKOUT_THRESHOLDS = [
    (5,    15),
    (10,   40),
    (15,   300),
    (20,   1440),
]


def usuario_incrementar_intento(cedula: str) -> dict:
    from datetime import datetime, timezone, timedelta

    row = _single(_run_safe(
        _db().table("usuarios")
        .select("intentos_fallidos")
        .eq("cedula", cedula)
        .limit(1)
    ))
    current   = int((row or {}).get("intentos_fallidos") or 0)
    new_total = current + 1

    bloqueado_hasta = None
    minutos_bloqueo = None
    for threshold, minutes in _LOCKOUT_THRESHOLDS:
        if new_total == threshold:
            minutos_bloqueo  = minutes
            bloqueado_hasta  = (
                datetime.now(timezone.utc) + timedelta(minutes=minutes)
            ).isoformat()
            break

    update_payload: dict = {"intentos_fallidos": new_total}
    if bloqueado_hasta:
        update_payload["bloqueado_hasta"] = bloqueado_hasta

    _run_safe(_db().table("usuarios").update(update_payload).eq("cedula", cedula))

    return {
        "intentos":       new_total,
        "bloqueado_hasta": bloqueado_hasta,
        "minutos_bloqueo": minutos_bloqueo,
    }


def usuario_reset_intentos(cedula: str) -> None:
    _run_safe(_db().table("usuarios").update({
        "intentos_fallidos": 0,
        "bloqueado_hasta":   None,
    }).eq("cedula", cedula))


def producto_get_all() -> list:
    return _many(_run(
        _db().table("gestion_productos").select("*")
        .order("fecha_creacion", desc=True)
    ))


def producto_get_activos() -> list:
    return _many(_run(
        _db().table("gestion_productos").select("*").eq("estado", True)
    ))


def producto_get(id_producto: str) -> dict | None:
    return _single(_run(
        _db().table("gestion_productos").select("*")
        .eq("id_producto", id_producto).limit(1)
    ))


def producto_get_muchos(ids: list[str]) -> list:
    if not ids:
        return []
    return _many(_run(
        _db().table("gestion_productos").select("*").in_("id_producto", ids)
    ))


def producto_create(data: dict) -> list:
    return _many(_run(_db().table("gestion_productos").insert(data)))


def producto_update(id_producto: str, data: dict) -> list:
    return _many(_run(
        _db().table("gestion_productos").update(data).eq("id_producto", id_producto)
    ))


def producto_delete(id_producto: str) -> list:
    return _many(_run(
        _db().table("gestion_productos").delete().eq("id_producto", id_producto)
    ))


def producto_delete_many(ids: list) -> None:
    if ids:
        _run(_db().table("gestion_productos").delete().in_("id_producto", ids))


def carrito_get(cedula: str) -> list:
    return _many(_run(_db().table("carrito").select("*").eq("cedula", cedula)))


def carrito_get_item(cedula: str, id_producto: str) -> dict | None:
    return _single(_run(
        _db().table("carrito").select("*")
        .eq("cedula", cedula).eq("id_producto", id_producto).limit(1)
    ))


def carrito_add(cedula: str, id_producto: str, nombre: str, cantidad: int, precio: float) -> None:
    existing = carrito_get_item(cedula, id_producto)
    if existing:
        nueva_qty = int(existing["cantidad"]) + cantidad
        _run(_db().table("carrito").update({"cantidad": nueva_qty})
             .eq("id_carrito", existing["id_carrito"]))
    else:
        _run(_db().table("carrito").insert({
            "cedula":          cedula,
            "id_producto":     id_producto,
            "nombre_producto": nombre,
            "cantidad":        cantidad,
            "precio_unitario": precio,
        }))


def carrito_update_cantidad(id_carrito: str, cedula: str, cantidad: int) -> None:
    _run(_db().table("carrito").update({"cantidad": cantidad})
         .eq("id_carrito", id_carrito).eq("cedula", cedula))


def carrito_delete_item(id_carrito: str, cedula: str) -> list:
    return _many(_run(
        _db().table("carrito").delete()
        .eq("id_carrito", id_carrito).eq("cedula", cedula)
    ))


def carrito_clear(cedula: str) -> None:
    _run(_db().table("carrito").delete().eq("cedula", cedula))


_PEDIDO_JOIN = (
    "*, "
    "usuarios(cedula,nombre,apellido,telefono,correo,direccion,metodo_pago,"
    "imagen_url,fecha_nacimiento,username,id_role,roles(nombre_role)),"
    "pedido_detalle(*, gestion_productos(nombre,precio,imagen_url))"
)


def pedido_get_all() -> list:
    return _many(_run(
        _db().table("pedidos").select(_PEDIDO_JOIN)
        .order("fecha_pedido", desc=True)
    ))


def pedido_get(id_pedido: str) -> dict | None:
    return _single(_run(
        _db().table("pedidos").select("*")
        .eq("id_pedido", id_pedido).limit(1)
    ))


def pedido_get_by_cedula(cedula: str, limit: int = 10) -> list:
    return _many(_run(
        _db().table("pedidos")
        .select("id_pedido,estado,pagado,fecha_pedido,numero_factura,pedido_detalle(subtotal,cantidad)")
        .eq("cedula", str(cedula))
        .order("fecha_pedido", desc=True)
        .limit(limit)
    ))


def pedido_create(data: dict) -> list:
    return _many(_run(_db().table("pedidos").insert(data)))


def pedido_update(id_pedido: str, data: dict) -> list:
    return _many(_run(
        _db().table("pedidos").update(data).eq("id_pedido", id_pedido)
    ))


def pedido_delete_many(ids: list[str]) -> list:
    if not ids:
        return []
    return _many(_run(_db().table("pedidos").delete().in_("id_pedido", ids)))


def detalle_get(id_pedido: str) -> list:
    return _many(_run(
        _db().table("pedido_detalle")
        .select("*, gestion_productos(nombre,imagen_url)")
        .eq("id_pedido", id_pedido)
    ))


def detalle_create_many(items: list[dict]) -> None:
    if items:
        _run(_db().table("pedido_detalle").insert(items))


def factura_get_by_user(cedula: str) -> list:
    try:
        return _many(_run(
            _db().table("facturas").select("*, pedidos(estado,pagado)")
            .eq("cedula", cedula).order("fecha_emision", desc=True)
        ))
    except Exception:
        return _many(_run(
            _db().table("facturas").select("*")
            .eq("cedula", cedula).order("fecha_emision", desc=True)
        ))


def factura_get_by_numero(numero: str) -> dict | None:
    return _single(_run(
        _db().table("facturas").select("*")
        .eq("numero_factura", numero).limit(1)
    ))


def factura_get_all() -> list:
    return _many(_run(
        _db().table("facturas")
        .select("*, usuarios(cedula,nombre,apellido)")
        .order("fecha_emision", desc=True)
    ))


def factura_get_all_enriched(limit: int | None = None) -> list:
    def _build(with_pedido: bool):
        sel = (
            "*, usuarios(cedula,nombre,apellido,username,telefono,direccion,"
            "metodo_pago,roles(nombre_role))"
            + (", pedidos(estado,pagado)" if with_pedido else "")
        )
        q = _db().table("facturas").select(sel).order("fecha_emision", desc=True)
        if limit is not None:
            q = q.limit(limit)
        return q
    try:
        return _many(_run(_build(True)))
    except Exception:
        return _many(_run(_build(False)))


def factura_next_seq(year: str) -> int:
    prefix = f"F-{year}-"
    last = _many(_run(
        _db().table("facturas").select("numero_factura")
        .like("numero_factura", f"{prefix}%")
        .order("numero_factura", desc=True).limit(1)
    ))
    if last:
        try:
            return int(last[0]["numero_factura"].replace(prefix, "")) + 1
        except Exception:
            pass
    return 1


def factura_create(data: dict) -> None:
    _run(_db().table("facturas").insert(data))


def factura_update(numero: str, data: dict) -> None:
    _run(_db().table("facturas").update(data).eq("numero_factura", numero))


def metodo_pago_get_all() -> list:
    return _many(_run(_db().table("metodos_pago").select("*")))


def metodo_pago_get_activos() -> list:
    return _many(_run(_db().table("metodos_pago").select("*").eq("estado", True)))


def metodo_pago_get(id_pago: str) -> dict | None:
    return _single(_run(
        _db().table("metodos_pago").select("*")
        .eq("id_pago", id_pago).limit(1)
    ))


def metodo_pago_create(data: dict) -> list:
    return _many(_run(_db().table("metodos_pago").insert(data)))


def metodo_pago_update(id_pago: str, data: dict) -> list:
    return _many(_run(
        _db().table("metodos_pago").update(data).eq("id_pago", id_pago)
    ))


def metodo_pago_delete(id_pago: str) -> list:
    return _many(_run(_db().table("metodos_pago").delete().eq("id_pago", id_pago)))


def metodo_pago_delete_many(ids: list[str]) -> list:
    if not ids:
        return []
    return _many(_run(_db().table("metodos_pago").delete().in_("id_pago", ids)))


def metodo_pago_create_many(items: list[dict]) -> list:
    if not items:
        return []
    return _many(_run(_db().table("metodos_pago").insert(items)))


def publicidad_get_activa() -> list:
    return _many(_run(_db().table("publicidad").select("*").eq("estado", True)))


def publicidad_get_all() -> list:
    return _many(_run(
        _db().table("publicidad").select("*").order("fecha_creacion", desc=True)
    ))


def publicidad_get_by_tipo(tipo: str) -> list:
    return _many(_run(
        _db().table("publicidad").select("*")
        .eq("tipo", tipo).order("fecha_creacion", desc=True)
    ))


def publicidad_get_by_tipos(tipos: list[str]) -> list:
    if not tipos:
        return []
    return _many(_run(
        _db().table("publicidad")
        .select("id_publicidad,imagen_url,tipo,titulo,descripcion")
        .in_("tipo", tipos).eq("estado", True)
    ))


def publicidad_get(id_publicidad: str) -> dict | None:
    return _single(_run(
        _db().table("publicidad").select("*")
        .eq("id_publicidad", id_publicidad).limit(1)
    ))


def publicidad_get_notificaciones() -> list:
    return _many(_run(
        _db().table("publicidad").select("*")
        .eq("tipo", "notificacion").order("id_publicidad", desc=True)
    ))


def publicidad_create(data: dict) -> list:
    return _many(_run(_db().table("publicidad").insert(data)))


def publicidad_create_many(items: list[dict]) -> list:
    if not items:
        return []
    return _many(_run(_db().table("publicidad").insert(items)))


def publicidad_update(id_publicidad: str, data: dict) -> None:
    _run(_db().table("publicidad").update(data).eq("id_publicidad", id_publicidad))


def publicidad_delete(id_publicidad: str) -> None:
    _run(_db().table("publicidad").delete().eq("id_publicidad", id_publicidad))


def publicidad_delete_many(ids: list[str]) -> None:
    if ids:
        _run(_db().table("publicidad").delete().in_("id_publicidad", ids))


def comentario_get_all() -> list:
    return _many(_run(
        _db().table("comentarios").select("*").order("created_at", desc=False)
    ))


def comentario_get(id: str) -> dict | None:
    return _single(_run(
        _db().table("comentarios").select("*").eq("id", id).limit(1)
    ))


def comentario_create(data: dict) -> list:
    return _many(_run(_db().table("comentarios").insert(data)))


def comentario_update(id: str, data: dict) -> list:
    return _many(_run(_db().table("comentarios").update(data).eq("id", id)))


def comentario_delete(id: str) -> None:
    _run(_db().table("comentarios").delete().eq("id", id))


def comentario_delete_many(ids: list) -> None:
    if ids:
        _run(_db().table("comentarios").delete().in_("id", ids))


def comentario_delete_non_admin_before(cutoff_iso: str, admin_cedulas: list = None) -> None:
    try:
        q = _db().table("comentarios").delete().lt("created_at", cutoff_iso)
        if admin_cedulas:
            q = q.not_.in_("cedula", admin_cedulas)
        _run(q)
        logger.info("comentario_delete_non_admin_before OK (cutoff=%s)", cutoff_iso)
    except Exception as e:
        logger.warning("comentario_delete_non_admin_before ERROR: %s", e)


def comentario_update_likes(id: str, likes: list) -> None:
    _run(_db().table("comentarios").update({"likes_usuarios": likes}).eq("id", id))


def comentario_delete_all() -> None:
    _run_safe(
        _db().table("comentarios").delete()
        .neq("id", "00000000-0000-0000-0000-000000000000")
    )


def inicio_config_get() -> dict:
    try:
        result = _db().table("inicio_config").select("clave,valor").execute()
        rows   = result.data or []
        return {r["clave"]: r["valor"] for r in rows if "clave" in r}
    except Exception as e:
        logger.warning("inicio_config_get error: %s", e)
        return {}


def inicio_config_save(data: dict) -> None:
    rows = [{"clave": k, "valor": str(v)} for k, v in data.items()]
    if not rows:
        return
    try:
        _db().table("inicio_config").upsert(rows, on_conflict="clave").execute()
    except Exception as e:
        logger.warning("inicio_config_save error: %s", e)


_MP_SELECT = "id,cedula_de,cedula_para,cedula_dest,mensaje,tipo,leido,adjuntos,created_at,updated_at,es_editado"


def mp_get_by_id(id: str) -> dict | None:
    return _single(_run(
        _db().table("mensajes_privados").select(_MP_SELECT).eq("id", id).limit(1)
    ))


def mp_update(id: str, mensaje: str) -> None:
    _run_safe(_db().table("mensajes_privados").update({
        "mensaje":    mensaje,
        "es_editado": True,
    }).eq("id", id))


def mp_delete(id: str) -> None:
    _run_safe(_db().table("mensajes_privados").delete().eq("id", id))


def mp_delete_hilo(cedula_hilo: str, tipo: str) -> None:
    _run_safe(
        _db().table("mensajes_privados")
        .delete()
        .eq("cedula_de", cedula_hilo)
        .eq("tipo", tipo)
    )


def mp_get_conversacion(cedula_cliente: str) -> list:
    return _many(_run(
        _db().table("mensajes_privados")
        .select(_MP_SELECT)
        .eq("cedula_de", cedula_cliente)
        .eq("tipo", "cv")
        .order("created_at", desc=False)
    ))


def mp_get_todos_hilos() -> list:
    return _many(_run(
        _db().table("mensajes_privados")
        .select(_MP_SELECT)
        .eq("tipo", "cv")
        .order("created_at", desc=True)
    ))


def mp_create(cedula_cliente: str, cedula_remitente: str, es_vendedor: bool,
              mensaje: str, es_predeterminado: bool = False,
              adjuntos: list = None) -> dict | None:
    payload = {
        "cedula_de":   cedula_cliente,
        "cedula_para": cedula_remitente,
        "mensaje":     mensaje,
        "tipo":        "cv",
    }
    if adjuntos:
        payload["adjuntos"] = adjuntos
    return _single(_run(
        _db().table("mensajes_privados").insert(payload)
    ))


def mp_marcar_leidos(cedula_de: str, es_vendedor_leyendo: bool) -> None:
    if es_vendedor_leyendo:
        _run_safe(
            _db().table("mensajes_privados")
            .update({"leido": True})
            .eq("cedula_de", cedula_de)
            .eq("cedula_para", cedula_de)
            .eq("tipo", "cv")
            .eq("leido", False)
        )
    else:
        msgs = _many(_run(
            _db().table("mensajes_privados")
            .select("id,cedula_para")
            .eq("cedula_de", cedula_de)
            .eq("tipo", "cv")
            .eq("leido", False)
        ))
        ids = [m["id"] for m in msgs if m.get("cedula_para") != cedula_de]
        if ids:
            _run_safe(
                _db().table("mensajes_privados")
                .update({"leido": True})
                .in_("id", ids)
            )


def mp_no_leidos(cedula_de: str) -> int:
    msgs = _many(_run(
        _db().table("mensajes_privados")
        .select("id,cedula_para")
        .eq("cedula_de", cedula_de)
        .eq("tipo", "cv")
        .eq("leido", False)
    ))
    return sum(1 for m in msgs if m.get("cedula_para") != cedula_de)


def mp_total_no_leidos_vendedor(excluir: str = "") -> int:
    msgs = _many(_run(
        _db().table("mensajes_privados")
        .select("id,cedula_de,cedula_para")
        .eq("tipo", "cv")
        .eq("leido", False)
    ))
    return sum(
        1 for m in msgs
        if m.get("cedula_para") == m.get("cedula_de")
        and (not excluir or m.get("cedula_de") != excluir)
    )


def mp_delete_non_admin_before(cutoff_iso: str, admin_cedulas: list = None) -> None:
    try:
        q = _db().table("mensajes_privados").delete().lt("created_at", cutoff_iso)
        if admin_cedulas:
            q = q.not_.in_("cedula_de", admin_cedulas)
        _run(q)
        logger.info("mp_delete_non_admin_before OK (cutoff=%s)", cutoff_iso)
    except Exception as e:
        logger.warning("mp_delete_non_admin_before ERROR: %s", e)


def _staff_thread_key(cedula_a: str, cedula_b: str) -> tuple[str, str]:
    a, b = str(cedula_a), str(cedula_b)
    return (a, b) if a <= b else (b, a)


def mp_staff_get_conversacion(cedula_a: str, cedula_b: str) -> list:
    r1 = _many(_run(
        _db().table("mensajes_privados")
        .select(_MP_SELECT)
        .eq("cedula_de", cedula_a)
        .eq("cedula_dest", cedula_b)
        .eq("tipo", "staff")
        .order("created_at", desc=False)
    ))
    r2 = _many(_run(
        _db().table("mensajes_privados")
        .select(_MP_SELECT)
        .eq("cedula_de", cedula_b)
        .eq("cedula_dest", cedula_a)
        .eq("tipo", "staff")
        .order("created_at", desc=False)
    ))
    return sorted(r1 + r2, key=lambda m: m.get("created_at") or "")


def mp_staff_get_hilos_de(cedula: str) -> list:
    r1 = _many(_run(
        _db().table("mensajes_privados")
        .select(_MP_SELECT)
        .eq("cedula_de", cedula)
        .eq("tipo", "staff")
        .order("created_at", desc=True)
    ))
    r2 = _many(_run(
        _db().table("mensajes_privados")
        .select(_MP_SELECT)
        .eq("cedula_dest", cedula)
        .eq("tipo", "staff")
        .order("created_at", desc=True)
    ))
    return r1 + r2


def mp_staff_create(cedula_from: str, cedula_to: str, mensaje: str,
                    adjuntos: list = None) -> dict | None:
    payload = {
        "cedula_de":   cedula_from,
        "cedula_dest": cedula_to,
        "mensaje":     mensaje,
        "tipo":        "staff",
    }
    if adjuntos:
        payload["adjuntos"] = adjuntos
    return _single(_run(
        _db().table("mensajes_privados").insert(payload)
    ))


def mp_staff_marcar_leidos(cedula_a: str, cedula_b: str, lector: str) -> None:
    _run_safe(
        _db().table("mensajes_privados")
        .update({"leido": True})
        .eq("cedula_de", cedula_a)
        .eq("cedula_dest", cedula_b)
        .eq("tipo", "staff")
        .neq("cedula_de", lector)
        .eq("leido", False)
    )


def mp_staff_no_leidos(cedula_lector: str, excluir: str = "") -> int:
    q = (
        _db().table("mensajes_privados")
        .select("id", count=CountMethod.exact)
        .eq("cedula_dest", cedula_lector)
        .eq("tipo", "staff")
        .eq("leido", False)
    )
    if excluir:
        q = q.neq("cedula_de", excluir)
    return _count(_run(q))


def mp_staff_no_leidos_por_cedula(cedula_lector: str, cedula_otro: str) -> int:
    res = _run(
        _db().table("mensajes_privados")
        .select("id", count=CountMethod.exact)
        .eq("cedula_de", cedula_otro)
        .eq("cedula_dest", cedula_lector)
        .eq("tipo", "staff")
        .eq("leido", False)
    )
    return _count(res)


def usuarios_activos_desde(desde_iso: str) -> int:
    try:
        r = _db().table("usuarios").select("cedula", count=CountMethod.exact) \
            .gte("ultima_conexion", desde_iso).execute()
        return _count(r)
    except Exception:
        return 0


def _logros_get(cedula: str) -> dict:
    rows = _many(_run_safe(
        _db().table("logros").select("cedula,id_role,data").eq("cedula", cedula)
    ))
    if not rows:
        return {"cedula": cedula, "id_role": None, "data": {}}
    row = rows[0]
    d   = row.get("data") or {}
    if isinstance(d, str):
        import json as _json
        try:
            d = _json.loads(d)
        except Exception:
            d = {}
    return {"cedula": row.get("cedula"), "id_role": row.get("id_role"), "data": d}


def _logros_save(cedula: str, id_role, data: dict) -> None:
    _run(_db().table("logros").upsert(
        {"cedula": cedula, "id_role": id_role, "data": data},
        on_conflict="cedula",
    ))


def usuario_logros_get(cedula: str) -> list:
    row    = _logros_get(cedula)
    logros = row["data"].get("logros", [])
    return [{"codigo_logro": c, "fecha_desbloqueado": None} for c in logros]


def usuario_logro_award(cedula: str, codigo: str, id_role=None) -> None:
    try:
        row      = _logros_get(cedula)
        d        = row["data"]
        existing = d.get("logros", [])
        if codigo in existing:
            return
        existing.append(codigo)
        d["logros"] = existing
        _logros_save(cedula, id_role or row.get("id_role"), d)
    except Exception as e:
        logger.warning("usuario_logro_award error: %s", e)


def logros_notificados_marcar(cedula: str, codigos: list) -> list:
    if not codigos:
        return []
    try:
        row          = _logros_get(cedula)
        d            = row["data"]
        notificados  = set(d.get("notificados", []))
        nuevos_codigos = [c for c in codigos if c not in notificados]
        if nuevos_codigos:
            notificados.update(nuevos_codigos)
            d["notificados"] = list(notificados)
            _logros_save(cedula, row.get("id_role"), d)
        return nuevos_codigos
    except Exception as e:
        logger.warning("logros_notificados_marcar error: %s", e)
        return codigos


def usuario_stats_logros(cedula: str) -> dict:
    stats: dict = {
        "total_pedidos":           0,
        "total_gastado":           0.0,
        "total_comentarios":       0,
        "max_likes":               0,
        "total_mensajes_privados": 0,
        "dias_registrado":         0,
        "productos_distintos":     0,
        "total_facturas":          0,
    }

    pedidos_r = _run_safe(
        _db().table("pedidos")
        .select("id_pedido,total")
        .eq("cedula", cedula)
        .neq("estado", "Cancelado")
    )
    pedidos               = _many(pedidos_r)
    stats["total_pedidos"] = len(pedidos)
    stats["total_gastado"] = sum(float(p.get("total") or 0) for p in pedidos)

    try:
        ids_pedido = [p["id_pedido"] for p in pedidos if p.get("id_pedido")]
        if ids_pedido:
            det_r = _run_safe(
                _db().table("pedido_detalle")
                .select("id_producto")
                .in_("id_pedido", ids_pedido)
            )
            det = _many(det_r)
            stats["productos_distintos"] = len(
                {d["id_producto"] for d in det if d.get("id_producto")}
            )
    except Exception:
        pass

    coments_r               = _run_safe(
        _db().table("comentarios").select("likes_usuarios").eq("cedula", cedula)
    )
    coments                 = _many(coments_r)
    stats["total_comentarios"] = len(coments)
    max_lk = 0
    for c in coments:
        lk = c.get("likes_usuarios") or []
        if isinstance(lk, list):
            max_lk = max(max_lk, len(lk))
    stats["max_likes"] = max_lk

    mp_r = _run_safe(
        _db().table("mensajes_privados")
        .select("id", count=CountMethod.exact)
        .eq("cedula_de", cedula)
    )
    stats["total_mensajes_privados"] = _count(mp_r)

    try:
        usr_r = _run_safe(
            _db().table("usuarios").select("fecha_creacion").eq("cedula", cedula).limit(1)
        )
        usr = _single(usr_r)
        if usr:
            fc = usr.get("fecha_creacion")
            if fc:
                from datetime import date
                if isinstance(fc, str):
                    fc = date.fromisoformat(fc[:10])
                elif hasattr(fc, "date"):
                    fc = fc.date()
                stats["dias_registrado"] = (date.today() - fc).days
    except Exception:
        pass

    try:
        fac_r = _run_safe(
            _db().table("facturas")
            .select("numero_factura", count=CountMethod.exact)
            .eq("cedula", cedula)
        )
        stats["total_facturas"] = _count(fac_r)
    except Exception:
        pass

    return stats


def sistema_stats_logros() -> dict:
    stats: dict = {
        "sistema_pedidos":      0,
        "sistema_gastado":      0.0,
        "sistema_usuarios":     0,
        "sistema_productos":    0,
        "sistema_publicidades": 0,
        "sistema_comentarios":  0,
        "sistema_mensajes":     0,
        "sistema_facturas":     0,
    }
    try:
        r = _run_safe(_db().table("pedidos").select("total").neq("estado", "Cancelado"))
        pedidos = _many(r)
        stats["sistema_pedidos"] = len(pedidos)
        stats["sistema_gastado"] = sum(float(p.get("total") or 0) for p in pedidos)
    except Exception:
        pass
    try:
        r = _run_safe(_db().table("usuarios").select("cedula", count=CountMethod.exact))
        stats["sistema_usuarios"] = _count(r)
    except Exception:
        pass
    try:
        r = _run_safe(
            _db().table("gestion_productos")
            .select("id_producto", count=CountMethod.exact)
            .eq("estado", True)
        )
        stats["sistema_productos"] = _count(r)
    except Exception:
        try:
            r = _run_safe(
                _db().table("gestion_productos")
                .select("id_producto", count=CountMethod.exact)
            )
            stats["sistema_productos"] = _count(r)
        except Exception:
            pass
    try:
        r = _run_safe(
            _db().table("publicidad").select("id_publicidad", count=CountMethod.exact)
        )
        stats["sistema_publicidades"] = _count(r)
    except Exception:
        pass
    try:
        r = _run_safe(
            _db().table("comentarios").select("id", count=CountMethod.exact)
        )
        stats["sistema_comentarios"] = _count(r)
    except Exception:
        pass
    try:
        r = _run_safe(
            _db().table("mensajes_privados").select("id", count=CountMethod.exact)
        )
        stats["sistema_mensajes"] = _count(r)
    except Exception:
        pass
    try:
        r = _run_safe(
            _db().table("facturas").select("numero_factura", count=CountMethod.exact)
        )
        stats["sistema_facturas"] = _count(r)
    except Exception:
        pass
    return stats


def usuario_pedido_repetido(cedula: str) -> bool:
    try:
        pedidos_r = _run_safe(
            _db().table("pedidos")
            .select("id_pedido")
            .eq("cedula", cedula)
            .neq("estado", "Cancelado")
        )
        pedidos = _many(pedidos_r)
        if not pedidos:
            return False

        ids = [p["id_pedido"] for p in pedidos]
        detalles_r = _run_safe(
            _db().table("pedido_detalle")
            .select("id_producto,cantidad")
            .in_("id_pedido", ids)
        )
        detalles = _many(detalles_r)

        conteo: dict[str, int] = {}
        for d in detalles:
            pid = d.get("id_producto")
            if pid:
                conteo[pid] = conteo.get(pid, 0) + int(d.get("cantidad") or 1)

        return any(v >= 3 for v in conteo.values())
    except Exception:
        return False


def logros_contadores_get(cedula: str) -> dict:
    row = _logros_get(cedula)
    return {k: int(v) for k, v in row["data"].get("contadores", {}).items()}


def logros_contadores_upsert_many(cedula: str, contadores: dict) -> None:
    if not contadores:
        return
    try:
        row  = _logros_get(cedula)
        d    = row["data"]
        prev = d.get("contadores", {})
        prev.update({
            k: int(v)
            for k, v in contadores.items()
            if isinstance(v, (int, float)) and v >= 0
        })
        d["contadores"] = prev
        _logros_save(cedula, row.get("id_role"), d)
    except Exception as e:
        logger.warning("logros_contadores_upsert_many error: %s", e)
