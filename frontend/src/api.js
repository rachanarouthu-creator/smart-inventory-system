/**
 * Smart Inventory AI - API Service Layer
 * Supports single-URL unified deployment, local dev, and multi-cloud (Vercel + Render).
 */

export function getApiBase() {
  if (typeof window !== 'undefined') {
    const custom = localStorage.getItem('smart_inv_api_url');
    if (custom && custom.trim()) {
      return custom.trim().replace(/\/+$/, '');
    }
  }

  if (import.meta.env.VITE_API_URL !== undefined && import.meta.env.VITE_API_URL !== '') {
    return import.meta.env.VITE_API_URL.replace(/\/+$/, '');
  }

  if (typeof window !== 'undefined') {
    // When running locally on Vite dev server (port 5173 or 3000)
    if (window.location.port === '5173' || window.location.port === '3000') {
      return 'http://localhost:8000';
    }
  }

  // Same-origin relative URL (used when FastAPI serves bundled React app)
  return '';
}

export function setApiBase(url) {
  if (typeof window !== 'undefined') {
    if (!url || !url.trim()) {
      localStorage.removeItem('smart_inv_api_url');
    } else {
      localStorage.setItem('smart_inv_api_url', url.trim().replace(/\/+$/, ''));
    }
  }
}

// Backwards-compatible export
export const API_BASE = {
  toString() {
    return getApiBase();
  },
  valueOf() {
    return getApiBase();
  },
};

const defaultHeaders = {
  'Bypass-Tunnel-Reminder': 'true',
};

/**
 * Health check test
 */
export async function checkBackendHealth(targetUrl = null) {
  const base = targetUrl !== null ? targetUrl.replace(/\/+$/, '') : getApiBase();
  try {
    const res = await fetch(`${base}/health`, {
      headers: { ...defaultHeaders },
      signal: AbortSignal.timeout ? AbortSignal.timeout(4000) : undefined,
    });
    if (res.ok) {
      const data = await res.json();
      return { ok: true, data };
    }
    return { ok: false, error: `HTTP ${res.status}: ${res.statusText}` };
  } catch (err) {
    return { ok: false, error: err.message || 'Connection failed' };
  }
}

/**
 * Fetch all pantry inventory items and status counts
 */
