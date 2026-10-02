import sys
import os

# Change cwd to backend directory so paths resolve identically to production
backend_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "backend")
sys.path.insert(0, backend_path)

from app.database import seed_database_if_empty, SessionLocal
from app.models import Product
from app.ml.predict import predict_product, match_product_with_inventory

print("Testing database synchronization...")
seed_database_if_empty()

with SessionLocal() as db:
    products = db.query(Product).all()
    print(f"Total Products in DB: {len(products)}")
    for p in products:
        print(f"  - ID: {p.id} | Name: {p.name} | Cat: {p.category} | Qty: {p.quantity} | Image: {p.image_path}")

print("\nTesting ML Predictions on Sample Images:")
sample_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "sample_test_images")
for fname in sorted(os.listdir(sample_dir)):
    if not fname.endswith(".jpg"):
        continue
    fpath = os.path.join(sample_dir, fname)
    with open(fpath, "rb") as f:
        img_bytes = f.read()
    res = predict_product(img_bytes)
    matched = match_product_with_inventory(res["product_name"], products)
    print(f"File: {fname:<25} -> Pred: {res['product_name']:<18} ({res['confidence']}%) -> Matched DB: {matched.name if matched else 'None'}")

print("\nAll tests finished!")
