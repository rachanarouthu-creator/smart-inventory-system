import sys
import os
import io

backend_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "backend")
sys.path.insert(0, backend_path)

from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_endpoints():
    # 1. Health
    r = client.get("/api/health")
    assert r.status_code == 200, f"Health check failed: {r.text}"
    print("[PASS] /api/health OK")

    # 2. Inventory
    r = client.get("/api/inventory")
    assert r.status_code == 200, f"Inventory fetch failed: {r.text}"
    data = r.json()
    assert len(data["items"]) >= 11
    print(f"[PASS] /api/inventory OK ({len(data['items'])} items returned)")

    # 3. Sample images
    r = client.get("/api/sample-images")
    assert r.status_code == 200
    samples = r.json()
    assert len(samples) == 11
    print(f"[PASS] /api/sample-images OK ({len(samples)} samples available)")

    # 4. Static uploads
    r = client.get("/uploads/maggie.jpg")
    assert r.status_code == 200
    assert len(r.content) > 1000
    print("[PASS] /uploads/maggie.jpg static image served OK")

    # 5. Image upload endpoint
    dummy_img = io.BytesIO(b"\xff\xd8\xff\xe0\x00\x10JFIF" + b"\x00" * 200)
    files = {"file": ("test_upload.jpg", dummy_img, "image/jpeg")}
    r = client.post("/api/upload-image", files=files)
    assert r.status_code == 200, f"Image upload failed: {r.text}"
    upload_res = r.json()
    assert "image_path" in upload_res
    print(f"[PASS] /api/upload-image OK -> {upload_res['image_path']}")

    # 6. Add product with image_path
    new_prod = {
        "name": "Unit Test Choco Chips",
        "category": "Snack",
        "quantity": 10,
        "minimum_stock": 3,
        "price": 45.0,
        "expiry_date": "2027-12-31",
        "image_path": upload_res["image_path"],
    }
    r = client.post("/api/inventory", json=new_prod)
    assert r.status_code in [201, 200], f"Add product failed: {r.text}"
    created = r.json()
    assert created["image_path"] == upload_res["image_path"]
    print(f"[PASS] /api/inventory (Add Product with Picture) OK -> ID {created['id']} with {created['image_path']}")

    # Delete the test product
    client.delete(f"/api/inventory/{created['id']}")

    print("\nAll API integration tests passed successfully!")

if __name__ == "__main__":
    test_endpoints()
