import os
import cv2
import pickle
import numpy as np
import pandas as pd
from datetime import date, datetime
from typing import Optional, List, Dict, Any

import uvicorn
from fastapi import FastAPI, File, UploadFile, HTTPException, Form
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sklearn.neighbors import KNeighborsClassifier

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CSV_PATH = os.path.join(BASE_DIR, "products.csv")
MODEL_PATH = os.path.join(BASE_DIR, "model.pkl")
DATASET_DIR = os.path.join(BASE_DIR, "dataset")
STATIC_DIR = os.path.join(BASE_DIR, "static")

app = FastAPI(title="Smart Inventory & AI Vision System")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global in-memory model cache
loaded_model = None


def get_model():
    global loaded_model
    if loaded_model is None:
        if os.path.exists(MODEL_PATH):
            try:
                with open(MODEL_PATH, "rb") as f:
                    loaded_model = pickle.load(f)
            except Exception as e:
                print(f"Error loading model: {e}")
                loaded_model = None
    return loaded_model


def calculate_status(expiry_date_str: str) -> Dict[str, Any]:
    """Calculates days left and status: SAFE, EXPIRING SOON, or EXPIRED."""
    try:
        exp_date = pd.to_datetime(expiry_date_str).date()
        today = date.today()
        days_left = (exp_date - today).days

        if days_left < 0:
            status = "EXPIRED"
        elif days_left <= 7:
            status = "EXPIRING SOON"
        else:
            status = "SAFE"

        return {
            "days_left": days_left,
            "status": status,
            "formatted_expiry": exp_date.strftime("%Y-%m-%d"),
        }
    except Exception:
        return {"days_left": 9999, "status": "UNKNOWN", "formatted_expiry": str(expiry_date_str)}


def read_inventory_df() -> pd.DataFrame:
    """Safely reads the CSV inventory or initializes one if missing."""
    if not os.path.exists(CSV_PATH):
        df = pd.DataFrame(columns=["Product", "Category", "ExpiryDate", "Quantity"])
        df.to_csv(CSV_PATH, index=False)
        return df
    return pd.read_csv(CSV_PATH)


def save_inventory_df(df: pd.DataFrame):
    df.to_csv(CSV_PATH, index=False)


# Pydantic Schemas
class ProductCreate(BaseModel):
    product: str
    category: str
    expiry_date: str
    quantity: int


class ProductUpdate(BaseModel):
    category: Optional[str] = None
    expiry_date: Optional[str] = None
    quantity: Optional[int] = None


@app.get("/api/inventory")
def get_inventory():
    """Returns all inventory items with calculated expiry status and summary counts."""
    df = read_inventory_df()
    items = []
    stats = {"total": 0, "safe": 0, "expiring_soon": 0, "expired": 0}

    for _, row in df.iterrows():
        p_name = str(row["Product"]).strip()
        p_cat = str(row["Category"]).strip()
        p_exp = str(row["ExpiryDate"]).strip()
        p_qty = int(row["Quantity"]) if pd.notna(row["Quantity"]) else 0

        calc = calculate_status(p_exp)

        stats["total"] += 1
        if calc["status"] == "SAFE":
            stats["safe"] += 1
        elif calc["status"] == "EXPIRING SOON":
            stats["expiring_soon"] += 1
        elif calc["status"] == "EXPIRED":
            stats["expired"] += 1

        items.append({
            "product": p_name,
            "category": p_cat,
            "expiry_date": calc["formatted_expiry"],
            "quantity": p_qty,
            "days_left": calc["days_left"],
            "status": calc["status"],
        })

    return {"items": items, "stats": stats}


@app.post("/api/inventory")
def add_product(payload: ProductCreate):
    """Add a new product to inventory."""
    df = read_inventory_df()
    norm_name = payload.product.strip().lower()

    # Check if already exists
    if not df.empty and df["Product"].str.strip().str.lower().isin([norm_name]).any():
        raise HTTPException(status_code=400, detail=f"Product '{payload.product}' already exists.")

    new_row = pd.DataFrame([{
        "Product": payload.product.strip(),
        "Category": payload.category.strip(),
        "ExpiryDate": payload.expiry_date.strip(),
        "Quantity": int(payload.quantity),
    }])

    df = pd.concat([df, new_row], ignore_index=True)
    save_inventory_df(df)
    return {"message": "Product added successfully", "product": payload.product}


@app.put("/api/inventory/{product_name}")
def update_product(product_name: str, payload: ProductUpdate):
    """Update quantity or expiry date of an existing product."""
    df = read_inventory_df()
    norm_name = product_name.strip().lower()

    idx = df[df["Product"].str.strip().str.lower() == norm_name].index
    if len(idx) == 0:
        raise HTTPException(status_code=404, detail="Product not found.")

    row_idx = idx[0]
    if payload.category is not None:
        df.at[row_idx, "Category"] = payload.category.strip()
    if payload.expiry_date is not None:
        df.at[row_idx, "ExpiryDate"] = payload.expiry_date.strip()
    if payload.quantity is not None:
        df.at[row_idx, "Quantity"] = max(0, int(payload.quantity))

    save_inventory_df(df)
    return {"message": "Product updated successfully"}


