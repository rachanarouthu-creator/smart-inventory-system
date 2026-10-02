# 🥫 Smart Inventory AI

> An intelligent enterprise and pantry inventory management system powered by Computer Vision, OCR expiry verification, FEFO batch rotation, and automated audit logging.

[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/Frontend-React_19_+_Vite-61DAFB?logo=react&logoColor=black)](https://react.dev)
[![Tailwind CSS](https://img.shields.io/badge/Styling-Tailwind_CSS-38B2AC?logo=tailwind-css&logoColor=white)](https://tailwindcss.com)
[![SQLite](https://img.shields.io/badge/Database-SQLite_+_SQLAlchemy-003B57?logo=sqlite&logoColor=white)](https://sqlite.org)

---

## 🌟 Star Features

1. **AI Product Scanner (`/scan`)**:
   - Live camera stream capture or photo upload directly in the browser.
   - Dual-model vision pipeline: KNN classifier (`model.pkl`) and MobileNetV2 CNN (`model_cnn.pt`).
   - OCR packaging date reader with matching confidence indicator.
   - FEFO (First-Expiry, First-Out) recommendation highlighting earliest expiring batch.
   - Low-stock warning banner with one-click restock recommendation (`+recommended_restock`).
   - Inline new batch intake directly from the scanning workflow.
2. **Batches & FEFO Shelf-Life Rotation**:
   - Track multiple production lots (`batch_number`, `quantity`, `expiry_date`) per inventory item.
   - FEFO algorithm prioritizes earliest-expiring active batches to minimize spoilage.
   - Visual batch status badges (Safe, Expiring Soon, Expired).
3. **Stock Movement Audit Trail (`/history`)**:
   - Complete audit trail logging every stock intake, batch addition, and manual adjustment.
   - Tracks previous quantity, delta change, new balance, timestamps, and reason.
4. **Real-time Notification Center**:
   - Bell icon with unread badge count in the top navigation bar.
   - Automated sync for critical stock conditions (`EXPIRED`, `EXPIRING_SOON`, `LOW_STOCK`, `SCAN`).
   - "Mark all as read" capability and direct jump to relevant inventory screens.
5. **Inventory Analytics & Health Scorecard (`/analytics`)**:
   - Comprehensive Health Score (0-100) with rating ("Good", "Moderate", "Critical").
   - Dimension scores: Stock Health, Expiry Safety, and Product Availability.
   - Rule-based AI inventory insights grounded in real database records.
6. **Data Export & Reporting (`/reports/export`)**:
   - One-click CSV and JSON export of inventory records directly from the Dashboard.

---

## 📁 Project Structure

```
PandasPractice/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI endpoints, CORS & SPA serving
│   │   ├── database.py          # SQLAlchemy session, engine & auto-migration
│   │   ├── models.py            # SQLite Product, Batch, StockMovement, Notification schemas
│   │   ├── schemas.py           # Pydantic models for request/response validation
│   │   └── ml/
│   │       ├── predict.py       # Dual-model inference & fuzzy label matcher
│   │       ├── ocr.py           # Expiry date extraction & verification
│   │       ├── train_knn.py     # KNN classifier training pipeline
│   │       └── train_cnn.py     # MobileNetV2 transfer learning script
│   ├── dataset/                 # Product training photos (Horlicks, Harpic, etc.)
│   ├── test_api.py              # 14-step automated test suite
│   ├── model.pkl                # Trained KNN classifier
│   └── requirements.txt         # Python dependencies
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Navbar.jsx             # Top bar with 6 tabs & NotificationCenter
│   │   │   ├── NotificationCenter.jsx # System alert popover & unread badges
│   │   │   ├── StatusBadge.jsx        # Color-coded expiry & stock status badges
│   │   │   └── Toast.jsx              # Floating notification banners
│   │   ├── pages/
│   │   │   ├── Scan.jsx         # AI Product Scanner (Star Feature)
│   │   │   ├── Dashboard.jsx    # Inventory table, batch drawers & CSV/JSON export
│   │   │   ├── Alerts.jsx       # Actionable expired & low-stock monitoring
│   │   │   ├── Analytics.jsx    # Health Scorecard & AI rule-based insights
│   │   │   ├── ScanHistory.jsx  # Stock movement audit trail & vision logs
│   │   │   └── AddProduct.jsx   # Manual product creation form
│   │   ├── api.js               # Centralized API service
│   │   └── App.jsx              # Main view router
│   ├── package.json
│   └── vite.config.js
└── README.md
```

---

## 🚀 Getting Started Locally

### Prerequisites
- Python 3.10+
- Node.js 18+ and npm
- *(Optional)* Docker & Docker Compose

---

### Option A: Local Dev Servers (Fastest)

#### 1. Start Backend (Terminal 1)
```bash
cd backend
python -m venv venv
# On Windows:
venv\Scripts\activate
# On macOS/Linux:
# source venv/bin/activate

pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```
Backend API will be running at `http://localhost:8000`.  
Swagger interactive documentation: `http://localhost:8000/docs`.

#### 2. Start Frontend (Terminal 2)
```bash
cd frontend
npm install
npm run dev
```
Frontend web interface will be running at `http://localhost:5173`.

---

### Option B: Docker Compose (1-Command Run)

```bash
docker-compose up --build
```
- Frontend: `http://localhost:5173`
- Backend: `http://localhost:8000`

---

## 📡 API Endpoints Reference

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/scan` | **Primary endpoint**: Upload image, returns prediction + inventory expiry status |
| `POST` | `/predict` | Raw ML classification: returns `{ product_name, confidence, model_type }` |
| `GET` | `/inventory` | List all pantry products with days left and status counts |
| `POST` | `/inventory` | Add new product `{ name, category, quantity, expiry_date }` |
| `PUT` | `/inventory/{id}`| Update product quantity or expiry date |
| `DELETE`| `/inventory/{id}`| Remove product from inventory |
| `GET` | `/api/health` | Health check endpoint |

---

## 🧠 Machine Learning Details

### 1. K-Nearest Neighbors (`train_knn.py`)
- Resizes images to $100 \times 100 \times 3$, flattens to 30,000-dimensional vector space.
- Fits `KNeighborsClassifier(n_neighbors=1)`.
- Confidence calculated via distance metrics.
- Retrain anytime with:
  ```bash
  cd backend
  python -m app.ml.train_knn
  ```

### 2. MobileNetV2 CNN (`train_cnn.py`)
- Uses transfer learning with pretrained ImageNet weights.
- Includes data augmentation (random crop, rotation, color jitter) to handle kitchen lighting and phone angles.
- Install PyTorch: `pip install torch torchvision`
- Train:
  ```bash
  cd backend
  python -m app.ml.train_cnn
  ```
- If `model_cnn.pt` is present, `predict.py` automatically uses it with fallback to KNN.

---

## 🚢 Deployment to Production

For full deployment instructions to **Render.com** (Free Web Service) and **Vercel** (Free Frontend), see [DEPLOY.md](file:///c:/Users/bhuva/Downloads/Csp%20inventory/PandasPractice/DEPLOY.md).

---

## 📄 License
MIT License
