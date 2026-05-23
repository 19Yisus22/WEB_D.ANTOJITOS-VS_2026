import numpy as np
from sklearn.cluster import KMeans
import cv2


def segment_kmeans(gris, n_clusters=6, random_state=42):
    norm = ((gris - gris.min()) / (gris.max() - gris.min() + 1e-8) * 255).astype(np.uint8)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    enhanced = clahe.apply(norm)
    blurred = cv2.GaussianBlur(enhanced, (5, 5), 0)
    pixeles = blurred.reshape(-1, 1).astype(np.float32) / 255.0
    kmeans = KMeans(n_clusters=n_clusters, random_state=random_state, n_init=10, max_iter=200)
    etiquetas = kmeans.fit_predict(pixeles)
    return etiquetas.reshape(gris.shape)


def kmeans_stats(gris, n_clusters=6):
    try:
        norm = ((gris - gris.min()) / (gris.max() - gris.min() + 1e-8) * 255).astype(np.uint8)
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        enhanced = clahe.apply(norm)
        pixeles = enhanced.reshape(-1, 1).astype(np.float32) / 255.0
        kmeans = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
        labels = kmeans.fit_predict(pixeles)
        centers = kmeans.cluster_centers_.flatten().tolist()
        inertia = float(kmeans.inertia_)
        counts = [int(np.sum(labels == i)) for i in range(n_clusters)]
        entropy = float(-np.sum([
            (c / len(labels)) * np.log2(c / len(labels) + 1e-10)
            for c in counts
        ]))
        return {
            "n_clusters": n_clusters,
            "centroides": [round(c, 4) for c in centers],
            "inertia": round(inertia, 4),
            "entropy": round(entropy, 4),
            "distribucion": counts,
            "etiquetas": labels.reshape(norm.shape),
        }
    except Exception:
        return {
            "n_clusters": n_clusters,
            "centroides": [],
            "inertia": 0.0,
            "entropy": 0.0,
            "distribucion": [],
            "etiquetas": None,
        }
