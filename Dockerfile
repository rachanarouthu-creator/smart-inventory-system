# ── Stage 1: Build React frontend ──────────────────────────────────────────
FROM node:20-alpine AS frontend-builder

WORKDIR /frontend
COPY frontend/package*.json ./
RUN npm ci --prefer-offline
COPY frontend/ ./
# Empty VITE_API_URL → uses same-origin relative paths (served by FastAPI)
RUN npm run build

# ── Stage 2: Python backend + bundled frontend ─────────────────────────────
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

# System deps for image processing
RUN apt-get update && apt-get install -y --no-install-recommends \
    libglib2.0-0 libsm6 libxext6 libxrender-dev curl \
    && rm -rf /var/lib/apt/lists/*

# Python deps
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Backend source code + assets
COPY backend/app/ ./app/
COPY backend/products_seed.csv .
COPY backend/model.pkl .
COPY backend/dataset/ ./dataset/
COPY backend/uploads/ ./uploads/

# Built React app (served by FastAPI catch-all)
COPY --from=frontend-builder /frontend/dist ./dist/

# Persistent data dir (Render disk will mount here)
RUN mkdir -p /data /app/uploads

EXPOSE 8000
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
