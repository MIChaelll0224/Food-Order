// checkout.js
// Checkout page logic: load order data and display receipt.

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

const STORAGE_CURRENT_ORDER = 'currentFoodOrder';
const STORAGE_HISTORY = 'foodOrderHistory';
const STORAGE_LAST_ORDER_NUMBER = 'lastOrderNumber';

const receiptStatus = document.getElementById('receipt-status');
const receiptCustomer = document.getElementById('receipt-customer');
const receiptNumber = document.getElementById('receipt-number');
const receiptDate = document.getElementById('receipt-date');
const receiptItems = document.getElementById('receipt-items');
const receiptTotalOrders = document.getElementById('receipt-total-orders');
const receiptTotalAmount = document.getElementById('receipt-total-amount');
const backButton = document.getElementById('back-button');
const confirmOrderButton = document.getElementById('confirm-order-button');

let currentOrder = null;

function initializeCheckout() {
    loadCurrentOrder();
    
    // Add back button listener first so it always works
    if (backButton) {
        backButton.addEventListener('click', () => window.location.href = 'index.html');
    }
    
    // Add confirm order button listener
    if (confirmOrderButton) {
        confirmOrderButton.addEventListener('click', confirmOrder);
    }
    
    if (!currentOrder || !currentOrder.items || currentOrder.items.length === 0) {
        showEmptyState();
        return;
    }

    renderReceipt();
}

function loadCurrentOrder() {
    const saved = localStorage.getItem(STORAGE_CURRENT_ORDER);
    console.log('localStorage content:', saved);
    
    if (!saved) {
        currentOrder = null;
        console.warn('No order found in localStorage');
        return;
    }

    try {
        currentOrder = JSON.parse(saved);
        console.log('Order loaded successfully:', currentOrder);
    } catch (e) {
        console.error('Failed to parse order:', e);
        currentOrder = null;
    }
}

function showEmptyState() {
    receiptStatus.textContent = 'No order found';
    receiptCustomer.textContent = '-';
    receiptNumber.textContent = '-';
    receiptDate.textContent = '-';
    receiptItems.innerHTML = '<p>Please return to the order page and place an order.</p>';
    receiptTotalOrders.textContent = '0';
    receiptTotalAmount.textContent = '₱0.00';
}

function renderReceipt() {
    if (!currentOrder) {
        showEmptyState();
        return;
    }
    
    const statusMap = {
        'COMPLETED': 'PAID',
        'PENDING': 'PENDING'
    };
    receiptStatus.textContent = statusMap[currentOrder.paymentStatus] || (currentOrder.paymentStatus || 'PENDING');
    receiptCustomer.textContent = currentOrder.customerName || 'Unknown';
    receiptNumber.textContent = currentOrder.orderNumber || '-';
    receiptDate.textContent = currentOrder.dateTime || new Date().toLocaleString();

    receiptItems.innerHTML = '';
    
    if (currentOrder.items && currentOrder.items.length > 0) {
        currentOrder.items.forEach(item => {
            const row = document.createElement('div');
            row.className = 'receipt-item';
            row.innerHTML = `
                <div>
                    <strong>${item.name}</strong><br />
                    <span>₱${item.price.toFixed(2)} × ${item.quantity}</span>
                </div>
                <div>
                    <span>₱${item.lineTotal.toFixed(2)}</span>
                </div>
            `;
            receiptItems.appendChild(row);
        });
    }

    receiptTotalOrders.textContent = currentOrder.totalQuantity || '0';
    receiptTotalAmount.textContent = `₱${(currentOrder.totalAmount || 0).toFixed(2)}`;
}

