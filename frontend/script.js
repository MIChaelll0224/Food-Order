// script.js
// Ordering page logic: add items, update quantities, remove items, and save current order.

const MENU = [
    {
        id: 1,
        name: '1pc Chickenjoy w/drink',
        price: 111,
        imageUrl: 'https://www.image2url.com/r2/default/images/1779610339994-79a65c44-356e-4569-8500-7d308f7adf30.png',
    },
    {
        id: 2,
        name: '2pc Chickenjoy w/drink',
        price: 223,
        imageUrl: 'https://www.image2url.com/r2/default/images/1779610372397-1321eb7a-6cf3-4cee-b0bc-141f9b0759e1.png',
    },
    {
        id: 3,
        name: '1pc Chickenjoy w/ Jolly Spaghetti w/drink',
        price: 199,
        imageUrl: 'https://www.image2url.com/r2/default/images/1779610460101-31198e17-e0b8-43a0-9413-08a01ac8b40b.png',
    },
    {
        id: 4,
        name: 'Jolly Spaghetti w/drink',
        price: 93,
        imageUrl: 'https://www.image2url.com/r2/default/images/1779610508275-73841368-0632-4aef-87c8-433d7d48101e.png',
    },
    {
        id: 5,
        name: 'Yumburger w/drink',
        price: 93,
        imageUrl: 'https://www.image2url.com/r2/default/images/1779610092753-227102ae-2b49-44ce-9f71-2619979b4748.png',
    },
    {
        id: 6,
        name: '2pc Burger Steak w/drink',
        price: 172,
        imageUrl: 'https://www.image2url.com/r2/default/images/1779610140291-6445175e-0e23-4c0f-960c-d7c45cfaaf7b.png',
    },
    {
        id: 7,
        name: 'Yumburger, Half Jolly Spaghetti, Reg. Fries w/drink',
        price: 158,
        imageUrl: 'https://www.image2url.com/r2/default/images/1779610196323-ab62a0d0-d624-47ab-967f-f405f472aaa9.png',
    },
    {
        id: 8,
        name: '1pc Chickenjoy, Half Jolly Spaghetti, Yumburger with rice and Reg. Drink',
        price: 223,
        imageUrl: 'https://www.image2url.com/r2/default/images/1779610239301-31656b8a-1526-4133-a67b-b55af8c50890.png',

        
    },
];

const API_BASE_URL = "https://food-order-j6xw.onrender.com";
const STORAGE_HISTORY = 'foodOrderHistory';
const STORAGE_CURRENT_ORDER = 'currentFoodOrder';
const STORAGE_LAST_ORDER_NUMBER = 'lastOrderNumber';
let orderItems = {};
let orderMeta = {
    orderNumber: null,
    paymentStatus: 'PENDING',
};

function getCurrentUser() {
    const stored = localStorage.getItem('user');
    if (!stored) return null;
    try {
        return JSON.parse(stored);
    } catch (e) {
        return null;
    }
}

// Admin UI handled in admin.html/admin.js. User script keeps ordering features only.

const customerNameInput = document.getElementById('customer-name');
const menuList = document.getElementById('menu-list');
const orderSummary = document.getElementById('order-summary');
const clearOrderButton = document.getElementById('clear-order-button');
const checkoutButton = document.getElementById('checkout-button');
const adminDashboard = document.getElementById('admin-dashboard');
let adminLogoutButton = null;
const totalOrdersEl = document.getElementById('total-orders');
const totalSalesEl = document.getElementById('total-sales');
const clearHistoryButton = document.getElementById('clear-history-button');
const historySummary = document.getElementById('history-summary');
const salesReport = document.getElementById('sales-report');

