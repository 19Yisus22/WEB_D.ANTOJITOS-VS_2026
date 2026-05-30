import re


def is_valid_name(value: str) -> bool:
    if not value or not isinstance(value, str):
        return False
    v = value.strip()
    return bool(re.fullmatch(r"[A-Za-zÁÉÍÓÚáéíóúÑñ\s\-\.]{1,50}", v))


def is_valid_numeric(value: str, min_len: int = 7, max_len: int = 15) -> bool:
    if not value or not isinstance(value, str):
        return False
    v = value.strip()
    return bool(re.fullmatch(r"\d+", v)) and min_len <= len(v) <= max_len


def is_valid_email(value: str, max_len: int = 150) -> bool:
    if not value or not isinstance(value, str):
        return False
    v = value.strip()
    if len(v) < 5 or len(v) > max_len:
        return False
    return bool(re.fullmatch(r"[A-Za-z0-9._%+\-]+@[A-Za-z0-9\-]+(\.[A-Za-z0-9\-]+)*\.[A-Za-z]{2,}", v))


def is_valid_password(value: str) -> bool:
    if not value or not isinstance(value, str):
        return False
    return len(value) >= 5 and bool(re.search(r"[A-Za-z0-9_*+\-.@$%&]", value))


def is_valid_username(value: str) -> bool:
    if not value or not isinstance(value, str):
        return False
    return bool(re.fullmatch(r"[A-Za-z0-9@#$%&*]{3,30}", value.strip()))


METODOS_PAGO_VALIDOS = ("Efectivo", "Transferencia")
ESTADOS_PEDIDO       = ("Pendiente", "Enviado", "Entregado", "Cancelado")
ESTADOS_FACTURA      = ("Emitida", "Anulada", "Pagada")
ENTIDADES_PAGO       = ("Nequi", "Daviplata", "Bancolombia", "NuBank")
TIPOS_CUENTA         = ("Billetera Digital", "Ahorros", "Corriente")
TIPOS_PUBLICIDAD     = ("carrusel", "seccion", "notificacion", "cinta", "login_slide", "inicio_cinta")