async function confirmOrder() {
    if (!currentOrder) {
        await showModal({
            title: 'No order found',
            message: 'No order to confirm.',
            type: 'error',
            confirmText: 'OK'
        });
        return;
    }

    const confirmed = await showModal({
        title: 'Confirm Order',
        message: `Confirm order #${currentOrder.orderNumber} for ${currentOrder.customerName}?\n\nThis will finalize your order.`,
        type: 'confirm',
        confirmText: 'Confirm Order',
        cancelText: 'Cancel',
        showCancel: true
    });
    if (!confirmed) return;

    currentOrder.paymentStatus = 'COMPLETED';
    currentOrder.confirmedAt = new Date().toLocaleString();

    // Save to localStorage
    try {
        localStorage.setItem(STORAGE_CURRENT_ORDER, JSON.stringify(currentOrder));
    } catch (e) {
        console.error('Failed to save order:', e);
    }

    if (confirmOrderButton) {
        confirmOrderButton.disabled = true;
        confirmOrderButton.textContent = 'Processing...';
        confirmOrderButton.setAttribute('aria-busy', 'true');
    }

    // Send to Google Sheets
    try {
        console.log('Sending order confirmation to Google Sheets...', currentOrder);
        
        const response = await fetchWithFallback(`${API_BASE_URL}/order`, {
            method: 'POST',
            mode: 'cors',
            cache: 'no-cache',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                customerName: currentOrder.customerName,
                orderNumber: currentOrder.orderNumber,
                dateTime: currentOrder.dateTime,
                paymentStatus: currentOrder.paymentStatus,
                totalAmount: currentOrder.totalAmount,
                totalQuantity: currentOrder.totalQuantity,
                items: currentOrder.items,
                confirmedAt: currentOrder.confirmedAt
            })
        });

        let data = null;
        try {
            data = await response.json();
        } catch (jsonError) {
            console.warn('Failed to parse backend response as JSON:', jsonError);
        }

        if (!response.ok) {
            const errorMessage = data && data.message ? data.message : `Server error (${response.status})`;

            if (response.status === 409) {
                console.warn('Duplicate order blocked, marking order as confirmed locally:', data);
                saveOrderHistory(currentOrder);
                try {
                    localStorage.removeItem(STORAGE_CURRENT_ORDER);
                } catch (e) {
                    console.warn('Could not clear current order from storage:', e);
                }
                await showModal({
                    title: 'Order Already Confirmed',
                    message: `Order #${currentOrder.orderNumber} was already submitted. It has been recorded and saved locally.`,
                    type: 'success',
                    confirmText: 'OK'
                });
                receiptStatus.textContent = 'COMPLETED';
                if (confirmOrderButton) {
                    confirmOrderButton.disabled = true;
                    confirmOrderButton.textContent = 'Order Confirmed ✓';
                }
                    try {
                        localStorage.setItem('recent_order', JSON.stringify(currentOrder));
                    } catch (e) {}
                    if (typeof BroadcastChannel !== 'undefined') {
                        try { const bc = new BroadcastChannel('food-order-channel'); bc.postMessage({ type: 'new-order', orderNumber: currentOrder.orderNumber }); bc.close(); } catch (err) {}
                    }
                return;
            }

            if (response.status === 429) {
                await showModal({
                    title: 'Order Processing',
                    message: 'Your order is already being processed. Please wait a moment and try again if needed.',
                    type: 'info',
                    confirmText: 'OK'
                });
                return;
            }

            throw new Error(errorMessage);
        }

        if (!data || !data.success) {
            const errorMessage = data && data.message ? data.message : 'Unexpected backend response';
            throw new Error(errorMessage);
        }

        console.log('Order successfully updated in Google Sheets');
        saveOrderHistory(currentOrder);
        try {
            localStorage.removeItem(STORAGE_CURRENT_ORDER);
        } catch (e) {
            console.warn('Could not clear current order from storage:', e);
        }
        await showModal({
            title: 'Order Confirmed',
            message: `✓ Order #${currentOrder.orderNumber} confirmed and saved!\n\nCustomer: ${currentOrder.customerName}\nTotal: ₱${currentOrder.totalAmount.toFixed(2)}`,
            type: 'success',
            confirmText: 'OK'
        });
        receiptStatus.textContent = 'COMPLETED';
        if (confirmOrderButton) {
            confirmOrderButton.disabled = true;
            confirmOrderButton.textContent = 'Order Confirmed ✓';
        }
        try {
            localStorage.setItem('recent_order', JSON.stringify(currentOrder));
        } catch (e) {}
        if (typeof BroadcastChannel !== 'undefined') {
            try { const bc = new BroadcastChannel('food-order-channel'); bc.postMessage({ type: 'new-order', orderNumber: currentOrder.orderNumber }); bc.close(); } catch (err) {}
        }
    } catch (error) {
        console.error('Failed to update order in Google Sheets:', error);
        if (confirmOrderButton) {
            confirmOrderButton.disabled = false;
            confirmOrderButton.removeAttribute('aria-busy');
            confirmOrderButton.textContent = 'Confirm Order';
        }
        await showModal({
            title: 'Connection error',
            message: 'Order saved locally but could not connect to Google Sheets.\n\nError: ' + error.message,
            type: 'error',
            confirmText: 'OK'
        });
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

function setLastOrderNumber(orderNumber) {
    if (!Number.isFinite(orderNumber)) return;
    localStorage.setItem(STORAGE_LAST_ORDER_NUMBER, String(orderNumber));
}

function saveOrderHistory(orderData) {
    if (!orderData || !orderData.orderNumber) return;

    const history = getOrderHistory();
    const exists = history.some(entry => Number(entry.orderNumber) === Number(orderData.orderNumber));
    if (exists) return;

    const entry = {
        customerName: orderData.customerName,
        orderNumber: orderData.orderNumber,
        dateTime: orderData.dateTime,
        items: orderData.items || [],
        totalQuantity: orderData.totalQuantity || 0,
        totalAmount: orderData.totalAmount || 0,
        paymentStatus: orderData.paymentStatus || 'COMPLETED',
    };

    history.push(entry);
    localStorage.setItem(STORAGE_HISTORY, JSON.stringify(history));
    setLastOrderNumber(Number(entry.orderNumber));
    try {
        localStorage.setItem('orderHistory_updated', new Date().toISOString());
    } catch (e) {}
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeCheckout);
} else {
    initializeCheckout();
}
