import json
import logging
import os
from datetime import datetime, timezone
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

url = os.getenv("SUPABASE_URL")
key = os.getenv("SUPABASE_KEY")
service_key = os.getenv("SUPABASE_SERVICE_KEY")

supabase: Client | None = None
supabase_admin: Client | None = None

if url and key:
    supabase = create_client(url, key)
else:
    logging.warning("Supabase no configurado")

if url and service_key:
    supabase_admin = create_client(url, service_key)


def _handle_response(response, expect_single=False):
    if response is None:
        return {"error": "Sin respuesta de Supabase"} if expect_single else []
    try:
        resp_err = getattr(response, "error", None)
        resp_data = getattr(response, "data", None)
        if resp_err:
            message = (
                resp_err.get("message")
                if isinstance(resp_err, dict)
                else getattr(resp_err, "message", str(resp_err))
            )
            return {"error": message} if expect_single else []
        if expect_single:
            if isinstance(resp_data, list):
                return resp_data[0] if resp_data else {"error": "No se devolvieron datos"}
            return resp_data
        return resp_data or []
    except Exception as exc:
        logging.exception("Error al procesar respuesta de Supabase")
        return {"error": str(exc)} if expect_single else []


def get_usuario_por_cedula(cedula: str):
    if supabase is None:
        return None
    try:
        response = (supabase_admin or supabase).table("usuarios").select("*").eq("cedula", cedula).execute()
        result = _handle_response(response, expect_single=False)
        return result[0] if isinstance(result, list) and result else None
    except Exception:
        logging.exception("Error al obtener usuario por cedula")
        return None


def get_usuario_por_correo(correo: str):
    if supabase is None:
        return None
    try:
        response = (supabase_admin or supabase).table("usuarios").select("*").eq("correo", correo).execute()
        result = _handle_response(response, expect_single=False)
        return result[0] if isinstance(result, list) and result else None
    except Exception:
        logging.exception("Error al obtener usuario por correo")
        return None


def crear_usuario(data: dict):
    if supabase is None:
        return {"error": "Supabase no configurado"}
    try:
        client = supabase_admin or supabase
        if not data.get("cedula"):
            return {"error": "La cedula es requerida para crear el usuario"}
        data.setdefault("creado_en", datetime.now(timezone.utc).isoformat())
        response = client.table("usuarios").insert(data).execute()
        return _handle_response(response, expect_single=True)
    except Exception as exc:
        logging.exception("Error al crear usuario")
        return {"error": str(exc)}


def actualizar_usuario(cedula: str, data: dict):
    if supabase is None:
        return {"error": "Supabase no configurado"}
    try:
        client = supabase_admin or supabase
        data["actualizado_en"] = datetime.now(timezone.utc).isoformat()
        response = client.table("usuarios").update(data).eq("cedula", cedula).execute()
        return _handle_response(response, expect_single=True)
    except Exception as exc:
        logging.exception("Error al actualizar usuario")
        return {"error": str(exc)}


def obtener_usuarios_por_nombre(nombre: str):
    if supabase is None:
        return []
    try:
        response = (
            (supabase_admin or supabase).table("usuarios")
            .select("*")
            .ilike("nombre_completo", f"%{nombre}%")
            .execute()
        )
        return _handle_response(response, expect_single=False) or []
    except Exception:
        logging.exception("Error al obtener usuarios por nombre")
        return []


def get_paciente_por_cedula(cedula: str):
    if supabase is None:
        return None
    try:
        response = (supabase_admin or supabase).table("pacientes").select("*").eq("cedula", cedula).execute()
        result = _handle_response(response, expect_single=False)
        return result[0] if isinstance(result, list) and result else None
    except Exception:
        logging.exception("Error al obtener paciente por cedula")
        return None


def crear_paciente(data: dict):
    if supabase is None:
        return {"error": "Supabase no configurado"}
    try:
        client = supabase_admin or supabase
        if not data.get("cedula"):
            return {"error": "La cedula es requerida para crear el paciente"}
        data.setdefault("creado_en", datetime.now(timezone.utc).isoformat())
        response = client.table("pacientes").upsert(data).execute()
        return _handle_response(response, expect_single=True)
    except Exception as exc:
        logging.exception("Error al crear paciente")
        return {"error": str(exc)}


