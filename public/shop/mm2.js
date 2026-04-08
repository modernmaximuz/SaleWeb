(() => {
const PASTE_ID = "fZ3piaUg";

let token = null;
let isAdmin = false;
let dataCache = {};

let currentPage = 1;
const ITEMS_PER_PAGE = 84;

// ---------------- AUTH ----------------
firebase.auth().onAuthStateChanged(async (user) => {
    if (user) {
        token = await user.getIdToken();
        isAdmin = true;
        await fetch("/logout-discord");
    } else {
        token = null;
        isAdmin = false;
    }
    await loadStock();
});

async function initDiscord() {
    const res = await fetch("/me");
    const user = await res.json();
    if (user) isAdmin = false;
    await loadStock();
}
initDiscord();

// ---------------- LOAD ----------------
async function loadStock() {
    try {
        const res = await fetch(`/load/${PASTE_ID}`, {
            headers: token ? { Authorization: "Bearer " + token } : {}
        });

        const json = await res.json();
        if (!json.content) return;

        dataCache = JSON.parse(json.content);
        render();

    } catch (err) {
        console.error("Load failed:", err);
    }
}

// ---------------- RENDER ----------------
function render() {
    const container = document.getElementById("stockContainer");
    container.innerHTML = "";

    const search = document.getElementById("searchInput")?.value.toLowerCase() || "";
    const mm2 = dataCache.mm2 || {};

    let items = Object.entries(mm2).filter(([name, d]) => {
    const match = name.toLowerCase().includes(search);

    // If searching, allow all matches
    if (search) return match;

    // If not searching, only show in-stock
    return match && d.stock > 0;
});

    const totalPages = Math.ceil(items.length / ITEMS_PER_PAGE);
    if (currentPage > totalPages) currentPage = totalPages || 1;

    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    const paged = items.slice(start, start + ITEMS_PER_PAGE);

    for (let [name, d] of paged) {
        const card = document.createElement("div");
        card.className = "card";
        const imgSrc = d.stock > 0 ? d.img : "/images/nostock.png";

card.innerHTML = `
    <div class="imgBox"><img src="${imgSrc}"></div>
    <div class="info"><span class="name">${name}</span></div>
`;

        const info = card.querySelector(".info");

        if (isAdmin) {
            const s = document.createElement("input");
            s.type = "number";
            s.value = d.stock;
            s.onchange = async () => {
                dataCache.mm2[name].stock = +s.value;
                await saveStock();
            };
            info.appendChild(s);

            const p = document.createElement("input");
            p.type = "number";
            p.step = "0.01";
            p.value = d.price;
            p.onchange = async () => {
                dataCache.mm2[name].price = +p.value;
                await saveStock();
            };
            info.appendChild(p);
        } else {
            info.innerHTML += `
    <div class="stock">Stock: ${d.stock}</div>
    <div class="price">₱${d.price}</div>
    <input type="number" min="1" value="1" class="qtyInput">
<button class="addCartBtn">Add to Cart</button>
`;

const btn = info.querySelector(".addCartBtn");
const qtyInput = info.querySelector(".qtyInput");

btn.onclick = () => {
    addToCart({
        name,
        price: d.price,
        img: d.img,
        qty: parseInt(qtyInput.value) || 1
    });
};
        }

        container.appendChild(card);
    }

    document.getElementById("pageInfo").textContent =
        `Page ${currentPage} of ${totalPages}`;
}

// ---------------- SAVE ----------------
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

// ---------------- EVENTS ----------------
document.getElementById("searchInput")?.addEventListener("input", () => {
    currentPage = 1;
    render();
});

document.getElementById("prevPage")?.addEventListener("click", () => {
    if (currentPage > 1) {
        currentPage--;
        render();
    }
});

document.getElementById("nextPage")?.addEventListener("click", () => {
    currentPage++;
    render();
});

// Auto refresh viewers
setInterval(() => {
    if (!isAdmin) loadStock();
}, 5000);

})();
