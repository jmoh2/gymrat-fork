function redirectToLogin() {
    localStorage.removeItem("jwtToken");
    window.location.replace("/");
}

async function requireAuthenticatedPage() {
    const token = localStorage.getItem("jwtToken");

    if (!token) {
        redirectToLogin();
        return null;
    }

    try {
        const response = await fetch("/api/auth-check", {
            method: "GET",
            cache: "no-store",
            headers: {
                Authorization: token
            }
        });

        if (!response.ok) {
            redirectToLogin();
            return null;
        }

        return token;
    } catch (error) {
        console.error("Error checking authentication:", error);
        redirectToLogin();
        return null;
    }
}
