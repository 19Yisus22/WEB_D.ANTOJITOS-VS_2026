
from __future__ import annotations

from dataclasses import dataclass, field, asdict
from typing import Any

def _str(data: dict, *keys: str, lower: bool = False) -> str:
    for k in keys:
        v = (data.get(k) or "").strip()
        if v:
            return v.lower() if lower else v
    return ""

def _int(data: dict, key: str, default: int = 0) -> int:
    try:
        return int(data.get(key) or default)
    except (ValueError, TypeError):
        return default

def _float(data: dict, key: str, default: float = 0.0) -> float:
    try:
        return float(data.get(key) or default)
    except (ValueError, TypeError):
        return default

def _bool(data: dict, key: str, default: bool = False) -> bool:
    v = data.get(key)
    if v is None:
        return default
    if isinstance(v, bool):
        return v
    return str(v).lower() in ("true", "1", "yes", "sí", "si")

def _list(data: dict, key: str) -> list:
    v = data.get(key)
    return v if isinstance(v, list) else []

def _json(request_obj) -> dict:
    try:
        return request_obj.get_json(force=True, silent=True) or {}
    except Exception:
        return {}

class _FormBase:
    def to_dict(self) -> dict[str, Any]:
        return {k: v for k, v in asdict(self).items() if not k.startswith("_")}

    @property
    def es_valido(self) -> bool:
        return True

@dataclass
class LoginForm(_FormBase):
    identifier: str = ""
    contrasena: str = ""

    @property
    def es_valido(self) -> bool:
        return bool(self.identifier and self.contrasena)

def login(req) -> LoginForm:
    d = _json(req)
    return LoginForm(
        identifier=_str(d, "identifier", "correo"),
        contrasena=_str(d, "contrasena"),
    )

@dataclass
class RegistroForm(_FormBase):
    nombre:     str = ""
    apellido:   str = ""
    cedula:     str = ""
    telefono:   str = ""
    correo:     str = ""
    username:   str = ""
    contrasena: str = ""

    @property
    def es_valido(self) -> bool:
        return bool(
            self.nombre and self.apellido and self.cedula
            and self.telefono and self.correo and self.contrasena
        )

def registro(req) -> RegistroForm:
    d = _json(req)
    return RegistroForm(
        nombre=_str(d, "nombre"),
        apellido=_str(d, "apellido"),
        cedula=_str(d, "cedula"),
        telefono=_str(d, "telefono"),
        correo=_str(d, "correo", lower=True),
        username=_str(d, "username", lower=True),
        contrasena=_str(d, "contrasena"),
    )

@dataclass
class GoogleCredentialForm(_FormBase):
    credential: str = ""

    @property
    def es_valido(self) -> bool:
        return bool(self.credential)

def google_credential(req) -> GoogleCredentialForm:
    d = _json(req)
    return GoogleCredentialForm(
        credential=_str(d, "credential"),
    )

@dataclass
class PerfilForm(_FormBase):
    nombre:       str = ""
    apellido:     str = ""
    telefono:     str = ""
    correo:       str = ""
    direccion:    str = ""
    metodo_pago:  str = ""
    username:     str = ""
    fecha_nacimiento: str = ""

    @property
    def es_valido(self) -> bool:
        return bool(self.nombre or self.apellido or self.correo)

    def to_dict(self) -> dict[str, Any]:
        return {k: v for k, v in asdict(self).items() if v and not k.startswith("_")}

def perfil(req) -> PerfilForm:
    d = _json(req)
    if not d:
        d = req.form.to_dict() if hasattr(req, "form") else {}
    return PerfilForm(
        nombre=_str(d, "nombrePerfil", "nombre"),
        apellido=_str(d, "apellidoPerfil", "apellido"),
        telefono=_str(d, "telefonoPerfil", "telefono"),
        correo=_str(d, "correoPerfil", "correo", lower=True),
        direccion=_str(d, "direccionPerfil", "direccion"),
        metodo_pago=_str(d, "metodoPagoPerfil", "metodo_pago"),
        username=_str(d, "usernamePerfil", "username", lower=True),
        fecha_nacimiento=_str(d, "fecha_nacimiento"),
    )

@dataclass
class CambioContrasenaForm(_FormBase):
    actual:    str = ""
    nueva:     str = ""
    confirmar: str = ""

    @property
    def es_valido(self) -> bool:
        return bool(self.actual and self.nueva and self.confirmar)

    @property
    def nueva_coincide(self) -> bool:
        return self.nueva == self.confirmar

def cambio_contrasena(req) -> CambioContrasenaForm:
    d = _json(req)
    return CambioContrasenaForm(
        actual=_str(d, "actual", "contrasena_actual"),
        nueva=_str(d, "nueva", "nueva_contrasena", "contrasena"),
        confirmar=_str(d, "confirmar", "confirmar_contrasena"),
    )

