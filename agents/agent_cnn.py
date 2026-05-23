import numpy as np
from PIL import Image
import importlib
import os
import cv2
from math import exp


def _preprocess_for_cnn(pil_image, target_size=(224, 224)):
    img = pil_image.convert('RGB').resize(target_size, Image.LANCZOS)
    arr = np.array(img).astype(np.float32)
    gray = cv2.cvtColor(arr.astype(np.uint8), cv2.COLOR_RGB2GRAY)
    clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
    gray_eq = clahe.apply(gray)
    denoised = cv2.fastNlMeansDenoising(gray_eq, h=10, templateWindowSize=7, searchWindowSize=21)
    rgb_eq = cv2.cvtColor(denoised, cv2.COLOR_GRAY2RGB).astype(np.float32) / 255.0
    return rgb_eq, arr / 255.0


def _build_cnn_model():
    Sequential = None
    Layers = None
    for module_path in ('tensorflow.keras.models', 'keras.models'):
        try:
            models = importlib.import_module(module_path)
            Layers = importlib.import_module(module_path.replace('models', 'layers'))
            Sequential = getattr(models, 'Sequential', None)
            break
        except Exception:
            continue
    if Sequential is None or Layers is None:
        return None
    model = Sequential([
        Layers.Conv2D(64, (3, 3), activation='relu', padding='same', input_shape=(224, 224, 3)),
        Layers.MaxPooling2D((2, 2)),
        Layers.Conv2D(128, (3, 3), activation='relu', padding='same'),
        Layers.MaxPooling2D((2, 2)),
        Layers.Conv2D(256, (3, 3), activation='relu', padding='same'),
        Layers.MaxPooling2D((2, 2)),
        Layers.GlobalAveragePooling2D(),
    ])
    return model


class CNNAgent:
    def __init__(self):
        self.model = _build_cnn_model()

    def extract_features(self, pil_image, target_size=(224, 224)):
        try:
            enhanced, _ = _preprocess_for_cnn(pil_image, target_size)
            arr = np.expand_dims(enhanced, 0)
            if self.model is None:
                return np.zeros(256, dtype=np.float32)
            feat = self.model.predict(arr, verbose=0).flatten()
            return feat
        except Exception:
            return np.zeros(256, dtype=np.float32)

    def predict(self, pil_image, classifier_path=None, bbox_thresh=0.45):
        prob = 0.0
        try:
            enhanced, original = _preprocess_for_cnn(pil_image)
            arr = np.expand_dims(enhanced, 0)
            if classifier_path and os.path.exists(classifier_path):
                try:
                    tf = importlib.import_module('tensorflow')
                    clf = tf.keras.models.load_model(classifier_path)
                    preds = clf.predict(arr, verbose=0)
                    prob = float(preds[0][-1]) if preds.ndim == 2 and preds.shape[-1] > 1 else float(preds.flatten()[0])
                except Exception:
                    feat = self.extract_features(pil_image)
                    prob = 1.0 / (1.0 + exp(-float(np.mean(feat) / 50.0)))
            else:
                feat = self.extract_features(pil_image)
                mean_val = float(np.mean(feat)) if feat is not None and feat.size > 0 else 0.0
                std_val = float(np.std(feat)) if feat is not None and feat.size > 0 else 0.0
                raw = (mean_val / 50.0) + (std_val / 100.0) * 0.5
                prob = 1.0 / (1.0 + exp(-raw))
        except Exception:
            prob = 0.0

        boxes = []
        try:
            gray = np.array(pil_image.convert('L').resize((224, 224), Image.LANCZOS))
            clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
            gray_eq = clahe.apply(gray)
            blurred = cv2.GaussianBlur(gray_eq, (5, 5), 0)
            _, th = cv2.threshold(blurred, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
            th = cv2.bitwise_not(th)
            kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
            th = cv2.morphologyEx(th, cv2.MORPH_CLOSE, kernel)
            contours, _ = cv2.findContours(th, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            h, w = gray.shape
            for cnt in contours:
                x, y, bw, bh = cv2.boundingRect(cnt)
                if bw * bh < 0.001 * w * h:
                    continue
                patch = gray_eq[y:y + bh, x:x + bw]
                score = float(np.mean(patch) / 255.0)
                if score >= bbox_thresh:
                    boxes.append([int(x), int(y), int(x + bw), int(y + bh), round(score, 4)])
            boxes.sort(key=lambda b: -b[4])
            boxes = boxes[:8]
        except Exception:
            boxes = []

        return {
            "probability": round(min(max(float(prob), 0.0), 1.0), 6),
            "boxes": boxes,
            "agente": "CNN",
        }
