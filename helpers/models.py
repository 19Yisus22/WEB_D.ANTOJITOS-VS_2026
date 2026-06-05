
from __future__ import annotations
import time
import logging
from helpers.database import supabase

logger = logging.getLogger(__name__)

_RETRY_EXCEPTIONS = ("RemoteProtocolError", "ConnectError", "ReadError", "WriteError", "TimeoutException")

def _run(query) -> object:
    last_exc = None
    for attempt in range(3):
        try:
            return query.execute()
        except Exception as e:
            name = type(e).__name__
            msg  = str(e)
            if any(k in name or k in msg for k in _RETRY_EXCEPTIONS):
                last_exc = e
                if attempt < 2:
                    time.sleep(0.4 * (attempt + 1))
                    logger.warning("DB retry %d after %s: %s", attempt + 1, name, msg)
                continue
            raise
    raise last_exc

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
    
# TABLA DE ROLES

def rol_get_all() -> list:
    return _many(_run(supabase.table("roles").select("*")))

def rol_get_by_nombre(nombre: str) -> dict | None:
    return _single(_run(
        supabase.table("roles").select("id_role,nombre_role,descripcion")
        .eq("nombre_role", nombre).limit(1)
    ))

def rol_get_id(nombre: str) -> str | None:
    r = rol_get_by_nombre(nombre)
    return r["id_role"] if r else None

# TABLA USUARIOS

# SQL to run in Supabase before enabling the lockout feature:
#
#   ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS intentos_fallidos INTEGER NOT NULL DEFAULT 0;
#   ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS bloqueado_hasta TIMESTAMPTZ;

_USR_SELECT = (
    "cedula,username,imagen_url,nombre,apellido,telefono,correo,id_role,"
    "direccion,metodo_pago,fecha_creacion,ultima_conexion,contrasena,roles(nombre_role),"
    "last_change_cedula,last_change_username,last_change_nombre,last_change_apellido,"
    "last_change_contrasena,fecha_nacimiento,intentos_fallidos,bloqueado_hasta"
)

def usuario_get(cedula: str) -> dict | None:
    return _single(_run(supabase.table("usuarios").select(_USR_SELECT).eq("cedula", cedula).limit(1)))

def usuario_get_by_correo(correo: str) -> dict | None:
    return _single(_run(
        supabase.table("usuarios").select(_USR_SELECT)
        .ilike("correo", correo.strip()).limit(1)
    ))

def usuario_get_by_username(username: str) -> dict | None:
    return _single(_run(
        supabase.table("usuarios").select(_USR_SELECT)
        .ilike("username", username).limit(1)
    ))

def usuario_get_by_identifier(identifier: str) -> dict | None:

    if not identifier:
        return None
    raw = identifier.strip()

    if '@' in raw:
        u = usuario_get_by_correo(raw.lower())
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
        u = _single(_run(supabase.table("usuarios").select("cedula,nombre,apellido,username").ilike("nombre", f"%{primer}%").ilike("apellido", f"%{resto}%").limit(1)))
        if u:
            return u
    u = _single(_run(
        supabase.table("usuarios").select("cedula,nombre,apellido,username")
        .ilike("nombre", f"%{nombre}%").limit(1)
    ))
    if u:
        return u
    return _single(_run(supabase.table("usuarios").select("cedula,nombre,apellido,username").ilike("apellido", f"%{nombre}%").limit(1)))

def usuario_get_all() -> list:
    return _many(_run(
        supabase.table("usuarios").select("cedula,username,imagen_url,nombre,apellido,telefono,correo,id_role,direccion,metodo_pago,fecha_creacion,ultima_conexion,contrasena,roles(nombre_role)")
    ))

def usuario_get_web_token(cedula: str) -> dict | None:
    row = _single(_run(
        supabase.table("usuarios")
        .select("web_token,expires_at")
        .eq("cedula", cedula)
        .limit(1)
    ))
    return row

def usuario_set_web_token(cedula: str, token_hash: str, expires_at: str) -> None:
    _run(supabase.table("usuarios").update({
        "web_token":  token_hash,
        "expires_at": expires_at,
    }).eq("cedula", cedula))