def actualizar_paciente(cedula: str, data: dict):
    if supabase is None:
        return {"error": "Supabase no configurado"}
    try:
        client = supabase_admin or supabase
        data["actualizado_en"] = datetime.now(timezone.utc).isoformat()
        response = client.table("pacientes").update(data).eq("cedula", cedula).execute()
        return _handle_response(response, expect_single=True)
    except Exception as exc:
        logging.exception("Error al actualizar paciente")
        return {"error": str(exc)}


def crear_o_actualizar_estudio(data: dict):
    if supabase is None:
        return {"error": "Supabase no configurado"}
    try:
        client = supabase_admin or supabase
        cedula = data.get("cedula_paciente") or data.get("cedula")
        if not cedula:
            return {"error": "cedula es requerida para el estudio"}
        
        data["cedula_paciente"] = cedula

        uid = data.get("uid_instancia_estudio")
        if uid:
            response = (supabase_admin or supabase).table("estudios").select("*").eq("uid_instancia_estudio", uid).execute()
            existing = _handle_response(response, expect_single=False)
            if isinstance(existing, list) and existing:
                response = client.table("estudios").update(data).eq("uid_instancia_estudio", uid).execute()
                return _handle_response(response, expect_single=True)

        existing_by_cedula = (supabase_admin or supabase).table("estudios").select("cedula_paciente").eq("cedula_paciente", cedula).execute()
        found = _handle_response(existing_by_cedula, expect_single=False)
        if isinstance(found, list) and found:
            response = client.table("estudios").update(data).eq("cedula_paciente", cedula).execute()
            return _handle_response(response, expect_single=True)

        data.setdefault("creado_en", datetime.now(timezone.utc).isoformat())
        response = client.table("estudios").insert(data).execute()
        return _handle_response(response, expect_single=True)
    except Exception as exc:
        logging.exception("Error al crear o actualizar estudio")
        return {"error": str(exc)}


def fetch_estudios_por_cedula(cedula: str):
    if supabase is None:
        return []
    try:
        response = (supabase_admin or supabase).table("estudios").select("*").eq("cedula_paciente", cedula).execute()
        return _handle_response(response, expect_single=False) or []
    except Exception:
        logging.exception("Error al obtener estudios por cedula")
        return []


def crear_imagen_medica(data: dict):
    if supabase is None:
        return {"error": "Supabase no configurado"}
    try:
        client = supabase_admin or supabase
        cedula = data.get("cedula_paciente") or data.get("cedula")
        if cedula:
            data["cedula_paciente"] = cedula
        response = client.table("imagenes_medicas").insert(data).execute()
        return _handle_response(response, expect_single=True)
    except Exception as exc:
        logging.exception("Error al crear imagen medica")
        return {"error": str(exc)}


def obtener_imagenes_medicas(cedula: str = None, limit: int = 100, offset: int = 0):
    if supabase is None:
        return []
    try:
        query = (supabase_admin or supabase).table("imagenes_medicas").select("*")
        if cedula:
            query = query.eq("cedula_paciente", cedula)
        response = query.order("subido_en", desc=True).range(offset, offset + limit - 1).execute()
        return _handle_response(response, expect_single=False) or []
    except Exception:
        logging.exception("Error al obtener imagenes medicas")
        return []


def eliminar_imagen_medica(imagen_id: str):
    if supabase is None:
        return {"error": "Supabase no configurado"}
    try:
        client = supabase_admin or supabase
        response = client.table("imagenes_medicas").delete().eq("id", imagen_id).execute()
        return _handle_response(response, expect_single=True)
    except Exception as exc:
        logging.exception("Error al eliminar imagen medica")
        return {"error": str(exc)}


def crear_linea_analisis(data: dict):
    if supabase is None:
        return {"error": "Supabase no configurado"}
    try:
        client = supabase_admin or supabase
        cedula = data.get("cedula_paciente") or data.get("cedula")
        if cedula:
            data["cedula_paciente"] = cedula
        response = client.table("lineas_analisis").insert(data).execute()
        return _handle_response(response, expect_single=True)
    except Exception as exc:
        logging.exception("Error al crear linea analisis")
        return {"error": str(exc)}


