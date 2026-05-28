const API_BASE_URL = "http://127.0.0.1:3000";
const CONNECTION_ERROR_TEXT = "Connection error. Please make sure the backend is running on http://127.0.0.1:3000.";

function handleLogin(event) {
    event.preventDefault();

    const username = document.getElementById("loginUsername").value.trim();
    const password = document.getElementById("loginPassword").value.trim();
    const messageEl = document.getElementById("loginMessage");

    if (!username || !password) {
        messageEl.innerText = "Please enter both username and password";
        messageEl.className = "auth-message error";
        return;
    }

    fetch(`${API_BASE_URL}/login`, {
        method: "POST",
        mode: "cors",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            username: username,
            password: password
        })
    })
    .then(res => res.json())
    .then(data => {
        console.log(data);

        if (data.success) {
            messageEl.innerText = "Login successful! Redirecting...";
            messageEl.className = "auth-message success";

            // Store user info in localStorage
            localStorage.setItem("user", JSON.stringify(data.user));

            // Redirect admin users to the admin panel, others to the user page
            try {
                const role = String((data.user && data.user.role) || '').trim().toLowerCase();
                if (role === 'admin') {
                    window.location.replace('admin.html');
                } else {
                    window.location.replace('index.html');
                }
            } catch (e) {
                window.location.replace('index.html');
            }
        } else {
            messageEl.innerText = data.message || "Login failed";
            messageEl.className = "auth-message error";
        }
    })
    .catch(error => {
        console.error("Error:", error);
        messageEl.innerText = CONNECTION_ERROR_TEXT;
        messageEl.className = "auth-message error";
    });
}