import argparse
import os
from pathlib import Path
import json
import numpy as np
from PIL import Image
import cv2
import matplotlib.pyplot as plt
from agents.agent_resnet import ResNetAgent
from agents.agent_cnn import CNNAgent
from agents.agent_kmeans import segment_kmeans
from agents.agent_isolation import detect_anomalies_boxes
import pydicom

class AnalizadorImagenes:
    def __init__(self):
        self.resnet_agent = ResNetAgent()
        self.cnn_agent = CNNAgent()
        self.kmeans_clusters = 6

    def _leer_dicom(self, ruta):
        ds = pydicom.dcmread(ruta, force=True)
        if not hasattr(ds, 'PixelData') or len(ds.PixelData) == 0:
            raise ValueError('El archivo DICOM no contiene PixelData')
        return ds

    def _normalizar(self, imagen):
        img = imagen.astype(np.float32)
        minimo, maximo = img.min(), img.max()
        if maximo - minimo <= 0:
            return np.zeros_like(img, dtype=np.uint8)
        normalizado = (img - minimo) / (maximo - minimo)
        return (normalizado * 255).astype(np.uint8)

    def _cargar_imagen(self, ruta):
        extension = Path(ruta).suffix.lower()
        if extension == '.dcm':
            ds = self._leer_dicom(ruta)
            pixeles = ds.pixel_array
            if pixeles.ndim > 2:
                pixeles = pixeles[0]
            normalizado = self._normalizar(pixeles)
            rgb = np.stack([normalizado, normalizado, normalizado], axis=-1)
            return Image.fromarray(rgb), normalizado
        imagen = Image.open(ruta)
        if imagen.mode != 'RGB':
            imagen = imagen.convert('RGB')
        gris = np.array(imagen.convert('L'))
        normalizado = self._normalizar(gris)
        return imagen, normalizado

    def _extraer_probabilidades(self, imagen):
        resnet_out = self.resnet_agent.predict(imagen)
        cnn_out = self.cnn_agent.predict(imagen)
        return resnet_out, cnn_out

    def _risk_label(self, score):
        if score >= 0.8:
            return 'MALIGNA'
        if score >= 0.35:
            return 'BENIGNA'
        return 'NORMAL'

    def analizar(self, ruta_archivo, output_dir='analysis_output'):
        os.makedirs(output_dir, exist_ok=True)
        imagen, gris = self._cargar_imagen(ruta_archivo)
        resnet_out, cnn_out = self._extraer_probabilidades(imagen)
        anomaly_boxes = detect_anomalies_boxes(gris)
        kmeans_map = segment_kmeans(gris, n_clusters=self.kmeans_clusters)
        
        score = float(np.mean([resnet_out.get('probability', 0.0), cnn_out.get('probability', 0.0)]))
        patologia = self._risk_label(score)
        
        summary = {
            'probabilidad_promedio': round(score * 100, 2),
            'nivel_riesgo': patologia,
            'regiones_detectadas': len(anomaly_boxes),
            'kmeans_clusters': self.kmeans_clusters,
            'intensidad_media': round(float(np.mean(gris) / 255.0), 4),
            'contraste': round(float(np.std(gris) / 255.0), 4),
        }
        
        self._guardar_imagenes(ruta_archivo, imagen, gris, kmeans_map, anomaly_boxes, output_dir)
        
        ruta_calor_resnet = os.path.join(output_dir, f'{Path(ruta_archivo).stem}_original.png')
        kmeans_map_path = os.path.join(output_dir, f'{Path(ruta_archivo).stem}_kmeans.png')
        
        unique_centroids = [list(map(int, c)) for c in np.argwhere(kmeans_map == (self.kmeans_clusters // 2))[:10]]
        
        resultado = {
            'archivo': ruta_archivo,
            'tipo': Path(ruta_archivo).suffix.lower().lstrip('.'),
            'probabilidad': round(score, 6),
            'nivel_riesgo': patologia,
            'summary': summary,
            'detalles_agentes': [
                {'agente': 'ResNet', 'probabilidad': round(float(resnet_out.get('probability', 0.0)), 6), 'boxes': resnet_out.get('boxes', [])},
                {'agente': 'CNN', 'probabilidad': round(float(cnn_out.get('probability', 0.0)), 6), 'boxes': cnn_out.get('boxes', [])},
                {'agente': 'KMeans', 'probabilidad': None, 'centroides': unique_centroids},
                {'agente': 'IsolationForest', 'probabilidad': None, 'boxes': anomaly_boxes}
            ],
            'cajas_delimitadoras_cnn': cnn_out.get('boxes', []),
            'centroides_kmeans': unique_centroids,
            'ruta_mapa_calor_resnet': ruta_calor_resnet,
            'anomaly_boxes': anomaly_boxes,
            'kmeans_map_path': kmeans_map_path,
        }
        return resultado

    def _guardar_imagenes(self, ruta_archivo, imagen, gris, kmeans_map, anomaly_boxes, output_dir):
        nombre = Path(ruta_archivo).stem
        try:
            imagen.save(os.path.join(output_dir, f'{nombre}_original.png'))
        except Exception:
            pass
        try:
            plt.imsave(os.path.join(output_dir, f'{nombre}_kmeans.png'), kmeans_map, cmap='viridis')
            if anomaly_boxes:
                colored = self._draw_boxes(gris, anomaly_boxes)
                plt.imsave(os.path.join(output_dir, f'{nombre}_anomaly.png'), colored)
            else:
                plt.imsave(os.path.join(output_dir, f'{nombre}_anomaly.png'), gris, cmap='gray')
        except Exception:
            pass

    def _draw_boxes(self, imagen, boxes):
        color = np.stack([imagen] * 3, axis=-1)
        for x1, y1, x2, y2, _ in boxes:
            cv2.rectangle(color, (x1, y1), (x2, y2), (255, 0, 0), 2)
        return color

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Analizador Multi-Agente para imágenes médicas')
    parser.add_argument('image_path', type=str, help='Ruta del archivo de análisis')
    parser.add_argument('--output', type=str, default='analysis_output', help='Directorio de salida')
    args = parser.parse_args()
    analyzer = AnalizadorImagenes()
    resultado = analyzer.analizar(args.image_path, args.output)
    print(json.dumps(resultado, indent=2, ensure_ascii=False))