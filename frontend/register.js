const API_BASE_URL = "https://food-order-j6xw.onrender.com";
const CONNECTION_ERROR_TEXT = "Connection error. Please make sure the backend is available at https://food-order-j6xw.onrender.com.";

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

    fetch(`${API_BASE_URL}/register`, {
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