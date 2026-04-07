(() => {
    const PASTE_ID = "fZ3piaUg";
let isAdmin = false;
let dataCache = {};
let token = null;

// Detect Firebase admin
firebase.auth().onAuthStateChanged(async (user) => {
    if (user) {
        token = await user.getIdToken();
        isAdmin = true;
        await fetch("/logout-discord");
    }

    await loadStock();
});

// Detect Discord login
async function initDiscord() {
    const res = await fetch("/me");
    const user = await res.json();
    if (user) isAdmin = false;

    await loadStock();
}
initDiscord();

async function loadStock() {
    const res = await fetch(`/load/${PASTE_ID}`);
    const data = await res.json();

    try {
        dataCache = JSON.parse(data.content);
    } catch {
        console.log("Parse error", data);
        dataCache = {};
    }

    render();
}

function render() {
    const container = document.getElementById("stockContainer");
    container.innerHTML = "";

    const search = document.getElementById("searchInput")?.value.toLowerCase() || "";
    const mm2 = dataCache.mm2 || {};

    for (let itemName in mm2) {
        const data = mm2[itemName];

        // Skip 0 stock
        if (data.stock <= 0) continue;

        // Search filter
        if (!itemName.toLowerCase().includes(search)) continue;

        const card = document.createElement("div");
        card.className = "card";

        card.innerHTML = `
            <div class="imgBox">
                <img src="${data.img}" />
                <div class="price-label">₱</div>
            </div>

            <div class="info">
                <span class="name">${itemName}</span>
                <span class="stock-label">Stock:</span>
            </div>
        `;

        const infoDiv = card.querySelector(".info");

        if (isAdmin) {
            // Editable stock
            const stockInput = document.createElement("input");
            stockInput.type = "number";
            stockInput.min = 0;
            stockInput.value = data.stock;
            stockInput.className = "stock-input";
            stockInput.onchange = async () => {
                dataCache.mm2[itemName].stock = parseInt(stockInput.value);
                await saveStock();
            };
            infoDiv.appendChild(stockInput);

            // Editable price
            const priceInput = document.createElement("input");
            priceInput.type = "number";
            priceInput.min = 0;
            priceInput.step = "0.01";
            priceInput.value = data.price;
            priceInput.className = "price-input";
            priceInput.onchange = async () => {
                dataCache.mm2[itemName].price = parseFloat(priceInput.value);
                await saveStock();
            };
            infoDiv.appendChild(priceInput);
        } else {
            const stockSpan = document.createElement("span");
            stockSpan.className = "stock";
            stockSpan.textContent = `Stock: ${data.stock}`;
            infoDiv.appendChild(stockSpan);

            const priceSpan = document.createElement("div");
            priceSpan.className = "price";
            priceSpan.textContent = `₱${data.price}`;
            infoDiv.appendChild(priceSpan);
        }

        container.appendChild(card);
    }
}

async function saveStock() {
    if (!isAdmin) return;
    await fetch(`/save/${PASTE_ID}`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ content: JSON.stringify(dataCache, null, 2) })
    });

    render();
}

// Auto refresh for viewers
setInterval(() => {
    if (!isAdmin) loadStock();
}, 5000);

// Search input
const searchInput = document.getElementById("searchInput");
if (searchInput) {
    searchInput.addEventListener("input", () => render());
}
})();