@dataclass
class ProductoForm(_FormBase):
    nombre:      str   = ""
    descripcion: str   = ""
    precio:      float = 0.0
    activo:      bool  = True
    imagen_url:  str   = ""

    @property
    def es_valido(self) -> bool:
        return bool(self.nombre and self.precio > 0)

def producto(req) -> ProductoForm:
    d = _json(req)
    if not d:
        d = req.form.to_dict() if hasattr(req, "form") else {}
    return ProductoForm(
        nombre=_str(d, "nombre"),
        descripcion=_str(d, "descripcion"),
        precio=_float(d, "precio"),
        activo=_bool(d, "activo", default=True),
        imagen_url=_str(d, "imagen_url"),
    )

@dataclass
class AgregarCarritoForm(_FormBase):
    id_producto: str = ""
    cantidad:    int = 1

    @property
    def es_valido(self) -> bool:
        return bool(self.id_producto and self.cantidad > 0)

def agregar_carrito(req) -> AgregarCarritoForm:
    d = _json(req)
    return AgregarCarritoForm(
        id_producto=_str(d, "id_producto"),
        cantidad=_int(d, "cantidad", default=1),
    )

@dataclass
class AjustarCantidadForm(_FormBase):
    delta: int = 0

    @property
    def es_valido(self) -> bool:
        return self.delta in (1, -1)

def ajustar_cantidad(req) -> AjustarCantidadForm:
    d = _json(req)
    return AjustarCantidadForm(delta=_int(d, "delta"))

@dataclass
class FinalizarCompraForm(_FormBase):
    productos:    list = field(default_factory=list)
    metodo_pago:  str  = ""
    direccion:    str  = ""
    nota:         str  = ""

    @property
    def es_valido(self) -> bool:
        return bool(self.productos)

def finalizar_compra(req) -> FinalizarCompraForm:
    d = _json(req)
    return FinalizarCompraForm(
        productos=_list(d, "productos"),
        metodo_pago=_str(d, "metodo_pago"),
        direccion=_str(d, "direccion"),
        nota=_str(d, "nota"),
    )

@dataclass
class DescuentoCumpleanosForm(_FormBase):
    pct: float = 5.0

    @property
    def es_valido(self) -> bool:
        return 0.0 <= self.pct <= 100.0

def descuento_cumpleanos(req) -> DescuentoCumpleanosForm:
    d = _json(req)
    return DescuentoCumpleanosForm(pct=_float(d, "pct", default=5.0))

@dataclass
class ActualizarEstadoPedidoForm(_FormBase):
    estado:      str = ""
    id_pedidos:  list = field(default_factory=list)

    @property
    def es_valido(self) -> bool:
        return bool(self.estado)

def actualizar_estado_pedido(req) -> ActualizarEstadoPedidoForm:
    d = _json(req)
    return ActualizarEstadoPedidoForm(
        estado=_str(d, "estado", "nuevo_estado"),
        id_pedidos=_list(d, "id_pedidos"),
    )

@dataclass
class ActualizarPagoForm(_FormBase):
    pagado:     bool = False
    metodo_pago: str = ""

    @property
    def es_valido(self) -> bool:
        return True

def actualizar_pago(req) -> ActualizarPagoForm:
    d = _json(req)
    return ActualizarPagoForm(
        pagado=_bool(d, "pagado"),
        metodo_pago=_str(d, "metodo_pago"),
    )

@dataclass
class BuscarFacturasForm(_FormBase):
    q:      str = ""
    cedula: str = ""

    @property
    def es_valido(self) -> bool:
        return bool(self.q or self.cedula)

def buscar_facturas(req) -> BuscarFacturasForm:
    return BuscarFacturasForm(
        q=(req.args.get("q") or "").strip(),
        cedula=(req.args.get("cedula") or "").strip(),
    )

@dataclass
class BuscarFacturaPorNumeroForm(_FormBase):
    anio:   str = ""
    numero: str = ""

    @property
    def es_valido(self) -> bool:
        return bool(self.anio or self.numero)

def buscar_factura_por_numero(req) -> BuscarFacturaPorNumeroForm:
    return BuscarFacturaPorNumeroForm(
        anio=(req.args.get("anio") or "").strip(),
        numero=(req.args.get("numero") or "").strip(),
    )

@dataclass
class ActualizarEstadoFacturaForm(_FormBase):
    estado: str = ""

    @property
    def es_valido(self) -> bool:
        return bool(self.estado)

def actualizar_estado_factura(req) -> ActualizarEstadoFacturaForm:
    d = _json(req)
    return ActualizarEstadoFacturaForm(estado=_str(d, "estado"))

