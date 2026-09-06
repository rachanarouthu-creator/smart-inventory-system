# 🚀 1-Click Deployment Guide: Single URL Web App

The entire application (React Frontend + FastAPI Backend + SQLite + AI Vision Model) is **packaged as a single unified service**. You only deploy **one service** on **Render** (or Railway) and get **ONE single website URL**.

---

## 🌐 How It Works

```
 ┌─────────────────────────────────────────────────────────────┐
 │                SINGLE UNIFIED WEBSITE URL                   │
 │           https://your-pantry-app.onrender.com              │
 ├──────────────────────────────┬──────────────────────────────┤
 │  🎨 React Frontend UI        │  ⚡ FastAPI Backend & ML     │
 │  • / (Home / AI Scanner)     │  • /scan (Photo Expiry AI)   │
 │  • /dashboard (Inventory)    │  • /predict (Model Classes)  │
 │  • /add (Add Product)        │  • /inventory (CRUD & DB)    │
 │                              │  • /docs (Swagger API Docs)  │
 └──────────────────────────────┴──────────────────────────────┘
```

---

## 3 Simple Steps to Deploy

### Step 1: Push to GitHub
If you haven't pushed your code to GitHub yet:
```bash
git add .
git commit -m "Deploy single-URL Smart Pantry app"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/smart-pantry-tracker.git
git push -u origin main
```

---

### Step 2: Deploy on Render (Free)

1. Go to [Render Dashboard](https://dashboard.render.com/) and click **New +** > **Web Service**.
2. Connect your GitHub repository.
3. Fill in these settings:
   - **Name**: `smart-pantry-app` (or any name you want)
   - **Region**: Nearest to you
   - **Root Directory**: `backend`
   - **Runtime**: `Docker`
   - **Instance Type**: `Free`
4. Environment Variables:
   - `DATABASE_URL` = `sqlite:///./pantry.db`
5. Click **Create Web Service**.

Render will automatically build the container and deploy it in 2–3 minutes.

---

### Step 3: Open Your Live Website URL!

Render will give you **one single URL** at the top of your dashboard:
```
https://smart-pantry-app.onrender.com
```

- Visit that URL in your browser or phone camera: the complete website loads immediately!
- Test the camera scan or inventory dashboard directly on that live link.
- If you ever want to check the interactive Swagger API documentation, visit:
  `https://smart-pantry-app.onrender.com/docs`
