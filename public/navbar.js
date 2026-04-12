const MAX_WARNINGS = 5;
let warningQueue = [];

// Global function for login requirements
window.requireLogin = async function(e, goTo, btn) {
        e.preventDefault();

        let ok = false;
        let hasFirebaseAuth = false;

        // Check Firebase authentication first
        if (window.firebase && firebase.auth && firebase.auth().currentUser) {
            hasFirebaseAuth = true;
            ok = true;
        } else {
            // Check Discord authentication as fallback
            try {
                const res = await fetch("/me");
                const user = await res.json();
                ok = !!user;
            } catch {
                ok = false;
            }
        }

        if (!ok) {
            // Shake button
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

        // Always navigate if authenticated and goTo is provided
        if (goTo) {
            window.location.href = goTo;
        }
        return true;
}

// Initialize navbar when DOM is loaded
window.addEventListener("load", () => {
    // Dropdown toggle
    const shopToggle = document.getElementById("shopToggle");
    const shopMenu = document.getElementById("shopMenu");
    const topbar = document.getElementById("topbar");

    shopToggle?.addEventListener("click", async (e) => {
        e.stopPropagation();
        const ok = await window.requireLogin(e, null, shopToggle);
        if (ok) {
            shopMenu.style.display = shopMenu.style.display === "block" ? "none" : "block";
        }
    });

    document.addEventListener("click", () => {
        if (shopMenu) shopMenu.style.display = "none";
    });

    function closeMobileNav() {
        topbar?.classList.remove("mobile-open");
    }

    function setupMobileNav() {
        if (!topbar) return;
        if (document.getElementById("mobileMenuToggle")) return;

        const toggle = document.createElement("button");
        toggle.id = "mobileMenuToggle";
        toggle.type = "button";
        toggle.textContent = "Menu";
        topbar.appendChild(toggle);

        toggle.addEventListener("click", (e) => {
            e.stopPropagation();
            topbar.classList.toggle("mobile-open");
            if (!topbar.classList.contains("mobile-open") && shopMenu) {
                shopMenu.style.display = "none";
            }
        });

        document.querySelectorAll("#navCenter .navBtn, #shopMenu a, #navRight button").forEach((el) => {
            el.addEventListener("click", () => {
                if (window.innerWidth <= 900) closeMobileNav();
            });
        });

        document.addEventListener("click", (e) => {
            if (window.innerWidth > 900) return;
            if (!topbar.contains(e.target)) closeMobileNav();
        });
    }

    function syncTopbarOffset() {
        if (!topbar) return;
        const extra = window.innerWidth <= 900 ? 12 : 18;
        document.body.style.paddingTop = `${topbar.offsetHeight + extra}px`;
    }

    setupMobileNav();
    syncTopbarOffset();
    window.addEventListener("resize", syncTopbarOffset);

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