def actualizar_linea_analisis(linea_id: str, data: dict):
    if supabase is None:
        return {"error": "Supabase no configurado"}
    try:
        client = supabase_admin or supabase
        data["actualizado_en"] = datetime.now(timezone.utc).isoformat()
        response = client.table("lineas_analisis").update(data).eq("id", linea_id).execute()
        return _handle_response(response, expect_single=True)
    except Exception as exc:
        logging.exception("Error al actualizar linea analisis")
        return {"error": str(exc)}


def crear_prediccion_ia(data: dict):
    if supabase is None:
        return {"error": "Supabase no configurado"}
    try:
        client = supabase_admin or supabase
        cedula = data.get("cedula_paciente") or data.get("cedula")
        if cedula:
            data["cedula_paciente"] = cedula
        response = client.table("predicciones_ia").insert(data).execute()
        return _handle_response(response, expect_single=True)
    except Exception as exc:
        logging.exception("Error al crear prediccion ia")
        return {"error": str(exc)}


def crear_reporte_medico(data: dict):
    if supabase is None:
        return {"error": "Supabase no configurado"}
    try:
        client = supabase_admin or supabase
        cedula = data.get("cedula_paciente") or data.get("cedula")
        if cedula:
            data["cedula_paciente"] = cedula
        response = client.table("reportes_medicos").insert(data).execute()
        return _handle_response(response, expect_single=True)
    except Exception as exc:
        logging.exception("Error al crear reporte medico")
        return {"error": str(exc)}


def obtener_reporte_medico_por_id(reporte_id: str):
    if supabase is None:
        return None
    try:
        response = (
            (supabase_admin or supabase).table("reportes_medicos")
            .select("*, estudios(*), predicciones_ia(*)")
            .eq("id", reporte_id)
            .execute()
        )
        result = _handle_response(response, expect_single=False)
        return result[0] if isinstance(result, list) and result else None
    except Exception:
        logging.exception("Error al obtener reporte medico por id")
        return None


def obtener_reportes_medicos(cedula: str = None, nombre: str = None, limit: int = 100, offset: int = 0):
    if supabase is None:
        return []
    try:
        query = (supabase_admin or supabase).table("reportes_medicos").select("*, estudios(*), predicciones_ia(*)")
        if cedula:
            query = query.eq("cedula_paciente", cedula)
        elif nombre:
            usuarios = obtener_usuarios_por_nombre(nombre)
            cedulas = [u.get("cedula") for u in usuarios if u.get("cedula")]
            if not cedulas:
                return []
            query = query.in_("cedula_paciente", cedulas)
        response = query.order("creado_en", desc=True).range(offset, offset + limit - 1).execute()
        return _handle_response(response, expect_single=False) or []
    except Exception:
        logging.exception("Error al obtener reportes medicos")
        return []


def eliminar_reporte_medico(reporte_id: str):
    if supabase is None:
        return {"error": "Supabase no configurado"}
    try:
        client = supabase_admin or supabase
        response = client.table("reportes_medicos").delete().eq("id", reporte_id).execute()
        return _handle_response(response, expect_single=True)
    except Exception as exc:
        logging.exception("Error al eliminar reporte medico")
        return {"error": str(exc)}


def eliminar_resultado_completo(reporte_id: str):
    if supabase is None:
        return {"error": "Supabase no configurado"}
    try:
        client = supabase_admin or supabase

        response = (
            (supabase_admin or supabase).table("reportes_medicos")
            .select("*, predicciones_ia(*)")
            .eq("id", reporte_id)
            .execute()
        )
        reportes = _handle_response(response, expect_single=False)
        if not reportes:
            return {"error": "Reporte no encontrado"}

        reporte = reportes[0]
        cedula_paciente = reporte.get("cedula_paciente")

        predicciones = reporte.get("predicciones_ia") or []
        if isinstance(predicciones, dict):
            predicciones = [predicciones]

        if cedula_paciente:
            client.table("imagenes_medicas").delete().eq("cedula_paciente", cedula_paciente).execute()
            client.table("lineas_analisis").delete().eq("cedula_paciente", cedula_paciente).execute()

        for prediccion in predicciones:
            pred_id = prediccion.get("id")
            if pred_id:
                client.table("predicciones_ia").delete().eq("id", pred_id).execute()

        response_delete = client.table("reportes_medicos").delete().eq("id", reporte_id).execute()
        return _handle_response(response_delete, expect_single=True)
    except Exception as exc:
        logging.exception("Error al eliminar resultado completo")
        return {"error": str(exc)}


