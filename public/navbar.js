document.querySelectorAll(".navBtn").forEach(btn => {
    btn.addEventListener("click", () => {
        const text = btn.textContent.trim();

        if (text === "Restocks") window.location = "/restocks";
        if (text === "Proofs") window.location = "/proofs";
        if (text === "Support") window.location = "/support";
    });
});

const shopToggle = document.getElementById("shopToggle");
const shopMenu = document.getElementById("shopMenu");

shopToggle.addEventListener("click", (e) => {
    e.stopPropagation();
    shopMenu.style.display =
        shopMenu.style.display === "block" ? "none" : "block";
});

// Close if clicked anywhere else
document.addEventListener("click", () => {
    shopMenu.style.display = "none";
});
