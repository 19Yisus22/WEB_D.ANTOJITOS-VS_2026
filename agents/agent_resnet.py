import numpy as np
from PIL import Image
import importlib
import os
import cv2
from math import exp


def _preprocess_for_resnet(pil_image, target_size=(224, 224)):
    img = pil_image.convert('RGB').resize(target_size, Image.LANCZOS)
    arr = np.array(img).astype(np.float32)
    gray = cv2.cvtColor(arr.astype(np.uint8), cv2.COLOR_RGB2GRAY)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    gray_eq = clahe.apply(gray)
    rgb_eq = cv2.cvtColor(gray_eq, cv2.COLOR_GRAY2RGB).astype(np.float32)
    blended = arr * 0.6 + rgb_eq * 0.4
    return blended


def _load_resnet():
    for path in ('tensorflow.keras.applications.resnet50', 'keras.applications.resnet50'):
        try:
            mod = importlib.import_module(path)
            return getattr(mod, 'ResNet50'), getattr(mod, 'preprocess_input')
        except Exception:
            continue
    return None, None


class ResNetAgent:
    def __init__(self, weights='imagenet'):
        ResNet50, preprocess_input = _load_resnet()
        self.preprocess_input = preprocess_input
        if ResNet50 is None:
            self.model = None
        else:
            try:
                self.model = ResNet50(weights=weights, include_top=False, pooling='avg')
            except Exception:
                try:
                    self.model = ResNet50(weights=None, include_top=False, pooling='avg')
                except Exception:
                    self.model = None

    def extract_features(self, pil_image, target_size=(224, 224)):
        try:
            enhanced = _preprocess_for_resnet(pil_image, target_size)
            arr = np.expand_dims(enhanced, 0)
            if self.preprocess_input is not None:
                arr = self.preprocess_input(arr)
            if self.model is None:
                return np.zeros(2048, dtype=np.float32)
            feat = self.model.predict(arr, verbose=0).flatten()
            return feat
        except Exception:
            return np.zeros(2048, dtype=np.float32)

    def predict(self, pil_image, classifier_path=None, bbox_thresh=0.55):
        prob = 0.0
        try:
            feat = self.extract_features(pil_image)
            if classifier_path and os.path.exists(classifier_path):
                try:
                    import tensorflow as tf
                    clf = tf.keras.models.load_model(classifier_path)
                    preds = clf.predict(np.expand_dims(feat, 0), verbose=0)
                    prob = float(preds[0][-1]) if preds.ndim == 2 and preds.shape[-1] > 1 else float(preds.flatten()[0])
                except Exception:
                    mean_f = float(np.mean(feat))
                    prob = 1.0 / (1.0 + exp(-mean_f / 100.0))
            else:
                mean_f = float(np.mean(feat))
                std_f = float(np.std(feat))
                raw = (mean_f / 100.0) + (std_f / 150.0) * 0.3
                prob = 1.0 / (1.0 + exp(-raw))
        except Exception:
            prob = 0.0

        boxes = []
        try:
            gray = np.array(pil_image.convert('L').resize((224, 224), Image.LANCZOS))
            norm = ((gray - gray.min()) / (gray.max() - gray.min() + 1e-8) * 255).astype(np.uint8)
            clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
            eq = clahe.apply(norm)
            th = cv2.adaptiveThreshold(eq, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 51, 9)
            kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))
            th = cv2.morphologyEx(th, cv2.MORPH_CLOSE, kernel)
            contours, _ = cv2.findContours(th, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            h, w = gray.shape
            for cnt in contours:
                x, y, bw, bh = cv2.boundingRect(cnt)
                if bw * bh < 0.002 * w * h:
                    continue
                patch = eq[y:y + bh, x:x + bw]
                score = float(np.mean(patch) / 255.0)
                if score >= bbox_thresh:
                    boxes.append([int(x), int(y), int(x + bw), int(y + bh), round(score, 4)])
            boxes.sort(key=lambda b: -b[4])
            boxes = boxes[:6]
        except Exception:
            boxes = []

        return {
            "probability": round(min(max(float(prob), 0.0), 1.0), 6),
            "boxes": boxes,
            "agente": "ResNet",
        }