function initializePage() {
    // User page initialization: render menu and load history/sales only if elements exist
    renderMenu();
    loadCurrentOrder();
    renderOrderSummary();
    if (historySummary) {
        loadOrderHistory();
    }
    if (salesReport) {
        updateSalesReport();
    }

    // Realtime listeners so history updates instantly across open pages/tabs
    if (typeof BroadcastChannel !== 'undefined') {
        const bc = new BroadcastChannel('food-order-channel');
        bc.addEventListener('message', (ev) => {
            if (ev.data && (ev.data.type === 'new-order' || ev.data.type === 'removed-order' || ev.data.type === 'removed-all' || ev.data.type === 'updated-order' || ev.data.type === 'recent-order')) {
                if (historySummary) {
                    loadOrderHistory();
                }
                if (salesReport) {
                    updateSalesReport();
                }
            }
        });
    }

    window.addEventListener('storage', (e) => {
        if (e.key === STORAGE_HISTORY || e.key === 'orderHistory_updated' || e.key === 'recent_order' || e.key === STORAGE_CURRENT_ORDER || e.key === 'current_order_cleared') {
            if (historySummary) {
                loadOrderHistory();
            }
            if (salesReport) {
                updateSalesReport();
            }
            try {
                loadCurrentOrder();
                renderOrderSummary();
            } catch (err) {}
        }
    });

    window.addEventListener('focus', () => {
        if (historySummary) {
            loadOrderHistory();
        }
        if (salesReport) {
            updateSalesReport();
        }
    });

    window.addEventListener('pageshow', () => {
        if (historySummary) {
            loadOrderHistory();
        }
        if (salesReport) {
            updateSalesReport();
        }
    });

    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
            if (historySummary) {
                loadOrderHistory();
            }
            if (salesReport) {
                updateSalesReport();
            }
        }
    });

    clearOrderButton.addEventListener('click', clearOrder);
    checkoutButton.addEventListener('click', goToCheckout);
    if (clearHistoryButton) {
        clearHistoryButton.addEventListener('click', clearOrderHistory);
    }
    customerNameInput.addEventListener('input', saveCurrentOrder);
}

function logout() {
    localStorage.removeItem('user');
    window.location.href = 'login.html';
}

