window.addEventListener("load", () => {

    async function requireLogin(e, goTo, btn) {
        e.preventDefault();

        let ok = false;

        if (window.isLoggedIn) {
            ok = await window.isLoggedIn();
        } else {
            try {
                const res = await fetch("/me");
                const user = await res.json();
                ok = !!user;
            } catch {
                ok = false;
            }
        }

        if (!ok) {
            // Shake the button
            if (btn) {
                btn.classList.add("shake");
                setTimeout(() => btn.classList.remove("shake"), 400);
            }

            // Show login warning
            let warn = document.getElementById("loginWarn");
            if (!warn) {
                warn = document.createElement("div");
                warn.id = "loginWarn";
                warn.innerText = "Please login first";
                document.body.appendChild(warn);
            }
            warn.style.display = "block";
            setTimeout(() => warn.style.display = "none", 2000);

            return false;
        }

        // If logged in, go to destination
        if (goTo) window.location.href = goTo;
        return true;
    }

    // Buttons
    document.querySelectorAll(".navBtn").forEach(btn => {
        const text = btn.textContent.trim();

        if (text === "Restocks")
            btn.addEventListener("click", (e) => requireLogin(e, "/restocks", btn));

        if (text === "Proofs")
            btn.addEventListener("click", (e) => requireLogin(e, "/proofs", btn));

        if (text === "Support")
            btn.addEventListener("click", (e) => requireLogin(e, "/support", btn));
    });

    // Shop links
    document.querySelectorAll("#shopMenu a").forEach(a => {
        a.addEventListener("click", (e) => requireLogin(e, a.getAttribute("href"), a));
    });

    // Dropdown
    const shopToggle = document.getElementById("shopToggle");
    const shopMenu = document.getElementById("shopMenu");

    shopToggle.addEventListener("click", (e) => {
        e.stopPropagation();
        shopMenu.style.display =
            shopMenu.style.display === "block" ? "none" : "block";
    });

    document.addEventListener("click", () => {
        shopMenu.style.display = "none";
    });

    // Auto redirect to home if user logs out while on a protected page
    const protectedPages = ["/restocks", "/proofs", "/support", "/shop/mm2"];
    firebase.auth().onAuthStateChanged(user => {
        if (!user) {
            window.isLoggedIn().then(loggedIn => {
                if (!loggedIn && protectedPages.includes(window.location.pathname)) {
                    window.location.href = "/";
                }
            });
        }
    });

});
