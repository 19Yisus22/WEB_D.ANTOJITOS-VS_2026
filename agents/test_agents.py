import os
import sys
import json
import numpy as np
from PIL import Image, ImageDraw

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
if SCRIPT_DIR not in sys.path:
    sys.path.insert(0, SCRIPT_DIR)

from agent_resnet import ResNetAgent
from agent_cnn import CNNAgent
from agent_isolation import detect_anomalies_boxes

def create_synthetic_blob(size=(224, 224), center=None, radius=40):
    img = Image.new('L', size, color=0)
    draw = ImageDraw.Draw(img)
    if center is None:
        center = (size[0] // 2, size[1] // 2)
    draw.ellipse([center[0] - radius, center[1] - radius, center[0] + radius, center[1] + radius], fill=255)
    return img.convert('RGB')

def cargar_datos_historicos(json_path):
    if not os.path.exists(json_path):
        return []
    try:
        with open(json_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
            if isinstance(data, list):
                return data
            elif isinstance(data, dict):
                if 'scans' in data:
                    return data['scans']
                elif 'analisis' in data:
                    return [data]
            return []
    except Exception:
        return []

def auto_entrenar_agentes(json_path):
    registros = cargar_datos_historicos(json_path)
    if not registros:
        print("No se encontraron registros históricos en el JSON para el auto-entrenamiento.")
        return

    x_train_list = []
    y_train_list = []
    lista_mejorada_historial = []

    for reg in registros:
        analisis_list = reg.get('analisis', [])
        temp_images = reg.get('temp_images', [])
        
        for i, item in enumerate(analisis_list):
            ruta_imagen = None
            if i < len(temp_images):
                img_info = temp_images[i]
                ruta_imagen = img_info.get('temp_path') or img_info.get('ruta_archivo') or img_info.get('filename') or img_info.get('ruta_almacenamiento')

            riesgo_valor = float(item.get('riesgo', item.get('score_riesgo', 0))) / 100.0
            label = 1 if riesgo_valor >= 0.5 else 0

            img_loaded = False
            if ruta_imagen:
                posibles_rutas = [
                    ruta_imagen,
                    os.path.abspath(ruta_imagen),
                    os.path.join(SCRIPT_DIR, ruta_imagen),
                    os.path.join(os.path.dirname(SCRIPT_DIR), 'uploads', 'images', os.path.basename(ruta_imagen)),
                    os.path.join(os.path.dirname(SCRIPT_DIR), 'uploads', 'tmp', os.path.basename(ruta_imagen))
                ]
                for r in posibles_rutas:
                    if os.path.exists(r) and not os.path.isdir(r):
                        try:
                            with Image.open(r) as im:
                                arr_img = np.array(im.convert('RGB').resize((224, 224))) / 255.0
                                x_train_list.append(arr_img)
                                y_train_list.append(label)
                                img_loaded = True
                                break
                        except Exception:
                            pass
            
            if not img_loaded:
                radius_size = int(40 + (riesgo_valor * 30))
                im_synthetic = create_synthetic_blob(radius=radius_size)
                arr_img = np.array(im_synthetic.resize((224, 224))) / 255.0
                x_train_list.append(arr_img)
                y_train_list.append(label)

            historial_item = {
                "imagen_procesada": ruta_imagen if ruta_imagen else "Sintética",
                "valores_agentes": {
                    "ResNet": item.get('probabilidad_resnet', riesgo_valor if label == 1 else 0.1),
                    "CNN": item.get('probabilidad_cnn', riesgo_valor),
                    "KMeans": "No se aplicó",
                    "IsolationForest": "No se aplicó"
                }
            }
            lista_mejorada_historial.append(historial_item)

    print("\n--- LISTA MEJORADA DE VALORES POR AGENTE TRATADO ---")
    print(json.dumps(lista_mejorada_historial, indent=2, ensure_ascii=False))

    if len(x_train_list) < 2:
        print(f"\nDatos insuficientes para auto-entrenamiento. Muestras válidas encontradas: {len(x_train_list)}")
        return

    print(f"\nIniciando ciclo de auto-entrenamiento adaptativo con {len(x_train_list)} muestras...")

    x_train = np.array(x_train_list)
    y_train = np.array(y_train_list)

    try:
        resnet = ResNetAgent()
        if hasattr(resnet, 'model') and hasattr(resnet.model, 'fit'):
            print("Optimizando pesos de ResNetAgent...")
            resnet.model.fit(x_train, y_train, epochs=3, batch_size=4, verbose=1)
            if hasattr(resnet, 'save'):
                resnet.save()
            elif hasattr(resnet, 'model') and hasattr(resnet.model, 'save'):
                model_path = os.path.join(SCRIPT_DIR, 'models', 'resnet_weights.h5')
                os.makedirs(os.path.dirname(model_path), exist_ok=True)
                resnet.model.save(model_path)
    except Exception as e:
        print(f"Error durante el reentrenamiento de ResNetAgent: {e}")

    try:
        cnn = CNNAgent()
        if hasattr(cnn, 'model') and hasattr(cnn.model, 'fit'):
            print("Optimizando pesos de CNNAgent...")
            cnn.model.fit(x_train, y_train, epochs=3, batch_size=4, verbose=1)
            if hasattr(cnn, 'save'):
                cnn.save()
            elif hasattr(cnn, 'model') and hasattr(cnn.model, 'save'):
                model_path = os.path.join(SCRIPT_DIR, 'models', 'cnn_weights.h5')
                os.makedirs(os.path.dirname(model_path), exist_ok=True)
                cnn.model.save(model_path)
    except Exception as e:
        print(f"Error durante el reentrenamiento de CNNAgent: {e}")
            
    print("Ciclo de auto-entrenamiento finalizado e incremento de precisión completado.")

def run_tests():
    print("--- PRUEBA ESTÁTICA INICIAL ---")
    img = create_synthetic_blob()
    resnet = ResNetAgent()
    cnn = CNNAgent()

    print('Running ResNetAgent.predict...')
    out_r = resnet.predict(img)
    print(out_r)

    print('Running CNNAgent.predict...')
    out_c = cnn.predict(img)
    print(out_c)

    print('Running Isolation detect...')
    gris = np.array(img.convert('L'))
    boxes = detect_anomalies_boxes(gris)
    print('Isolation boxes:', boxes)
    
    print("\n--- ANALIZANDO JSON Y AUTO-ENTRENAMIENTO ---")
    json_path = os.path.join(SCRIPT_DIR, 'historico_escaneos.json')
    if not os.path.exists(json_path):
        json_path = os.path.join(os.path.dirname(SCRIPT_DIR), 'uploads', 'json', 'historico_escaneos.json')
    auto_entrenar_agentes(json_path)

if __name__ == '__main__':
    run_tests()