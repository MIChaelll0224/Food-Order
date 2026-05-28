// checkout.js
// Checkout page logic: load order data and display receipt.

const API_BASE_URL = "https://food-order-j6xw.onrender.com";
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

    // Send to Google Sheets
    try {
        console.log('Sending order confirmation to Google Sheets...', currentOrder);
        
        const response = await fetch(`${API_BASE_URL}/order`, {
            method: 'POST',
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

        const data = await response.json();
        
        if (data.success) {
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
            confirmOrderButton.disabled = true;
            confirmOrderButton.textContent = 'Order Confirmed ✓';
        } else {
            console.warn('Google Sheets update failed:', data);
            await showModal({
                title: 'Google Sheets error',
                message: 'Order saved locally but could not update Google Sheets. Check your backend connection.',
                type: 'error',
                confirmText: 'OK'
            });
        }
    } catch (error) {
        console.error('Failed to update order in Google Sheets:', error);
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