@dataclass
class MetodoPagoForm(_FormBase):
    nombre:      str  = ""
    descripcion: str  = ""
    activo:      bool = True

    @property
    def es_valido(self) -> bool:
        return bool(self.nombre)

def metodo_pago(req) -> MetodoPagoForm:
    d = _json(req)
    if not d:
        d = req.form.to_dict() if hasattr(req, "form") else {}
    return MetodoPagoForm(
        nombre=_str(d, "nombre"),
        descripcion=_str(d, "descripcion"),
        activo=_bool(d, "activo", default=True),
    )

@dataclass
class ComentarioForm(_FormBase):
    contenido:   str = ""
    calificacion: int = 5

    @property
    def es_valido(self) -> bool:
        return bool(self.contenido)

def comentario(req) -> ComentarioForm:
    d = _json(req)
    return ComentarioForm(
        contenido=_str(d, "contenido", "texto", "mensaje"),
        calificacion=max(1, min(5, _int(d, "calificacion", default=5))),
    )

@dataclass
class MensajePrivadoForm(_FormBase):
    mensaje:    str = ""
    destinatario: str = ""

    @property
    def es_valido(self) -> bool:
        return bool(self.mensaje)

def mensaje_privado(req) -> MensajePrivadoForm:
    d = _json(req)
    return MensajePrivadoForm(
        mensaje=_str(d, "mensaje", "contenido", "texto"),
        destinatario=_str(d, "destinatario", "cedula_destinatario"),
    )

@dataclass
class PublicidadForm(_FormBase):
    titulo:      str  = ""
    descripcion: str  = ""
    imagen_url:  str  = ""
    tipo:        str  = ""
    activo:      bool = True

    @property
    def es_valido(self) -> bool:
        return bool(self.titulo or self.imagen_url)

def publicidad(req) -> PublicidadForm:
    d = _json(req)
    if not d:
        d = req.form.to_dict() if hasattr(req, "form") else {}
    return PublicidadForm(
        titulo=_str(d, "titulo"),
        descripcion=_str(d, "descripcion"),
        imagen_url=_str(d, "imagen_url"),
        tipo=_str(d, "tipo"),
        activo=_bool(d, "activo", default=True),
    )

@dataclass
class NotificacionForm(_FormBase):
    titulo:   str  = ""
    mensaje:  str  = ""
    tipo:     str  = ""
    activo:   bool = True

    @property
    def es_valido(self) -> bool:
        return bool(self.titulo and self.mensaje)

def notificacion(req) -> NotificacionForm:
    d = _json(req)
    return NotificacionForm(
        titulo=_str(d, "titulo"),
        mensaje=_str(d, "mensaje", "contenido"),
        tipo=_str(d, "tipo"),
        activo=_bool(d, "activo", default=True),
    )

@dataclass
class ActualizarRolForm(_FormBase):
    cedula:    str = ""
    nuevo_rol: str = ""

    @property
    def es_valido(self) -> bool:
        return bool(self.cedula and self.nuevo_rol)

def actualizar_rol(req) -> ActualizarRolForm:
    d = _json(req)
    return ActualizarRolForm(
        cedula=_str(d, "cedula"),
        nuevo_rol=_str(d, "rol", "nuevo_rol", lower=True),
    )

@dataclass
class EliminarUsuarioForm(_FormBase):
    cedula: str = ""

    @property
    def es_valido(self) -> bool:
        return bool(self.cedula)

def eliminar_usuario(req) -> EliminarUsuarioForm:
    d = _json(req)
    return EliminarUsuarioForm(cedula=_str(d, "cedula"))

@dataclass
class ConfigInicioForm(_FormBase):
    titulo:          str = ""
    subtitulo:       str = ""
    descripcion:     str = ""
    color_primario:  str = ""
    mostrar_banner:  bool = True

    @property
    def es_valido(self) -> bool:
        return True

def config_inicio(req) -> ConfigInicioForm:
    d = _json(req)
    return ConfigInicioForm(
        titulo=_str(d, "titulo"),
        subtitulo=_str(d, "subtitulo"),
        descripcion=_str(d, "descripcion"),
        color_primario=_str(d, "color_primario"),
        mostrar_banner=_bool(d, "mostrar_banner", default=True),
    )

@dataclass
class ContadoresLogrosForm(_FormBase):
    contadores: dict = field(default_factory=dict)

    @property
    def es_valido(self) -> bool:
        return bool(self.contadores)

def contadores_logros(req) -> ContadoresLogrosForm:
    d = _json(req)
    contadores = d.get("contadores") if isinstance(d.get("contadores"), dict) else d
    return ContadoresLogrosForm(contadores=contadores or {})