def usuario_clear_web_token(cedula: str) -> None:
    _run(supabase.table("usuarios").update({
        "web_token":  None,
        "expires_at": None,
    }).eq("cedula", cedula))

def usuario_get_block_folder(cedula: str) -> list:
    row = _single(_run(supabase.table("usuarios").select("block_folder").eq("cedula", cedula).limit(1)))
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
    _run(supabase.table("usuarios").update({"block_folder": archivos}).eq("cedula", cedula))

def usuario_create(data: dict) -> list:
    return _many(_run(supabase.table("usuarios").insert(data)))

def usuario_update(cedula: str, data: dict) -> list:
    return _many(_run(supabase.table("usuarios").update(data).eq("cedula", cedula)))

def cedula_cascade_update(old_cedula: str, new_cedula: str) -> None:
    """Actualiza todas las FK dependientes antes de cambiar la PK cedula.
    Obligatorio para usuarios Google (G-) donde la cédula original es temporal.
    Ignora errores por tablas vacías; el UPDATE de usuarios se hace DESPUÉS."""
    # Tablas con FK directa a cedula
    for table, col in [
        ("pedidos",           "cedula"),
        ("facturas",          "cedula"),
        ("comentarios",       "cedula"),
        ("mensajes_privados", "cedula_de"),
    ]:
        try:
            _run(supabase.table(table).update({col: new_cedula}).eq(col, old_cedula))
        except Exception:
            pass

    # chats_privados tiene dos columnas FK
    for col in ("cedula_de", "cedula_para"):
        try:
            _run(supabase.table("chats_privados").update({col: new_cedula}).eq(col, old_cedula))
        except Exception:
            pass

    # Carrito es estado temporal: limpiar para no arrastrar referencias huérfanas
    try:
        _run(supabase.table("carrito").delete().eq("cedula", old_cedula))
    except Exception:
        pass

def usuario_delete(cedula: str) -> list:
    return _many(_run(supabase.table("usuarios").delete().eq("cedula", cedula)))

def usuario_set_role(cedula: str, id_role: str) -> list:
    return _many(_run(supabase.table("usuarios").update({"id_role": id_role}).eq("cedula", cedula)))

def usuario_count_por_rol(nombre_rol: str, excluir_cedula: str | None = None) -> int:
    """Devuelve cuántos usuarios tienen el rol indicado, excluyendo opcionalmente una cédula."""
    id_role = rol_get_id(nombre_rol)
    if not id_role:
        return 0
    q = supabase.table("usuarios").select("cedula", count="exact").eq("id_role", id_role)
    if excluir_cedula:
        q = q.neq("cedula", str(excluir_cedula))
    res = _run(q)
    return res.count if res and hasattr(res, "count") and res.count is not None else 0

def usuario_get_pass_cooldown(cedula: str) -> str | None:
    """Retorna el valor de last_change_contrasena o None si la columna no existe."""
    try:
        row = _single(_run(
            supabase.table("usuarios")
            .select("last_change_contrasena")
            .eq("cedula", cedula)
            .limit(1)
        ))
        return (row or {}).get("last_change_contrasena")
    except Exception:
        return None

def usuario_touch(cedula: str, ts: str) -> None:
    _run_safe(supabase.table("usuarios").update({"ultima_conexion": ts}).eq("cedula", cedula))

_LOCKOUT_THRESHOLDS = [
    (5,  5),
    (10, 30),
    (15, 120),
    (20, 720),
    (25, 1440),
    (30, 4320),
]

