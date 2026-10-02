import os
import io
import csv
import re
import uuid
from datetime import datetime, date
from typing import List, Optional, Dict, Any
from contextlib import asynccontextmanager

from fastapi import FastAPI, File, UploadFile, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, Response, JSONResponse
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import get_db, seed_database_if_empty
from app.models import Product, ScanHistory, Batch, StockMovement, Notification
from app.schemas import (
    ProductCreate,
    ProductUpdate,
    ProductResponse,
    InventoryListResponse,
    InventoryStats,
    PredictResponse,
    ScanResponse,
    OCRScanResponse,
    StockUpdateRequest,
    StockUpdateResponse,
    ScanHistoryResponse,
    AlertsResponse,
    AnalyticsResponse,
    HealthScoreResponse,
    BatchCreate,
    BatchResponse,
    FEFORecommendation,
    StockMovementResponse,
    NotificationResponse,
)
from app.ml.predict import (
    predict_product,
    match_product_with_inventory,
    calculate_expiry_status,
    format_days_left_text,
    EXPIRY_THRESHOLD_DAYS,
)
from app.ml.ocr import extract_expiry_date_ocr


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: ensure tables, columns, and initial seeds exist
    seed_database_if_empty()

    # On Render (UPLOAD_DIR set), copy baked-in seed images to persistent disk
    # so product images are available even before any user uploads
    _env_udir = os.getenv("UPLOAD_DIR", "").strip()
    if _env_udir:
        import shutil
        _baked_uploads = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "uploads")
        _baked_uploads = os.path.normpath(_baked_uploads)
        if os.path.isdir(_baked_uploads):
            for _fname in os.listdir(_baked_uploads):
                _src = os.path.join(_baked_uploads, _fname)
                _dst = os.path.join(_env_udir, _fname)
                if os.path.isfile(_src) and not os.path.exists(_dst):
                    shutil.copy2(_src, _dst)

    yield


app = FastAPI(
    title="Smart Inventory AI API",
    description="Intelligent Computer Vision & Inventory Expiry Management System",
    version="2.0.0",
    lifespan=lifespan,
)

cors_origins_env = os.getenv("CORS_ORIGINS", "*")
origins = [o.strip() for o in cors_origins_env.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins if origins != ["*"] else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Uploads Static Directory Resolution & Mount
# UPLOAD_DIR env var (set on Render) overrides defaults so uploads persist on disk
_env_upload_dir = os.getenv("UPLOAD_DIR", "").strip()
if _env_upload_dir:
    upload_dir = _env_upload_dir
    os.makedirs(upload_dir, exist_ok=True)
else:
    CANDIDATE_UPLOAD_DIRS = [
        os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "uploads"),
        os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "uploads"),
        "backend/uploads",
        "uploads",
    ]
    upload_dir = None
    for candidate in CANDIDATE_UPLOAD_DIRS:
        if os.path.exists(candidate) and os.path.isdir(candidate):
            upload_dir = candidate
            break
    if not upload_dir:
        upload_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "uploads")
        os.makedirs(upload_dir, exist_ok=True)

CANDIDATE_UPLOAD_DIRS = [upload_dir]  # Keep for mirror logic compatibility

app.mount("/uploads", StaticFiles(directory=upload_dir), name="uploads")


@app.get("/api/health", tags=["Health"])
@app.get("/health", tags=["Health"])
def health_check():
    return {
        "status": "ok",
        "service": "Smart Inventory AI",
        "vision_engine": "KNN Classifier (30,000 features)",
        "expiry_threshold_days": EXPIRY_THRESHOLD_DAYS,
    }


def format_product_response(prod: Product) -> ProductResponse:
    days_left, status_val = calculate_expiry_status(prod.expiry_date)
    tgt = getattr(prod, "target_stock", 15) or 15
    rec = getattr(prod, "recommended_restock", 0) or 0
    batch_cnt = len(prod.batches) if hasattr(prod, "batches") and prod.batches else 0
    return ProductResponse(
        id=prod.id,
        name=prod.name,
        category=prod.category,
        expiry_date=prod.expiry_date.strftime("%Y-%m-%d"),
        quantity=prod.quantity,
        minimum_stock=prod.minimum_stock,
        target_stock=tgt,
        is_low_stock=prod.is_low_stock,
        recommended_restock=rec,
        price=round(float(prod.price), 2),
        image_path=prod.image_path,
        batch_count=batch_cnt,
        days_left=days_left,
        status=status_val,
    )


