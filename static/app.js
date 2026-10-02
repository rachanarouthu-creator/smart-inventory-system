// Global State
let inventoryItems = [];
let inventoryStats = { total: 0, safe: 0, expiring_soon: 0, expired: 0 };
let currentFilter = 'ALL';
let searchQuery = '';
let selectedImageFile = null;
let currentScannedProduct = null;

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  setupDropzone();
  fetchInventory();
});

// ==========================================
// 1. INVENTORY API & RENDERING
// ==========================================

async function fetchInventory() {
  try {
    const res = await fetch('/api/inventory');
    if (!res.ok) throw new Error('Failed to fetch inventory');
    const data = await res.json();
    
    inventoryItems = data.items || [];
    inventoryStats = data.stats || { total: 0, safe: 0, expiring_soon: 0, expired: 0 };

    updateMetrics();
    renderTable();
  } catch (err) {
    console.error('Error fetching inventory:', err);
    showToast('Failed to load inventory from server', 'error');
  }
}

function updateMetrics() {
  document.getElementById('statTotal').innerText = inventoryStats.total;
  document.getElementById('statSafe').innerText = inventoryStats.safe;
  document.getElementById('statExpiring').innerText = inventoryStats.expiring_soon;
  document.getElementById('statExpired').innerText = inventoryStats.expired;

  // Update filter pill counts
  document.getElementById('pillCountAll').innerText = inventoryStats.total;
  document.getElementById('pillCountSafe').innerText = inventoryStats.safe;
  document.getElementById('pillCountExpiring').innerText = inventoryStats.expiring_soon;
  document.getElementById('pillCountExpired').innerText = inventoryStats.expired;
}

