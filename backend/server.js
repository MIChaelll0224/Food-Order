// server.js

const express = require("express");
const cors = require("cors");
const { google } = require("googleapis");

const app = express();
const PORT = 3000;

// =========================
// GOOGLE SHEETS AUTH
// =========================

const auth = new google.auth.GoogleAuth({
    keyFile: "food-order-key.json",
    scopes: ["https://www.googleapis.com/auth/spreadsheets"]
});

const sheets = google.sheets({
    version: "v4",
    auth
});

const SPREADSHEET_ID = "1xc8UCMEmuFt7JEvWVELz436qp5XdoF18c6Lvg40vUdE";

// =========================
// MIDDLEWARE
// =========================

app.use(cors());
app.use(express.json());

// =========================
// TEMP DATABASE (RAM ONLY)
// =========================

let users = [
    { id: 1, username: "admin", password: "1234", role: "admin" },
    { id: 2, username: "user", password: "1234", role: "user" }
];

let orders = [];

// 🔥 Prevent duplicate requests
const processedOrders = new Set();
const processingOrders = new Set();

// =========================
// TEST ROUTE
// =========================

app.get("/", (req, res) => {
    res.send("Backend is working 🚀");
});

// =========================
// LOGIN
// =========================

app.post("/login", (req, res) => {
    const { username, password } = req.body;

    const user = users.find(u =>
        u.username === username &&
        u.password === password
    );

    if (!user) {
        return res.status(401).json({
            success: false,
            message: "Invalid username or password"
        });
    }

    res.json({
        success: true,
        message: "Login successful",
        user: {
            id: user.id,
            username: user.username,
            role: user.role
        }
    });
});

// =========================
// REGISTER
// =========================

app.post("/register", (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({
            success: false,
            message: "Username and password are required"
        });
    }

    const existingUser = users.find(u => u.username === username);

    if (existingUser) {
        return res.status(400).json({
            success: false,
            message: "Username already exists"
        });
    }

    const newUser = {
        id: users.length + 1,
        username,
        password,
        role: "user"
    };

    users.push(newUser);

    res.json({
        success: true,
        message: "Registration successful",
        user: newUser
    });
});

// =========================
// CREATE ORDER (FIXED)
// =========================

app.post("/order", async (req, res) => {
    const {
        customerName,
        orderNumber,
        items,
        totalAmount,
        totalQuantity,
        dateTime,
        paymentStatus,
        cashReceived,
        change,
        changeStatus
    } = req.body;

    // Validation
    if (!customerName || !orderNumber || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({
            success: false,
            message: "Invalid order data"
        });
    }

    // 🔥 Prevent duplicate request (double click fix)
    if (processedOrders.has(orderNumber)) {
        return res.status(409).json({
            success: false,
            message: "Duplicate order blocked"
        });
    }

    // 🔥 Prevent race condition
    if (processingOrders.has(orderNumber)) {
        return res.status(429).json({
            success: false,
            message: "Order is already processing"
        });
    }

    processingOrders.add(orderNumber);

    try {
        // =========================
        // ONE ORDER = ONE ROW PER ITEM (match Sheet columns A:I)
        // Columns: OrderNumber, CustomerName, DateTime, ItemName, ItemQuantity, ItemPrice, TotalQuantity, TotalAmount, Status
        // =========================

        const HEADER = [
            'OrderNumber',
            'CustomerName',
            'DateTime',
            'ItemName',
            'ItemQuantity',
            'ItemPrice',
            'TotalQuantity',
            'TotalAmount',
            'Status',
            'CashReceived',
            'Change'
        ];

        // Ensure header exists once (best-effort)
        try {
            const headerRes = await sheets.spreadsheets.values.get({
                spreadsheetId: SPREADSHEET_ID,
                range: 'Sheet1!A1:K1'
            });
            const existingHeader = (headerRes.data.values && headerRes.data.values[0]) || [];
            const headerMismatch = HEADER.some((h, i) => existingHeader[i] !== h);
            if (existingHeader.length === 0 || headerMismatch) {
                await sheets.spreadsheets.values.update({
                    spreadsheetId: SPREADSHEET_ID,
                    range: 'Sheet1!A1:K1',
                    valueInputOption: 'USER_ENTERED',
                    requestBody: { values: [HEADER] }
                });
            }
        } catch (hdrErr) {
            console.log('Header check warning:', hdrErr.message);
        }

        // Build one row per item to match columns
        const values = items.map(item => [
            orderNumber,
            customerName,
            dateTime || new Date().toLocaleString(),
            item.name,
            item.quantity,
            item.price,
            totalQuantity,
            totalAmount,
            paymentStatus || 'PAID',
            cashReceived || 0,
            change || 0
        ]);

        await sheets.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ID,
            range: 'Sheet1!A:K',
            valueInputOption: 'USER_ENTERED',
            requestBody: { values }
        });

        // Save locally (cache only)
        orders.push({
            orderNumber,
            customerName,
            items,
            totalAmount,
            totalQuantity,
            cashReceived: cashReceived || 0,
            change: change || 0,
            changeStatus,
            dateTime: dateTime || new Date().toLocaleString(),
            paymentStatus: paymentStatus || 'PAID'
        });

        processedOrders.add(orderNumber);
        processingOrders.delete(orderNumber);

        res.json({
            success: true,
            message: 'Order placed successfully and saved to Google Sheets',
            order: { orderNumber, customerName }
        });

    } catch (error) {
        processingOrders.delete(orderNumber);

        res.status(500).json({
            success: false,
            message: "Failed to save order",
            error: error.message
        });
    }
});