def usuario_incrementar_intento(cedula: str) -> dict:
    """Increment failed login counter. Applies a lockout block when a threshold is hit.

    Returns a dict with:
      - intentos: new total intentos_fallidos
      - bloqueado_hasta: ISO string if a block was applied, else None
      - minutos_bloqueo: duration of the new block in minutes, else None
    """
    from datetime import datetime, timezone, timedelta

    row = _single(_run_safe(
        supabase.table("usuarios")
        .select("intentos_fallidos")
        .eq("cedula", cedula)
        .limit(1)
    ))
    current = int((row or {}).get("intentos_fallidos") or 0)
    new_total = current + 1

    bloqueado_hasta = None
    minutos_bloqueo = None
    for threshold, minutes in _LOCKOUT_THRESHOLDS:
        if new_total == threshold:
            minutos_bloqueo = minutes
            bloqueado_hasta = (datetime.now(timezone.utc) + timedelta(minutes=minutes)).isoformat()
            break

    update_payload: dict = {"intentos_fallidos": new_total}
    if bloqueado_hasta:
        update_payload["bloqueado_hasta"] = bloqueado_hasta

    _run_safe(supabase.table("usuarios").update(update_payload).eq("cedula", cedula))

    return {
        "intentos": new_total,
        "bloqueado_hasta": bloqueado_hasta,
        "minutos_bloqueo": minutos_bloqueo,
    }

def usuario_reset_intentos(cedula: str) -> None:
    _run_safe(supabase.table("usuarios").update({
        "intentos_fallidos": 0,
        "bloqueado_hasta": None,
    }).eq("cedula", cedula))

# TABLA GESTION DE PRODUCTOS

def producto_get_all() -> list:
    return _many(_run(
        supabase.table("gestion_productos").select("*")
        .order("fecha_creacion", desc=True)
    ))

def producto_get_activos() -> list:
    return _many(_run(
        supabase.table("gestion_productos").select("*").eq("estado", True)
    ))

def producto_get(id_producto: str) -> dict | None:
    return _single(_run(
        supabase.table("gestion_productos").select("*")
        .eq("id_producto", id_producto).limit(1)
    ))

def producto_get_muchos(ids: list[str]) -> list:
    if not ids:
        return []
    return _many(_run(
        supabase.table("gestion_productos").select("*").in_("id_producto", ids)
    ))

def producto_create(data: dict) -> list:
    return _many(_run(supabase.table("gestion_productos").insert(data)))

def producto_update(id_producto: str, data: dict) -> list:
    return _many(_run(
        supabase.table("gestion_productos").update(data).eq("id_producto", id_producto)
    ))

def producto_delete(id_producto: str) -> list:
    return _many(_run(
        supabase.table("gestion_productos").delete().eq("id_producto", id_producto)
    ))

# TABLA CARRITO

def carrito_get(cedula: str) -> list:
    return _many(_run(supabase.table("carrito").select("*").eq("cedula", cedula)))

def carrito_get_item(cedula: str, id_producto: str) -> dict | None:
    return _single(_run(
        supabase.table("carrito").select("*")
        .eq("cedula", cedula).eq("id_producto", id_producto).limit(1)
    ))

def carrito_add(cedula: str, id_producto: str, nombre: str, cantidad: int, precio: float) -> None:
    existing = carrito_get_item(cedula, id_producto)
    if existing:
        nueva_qty = int(existing["cantidad"]) + cantidad
        _run(supabase.table("carrito").update({"cantidad": nueva_qty})
             .eq("id_carrito", existing["id_carrito"]))
    else:
        _run(supabase.table("carrito").insert({
            "cedula":          cedula,
            "id_producto":     id_producto,
            "nombre_producto": nombre,
            "cantidad":        cantidad,
            "precio_unitario": precio,
        }))

def carrito_delete_item(id_carrito: str, cedula: str) -> list:
    return _many(_run(
        supabase.table("carrito").delete()
        .eq("id_carrito", id_carrito).eq("cedula", cedula)
    ))

def carrito_clear(cedula: str) -> None:
    _run(supabase.table("carrito").delete().eq("cedula", cedula))

# TABLA PEDIDOS

_PEDIDO_JOIN = (
    "*, "
    "usuarios(cedula,nombre,apellido,telefono,correo,direccion,metodo_pago,imagen_url),"
    "pedido_detalle(*, gestion_productos(nombre,precio,imagen_url))"
)

def pedido_get_all() -> list:
    return _many(_run(
        supabase.table("pedidos").select(_PEDIDO_JOIN)
        .order("fecha_pedido", desc=True)
    ))

def pedido_get(id_pedido: str) -> dict | None:
    return _single(_run(
        supabase.table("pedidos").select("*")
        .eq("id_pedido", id_pedido).limit(1)
    ))