def crear_importacion_excel(datos: dict):
    if supabase is None:
        return {"error": "Supabase no configurado"}
    try:
        client = supabase_admin or supabase
        cedula = datos.get("usuario_cedula") or datos.get("cedula_usuario") or datos.get("cedula")
        data = {
            "nombre_archivo": datos.get("nombre_archivo") or datos.get("file_name"),
            "ruta_almacenamiento_xlsx": datos.get("ruta_almacenamiento_xlsx") or datos.get("storage_path"),
            "total_registros_entrenamiento": datos.get("total_registros_entrenamiento") or datos.get("total_records_processed"),
            "metadatos_importacion": datos.get("metadatos_importacion") or datos.get("import_metadata"),
            "usuario_cedula": cedula,
            "importado_en": datos.get("importado_en") or datetime.now(timezone.utc).isoformat()
        }
        response = client.table("importaciones_excel").insert(data).execute()
        return response.data[0] if response.data else response.data
    except Exception as e:
        logging.error("Error al crear importacion excel: %s", str(e))
        return {"error": str(e)}


def obtener_importaciones_excel(limit: int = 100):
    if supabase is None:
        return []
    try:
        response = (
            (supabase_admin or supabase).table("importaciones_excel")
            .select("*")
            .order("importado_en", desc=True)
            .limit(limit)
            .execute()
        )
        return _handle_response(response, expect_single=False) or []
    except Exception:
        logging.exception("Error al obtener importaciones excel")
        return []

def get_usuario(cedula: str):
    return get_usuario_por_cedula(cedula)

def get_user_by_email(correo: str):
    return get_usuario_por_correo(correo)

def create_user(data: dict):
    return crear_usuario(data)

def update_user(cedula: str, data: dict):
    return actualizar_usuario(cedula, data)

def get_patient(cedula: str):
    return get_paciente_por_cedula(cedula)

def create_patient(data: dict):
    return crear_paciente(data)

def update_patient(cedula: str, data: dict):
    return actualizar_paciente(cedula, data)

def create_or_update_study(data: dict):
    return crear_o_actualizar_estudio(data)

def fetch_studies_by_patient(cedula: str):
    return fetch_estudios_por_cedula(cedula)

def create_medical_image(data: dict):
    return crear_imagen_medica(data)

def fetch_medical_images(cedula: str = None, limit: int = 100, offset: int = 0):
    return obtener_imagenes_medicas(cedula, limit, offset)

def delete_medical_image(imagen_id: str):
    return eliminar_imagen_medica(imagen_id)

def create_analysis_pipeline(data: dict):
    return crear_linea_analisis(data)

def update_analysis_pipeline(linea_id: str, data: dict):
    return actualizar_linea_analisis(linea_id, data)

def create_ai_prediction(data: dict):
    return crear_prediccion_ia(data)

def create_medical_report(data: dict):
    return crear_reporte_medico(data)

def fetch_medical_report_by_id(reporte_id: str):
    return obtener_reporte_medico_por_id(reporte_id)

def fetch_medical_reports(cedula: str = None, nombre: str = None, limit: int = 100):
    return obtener_reportes_medicos(cedula, nombre, limit)

def delete_medical_report(reporte_id: str):
    return eliminar_reporte_medico(reporte_id)

def delete_full_medical_report(reporte_id: str):
    return eliminar_resultado_completo(reporte_id)

def create_spreadsheet_import(data: dict):
    return crear_importacion_excel(data)

def fetch_training_runs(limit: int = 100):
    return obtener_importaciones_excel(limit)

def obtener_prediccion_por_id(pred_id: str):
    if supabase is None:
        return None
    try:
        response = (supabase_admin or supabase).table("predicciones_ia").select("*").eq("id", pred_id).execute()
        result = _handle_response(response, expect_single=False)
        return result[0] if isinstance(result, list) and result else None
    except Exception:
        logging.exception("Error al obtener prediccion por id")
        return None