function renderMenu() {
    menuList.innerHTML = '';

    MENU.forEach(item => {
        const card = document.createElement('article');
        card.className = 'menu-item';

        const image = document.createElement('img');
        image.className = 'menu-image';
        image.src = item.imageUrl;
        image.alt = item.name;
        image.loading = 'lazy';
        // set explicit dimensions to help layout and provide a robust fallback
        image.width = 400;
        image.height = 240;
        image.style.display = 'block';
        image.onerror = () => {
            // fallback: simple inline SVG as data URI with item name
            const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='400' height='240'><rect width='100%25' height='100%25' fill='%23ffcd02'/><text x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-size='20' fill='%231e2a43'>${escapeHtml(item.name)}</text></svg>`;
            image.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
        };

        const title = document.createElement('h3');
        title.textContent = item.name;

        const price = document.createElement('p');
        price.className = 'item-price';
        price.textContent = `₱${item.price.toFixed(2)}`;

        const controls = document.createElement('div');
        controls.className = 'item-controls';

        const quantityInput = document.createElement('input');
        quantityInput.type = 'number';
        quantityInput.min = '1';
        quantityInput.value = '1';
        quantityInput.setAttribute('aria-label', `Quantity for ${item.name}`);

        const addButton = document.createElement('button');
        addButton.type = 'button';
        addButton.className = 'button secondary';
        addButton.textContent = 'Add to Cart';
        addButton.addEventListener('click', () => addItemToOrder(item.id, parseInt(quantityInput.value, 10)));

        controls.appendChild(quantityInput);
        controls.appendChild(addButton);

        card.appendChild(image);
        card.appendChild(title);
        card.appendChild(price);
        card.appendChild(controls);
        menuList.appendChild(card);
    });
}

function escapeHtml(text) {
    return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

async function addItemToOrder(itemId, quantity) {
    if (!Number.isInteger(quantity) || quantity < 1) {
        await showModal({
            title: 'Invalid quantity',
            message: 'Please enter a valid quantity of 1 or more.',
            type: 'error',
            confirmText: 'OK'
        });
        return;
    }

    const menuItem = MENU.find(item => item.id === itemId);
    if (!menuItem) {
        await showModal({
            title: 'Invalid item',
            message: 'Selected menu item is invalid.',
            type: 'error',
            confirmText: 'OK'
        });
        return;
    }

    if (!orderItems[itemId]) {
        orderItems[itemId] = {
            id: itemId,
            name: menuItem.name,
            price: menuItem.price,
            quantity: 0,
        };
    }

    orderItems[itemId].quantity += quantity;
    resetOrderMeta();
    saveCurrentOrder();
    renderOrderSummary();
    try {
        if (typeof window.showToast === 'function') {
            window.showToast(`Added ${quantity} × ${menuItem.name} to cart`, { type: 'success', duration: 1800 });
        }
    } catch (e) { /* ignore toast errors */ }
}

function renderOrderSummary() {
    orderSummary.innerHTML = '';
    const itemIds = Object.keys(orderItems);

    if (itemIds.length === 0) {
        orderSummary.innerHTML = '<p>Your order is empty. Add items from the menu.</p>';
        return;
    }

    const list = document.createElement('ul');
    list.className = 'details-list';

    itemIds.forEach(id => {
        const item = orderItems[id];
        const lineTotal = item.price * item.quantity;

        const entry = document.createElement('li');
        entry.innerHTML = `
            <div>
                <strong>${item.name}</strong><br />
                <span>₱${item.price.toFixed(2)} × ${item.quantity}</span>
            </div>
            <div>
                <strong>₱${lineTotal.toFixed(2)}</strong>
                <div class="item-actions">
                    <button type="button" class="button tertiary" data-action="decrease" data-id="${id}">−</button>
                    <button type="button" class="button tertiary" data-action="increase" data-id="${id}">+</button>
                    <button type="button" class="button danger" data-action="remove" data-id="${id}">Remove</button>
                </div>
            </div>
        `;

        list.appendChild(entry);
    });

    orderSummary.appendChild(list);

    const totals = calculateTotals();
    const totalsBlock = document.createElement('div');
    totalsBlock.className = 'total-row';
    totalsBlock.innerHTML = `
        <p><strong>Total Orders:</strong> ${totals.totalItems} Items</p>
        <p><strong>Total Quantity:</strong> ${totals.totalQuantity}</p>
        <p><strong>Grand Total:</strong> ₱${totals.totalAmount.toFixed(2)}</p>
    `;

    orderSummary.appendChild(totalsBlock);
    attachSummaryControls();
}

function attachSummaryControls() {
    const buttons = orderSummary.querySelectorAll('button[data-action]');
    buttons.forEach(button => {
        button.addEventListener('click', () => {
            const action = button.dataset.action;
            const itemId = Number(button.dataset.id);

            if (action === 'increase') {
                orderItems[itemId].quantity += 1;
            } else if (action === 'decrease') {
                orderItems[itemId].quantity = Math.max(orderItems[itemId].quantity - 1, 0);
            } else if (action === 'remove') {
                delete orderItems[itemId];
            }

            if (orderItems[itemId] && orderItems[itemId].quantity === 0) {
                delete orderItems[itemId];
            }

            resetOrderMeta();
            saveCurrentOrder();
            renderOrderSummary();
        });
    });
}

function calculateTotals() {
    const totals = {
        totalItems: 0,
        totalQuantity: 0,
        totalAmount: 0,
    };

    Object.values(orderItems).forEach(item => {
        totals.totalItems += 1;
        totals.totalQuantity += item.quantity;
        totals.totalAmount += item.price * item.quantity;
    });

    return totals;
}

function getLastOrderNumber() {
    const stored = localStorage.getItem(STORAGE_LAST_ORDER_NUMBER);
    const parsed = parseInt(stored, 10);
    return Number.isFinite(parsed) ? parsed : 0;
}

function setLastOrderNumber(orderNumber) {
    if (!Number.isFinite(orderNumber)) return;
    localStorage.setItem(STORAGE_LAST_ORDER_NUMBER, String(orderNumber));
}

function getNextOrderNumber() {
    const history = getOrderHistory();
    const maxHistoryOrder = history.reduce((max, entry) => {
        const num = Number(entry.orderNumber);
        return Number.isFinite(num) ? Math.max(max, num) : max;
    }, 0);
    const lastOrderNumber = getLastOrderNumber();
    const nextOrder = Math.max(maxHistoryOrder, lastOrderNumber) + 1;
    return nextOrder === 0 ? 1 : nextOrder;
}

async function saveCurrentOrder() {
    const customerName = customerNameInput.value.trim();
    const totals = calculateTotals();
    const persistence = {
        customerName,
        orderNumber: orderMeta.orderNumber || getNextOrderNumber(),
        dateTime: new Date().toLocaleString(),
        items: Object.values(orderItems).map(item => ({
            id: item.id,
            name: item.name,
            price: item.price,
            quantity: item.quantity,
            lineTotal: item.price * item.quantity,
        })),
        totalQuantity: totals.totalQuantity,
        totalAmount: totals.totalAmount,
        paymentStatus: orderMeta.paymentStatus,
    };

    try {
        localStorage.setItem(STORAGE_CURRENT_ORDER, JSON.stringify(persistence));
        console.log('Order successfully saved to localStorage:', persistence);
    } catch (e) {
        console.error('Failed to save order to localStorage:', e);
        await showModal({
            title: 'Save error',
            message: 'Error saving order: ' + e.message,
            type: 'error',
            confirmText: 'OK'
        });
    }
}

function loadCurrentOrder() {
    const stored = localStorage.getItem(STORAGE_CURRENT_ORDER);
    if (!stored) {
        orderItems = {};
        orderMeta = {
            orderNumber: null,
            paymentStatus: 'PENDING',
        };
        return;
    }

    const savedOrder = JSON.parse(stored);
    if (savedOrder.customerName) {
        customerNameInput.value = savedOrder.customerName;
    }

    orderItems = {};
    savedOrder.items.forEach(item => {
        orderItems[item.id] = {
            id: item.id,
            name: item.name,
            price: item.price,
            quantity: item.quantity,
        };
    });

    orderMeta = {
        orderNumber: savedOrder.orderNumber,
        paymentStatus: savedOrder.paymentStatus || 'PENDING',
    };
}

function resetOrderMeta() {
    orderMeta.paymentStatus = 'PENDING';
}

function clearOrder() {
    orderItems = {};
    orderMeta = {
        orderNumber: null,
        paymentStatus: 'PENDING',
    };
    customerNameInput.value = '';
    localStorage.removeItem(STORAGE_CURRENT_ORDER);
    renderOrderSummary();
}

async function goToCheckout() {
    if (Object.keys(orderItems).length === 0) {
        await showModal({
            title: 'No items added',
            message: 'Please add items before checking out.',
            type: 'error',
            confirmText: 'OK'
        });
        return;
    }

    const customerName = customerNameInput.value.trim();
    if (!customerName) {
        await showModal({
            title: 'Customer name required',
            message: 'Please enter the customer name before checking out.',
            type: 'error',
            confirmText: 'OK'
        });
        customerNameInput.focus();
        return;
    }

    if (!orderMeta.orderNumber) {
        orderMeta.orderNumber = getNextOrderNumber();
    }

    const totals = calculateTotals();
    const confirmMessage = `Confirm order for ${customerName}?\n\nTotal Items: ${totals.totalQuantity}\nTotal Amount: ₱${totals.totalAmount.toFixed(2)}`;
    const confirmed = await showModal({
        title: 'Confirm Checkout',
        message: confirmMessage,
        type: 'confirm',
        confirmText: 'Yes, checkout',
        cancelText: 'Cancel',
        showCancel: true
    });

    if (confirmed) {
        console.log('User confirmed order. Saving to localStorage and opening checkout page...');
        saveCurrentOrder();
        window.location.href = 'checkout.html';
    } else {
        console.log('User cancelled checkout.');
    }
}

function getOrderHistory() {
    const historyJson = localStorage.getItem(STORAGE_HISTORY);
    if (!historyJson) return [];

    try {
        const parsed = JSON.parse(historyJson);
        return Array.isArray(parsed) ? parsed : parsed ? [parsed] : [];
    } catch (e) {
        return [];
    }
}

function loadOrderHistory() {
    if (!historySummary) return;
    const history = getOrderHistory();
    historySummary.innerHTML = '';

    if (history.length === 0) {
        historySummary.innerHTML = '<p>No completed orders yet.</p>';
        return;
    }

    history.slice().reverse().forEach(entry => {
        const card = createHistoryCard(entry);
        historySummary.appendChild(card);
    });
}

function createHistoryCard(orderData) {
    const card = document.createElement('article');
    card.className = 'history-card';

    const header = document.createElement('button');
    header.className = 'history-card-header';
    header.type = 'button';
    header.setAttribute('aria-expanded', 'false');
    header.innerHTML = `
        <div>
            <strong>Order #${orderData.orderNumber} — ${orderData.customerName}</strong>
            <span>${orderData.dateTime}</span>
        </div>
        <div style="display:flex;align-items:center;gap:12px;">
            <span class="badge">${orderData.paymentStatus}</span>
            <span class="history-toggle" aria-hidden="true">▸</span>
        </div>
    `;

    const details = document.createElement('div');
    details.className = 'history-details';

    details.innerHTML = `
        <div class="history-items">
            ${orderData.items.map(item => `<p class="history-item-line">${item.name} x${item.quantity} = ₱${item.lineTotal.toFixed(2)}</p>`).join('')}
        </div>
        <div class="history-summary">
            <div><strong>Total:</strong> ₱${orderData.totalAmount.toFixed(2)}</div>
            <div><strong>Status:</strong> ${orderData.paymentStatus}</div>
            <div style="padding-top:12px;display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
                <button type="button" class="button secondary print-history-button" data-order="${orderData.orderNumber}">Print Receipt</button>
                <button type="button" class="button danger remove-order-button" data-order="${orderData.orderNumber}">Remove</button>
            </div>
        </div>
    `;

    header.addEventListener('click', () => {
        const expanded = card.classList.toggle('expanded');
        header.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    });

    // Wire remove button inside the details area
    const removeBtn = details.querySelector('.remove-order-button');
    if (removeBtn) {
        removeBtn.addEventListener('click', async (ev) => {
            ev.stopPropagation();
            const num = Number(removeBtn.dataset.order);
            if (!Number.isFinite(num)) return;
            const confirmDel = await showModal({
                title: 'Remove order?',
                message: `Remove Order #${num} from history? This cannot be undone.`,
                type: 'confirm',
                confirmText: 'Remove',
                cancelText: 'Cancel',
                showCancel: true
            });
            if (!confirmDel) return;
            removeOrderFromHistory(num, card);
        });
    }

    const printBtn = details.querySelector('.print-history-button');
    if (printBtn) {
        printBtn.addEventListener('click', (ev) => {
            ev.stopPropagation();
            const num = Number(printBtn.dataset.order);
            if (!Number.isFinite(num)) return;
            const entry = getOrderHistory().find(h => Number(h.orderNumber) === num);
            if (entry) {
                printOrderReceipt(entry);
            }
        });
    }

    card.appendChild(header);
    card.appendChild(details);
    return card;
}