def pedido_create(data: dict) -> list:
    return _many(_run(supabase.table("pedidos").insert(data)))

def pedido_update(id_pedido: str, data: dict) -> list:
    return _many(_run(
        supabase.table("pedidos").update(data).eq("id_pedido", id_pedido)
    ))

def pedido_delete_many(ids: list[str]) -> list:
    if not ids:
        return []
    return _many(_run(supabase.table("pedidos").delete().in_("id_pedido", ids)))

# TABLA PEDIDO DETALLE

def detalle_get(id_pedido: str) -> list:
    return _many(_run(
        supabase.table("pedido_detalle")
        .select("*, gestion_productos(nombre,imagen_url)")
        .eq("id_pedido", id_pedido)
    ))

def detalle_create_many(items: list[dict]) -> None:
    if items:
        _run(supabase.table("pedido_detalle").insert(items))

# TABLA FACTURAS

def factura_get_by_user(cedula: str) -> list:
    return _many(_run(
        supabase.table("facturas").select("*")
        .eq("cedula", cedula).order("fecha_emision", desc=True)
    ))

def factura_get_by_numero(numero: str) -> dict | None:
    return _single(_run(
        supabase.table("facturas").select("*")
        .eq("numero_factura", numero).limit(1)
    ))

def factura_get_all() -> list:
    return _many(_run(
        supabase.table("facturas")
        .select("*, usuarios(cedula,nombre,apellido)")
        .order("fecha_emision", desc=True)
    ))

def factura_get_all_enriched(limit: int = 120) -> list:
    """Devuelve facturas con datos completos del usuario + rol para historial admin/vendedor."""
    return _many(_run(
        supabase.table("facturas")
        .select("*, usuarios(cedula, nombre, apellido, username, telefono, direccion, metodo_pago, roles(nombre_role))")
        .order("fecha_emision", desc=True)
        .limit(limit)
    ))

