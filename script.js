// ===== LOCAL SDK MOCK (ĐỂ CHẠY OFFLINE) =====
window.elementSdk = {
  init: function(config) {
    if(config.onConfigChange) config.onConfigChange(config.defaultConfig);
  },
  setConfig: function() {}
};

// Loại bỏ API_URL vì dùng LocalStorage thay vì Backend
let menuItems = [];
let categories = [];

let cart = [];
let allOrders = [];
let cashflow = [];
let currentCategory = 'all';
let editingItemId = null;
let selectedItemIdForSize = null;
let uploadedImageBase64 = '';
let searchQuery = '';
let discountPercent = 0;
let vatPercent = 8;
let isDarkMode = localStorage.getItem('pos_theme') === 'dark';

// ===== FORMAT =====
function fmt(n) { return n.toLocaleString('vi-VN') + 'đ'; }

// ===== RENDER CATEGORIES =====
function renderCategories() {
  const sidebarList = document.getElementById('category-list-sidebar');
  sidebarList.innerHTML = `
    <button data-category="all" class="js-filter-category sidebar-btn ${currentCategory === 'all' ? 'active' : ''}"> <i data-lucide="layout-grid" class="icon-md"></i> Tất cả </button>
    ${categories.map(c => `
      <div style="position: relative; display: flex; align-items: center;">
        <button data-category="${c.id}" class="js-filter-category sidebar-btn ${currentCategory === c.id ? 'active' : ''}" style="padding-right: 36px;">
          <i data-lucide="${c.icon}" class="icon-md"></i> <span style="flex: 1; text-align: left;">${c.name}</span>
        </button>
        <button data-id="${c.id}" class="js-delete-category btn-icon" style="position: absolute; right: 8px; padding: 4px; z-index: 10;" title="Xóa danh mục">
          <i data-lucide="trash-2" class="icon-sm"></i>
        </button>
      </div>
    `).join('')}
  `;

  const select = document.getElementById('new-item-category');
  const currentVal = select.value;
  select.innerHTML = categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
  if (categories.some(c => c.id === currentVal)) select.value = currentVal;

  lucide.createIcons();
}

// ===== RENDER MENU GRID =====
function renderMenuGrid() {
  const grid = document.getElementById('menu-grid');
  if (menuItems.length === 0) {
    grid.innerHTML = '<p class="text-muted" style="grid-column: span 3; text-align: center; padding: 40px 0;">Chưa có món nào. Hãy vào mục Thực đơn để thêm món nhé!</p>';
    return;
  }
  let filtered = currentCategory === 'all' ? menuItems : menuItems.filter(i => i.category === currentCategory);
  
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    filtered = filtered.filter(i => i.name.toLowerCase().includes(q));
  }

  if (filtered.length === 0) {
    grid.innerHTML = '<p class="text-muted" style="grid-column: span 3; text-align: center; padding: 40px 0;">Không tìm thấy món nào phù hợp.</p>';
    return;
  }
  
  grid.innerHTML = filtered.map(item => `
    <div data-id="${item.id}" class="js-add-to-cart menu-item-card">
      <p class="font-medium text-sm">${item.name}</p>
      <p class="text-primary font-bold text-sm mt-1">${fmt(item.price)}</p>
    </div>
  `).join('');
}

function filterCategory(cat, targetBtn) {
  currentCategory = cat;
  document.querySelectorAll('.js-filter-category').forEach(b => {
    b.classList.remove('active');
  });
  targetBtn.classList.add('active');
  renderMenuGrid();
}

// ===== SIZE MODAL =====
function openSizeModal(id) {
  const item = menuItems.find(i => i.id === id);
  if (!item) return;
  
  // Nếu là đồ ăn (bánh) thì không cần chọn Size, tự thêm vào giỏ với Size M (giá gốc)
  if (item.category === 'food') {
    addToCart(id, 'M', 0, '', '');
    return;
  }

  selectedItemIdForSize = id;
  document.getElementById('modal-item-name').textContent = item.name;
  document.getElementById('size-modal').classList.remove('hidden');
  document.querySelector('input[name="item-size"][value="M"]').checked = true;
  document.getElementById('item-sugar').value = 'Bình thường';
  document.getElementById('item-ice').value = 'Bình thường';
}

function closeSizeModal() {
  document.getElementById('size-modal').classList.add('hidden');
  selectedItemIdForSize = null;
}

function confirmAddToCart() {
  if (!selectedItemIdForSize) return;
  const checked = document.querySelector('input[name="item-size"]:checked');
  const sugar = document.getElementById('item-sugar').value;
  const ice = document.getElementById('item-ice').value;
  addToCart(selectedItemIdForSize, checked.value, parseInt(checked.dataset.price), ice, sugar);
  closeSizeModal();
}

// ===== CART =====
function addToCart(id, size, extraPrice, ice, sugar) {
  const item = menuItems.find(i => i.id === id);
  const cartId = id + '_' + size + '_' + ice + '_' + sugar;
  const existing = cart.find(c => c.cartId === cartId);
  if (existing) existing.qty++;
  else cart.push({ ...item, cartId, size, ice, sugar, price: item.price + extraPrice, qty: 1 });
  renderCart();
}

function removeFromCart(cartId) {
  const idx = cart.findIndex(c => c.cartId === cartId);
  if (idx > -1) { cart[idx].qty--; if (cart[idx].qty <= 0) cart.splice(idx, 1); }
  renderCart();
}

function clearCart() { 
  cart = []; 
  discountPercent = 0;
  vatPercent = 8;
  if (document.getElementById('discount-percent')) document.getElementById('discount-percent').value = '';
  if (document.getElementById('vat-percent')) document.getElementById('vat-percent').value = '8';
  if (document.getElementById('order-note')) document.getElementById('order-note').value = '';
  renderCart(); 
}

