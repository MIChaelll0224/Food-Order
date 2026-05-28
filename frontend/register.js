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

function handleRegister(event) {
    event.preventDefault();

    const username = document.getElementById("registerUsername").value.trim();
    const password = document.getElementById("registerPassword").value.trim();
    const confirmPassword = document.getElementById("registerConfirmPassword").value.trim();
    const messageEl = document.getElementById("registerMessage");

    // Validation
    if (!username || !password || !confirmPassword) {
        messageEl.innerText = "Please fill in all fields";
        messageEl.className = "auth-message error";
        return;
    }

    if (password.length < 4) {
        messageEl.innerText = "Password must be at least 4 characters";
        messageEl.className = "auth-message error";
        return;
    }

    if (password !== confirmPassword) {
        messageEl.innerText = "Passwords do not match";
        messageEl.className = "auth-message error";
        return;
    }

    fetchWithFallback(`${API_BASE_URL}/register`, {
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
            messageEl.innerText = "Registration successful! Redirecting to login...";
            messageEl.className = "auth-message success";
            
            setTimeout(() => {
                window.location.href = "login.html";
            }, 1500);
        } else {
            messageEl.innerText = data.message || "Registration failed";
            messageEl.className = "auth-message error";
        }
    })
    .catch(error => {
        console.error("Error:", error);
        messageEl.innerText = CONNECTION_ERROR_TEXT;
        messageEl.className = "auth-message error";
    });
}