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
const CONNECTION_ERROR_TEXT = `Connection error. Please make sure the backend is available at ${API_BASE_URL}.`;

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

    fetchWithFallback(`${API_BASE_URL}/login`, {
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