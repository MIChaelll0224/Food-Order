const LOCAL_API_BASE_URL = 'http://127.0.0.1:3000';
const REMOTE_API_BASE_URL = 'https://food-order-j6xw.onrender.com';

function isLocalHost(hostname) {
    if (!hostname) return true;
    const localHosts = ['localhost', '127.0.0.1', '::1'];
    if (localHosts.includes(hostname)) return true;
    if (/^(10|127)\./.test(hostname)) return true;
    if (/^192\.168\./.test(hostname)) return true;
    if (/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname)) return true;
    if (/^[^.]+$/.test(hostname)) return true;
    return false;
}

const API_BASE_URL = window.location.protocol === 'file:' || isLocalHost(window.location.hostname)
    ? LOCAL_API_BASE_URL
    : REMOTE_API_BASE_URL;

async function fetchWithFallback(resource, options = {}) {
    try {
        return await fetch(resource, options);
    } catch (error) {
        if (resource.startsWith(LOCAL_API_BASE_URL)) {
            const fallbackUrl = REMOTE_API_BASE_URL + resource.slice(LOCAL_API_BASE_URL.length);
            return await fetch(fallbackUrl, options);
        }

        if (resource.startsWith(REMOTE_API_BASE_URL) && (window.location.protocol === 'file:' || isLocalHost(window.location.hostname))) {
            const fallbackUrl = LOCAL_API_BASE_URL + resource.slice(REMOTE_API_BASE_URL.length);
            return await fetch(fallbackUrl, options);
        }

        throw error;
    }
}
const totalOrdersEl = document.getElementById('total-orders');
const totalSalesEl = document.getElementById('total-sales');
const ordersListEl = document.getElementById('orders-list');
const removeAllButton = document.getElementById('remove-all-button');
const dailySalesText = document.getElementById('daily-sales-text');
const logoutButton = document.getElementById('logout-button');
const adminUserEl = document.getElementById('admin-user');
const receiptModal = document.getElementById('receipt-modal');
const receiptClose = document.getElementById('receipt-close');
const receiptBody = document.getElementById('receipt-body');

function getCurrentUser() {
    const stored = localStorage.getItem('user');
    if (!stored) return null;
    try {
        return JSON.parse(stored);
    } catch (e) {
        return null;
    }
}