function renderCart() {
  const container = document.getElementById('cart-items');
  if (cart.length === 0) {
    container.innerHTML = '<p class="text-center text-muted text-sm py-10" style="padding-top: 40px;">Chưa có món nào</p>';
  } else {
    container.innerHTML = cart.map(c => {
      let extras = [];
      if (c.size !== 'M') extras.push(`Size ${c.size}`);
      if (c.sugar && c.sugar !== 'Bình thường') extras.push(c.sugar);
      if (c.ice && c.ice !== 'Bình thường') extras.push(c.ice);
      const extrasStr = extras.length > 0 ? `<span class="text-primary" style="font-size: 0.75rem; display: block; margin-top: 2px;">(${extras.join(', ')})</span>` : '';
      
      return `
      <div class="cart-item">
        <div style="display: flex; align-items: flex-start;">
          ${c.image ? `<img src="${c.image}" class="cart-item-img">` : ''}
          <div>
            <p class="font-medium text-sm">${c.name}</p>
            ${extrasStr}
            <p class="text-muted mt-1">${fmt(c.price)} × ${c.qty}</p>
          </div>
        </div>
        <div class="flex-center">
          <span class="text-primary font-bold text-sm">${fmt(c.price * c.qty)}</span>
          <button data-id="${c.cartId}" class="js-remove-from-cart btn-icon"><i data-lucide="minus-circle" class="icon-sm"></i></button>
        </div>
      </div>`;
    }).join('');
  }
  const subtotal = cart.reduce((s, c) => s + c.price * c.qty, 0);
  const discountAmount = (subtotal * discountPercent) / 100;
  const afterDiscount = subtotal - discountAmount;
  const vatAmount = (afterDiscount * vatPercent) / 100;
  const total = afterDiscount + vatAmount;
  document.getElementById('subtotal').textContent = fmt(subtotal);
  document.getElementById('total').textContent = fmt(total);
  lucide.createIcons();
}

// ===== CHECKOUT =====
async function checkout(method, targetBtn) {
  if (cart.length === 0) { showToast('Vui lòng chọn món!', 'warning'); return; }
  if (allOrders.length >= 999) { showToast('Đã đạt giới hạn lưu trữ!', 'error'); return; }

  const subtotal = cart.reduce((s, c) => s + c.price * c.qty, 0);
  const discountAmount = (subtotal * discountPercent) / 100;
  const afterDiscount = subtotal - discountAmount;
  const vatAmount = (afterDiscount * vatPercent) / 100;
  const total = afterDiscount + vatAmount;
  
  const orderId = 'HD' + Date.now().toString(36).toUpperCase();
  const itemsStr = cart.map(c => {
    let ex = [];
    if (c.size !== 'M') ex.push(`Size ${c.size}`);
    if (c.sugar && c.sugar !== 'Bình thường') ex.push(c.sugar);
    if (c.ice && c.ice !== 'Bình thường') ex.push(c.ice);
    return `${c.name}${ex.length > 0 ? `(${ex.join(', ')})` : ''}×${c.qty}`;
  }).join(', ');
  const customerName = document.getElementById('customer-name').value.trim() || 'Khách lẻ';
  const orderNote = document.getElementById('order-note') ? document.getElementById('order-note').value.trim() : '';

  const dbRecord = {
    id: orderId,
    items: itemsStr,
    subtotal: subtotal,
    discountPercent: discountPercent,
    vatPercent: vatPercent,
    total: total,
    payment_method: method === 'cash' ? 'Tiền mặt' : 'Thẻ',
    customer_name: customerName,
    note: orderNote,
    date: new Date().toISOString(),
    status: 'completed'
  };

  const btn = targetBtn;
  btn.disabled = true;
  btn.textContent = '...';

  try {
    let currentOrders = JSON.parse(localStorage.getItem('pos_orders')) || [];
    currentOrders.push(dbRecord);
    localStorage.setItem('pos_orders', JSON.stringify(currentOrders));

    showToast(`Thanh toán thành công! ${orderId}`, 'success');
    playCheckoutSound();
    printReceipt({ ...dbRecord, order_id: orderId }, cart);
    cart = [];
    document.getElementById('customer-name').value = '';
    if (document.getElementById('order-note')) document.getElementById('order-note').value = '';
    if (document.getElementById('discount-percent')) document.getElementById('discount-percent').value = '';
    discountPercent = 0;
    if (document.getElementById('vat-percent')) document.getElementById('vat-percent').value = '8';
    vatPercent = 8;
    renderCart();
    await fetchInitialData();
  } catch (e) {
    showToast('Lỗi lưu hóa đơn!', 'error');
  }
  btn.disabled = false;
  btn.textContent = method === 'cash' ? 'Tiền mặt' : 'Thẻ';
}

// ===== SOUND =====
function playCheckoutSound() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1200, ctx.currentTime); // Tần số âm thanh (độ cao của tiếng 'ting')
    
    gainNode.gain.setValueAtTime(0.5, ctx.currentTime); // Âm lượng
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5); // Hiệu ứng nhỏ dần
    
    osc.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    osc.start();
    osc.stop(ctx.currentTime + 0.5);
  } catch (e) {
    console.error("Không thể phát âm thanh", e);
  }
}

