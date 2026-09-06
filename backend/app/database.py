import os
import csv
from datetime import datetime, date
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker, Session

# Priority for database path:
# 1. Explicit DATABASE_URL env var
# 2. Render persistent disk if /data directory exists: sqlite:////data/pantry.db
# 3. Local sqlite: sqlite:///./pantry.db
default_db_url = "sqlite:///./pantry.db"
if os.path.exists("/data") and os.path.isdir("/data"):
    default_db_url = "sqlite:////data/pantry.db"

DATABASE_URL = os.getenv("DATABASE_URL", default_db_url)

# Fix for postgres URL format if deployed with postgres on some platforms
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


def seed_database_if_empty():
    """Seeds initial products from products_seed.csv if the database table is empty."""
    from app.models import Product

    Base.metadata.create_all(bind=engine)

    with SessionLocal() as db:
        existing_count = db.query(Product).count()
        if existing_count > 0:
            return  # Already seeded

        # Search for products_seed.csv or products.csv in multiple candidate paths
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
            print("[Database] No seed CSV found. Starting with empty inventory.")
            return

        print(f"[Database] Seeding database from: {seed_file}")
        try:
            with open(seed_file, mode="r", encoding="utf-8") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    p_name = row.get("Product", "").strip()
                    p_cat = row.get("Category", "General").strip()
                    p_exp = row.get("ExpiryDate", "").strip()
                    p_qty = int(row.get("Quantity", 1))

                    if not p_name:
                        continue

                    # Parse date format YYYY-MM-DD
                    try:
                        exp_date = datetime.strptime(p_exp, "%Y-%m-%d").date()
                    except Exception:
                        exp_date = date.today()

                    product = Product(
                        name=p_name,
                        category=p_cat,
                        expiry_date=exp_date,
                        quantity=p_qty
                    )
                    db.add(product)
                db.commit()
                print(f"[Database] Successfully seeded initial inventory products.")
        except Exception as e:
            db.rollback()
            print(f"[Database] Error seeding database: {e}")