// =========================
// GET ORDERS
// =========================

app.get("/orders", (req, res) => {
    const totalSales = orders.reduce(
        (sum, order) => sum + (order.totalAmount || 0),
        0
    );

    res.json({
        success: true,
        totalOrders: orders.length,
        totalSales,
        orders
    });
});

// =========================
// DELETE ORDER
// =========================

app.delete("/orders/:orderNumber", async (req, res) => {
    const orderNumber = req.params.orderNumber;

    const originalLength = orders.length;
    orders = orders.filter(o => o.orderNumber != orderNumber);

    if (orders.length === originalLength) {
        return res.status(404).json({
            success: false,
            message: "Order not found"
        });
    }

    try {
        const sheetMeta = await sheets.spreadsheets.get({
            spreadsheetId: SPREADSHEET_ID
        });

        const sheetId = sheetMeta.data.sheets[0].properties.sheetId;

        const data = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: "Sheet1!A:G"
        });

        const rows = data.data.values || [];
        const deletes = [];

        for (let i = rows.length - 1; i >= 1; i--) {
            if (rows[i] && rows[i][0] == orderNumber) {
                deletes.push(i + 1);
            }
        }

        if (deletes.length > 0) {
            const requests = deletes.map(rowIndex => ({
                deleteDimension: {
                    range: {
                        sheetId,
                        dimension: "ROWS",
                        startIndex: rowIndex - 1,
                        endIndex: rowIndex
                    }
                }
            }));

            await sheets.spreadsheets.batchUpdate({
                spreadsheetId: SPREADSHEET_ID,
                requestBody: { requests }
            });
        }

    } catch (error) {
        console.log("Sheet delete warning:", error.message);
    }

    res.json({
        success: true,
        message: `Order #${orderNumber} deleted`
    });
});

// =========================
// START SERVER
// =========================

app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
});

// =========================
// DELETE ALL ORDERS
// =========================

app.delete("/orders", async (req, res) => {
    // Clear in-memory orders and processed flags
    orders = [];
    processedOrders.clear();
    processingOrders.clear();

    try {
        const sheetMeta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
        const sheetId = sheetMeta.data.sheets[0].properties.sheetId;

        // Get existing rows starting from row 2 (below header)
        const data = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: 'Sheet1!A2:I'
        });

        const rows = data.data.values || [];
        if (rows.length > 0) {
            // delete rows 2..(1+rows.length)
            await sheets.spreadsheets.batchUpdate({
                spreadsheetId: SPREADSHEET_ID,
                requestBody: {
                    requests: [
                        {
                            deleteDimension: {
                                range: {
                                    sheetId,
                                    dimension: 'ROWS',
                                    startIndex: 1,
                                    endIndex: 1 + rows.length
                                }
                            }
                        }
                    ]
                }
            });
        }
    } catch (err) {
        console.log('Warning clearing sheet rows:', err.message);
        // continue — in-memory state already cleared
    }

    res.json({ success: true, message: 'All orders cleared (local + sheet)'});
});