function renderTable() {
  const tbody = document.getElementById('inventoryTableBody');
  const query = searchQuery.trim().toLowerCase();

  const filtered = inventoryItems.filter(item => {
    // Status filter
    if (currentFilter !== 'ALL' && item.status !== currentFilter) {
      return false;
    }
    // Search query
    if (query) {
      const matchName = item.product.toLowerCase().includes(query);
      const matchCat = item.category.toLowerCase().includes(query);
      if (!matchName && !matchCat) return false;
    }
    return true;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="empty-state">
          No products found matching your filters.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filtered.map(item => {
    let badgeClass = 'badge-safe';
    if (item.status === 'EXPIRING SOON') badgeClass = 'badge-warning';
    else if (item.status === 'EXPIRED') badgeClass = 'badge-danger';

    const daysText = item.days_left < 0 
      ? `${Math.abs(item.days_left)}d overdue` 
      : `${item.days_left}d left`;

    return `
      <tr>
        <td><strong>${escapeHtml(item.product)}</strong></td>
        <td><span class="sample-tag">${escapeHtml(item.category)}</span></td>
        <td>
          <div class="qty-controls">
            <button class="btn-qty" onclick="changeQuantity('${escapeJs(item.product)}', -1)">−</button>
            <span style="font-weight:700; min-width: 24px; text-align: center;">${item.quantity}</span>
            <button class="btn-qty" onclick="changeQuantity('${escapeJs(item.product)}', 1)">+</button>
          </div>
        </td>
        <td>${item.expiry_date}</td>
        <td><span style="font-weight:600;">${daysText}</span></td>
        <td><span class="badge ${badgeClass}">${item.status}</span></td>
        <td style="text-align: right;">
          <button class="btn-delete" title="Delete product" onclick="deleteProduct('${escapeJs(item.product)}')">🗑️</button>
        </td>
      </tr>
    `;
  }).join('');
}

function filterByStatus(status) {
  currentFilter = status;
  
  // Highlight active pill
  document.querySelectorAll('.pill-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.filter === status);
  });

  renderTable();
}

function handleSearch(e) {
  searchQuery = e.target.value;
  renderTable();
}

async function changeQuantity(productName, delta) {
  const item = inventoryItems.find(p => p.product.toLowerCase() === productName.toLowerCase());
  if (!item) return;

  const newQty = Math.max(0, item.quantity + delta);

  try {
    const res = await fetch(`/api/inventory/${encodeURIComponent(productName)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quantity: newQty })
    });
    if (!res.ok) throw new Error('Failed to update quantity');
    
    // Update local state and re-render
    item.quantity = newQty;
    renderTable();

    // If currently showing in scanner, update it too
    if (currentScannedProduct && currentScannedProduct.detected_label.toLowerCase() === productName.toLowerCase()) {
      currentScannedProduct.quantity = newQty;
      document.getElementById('resQuantity').innerText = `${newQty} units`;
    }
  } catch (err) {
    showToast('Failed to update quantity', 'error');
  }
}

async function deleteProduct(productName) {
  if (!confirm(`Are you sure you want to remove '${productName}' from inventory?`)) {
    return;
  }

  try {
    const res = await fetch(`/api/inventory/${encodeURIComponent(productName)}`, {
      method: 'DELETE'
    });
    if (!res.ok) throw new Error('Failed to delete product');
    
    showToast(`Removed '${productName}' from inventory`, 'info');
    fetchInventory();
  } catch (err) {
    showToast('Failed to delete product', 'error');
  }
}

// ==========================================
// 2. PRODUCT ADD MODAL
// ==========================================

function openAddModal(prefillName = '', prefillCategory = '') {
  document.getElementById('productForm').reset();
  if (prefillName) document.getElementById('formProductName').value = prefillName;
  if (prefillCategory) document.getElementById('formCategory').value = prefillCategory;

  // Default expiry date to 3 months from now
  const future = new Date();
  future.setMonth(future.getMonth() + 3);
  document.getElementById('formExpiryDate').value = future.toISOString().split('T')[0];

  document.getElementById('productModal').style.display = 'flex';
}

function closeModal() {
  document.getElementById('productModal').style.display = 'none';
}

async function saveProduct(e) {
  e.preventDefault();
  const product = document.getElementById('formProductName').value.trim();
  const category = document.getElementById('formCategory').value.trim();
  const expiry_date = document.getElementById('formExpiryDate').value;
  const quantity = parseInt(document.getElementById('formQuantity').value, 10) || 1;

  try {
    const res = await fetch('/api/inventory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ product, category, expiry_date, quantity })
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.detail || 'Failed to save product');
    }

    showToast(`Added '${product}' to inventory!`, 'success');
    closeModal();
    fetchInventory();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ==========================================
// 3. AI VISION SCANNER
// ==========================================

function setupDropzone() {
  const dropZone = document.getElementById('dropZone');

  ['dragenter', 'dragover'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      dropZone.classList.add('drag-over');
    });
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      dropZone.classList.remove('drag-over');
    });
  });

  dropZone.addEventListener('drop', (e) => {
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      loadSelectedFile(files[0]);
    }
  });
}

function handleFileSelect(e) {
  if (e.target.files && e.target.files[0]) {
    loadSelectedFile(e.target.files[0]);
  }
}

function loadSelectedFile(file) {
  if (!file.type.startsWith('image/')) {
    showToast('Please select a valid image file', 'error');
    return;
  }

  selectedImageFile = file;
  const reader = new FileReader();
  reader.onload = (e) => {
    document.getElementById('imagePreview').src = e.target.result;
    document.getElementById('dropzonePrompt').style.display = 'none';
    document.getElementById('previewContainer').style.display = 'flex';
    document.getElementById('scanBtn').disabled = false;
  };
  reader.readAsDataURL(file);
}

function clearPreview(e) {
  if (e) e.stopPropagation();
  selectedImageFile = null;
  document.getElementById('imageInput').value = '';
  document.getElementById('previewContainer').style.display = 'none';
  document.getElementById('dropzonePrompt').style.display = 'block';
  document.getElementById('scanBtn').disabled = true;
  document.getElementById('scanResult').style.display = 'none';
  currentScannedProduct = null;
}

// 1-Click sample loading for instant testing
async function loadSample(imagePath, e) {
  if (e) e.stopPropagation();
  try {
    showToast('Loading sample image...', 'info');
    const response = await fetch(`/${imagePath}`);
    if (!response.ok) throw new Error('Could not fetch sample image');
    const blob = await response.blob();
    const filename = imagePath.split('/').pop();
    const file = new File([blob], filename, { type: blob.type || 'image/jpeg' });
    loadSelectedFile(file);
    showToast('Sample image ready! Click Scan & Analyze.', 'success');
  } catch (err) {
    showToast('Failed to load sample image', 'error');
  }
}

async function scanSelectedImage() {
  if (!selectedImageFile) return;

  const scanBtn = document.getElementById('scanBtn');
  scanBtn.disabled = true;
  scanBtn.innerHTML = '<span class="icon">⏳</span> Analyzing Image with Vision Model...';

  const formData = new FormData();
  formData.append('file', selectedImageFile);

  try {
    const res = await fetch('/api/scan', {
      method: 'POST',
      body: formData
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.detail || 'Scan failed');
    }

    currentScannedProduct = data;
    displayScanResult(data);
    showToast(`Identified: ${data.detected_label}`, 'success');
  } catch (err) {
    console.error('Scan error:', err);
    showToast(err.message, 'error');
  } finally {
    scanBtn.disabled = false;
    scanBtn.innerHTML = '<span class="icon">⚡</span> Scan & Analyze Image';
  }
}

function displayScanResult(data) {
  const resultCard = document.getElementById('scanResult');
  const badge = document.getElementById('resStatusBadge');
  const title = document.getElementById('resProductName');
  const cat = document.getElementById('resCategory');
  const conf = document.getElementById('resConfidence');
  const qty = document.getElementById('resQuantity');
  const exp = document.getElementById('resExpiryDate');
  const days = document.getElementById('resDaysLeft');
  const actionsDiv = document.getElementById('resActionButtons');

  title.innerText = data.detected_label;
  cat.innerText = data.category;
  conf.innerText = `${data.confidence}%`;
  qty.innerText = `${data.quantity} units`;
  exp.innerText = data.expiry_date;
  
  if (data.days_left < 0) {
    days.innerText = `${Math.abs(data.days_left)} days expired`;
  } else {
    days.innerText = `${data.days_left} days left`;
  }

  badge.className = 'badge';
  const alertBanner = document.getElementById('resAlertBanner');

  if (data.status === 'SAFE') {
    badge.classList.add('badge-safe');
    badge.innerText = 'SAFE';
    if (alertBanner) {
      alertBanner.style.display = 'flex';
      alertBanner.className = 'expiry-alert-banner alert-safe';
      alertBanner.innerHTML = `<span>✅ <strong>Safe Condition:</strong> Product is fresh with ${data.days_left} days remaining until expiry (${data.expiry_date}).</span>`;
    }
  } else if (data.status === 'EXPIRING SOON') {
    badge.classList.add('badge-warning');
    badge.innerText = 'EXPIRING SOON';
    if (alertBanner) {
      alertBanner.style.display = 'flex';
      alertBanner.className = 'expiry-alert-banner alert-expiring';
      alertBanner.innerHTML = `<span>⚠️ <strong>Expiring Soon Alert:</strong> Only ${data.days_left} day(s) left until expiration (${data.expiry_date})! Recommended for immediate use.</span>`;
    }
  } else if (data.status === 'EXPIRED') {
    badge.classList.add('badge-danger');
    badge.innerText = 'EXPIRED';
    if (alertBanner) {
      alertBanner.style.display = 'flex';
      alertBanner.className = 'expiry-alert-banner alert-expired';
      alertBanner.innerHTML = `<span>🚨 <strong>CRITICAL EXPIRY ALERT:</strong> This product has EXPIRED (${Math.abs(data.days_left)} days overdue since ${data.expiry_date}). Do not consume or sell!</span>`;
    }
  } else {
    badge.classList.add('badge-warning');
    badge.innerText = 'NOT IN INVENTORY';
    if (alertBanner) {
      alertBanner.style.display = 'flex';
      alertBanner.className = 'expiry-alert-banner alert-expiring';
      alertBanner.innerHTML = `<span>ℹ️ <strong>Item Detected:</strong> '${data.detected_label}' was identified by AI but is not yet in products.csv inventory. Click below to add it.</span>`;
    }
  }

  if (data.in_inventory) {
    actionsDiv.innerHTML = `
      <button class="btn btn-secondary btn-sm" onclick="adjustScannedStock(1)">
        <span>➕ Add 1 Stock</span>
      </button>
      <button class="btn btn-secondary btn-sm" onclick="adjustScannedStock(-1)">
        <span>➖ Deduct 1 Stock</span>
      </button>
    `;
  } else {
    actionsDiv.innerHTML = `
      <button class="btn btn-primary btn-sm btn-full" onclick="openAddModal('${escapeJs(data.detected_label)}', 'General')">
        <span>➕ Add to Inventory</span>
      </button>
    `;
  }

  resultCard.style.display = 'block';
}

function adjustScannedStock(delta) {
  if (!currentScannedProduct || !currentScannedProduct.detected_label) return;
  changeQuantity(currentScannedProduct.detected_label, delta);
}

// ==========================================
// 4. MODEL RETRAINING
// ==========================================

async function retrainModel() {
  const btn = document.getElementById('retrainBtn');
  btn.disabled = true;
  btn.innerHTML = '<span class="icon">⏳</span> Retraining...';

  try {
    const res = await fetch('/api/retrain', { method: 'POST' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Retraining failed');

    showToast(`Model retrained with ${data.total_images} images across ${data.classes.length} classes!`, 'success');
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<span class="icon">🔄</span> Retrain Model';
  }
}

// ==========================================
// 5. TOAST NOTIFICATIONS & UTILITIES
// ==========================================

function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️';
  toast.innerHTML = `<span>${icon}</span> <span>${escapeHtml(message)}</span>`;

  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function escapeJs(str) {
  if (!str) return '';
  return String(str).replace(/'/g, "\\'").replace(/"/g, '\\"');
}
