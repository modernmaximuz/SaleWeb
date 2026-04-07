(() => {
    const PASTE_ID = "fZ3piaUg";
    let token = null;
    let isAdmin = false;
    let dataCache = {};

// Detect Firebase admin
firebase.auth().onAuthStateChanged(async (user) => {
    if (user) {
        token = await user.getIdToken();
        isAdmin = true;
        await fetch("/logout-discord"); // clear Discord session
    } else {
        token = null;
        isAdmin = false;
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
    const container = document.getElementById("stockContainer");
    if (!container) return;
    container.innerHTML = ""; // clear old content

    try {
        const res = await fetch("/load/fZ3piaUg", {
            headers: token ? { Authorization: "Bearer " + token } : {}
        });

        const json = await res.json();

        // ✅ Parse content safely
        let data;
        if (json.content) {
            try {
                data = JSON.parse(json.content);
            } catch (err) {
                console.error("Failed to parse stock content:", err);
                container.innerHTML = "<p style='text-align:center;'>Failed to parse stock.</p>";
                return;
            }
        } else {
            console.error("No content found in paste");
            container.innerHTML = "<p style='text-align:center;'>Stock not found.</p>";
            return;
        }

        // Cache for render() & admin editing
        dataCache = data;
render();

let currentPage = 1;
const ITEMS_PER_PAGE = 10;

function render() {
    const container = document.getElementById("stockContainer");
    container.innerHTML = "";

    const search = document.getElementById("searchInput")?.value.toLowerCase() || "";
    const mm2 = dataCache.mm2 || {};

    // Filter + search + in stock
    let items = Object.entries(mm2).filter(([name, data]) =>
        data.stock > 0 &&
        name.toLowerCase().includes(search)
    );

    const totalPages = Math.ceil(items.length / ITEMS_PER_PAGE);
    if (currentPage > totalPages) currentPage = totalPages || 1;

    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    const pagedItems = items.slice(start, start + ITEMS_PER_PAGE);

    for (let [itemName, data] of pagedItems) {
        const card = document.createElement("div");
        card.className = "card";

        card.innerHTML = `
            <div class="imgBox">
                <img src="${data.img}" />
            </div>
            <div class="info">
                <span class="name">${itemName}</span>
            </div>
        `;

        const infoDiv = card.querySelector(".info");

        if (isAdmin) {
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

    // Update page info
    document.getElementById("pageInfo").textContent =
        `Page ${currentPage} of ${totalPages}`;
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

document.getElementById("prevPage")?.addEventListener("click", () => {
    if (currentPage > 1) {
        currentPage--;
        render();
    }
});

document.getElementById("nextPage")?.addEventListener("click", () => {
    const mm2 = dataCache.mm2 || {};
    const totalItems = Object.keys(mm2).length;
    const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);

    if (currentPage < totalPages) {
        currentPage++;
        render();
    }
});
    
})();