# -------------------------------------------------------------
# Inventory Endpoints
# -------------------------------------------------------------
@app.get("/inventory", response_model=InventoryListResponse, tags=["Inventory"])
@app.get("/api/inventory", response_model=InventoryListResponse, tags=["Inventory"])
def get_inventory(db: Session = Depends(get_db)):
    products = db.query(Product).order_by(Product.expiry_date.asc()).all()

    items: List[ProductResponse] = []
    total_units = 0
    safe_count = 0
    expiring_soon_count = 0
    expired_count = 0
    low_stock_count = 0

    for prod in products:
        item = format_product_response(prod)
        items.append(item)

        total_units += prod.quantity
        if prod.is_low_stock:
            low_stock_count += 1

        if item.status == "SAFE":
            safe_count += 1
        elif item.status == "EXPIRING_SOON":
            expiring_soon_count += 1
        elif item.status == "EXPIRED":
            expired_count += 1

    stats = InventoryStats(
        product_types=len(products),
        total_units=total_units,
        expiring_soon=expiring_soon_count,
        expired=expired_count,
        low_stock=low_stock_count,
    )

    return InventoryListResponse(items=items, stats=stats)


@app.get("/inventory/{product_id}", response_model=ProductResponse, tags=["Inventory"])
@app.get("/api/inventory/{product_id}", response_model=ProductResponse, tags=["Inventory"])
def get_product(product_id: int, db: Session = Depends(get_db)):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product with ID {product_id} not found."
        )
    return format_product_response(product)


@app.post("/inventory", response_model=ProductResponse, status_code=status.HTTP_201_CREATED, tags=["Inventory"])
@app.post("/api/inventory", response_model=ProductResponse, status_code=status.HTTP_201_CREATED, tags=["Inventory"])
def add_product(payload: ProductCreate, db: Session = Depends(get_db)):
    name_clean = payload.name.strip()
    category_clean = payload.category.strip()

    # Prevent duplicates
    existing = db.query(Product).filter(Product.name.ilike(name_clean)).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Product '{name_clean}' already exists in inventory."
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
        quantity=max(0, payload.quantity),
        minimum_stock=max(0, payload.minimum_stock),
        price=max(0.0, payload.price),
        image_path=payload.image_path,
    )
    db.add(new_product)
    db.commit()
    db.refresh(new_product)

    # Optional initial batch creation
    if payload.batch_number and payload.batch_number.strip():
        init_batch = Batch(
            product_id=new_product.id,
            batch_number=payload.batch_number.strip(),
            quantity=new_product.quantity,
            expiry_date=exp_date,
        )
        db.add(init_batch)

    # Initial stock movement tracking
    init_movement = StockMovement(
        product_id=new_product.id,
        previous_quantity=0,
        quantity_change=new_product.quantity,
        new_quantity=new_product.quantity,
        reason="Initial Intake",
        user_id="System Admin",
    )
    db.add(init_movement)
    db.commit()
    db.refresh(new_product)

    return format_product_response(new_product)


@app.post("/upload-image", tags=["Inventory"])
@app.post("/api/upload-image", tags=["Inventory"])
async def upload_product_image(file: UploadFile = File(...)):
    """
    Uploads a product picture, saves it to static uploads directory,
    and returns its accessible static URL path.
    """
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File provided is not a valid image format (JPEG, PNG, WebP supported)."
        )

    # Validate file extension
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in [".jpg", ".jpeg", ".png", ".webp", ".gif"]:
        ext = ".jpg"

    safe_token = uuid.uuid4().hex[:8]
    clean_stem = re.sub(r"[^a-zA-Z0-9_-]", "_", os.path.splitext(file.filename or "prod")[0])[:20]
    out_filename = f"{clean_stem}_{safe_token}{ext}"

    out_path = os.path.join(upload_dir, out_filename)
    content = await file.read()
    with open(out_path, "wb") as f:
        f.write(content)

    # Mirror to alternate upload dirs if present
    for alt_dir in CANDIDATE_UPLOAD_DIRS:
        if os.path.exists(alt_dir) and os.path.abspath(alt_dir) != os.path.abspath(upload_dir):
            try:
                with open(os.path.join(alt_dir, out_filename), "wb") as f:
                    f.write(content)
            except Exception:
                pass

    return {
        "filename": out_filename,
        "image_path": f"/uploads/{out_filename}",
        "url": f"/uploads/{out_filename}",
        "message": "Image uploaded successfully",
    }


