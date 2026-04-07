window.addEventListener("load", () => {

async function requireLogin(e, goTo) {
    e.preventDefault();

    let ok = false;

if (window.isLoggedIn) {
    ok = await window.isLoggedIn();
} else {
    // fallback check (Discord cookie)
    try {
        const res = await fetch("/me");
        const user = await res.json();
        ok = !!user;
    } catch {
        ok = false;
    }
}

function showLoginWarning() {
    let warn = document.getElementById("loginWarn");
    if (!warn) {
        warn = document.createElement("div");
        warn.id = "loginWarn";
        warn.innerText = "Please login first";
        document.body.appendChild(warn);
    }

    warn.style.display = "block";
    setTimeout(() => warn.style.display = "none", 2000);
}

// Buttons
document.querySelectorAll(".navBtn").forEach(btn => {
    const text = btn.textContent.trim();

    if (text === "Restocks")
        btn.addEventListener("click", (e) => requireLogin(e, "/restocks"));

    if (text === "Proofs")
        btn.onclick = (e) => requireLogin(e, "/proofs");

    if (text === "Support")
        btn.onclick = (e) => requireLogin(e, "/support");
});

// Shop links
document.querySelectorAll("#shopMenu a").forEach(a => {
    a.onclick = (e) => requireLogin(e, a.getAttribute("href"));
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

});
