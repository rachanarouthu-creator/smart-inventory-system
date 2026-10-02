from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


class ProductBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    category: str = Field("Food", min_length=1, max_length=50)
    expiry_date: str = Field(..., description="Date in YYYY-MM-DD format")
    quantity: int = Field(1, ge=0)
    minimum_stock: int = Field(5, ge=0)
    target_stock: int = Field(15, ge=0)
    price: float = Field(0.0, ge=0.0)
    image_path: Optional[str] = None


class ProductCreate(ProductBase):
    batch_number: Optional[str] = None  # Optionally initialize with a named batch


class ProductUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    category: Optional[str] = Field(None, min_length=1, max_length=50)
    expiry_date: Optional[str] = Field(None, description="Date in YYYY-MM-DD format")
    quantity: Optional[int] = Field(None, ge=0)
    minimum_stock: Optional[int] = Field(None, ge=0)
    target_stock: Optional[int] = Field(None, ge=0)
    price: Optional[float] = Field(None, ge=0.0)
    image_path: Optional[str] = None


class BatchCreate(BaseModel):
    batch_number: str = Field(..., min_length=1, max_length=50)
    quantity: int = Field(..., ge=1)
    manufacturing_date: Optional[str] = None
    expiry_date: str = Field(..., description="Date in YYYY-MM-DD format")


class BatchResponse(BaseModel):
    id: int
    product_id: int
    product_name: str
    batch_number: str
    quantity: int
    manufacturing_date: Optional[str] = None
    expiry_date: str
    days_left: int
    status: str
    created_at: Optional[str] = None


class FEFORecommendation(BaseModel):
    has_recommendation: bool
    recommended_batch: Optional[BatchResponse] = None
    message: str


class ProductResponse(BaseModel):
    id: int
    name: str
    category: str
    expiry_date: str
    quantity: int
    minimum_stock: int
    target_stock: int = 15
    is_low_stock: bool
    recommended_restock: int = 0
    price: float
    image_path: Optional[str] = None
    batch_count: int = 0
    days_left: int
    status: str  # "SAFE", "EXPIRING_SOON", "EXPIRED"

    class Config:
        from_attributes = True


class StockUpdateRequest(BaseModel):
    delta: Optional[int] = None  # e.g., +1, +5, -1
    quantity: Optional[int] = None  # absolute override
    scan_id: Optional[int] = None  # link with a recent scan history record
    reason: Optional[str] = "Scanner Update"
    batch_id: Optional[int] = None


class StockUpdateResponse(BaseModel):
    message: str
    product_id: int
    product_name: str
    old_quantity: int
    new_quantity: int
    is_low_stock: bool
    recommended_restock: int = 0


class StockMovementResponse(BaseModel):
    id: int
    product_id: int
    product_name: str
    batch_id: Optional[int] = None
    previous_quantity: int
    quantity_change: int
    new_quantity: int
    reason: str
    user_id: str
    created_at: str


class NotificationResponse(BaseModel):
    id: int
    type: str
    message: str
    product_id: Optional[int] = None
    is_read: bool
    created_at: str


class HealthScoreResponse(BaseModel):
    overall_score: int
    grade: str  # "Good", "Moderate", "Critical"
    stock_health: int
    expiry_health: int
    availability_score: int
    total_products: int
    details: List[str]


class InventoryStats(BaseModel):
    product_types: int  # Number of unique products
    total_units: int    # Sum of stock units
    expiring_soon: int  # Threshold <= 30 days
    expired: int        # Past expiry
    low_stock: int      # Quantity <= minimum_stock
    health_score: Optional[int] = None


class InventoryListResponse(BaseModel):
    items: List[ProductResponse]
    stats: InventoryStats


class PredictResponse(BaseModel):
    product_name: str
    confidence: float
    model_type: str


class OCRScanResponse(BaseModel):
    available: Optional[bool] = None
    detected: bool = False
    detected_expiry: Optional[str] = None
    database_expiry: Optional[str] = None
    match_confirmed: Optional[bool] = None
    message: str = ""


class ScanResponse(BaseModel):
    scan_id: Optional[int] = None
    product_name: str
    detected_label: str
    category: str
    quantity: int = 0
    minimum_stock: int = 5
    target_stock: int = 15
    is_low_stock: bool = False
    recommended_restock: int = 0
    price: float = 0.0
    expiry_date: str = ""
    days_left: int = 0
    status: str = "UNKNOWN"
    confidence: float
    confidence_tier: str = "High confidence"  # "High confidence", "Medium confidence", "Low confidence"
    in_inventory: bool
    inventory_id: Optional[int] = None
    image_path: Optional[str] = None
    model_type: str = "KNN"
    ocr: Optional[OCRScanResponse] = None
    ocr_info: Optional[Dict[str, Any]] = None
    batches: List[BatchResponse] = []
    fefo_recommendation: Optional[FEFORecommendation] = None


class ScanHistoryResponse(BaseModel):
    id: int
    product_id: Optional[int] = None
    product_name: str
    predicted_name: str
    category: str
    confidence: float
    scanned_at: str
    inventory_found: bool
    stock_updated: Optional[str] = None


class AlertsResponse(BaseModel):
    expired: List[ProductResponse]
    low_stock: List[ProductResponse]
    expiring_soon: List[ProductResponse]
    summary: Dict[str, int]


class AnalyticsResponse(BaseModel):
    category_distribution: List[Dict[str, Any]]
    category_stock: Optional[List[Dict[str, Any]]] = None
    product_quantities: List[Dict[str, Any]]
    expiry_distribution: Dict[str, int]
    low_stock_products: List[Dict[str, Any]]
    insights: List[str]
    health_score: HealthScoreResponse
