import os
from datetime import datetime, date
from typing import List, Optional
from contextlib import asynccontextmanager

from fastapi import FastAPI, File, UploadFile, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.database import get_db, seed_database_if_empty
from app.models import Product
from app.schemas import (
    ProductCreate,
    ProductUpdate,
    ProductResponse,
    InventoryListResponse,
    InventoryStats,
    PredictResponse,
    ScanResponse,
)
from app.ml.predict import (
    predict_product,
    match_product_with_inventory,
    calculate_expiry_status,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: seed database if empty
    seed_database_if_empty()
    yield


app = FastAPI(
    title="Smart Pantry Expiry Tracker API",
    description="Vision AI and Inventory Expiry Tracking for Kitchen Products",
    version="1.0.0",
    lifespan=lifespan,
)

# Configure CORS
cors_origins_env = os.getenv("CORS_ORIGINS", "*")
origins = [o.strip() for o in cors_origins_env.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins if origins != ["*"] else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health", tags=["Health"])
@app.get("/health", tags=["Health"])
def health_check():
    return {"status": "ok", "service": "Smart Pantry Expiry Tracker"}


# -------------------------------------------------------------
# Inventory Endpoints
# -------------------------------------------------------------
def format_product_response(prod: Product) -> ProductResponse:
    days_left, status_val = calculate_expiry_status(prod.expiry_date)
    return ProductResponse(
        id=prod.id,
        name=prod.name,
        category=prod.category,
        expiry_date=prod.expiry_date.strftime("%Y-%m-%d"),
        quantity=prod.quantity,
        days_left=days_left,
        status=status_val,
    )


@app.get("/inventory", response_model=InventoryListResponse, tags=["Inventory"])
@app.get("/api/inventory", response_model=InventoryListResponse, tags=["Inventory"])
def get_inventory(db: Session = Depends(get_db)):
    products = db.query(Product).order_by(Product.expiry_date.asc()).all()

    items: List[ProductResponse] = []
    stats = {"total": 0, "safe": 0, "expiring_soon": 0, "expired": 0}

    for prod in products:
        item = format_product_response(prod)
        items.append(item)

        stats["total"] += 1
        if item.status == "SAFE":
            stats["safe"] += 1
        elif item.status == "EXPIRING_SOON":
            stats["expiring_soon"] += 1
        elif item.status == "EXPIRED":
            stats["expired"] += 1

    return InventoryListResponse(
        items=items,
        stats=InventoryStats(**stats)
    )


@app.post("/inventory", response_model=ProductResponse, status_code=status.HTTP_201_CREATED, tags=["Inventory"])
@app.post("/api/inventory", response_model=ProductResponse, status_code=status.HTTP_201_CREATED, tags=["Inventory"])
def add_product(payload: ProductCreate, db: Session = Depends(get_db)):
    name_clean = payload.name.strip()
    category_clean = payload.category.strip()

    # Check for duplicate
    existing = db.query(Product).filter(Product.name.ilike(name_clean)).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Product with name '{name_clean}' already exists in inventory."
        )

    try:
        exp_date = datetime.strptime(payload.expiry_date.strip(), "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid expiry_date format. Please use YYYY-MM-DD."
        )

    new_product = Product(
        name=name_clean,
        category=category_clean,
        expiry_date=exp_date,
        quantity=payload.quantity,
    )
    db.add(new_product)
    db.commit()
    db.refresh(new_product)

    return format_product_response(new_product)


@app.put("/inventory/{product_id}", response_model=ProductResponse, tags=["Inventory"])
@app.put("/api/inventory/{product_id}", response_model=ProductResponse, tags=["Inventory"])
def update_product(product_id: int, payload: ProductUpdate, db: Session = Depends(get_db)):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product with id {product_id} not found."
        )

    if payload.name is not None and payload.name.strip():
        # Check uniqueness if renaming
        new_name = payload.name.strip()
        existing = db.query(Product).filter(Product.name.ilike(new_name), Product.id != product_id).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Another product with name '{new_name}' already exists."
            )
        product.name = new_name

    if payload.category is not None and payload.category.strip():
        product.category = payload.category.strip()

    if payload.quantity is not None:
        product.quantity = max(0, payload.quantity)

    if payload.expiry_date is not None and payload.expiry_date.strip():
        try:
            exp_date = datetime.strptime(payload.expiry_date.strip(), "%Y-%m-%d").date()
            product.expiry_date = exp_date
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid expiry_date format. Please use YYYY-MM-DD."
            )

    db.commit()
    db.refresh(product)
    return format_product_response(product)