@app.get("/sample-images", tags=["Vision & Inventory Scan"])
@app.get("/api/sample-images", tags=["Vision & Inventory Scan"])
def get_sample_images():
    """Returns list of curated test images from the dataset for quick 1-click scanning and testing."""
    samples = [
        {"name": "Maggi 2-Min Noodles", "label": "maggie", "image_url": "/uploads/maggie.jpg", "category": "Food"},
        {"name": "Brooke Bond Red Label Tea", "label": "tea_powder", "image_url": "/uploads/tea_powder.jpg", "category": "Beverage"},
        {"name": "Colgate Toothpaste", "label": "toothpaste", "image_url": "/uploads/toothpaste.jpg", "category": "Personal Care"},
        {"name": "Parle-G Glucose Biscuits", "label": "biscuits", "image_url": "/uploads/biscuits.jpg", "category": "Snack"},
        {"name": "Tata Crystal Salt", "label": "salt", "image_url": "/uploads/salt.jpg", "category": "Pantry"},
        {"name": "Horlicks Health Drink", "label": "horlicks", "image_url": "/uploads/horlicks.jpg", "category": "Health Drink"},
        {"name": "Harpic Power Cleaner", "label": "harpic", "image_url": "/uploads/harpic.jpg", "category": "Cleaning"},
        {"name": "Kissan Tomato Sauce", "label": "kissan", "image_url": "/uploads/kissan.jpg", "category": "Food"},
        {"name": "Refined Cooking Oil", "label": "oil", "image_url": "/uploads/oil.jpg", "category": "Cooking Oil"},
        {"name": "Dark Soya Sauce", "label": "soya_sos", "image_url": "/uploads/soya_sauce.jpg", "category": "Food"},
        {"name": "Coriander Powder", "label": "coriander_powder", "image_url": "/uploads/coriander_powder.jpg", "category": "Spice"},
    ]
    return samples


@app.put("/inventory/{product_id}", response_model=ProductResponse, tags=["Inventory"])
@app.put("/api/inventory/{product_id}", response_model=ProductResponse, tags=["Inventory"])
def update_product(product_id: int, payload: ProductUpdate, db: Session = Depends(get_db)):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product with ID {product_id} not found."
        )

    old_qty = product.quantity

    if payload.name is not None and payload.name.strip():
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
        new_qty = max(0, payload.quantity)
        if new_qty != old_qty:
            movement = StockMovement(
                product_id=product.id,
                previous_quantity=old_qty,
                quantity_change=new_qty - old_qty,
                new_quantity=new_qty,
                reason="Manual Quantity Edit",
                user_id="Inventory Manager",
            )
            db.add(movement)
        product.quantity = new_qty

    if payload.minimum_stock is not None:
        product.minimum_stock = max(0, payload.minimum_stock)

    if payload.price is not None:
        product.price = max(0.0, payload.price)

    if payload.image_path is not None:
        product.image_path = payload.image_path.strip() if payload.image_path.strip() else None

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


@app.post("/inventory/{product_id}/stock", response_model=StockUpdateResponse, tags=["Inventory"])
@app.post("/api/inventory/{product_id}/stock", response_model=StockUpdateResponse, tags=["Inventory"])
def update_product_stock(product_id: int, payload: StockUpdateRequest, db: Session = Depends(get_db)):
    """
    Directly updates stock from Scanner action (+1, +5, custom delta, or absolute quantity).
    Updates scan_history record if scan_id is provided and logs stock movement audit entry.
    """
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product with ID {product_id} not found."
        )

    old_qty = product.quantity
    update_desc = None

    if payload.quantity is not None:
        new_qty = max(0, payload.quantity)
        update_desc = f"Set to {new_qty}"
    elif payload.delta is not None:
        new_qty = max(0, old_qty + payload.delta)
        update_desc = f"{'+' if payload.delta > 0 else ''}{payload.delta}"
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Must provide either 'delta' or 'quantity'."
        )

    product.quantity = new_qty

    # Record Stock Movement Audit Trail
    movement = StockMovement(
        product_id=product.id,
        batch_id=payload.batch_id,
        previous_quantity=old_qty,
        quantity_change=new_qty - old_qty,
        new_quantity=new_qty,
        reason=payload.reason or update_desc or "Stock Adjustment",
        user_id="Scanner / Staff",
    )
    db.add(movement)

    # Link update to scan history if provided
    if payload.scan_id:
        scan_record = db.query(ScanHistory).filter(ScanHistory.id == payload.scan_id).first()
        if scan_record:
            scan_record.stock_updated = update_desc

    db.commit()
    db.refresh(product)

    return StockUpdateResponse(
        message=f"Stock updated successfully. {product.name}: {old_qty} → {new_qty}",
        product_id=product.id,
        product_name=product.name,
        old_quantity=old_qty,
        new_quantity=new_qty,
        is_low_stock=product.is_low_stock,
        recommended_restock=product.recommended_restock,
    )


