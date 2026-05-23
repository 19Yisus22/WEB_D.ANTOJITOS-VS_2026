import re
from datetime import datetime


def validate_email(email: str) -> bool:
    if not email:
        return False
    pattern = r"^[\w\.-]+@[\w\.-]+\.\w{2,}$"
    return re.match(pattern, email) is not None


def validate_cedula(cedula: str) -> bool:
    if not cedula:
        return False
    return re.match(r"^[0-9A-Za-z\-]{4,50}$", cedula) is not None


def validate_usuario(data: dict):
    correo = data.get('correo', '')
    cedula = data.get('cedula', '')
    nombre = data.get('nombre_completo', '')
    if not validate_cedula(cedula):
        return False, 'Cédula inválida.'
    if not validate_email(correo):
        return False, 'Correo electrónico inválido.'
    if not nombre or len(nombre) < 3:
        return False, 'Nombre completo inválido.'
    return True, None


def validate_paciente(data: dict):
    cedula = data.get('cedula', '')
    sexo = data.get('sexo', 'F')
    fecha = data.get('fecha_nacimiento')
    if not validate_cedula(cedula):
        return False, 'Cédula inválida para paciente.'
    if sexo not in ('O', 'F', 'M'):
        return False, 'Sexo inválido.'
    if fecha:
        try:
            if isinstance(fecha, str):
                datetime.fromisoformat(fecha)
        except Exception:
            return False, 'Fecha de nacimiento inválida.'
    return True, None


def validate_estudio(data: dict):
    cedula = data.get('cedula_paciente', '')
    uid = data.get('uid_instancia_estudio', '')
    if not validate_cedula(cedula):
        return False, 'Cédula inválida para estudio.'
    if not uid or len(uid) < 8:
        return False, 'UID de estudio inválido.'
    return True, None
