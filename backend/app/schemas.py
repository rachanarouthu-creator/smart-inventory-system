from typing import Optional, List
from pydantic import BaseModel, Field


class ProductBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    category: str = Field("Food", min_length=1, max_length=50)
    expiry_date: str = Field(..., description="Date in YYYY-MM-DD format")
    quantity: int = Field(1, ge=0)


class ProductCreate(ProductBase):
    pass


class ProductUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    category: Optional[str] = Field(None, min_length=1, max_length=50)
    expiry_date: Optional[str] = Field(None, description="Date in YYYY-MM-DD format")
    quantity: Optional[int] = Field(None, ge=0)


class ProductResponse(BaseModel):
    id: int
    name: str
    category: str
    expiry_date: str
    quantity: int
    days_left: int
    status: str  # "SAFE", "EXPIRING_SOON", "EXPIRED"

    class Config:
        from_attributes = True


class InventoryStats(BaseModel):
    total: int
    safe: int
    expiring_soon: int
    expired: int


class InventoryListResponse(BaseModel):
    items: List[ProductResponse]
    stats: InventoryStats


class PredictResponse(BaseModel):
    product_name: str
    confidence: float
    model_type: str


class ScanResponse(BaseModel):
    product_name: str
    detected_label: str
    category: str
    quantity: int
    expiry_date: str
    days_left: int
    status: str
    confidence: float
    in_inventory: bool
    inventory_id: Optional[int] = None
    model_type: str
