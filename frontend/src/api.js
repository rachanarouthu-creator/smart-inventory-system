const RAW_API_URL = import.meta.env.VITE_API_URL !== undefined 
  ? import.meta.env.VITE_API_URL 
  : (typeof window !== 'undefined' && window.location.port === '5173' ? 'http://localhost:8000' : '');
export const API_BASE = RAW_API_URL ? RAW_API_URL.replace(/\/+$/, '') : '';

/**
 * Fetch all pantry inventory items and status counts
 */
export async function getInventory() {
  const res = await fetch(`${API_BASE}/inventory`);
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
  const res = await fetch(`${API_BASE}/inventory`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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
  const res = await fetch(`${API_BASE}/inventory/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updateData),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Failed to update product');
  }
  return res.json();
}

/**
 * Delete a product from inventory
 */
export async function deleteProduct(id) {
  const res = await fetch(`${API_BASE}/inventory/${id}`, {
    method: 'DELETE',
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

  const res = await fetch(`${API_BASE}/predict`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Prediction failed');
  }
  return res.json();
}

/**
 * Combined scan: upload photo -> returns identified product AND expiry status
 */
export async function scanItem(file) {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch(`${API_BASE}/scan`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Scan failed');
  }
  return res.json();
}
