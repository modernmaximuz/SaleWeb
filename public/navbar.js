window.addEventListener("load", () => {

    const MAX_WARNINGS = 5;
    let warningQueue = [];

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

            // Show login warning (max 5 at a time)
            if (warningQueue.length >= MAX_WARNINGS) {
                const oldest = warningQueue.shift();
                oldest.remove();
            }

            const warn = document.createElement("div");
            warn.className = "loginWarn";
            warn.innerText = "Login required. Use Discord to continue.";
            warn.style.bottom = `${warningQueue.length * 60 + 20}px`; // stack vertically
            document.body.appendChild(warn);
            warningQueue.push(warn);

            if (typeof window.openLoginModal === "function") {
                setTimeout(() => window.openLoginModal(), 150);
            }

            setTimeout(() => {
                warn.remove();
                warningQueue = warningQueue.filter(w => w !== warn);
                // reposition remaining warnings
                warningQueue.forEach((w, i) => {
                    w.style.bottom = `${i * 60 + 20}px`;
                });
            }, 5000);

            return false;
        }

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

    // Dropdown toggle
    const shopToggle = document.getElementById("shopToggle");
    const shopMenu = document.getElementById("shopMenu");

    shopToggle.addEventListener("click", async (e) => {
        e.stopPropagation();
        const ok = await requireLogin(e, null, shopToggle);
        if (ok) {
            shopMenu.style.display = shopMenu.style.display === "block" ? "none" : "block";
        }
    });

    document.addEventListener("click", () => {
        shopMenu.style.display = "none";
    });

     // Auto redirect to home if user logs out while on protected page
    const protectedPages = ["/restocks", "/proofs", "/support", "/shop/mm2"];
    firebase.auth().onAuthStateChanged(async (user) => {
        if (!user) {
            const loggedIn = await window.isLoggedIn();
            if (!loggedIn && protectedPages.includes(window.location.pathname)) {
                window.location.href = "/";
            }
        }
    });

});