@app.delete("/inventory/{product_id}", status_code=status.HTTP_200_OK, tags=["Inventory"])
@app.delete("/api/inventory/{product_id}", status_code=status.HTTP_200_OK, tags=["Inventory"])
def delete_product(product_id: int, db: Session = Depends(get_db)):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product with ID {product_id} not found."
        )

    prod_name = product.name
    db.delete(product)
    db.commit()
    return {"message": f"Product '{prod_name}' deleted successfully", "id": product_id}


# -------------------------------------------------------------
# Batch Management & FEFO Recommendations (Phase 2)
# -------------------------------------------------------------
@app.post("/inventory/{product_id}/batches", response_model=BatchResponse, status_code=status.HTTP_201_CREATED, tags=["Batches"])
@app.post("/api/inventory/{product_id}/batches", response_model=BatchResponse, status_code=status.HTTP_201_CREATED, tags=["Batches"])
def add_batch(product_id: int, payload: BatchCreate, db: Session = Depends(get_db)):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Product with ID {product_id} not found.")

    try:
        exp_date = datetime.strptime(payload.expiry_date.strip(), "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid expiry_date format. Please use YYYY-MM-DD.")

    mfg_date = None
    if payload.manufacturing_date and payload.manufacturing_date.strip():
        try:
            mfg_date = datetime.strptime(payload.manufacturing_date.strip(), "%Y-%m-%d").date()
        except ValueError:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid manufacturing_date format. Please use YYYY-MM-DD.")

    batch = Batch(
        product_id=product.id,
        batch_number=payload.batch_number.strip(),
        quantity=max(1, payload.quantity),
        manufacturing_date=mfg_date,
        expiry_date=exp_date,
    )
    db.add(batch)

    # Increase product stock by batch quantity
    old_qty = product.quantity
    product.quantity += batch.quantity

    # If this batch expires sooner than current product expiry, update product expiry
    if not product.expiry_date or exp_date < product.expiry_date:
        product.expiry_date = exp_date

    movement = StockMovement(
        product_id=product.id,
        batch_id=batch.id,
        previous_quantity=old_qty,
        quantity_change=batch.quantity,
        new_quantity=product.quantity,
        reason=f"New Batch: {batch.batch_number}",
        user_id="Batch Intake",
    )
    db.add(movement)

    db.commit()
    db.refresh(batch)
    db.refresh(product)
    return BatchResponse(**batch.to_dict())


@app.get("/inventory/{product_id}/batches", response_model=List[BatchResponse], tags=["Batches"])
@app.get("/api/inventory/{product_id}/batches", response_model=List[BatchResponse], tags=["Batches"])
def get_product_batches(product_id: int, db: Session = Depends(get_db)):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Product with ID {product_id} not found.")

    batches = db.query(Batch).filter(Batch.product_id == product_id).order_by(Batch.expiry_date.asc()).all()
    return [BatchResponse(**b.to_dict()) for b in batches]


@app.get("/inventory/{product_id}/fefo", response_model=FEFORecommendation, tags=["Batches"])
@app.get("/api/inventory/{product_id}/fefo", response_model=FEFORecommendation, tags=["Batches"])
def get_fefo_recommendation(product_id: int, db: Session = Depends(get_db)):
    """First-Expiry, First-Out (FEFO) Recommendation for optimal shelf-life rotation."""
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Product with ID {product_id} not found.")

    active_batches = (
        db.query(Batch)
        .filter(Batch.product_id == product_id, Batch.quantity > 0)
        .order_by(Batch.expiry_date.asc())
        .all()
    )

    if not active_batches:
        days_left = (product.expiry_date - date.today()).days if product.expiry_date else 0
        return FEFORecommendation(
            has_recommendation=False,
            recommended_batch=None,
            message=f"No individual batches registered. Main stock expires in {days_left} days ({product.expiry_date})."
        )

    earliest = active_batches[0]
    days_left = (earliest.expiry_date - date.today()).days
    if days_left < 0:
        msg = f"⚠️ FEFO Alert: Batch '{earliest.batch_number}' is EXPIRED ({abs(days_left)} days ago). Isolate and dispose immediately!"
    elif days_left <= 30:
        msg = f"⏳ FEFO Priority: Use Batch '{earliest.batch_number}' first ({earliest.quantity} units, expires in {days_left} days)."
    else:
        msg = f"✅ FEFO Recommendation: Use Batch '{earliest.batch_number}' first ({earliest.quantity} units, expires on {earliest.expiry_date})."

    return FEFORecommendation(
        has_recommendation=True,
        recommended_batch=BatchResponse(**earliest.to_dict()),
        message=msg
    )


