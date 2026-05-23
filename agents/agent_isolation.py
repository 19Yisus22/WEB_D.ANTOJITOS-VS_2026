import numpy as np
from sklearn.ensemble import IsolationForest
import cv2


def _preprocess_gray(gris):
    norm = ((gris - gris.min()) / (gris.max() - gris.min() + 1e-8) * 255).astype(np.uint8)
    clahe = cv2.createCLAHE(clipLimit=2.5, tileGridSize=(8, 8))
    return clahe.apply(norm)


def detect_anomalies_boxes(gris, contamination=0.06, thresh=0.55):
    try:
        enhanced = _preprocess_gray(gris)
        pixeles = enhanced.reshape(-1, 1).astype(np.float32) / 255.0

        subsample = pixeles
        if len(pixeles) > 20000:
            idx = np.random.RandomState(42).choice(len(pixeles), 20000, replace=False)
            subsample = pixeles[idx]

        modelo = IsolationForest(
            n_estimators=120,
            contamination=contamination,
            max_samples=min(len(subsample), 10000),
            random_state=42,
            n_jobs=-1,
        )
        modelo.fit(subsample)
        scores = modelo.decision_function(pixeles)
        mapa = scores.reshape(gris.shape)
        mapa_norm = (mapa - mapa.min()) / (mapa.max() - mapa.min() + 1e-8)
        mapa_inv = 1.0 - mapa_norm

        binaria = (mapa_inv >= thresh).astype(np.uint8) * 255
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
        binaria = cv2.morphologyEx(binaria, cv2.MORPH_CLOSE, kernel)

        contours, _ = cv2.findContours(binaria, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        boxes = []
        h, w = gris.shape
        for cnt in contours:
            x, y, bw, bh = cv2.boundingRect(cnt)
            if bw * bh < 0.0008 * w * h:
                continue
            patch = mapa_inv[y:y + bh, x:x + bw]
            score = float(np.mean(patch))
            boxes.append([int(x), int(y), int(x + bw), int(y + bh), round(score, 4)])

        boxes.sort(key=lambda b: -b[4])
        return boxes[:10]

    except Exception:
        return []


def anomaly_score(gris):
    try:
        boxes = detect_anomalies_boxes(gris)
        if not boxes:
            return 0.0
        scores = [b[4] for b in boxes]
        return float(round(max(scores) * 0.7 + np.mean(scores) * 0.3, 4))
    except Exception:
        return 0.0