@app.delete("/api/inventory/{product_name}")
def delete_product(product_name: str):
    """Delete a product from the inventory."""
    df = read_inventory_df()
    norm_name = product_name.strip().lower()

    filtered_df = df[df["Product"].str.strip().str.lower() != norm_name]
    if len(filtered_df) == len(df):
        raise HTTPException(status_code=404, detail="Product not found.")

    save_inventory_df(filtered_df)
    return {"message": f"Product '{product_name}' deleted successfully"}


@app.post("/api/scan")
async def scan_product(file: UploadFile = File(...)):
    """Predicts product class from uploaded image and matches with inventory."""
    model = get_model()
    if model is None:
        raise HTTPException(status_code=500, detail="AI Model not loaded. Please train model first.")

    try:
        contents = await file.read()
        nparr = np.frombuffer(contents, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if img is None:
            raise HTTPException(status_code=400, detail="Invalid image file.")

        # Preprocess exactly as in train.py (100x100 flatten)
        resized_img = cv2.resize(img, (100, 100))
        features = resized_img.flatten().reshape(1, -1)

        prediction = model.predict(features)
        predicted_label = str(prediction[0]).strip()

        # Calculate prediction probabilities or distance if available
        confidence = 95.0
        if hasattr(model, "predict_proba"):
            try:
                probs = model.predict_proba(features)[0]
                confidence = float(np.max(probs) * 100)
            except Exception:
                confidence = 95.0

        # Match predicted label with inventory
        df = read_inventory_df()
        
        # Friendly display name
        display_label = predicted_label.replace("_", " ").title()

        # Look up product (fuzzy / case-insensitive)
        matched = None
        for _, row in df.iterrows():
            item_name = str(row["Product"]).strip()
            item_norm = item_name.lower().replace("_", " ").replace(" ", "")
            pred_norm = predicted_label.lower().replace("_", " ").replace(" ", "")
            
            # Match soya sos -> soya sauce, harpic -> harpic, etc.
            if pred_norm in item_norm or item_norm in pred_norm or pred_norm[:4] == item_norm[:4]:
                matched = row
                break

        if matched is not None:
            calc = calculate_status(str(matched["ExpiryDate"]))
            return {
                "detected_label": str(matched["Product"]),
                "raw_model_class": predicted_label,
                "category": str(matched["Category"]),
                "quantity": int(matched["Quantity"]),
                "expiry_date": calc["formatted_expiry"],
                "days_left": calc["days_left"],
                "status": calc["status"],
                "in_inventory": True,
                "confidence": round(confidence, 1),
            }
        else:
            return {
                "detected_label": display_label,
                "raw_model_class": predicted_label,
                "category": "Uncategorized",
                "quantity": 0,
                "expiry_date": "N/A",
                "days_left": 0,
                "status": "NOT_IN_INVENTORY",
                "in_inventory": False,
                "confidence": round(confidence, 1),
            }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error scanning image: {str(e)}")


@app.post("/api/retrain")
def retrain_model():
    """Retrains the KNN classifier using images in the dataset folder."""
    global loaded_model

    if not os.path.exists(DATASET_DIR):
        raise HTTPException(status_code=400, detail="Dataset folder not found.")

    X = []
    y = []

    for product_name in os.listdir(DATASET_DIR):
        product_folder = os.path.join(DATASET_DIR, product_name)
        if not os.path.isdir(product_folder):
            continue

        for image_name in os.listdir(product_folder):
            image_path = os.path.join(product_folder, image_name)
            img = cv2.imread(image_path)
            if img is not None:
                img = cv2.resize(img, (100, 100))
                img = img.flatten()
                X.append(img)
                y.append(product_name)

    if len(X) == 0:
        raise HTTPException(status_code=400, detail="No training images found in dataset directory.")

    model = KNeighborsClassifier(n_neighbors=1)
    model.fit(X, y)

    with open(MODEL_PATH, "wb") as f:
        pickle.dump(model, f)

    loaded_model = model
    return {
        "message": "Model retrained successfully!",
        "total_images": len(X),
        "classes": sorted(list(set(y))),
    }


# Mount static files and dataset
os.makedirs(STATIC_DIR, exist_ok=True)
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")
if os.path.exists(DATASET_DIR):
    app.mount("/dataset", StaticFiles(directory=DATASET_DIR), name="dataset")


@app.get("/")
def serve_index():
    index_file = os.path.join(STATIC_DIR, "index.html")
    if os.path.exists(index_file):
        return FileResponse(index_file)
    return JSONResponse({"status": "Smart Inventory API is running. UI is initializing..."})


if __name__ == "__main__":
    print("\n" + "=" * 60)
    print("[*] SMART INVENTORY & AI VISION SERVER")
    print("[*] Open in your browser: http://127.0.0.1:8080")
    print("=" * 60 + "\n")
    uvicorn.run("app:app", host="127.0.0.1", port=8080, reload=True)
