import os
import sys
from fastapi.testclient import TestClient

from app.main import app

def run_tests():
    print("=== Testing FastAPI Endpoints with TestClient ===")
    client = TestClient(app)

    # 1. Health Check
    res = client.get("/api/health")
    assert res.status_code == 200, f"Health check failed: {res.text}"
    print("  [PASS] /api/health passed:", res.json())

    # 2. Inventory GET
    res = client.get("/inventory")
    assert res.status_code == 200, f"Get inventory failed: {res.text}"
    data = res.json()
    items = data["items"]
    stats = data["stats"]
    print(f"  [PASS] /inventory returned {len(items)} items. Stats: {stats}")
    assert len(items) >= 5, "Expected at least 5 seeded items"

    # 3. Add Product POST
    new_prod = {
        "name": "Organic Honey Test",
        "category": "Food",
        "expiry_date": "2027-05-15",
        "quantity": 3
    }
    res = client.post("/inventory", json=new_prod)
    assert res.status_code == 201, f"Add product failed: {res.text}"
    created_id = res.json()["id"]
    print(f"  [PASS] /inventory POST passed. Created ID: {created_id}")

    # 4. Update Product PUT
    res = client.put(f"/inventory/{created_id}", json={"quantity": 7})
    assert res.status_code == 200, f"Update product failed: {res.text}"
    assert res.json()["quantity"] == 7
    print(f"  [PASS] /inventory/{created_id} PUT passed. New quantity: {res.json()['quantity']}")

    # 5. Delete Product DELETE
    res = client.delete(f"/inventory/{created_id}")
    assert res.status_code == 200, f"Delete product failed: {res.text}"
    print(f"  [PASS] /inventory/{created_id} DELETE passed.")

    # 6. Predict Image POST
    sample_img = "dataset/horlicks/1786064787778.jpg"
    if not os.path.exists(sample_img):
        sample_img = "../dataset/horlicks/1786064787778.jpg"

    assert os.path.exists(sample_img), f"Test image not found at {sample_img}"
    with open(sample_img, "rb") as f:
        img_bytes = f.read()

    res = client.post("/predict", files={"file": ("horlicks.jpg", img_bytes, "image/jpeg")})
    assert res.status_code == 200, f"Predict failed: {res.text}"
    pred_data = res.json()
    print(f"  [PASS] /predict passed: {pred_data}")

    # 7. Scan Endpoint POST (Vision + Inventory Lookup)
    res = client.post("/scan", files={"file": ("horlicks.jpg", img_bytes, "image/jpeg")})
    assert res.status_code == 200, f"Scan failed: {res.text}"
    scan_data = res.json()
    print(f"  [PASS] /scan passed:")
    print(f"     - Product: {scan_data['product_name']}")
    print(f"     - Status: {scan_data['status']} ({scan_data['days_left']} days left)")
    print(f"     - Confidence: {scan_data['confidence']}%")
    print(f"     - In Inventory: {scan_data['in_inventory']}")

    print("\n[SUCCESS] All Backend Test Cases Passed Successfully!")

if __name__ == "__main__":
    run_tests()