# -------------------------------------------------------------
# Stock Movement Audit Trail (Phase 4)
# -------------------------------------------------------------
@app.get("/stock-movements", response_model=List[StockMovementResponse], tags=["Stock Movements"])
@app.get("/api/stock-movements", response_model=List[StockMovementResponse], tags=["Stock Movements"])
def get_stock_movements(product_id: Optional[int] = None, limit: int = 50, db: Session = Depends(get_db)):
    """Fetches chronological stock movements / audit trail."""
    query = db.query(StockMovement)
    if product_id:
        query = query.filter(StockMovement.product_id == product_id)
    movements = query.order_by(StockMovement.created_at.desc()).limit(limit).all()
    return [StockMovementResponse(**m.to_dict()) for m in movements]


# -------------------------------------------------------------
# Notification Center (Phase 4)
# -------------------------------------------------------------
def sync_inventory_notifications(db: Session):
    """Synchronizes active database alerts into notifications table if not already present unread."""
    products = db.query(Product).all()
    today = date.today()

    for p in products:
        if not p.expiry_date:
            continue
        days = (p.expiry_date - today).days

        # Expired check
        if days < 0:
            existing = (
                db.query(Notification)
                .filter(Notification.product_id == p.id, Notification.type == "EXPIRED", Notification.is_read == False)
                .first()
            )
            if not existing:
                db.add(Notification(
                    type="EXPIRED",
                    product_id=p.id,
                    message=f"Product '{p.name}' expired {abs(days)} days ago ({p.expiry_date}).",
                ))

        # Expiring soon check
        elif days <= EXPIRY_THRESHOLD_DAYS:
            existing = (
                db.query(Notification)
                .filter(Notification.product_id == p.id, Notification.type == "EXPIRING_SOON", Notification.is_read == False)
                .first()
            )
            if not existing:
                db.add(Notification(
                    type="EXPIRING_SOON",
                    product_id=p.id,
                    message=f"Product '{p.name}' expires in {days} day(s) ({p.expiry_date}).",
                ))

        # Low stock check
        if p.is_low_stock:
            existing = (
                db.query(Notification)
                .filter(Notification.product_id == p.id, Notification.type == "LOW_STOCK", Notification.is_read == False)
                .first()
            )
            if not existing:
                db.add(Notification(
                    type="LOW_STOCK",
                    product_id=p.id,
                    message=f"Low Stock: '{p.name}' has {p.quantity} units (min threshold: {p.minimum_stock}). Restock recommendation: +{p.recommended_restock}.",
                ))

    db.commit()


@app.get("/notifications", response_model=List[NotificationResponse], tags=["Notifications"])
@app.get("/api/notifications", response_model=List[NotificationResponse], tags=["Notifications"])
def get_notifications(limit: int = 50, db: Session = Depends(get_db)):
    """Fetches real-time system notifications synchronized with active pantry alerts."""
    sync_inventory_notifications(db)
    notifs = (
        db.query(Notification)
        .order_by(Notification.is_read.asc(), Notification.created_at.desc())
        .limit(limit)
        .all()
    )
    return [NotificationResponse(**n.to_dict()) for n in notifs]


@app.post("/notifications/{notification_id}/read", status_code=status.HTTP_200_OK, tags=["Notifications"])
@app.post("/api/notifications/{notification_id}/read", status_code=status.HTTP_200_OK, tags=["Notifications"])
def mark_notification_read(notification_id: int, db: Session = Depends(get_db)):
    notif = db.query(Notification).filter(Notification.id == notification_id).first()
    if notif:
        notif.is_read = True
        db.commit()
    return {"message": "Notification marked as read", "id": notification_id}


@app.post("/notifications/read-all", status_code=status.HTTP_200_OK, tags=["Notifications"])
@app.post("/api/notifications/read-all", status_code=status.HTTP_200_OK, tags=["Notifications"])
def mark_all_notifications_read(db: Session = Depends(get_db)):
    db.query(Notification).filter(Notification.is_read == False).update({Notification.is_read: True})
    db.commit()
    return {"message": "All notifications marked as read"}