def factura_next_seq(year: str) -> int:
    prefix = f"F-{year}-"
    last = _many(_run(
        supabase.table("facturas").select("numero_factura")
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
    _run(supabase.table("facturas").insert(data))

def factura_update(numero: str, data: dict) -> None:
    _run(supabase.table("facturas").update(data).eq("numero_factura", numero))

# TABLA MÉTODOS DE PAGO

def metodo_pago_get_all() -> list:
    return _many(_run(supabase.table("metodos_pago").select("*")))

def metodo_pago_get_activos() -> list:
    return _many(_run(supabase.table("metodos_pago").select("*").eq("estado", True)))

def metodo_pago_get(id_pago: str) -> dict | None:
    return _single(_run(
        supabase.table("metodos_pago").select("*")
        .eq("id_pago", id_pago).limit(1)
    ))

def metodo_pago_create(data: dict) -> list:
    return _many(_run(supabase.table("metodos_pago").insert(data)))

def metodo_pago_update(id_pago: str, data: dict) -> list:
    return _many(_run(supabase.table("metodos_pago").update(data).eq("id_pago", id_pago)))

def metodo_pago_delete(id_pago: str) -> list:
    return _many(_run(supabase.table("metodos_pago").delete().eq("id_pago", id_pago)))

def metodo_pago_delete_many(ids: list[str]) -> list:
    if not ids:
        return []
    return _many(_run(supabase.table("metodos_pago").delete().in_("id_pago", ids)))

def metodo_pago_create_many(items: list[dict]) -> list:
    if not items:
        return []
    return _many(_run(supabase.table("metodos_pago").insert(items)))

# TABLA PUBLICIDAD

def publicidad_get_activa() -> list:
    return _many(_run(supabase.table("publicidad").select("*").eq("estado", True)))

def publicidad_get_all() -> list:
    return _many(_run(
        supabase.table("publicidad").select("*").order("fecha_creacion", desc=True)
    ))

def publicidad_get_by_tipo(tipo: str) -> list:
    return _many(_run(
        supabase.table("publicidad").select("*")
        .eq("tipo", tipo).order("fecha_creacion", desc=True)
    ))

def publicidad_get_by_tipos(tipos: list[str]) -> list:
    if not tipos:
        return []
    return _many(_run(
        supabase.table("publicidad")
        .select("id_publicidad,imagen_url,tipo,titulo,descripcion")
        .in_("tipo", tipos).eq("estado", True)
    ))

def publicidad_get(id_publicidad: str) -> dict | None:
    return _single(_run(
        supabase.table("publicidad").select("*")
        .eq("id_publicidad", id_publicidad).limit(1)
    ))

def publicidad_get_notificaciones() -> list:
    return _many(_run(
        supabase.table("publicidad").select("*")
        .eq("tipo", "notificacion").order("id_publicidad", desc=True)
    ))

def publicidad_create(data: dict) -> list:
    return _many(_run(supabase.table("publicidad").insert(data)))

def publicidad_create_many(items: list[dict]) -> list:
    if not items:
        return []
    return _many(_run(supabase.table("publicidad").insert(items)))

def publicidad_update(id_publicidad: str, data: dict) -> None:
    _run(supabase.table("publicidad").update(data).eq("id_publicidad", id_publicidad))

def publicidad_delete(id_publicidad: str) -> None:
    _run(supabase.table("publicidad").delete().eq("id_publicidad", id_publicidad))

def publicidad_delete_many(ids: list[str]) -> None:
    if ids:
        _run(supabase.table("publicidad").delete().in_("id_publicidad", ids))

# TABLA COMENTARIOS

def comentario_get_all() -> list:
    return _many(_run(
        supabase.table("comentarios").select("*").order("created_at", desc=False)
    ))

def comentario_get(id: str) -> dict | None:
    return _single(_run(
        supabase.table("comentarios").select("*").eq("id", id).limit(1)
    ))

def comentario_create(data: dict) -> list:
    return _many(_run(supabase.table("comentarios").insert(data)))

def comentario_update(id: str, data: dict) -> list:
    return _many(_run(supabase.table("comentarios").update(data).eq("id", id)))

def comentario_delete(id: str) -> None:
    _run(supabase.table("comentarios").delete().eq("id", id))

def comentario_update_likes(id: str, likes: list) -> None:
    _run(supabase.table("comentarios").update({"likes_usuarios": likes}).eq("id", id))

#  INICIO CONFIG

def inicio_config_get() -> dict:
    try:
        result = supabase.table("inicio_config").select("clave,valor").execute()
        rows   = result.data or []
        return {r["clave"]: r["valor"] for r in rows if "clave" in r}
    except Exception as e:
        logger.warning("inicio_config_get error (tabla puede no existir): %s", e)
        return {}

def inicio_config_save(data: dict) -> None:
    rows = [{"clave": k, "valor": str(v)} for k, v in data.items()]
    if not rows:
        return
    try:
        supabase.table("inicio_config").upsert(rows, on_conflict="clave").execute()
    except Exception as e:
        logger.warning("inicio_config_save error: %s", e)

_MP_SELECT = "id,cedula_cliente,cedula_remitente,cedula_dest,es_vendedor,mensaje,es_predeterminado,leido,created_at,tipo"

def mp_get_by_id(id: str) -> dict | None:
    return _single(_run(
        supabase.table("mensajes_privados").select(_MP_SELECT).eq("id", id).limit(1)
    ))

def mp_update(id: str, mensaje: str) -> None:
    _run_safe(supabase.table("mensajes_privados").update({"mensaje": mensaje}).eq("id", id))

def mp_delete(id: str) -> None:
    _run_safe(supabase.table("mensajes_privados").delete().eq("id", id))

def mp_delete_hilo(cedula_hilo: str, tipo: str) -> None:
    _run_safe(
        supabase.table("mensajes_privados")
        .delete()
        .eq("cedula_cliente", cedula_hilo)
        .eq("tipo", tipo)
    )

def mp_get_conversacion(cedula_cliente: str) -> list:
    return _many(_run(
        supabase.table("mensajes_privados")
        .select(_MP_SELECT)
        .eq("cedula_cliente", cedula_cliente)
        .eq("tipo", "cv")
        .order("created_at", desc=False)
    ))

def mp_get_todos_hilos() -> list:
    return _many(_run(
        supabase.table("mensajes_privados")
        .select(_MP_SELECT)
        .eq("tipo", "cv")
        .order("created_at", desc=True)
    ))

def mp_create(cedula_cliente: str, cedula_remitente: str,
              es_vendedor: bool, mensaje: str, es_predeterminado: bool = False) -> dict | None:
    return _single(_run(
        supabase.table("mensajes_privados").insert({
            "cedula_cliente":    cedula_cliente,
            "cedula_remitente":  cedula_remitente,
            "es_vendedor":       es_vendedor,
            "mensaje":           mensaje,
            "es_predeterminado": es_predeterminado,
            "tipo":              "cv",
        })
    ))

def mp_marcar_leidos(cedula_cliente: str, es_vendedor_leyendo: bool) -> None:
    _run_safe(
        supabase.table("mensajes_privados")
        .update({"leido": True})
        .eq("cedula_cliente", cedula_cliente)
        .eq("tipo", "cv")
        .eq("es_vendedor", not es_vendedor_leyendo)
        .eq("leido", False)
    )

def mp_no_leidos(cedula_cliente: str, para_vendedor: bool) -> int:
    res = _run(
        supabase.table("mensajes_privados")
        .select("id", count="exact")
        .eq("cedula_cliente", cedula_cliente)
        .eq("tipo", "cv")
        .eq("es_vendedor", not para_vendedor)
        .eq("leido", False)
    )
    return res.count if res and hasattr(res, "count") and res.count is not None else 0

def mp_total_no_leidos_vendedor() -> int:
    res = _run(
        supabase.table("mensajes_privados")
        .select("id", count="exact")
        .eq("tipo", "cv")
        .eq("es_vendedor", False)
        .eq("leido", False)
    )
    return res.count if res and hasattr(res, "count") and res.count is not None else 0

def _staff_thread_key(a: str, b: str) -> tuple[str, str]:
    return (min(a, b), max(a, b))

def mp_staff_get_conversacion(cedula_a: str, cedula_b: str) -> list:
    c1, c2 = _staff_thread_key(cedula_a, cedula_b)
    return _many(_run(
        supabase.table("mensajes_privados")
        .select(_MP_SELECT)
        .eq("cedula_cliente", c1)
        .eq("cedula_dest", c2)
        .eq("tipo", "staff")
        .order("created_at", desc=False)
    ))

def mp_staff_get_hilos_de(cedula: str) -> list:
    r1 = _many(_run(
        supabase.table("mensajes_privados")
        .select(_MP_SELECT)
        .eq("cedula_cliente", cedula)
        .eq("tipo", "staff")
        .order("created_at", desc=True)
    ))
    r2 = _many(_run(
        supabase.table("mensajes_privados")
        .select(_MP_SELECT)
        .eq("cedula_dest", cedula)
        .eq("tipo", "staff")
        .order("created_at", desc=True)
    ))
    return r1 + r2

def mp_staff_create(cedula_from: str, cedula_to: str, mensaje: str) -> dict | None:
    c1, c2 = _staff_thread_key(cedula_from, cedula_to)
    return _single(_run(
        supabase.table("mensajes_privados").insert({
            "cedula_cliente":   c1,
            "cedula_dest":      c2,
            "cedula_remitente": cedula_from,
            "es_vendedor":      False,
            "mensaje":          mensaje,
            "tipo":             "staff",
        })
    ))

def mp_staff_marcar_leidos(cedula_a: str, cedula_b: str, lector: str) -> None:
    c1, c2 = _staff_thread_key(cedula_a, cedula_b)
    _run_safe(
        supabase.table("mensajes_privados")
        .update({"leido": True})
        .eq("cedula_cliente", c1)
        .eq("cedula_dest", c2)
        .eq("tipo", "staff")
        .neq("cedula_remitente", lector)
        .eq("leido", False)
    )

def mp_staff_no_leidos(cedula_lector: str) -> int:
    r1 = _run(
        supabase.table("mensajes_privados")
        .select("id", count="exact")
        .eq("cedula_dest", cedula_lector)
        .eq("tipo", "staff")
        .eq("leido", False)
        .neq("cedula_remitente", cedula_lector)
    )
    r2 = _run(
        supabase.table("mensajes_privados")
        .select("id", count="exact")
        .eq("cedula_cliente", cedula_lector)
        .eq("tipo", "staff")
        .eq("leido", False)
        .neq("cedula_remitente", cedula_lector)
    )
    c1 = r1.count if r1 and hasattr(r1, "count") and r1.count is not None else 0
    c2 = r2.count if r2 and hasattr(r2, "count") and r2.count is not None else 0
    return c1 + c2

def comentario_delete_all() -> None:
    _run_safe(supabase.table("comentarios").delete().neq("id", "00000000-0000-0000-0000-000000000000"))


# TABLA UTILIDADES

def usuarios_activos_desde(desde_iso: str) -> int:
    try:
        r = supabase.table("usuarios").select("cedula", count="exact") \
            .gte("ultima_conexion", desde_iso).execute()
        return r.count if r and r.count is not None else 0
    except Exception:
        return 0


# ══════════════════════════════════════════════════════
# TABLA LOGROS / USUARIO_LOGROS
# Esquema: logros(id, codigo, nombre, descripcion, icono, rareza, puntos)
#          usuario_logros(id, cedula, codigo_logro, fecha_desbloqueado)
# ══════════════════════════════════════════════════════

def logros_sembrar(logros: list) -> None:
    """Inserta/actualiza definiciones en la tabla logros (idempotente por 'codigo')."""
    rows = [
        {
            "codigo":      l["codigo"],
            "nombre":      l["nombre"],
            "descripcion": l["descripcion"],
            "icono":       l["icono"],
            "rareza":      l.get("rareza", "comun"),
            "puntos":      l.get("puntos", 10),
        }
        for l in logros
    ]
    if not rows:
        return
    _run(supabase.table("logros").upsert(rows, on_conflict="codigo"))


def usuario_logros_get(cedula: str) -> list:
    """Retorna los logros ya obtenidos por el usuario (lista de {codigo_logro, fecha_desbloqueado})."""
    return _many(_run(
        supabase.table("usuario_logros")
        .select("codigo_logro,fecha_desbloqueado")
        .eq("cedula", cedula)
    ))


def usuario_logro_award(cedula: str, codigo: str) -> None:
    """Otorga un logro al usuario. Ignora si ya lo tiene (constraint unique)."""
    try:
        _run(supabase.table("usuario_logros").upsert(
            {"cedula": cedula, "codigo_logro": codigo},
            on_conflict="cedula,codigo_logro",
        ))
    except Exception as e:
        if "unique" not in str(e).lower() and "duplicate" not in str(e).lower():
            raise


def usuario_stats_logros(cedula: str) -> dict:
    """Agrega estadísticas necesarias para verificar logros del usuario."""
    stats: dict = {
        "total_pedidos": 0,
        "total_gastado": 0.0,
        "total_comentarios": 0,
        "max_likes": 0,
        "total_mensajes_privados": 0,
        "dias_registrado": 0,
        "productos_distintos": 0,
        "total_facturas": 0,
    }

    # Pedidos no cancelados
    pedidos_r = _run_safe(
        supabase.table("pedidos")
        .select("id_pedido,total")
        .eq("cedula", cedula)
        .neq("estado", "Cancelado")
    )
    pedidos = _many(pedidos_r)
    stats["total_pedidos"] = len(pedidos)
    stats["total_gastado"] = sum(float(p.get("total") or 0) for p in pedidos)

    # Productos distintos comprados
    try:
        ids_pedido = [p["id_pedido"] for p in pedidos if p.get("id_pedido")]
        if ids_pedido:
            det_r = _run_safe(
                supabase.table("pedido_detalle")
                .select("id_producto")
                .in_("id_pedido", ids_pedido)
            )
            det = _many(det_r)
            stats["productos_distintos"] = len({d["id_producto"] for d in det if d.get("id_producto")})
    except Exception:
        pass

    # Comentarios + likes
    coments_r = _run_safe(
        supabase.table("comentarios")
        .select("likes_usuarios")
        .eq("cedula", cedula)
    )
    coments = _many(coments_r)
    stats["total_comentarios"] = len(coments)
    max_lk = 0
    for c in coments:
        lk = c.get("likes_usuarios") or []
        if isinstance(lk, list):
            max_lk = max(max_lk, len(lk))
    stats["max_likes"] = max_lk

    # Mensajes privados enviados (campo cedula_de según esquema BD original)
    mp_r = _run_safe(
        supabase.table("mensajes_privados")
        .select("id", count="exact")
        .eq("cedula_de", cedula)
    )
    stats["total_mensajes_privados"] = (mp_r.count if mp_r and mp_r.count is not None else 0)

    # Días registrado
    try:
        usr_r = _run_safe(supabase.table("usuarios").select("fecha_creacion,creado_en").eq("cedula", cedula).limit(1))
        usr = _single(usr_r)
        if usr:
            fc = usr.get("fecha_creacion") or usr.get("creado_en")
            if fc:
                from datetime import date
                if isinstance(fc, str):
                    fc = date.fromisoformat(fc[:10])
                elif hasattr(fc, "date"):
                    fc = fc.date()
                stats["dias_registrado"] = (date.today() - fc).days
    except Exception:
        pass

    # Facturas del usuario
    try:
        fac_r = _run_safe(
            supabase.table("facturas").select("id", count="exact").eq("cedula", cedula)
        )
        stats["total_facturas"] = (fac_r.count if fac_r and fac_r.count is not None else 0)
    except Exception:
        pass

    return stats


def sistema_stats_logros() -> dict:
    """Estadísticas globales del sistema para verificación de logros de admin/vendedor."""
    stats: dict = {
        "sistema_pedidos": 0,
        "sistema_gastado": 0.0,
        "sistema_usuarios": 0,
        "sistema_productos": 0,
        "sistema_publicidades": 0,
        "sistema_comentarios": 0,
        "sistema_mensajes": 0,
        "sistema_facturas": 0,
    }
    try:
        r = _run_safe(supabase.table("pedidos").select("total").neq("estado", "Cancelado"))
        pedidos = _many(r)
        stats["sistema_pedidos"] = len(pedidos)
        stats["sistema_gastado"] = sum(float(p.get("total") or 0) for p in pedidos)
    except Exception:
        pass
    try:
        r = _run_safe(supabase.table("usuarios").select("cedula", count="exact"))
        stats["sistema_usuarios"] = (r.count if r and r.count is not None else 0)
    except Exception:
        pass
    try:
        r = _run_safe(supabase.table("productos").select("id_producto", count="exact").eq("activo", True))
        stats["sistema_productos"] = (r.count if r and r.count is not None else 0)
    except Exception:
        try:
            r = _run_safe(supabase.table("productos").select("id_producto", count="exact"))
            stats["sistema_productos"] = (r.count if r and r.count is not None else 0)
        except Exception:
            pass
    try:
        r = _run_safe(supabase.table("publicidad").select("id", count="exact"))
        stats["sistema_publicidades"] = (r.count if r and r.count is not None else 0)
    except Exception:
        pass
    try:
        r = _run_safe(supabase.table("comentarios").select("id", count="exact"))
        stats["sistema_comentarios"] = (r.count if r and r.count is not None else 0)
    except Exception:
        pass
    try:
        r = _run_safe(supabase.table("mensajes_privados").select("id", count="exact"))
        stats["sistema_mensajes"] = (r.count if r and r.count is not None else 0)
    except Exception:
        pass
    try:
        r = _run_safe(supabase.table("facturas").select("id", count="exact"))
        stats["sistema_facturas"] = (r.count if r and r.count is not None else 0)
    except Exception:
        pass
    return stats


def usuario_pedido_repetido(cedula: str) -> bool:
    """
    Retorna True si el usuario ha comprado el mismo producto
    con cantidad acumulada >= 3 a lo largo de todos sus pedidos.
    """
    try:
        pedidos_r = _run_safe(
            supabase.table("pedidos")
            .select("id_pedido")
            .eq("cedula", cedula)
            .neq("estado", "Cancelado")
        )
        pedidos = _many(pedidos_r)
        if not pedidos:
            return False

        ids = [p["id_pedido"] for p in pedidos]
        detalles_r = _run_safe(
            supabase.table("pedido_detalle")
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