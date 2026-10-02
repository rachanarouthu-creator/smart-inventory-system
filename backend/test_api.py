import os
import sys

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")

from fastapi.testclient import TestClient
from app.main import app
from app.database import SessionLocal, engine
from app import models

def run_tests():
    print("=== Testing Smart Inventory AI Endpoints ===")
    client = TestClient(app)

    # 1. Health Check
    res = client.get("/api/health")
    assert res.status_code == 200, f"Health check failed: {res.text}"
    print("  [PASS] /api/health passed:", res.json()["service"])

    # 2. Inventory GET
    res = client.get("/inventory")
    assert res.status_code == 200, f"Get inventory failed: {res.text}"
    data = res.json()
    items = data["items"]
    stats = data["stats"]
    print(f"  [PASS] /inventory returned {len(items)} items. Product Types: {stats['product_types']}, Total Units: {stats['total_units']}, Low Stock: {stats['low_stock']}")
    assert len(items) >= 5, "Expected at least 5 seeded items"
    assert "minimum_stock" in items[0], "Expected minimum_stock in product response"

    # 3. Add Product POST
    import time
    test_prod_name = f"Test Almond Milk {int(time.time())}"
    new_prod = {
        "name": test_prod_name,
        "category": "Dairy",
        "expiry_date": "2027-05-15",
        "quantity": 6,
        "minimum_stock": 8,
        "price": 65.0,
    }
    res = client.post("/inventory", json=new_prod)
    assert res.status_code == 201, f"Add product failed: {res.text}"
    created_id = res.json()["id"]
    assert res.json()["is_low_stock"] is True, "6 units <= 8 min_stock should be low stock"
    print(f"  [PASS] /inventory POST passed. Created ID: {created_id}, Low Stock: {res.json()['is_low_stock']}")

    # 4. Stock Adjustment POST /inventory/{id}/stock
    res = client.post(f"/inventory/{created_id}/stock", json={"delta": 5})
    assert res.status_code == 200, f"Stock increment failed: {res.text}"
    assert res.json()["new_quantity"] == 11
    assert res.json()["is_low_stock"] is False, "11 units > 8 min_stock should not be low stock"
    print(f"  [PASS] /inventory/{created_id}/stock (+5 delta) passed: New Qty: {res.json()['new_quantity']}")

    # 5. Predict Image POST
    sample_img = "dataset/horlicks/1786064787778.jpg"
    if not os.path.exists(sample_img):
        sample_img = "../dataset/horlicks/1786064787778.jpg"

    assert os.path.exists(sample_img), f"Test image not found at {sample_img}"
    with open(sample_img, "rb") as f:
        img_bytes = f.read()

    res = client.post("/predict", files={"file": ("horlicks.jpg", img_bytes, "image/jpeg")})
    assert res.status_code == 200, f"Predict failed: {res.text}"
    pred_data = res.json()
    print(f"  [PASS] /predict passed: {pred_data['product_name']} ({pred_data['confidence']}%)")

    # 6. Scan Endpoint POST (Vision + Inventory Lookup + History logging)
    res = client.post("/scan", files={"file": ("horlicks.jpg", img_bytes, "image/jpeg")})
    assert res.status_code == 200, f"Scan failed: {res.text}"
    scan_data = res.json()
    scan_id = scan_data["scan_id"]
    print(f"  [PASS] /scan passed: {scan_data['product_name']} - Stock: {scan_data['quantity']}, Status: {scan_data['status']}, Scan ID: {scan_id}")

    # 7. Stock increment linked to scan_id
    if scan_data["inventory_id"]:
        res = client.post(f"/inventory/{scan_data['inventory_id']}/stock", json={"delta": 1, "scan_id": scan_id})
        assert res.status_code == 200
        print(f"  [PASS] /inventory/{scan_data['inventory_id']}/stock (+1 from scanner) passed")

    # 8. Alerts GET
    res = client.get("/alerts")
    assert res.status_code == 200, f"Alerts failed: {res.text}"
    alerts_data = res.json()
    print(f"  [PASS] /alerts passed: Summary = {alerts_data['summary']}")

    # 9. Analytics GET
    res = client.get("/analytics")
    assert res.status_code == 200, f"Analytics failed: {res.text}"
    analytics_data = res.json()
    print(f"  [PASS] /analytics passed. Generated {len(analytics_data['insights'])} AI Insights:")
    for ins in analytics_data["insights"][:2]:
        print(f"     - {ins}")

    # 10. Scan History GET
    res = client.get("/scan-history")
    assert res.status_code == 200, f"Scan history failed: {res.text}"
    history_items = res.json()
    assert len(history_items) >= 1, "Expected at least 1 scan history entry"
    print(f"  [PASS] /scan-history returned {len(history_items)} logged scans")

    # 11. Batches & FEFO Recommendation
    batch_payload = {
        "batch_number": "BATCH-TEST-99",
        "quantity": 10,
        "expiry_date": "2026-12-31",
    }
    res = client.post(f"/inventory/{created_id}/batches", json=batch_payload)
    assert res.status_code == 201, f"Add batch failed: {res.text}"
    batch_data = res.json()
    print(f"  [PASS] /inventory/{created_id}/batches added batch: {batch_data['batch_number']}")

    res = client.get(f"/inventory/{created_id}/fefo")
    assert res.status_code == 200, f"FEFO failed: {res.text}"
    fefo_data = res.json()
    assert fefo_data["has_recommendation"] is True
    print(f"  [PASS] /inventory/{created_id}/fefo recommendation: {fefo_data['message']}")

    # 12. Stock Movements Audit Trail
    res = client.get("/stock-movements")
    assert res.status_code == 200, f"Stock movements failed: {res.text}"
    movements = res.json()
    assert len(movements) >= 1
    print(f"  [PASS] /stock-movements returned {len(movements)} logged movements")

    # 13. Notifications Center
    res = client.get("/notifications")
    assert res.status_code == 200, f"Notifications failed: {res.text}"
    notifs = res.json()
    print(f"  [PASS] /notifications returned {len(notifs)} alerts")
    if notifs:
        notif_id = notifs[0]["id"]
        res = client.post(f"/notifications/{notif_id}/read")
        assert res.status_code == 200
        print(f"  [PASS] /notifications/{notif_id}/read marked read successfully")

    # 14. Report Export (CSV & JSON)
    res = client.get("/reports/export?format=csv")
    assert res.status_code == 200
    assert "Product ID,Product Name" in res.text
    print(f"  [PASS] /reports/export (CSV) generated {len(res.text)} bytes")

    res = client.get("/reports/export?format=json")
    assert res.status_code == 200
    export_json = res.json()
    assert isinstance(export_json, list)
    print(f"  [PASS] /reports/export (JSON) returned {len(export_json)} products")

    # Cleanup added test item
    client.delete(f"/inventory/{created_id}")

    print("\n[SUCCESS] All 14 Smart Inventory AI Backend Tests Passed Successfully!")

if __name__ == "__main__":
    run_tests()