# -------------------------------------------------------------
# Report Export Endpoint (Phase 5)
# -------------------------------------------------------------
@app.get("/reports/export", tags=["Reports"])
@app.get("/api/reports/export", tags=["Reports"])
def export_inventory_report(format: str = "csv", db: Session = Depends(get_db)):
    """Exports inventory data in CSV or JSON format."""
    products = db.query(Product).order_by(Product.name.asc()).all()

    if format.lower() == "json":
        items = [format_product_response(p).model_dump() for p in products]
        return JSONResponse(
            content=items,
            headers={
                "Content-Disposition": f"attachment; filename=inventory_report_{date.today()}.json"
            }
        )

    # CSV Export
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Product ID",
        "Product Name",
        "Category",
        "Quantity In Stock",
        "Minimum Stock",
        "Target Stock",
        "Unit Price ($)",
        "Total Inventory Value ($)",
        "Expiry Date",
        "Days Left",
        "Expiry Status",
        "Is Low Stock",
        "Recommended Restock Units",
    ])

    today = date.today()
    for p in products:
        days_left, status_val = calculate_expiry_status(p.expiry_date)
        total_val = round(p.quantity * float(p.price), 2)
        writer.writerow([
            p.id,
            p.name,
            p.category,
            p.quantity,
            p.minimum_stock,
            p.target_stock,
            p.price,
            total_val,
            p.expiry_date.strftime("%Y-%m-%d") if p.expiry_date else "",
            days_left,
            status_val,
            "YES" if p.is_low_stock else "NO",
            p.recommended_restock,
        ])

    csv_data = output.getvalue()
    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename=inventory_report_{date.today()}.csv"
        }
    )


# -------------------------------------------------------------
# Vision ML & Scanner Endpoints
# -------------------------------------------------------------
@app.post("/predict", response_model=PredictResponse, tags=["ML Prediction"])
@app.post("/api/predict", response_model=PredictResponse, tags=["ML Prediction"])
async def predict_image(file: UploadFile = File(...)):
    """Runs KNN image classification, returning predicted label and confidence."""
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File provided is not a valid image format."
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
    Primary endpoint:
    1. Runs vision classification (KNN).
    2. Searches SQLite inventory.
    3. Logs event to scan_history.
    4. Evaluates OCR expiry detection architecture.
    5. Returns unified product, stock, expiry, and stock action attributes.
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
            detail=f"Scan error: {str(e)}"
        )

    predicted_label = prediction["product_name"]
    confidence = prediction["confidence"]
    model_type = prediction["model_type"]

    all_products = db.query(Product).all()
    matched_product = match_product_with_inventory(predicted_label, all_products)

    # Log to scan history table
    scan_log = ScanHistory(
        product_id=matched_product.id if matched_product else None,
        predicted_name=predicted_label,
        confidence=confidence,
        inventory_found=matched_product is not None,
    )
    db.add(scan_log)
    db.commit()
    db.refresh(scan_log)

    conf_tier = "High confidence" if confidence >= 80 else ("Medium confidence" if confidence >= 60 else "Low confidence")
    if matched_product:
        days_left, status_val = calculate_expiry_status(matched_product.expiry_date)
        ocr_result = extract_expiry_date_ocr(
            image_bytes,
            database_expiry=matched_product.expiry_date.strftime("%Y-%m-%d")
        )

        # Batch & FEFO resolution
        batch_list = [BatchResponse(**b.to_dict()) for b in matched_product.batches]
        fefo_rec = None
        active_batches = [b for b in matched_product.batches if b.quantity > 0]
        if active_batches:
            active_batches.sort(key=lambda b: b.expiry_date)
            earliest = active_batches[0]
            dl = (earliest.expiry_date - date.today()).days
            fefo_rec = FEFORecommendation(
                has_recommendation=True,
                recommended_batch=BatchResponse(**earliest.to_dict()),
                message=f"FEFO Priority: Dispense Batch '{earliest.batch_number}' first ({earliest.quantity} units, expires in {dl}d)",
            )

        return ScanResponse(
            scan_id=scan_log.id,
            product_name=matched_product.name,
            detected_label=predicted_label,
            category=matched_product.category,
            quantity=matched_product.quantity,
            minimum_stock=matched_product.minimum_stock,
            target_stock=getattr(matched_product, "target_stock", 15) or 15,
            is_low_stock=matched_product.is_low_stock,
            recommended_restock=matched_product.recommended_restock,
            price=round(float(matched_product.price), 2),
            expiry_date=matched_product.expiry_date.strftime("%Y-%m-%d"),
            days_left=days_left,
            status=status_val,
            confidence=confidence,
            confidence_tier=conf_tier,
            in_inventory=True,
            inventory_id=matched_product.id,
            image_path=matched_product.image_path,
            model_type=model_type,
            ocr=OCRScanResponse(**ocr_result) if isinstance(ocr_result, dict) else None,
            ocr_info=ocr_result,
            batches=batch_list,
            fefo_recommendation=fefo_rec,
        )
    else:
        display_name = predicted_label.replace("_", " ").title()
        ocr_result = extract_expiry_date_ocr(image_bytes, database_expiry=None)

        return ScanResponse(
            scan_id=scan_log.id,
            product_name=display_name,
            detected_label=predicted_label,
            category="Uncategorized",
            quantity=0,
            minimum_stock=5,
            target_stock=15,
            is_low_stock=False,
            recommended_restock=0,
            price=0.0,
            expiry_date="Not in Inventory",
            days_left=0,
            status="UNKNOWN",
            confidence=confidence,
            confidence_tier=conf_tier,
            in_inventory=False,
            inventory_id=None,
            image_path=None,
            model_type=model_type,
            ocr=OCRScanResponse(**ocr_result) if isinstance(ocr_result, dict) else None,
            ocr_info=ocr_result,
        )


