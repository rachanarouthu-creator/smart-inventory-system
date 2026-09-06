import os
import cv2
import pickle
from sklearn.neighbors import KNeighborsClassifier

def find_dataset_dir():
    candidates = [
        "dataset",
        "backend/dataset",
        os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "dataset"),
        os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "dataset"),
    ]
    for path in candidates:
        if os.path.exists(path) and os.path.isdir(path):
            return path
    return "dataset"

def train_knn():
    dataset_path = find_dataset_dir()
    print(f"[Train KNN] Loading images from: {dataset_path}")

    X = []
    y = []
    class_counts = {}

    if not os.path.exists(dataset_path):
        print(f"[Train KNN] Error: Dataset directory '{dataset_path}' does not exist.")
        return

    for product_name in sorted(os.listdir(dataset_path)):
        product_folder = os.path.join(dataset_path, product_name)
        if not os.path.isdir(product_folder):
            continue

        images = [f for f in os.listdir(product_folder) if f.lower().endswith(('.jpg', '.jpeg', '.png', '.webp'))]
        class_counts[product_name] = len(images)

        for image_name in images:
            image_path = os.path.join(product_folder, image_name)
            img = cv2.imread(image_path)
            if img is not None:
                img_resized = cv2.resize(img, (100, 100))
                img_flat = img_resized.flatten()
                X.append(img_flat)
                y.append(product_name)

    if not X:
        print("[Train KNN] No training images found in dataset!")
        return

    print(f"[Train KNN] Found {len(X)} images across {len(class_counts)} classes:")
    for cls, count in class_counts.items():
        print(f"  - {cls}: {count} images")

    # Fit KNN Model
    model = KNeighborsClassifier(n_neighbors=1)
    model.fit(X, y)

    # Save model.pkl in backend and current working directory
    target_paths = [
        "model.pkl",
        os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "model.pkl"),
    ]
    for target in target_paths:
        try:
            with open(target, "wb") as f:
                pickle.dump(model, f)
            print(f"[Train KNN] Model saved to {target}")
        except Exception as e:
            print(f"[Train KNN] Could not save to {target}: {e}")

    print("[Train KNN] Training complete!")

if __name__ == "__main__":
    train_knn()
