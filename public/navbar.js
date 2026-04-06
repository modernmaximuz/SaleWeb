document.querySelectorAll(".navBtn").forEach(btn => {
    btn.addEventListener("click", () => {
        const text = btn.textContent.trim();

        if (text === "Restocks") window.location = "/restocks.html";
        if (text === "Proofs") window.location = "/proofs.html";
        if (text === "Support") window.location = "/support.html";
    });
});