# -------------------------------------------------------------
# Alerts & Analytics Endpoints
# -------------------------------------------------------------
@app.get("/alerts", response_model=AlertsResponse, tags=["Alerts"])
@app.get("/api/alerts", response_model=AlertsResponse, tags=["Alerts"])
def get_alerts(db: Session = Depends(get_db)):
    products = db.query(Product).all()

    expired_list: List[ProductResponse] = []
    low_stock_list: List[ProductResponse] = []
    expiring_soon_list: List[ProductResponse] = []

    for prod in products:
        item = format_product_response(prod)

        if item.status == "EXPIRED":
            expired_list.append(item)
        elif item.status == "EXPIRING_SOON":
            expiring_soon_list.append(item)

        if prod.is_low_stock:
            low_stock_list.append(item)

    return AlertsResponse(
        expired=expired_list,
        low_stock=low_stock_list,
        expiring_soon=expiring_soon_list,
        summary={
            "total_alerts": len(expired_list) + len(low_stock_list) + len(expiring_soon_list),
            "expired_count": len(expired_list),
            "low_stock_count": len(low_stock_list),
            "expiring_soon_count": len(expiring_soon_list),
        }
    )


@app.get("/analytics", response_model=AnalyticsResponse, tags=["Analytics"])
@app.get("/api/analytics", response_model=AnalyticsResponse, tags=["Analytics"])
def get_analytics(db: Session = Depends(get_db)):
    products = db.query(Product).all()

    # 1. Category Stock distribution
    cat_counts: Dict[str, int] = {}
    cat_prods: Dict[str, int] = {}
    for p in products:
        cat_counts[p.category] = cat_counts.get(p.category, 0) + p.quantity
        cat_prods[p.category] = cat_prods.get(p.category, 0) + 1

    category_stock = [
        {
            "category": k,
            "units": v,
            "total_units": v,
            "count": cat_prods[k],
            "product_count": cat_prods[k],
        }
        for k, v in sorted(cat_counts.items(), key=lambda x: x[1], reverse=True)
    ]

    # 2. Product Quantities vs Min Stock
    product_quantities = [
        {
            "name": p.name,
            "quantity": p.quantity,
            "minimum_stock": p.minimum_stock,
            "is_low_stock": p.is_low_stock,
            "category": p.category,
        }
        for p in sorted(products, key=lambda x: x.quantity, reverse=True)
    ]

    # 3. Expiry Distribution
    expiry_dist = {"safe": 0, "expiring_soon": 0, "expired": 0}
    for p in products:
        days_left, st = calculate_expiry_status(p.expiry_date)
        if st == "SAFE":
            expiry_dist["safe"] += 1
        elif st == "EXPIRING_SOON":
            expiry_dist["expiring_soon"] += 1
        elif st == "EXPIRED":
            expiry_dist["expired"] += 1

    # 4. Low stock products
    low_stock_products = [
        {
            "id": p.id,
            "name": p.name,
            "quantity": p.quantity,
            "minimum_stock": p.minimum_stock,
            "deficit": max(0, p.minimum_stock - p.quantity),
            "category": p.category,
        }
        for p in products if p.is_low_stock
    ]

    # 5. Inventory Health Score
    total_p = len(products)
    if total_p > 0:
        safe_count = expiry_dist["safe"]
        non_low_stock = sum(1 for p in products if not p.is_low_stock)
        in_stock_count = sum(1 for p in products if p.quantity > 0)

        stock_health = round((non_low_stock / total_p) * 100)
        expiry_health = round((safe_count / total_p) * 100)
        availability_score = round((in_stock_count / total_p) * 100)
        overall_score = round(0.4 * stock_health + 0.4 * expiry_health + 0.2 * availability_score)

        if overall_score >= 80:
            grade = "Good"
        elif overall_score >= 50:
            grade = "Moderate"
        else:
            grade = "Critical"

        health_details = [
            f"Stock health: {stock_health}% of items above minimum threshold",
            f"Expiry safety: {expiry_health}% of items in safe shelf-life window",
            f"Availability: {availability_score}% of inventory items in stock",
        ]
    else:
        overall_score = 100
        grade = "Good"
        stock_health = 100
        expiry_health = 100
        availability_score = 100
        health_details = ["No inventory items recorded."]

    health_score_data = HealthScoreResponse(
        overall_score=overall_score,
        grade=grade,
        stock_health=stock_health,
        expiry_health=expiry_health,
        availability_score=availability_score,
        total_products=total_p,
        details=health_details,
    )

    # 6. Rule-Based AI Inventory Insights
    insights: List[str] = []
    if expiry_dist["expired"] > 0:
        expired_names = [p.name for p in products if calculate_expiry_status(p.expiry_date)[1] == "EXPIRED"]
        insights.append(f"⚠️ {expiry_dist['expired']} product(s) have expired: {', '.join(expired_names[:3])}. Dispose or replace immediately.")

    if product_quantities:
        highest = product_quantities[0]
        insights.append(f"📦 {highest['name']} has the highest stock level with {highest['quantity']} units.")

    if low_stock_products:
        for ls in low_stock_products[:2]:
            insights.append(f"📉 {ls['name']} stock ({ls['quantity']}) is below its minimum threshold ({ls['minimum_stock']}). Consider restocking soon.")

    if expiry_dist["expiring_soon"] > 0:
        soon_names = [p.name for p in products if calculate_expiry_status(p.expiry_date)[1] == "EXPIRING_SOON"]
        insights.append(f"⏰ {expiry_dist['expiring_soon']} product(s) will expire within {EXPIRY_THRESHOLD_DAYS} days: {', '.join(soon_names[:3])}.")

    zero_stock = [p.name for p in products if p.quantity == 0]
    if zero_stock:
        insights.append(f"🚨 Out of stock: {', '.join(zero_stock)}. Reorder priority: Critical.")

    if not insights:
        insights.append("✅ All pantry inventory items are well-stocked and within their safe expiry window.")

    return AnalyticsResponse(
        category_distribution=category_stock,
        category_stock=category_stock,
        product_quantities=product_quantities,
        expiry_distribution=expiry_dist,
        low_stock_products=low_stock_products,
        insights=insights,
        health_score=health_score_data,
    )


