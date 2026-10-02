# 🚀 Smart Inventory AI - Complete Deployment Guide

This project can be deployed in two convenient ways:
- **Option 1 (Recommended): Single-URL Unified Service on Render / Railway / Docker**
  One single URL (`https://your-app.onrender.com`) serves both the React UI and the FastAPI AI Backend. Zero CORS configuration needed.
- **Option 2: Vercel (Frontend) + Render (Backend)**
  Deploy the React UI to Vercel and the Python API to Render, connected via environment variable or the in-app Server Settings.

---

## 🌟 Option 1: Single-URL Unified Deployment (Render - Free)

FastAPI automatically serves the React UI and the AI Computer Vision API from a single Docker container.

### Step 1: Commit and Push to GitHub
```bash
git add .
git commit -m "Deploy Smart Inventory AI"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/smart-inventory-ai.git
git push -u origin main
```

### Step 2: Create Web Service on Render
1. Open [Render Dashboard](https://dashboard.render.com/) and click **New +** → **Web Service**.
2. Connect your GitHub repository.
3. Configure the settings:
   - **Name**: `smart-inventory-ai` (or any custom name)
   - **Region**: Oregon (or nearest to you)
   - **Root Directory**: *(Leave empty / root)*
   - **Runtime**: `Docker`
   - **Dockerfile Path**: `./Dockerfile`
   - **Instance Type**: `Free`
4. Environment Variables:
   - `DATABASE_URL` = `sqlite:///./pantry.db`
   - `CORS_ORIGINS` = `*`
   - `UPLOAD_DIR` = `./uploads`
5. Click **Create Web Service**.

### Step 3: Access Your Live Application
Render will provision your URL in ~2–3 minutes:
```
https://smart-inventory-ai.onrender.com
```
- Open the URL on desktop or mobile camera to use the full AI scanner, expiry tracker, and inventory dashboard.
- Swagger API documentation is available at `/docs`.

---

## ⚡ Option 2: Deploy Frontend on Vercel + Backend on Render

If you prefer hosting the frontend on Vercel:

### Step 1: Deploy Backend on Render
Deploy using Option 1 above to get your backend URL, for example:
`https://smart-inventory-ai.onrender.com`

### Step 2: Deploy Frontend on Vercel
1. Go to [Vercel Dashboard](https://vercel.com/new).
2. Import your GitHub repository.
3. Set **Root Directory** to `frontend`.
4. Under **Environment Variables**, add:
   - `VITE_API_URL` = `https://smart-inventory-ai.onrender.com`
5. Click **Deploy**.

*(Tip: You can also change or test the backend URL directly inside the app by clicking the Server icon at the top right of the navigation bar).*

---

## 💻 Local Development

### 1. Start FastAPI Backend (Port 8000)
```bash
# Windows PowerShell
.\venv\Scripts\Activate.ps1
uvicorn app.main:app --reload --port 8000
```

### 2. Start React Frontend (Port 5173)
```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173` in your browser.