def obtener_linea_por_id(linea_id: str):
    if supabase is None:
        return None
    try:
        response = (supabase_admin or supabase).table("lineas_analisis").select("*").eq("id", linea_id).execute()
        result = _handle_response(response, expect_single=False)
        return result[0] if isinstance(result, list) and result else None
    except Exception:
        logging.exception("Error al obtener linea analisis por id")
        return None


def obtener_imagen_por_id(imagen_id: str):
    if supabase is None:
        return None
    try:
        response = (supabase_admin or supabase).table("imagenes_medicas").select("*").eq("id", imagen_id).execute()
        result = _handle_response(response, expect_single=False)
        return result[0] if isinstance(result, list) and result else None
    except Exception:
        logging.exception("Error al obtener imagen medica por id")
        return None


def obtener_estudio_por_cedula(cedula: str):
    if supabase is None:
        return None
    try:
        response = (
            (supabase_admin or supabase).table("estudios").select("*").eq("cedula_paciente", cedula)
            .order("creado_en", desc=True).limit(1).execute()
        )
        result = _handle_response(response, expect_single=False)
        return result[0] if isinstance(result, list) and result else None
    except Exception:
        logging.exception("Error al obtener estudio por cedula")
        return None


def obtener_lineas_por_cedula(cedula: str, limit: int = 20):
    if supabase is None:
        return []
    try:
        response = (
            (supabase_admin or supabase).table("lineas_analisis").select("*").eq("cedula_paciente", cedula)
            .order("creado_en", desc=True).limit(limit).execute()
        )
        return _handle_response(response, expect_single=False) or []
    except Exception:
        logging.exception("Error al obtener lineas por cedula")
        return []


def obtener_reportes_completos_por_cedula(cedula: str, limit: int = 50):
    if supabase is None:
        return []
    try:
        response = (
            (supabase_admin or supabase).table("reportes_medicos")
            .select("*, predicciones_ia(*)")
            .eq("cedula_paciente", cedula)
            .order("creado_en", desc=True)
            .limit(limit)
            .execute()
        )
        return _handle_response(response, expect_single=False) or []
    except Exception:
        logging.exception("Error al obtener reportes completos por cedula")
        return []


def eliminar_importacion_excel(importacion_id: str):
    if supabase is None:
        return {"error": "Supabase no configurado"}
    try:
        client = supabase_admin or supabase
        response = client.table("importaciones_excel").delete().eq("id", importacion_id).execute()
        return {"ok": True}
    except Exception as e:
        logging.error("Error al eliminar importacion excel: %s", str(e))
        return {"error": str(e)}

def listar_todos_usuarios(limit: int = 300):
    if supabase is None:
        return []
    try:
        response = (
            (supabase_admin or supabase).table("usuarios")
            .select("cedula,nombre_completo,correo,rol,edad,telefono,esta_activo,creado_en")
            .order("creado_en", desc=True)
            .limit(limit)
            .execute()
        )
        return _handle_response(response, expect_single=False) or []
    except Exception:
        logging.exception("Error al listar todos los usuarios")
        return []


def actualizar_rol_usuario(cedula: str, nuevo_rol: str):
    if supabase is None:
        return {"error": "Supabase no configurado"}
    try:
        client = supabase_admin or supabase
        response = client.table("usuarios").update({
            "rol": nuevo_rol,
            "actualizado_en": datetime.now(timezone.utc).isoformat(),
        }).eq("cedula", cedula).execute()
        return _handle_response(response, expect_single=True)
    except Exception as exc:
        logging.exception("Error al actualizar rol de usuario")
        return {"error": str(exc)}


def eliminar_usuario_completo(cedula: str):
    if supabase is None:
        return {"error": "Supabase no configurado"}
    try:
        client = supabase_admin or supabase
        client.table("pacientes").delete().eq("cedula", cedula).execute()
        client.table("usuarios").delete().eq("cedula", cedula).execute()
        return {"ok": True}
    except Exception as exc:
        logging.exception("Error al eliminar usuario")
        return {"error": str(exc)}