// ===== PRINT RECEIPT =====
function printReceipt(order, items) {
  const printWindow = window.open('', '_blank', 'width=400,height=600');
  if (!printWindow) {
    showToast('Trình duyệt đang chặn Popup. Vui lòng cho phép để in!', 'warning');
    return;
  }

  const itemsHtml = items.map(c => {
    let ex = [];
    if (c.size !== 'M') ex.push(`Size ${c.size}`);
    if (c.sugar && c.sugar !== 'Bình thường') ex.push(c.sugar);
    if (c.ice && c.ice !== 'Bình thường') ex.push(c.ice);
    const exStr = ex.length > 0 ? `<div style="font-size: 11px; margin-left: 10px;">(${ex.join(', ')})</div>` : '';
    return `
    <div class="row" style="align-items: flex-start;">
      <div style="flex: 1;">
        <div>${c.name} x${c.qty}</div>
        ${exStr}
      </div>
      <span>${fmt(c.price * c.qty)}</span>
    </div>`;
  }).join('');

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>In Hóa Đơn ${order.order_id}</title>
      <style>
        body { font-family: monospace; color: #000; width: 300px; margin: 0 auto; padding: 20px; }
        .header { text-align: center; border-bottom: 1px dashed #000; padding-bottom: 10px; margin-bottom: 10px; }
        .header h2 { margin: 0 0 5px 0; font-size: 18px; }
        .header p { margin: 2px 0; font-size: 12px; }
        .row { display: flex; justify-content: space-between; margin-bottom: 5px; font-size: 14px; }
        .divider { border-bottom: 1px dashed #000; margin: 10px 0; }
        .bold { font-weight: bold; }
        .footer { text-align: center; margin-top: 20px; font-size: 12px; }
        @media print {
          @page { margin: 0; }
          body { width: 100%; margin: 0; padding: 10px; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h2>☕ Cafe House</h2>
        <p>Hóa đơn: ${order.order_id}</p>
        <p>Ngày: ${new Date(order.date).toLocaleString('vi-VN')}</p>
      </div>
      <div style="margin-bottom: 10px; font-size: 12px;">
        <p style="margin: 2px 0;">Khách hàng: ${order.customer_name}</p>
        <p style="margin: 2px 0;">Thanh toán: ${order.payment_method}</p>
        ${order.note ? `<p style="margin: 2px 0;">Ghi chú: ${order.note}</p>` : ''}
      </div>
      <div class="divider"></div>
      ${itemsHtml}
      <div class="divider"></div>
      ${(order.discountPercent > 0 || order.vatPercent > 0) ? `
      <div class="row">
        <span>Tạm tính:</span>
        <span>${fmt(order.subtotal)}</span>
      </div>
      ` : ''}
      ${order.discountPercent > 0 ? `
      <div class="row">
        <span>Giảm giá (${order.discountPercent}%):</span>
        <span>-${fmt((order.subtotal * order.discountPercent) / 100)}</span>
      </div>
      ` : ''}
      ${order.vatPercent > 0 ? `
      <div class="row">
        <span>VAT (${order.vatPercent}%):</span>
        <span>+${fmt(((order.subtotal - (order.subtotal * (order.discountPercent || 0)) / 100) * order.vatPercent) / 100)}</span>
      </div>
      ` : ''}
      <div class="row bold" style="font-size: 16px;">
        <span>TỔNG CỘNG:</span>
        <span>${fmt(order.total)}</span>
      </div>
      <div class="footer">
        <p>Cảm ơn quý khách và hẹn gặp lại!</p>
      </div>
      <script>
        window.onload = function() { 
          window.print(); 
          setTimeout(function() {
            window.close(); 
          }, 500);
        }
      </script>
    </body>
    </html>
  `;

  printWindow.document.write(html);
  printWindow.document.close();
}

// ===== SIDEBAR TABS =====
function switchSidebarTab(tab) {
  if (tab === 'main') {
    document.getElementById('sidebar-main-menu').classList.remove('hidden');
    document.getElementById('sidebar-category-menu').classList.add('hidden');
    document.getElementById('tab-main-menu').classList.add('active');
    document.getElementById('tab-category-menu').classList.remove('active');
  } else {
    document.getElementById('sidebar-main-menu').classList.add('hidden');
    document.getElementById('sidebar-category-menu').classList.remove('hidden');
    document.getElementById('tab-main-menu').classList.remove('active');
    document.getElementById('tab-category-menu').classList.add('active');
  }
}

// ===== FULLSCREEN =====
function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(() => {});
  } else if (document.exitFullscreen) {
    document.exitFullscreen();
  }
}

document.addEventListener('fullscreenchange', () => {
  const btn = document.getElementById('btn-fullscreen');
  btn.innerHTML = document.fullscreenElement ? '<i data-lucide="minimize" class="icon-md"></i>' : '<i data-lucide="maximize" class="icon-md"></i>';
  lucide.createIcons();
});

// ===== THEME =====
function applyTheme() {
  const bg = isDarkMode ? '#111827' : '#ffffff';
  const sidebar = isDarkMode ? '#030712' : '#f9fafb';
  const text = isDarkMode ? '#f9fafb' : '#111827';
  const textMuted = isDarkMode ? '#9ca3af' : '#6b7280';
  const surface = isDarkMode ? '#1f2937' : '#ffffff';
  
  document.body.style.backgroundColor = bg;
  document.body.style.color = text;
  
  document.documentElement.style.setProperty('--bg-main', bg);
  document.documentElement.style.setProperty('--bg-sidebar', sidebar);
  document.documentElement.style.setProperty('--bg-surface', surface);
  document.documentElement.style.setProperty('--border-color', isDarkMode ? '#374151' : '#e5e7eb');
  document.documentElement.style.setProperty('--text-main', text);
  document.documentElement.style.setProperty('--text-muted', textMuted);
  
  document.querySelectorAll('input[type="date"]').forEach(el => el.style.colorScheme = isDarkMode ? 'dark' : 'light');
  
  const btn = document.getElementById('btn-theme-toggle');
  if (btn) btn.innerHTML = isDarkMode ? '<i data-lucide="sun" class="icon-md"></i>' : '<i data-lucide="moon" class="icon-md"></i>';
  lucide.createIcons();
}

function toggleTheme() {
  isDarkMode = !isDarkMode;
  localStorage.setItem('pos_theme', isDarkMode ? 'dark' : 'light');
  applyTheme();
}

// ===== VIEWS =====
function switchView(view) {
  document.querySelectorAll('[id^="view-"]').forEach(v => v.classList.add('hidden'));
  document.getElementById('view-' + view).classList.remove('hidden');
  document.querySelectorAll('.js-switch-view').forEach(b => b.classList.remove('active'));
  document.querySelector(`[data-view="${view}"]`).classList.add('active');
  
  if (view === 'pos') {
    switchSidebarTab('category');
  } else {
    switchSidebarTab('main');
  }

  if (view === 'stats') renderStats();
  if (view === 'menu') renderMenuManage();
  if (view === 'cashflow') renderCashflow();
}

// ===== ORDERS LIST =====
function renderOrders() {
  const list = document.getElementById('orders-list');
  const noOrders = document.getElementById('no-orders');
  if (allOrders.length === 0) { list.innerHTML = ''; noOrders.classList.remove('hidden'); return; }
  noOrders.classList.add('hidden');
  document.getElementById('order-count').textContent = `${allOrders.length} hóa đơn`;

  const sorted = [...allOrders].sort((a, b) => new Date(b.date) - new Date(a.date));
  
  const groupedOrders = {};
  sorted.forEach(o => {
    const dateStr = new Date(o.date).toLocaleDateString('vi-VN');
    if (!groupedOrders[dateStr]) groupedOrders[dateStr] = [];
    groupedOrders[dateStr].push(o);
  });

  list.innerHTML = Object.entries(groupedOrders).map(([dateStr, orders]) => `
    <div class="mb-5">
      <h3 class="text-sm font-bold text-muted mb-3" style="border-bottom: 1px solid var(--border-color); padding-bottom: 8px;">Ngày: ${dateStr}</h3>
      ${orders.map(o => {
        const isCancelled = o.status === 'cancelled';
        return `
        <div class="list-item-card" style="${isCancelled ? 'opacity: 0.6;' : ''}">
          <div>
            <div class="flex-center">
              <span class="font-bold text-sm text-primary" style="${isCancelled ? 'text-decoration: line-through;' : ''}">${o.order_id}</span>
              <span class="badge ${o.payment_method === 'Tiền mặt' ? 'badge-green' : 'badge-blue'}">${o.payment_method}</span>
              ${isCancelled ? '<span class="badge" style="background-color: #ef4444; color: white;">Đã hủy</span>' : ''}
            </div>
            <p class="text-muted mt-1">${o.customer_name} • ${new Date(o.date).toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'})}</p>
            <p class="text-muted mt-1">${o.items}</p>
            ${o.note ? `<p class="mt-1 text-primary" style="font-size: 0.75rem; font-style: italic;">Ghi chú: ${o.note}</p>` : ''}
            ${isCancelled && o.cancel_reason ? `<p class="mt-1" style="color: #ef4444; font-size: 0.75rem;">Lý do hủy: ${o.cancel_reason}</p>` : ''}
          </div>
          <div class="text-right">
            <p class="font-bold text-primary" style="${isCancelled ? 'text-decoration: line-through;' : ''}">${fmt(o.total)}</p>
            ${!isCancelled ? `<div class="flex-center mt-1" style="justify-content: flex-end;"><button data-id="${o.__backendId}" class="js-reprint-order btn-icon" title="In lại hóa đơn"><i data-lucide="printer" class="icon-sm"></i></button><button data-id="${o.__backendId}" class="js-cancel-order btn-text-red" style="margin-left: 8px;">Hủy đơn</button></div>` : ''}
          </div>
        </div>`
      }).join('')}
    </div>
  `).join('');
  lucide.createIcons();
}

async function cancelOrder(backendId) {
  const reason = prompt('Bạn có chắc muốn hủy hóa đơn này? Vui lòng nhập lý do hủy:');
  if (reason === null) return; // Nếu người dùng bấm Hủy trên thông báo
  if (reason.trim() === '') {
    showToast('Vui lòng nhập lý do hủy để tiếp tục!', 'warning');
    return;
  }

  let currentOrders = JSON.parse(localStorage.getItem('pos_orders')) || [];
  const idx = currentOrders.findIndex(o => o.id === backendId);
  if (idx > -1) {
    currentOrders[idx].status = 'cancelled';
    currentOrders[idx].cancel_reason = reason.trim();
    localStorage.setItem('pos_orders', JSON.stringify(currentOrders));
    await fetchInitialData();
    showToast('Đã hủy hóa đơn', 'success');
  }
}

// ===== IN LẠI HÓA ĐƠN =====
function reprintOrder(backendId) {
  const order = allOrders.find(o => o.id === backendId);
  if (!order) return;

  const printWindow = window.open('', '_blank', 'width=400,height=600');
  if (!printWindow) {
    showToast('Trình duyệt đang chặn Popup. Vui lòng cho phép để in!', 'warning');
    return;
  }

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>In Lại Hóa Đơn ${order.order_id}</title>
      <style>
        body { font-family: monospace; color: #000; width: 300px; margin: 0 auto; padding: 20px; }
        .header { text-align: center; border-bottom: 1px dashed #000; padding-bottom: 10px; margin-bottom: 10px; }
        .header h2 { margin: 0 0 5px 0; font-size: 18px; }
        .header p { margin: 2px 0; font-size: 12px; }
        .row { display: flex; justify-content: space-between; margin-bottom: 5px; font-size: 14px; }
        .divider { border-bottom: 1px dashed #000; margin: 10px 0; }
        .bold { font-weight: bold; }
        .footer { text-align: center; margin-top: 20px; font-size: 12px; }
        @media print { @page { margin: 0; } body { width: 100%; margin: 0; padding: 10px; } }
      </style>
    </head>
    <body>
      <div class="header">
        <h2>☕ Cafe House</h2>
        <p>Hóa đơn (Bản in lại): ${order.order_id}</p>
        <p>Ngày: ${new Date(order.date).toLocaleString('vi-VN')}</p>
      </div>
      <div style="margin-bottom: 10px; font-size: 12px;">
        <p style="margin: 2px 0;">Khách hàng: ${order.customer_name}</p>
        <p style="margin: 2px 0;">Thanh toán: ${order.payment_method}</p>
        ${order.note ? `<p style="margin: 2px 0;">Ghi chú: ${order.note}</p>` : ''}
      </div>
      <div class="divider"></div>
      <div style="font-size: 14px; margin-bottom: 10px;">
        ${order.items.split(', ').map(item => `<div style="margin-bottom: 4px; padding-left: 10px; text-indent: -10px;">• ${item}</div>`).join('')}
      </div>
      <div class="divider"></div>
      ${(order.discountPercent > 0 || order.vatPercent > 0) ? `
      <div class="row"><span>Tạm tính:</span><span>${fmt(order.subtotal)}</span></div>
      ` : ''}
      ${order.discountPercent > 0 ? `
      <div class="row"><span>Giảm giá (${order.discountPercent}%):</span><span>-${fmt((order.subtotal * order.discountPercent) / 100)}</span></div>
      ` : ''}
      ${order.vatPercent > 0 ? `
      <div class="row"><span>VAT (${order.vatPercent}%):</span><span>+${fmt(((order.subtotal - (order.subtotal * (order.discountPercent || 0)) / 100) * order.vatPercent) / 100)}</span></div>
      ` : ''}
      <div class="row bold" style="font-size: 16px;">
        <span>TỔNG CỘNG:</span><span>${fmt(order.total)}</span>
      </div>
      <div class="footer">
        <p>Cảm ơn quý khách và hẹn gặp lại!</p>
      </div>
      <script>
        window.onload = function() { 
          window.print(); 
          setTimeout(function() { window.close(); }, 500);
        }
      </script>
    </body>
    </html>
  `;
  printWindow.document.write(html);
  printWindow.document.close();
}

// ===== CASHFLOW (THU / CHI) =====
function renderCashflow() {
  const list = document.getElementById('cf-list');
  if (!list) return;
  if (cashflow.length === 0) {
    list.innerHTML = '<div class="empty-state"><i data-lucide="inbox" class="icon-lg-centered"></i> Chưa có phiếu thu chi nào</div>';
    lucide.createIcons();
    return;
  }
  const sorted = [...cashflow].sort((a, b) => new Date(b.date) - new Date(a.date));
  list.innerHTML = sorted.map(c => `
    <div class="list-item-card">
      <div>
        <div class="flex-center">
          <span class="font-bold text-sm ${c.type === 'in' ? 'text-green' : 'text-primary'}">${c.type === 'in' ? 'THU TIỀN' : 'CHI TIỀN'}</span>
          <span class="text-muted">• ${new Date(c.date).toLocaleString('vi-VN')}</span>
        </div>
        <p class="font-medium mt-1">${c.reason}</p>
      </div>
      <div class="text-right">
        <p class="font-bold ${c.type === 'in' ? 'text-green' : 'text-primary'}">${c.type === 'in' ? '+' : '-'}${fmt(c.amount)}</p>
        <button data-id="${c.id}" class="js-delete-cf btn-text-red mt-1">Xóa</button>
      </div>
    </div>
  `).join('');
  lucide.createIcons();
}

function saveCashflow() {
  const type = document.getElementById('cf-type').value;
  const amount = parseInt(document.getElementById('cf-amount').value);
  const reason = document.getElementById('cf-reason').value.trim();

  if (!reason || isNaN(amount) || amount <= 0) { showToast('Vui lòng nhập số tiền và lý do hợp lệ!', 'warning'); return; }

  const newCf = { id: 'CF' + Date.now(), type, amount, reason, date: new Date().toISOString() };
  cashflow.push(newCf);
  localStorage.setItem('pos_cashflow', JSON.stringify(cashflow));
  
  document.getElementById('cf-amount').value = '';
  document.getElementById('cf-reason').value = '';
  renderCashflow();
  showToast('Đã lưu phiếu!', 'success');
}

function deleteCashflow(id) {
  if (!confirm('Xóa phiếu này?')) return;
  cashflow = cashflow.filter(c => c.id !== id);
  localStorage.setItem('pos_cashflow', JSON.stringify(cashflow));
  renderCashflow();
  showToast('Đã xóa phiếu', 'success');
}

// ===== STATS =====
function renderStats() {
  let validOrders = allOrders.filter(o => o.status !== 'cancelled');
  let filteredOrders = validOrders;
  const startDateStr = document.getElementById('stat-date-start').value;
  const endDateStr = document.getElementById('stat-date-end').value;
  
  if (startDateStr || endDateStr) {
    filteredOrders = validOrders.filter(o => {
      const orderDate = new Date(o.date);
      orderDate.setHours(0, 0, 0, 0); // Đưa về 0h để so sánh chính xác ngày
      let inRange = true;
      if (startDateStr) {
        const start = new Date(startDateStr);
        start.setHours(0, 0, 0, 0);
        if (orderDate < start) inRange = false;
      }
      if (endDateStr) {
        const end = new Date(endDateStr);
        end.setHours(0, 0, 0, 0);
        if (orderDate > end) inRange = false;
      }
      return inRange;
    });
  }

  const revenue = filteredOrders.reduce((s, o) => s + (o.total || 0), 0);
  const count = filteredOrders.length;
  const avg = count > 0 ? Math.round(revenue / count) : 0;
  document.getElementById('stat-revenue').textContent = fmt(revenue);
  document.getElementById('stat-orders').textContent = count;
  document.getElementById('stat-avg').textContent = fmt(avg);

  // Chart
  const chartTitle = document.getElementById('chart-title');
  if (chartTitle) {
    if (startDateStr && endDateStr && startDateStr === endDateStr) {
      chartTitle.textContent = `Doanh thu trong ngày ${new Date(startDateStr).toLocaleDateString('vi-VN')}`;
    } else if (startDateStr && endDateStr) {
      chartTitle.textContent = `Doanh thu từ ${new Date(startDateStr).toLocaleDateString('vi-VN')} đến ${new Date(endDateStr).toLocaleDateString('vi-VN')}`;
    } else {
      chartTitle.textContent = 'Doanh thu theo ngày (7 ngày gần nhất)';
    }
  }

  let startChart = new Date();
  let endChart = new Date();

  if (startDateStr && endDateStr) {
    startChart = new Date(startDateStr);
    endChart = new Date(endDateStr);
  } else if (startDateStr) {
    startChart = new Date(startDateStr);
  } else if (endDateStr) {
    endChart = new Date(endDateStr);
    if (filteredOrders.length > 0) {
      startChart = new Date(Math.min(...filteredOrders.map(o => new Date(o.date))));
    } else {
      startChart = new Date(endDateStr);
      startChart.setDate(startChart.getDate() - 6);
    }
  } else {
    startChart.setDate(startChart.getDate() - 6); // Mặc định 7 ngày qua
  }

  startChart.setHours(0, 0, 0, 0);
  endChart.setHours(0, 0, 0, 0);

  const byDay = {};
  for (let d = new Date(startChart); d <= endChart; d.setDate(d.getDate() + 1)) {
    byDay[d.toLocaleDateString('vi-VN')] = 0;
  }

  filteredOrders.forEach(o => {
    const day = new Date(o.date).toLocaleDateString('vi-VN');
    if (byDay[day] !== undefined) {
      byDay[day] += (o.total || 0);
    }
  });
  
  const days = Object.entries(byDay);

  const max = Math.max(...days.map(d => d[1]), 1);
  document.getElementById('chart-bars').innerHTML = days.length === 0
    ? '<p class="text-muted text-sm m-auto">Chưa có dữ liệu</p>'
    : days.map(([day, val]) => `
      <div class="chart-bar-item" title="${fmt(val)}">
        <div class="chart-bar-fill" style="height:${(val/max)*100}%"></div>
        <span class="text-muted text-xs">${day.slice(0,5)}</span>
      </div>
    `).join('');
}

// ===== IN BÁO CÁO CUỐI NGÀY =====
function printDailyReport() {
  const startDateStr = document.getElementById('stat-date-start').value;
  const endDateStr = document.getElementById('stat-date-end').value;

  // Lấy mốc thời gian lọc (Mặc định là ngày hôm nay nếu không chọn)
  let start = new Date();
  start.setHours(0, 0, 0, 0);
  let end = new Date();
  end.setHours(23, 59, 59, 999);

  if (startDateStr) {
    start = new Date(startDateStr);
    start.setHours(0, 0, 0, 0);
  }
  if (endDateStr) {
    end = new Date(endDateStr);
    end.setHours(23, 59, 59, 999);
  } else if (startDateStr) {
    end = new Date(startDateStr);
    end.setHours(23, 59, 59, 999);
  }

  // Lọc dữ liệu trong khoảng thời gian (loại bỏ đơn đã hủy)
  const validOrders = allOrders.filter(o => o.status !== 'cancelled');
  const orders = validOrders.filter(o => { const d = new Date(o.date); return d >= start && d <= end; });
  const cfs = cashflow.filter(c => { const d = new Date(c.date); return d >= start && d <= end; });

  // Tính toán
  const totalRevenue = orders.reduce((s, o) => s + (o.total || 0), 0);
  const cashRevenue = orders.filter(o => o.payment_method === 'Tiền mặt').reduce((s, o) => s + (o.total || 0), 0);
  const cardRevenue = orders.filter(o => o.payment_method === 'Thẻ').reduce((s, o) => s + (o.total || 0), 0);

  const totalIn = cfs.filter(c => c.type === 'in').reduce((s, c) => s + c.amount, 0);
  const totalOut = cfs.filter(c => c.type === 'out').reduce((s, c) => s + c.amount, 0);
  
  // Số tiền mặt cần có = Tiền mặt bán được + Thu ngoài - Chi ngoài
  const expectedCash = cashRevenue + totalIn - totalOut;

  const dateDisplay = (startDateStr === endDateStr) || (!startDateStr && !endDateStr)
    ? start.toLocaleDateString('vi-VN')
    : `${start.toLocaleDateString('vi-VN')} - ${end.toLocaleDateString('vi-VN')}`;

  const reportTitle = (startDateStr === endDateStr || (!startDateStr && !endDateStr)) ? 'BÁO CÁO KẾT CA / CUỐI NGÀY' : 'BÁO CÁO TỔNG KẾT DOANH THU';

  const printWindow = window.open('', '_blank', 'width=400,height=600');
  if (!printWindow) { showToast('Trình duyệt đang chặn Popup. Vui lòng cho phép để in!', 'warning'); return; }

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Báo Cáo Cuối Ngày</title>
      <style>
        body { font-family: monospace; color: #000; width: 300px; margin: 0 auto; padding: 20px; }
        .header { text-align: center; border-bottom: 1px dashed #000; padding-bottom: 10px; margin-bottom: 10px; }
        .header h2 { margin: 0 0 5px 0; font-size: 18px; }
        .header p { margin: 2px 0; font-size: 12px; }
        .row { display: flex; justify-content: space-between; margin-bottom: 5px; font-size: 14px; }
        .divider { border-bottom: 1px dashed #000; margin: 10px 0; }
        .bold { font-weight: bold; }
        @media print { @page { margin: 0; } body { width: 100%; margin: 0; padding: 10px; } }
      </style>
    </head>
    <body>
      <div class="header">
        <h2>☕ Cafe House</h2>
        <p>${reportTitle}</p>
        <p>Kỳ báo cáo: ${dateDisplay}</p>
        <p>In lúc: ${new Date().toLocaleTimeString('vi-VN')} ${new Date().toLocaleDateString('vi-VN')}</p>
      </div>
      <div class="row bold"><span>DOANH THU BÁN HÀNG</span></div>
      <div class="row"><span>Tổng số đơn:</span><span>${orders.length}</span></div>
      <div class="row"><span>Tiền mặt:</span><span>${fmt(cashRevenue)}</span></div>
      <div class="row"><span>Thẻ/CK:</span><span>${fmt(cardRevenue)}</span></div>
      <div class="row bold"><span>Tổng doanh thu:</span><span>${fmt(totalRevenue)}</span></div>
      <div class="divider"></div>
      <div class="row bold"><span>THU / CHI NGOÀI</span></div>
      <div class="row"><span>Thu vào (+):</span><span>${fmt(totalIn)}</span></div>
      <div class="row"><span>Chi ra (-):</span><span>${fmt(totalOut)}</span></div>
      <div class="divider"></div>
      <div class="row bold" style="font-size: 15px;"><span>TIỀN MẶT TRONG KÉT:</span><span>${fmt(expectedCash)}</span></div>
      <div style="text-align: center; margin-top: 30px; font-size: 12px;"><p>Người lập báo cáo</p><p style="margin-top:40px;">.........................</p></div>
      <script>window.onload = function() { window.print(); setTimeout(function() { window.close(); }, 500); }</script>
    </body>
    </html>
  `;
  printWindow.document.write(html);
  printWindow.document.close();
}

// ===== MENU MANAGE =====
function renderMenuManage() {
  const container = document.getElementById('menu-manage-list');
  if (menuItems.length === 0) {
    container.innerHTML = '<p class="text-muted" style="grid-column: span 2; text-align: center; padding: 40px 0;">Danh sách trống.</p>';
    return;
  }
  container.innerHTML = menuItems.map(item => `
    <div class="menu-manage-card" style="justify-content: space-between;">
      <div class="flex-center" style="gap: 12px;">
        ${item.image ? `<img src="${item.image}" class="manage-item-img">` : `<div class="manage-item-img"></div>`}
        <div>
          <p class="font-medium text-sm">${item.name}</p>
          <p class="text-muted mt-1">${categories.find(c => c.id === item.category)?.name || 'Khác'}</p>
        </div>
      </div>
      <div class="flex-center" style="gap: 12px;">
        <span class="font-bold text-primary text-sm">${fmt(item.price)}</span>
        <button data-id="${item.id}" class="js-edit-menu-item btn-icon" title="Sửa món"><i data-lucide="pencil" class="icon-sm"></i></button>
        <button data-id="${item.id}" class="js-delete-menu-item btn-icon" title="Xóa món"><i data-lucide="trash-2" class="icon-sm"></i></button>
      </div>
    </div>
  `).join('');
  lucide.createIcons();
}

async function saveMenuItem() {
  const name = document.getElementById('new-item-name').value.trim();
  const price = parseInt(document.getElementById('new-item-price').value);
  const category = document.getElementById('new-item-category').value;

  if (!name || isNaN(price)) { showToast('Vui lòng nhập tên và giá hợp lệ!', 'warning'); return; }

  let currentMenu = JSON.parse(localStorage.getItem('pos_menuItems')) || [];

  if (editingItemId) {
    const itemData = { id: editingItemId, name, price, category, image: uploadedImageBase64 || menuItems.find(i=>i.id===editingItemId).image || '' };
    const idx = currentMenu.findIndex(i => i.id === editingItemId);
    if(idx > -1) currentMenu[idx] = itemData;
    localStorage.setItem('pos_menuItems', JSON.stringify(currentMenu));
    showToast('Đã cập nhật món!', 'success');
  } else {
    const id = 'item_' + Date.now();
    const itemData = { id, name, price, category, image: uploadedImageBase64 };
    currentMenu.push(itemData);
    localStorage.setItem('pos_menuItems', JSON.stringify(currentMenu));
    showToast('Đã thêm món mới!', 'success');
  }
  await fetchInitialData();
  resetMenuForm();
}

function editMenuItem(id) {
  const item = menuItems.find(i => i.id === id);
  if (!item) return;
  document.getElementById('new-item-name').value = item.name;
  document.getElementById('new-item-price').value = item.price;
  document.getElementById('new-item-category').value = item.category;

  editingItemId = id;
  uploadedImageBase64 = '';
  document.getElementById('new-item-image').value = '';
  document.getElementById('btn-add-item').textContent = 'Cập nhật';
  document.getElementById('btn-cancel-edit').classList.remove('hidden');
}

function resetMenuForm() {
  document.getElementById('new-item-name').value = '';
  document.getElementById('new-item-price').value = '';
  if (categories.length > 0) document.getElementById('new-item-category').value = categories[0].id;
  document.getElementById('new-item-image').value = '';
  editingItemId = null;
  uploadedImageBase64 = '';
  document.getElementById('btn-add-item').textContent = 'Thêm';
  document.getElementById('btn-cancel-edit').classList.add('hidden');
}

async function deleteMenuItem(id) {
  if (!confirm('Bạn có chắc muốn xóa món này?')) return;
  let currentMenu = JSON.parse(localStorage.getItem('pos_menuItems')) || [];
  currentMenu = currentMenu.filter(i => i.id !== id);
  localStorage.setItem('pos_menuItems', JSON.stringify(currentMenu));
  cart = cart.filter(c => c.id !== id); // Xóa khỏi giỏ hàng nếu đang chọn
  renderCart();
  await fetchInitialData();
  showToast('Đã xóa món!', 'success');
}

// ===== CATEGORY MODAL =====
function openCategoryModal() {
  document.getElementById('new-cat-name').value = '';
  document.getElementById('category-modal').classList.remove('hidden');
}
function closeCategoryModal() {
  document.getElementById('category-modal').classList.add('hidden');
}
async function saveNewCategory() {
  const name = document.getElementById('new-cat-name').value.trim();
  const icon = document.getElementById('new-cat-icon').value;
  if (!name) { showToast('Vui lòng nhập tên danh mục', 'warning'); return; }
  
  const newCat = { id: 'cat_' + Date.now(), name, icon };
  let currentCats = JSON.parse(localStorage.getItem('pos_categories')) || [];
  currentCats.push(newCat);
  localStorage.setItem('pos_categories', JSON.stringify(currentCats));
  
  await fetchInitialData();
  closeCategoryModal();
  showToast('Tạo danh mục thành công!', 'success');
}

async function deleteCategory(id) {
  const itemsInCat = menuItems.filter(i => i.category === id);

  if (id === 'other' && itemsInCat.length > 0) {
    showToast('Không thể xóa mục "Khác" vì đang chứa món ăn!', 'error');
    return;
  }
  
  let confirmMsg = 'Bạn có chắc muốn xóa danh mục này?';
  if (itemsInCat.length > 0) {
    confirmMsg = 'Vẫn còn món ăn trong danh mục này. Xóa danh mục sẽ tự động chuyển các món sang mục "Khác". Bạn có tiếp tục?';
  }
  
  if (!confirm(confirmMsg)) return;

  let currentCats = JSON.parse(localStorage.getItem('pos_categories')) || [];
  currentCats = currentCats.filter(c => c.id !== id);
  localStorage.setItem('pos_categories', JSON.stringify(currentCats));

  if (itemsInCat.length > 0) {
    let currentMenu = JSON.parse(localStorage.getItem('pos_menuItems')) || [];
    currentMenu.forEach(i => { if(i.category === id) i.category = 'other'; });
    localStorage.setItem('pos_menuItems', JSON.stringify(currentMenu));
  }

  cart.forEach(c => { if (c.category === id) c.category = 'other'; });
  renderCart();
  if (currentCategory === id) currentCategory = 'all'; // Tự chuyển về mục Tất cả nếu xóa trúng mục đang xem
  await fetchInitialData();
  showToast('Đã xóa danh mục!', 'success');
}

// ===== TOAST =====
function showToast(msg, type) {
  const colors = { success:'toast-success', error:'toast-error', warning:'toast-warning' };
  const t = document.createElement('div');
  t.className = `toast ${colors[type]||'toast-default'}`;
  t.textContent = msg;
  document.getElementById('toast-container').appendChild(t);
  setTimeout(() => t.remove(), 3000);
}

// ===== INIT =====
const defaultConfig = {
  shop_name: '☕ Cafe House',
  welcome_text: 'Chào mừng bạn!',
  background_color: '#ffffff',
  surface_color: '#ffffff',
  text_color: '#111827',
  primary_action: '#f59e0b',
  secondary_action: '#3b82f6',
  font_family: 'Be Vietnam Pro',
  font_size: 14
};

window.elementSdk.init({
  defaultConfig,
  onConfigChange: async (config) => {
    document.getElementById('shop-name').textContent = config.shop_name || defaultConfig.shop_name;
    document.getElementById('welcome-text').textContent = config.welcome_text || defaultConfig.welcome_text;
    const bg = config.background_color || defaultConfig.background_color;
    const surface = config.surface_color || defaultConfig.surface_color;
    const text = config.text_color || defaultConfig.text_color;
    const primary = config.primary_action || defaultConfig.primary_action;
    const font = config.font_family || defaultConfig.font_family;
    const size = config.font_size || defaultConfig.font_size;
    document.body.style.backgroundColor = bg;
    document.body.style.color = text;
    document.body.style.fontFamily = `${font}, sans-serif`;
    document.body.style.fontSize = size + 'px';
    document.querySelectorAll('.text-primary').forEach(el => el.style.color = primary);
  },
  mapToCapabilities: (config) => ({
    recolorables: [
      { get: () => config.background_color || defaultConfig.background_color, set: v => { config.background_color = v; window.elementSdk.setConfig({ background_color: v }); } },
      { get: () => config.surface_color || defaultConfig.surface_color, set: v => { config.surface_color = v; window.elementSdk.setConfig({ surface_color: v }); } },
      { get: () => config.text_color || defaultConfig.text_color, set: v => { config.text_color = v; window.elementSdk.setConfig({ text_color: v }); } },
      { get: () => config.primary_action || defaultConfig.primary_action, set: v => { config.primary_action = v; window.elementSdk.setConfig({ primary_action: v }); } },
      { get: () => config.secondary_action || defaultConfig.secondary_action, set: v => { config.secondary_action = v; window.elementSdk.setConfig({ secondary_action: v }); } },
    ],
    borderables: [],
    fontEditable: { get: () => config.font_family || defaultConfig.font_family, set: v => { config.font_family = v; window.elementSdk.setConfig({ font_family: v }); } },
    fontSizeable: { get: () => config.font_size || defaultConfig.font_size, set: v => { config.font_size = v; window.elementSdk.setConfig({ font_size: v }); } },
  }),
  mapToEditPanelValues: (config) => new Map([
    ['shop_name', config.shop_name || defaultConfig.shop_name],
    ['welcome_text', config.welcome_text || defaultConfig.welcome_text],
  ])
});

// ===== SETUP EVENT LISTENERS =====
function setupEventListeners() {
  document.querySelectorAll('.js-toggle-sidebar').forEach(btn => {
    btn.addEventListener('click', () => document.getElementById('app-sidebar').classList.toggle('collapsed'));
  });

  document.querySelectorAll('.js-switch-view').forEach(btn => {
    btn.addEventListener('click', (e) => switchView(e.currentTarget.dataset.view));
  });

  document.getElementById('btn-fullscreen').addEventListener('click', toggleFullscreen);
  document.getElementById('tab-main-menu').addEventListener('click', () => switchSidebarTab('main'));
  document.getElementById('tab-category-menu').addEventListener('click', () => switchSidebarTab('category'));
  document.getElementById('btn-theme-toggle').addEventListener('click', toggleTheme);

  // Thay thế vì các nút Category được vẽ bằng JS liên tục nên ta sẽ dùng Ủy quyền sự kiện
  document.getElementById('category-list-sidebar').addEventListener('click', (e) => {
    const delBtn = e.target.closest('.js-delete-category');
    if (delBtn) {
      deleteCategory(delBtn.dataset.id);
      return; // Dừng lại không thực hiện lệnh chọn danh mục nữa
    }

    const btn = e.target.closest('.js-filter-category');
    if (btn) filterCategory(btn.dataset.category, btn);
  });

  document.getElementById('btn-checkout-cash').addEventListener('click', (e) => checkout('cash', e.currentTarget));
  document.getElementById('btn-checkout-card').addEventListener('click', (e) => checkout('card', e.currentTarget));
  document.getElementById('btn-clear-cart').addEventListener('click', clearCart);
  document.getElementById('btn-add-item').addEventListener('click', saveMenuItem);
  document.getElementById('btn-cancel-edit').addEventListener('click', resetMenuForm);
  document.getElementById('btn-cancel-size').addEventListener('click', closeSizeModal);
  document.getElementById('btn-confirm-size').addEventListener('click', confirmAddToCart);
  document.getElementById('btn-open-category-modal').addEventListener('click', openCategoryModal);
  document.getElementById('btn-cancel-category').addEventListener('click', closeCategoryModal);
  document.getElementById('btn-confirm-category').addEventListener('click', saveNewCategory);
  document.getElementById('stat-date-start').addEventListener('change', renderStats);
  document.getElementById('stat-date-end').addEventListener('change', renderStats);
  document.getElementById('btn-clear-stat-date').addEventListener('click', () => {
    document.getElementById('stat-date-start').value = '';
    document.getElementById('stat-date-end').value = '';
    renderStats();
  });
  
  const btnPrintReport = document.getElementById('btn-print-report');
  if (btnPrintReport) btnPrintReport.addEventListener('click', printDailyReport);

  const btnFilterToday = document.getElementById('btn-filter-today');
  if (btnFilterToday) {
    btnFilterToday.addEventListener('click', () => {
      const today = new Date();
      const offset = today.getTimezoneOffset() * 60000;
      const localISOTime = (new Date(today - offset)).toISOString().split('T')[0];
      document.getElementById('stat-date-start').value = localISOTime;
      document.getElementById('stat-date-end').value = localISOTime;
      renderStats();
    });
  }

  const btnFilterMonth = document.getElementById('btn-filter-month');
  if (btnFilterMonth) {
    btnFilterMonth.addEventListener('click', () => {
      const today = new Date();
      const y = today.getFullYear();
      const m = String(today.getMonth() + 1).padStart(2, '0');
      document.getElementById('stat-date-start').value = `${y}-${m}-01`;
      const lastDate = new Date(y, today.getMonth() + 1, 0);
      document.getElementById('stat-date-end').value = `${y}-${m}-${String(lastDate.getDate()).padStart(2, '0')}`;
      renderStats();
    });
  }

  const searchInput = document.getElementById('search-menu');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value.trim();
      renderMenuGrid();
    });
  }

  const discountInput = document.getElementById('discount-percent');
  if (discountInput) {
    discountInput.addEventListener('input', (e) => {
      let val = parseInt(e.target.value) || 0;
      if (val < 0) val = 0;
      if (val > 100) val = 100;
      discountPercent = val;
      renderCart();
    });
  }

  const vatInput = document.getElementById('vat-percent');
  if (vatInput) {
    vatInput.addEventListener('input', (e) => {
      let val = parseInt(e.target.value) || 0;
      if (val < 0) val = 0;
      if (val > 100) val = 100;
      vatPercent = val;
      renderCart();
    });
  }

  document.getElementById('new-item-image').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = function(event) {
        uploadedImageBase64 = event.target.result;
      };
      reader.readAsDataURL(file);
    } else {
      uploadedImageBase64 = '';
    }
  });

  // Tự động bật toàn màn hình ở lần tương tác (click) đầu tiên của người dùng
  document.body.addEventListener('click', function autoFs() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    }
  }, { once: true });

  // Áp dụng Event Delegation cho các danh sách render bằng JS
  document.getElementById('menu-grid').addEventListener('click', (e) => {
    const card = e.target.closest('.js-add-to-cart');
    if (card) openSizeModal(card.dataset.id);
  });

  document.getElementById('cart-items').addEventListener('click', (e) => {
    const btn = e.target.closest('.js-remove-from-cart');
    if (btn) removeFromCart(btn.dataset.id);
  });

  document.getElementById('orders-list').addEventListener('click', (e) => {
    const btn = e.target.closest('.js-cancel-order');
    if (btn) cancelOrder(btn.dataset.id);

    const reprintBtn = e.target.closest('.js-reprint-order');
    if (reprintBtn) reprintOrder(reprintBtn.dataset.id);
  });

  document.getElementById('menu-manage-list').addEventListener('click', (e) => {
    const btn = e.target.closest('.js-delete-menu-item');
    if (btn) deleteMenuItem(btn.dataset.id);

    const editBtn = e.target.closest('.js-edit-menu-item');
    if (editBtn) editMenuItem(editBtn.dataset.id);
  });

  const btnAddCf = document.getElementById('btn-add-cf');
  if (btnAddCf) btnAddCf.addEventListener('click', saveCashflow);
  const cfList = document.getElementById('cf-list');
  if (cfList) cfList.addEventListener('click', (e) => {
    const btn = e.target.closest('.js-delete-cf');
    if (btn) deleteCashflow(btn.dataset.id);
  });
}

async function fetchInitialData() {
  try {
    const rawMenu = JSON.parse(localStorage.getItem('pos_menuItems')) || [];
    menuItems = rawMenu.map(m => ({...m, category: m.category_id || m.category})); 
    categories = JSON.parse(localStorage.getItem('pos_categories')) || [];
    const rawOrders = JSON.parse(localStorage.getItem('pos_orders')) || [];
    allOrders = rawOrders.map(o => ({...o, __backendId: o.id, order_id: o.id}));
    cashflow = JSON.parse(localStorage.getItem('pos_cashflow')) || [];
    
    renderCategories();
    renderMenuManage();
    renderMenuGrid();
    renderOrders();
    renderCashflow();
    if (!document.getElementById('view-stats').classList.contains('hidden')) renderStats();
    lucide.createIcons();
  } catch (e) {
    console.error("Lỗi tải dữ liệu:", e);
    showToast("Không thể tải dữ liệu!", "error");
  }
}

window.onload = () => {
  setupEventListeners();
  fetchInitialData();
  renderCart(); // Render cart trống lúc mới mở app
  applyTheme(); // Áp dụng theme lưu từ trước
};