@app.delete("/inventory/{product_id}", status_code=status.HTTP_200_OK, tags=["Inventory"])
@app.delete("/api/inventory/{product_id}", status_code=status.HTTP_200_OK, tags=["Inventory"])
def delete_product(product_id: int, db: Session = Depends(get_db)):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product with id {product_id} not found."
        )

    db.delete(product)
    db.commit()
    return {"message": f"Product '{product.name}' deleted successfully", "id": product_id}


# -------------------------------------------------------------
# Vision ML Endpoints
# -------------------------------------------------------------
@app.post("/predict", response_model=PredictResponse, tags=["ML Prediction"])
@app.post("/api/predict", response_model=PredictResponse, tags=["ML Prediction"])
async def predict_image(file: UploadFile = File(...)):
    """Accepts an uploaded image, runs model inference, returns {product_name, confidence, model_type}."""
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File provided is not a valid image."
        )

    try:
        image_bytes = await file.read()
        result = predict_product(image_bytes)
        return PredictResponse(
            product_name=result["product_name"],
            confidence=result["confidence"],
            model_type=result["model_type"],
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Prediction processing error: {str(e)}"
        )


@app.post("/scan", response_model=ScanResponse, tags=["Vision & Inventory Scan"])
@app.post("/api/scan", response_model=ScanResponse, tags=["Vision & Inventory Scan"])
async def scan_item(file: UploadFile = File(...), db: Session = Depends(get_db)):
    """
    Main endpoint for kitchen scanner.
    Upload a photo -> returns identified product name, confidence, and inventory expiry status.
    """
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is not a valid image."
        )

    try:
        image_bytes = await file.read()
        prediction = predict_product(image_bytes)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Scan error during inference: {str(e)}"
        )

    predicted_label = prediction["product_name"]
    confidence = prediction["confidence"]
    model_type = prediction["model_type"]

    # Match with database inventory
    all_products = db.query(Product).all()
    matched_product = match_product_with_inventory(predicted_label, all_products)

    if matched_product:
        days_left, status_val = calculate_expiry_status(matched_product.expiry_date)
        return ScanResponse(
            product_name=matched_product.name,
            detected_label=predicted_label,
            category=matched_product.category,
            quantity=matched_product.quantity,
            expiry_date=matched_product.expiry_date.strftime("%Y-%m-%d"),
            days_left=days_left,
            status=status_val,
            confidence=confidence,
            in_inventory=True,
            inventory_id=matched_product.id,
            model_type=model_type,
        )
    else:
        # Detected a class that is not currently in the database inventory
        display_name = predicted_label.replace("_", " ").title()
        return ScanResponse(
            product_name=display_name,
            detected_label=predicted_label,
            category="Uncategorized",
            quantity=0,
            expiry_date="Not in Inventory",
            days_left=0,
            status="UNKNOWN",
            confidence=confidence,
            in_inventory=False,
            inventory_id=None,
            model_type=model_type,
        )


# -------------------------------------------------------------
# Single URL Frontend SPA Serving
# -------------------------------------------------------------
CANDIDATE_DIST_DIRS = [
    os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "frontend", "dist"),
    os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "dist"),
    "frontend/dist",
    "dist",
]

frontend_dist = None
for candidate in CANDIDATE_DIST_DIRS:
    if os.path.exists(candidate) and os.path.isdir(candidate):
        frontend_dist = candidate
        break

if frontend_dist:
    assets_dir = os.path.join(frontend_dist, "assets")
    if os.path.exists(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_frontend(full_path: str):
        # Exclude API endpoints from frontend catch-all
        if full_path.startswith(("api/", "inventory", "predict", "scan", "health", "docs", "openapi.json", "redoc")):
            raise HTTPException(status_code=404, detail="Not Found")

        file_candidate = os.path.join(frontend_dist, full_path)
        if full_path and os.path.isfile(file_candidate):
            return FileResponse(file_candidate)

        index_file = os.path.join(frontend_dist, "index.html")
        if os.path.exists(index_file):
            return FileResponse(index_file)

        raise HTTPException(status_code=404, detail="Page not found")

