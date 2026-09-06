import os
import pickle
import json
from datetime import date, datetime
from typing import Tuple, Optional, Any, Dict
import cv2
import numpy as np

# Find model paths
CANDIDATE_KNN_PATHS = [
    "model.pkl",
    "backend/model.pkl",
    os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "model.pkl"),
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "model.pkl"),
]

CANDIDATE_CNN_PATHS = [
    "model_cnn.pt",
    "backend/model_cnn.pt",
    os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "model_cnn.pt"),
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "model_cnn.pt"),
]

_loaded_knn_model = None
_loaded_cnn_model = None
_cnn_classes = None


def get_knn_model():
    global _loaded_knn_model
    if _loaded_knn_model is not None:
        return _loaded_knn_model

    for path in CANDIDATE_KNN_PATHS:
        if os.path.exists(path):
            try:
                with open(path, "rb") as f:
                    _loaded_knn_model = pickle.load(f)
                print(f"[ML Engine] Loaded KNN model from: {path}")
                return _loaded_knn_model
            except Exception as e:
                print(f"[ML Engine] Failed to load KNN model from {path}: {e}")
    return None


def get_cnn_model():
    global _loaded_cnn_model, _cnn_classes
    if _loaded_cnn_model is not None:
        return _loaded_cnn_model, _cnn_classes

    # Check if PyTorch model exists and torch is importable
    try:
        import torch
        import torchvision.models as models
        import torch.nn as nn

        model_path = None
        for path in CANDIDATE_CNN_PATHS:
            if os.path.exists(path):
                model_path = path
                break

        if model_path:
            checkpoint = torch.load(model_path, map_location=torch.device("cpu"))
            _cnn_classes = checkpoint.get("classes", [])
            num_classes = len(_cnn_classes)

            model = models.mobilenet_v2(weights=None)
            model.classifier[1] = nn.Linear(model.last_channel, num_classes)
            model.load_state_dict(checkpoint["state_dict"])
            model.eval()

            _loaded_cnn_model = model
            print(f"[ML Engine] Loaded CNN MobileNetV2 model from {model_path} with {num_classes} classes.")
            return _loaded_cnn_model, _cnn_classes
    except Exception as e:
        # PyTorch not installed or no CNN checkpoint, default gracefully
        pass

    return None, None


def calculate_expiry_status(exp_date: date) -> Tuple[int, str]:
    """
    Computes days remaining and status:
    - days_left < 0 -> "EXPIRED"
    - 0 <= days_left <= 7 -> "EXPIRING_SOON"
    - days_left > 7 -> "SAFE"
    """
    today = date.today()
    days_left = (exp_date - today).days

    if days_left < 0:
        status = "EXPIRED"
    elif days_left <= 7:
        status = "EXPIRING_SOON"
    else:
        status = "SAFE"

    return days_left, status


def decode_image_bytes(image_bytes: bytes) -> Optional[np.ndarray]:
    """Safely decodes image bytes into an OpenCV BGR numpy array."""
    try:
        nparr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        return img
    except Exception:
        return None


def predict_product(image_bytes: bytes) -> Dict[str, Any]:
    """
    Predicts product label and confidence score from image bytes.
    Tries CNN first, falls back to KNN.
    """
    img = decode_image_bytes(image_bytes)
    if img is None:
        raise ValueError("Invalid image file or unsupported image format.")

    # 1. Check for CNN model
    cnn_model, cnn_classes = get_cnn_model()
    if cnn_model is not None and cnn_classes:
        try:
            import torch
            from torchvision import transforms
            from PIL import Image

            rgb_img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
            pil_img = Image.fromarray(rgb_img)

            transform = transforms.Compose([
                transforms.Resize((224, 224)),
                transforms.ToTensor(),
                transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
            ])

            tensor = transform(pil_img).unsqueeze(0)
            with torch.no_grad():
                outputs = cnn_model(tensor)
                probs = torch.nn.functional.softmax(outputs[0], dim=0)
                conf, pred_idx = torch.max(probs, dim=0)

            product_name = cnn_classes[pred_idx.item()]
            confidence = round(float(conf.item()) * 100, 1)

            return {
                "product_name": product_name,
                "confidence": confidence,
                "model_type": "MobileNetV2 (CNN)",
            }
        except Exception as e:
            print(f"[ML Engine] CNN prediction failed, falling back to KNN: {e}")

    # 2. KNN Model Fallback
    knn_model = get_knn_model()
    if knn_model is None:
        raise RuntimeError("No ML model (CNN or KNN) is available. Please train a model first.")

    # Resize to 100x100 and flatten (original train.py pipeline)
    resized_img = cv2.resize(img, (100, 100))
    flat_features = resized_img.flatten().reshape(1, -1)

    prediction = knn_model.predict(flat_features)
    predicted_label = str(prediction[0]).strip()

    # Calculate confidence based on nearest neighbor distance
    confidence = 92.0
    try:
        distances, _ = knn_model.kneighbors(flat_features, n_neighbors=1)
        dist = distances[0][0]
        # In flattened 100x100x3 pixel space, distance max is approx sqrt(30000 * 255^2) = 44167
        # Convert distance to an intuitive confidence percentage
        score = max(50.0, min(99.5, 100.0 - (dist / 350.0)))
        confidence = round(float(score), 1)
    except Exception:
        pass

    return {
        "product_name": predicted_label,
        "confidence": confidence,
        "model_type": "K-Nearest Neighbors (KNN)",
    }


def match_product_with_inventory(predicted_label: str, inventory_products: list) -> Optional[Any]:
    """
    Matches raw model prediction label (e.g. 'soya_sos', 'horlicks', 'harpic')
    with database Product records using normalized stemming and substring heuristics.
    """
    if not inventory_products:
        return None

    def normalize(text: str) -> str:
        return (
            text.lower()
            .replace("_", "")
            .replace("-", "")
            .replace(" ", "")
            .replace("sauce", "sos")  # Handle sauce <-> sos variation
        )

    norm_pred = normalize(predicted_label)

    # 1. Exact normalized match
    for prod in inventory_products:
        if normalize(prod.name) == norm_pred:
            return prod

    # 2. Substring match
    for prod in inventory_products:
        norm_name = normalize(prod.name)
        if norm_pred in norm_name or norm_name in norm_pred:
            return prod

    # 3. First 4 characters prefix match
    if len(norm_pred) >= 4:
        for prod in inventory_products:
            norm_name = normalize(prod.name)
            if norm_name.startswith(norm_pred[:4]) or norm_pred.startswith(norm_name[:4]):
                return prod

    return None