function escapeHtml(text) {
    return String(text || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function requireAdmin() {
    const user = getCurrentUser();
    if (!user || user.role !== 'admin') {
        window.location.href = 'login.html';
        return false;
    }
    adminUserEl.textContent = `Admin: ${user.username}`;
    return true;
}

async function fetchOrders() {
    ordersListEl.innerHTML = '<p>Loading orders...</p>';

    try {
        const response = await fetchWithFallback(`${API_BASE_URL}/orders`);
        const data = await response.json();

        if (!data.success) {
            ordersListEl.innerHTML = `<p class="error-message">Could not load orders: ${data.message || 'Unknown error'}</p>`;
            return;
        }

        totalOrdersEl.textContent = data.totalOrders;
        totalSalesEl.textContent = `₱${Number(data.totalSales || 0).toFixed(2)}`;
        if (dailySalesText) dailySalesText.textContent = `₱${Number(data.totalSales || 0).toFixed(2)}`;
        renderOrders(data.orders || []);
    } catch (error) {
        console.error('Admin fetch error:', error);
        ordersListEl.innerHTML = '<p class="error-message">Connection error. Make sure the backend server is running.</p>';
    }
}

function renderOrders(orders) {
    if (!orders || orders.length === 0) {
        ordersListEl.innerHTML = '<p>No orders have been placed yet.</p>';
        return;
    }

    ordersListEl.innerHTML = '';
    orders.slice().reverse().forEach(order => {
        const orderCard = document.createElement('article');
        orderCard.className = 'history-card';

        const itemsHtml = order.items && order.items.length
            ? order.items.map(item => {
                const qty = item.quantity || 0;
                const price = item.price || 0;
                const line = (item.lineTotal !== undefined) ? item.lineTotal : qty * price;
                return `<p class="history-item-line">${escapeHtml(item.name)} x${qty} = ₱${Number(line).toFixed(2)}</p>`;
            }).join('')
            : '<p class="history-item-line">No item details available.</p>';

        orderCard.innerHTML = `
            <div class="history-card-header">
                <div>
                    <strong>Order #${order.orderNumber}</strong>
                    <span>${order.customerName}</span>
                </div>
                <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
                    <span class="badge">${order.paymentStatus || 'PAID'}</span>
                    <span>${order.dateTime || ''}</span>
                </div>
            </div>
            <div class="history-details">
                <div class="history-items">
                    ${itemsHtml}
                </div>
                <div class="history-summary">
                    <div><strong>Total quantity:</strong> ${order.totalQuantity || 0}</div>
                    <div><strong>Total amount:</strong> ₱${Number(order.totalAmount || 0).toFixed(2)}</div>
                </div>
            </div>
        `;

        // make card clickable to view receipt
        orderCard.style.cursor = 'pointer';
        orderCard.addEventListener('click', () => showReceipt(order));

        ordersListEl.appendChild(orderCard);
    });
}

function showReceipt(order) {
    if (!receiptModal || !receiptBody) return;
    const items = (order.items || []).map(item => {
        const qty = item.quantity || 0;
        const price = item.price || 0;
        const line = (item.lineTotal !== undefined) ? item.lineTotal : qty * price;
        return `<tr><td>${escapeHtml(item.name)}</td><td style="text-align:center;">${qty}</td><td style="text-align:right;">₱${Number(price).toFixed(2)}</td><td style="text-align:right;">₱${Number(line).toFixed(2)}</td></tr>`;
    }).join('');

    const html = `
        <div><strong>Order #${escapeHtml(String(order.orderNumber))}</strong></div>
        <div>${escapeHtml(order.customerName || '')} — ${escapeHtml(order.dateTime || '')}</div>
        <table style="width:100%; margin-top:12px; border-collapse:collapse;">
            <thead><tr><th style="text-align:left">Item</th><th>Qty</th><th style="text-align:right">Price</th><th style="text-align:right">Subtotal</th></tr></thead>
            <tbody>${items}</tbody>
        </table>
        <div style="margin-top:12px; text-align:right;">
            <div><strong>Total:</strong> ₱${Number(order.totalAmount || 0).toFixed(2)}</div>
            <div><strong>Status:</strong> ${escapeHtml(order.paymentStatus || '')}</div>
        </div>
    `;

    receiptBody.innerHTML = html;
    receiptModal.style.display = 'flex';
}

function closeReceipt() {
    if (receiptModal) receiptModal.style.display = 'none';
}

async function removeAllOrders() {
    const confirmed = await showModal({
        title: 'Remove all orders?',
        message: 'Remove all orders from the system and Google Sheets?',
        type: 'confirm',
        confirmText: 'Remove All',
        cancelText: 'Cancel',
        showCancel: true
    });
    if (!confirmed) return;

    try {
        const res = await fetchWithFallback(`${API_BASE_URL}/orders`, { method: 'DELETE' });
        const json = await res.json();
        if (json.success) {
            localStorage.removeItem('foodOrderHistory');
            localStorage.removeItem('lastOrderNumber');
            localStorage.removeItem('currentFoodOrder');
            try {
                localStorage.setItem('orderHistory_updated', new Date().toISOString());
            } catch (e) {}
            await showModal({
                title: 'Orders removed',
                message: 'All orders removed',
                type: 'success',
                confirmText: 'OK'
            });
            fetchOrders();
        } else {
            await showModal({
                title: 'Remove failed',
                message: 'Failed to remove orders: ' + (json.message || 'unknown'),
                type: 'error',
                confirmText: 'OK'
            });
        }
    } catch (err) {
        console.error('Remove all error', err);
        await showModal({
            title: 'Error',
            message: 'Error removing orders. See console for details.',
            type: 'error',
            confirmText: 'OK'
        });
    }
}

function logout() {
    localStorage.removeItem('user');
    window.location.href = 'login.html';
}

if (requireAdmin()) {
    if (removeAllButton) removeAllButton.addEventListener('click', removeAllOrders);
    if (receiptClose) receiptClose.addEventListener('click', closeReceipt);
    logoutButton.addEventListener('click', logout);
    fetchOrders();
}