function removeOrderFromHistory(orderNumber, cardElement) {
    const history = getOrderHistory();
    const newHistory = history.filter(h => Number(h.orderNumber) !== Number(orderNumber));
    localStorage.setItem(STORAGE_HISTORY, JSON.stringify(newHistory));

    if (cardElement && cardElement.parentNode) {
        cardElement.parentNode.removeChild(cardElement);
    }

    // Sync delete to backend
    fetch(`${API_BASE_URL}/orders/${orderNumber}`, {
        method: 'DELETE',
        headers: {
            'Content-Type': 'application/json'
        }
    })
    .then(res => res.json())
    .then(data => {
        console.log('Order deleted from backend:', data);
    })
    .catch(error => console.error('Error deleting from backend:', error));

    loadOrderHistory();
    updateSalesReport();

    try {
        localStorage.setItem('orderHistory_updated', new Date().toISOString());
    } catch (e) {}

    if (typeof BroadcastChannel !== 'undefined') {
        try {
            const bc = new BroadcastChannel('food-order-channel');
            bc.postMessage({ type: 'removed-order', orderNumber });
            bc.close();
        } catch (err) {}
    }
}

async function clearOrderHistory() {
    const history = getOrderHistory();
    if (!history || history.length === 0) {
        await showModal({
            title: 'No orders found',
            message: 'There are no orders to remove.',
            type: 'info',
            confirmText: 'OK'
        });
        return;
    }

    const confirmed = await showModal({
        title: 'Clear all orders?',
        message: 'Remove all orders from order history? This cannot be undone.',
        type: 'confirm',
        confirmText: 'Clear All',
        cancelText: 'Cancel',
        showCancel: true
    });
    if (!confirmed) return;
    // First sync delete to backend (which will also clear sheet rows)
    fetch(`${API_BASE_URL}/orders`, { method: 'DELETE' })
        .then(res => res.json())
        .then(data => {
            console.log('Cleared orders on backend:', data);

            // Clear frontend storage and reset numbering
            localStorage.removeItem(STORAGE_HISTORY);
            localStorage.removeItem('recent_order');
            try {
                const cur = localStorage.getItem(STORAGE_CURRENT_ORDER);
                if (cur) {
                    const parsed = JSON.parse(cur);
                    parsed.orderNumber = null;
                    localStorage.setItem(STORAGE_CURRENT_ORDER, JSON.stringify(parsed));
                    if (typeof orderMeta !== 'undefined' && orderMeta) {
                        orderMeta.orderNumber = null;
                    }
                }
            } catch (e) {}

            try { localStorage.setItem('orderHistory_updated', new Date().toISOString()); } catch (e) {}

            if (typeof BroadcastChannel !== 'undefined') {
                try { const bc = new BroadcastChannel('food-order-channel'); bc.postMessage({ type: 'removed-all' }); bc.close(); } catch (err) {}
            }

            loadOrderHistory();
            updateSalesReport();
        })
        .catch(async err => {
            console.error('Could not clear backend orders:', err);
            await showModal({
                title: 'Server error',
                message: 'Could not clear orders on the server. Check backend connection.',
                type: 'error',
                confirmText: 'OK'
            });
        });
}

