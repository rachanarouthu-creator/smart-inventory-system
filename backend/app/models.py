from datetime import datetime, date
from sqlalchemy import Column, Integer, String, Float, Boolean, Date, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.database import Base


class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String, unique=True, index=True, nullable=False)
    category = Column(String, default="Food", nullable=False)
    expiry_date = Column(Date, nullable=False)
    quantity = Column(Integer, default=1, nullable=False)
    minimum_stock = Column(Integer, default=5, nullable=False)
    target_stock = Column(Integer, default=15, nullable=False)
    price = Column(Float, default=0.0, nullable=False)
    image_path = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    scans = relationship("ScanHistory", back_populates="product", cascade="all, delete-orphan")
    batches = relationship("Batch", back_populates="product", cascade="all, delete-orphan", order_by="Batch.expiry_date")
    movements = relationship("StockMovement", back_populates="product", cascade="all, delete-orphan", order_by="desc(StockMovement.created_at)")

    @property
    def is_low_stock(self) -> bool:
        return self.quantity <= self.minimum_stock

    @property
    def recommended_restock(self) -> int:
        if self.quantity < self.minimum_stock:
            return max(0, self.target_stock - self.quantity)
        return 0

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "category": self.category,
            "expiry_date": self.expiry_date.strftime("%Y-%m-%d") if self.expiry_date else "",
            "quantity": self.quantity,
            "minimum_stock": self.minimum_stock,
            "target_stock": self.target_stock,
            "is_low_stock": self.is_low_stock,
            "recommended_restock": self.recommended_restock,
            "price": round(float(self.price), 2),
            "image_path": self.image_path,
            "batch_count": len(self.batches) if self.batches else 0,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class Batch(Base):
    __tablename__ = "batches"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False)
    batch_number = Column(String, nullable=False)  # e.g., "Batch A", "B2026-09"
    quantity = Column(Integer, default=1, nullable=False)
    manufacturing_date = Column(Date, nullable=True)
    expiry_date = Column(Date, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    product = relationship("Product", back_populates="batches")

    def to_dict(self):
        today = date.today()
        days_left = (self.expiry_date - today).days if self.expiry_date else 0
        return {
            "id": self.id,
            "product_id": self.product_id,
            "product_name": self.product.name if self.product else "Unknown",
            "batch_number": self.batch_number,
            "quantity": self.quantity,
            "manufacturing_date": self.manufacturing_date.strftime("%Y-%m-%d") if self.manufacturing_date else None,
            "expiry_date": self.expiry_date.strftime("%Y-%m-%d") if self.expiry_date else "",
            "days_left": days_left,
            "status": "EXPIRED" if days_left < 0 else "EXPIRING_SOON" if days_left <= 30 else "SAFE",
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class StockMovement(Base):
    __tablename__ = "stock_movements"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False)
    batch_id = Column(Integer, ForeignKey("batches.id", ondelete="SET NULL"), nullable=True)
    previous_quantity = Column(Integer, nullable=False)
    quantity_change = Column(Integer, nullable=False)  # e.g. +1, +5, -2
    new_quantity = Column(Integer, nullable=False)
    reason = Column(String, default="Stock Adjustment", nullable=False)  # "Scanner +1", "Manual update", "Batch restock"
    user_id = Column(String, default="System User", nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    product = relationship("Product", back_populates="movements")

    def to_dict(self):
        return {
            "id": self.id,
            "product_id": self.product_id,
            "product_name": self.product.name if self.product else "Unknown",
            "batch_id": self.batch_id,
            "previous_quantity": self.previous_quantity,
            "quantity_change": self.quantity_change,
            "new_quantity": self.new_quantity,
            "reason": self.reason,
            "user_id": self.user_id,
            "created_at": self.created_at.strftime("%d %b %Y, %I:%M %p"),
        }


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    type = Column(String, default="SYSTEM", nullable=False)  # "EXPIRED", "LOW_STOCK", "EXPIRING_SOON", "SCAN"
    message = Column(Text, nullable=False)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="SET NULL"), nullable=True)
    is_read = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    def to_dict(self):
        return {
            "id": self.id,
            "type": self.type,
            "message": self.message,
            "product_id": self.product_id,
            "is_read": self.is_read,
            "created_at": self.created_at.strftime("%d %b %Y, %I:%M %p"),
        }


class ScanHistory(Base):
    __tablename__ = "scan_history"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="SET NULL"), nullable=True)
    predicted_name = Column(String, nullable=False)
    confidence = Column(Float, nullable=False)
    scanned_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    inventory_found = Column(Boolean, default=False, nullable=False)
    stock_updated = Column(String, nullable=True)  # e.g., "+1", "+5", "Set to 12"

    product = relationship("Product", back_populates="scans")

    def to_dict(self):
        return {
            "id": self.id,
            "product_id": self.product_id,
            "product_name": self.product.name if self.product else self.predicted_name,
            "predicted_name": self.predicted_name,
            "category": self.product.category if self.product else "Uncategorized",
            "confidence": round(float(self.confidence), 1),
            "scanned_at": self.scanned_at.strftime("%d %b %Y, %I:%M %p"),
            "inventory_found": self.inventory_found,
            "stock_updated": self.stock_updated,
        }
