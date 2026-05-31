
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

_USR_SELECT = "cedula,username,imagen_url,nombre,apellido,telefono,correo,id_role,direccion,metodo_pago,fecha_creacion,ultima_conexion,contrasena,roles(nombre_role)"

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
        supabase.table("usuarios").select("cedula,username,imagen_url,nombre,apellido,telefono,correo," "id_role,direccion,metodo_pago,fecha_creacion,ultima_conexion," "contrasena,roles(nombre_role)")
    ))

def usuario_create(data: dict) -> list:
    return _many(_run(supabase.table("usuarios").insert(data)))

def usuario_update(cedula: str, data: dict) -> list:
    return _many(_run(supabase.table("usuarios").update(data).eq("cedula", cedula)))

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

def usuario_touch(cedula: str, ts: str) -> None:
    _run_safe(supabase.table("usuarios").update({"ultima_conexion": ts}).eq("cedula", cedula))

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

# MENSAJES PRIVADOS (clientes ↔ vendedores)
# Tabla Supabase requerida:
#   CREATE TABLE mensajes_privados (
#     id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
#     cedula_cliente    TEXT NOT NULL,
#     cedula_remitente  TEXT NOT NULL,
#     es_vendedor       BOOLEAN DEFAULT false,
#     mensaje           TEXT NOT NULL,
#     es_predeterminado BOOLEAN DEFAULT false,
#     leido             BOOLEAN DEFAULT false,
#     created_at        TIMESTAMPTZ DEFAULT now()
#   );

_MP_SELECT = "id,cedula_cliente,cedula_remitente,es_vendedor,mensaje,es_predeterminado,leido,created_at"

def mp_get_conversacion(cedula_cliente: str) -> list:
    return _many(_run(
        supabase.table("mensajes_privados")
        .select(_MP_SELECT)
        .eq("cedula_cliente", cedula_cliente)
        .order("created_at", desc=False)
    ))

def mp_get_todos_hilos() -> list:
    """Devuelve todos los mensajes para que el vendedor pueda agruparlos por cedula_cliente."""
    return _many(_run(
        supabase.table("mensajes_privados")
        .select(_MP_SELECT)
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
        })
    ))

def mp_marcar_leidos(cedula_cliente: str, es_vendedor_leyendo: bool) -> None:
    """Marca como leídos los mensajes del lado opuesto al lector."""
    _run_safe(
        supabase.table("mensajes_privados")
        .update({"leido": True})
        .eq("cedula_cliente", cedula_cliente)
        .eq("es_vendedor", not es_vendedor_leyendo)
        .eq("leido", False)
    )

def mp_no_leidos(cedula_cliente: str, para_vendedor: bool) -> int:
    """Cuenta mensajes no leídos para el receptor indicado."""
    res = _run(
        supabase.table("mensajes_privados")
        .select("id", count="exact")
        .eq("cedula_cliente", cedula_cliente)
        .eq("es_vendedor", not para_vendedor)
        .eq("leido", False)
    )
    return res.count if res and hasattr(res, "count") and res.count is not None else 0

def mp_total_no_leidos_vendedor() -> int:
    """Total de mensajes de clientes no leídos por ningún vendedor."""
    res = _run(
        supabase.table("mensajes_privados")
        .select("id", count="exact")
        .eq("es_vendedor", False)
        .eq("leido", False)
    )
    return res.count if res and hasattr(res, "count") and res.count is not None else 0


# TABLA UTILIDADES

def usuarios_activos_desde(desde_iso: str) -> int:
    try:
        r = supabase.table("usuarios").select("cedula", count="exact") \
            .gte("ultima_conexion", desde_iso).execute()
        return r.count if r and r.count is not None else 0
    except Exception:
        return 0