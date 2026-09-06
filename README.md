# 🥫 Smart Pantry Expiry Tracker

> An AI-powered kitchen pantry assistant that classifies grocery product photos using computer vision and tracks inventory expiration dates in real time.

[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/Frontend-React_19_+_Vite-61DAFB?logo=react&logoColor=black)](https://react.dev)
[![Tailwind CSS](https://img.shields.io/badge/Styling-Tailwind_CSS-38B2AC?logo=tailwind-css&logoColor=white)](https://tailwindcss.com)
[![Render](https://img.shields.io/badge/Deploy-Render-46E3B7?logo=render&logoColor=black)](https://render.com)
[![Vercel](https://img.shields.io/badge/Deploy-Vercel-000000?logo=vercel&logoColor=white)](https://vercel.com)

---

## 🌐 Live Deployed Application

- **Frontend App**: [https://smart-pantry-tracker.vercel.app](https://smart-pantry-tracker.vercel.app) *(Replace with your live Vercel URL)*
- **Backend API**: [https://pantry-tracker-backend.onrender.com](https://pantry-tracker-backend.onrender.com) *(Replace with your live Render URL)*
- **API Documentation**: [https://pantry-tracker-backend.onrender.com/docs](https://pantry-tracker-backend.onrender.com/docs)

---

## 🌟 Key Features

1. **AI Vision Camera Scanner (`/scan`)**:
   - Upload or capture pantry product photos directly from a smartphone or laptop camera.
   - Dual-model inference pipeline: runs K-Nearest Neighbors (`model.pkl`) or MobileNetV2 CNN (`model_cnn.pt`).
   - Returns predicted product name, confidence rating, matched inventory record, and live expiry countdown.
2. **Dynamic Inventory Expiry Tracking**:
   - Color-coded badges:
     - 🟢 **SAFE**: More than 7 days remaining.
     - 🟡 **EXPIRING SOON**: 7 or fewer days remaining.
     - 🔴 **EXPIRED**: Expiry date has passed.
   - Inline editing for stock quantities and expiry dates.
   - Instant search and category filtering.
3. **Database Persistence**:
   - Migrated from raw CSV to SQLite via **SQLAlchemy**, seeded automatically on startup from `products_seed.csv`.
4. **Kitchen-First Mobile Design**:
   - Responsive dark-mode interface built with Tailwind CSS, Lucide icons, and responsive tables/cards.

---

## 📁 Project Structure

```
PandasPractice/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI endpoints & CORS
│   │   ├── database.py          # SQLAlchemy session, engine, & auto-seeding
│   │   ├── models.py            # SQLite Product table schema
│   │   ├── schemas.py           # Pydantic models for validation
│   │   └── ml/
│   │       ├── predict.py       # Dual-model inference & fuzzy label matcher
│   │       ├── train_knn.py     # KNN training pipeline
│   │       └── train_cnn.py     # MobileNetV2 transfer learning script
│   ├── dataset/                 # Product training photos (Horlicks, Harpic, etc.)
│   ├── model.pkl                # Trained KNN classifier
│   ├── products_seed.csv        # Seed inventory CSV
│   ├── requirements.txt         # Python dependencies
│   └── Dockerfile               # Container build definition
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Navbar.jsx       # Tab navigation & urgency indicators
│   │   │   ├── StatusBadge.jsx  # Color-coded expiry badges
│   │   │   └── Toast.jsx        # Notification alert banners
│   │   ├── pages/
│   │   │   ├── Scan.jsx         # Live scanner & expiry result card
│   │   │   ├── Dashboard.jsx    # Inventory table, sorting & inline edits
│   │   │   └── AddProduct.jsx   # Manual product creation form
│   │   ├── api.js               # Centralized API service
│   │   └── App.jsx              # Main view router
│   ├── package.json
│   └── vite.config.js
├── docker-compose.yml           # Multi-container local orchestration
├── render.yaml                  # 1-click Render blueprint
├── DEPLOY.md                    # Free cloud deployment guide
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
