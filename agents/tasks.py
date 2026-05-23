import json
import logging
import os
from datetime import datetime
import numpy as np
from agents.analyzer import entrenar_modelo_keras, guardar_archivo_local
from utils.supabase_client import crear_importacion_excel


def _parse_training_json(parsed_data):
    if isinstance(parsed_data, dict) and 'training_data' in parsed_data:
        parsed_data = parsed_data['training_data']
    if not isinstance(parsed_data, list):
        return None, None
    x_list = []
    y_list = []
    for item in parsed_data:
        if not isinstance(item, dict):
            continue
        label = item.get('label') if item.get('label') is not None else item.get('target')
        features = item.get('features') or item.get('pixels') or item.get('values')
        if label is None or features is None:
            features_from_agents = _extraer_features_agentes(item)
            if features_from_agents:
                features = features_from_agents
            else:
                continue
        arr = np.asarray(features, dtype=np.float32)
        if arr.ndim == 1:
            x_list.append(arr.reshape(1, -1))
        elif arr.ndim == 2:
            x_list.append(arr.reshape(1, arr.shape[0] * arr.shape[1]))
        else:
            x_list.append(arr.reshape(1, -1))
        y_list.append(1.0 if str(label).lower() in {'1', 'true', 'maligna', 'maligno', 'positivo', 'yes'} else 0.0)
    if not x_list:
        return None, None
    return np.vstack(x_list), np.asarray(y_list, dtype=np.float32)


def _extraer_features_agentes(item):
    agentes = item.get('agentes', {})
    if not agentes:
        return None
    resnet = agentes.get('ResNet', {}) if isinstance(agentes, dict) else {}
    cnn = agentes.get('CNN', {}) if isinstance(agentes, dict) else {}
    kmeans = agentes.get('KMeans', {}) if isinstance(agentes, dict) else {}
    isolation = agentes.get('IsolationForest', {}) if isinstance(agentes, dict) else {}
    return [
        float(item.get('intensidad_media', 0.0)),
        float(item.get('contraste', 0.0)),
        float(resnet.get('probabilidad', 0.0)),
        float(cnn.get('probabilidad', 0.0)),
        float(kmeans.get('clusters_detectados', 0)) / 10.0,
        float(isolation.get('anomalias_detectadas', 0)) / 10.0,
        float(item.get('regiones_detectadas', 0)) / 10.0,
        float(item.get('probabilidad_malignidad', 0.0)),
    ]


def train_job(path, parsed_data, fname, usuario_cedula=None):
    try:
        training_data = None
        record_count = 1
        lista_mejorada_agentes = []

        if isinstance(parsed_data, (dict, list)):
            x, y = _parse_training_json(parsed_data)
            if x is not None and y is not None:
                training_data = {'x': x, 'y': y}
                record_count = x.shape[0]

            records_iterable = parsed_data if isinstance(parsed_data, list) else parsed_data.get('training_data', [])
            for idx, item in enumerate(records_iterable):
                if not isinstance(item, dict):
                    continue
                agentes = item.get('agentes', {}) or {}
                resnet = agentes.get('ResNet', {}) if isinstance(agentes, dict) else {}
                cnn_ag = agentes.get('CNN', {}) if isinstance(agentes, dict) else {}
                kmeans_ag = agentes.get('KMeans', {}) if isinstance(agentes, dict) else {}
                isolation_ag = agentes.get('IsolationForest', {}) if isinstance(agentes, dict) else {}
                keras_ag = agentes.get('Keras_InceptionResNetV2', {}) if isinstance(agentes, dict) else {}

                lista_mejorada_agentes.append({
                    'id_muestra': idx + 1,
                    'label': item.get('label', 'NORMAL'),
                    'valores_agentes': {
                        'ResNet': resnet.get('probabilidad', 'No se aplicó'),
                        'CNN': cnn_ag.get('probabilidad', 'No se aplicó'),
                        'KMeans': kmeans_ag.get('clusters_detectados', 'No se aplicó'),
                        'IsolationForest': isolation_ag.get('anomalias_detectadas', 'No se aplicó'),
                        'Keras': keras_ag.get('score_final', 'No se aplicó'),
                    },
                    'features': item.get('features', []),
                    'probabilidad_malignidad': item.get('probabilidad_malignidad', 0.0),
                })

            if not records_iterable and isinstance(parsed_data, list):
                record_count = len(parsed_data)

        history = entrenar_modelo_keras(epochs=5, training_data=training_data)

        historial_final_json = {
            'training_history': history,
            'agentes_escaneo_historial': lista_mejorada_agentes,
            'total_muestras': record_count,
            'modelo': 'InceptionResNetV2 + CNN + KMeans + IsolationForest',
        }

        crear_importacion_excel({
            'usuario_cedula': usuario_cedula,
            'nombre_archivo': fname,
            'ruta_almacenamiento_xlsx': path,
            'total_registros_entrenamiento': record_count,
            'importado_en': datetime.utcnow().isoformat(),
            'metadatos_importacion': historial_final_json,
        })
    except Exception:
        logging.exception('Error durante autoentrenamiento (task)')