# -------------------------------------------------------------
# Scan History Endpoint
# -------------------------------------------------------------
@app.get("/scan-history", response_model=List[ScanHistoryResponse], tags=["Scan History"])
@app.get("/api/scan-history", response_model=List[ScanHistoryResponse], tags=["Scan History"])
def get_scan_history(limit: int = 50, db: Session = Depends(get_db)):
    history = (
        db.query(ScanHistory)
        .order_by(ScanHistory.scanned_at.desc())
        .limit(limit)
        .all()
    )
    return [ScanHistoryResponse(**h.to_dict()) for h in history]


# -------------------------------------------------------------
# Single URL Frontend SPA Serving & Service Worker Purge
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

    @app.get("/sw.js", include_in_schema=False)
    def unregister_service_worker():
        """Cleans up and unregisters any stale service worker cached by the browser from previous projects."""
        script = """
        self.addEventListener('install', () => self.skipWaiting());
        self.addEventListener('activate', () => {
            self.registration.unregister().then(() => {
                self.clients.matchAll().then(clients => {
                    clients.forEach(client => client.navigate(client.url));
                });
            });
        });
        """
        return Response(content=script, media_type="application/javascript")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_frontend(full_path: str):
        # Exclude API endpoints from frontend catch-all
        if full_path.startswith((
            "api/", "inventory", "predict", "scan", "health",
            "alerts", "analytics", "scan-history", "docs", "openapi.json", "redoc",
            "uploads/", "upload-image", "sample-images"
        )):
            raise HTTPException(status_code=404, detail="Not Found")

        file_candidate = os.path.join(frontend_dist, full_path)
        if full_path and os.path.isfile(file_candidate):
            return FileResponse(file_candidate)

        index_file = os.path.join(frontend_dist, "index.html")
        if os.path.exists(index_file):
            return FileResponse(index_file)

        raise HTTPException(status_code=404, detail="Page not found")
