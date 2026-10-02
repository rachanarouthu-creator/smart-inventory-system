import os
import csv
from datetime import datetime, date
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import declarative_base, sessionmaker, Session

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
backend_db_path = os.path.join(backend_dir, "pantry.db")

default_db_url = f"sqlite:///{backend_db_path.replace(os.sep, '/')}"
if os.getenv("VERCEL"):
    default_db_url = "sqlite:////tmp/pantry.db"
elif os.path.exists("/data") and os.path.isdir("/data"):
    default_db_url = "sqlite:////data/pantry.db"

DATABASE_URL = os.getenv("DATABASE_URL", default_db_url)

if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

connect_args = {}
if DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False}

engine = create_engine(DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    """FastAPI dependency to yield database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def migrate_schema_if_needed():
    """Non-destructive SQLite schema migration to add new columns and tables if missing."""
    try:
        from app.models import Product, ScanHistory, Batch, StockMovement, Notification
        Base.metadata.create_all(bind=engine)
    except Exception:
        pass

    try:
        inspector = inspect(engine)
        if "products" in inspector.get_table_names():
            columns = [c["name"] for c in inspector.get_columns("products")]
            with engine.connect() as conn:
                if "minimum_stock" not in columns:
                    print("[Database Migration] Adding 'minimum_stock' column to products table...")
                    conn.execute(text("ALTER TABLE products ADD COLUMN minimum_stock INTEGER DEFAULT 5 NOT NULL"))
                    conn.commit()
                if "target_stock" not in columns:
                    print("[Database Migration] Adding 'target_stock' column to products table...")
                    conn.execute(text("ALTER TABLE products ADD COLUMN target_stock INTEGER DEFAULT 15 NOT NULL"))
                    conn.commit()
                if "price" not in columns:
                    print("[Database Migration] Adding 'price' column to products table...")
                    conn.execute(text("ALTER TABLE products ADD COLUMN price FLOAT DEFAULT 0.0 NOT NULL"))
                    conn.commit()
                if "image_path" not in columns:
                    print("[Database Migration] Adding 'image_path' column to products table...")
                    conn.execute(text("ALTER TABLE products ADD COLUMN image_path VARCHAR NULL"))
                    conn.commit()
    except Exception as e:
        print(f"[Database Migration] Warning: {e}")

# Run automatic migration on startup
migrate_schema_if_needed()


def seed_database_if_empty():
    """Creates tables, migrates missing columns, and seeds initial products if empty."""
    from app.models import Product, ScanHistory

    Base.metadata.create_all(bind=engine)
    migrate_schema_if_needed()

    with SessionLocal() as db:
        candidate_paths = [
            "products_seed.csv",
            "backend/products_seed.csv",
            os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "products_seed.csv"),
            os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "products.csv"),
            os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "products.csv"),
        ]

        seed_file = None
        for path in candidate_paths:
            if os.path.exists(path):
                seed_file = path
                break

        if not seed_file:
            print("[Database] No seed CSV found.")
            return

        print(f"[Database] Synchronizing database from seed: {seed_file}")
        try:
            with open(seed_file, mode="r", encoding="utf-8") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    p_name = row.get("Product", "").strip()
                    p_cat = row.get("Category", "General").strip()
                    p_exp = row.get("ExpiryDate", "").strip()
                    p_qty = int(row.get("Quantity", 1))
                    min_stock = int(row.get("MinimumStock", 5)) if row.get("MinimumStock") else 5
                    price_val = float(row.get("Price", 50.0)) if row.get("Price") else (150.0 if p_cat == "Health Drink" else 45.0)
                    img_path = row.get("ImagePath", "").strip() or None

                    if not p_name:
                        continue

                    try:
                        exp_date = datetime.strptime(p_exp, "%Y-%m-%d").date()
                    except Exception:
                        exp_date = date.today()

                    existing = db.query(Product).filter(Product.name.ilike(p_name)).first()
                    if existing:
                        # Update image_path if missing
                        if img_path and not existing.image_path:
                            existing.image_path = img_path
                    else:
                        product = Product(
                            name=p_name,
                            category=p_cat,
                            expiry_date=exp_date,
                            quantity=p_qty,
                            minimum_stock=min_stock,
                            price=price_val,
                            image_path=img_path,
                        )
                        db.add(product)
                db.commit()
                print("[Database] Inventory seeded & synchronized with images.")
        except Exception as e:
            db.rollback()
            print(f"[Database] Error synchronizing database: {e}")