export async function getInventory() {
  const res = await fetch(`${getApiBase()}/inventory`, {
    headers: { ...defaultHeaders },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Failed to fetch inventory');
  }
  return res.json();
}

/**
 * Add a new product to the inventory
 */
export async function addProduct(productData) {
  const res = await fetch(`${getApiBase()}/inventory`, {
    method: 'POST',
    headers: {
      ...defaultHeaders,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(productData),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Failed to add product');
  }
  return res.json();
}

/**
 * Update quantity or expiry date of an existing product
 */
export async function updateProduct(id, updateData) {
  const res = await fetch(`${getApiBase()}/inventory/${id}`, {
    method: 'PUT',
    headers: {
      ...defaultHeaders,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(updateData),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Failed to update product');
  }
  return res.json();
}

/**
 * Directly adjust stock (+1, +5, custom delta or absolute quantity)
 */
export async function updateProductStock(id, { delta, quantity, scan_id }) {
  const res = await fetch(`${getApiBase()}/inventory/${id}/stock`, {
    method: 'POST',
    headers: {
      ...defaultHeaders,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ delta, quantity, scan_id }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Failed to adjust stock');
  }
  return res.json();
}

/**
 * Delete a product from inventory
 */
export async function deleteProduct(id) {
  const res = await fetch(`${getApiBase()}/inventory/${id}`, {
    method: 'DELETE',
    headers: { ...defaultHeaders },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Failed to delete product');
  }
  return res.json();
}

/**
 * Upload image and predict product category & confidence
 */
export async function predictImage(file) {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch(`${getApiBase()}/predict`, {
    method: 'POST',
    headers: { ...defaultHeaders },
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Prediction failed');
  }
  return res.json();
}

/**
 * Combined scan: upload photo -> returns identified product AND inventory status
 */
export async function scanItem(file) {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch(`${getApiBase()}/scan`, {
    method: 'POST',
    headers: { ...defaultHeaders },
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Scan failed');
  }
  return res.json();
}

/**
 * Fetch actionable alert lists: expired, low stock, expiring soon
 */
export async function getAlerts() {
  const res = await fetch(`${getApiBase()}/alerts`, {
    headers: { ...defaultHeaders },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Failed to fetch alerts');
  }
  return res.json();
}

/**
 * Fetch database-driven analytics & AI inventory insights
 */
export async function getAnalytics() {
  const res = await fetch(`${getApiBase()}/analytics`, {
    headers: { ...defaultHeaders },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Failed to fetch analytics');
  }
  return res.json();
}

/**
 * Fetch historical scan logs
 */
export async function getScanHistory() {
  const res = await fetch(`${getApiBase()}/scan-history`, {
    headers: { ...defaultHeaders },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Failed to fetch scan history');
  }
  return res.json();
}

/**
 * Fetch batches for a product
 */
export async function getProductBatches(productId) {
  const res = await fetch(`${getApiBase()}/inventory/${productId}/batches`, {
    headers: { ...defaultHeaders },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Failed to fetch batches');
  }
  return res.json();
}

/**
 * Add a new batch for a product
 */
export async function addProductBatch(productId, batchData) {
  const res = await fetch(`${getApiBase()}/inventory/${productId}/batches`, {
    method: 'POST',
    headers: {
      ...defaultHeaders,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(batchData),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Failed to add batch');
  }
  return res.json();
}

/**
 * Fetch FEFO recommendation for a product
 */
export async function getFEFORecommendation(productId) {
  const res = await fetch(`${getApiBase()}/inventory/${productId}/fefo`, {
    headers: { ...defaultHeaders },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Failed to fetch FEFO recommendation');
  }
  return res.json();
}

/**
 * Fetch stock movements audit trail
 */
export async function getStockMovements(productId = null, limit = 50) {
  const url = productId
    ? `${getApiBase()}/stock-movements?product_id=${productId}&limit=${limit}`
    : `${getApiBase()}/stock-movements?limit=${limit}`;
  const res = await fetch(url, {
    headers: { ...defaultHeaders },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Failed to fetch stock movements');
  }
  return res.json();
}

/**
 * Fetch system notifications
 */
export async function getNotifications(limit = 50) {
  const res = await fetch(`${getApiBase()}/notifications?limit=${limit}`, {
    headers: { ...defaultHeaders },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Failed to fetch notifications');
  }
  return res.json();
}

/**
 * Mark a single notification as read
 */
export async function markNotificationRead(notificationId) {
  const res = await fetch(`${getApiBase()}/notifications/${notificationId}/read`, {
    method: 'POST',
    headers: { ...defaultHeaders },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Failed to mark notification read');
  }
  return res.json();
}

/**
 * Mark all notifications as read
 */
export async function markAllNotificationsRead() {
  const res = await fetch(`${getApiBase()}/notifications/read-all`, {
    method: 'POST',
    headers: { ...defaultHeaders },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Failed to mark all notifications read');
  }
  return res.json();
}

/**
 * Get Report Export URL
 */
export function getReportExportUrl(format = 'csv') {
  return `${getApiBase()}/reports/export?format=${format}`;
}

/**
 * Upload an image file for a product
 */
export async function uploadProductImage(file) {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch(`${getApiBase()}/upload-image`, {
    method: 'POST',
    headers: { ...defaultHeaders },
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Failed to upload image');
  }
  return res.json();
}

/**
 * Static fallback dataset product images for quick testing
 */
export const DEFAULT_SAMPLE_IMAGES = [
  { name: 'Maggi 2-Min Noodles', label: 'maggie', image_url: '/uploads/maggie.jpg', category: 'Food' },
  { name: 'Brooke Bond Red Label Tea', label: 'tea_powder', image_url: '/uploads/tea_powder.jpg', category: 'Beverage' },
  { name: 'Colgate Toothpaste', label: 'toothpaste', image_url: '/uploads/toothpaste.jpg', category: 'Personal Care' },
  { name: 'Parle-G Glucose Biscuits', label: 'biscuits', image_url: '/uploads/biscuits.jpg', category: 'Snack' },
  { name: 'Tata Crystal Salt', label: 'salt', image_url: '/uploads/salt.jpg', category: 'Pantry' },
  { name: 'Horlicks Health Drink', label: 'horlicks', image_url: '/uploads/horlicks.jpg', category: 'Health Drink' },
  { name: 'Harpic Power Cleaner', label: 'harpic', image_url: '/uploads/harpic.jpg', category: 'Cleaning' },
  { name: 'Kissan Tomato Sauce', label: 'kissan', image_url: '/uploads/kissan.jpg', category: 'Food' },
  { name: 'Refined Cooking Oil', label: 'oil', image_url: '/uploads/oil.jpg', category: 'Cooking Oil' },
  { name: 'Dark Soya Sauce', label: 'soya_sos', image_url: '/uploads/soya_sauce.jpg', category: 'Food' },
  { name: 'Coriander Powder', label: 'coriander_powder', image_url: '/uploads/coriander_powder.jpg', category: 'Spice' },
];

/**
 * Fetch list of sample dataset product images for quick testing
 */
export async function getSampleImages() {
  try {
    const res = await fetch(`${getApiBase()}/sample-images`, {
      headers: { ...defaultHeaders },
      signal: AbortSignal.timeout ? AbortSignal.timeout(3000) : undefined,
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        return data;
      }
    }
  } catch {
    // Fallback gracefully to bundled samples
  }
  return DEFAULT_SAMPLE_IMAGES;
}

/**
 * Resolves static image URLs correctly across local dev and single-service production
 */
export function getProductImageUrl(imagePath) {
  if (!imagePath) return null;
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://') || imagePath.startsWith('data:')) {
    return imagePath;
  }
  const cleanPath = imagePath.startsWith('/') ? imagePath : `/${imagePath}`;
  const base = getApiBase();
  return base ? `${base}${cleanPath}` : cleanPath;
}