function printOrderReceipt(orderData) {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const rows = orderData.items.map(item => `
            <div class="receipt-item">
                <div>
                    <strong>${item.name}</strong><br />
                    <span>₱${item.price.toFixed(2)} × ${item.quantity}</span>
                </div>
                <div>
                    <span>₱${item.lineTotal.toFixed(2)}</span>
                </div>
            </div>
        `).join('');

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <title>Receipt #${orderData.orderNumber}</title>
    <style>
        @page { size: 80mm auto; margin: 8mm; }
        body { font-family: Arial, sans-serif; width: 80mm; max-width: 100%; margin: 0; padding: 12px; color: #152943; box-sizing: border-box; }
        h1 { margin-bottom: 10px; font-size: 1rem; }
        .receipt-header, .receipt-summary { margin-bottom: 14px; font-size: 0.92rem; }
        .receipt-header > div, .receipt-summary div { margin-bottom: 8px; }
        .receipt-item { display: grid; grid-template-columns: 1fr auto; gap: 8px; margin-bottom: 8px; font-size: 0.95rem; }
        .receipt-summary div span, .receipt-header div span { display: inline-block; }
        .receipt-summary strong, .receipt-header strong { font-weight: 700; }
        .badge { display: inline-block; padding: 4px 8px; border-radius: 999px; background: #eef2ff; color: #3730a3; font-weight: 700; font-size: 0.85rem; }
        body, html { background: white; }
    </style>
</head>
<body>
    <h1>Receipt</h1>
    <div class="receipt-header">
        <div><strong>Customer:</strong> ${orderData.customerName}</div>
        <div><strong>Order #:</strong> ${orderData.orderNumber}</div>
        <div><strong>Date:</strong> ${orderData.dateTime}</div>
        <div><strong>Status:</strong> <span class="badge">${orderData.paymentStatus}</span></div>
    </div>
    ${rows}
        <div class="receipt-summary">
            <div><strong>Total items:</strong> ${orderData.totalQuantity}</div>
            <div><strong>Total amount:</strong> ₱${orderData.totalAmount.toFixed(2)}</div>
            <div><strong>Status:</strong> ${orderData.paymentStatus}</div>
    </div>
    <script>window.print(); window.onfocus = () => window.close();</script>
</body>
</html>`;

    printWindow.document.write(html);
    printWindow.document.close();
}

function updateSalesReport() {
    if (!salesReport) return;
    const history = getOrderHistory();
    salesReport.innerHTML = '';

    if (history.length === 0) {
        salesReport.innerHTML = '<p>No sales to report.</p>';
        return;
    }

    const totalsByDate = history.reduce((report, orderData) => {
        const day = orderData.dateTime.split(',')[0].trim();
        report[day] = (report[day] || 0) + orderData.totalAmount;
        return report;
    }, {});

    const list = document.createElement('ul');
    list.className = 'details-list';

    Object.entries(totalsByDate).forEach(([date, total]) => {
        const item = document.createElement('li');
        item.innerHTML = `<div>${date}</div><div>₱${total.toFixed(2)}</div>`;
        list.appendChild(item);
    });

    salesReport.appendChild(list);
}

initializePage();